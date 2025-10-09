// ===============================================
// 1. SUPABASE CONNECTION DETAILS - UPDATE THESE TWO LINES
// ===============================================
const SUPABASE_URL = 'https://bijcdrtlmuwosrtqivtx.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpamNkcnRsbXV3b3NydHFpdnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MDExODgsImV4cCI6MjA3NTQ3NzE4OH0.uraVwNy-s7CmR49G70O9M_fTZoCSTnaOtHavRp0m9Dk'; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===============================================
// 2. STATE AND CONSTANTS
// ===============================================
let currentQuestions = [];
let currentQuestionIndex = 0;
let candidateID = null;
let quizStartTime = null;
let focusLossCount = 0;
let focusLossTimeSeconds = 0;
let isTimeout = false;

const QUIZ_DURATION_SECONDS = 600; // 10 minutes
let timerInterval = null;
const selectedAnswers = {};

// ===============================================
// 3. UI ELEMENT REFERENCES
// ===============================================
const app = document.getElementById('app');
const instructionsScreen = document.getElementById('instructions-screen');
const registrationScreen = document.getElementById('registration-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');
const questionDisplay = document.getElementById('question-display');
const timerDisplay = document.getElementById('timer');
const resultMessage = document.getElementById('result-message');
const scoreDisplay = document.getElementById('score-display');
const candidateNameDisplay = document.getElementById('candidate-name');
const candidateEmailDisplay = document.getElementById('candidate-email');
const questionCounter = document.getElementById('question-counter');
const nextButton = document.getElementById('next-btn');
const submitButton = document.getElementById('submit-btn');

// ===============================================
// 4. CORE APPLICATION FUNCTIONS
// ===============================================

// Function to navigate between screens
function navigateTo(screen) {
    registrationScreen.style.display = 'none';
    instructionsScreen.style.display = 'none';
    quizScreen.style.display = 'none';
    resultScreen.style.display = 'none';
    if (screen) {
        screen.style.display = 'block';
    }
}

// Loads 10 random questions from the database
async function loadQuestions() {
    // 🚨 CRITICAL: Uses lowercase snake_case column names to match your new table schema 🚨
    const { data: questions, error: questionError } = await supabaseClient
        .from('questions')
        .select('id, question_text, option_a, option_b, option_c, option_d, correct_answer')
        .limit(10)
        .order('id', { ascending: false }) // Simple way to get a varied set
        
    if (questionError) {
        console.error('Question loading error:', questionError);
        alert(`An error occurred during registration or loading: ${questionError.message}`);
        return null;
    }
    return questions;
}

// Displays the current question
function displayQuestion(index) {
    const q = currentQuestions[index];
    if (!q) return;

    questionCounter.textContent = `Question ${index + 1} of ${currentQuestions.length}`;
    
    // Build the options dynamically
    const optionsHTML = ['a', 'b', 'c', 'd'].map(optionKey => {
        const optionValue = q[`option_${optionKey}`];
        const checked = selectedAnswers[q.id] === optionKey ? 'checked' : '';
        return `
            <div class="option">
                <input type="radio" id="q${index}-${optionKey}" name="q${index}" value="${optionKey}" ${checked}>
                <label for="q${index}-${optionKey}">${optionValue}</label>
            </div>
        `;
    }).join('');

    questionDisplay.innerHTML = `
        <h3>${q.question_text}</h3>
        <form onchange="handleAnswerSelection('${q.id}', event)">
            ${optionsHTML}
        </form>
    `;

    // Manage button visibility
    nextButton.style.display = index < currentQuestions.length - 1 ? 'inline-block' : 'none';
    submitButton.style.display = index === currentQuestions.length - 1 ? 'inline-block' : 'none';
}

// Handles user selecting an answer
function handleAnswerSelection(questionId, event) {
    if (event.target.type === 'radio') {
        selectedAnswers[questionId] = event.target.value;
    }
}

// Manages the quiz timer display
function updateTimer() {
    const elapsedSeconds = Math.floor((Date.now() - quizStartTime) / 1000);
    const remainingSeconds = QUIZ_DURATION_SECONDS - elapsedSeconds;

    if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        timerDisplay.textContent = 'Time Up!';
        isTimeout = true;
        submitAssessment();
        return;
    }

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    timerDisplay.textContent = `Time Remaining: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ===============================================
// 5. EVENT HANDLERS AND MAIN FLOW
// ===============================================

// Handles the registration form submission
document.getElementById('registration-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();

    if (!name || !email) {
        alert('Please enter your name and email.');
        return;
    }
    
    // 1. Insert new candidate record
    const { data, error } = await supabaseClient
        .from('candidates')
        .insert([
            { name, email }
        ])
        .select('id')
        .single();

    if (error) {
        console.error('Registration failed:', error);
        alert(`An error occurred during registration or loading: new row violates row-level security policy for table "candidates"`);
        return;
    }

    // Success: Store ID and navigate
    candidateID = data.id;
    candidateNameDisplay.textContent = name;
    candidateEmailDisplay.textContent = email;
    navigateTo(instructionsScreen);
});

// Starts the quiz after instructions are read
document.getElementById('start-quiz-btn').addEventListener('click', async () => {
    currentQuestions = await loadQuestions();

    if (!currentQuestions || currentQuestions.length === 0) {
        alert('Could not load questions. Check database connection or RLS policies.');
        return;
    }

    currentQuestionIndex = 0;
    quizStartTime = Date.now();
    
    // Start anti-cheating measures and timer
    document.addEventListener('visibilitychange', handleVisibilityChange);
    timerInterval = setInterval(updateTimer, 1000);

    displayQuestion(currentQuestionIndex);
    navigateTo(quizScreen);
});

// Handles moving to the next question
nextButton.addEventListener('click', () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        displayQuestion(currentQuestionIndex);
    }
});

// Handles moving to the previous question
document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion(currentQuestionIndex);
    }
});

// Submits the assessment for scoring
submitButton.addEventListener('click', () => {
    // Stop anti-cheating measures and timer
    clearInterval(timerInterval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    submitAssessment();
});


// ===============================================
// 6. SUBMISSION & SCORING LOGIC
// ===============================================

async function submitAssessment() {
    const totalTime = Math.floor((Date.now() - quizStartTime) / 1000);

    // 1. Prepare data for the Stored Procedure (RPC)
    const answersArray = currentQuestions
        .map(q => ({
            question_id: q.id,
            submitted_option: selectedAnswers[q.id] || null // Send null if unanswered
        }));

    const metricsPayload = {
        time_taken_seconds: totalTime,
        is_timeout: isTimeout,
        focus_loss_count: focusLossCount,
        focus_loss_time_seconds: focusLossTimeSeconds
    };

    // 2. Call the Stored Procedure (RPC)
    const { data: result, error: rpcError } = await supabaseClient.rpc('submit_assessment', {
        p_candidate_id: candidateID,
        p_answers: answersArray,
        p_metrics: metricsPayload
    });

    if (rpcError) {
        console.error('Submission RPC failed:', rpcError);
        alert(`Assessment submission failed. Error: ${rpcError.message}`);
        navigateTo(resultScreen); // Show results screen anyway, potentially with error message
        return;
    }

    // 3. Display Result
    const finalScore = result[0].score_achieved;
    resultScreen.style.display = 'block';
    
    resultMessage.textContent = 'Assessment Completed!';
    scoreDisplay.textContent = `Your Score: ${finalScore} out of ${currentQuestions.length}`;
    
    // Display metrics for internal tracking/debugging
    document.getElementById('metrics-info').innerHTML = `
        <p>Time Taken: ${totalTime} seconds</p>
        <p>Focus Loss Count: ${focusLossCount}</p>
        <p>Total Focus Loss Time: ${focusLossTimeSeconds} seconds</p>
    `;

    navigateTo(resultScreen);
}


// ===============================================
// 7. ANTI-CHEATING MEASURE (Visibility Change)
// ===============================================

let focusLossStart = null;

function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
        // User left the quiz tab/window
        focusLossCount++;
        focusLossStart = Date.now();
        console.warn('Focus Lost! Count:', focusLossCount);
    } else {
        // User returned to the quiz tab/window
        if (focusLossStart) {
            const lossDuration = Math.floor((Date.now() - focusLossStart) / 1000);
            focusLossTimeSeconds += lossDuration;
            focusLossStart = null;
            console.warn('Focus Returned. Loss Duration:', lossDuration, 'seconds.');
        }
    }
}

// ===============================================
// 8. INITIALIZATION
// ===============================================

document.addEventListener('DOMContentLoaded', () => {
    navigateTo(registrationScreen);
});
