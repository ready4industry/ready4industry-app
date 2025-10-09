// script.js (FINAL VERSION - Corrected and Roll Number Optional)

// 🚨 IMPORTANT: REPLACE THESE WITH YOUR ACTUAL SUPABASE KEYS 🚨
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL'; 
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Use a client name that avoids conflicts
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- ASSESSMENT CONFIGURATION ---
const TOTAL_QUESTIONS = 10;
const TIME_LIMIT_MINUTES = 10; 

// --- STATE VARIABLES ---
let candidateId = null;
let currentQuestions = []; 
let candidateAnswers = []; 
let currentQuestionIndex = 0;
let assessmentStartTime = null;

// Metrics for Professional Tracking (Anti-Cheating)
let timerInterval = null;
let secondsRemaining = TIME_LIMIT_MINUTES * 60;
let focusLossCount = 0;
let focusLossTime = 0; 
let focusLossStart = null;


// --- UTILITY FUNCTIONS ---

const showScreen = (id) => {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('instructions-screen').style.display = 'none'; 
    document.getElementById('quiz-screen').style.display = 'none';
    document.getElementById('score-screen').style.display = 'none';
    document.getElementById(id).style.display = 'block';
};

const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// --- TIMING AND ANTI-CHEATING LOGIC ---

const updateTimer = () => {
    secondsRemaining--;
    document.getElementById('timer').textContent = `Time Remaining: ${formatTime(secondsRemaining)}`;

    if (secondsRemaining <= 0) {
        clearInterval(timerInterval);
        alert("Time's up! The assessment will now be submitted automatically.");
        submitFinalAssessment(true); // Auto-submit due to timeout
    }
};

document.addEventListener('visibilitychange', () => {
    const now = Date.now();
    
    if (document.hidden && assessmentStartTime) {
        if (document.getElementById('quiz-screen').style.display === 'block') {
            focusLossCount++;
            focusLossStart = now;
            console.warn("FOCUS LOSS DETECTED: User switched away from assessment tab.");
        }
    } else if (focusLossStart) {
        const lossDuration = Math.round((now - focusLossStart) / 1000); 
        focusLossTime += lossDuration;
        focusLossStart = null;
        console.warn(`FOCUS REGAINED. Duration out of focus: ${lossDuration}s. Total focus loss: ${focusLossTime}s.`);
    }
});


// --- QUIZ LOGIC ---

const renderQuestion = (index) => {
    const q = currentQuestions[index];

    // Use PascalCase for fetching question text from the data object
    document.getElementById('question-counter').textContent = `Question ${index + 1} / ${currentQuestions.length}`;
    document.getElementById('question-text').textContent = q.QuestionText; 
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = ''; 

    // Create a map to access the options using the PascalCase names
    const optionKeyMap = {
        'A': q.OptionA,
        'B': q.OptionB,
        'C': q.OptionC,
        'D': q.OptionD,
    };

    ['A', 'B', 'C', 'D'].forEach(key => {
        // Use the map to get the correct option text
        const optionText = optionKeyMap[key]; 
        const label = document.createElement('label');
        label.innerHTML = `<input type="radio" name="answer" value="${key}" required> **${key}**: ${optionText}`;
        optionsContainer.appendChild(label);
    });

    document.getElementById('next-button').textContent = 
        (index === currentQuestions.length - 1) ? 'Submit Assessment' : 'Submit Answer & Next';
};


// 3. Secure Final Submission Function (No changes needed here)
const submitFinalAssessment = async (isTimeout = false) => {
    clearInterval(timerInterval); 
    document.getElementById('next-button').disabled = true;
    document.getElementById('next-button').textContent = 'Submitting...';

    const assessmentEndTime = Date.now();
    const timeTakenSeconds = Math.round((assessmentEndTime - assessmentStartTime) / 1000);

    try {
        const assessmentMetrics = {
            time_taken_seconds: timeTakenSeconds,
            is_timeout: isTimeout,
            focus_loss_count: focusLossCount,
            focus_loss_time_seconds: focusLossTime,
        };

        const { data: result, error: rpcError } = await supabaseClient.rpc('submit_assessment', {
            p_candidate_id: candidateId,
            p_answers: candidateAnswers,
            p_metrics: assessmentMetrics 
        });

        if (rpcError) throw rpcError;
        
        const finalScore = result[0].score_achieved;
        document.getElementById('final-score').textContent = finalScore;
        
        showScreen('score-screen');

    } catch (error) {
        alert('A critical error occurred during final submission. Check Supabase connection/keys/database: ' + error.message);
    }
};


// --- EVENT HANDLERS ---

// 1. Handle Candidate Registration -> Instructions Screen
document.getElementById('candidate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('candidate-form').querySelector('button').disabled = true;

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    // Roll number logic removed from here and the INSERT statement below
    
    try {
        // A. Insert Candidate into 'candidates' table (Only name and email)
        const { data: candidate, error: candidateError } = await supabaseClient
            .from('candidates')
            .insert([{ name, email }]) 
            .select('id')
            .single();

        if (candidateError) throw candidateError;
        candidateId = candidate.id;
        
        // B. Load 10 Random Questions (Using correct PascalCase column names)
        const { data: questions, error: questionError } = await supabaseClient
            .from('questions')
            .select('id, "QuestionText", "OptionA", "OptionB", "OptionC", "OptionD", "CorrectAnswer"')
            .order('random', { ascending: false })
            .limit(TOTAL_QUESTIONS);

        if (questionError) throw questionError;

        if (questions.length === 0) {
            alert('Error: No questions available in the database.');
            return;
        }

        currentQuestions = questions;
        currentQuestionIndex = 0; 
        candidateAnswers = []; 

        // C. Show Instructions Screen
        showScreen('instructions-screen');

    } catch (error) {
        alert('An error occurred during registration or loading. Check database schema/RLS: ' + error.message);
        document.getElementById('candidate-form').querySelector('button').disabled = false;
    }
});


// 2. Handle Instructions Acknowledge -> Quiz Start
document.getElementById('start-quiz-button').addEventListener('click', () => {
    
    // START PROFESSIONAL TRACKING
    assessmentStartTime = Date.now();
    secondsRemaining = TIME_LIMIT_MINUTES * 60;
    timerInterval = setInterval(updateTimer, 1000);

    // DYNAMICALLY ADD TIMER DISPLAY
    const timerElement = document.createElement('div');
    timerElement.id = 'timer';
    timerElement.textContent = `Time Remaining: ${formatTime(secondsRemaining)}`;
    document.getElementById('quiz-screen').prepend(timerElement); 
    
    // START QUIZ
    showScreen('quiz-screen');
    renderQuestion(currentQuestionIndex);
});


// 3. Handle Answer Submission and Scoring
document.getElementById('quiz-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const selectedOptionElement = document.querySelector('input[name="answer"]:checked');
    const submittedOption = selectedOptionElement ? selectedOptionElement.value : null;

    if (!submittedOption) {
        alert('Please select an option before proceeding.');
        return;
    }
    
    candidateAnswers.push({
        question_id: currentQuestions[currentQuestionIndex].id,
        submitted_option: submittedOption
    });

    currentQuestionIndex++;

    if (currentQuestionIndex < currentQuestions.length) {
        document.getElementById('quiz-form').reset(); 
        renderQuestion(currentQuestionIndex);
    } else {
        submitFinalAssessment(false);
    }
});
