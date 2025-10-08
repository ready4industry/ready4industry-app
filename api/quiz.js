// 🔑 THE ONLY CHANGE: Use the name you stored in GitHub Secrets
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_KEY; 

// Perplexity API details
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// --- Function to get the System Prompt based on the quiz type ---
function getSystemPrompt(quizType) {
    switch (quizType) {
        case 'technical':
            return "You are an expert B.Tech Computer Science professor and a recruiter interviewing fresh graduates in India. Your task is to generate exactly 10 **fundamental and foundational** multiple-choice quiz questions based on core CS subjects (DSA, OS, DBMS, OOP). These should test **basic conceptual understanding** relevant for an entry-level role. Use Indian names (e.g., 'Priya', 'Ravi') in any scenario-based questions. Use proper LaTeX formatting for any mathematical or scientific notation (e.g., $O(n^2)$ or $\\sum_{i=1}^{n} i$).";
        case 'aptitude':
            return "You are a professional aptitude and logic trainer, generating material for Indian entry-level recruitment exams. Your task is to generate exactly 10 **foundational and core** multiple-choice quiz questions focused on **basic** quantitative aptitude, logical reasoning, and number systems. These must use **Indian currency (Rupees/₹) and Indian names (e.g., 'Amit', 'Sneha')** in problems. Use proper LaTeX formatting for any mathematical or scientific notation (e.g., The formula is $A = \\pi r^2$).";
        case 'behavioural':
            return "You are an HR expert specializing in corporate behavioural assessment for Indian companies hiring fresh B.Tech graduates. Your task is to generate exactly 10 **fundamental** behavioural multiple-choice questions. These should focus on **basic professional ethics, communication etiquette, and teamwork principles** suitable for an entry-level professional in an Indian corporate setting. Use common Indian workplace scenarios where applicable.";
        default:
            return "Generate 10 multiple-choice questions.";
    }
}

// --- JSON Output Schema Definition ---
const JSON_INSTRUCTION_SCHEMA = {
    type: "array",
    items: {
        type: "object",
        properties: {
            "question": { "type": "string", "description": "The quiz question, using $ for LaTeX." },
            "options": { 
                "type": "array", 
                "items": { "type": "string", "description": "Exactly four answer options, using $ for LaTeX." },
                "description": "Exactly four answer options." 
            }, 
            "correctAnswerIndex": { 
                "type": "integer", 
                "description": "The 0-indexed position of the correct answer (0, 1, 2, or 3)." 
            }
        },
        "required": ["question", "options", "correctAnswerIndex"]
    }
};

// --- Handler function for Netlify/Vercel Serverless ---
export default async function handler(request) {
    
    // Check for POST request and API key
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    if (!PERPLEXITY_API_KEY) {
        console.error("PERPLEXITY_KEY is missing from environment variables! Check GitHub Secrets and deployment configuration.");
        return new Response('API Key Configuration Error: PERPLEXITY_KEY not found.', { status: 500 });
    }

    try {
        const { quizType, model } = await request.json();

        const systemPrompt = getSystemPrompt(quizType);
        const userQuery = "Generate the 10 multiple-choice quiz questions now, strictly in the JSON array format defined in the system instructions. Do not include any explanation or markdown outside the JSON.";

        const perplexityPayload = {
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userQuery }
            ],
            // ** 🚀 FINAL FIX APPLIED HERE 🚀 **
            response_format: {
                type: "json_schema",
                // The 'json_schema' key must contain a 'schema' property
                json_schema: {
                    schema: JSON_INSTRUCTION_SCHEMA 
                }
            },
            temperature: 0.7 
        };
        
        // --- 🔑 SECURE API CALL ---
        const apiResponse = await fetch(PERPLEXITY_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // This is where the secret is used!
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}` 
            },
            body: JSON.stringify(perplexityPayload)
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error("Perplexity API Error:", errorBody);
            // Return the actual API status code for better debugging (e.g., 401 if the key is bad)
            return new Response(`Perplexity API Error: ${apiResponse.status} - ${errorBody}`, { status: apiResponse.status });
        }

        const result = await apiResponse.json();
        const jsonText = result.choices?.[0]?.message?.content;

        if (!jsonText) {
            return new Response('Invalid API response structure.', { status: 500 });
        }
        
        // Clean up markdown wrappers
        let cleanJsonText = jsonText.trim();
        if (cleanJsonText.startsWith('```json')) {
            cleanJsonText = cleanJsonText.substring(7);
        }
        if (cleanJsonText.endsWith('```')) {
            cleanJsonText = cleanJsonText.substring(0, cleanJsonText.length - 3);
        }
        cleanJsonText = cleanJsonText.trim();

        const parsedData = JSON.parse(cleanJsonText);
        
        // Return the clean JSON quiz data directly to the browser
        return new Response(JSON.stringify(parsedData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Serverless Function Error:", error);
        return new Response(`Server Error processing request: ${error.message}`, { status: 500 });
    }
}
