// script.js (Professional Assessment Version with Instructions)

// 🚨 IMPORTANT: REPLACE THESE WITH YOUR ACTUAL SUPABASE KEYS 🚨
const SUPABASE_URL = 'https://bgqwsglxszzhtuameled.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJncXdzZ2x4c3p6aHR1YW1lbGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5OTg4ODcsImV4cCI6MjA3NTU3NDg4N30.cZcOsWlu6jnrdtuxtrFPRJbxiA83WBRyyl9D_EPnN08';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    
    if (document.hidden) {
        focusLossCount++;
        focusLossStart = now;
        console.warn("FOCUS LOSS DETECTED: User switched away from assessment tab.");
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
    document.getElementById('question-counter').textContent = `Question ${index + 1} / ${currentQuestions.length}`;
    document.getElementById('question-text').textContent = q.question_text;
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = ''; 

    ['a', 'b', 'c', 'd'].forEach(key => {
        const optionText = q[`option_${key}`];
        const label = document.createElement('label');
        label.innerHTML = `<input type="radio" name="answer" value="${key.toUpperCase()}" required> **${key.toUpperCase()}**: ${optionText}`;
        optionsContainer.appendChild(label);
    });

    document.getElementById('next-button').textContent = 
        (index === currentQuestions.length - 1) ? 'Submit Assessment' : 'Submit Answer & Next';
};


// 3. Secure Final Submission Function
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

        const { data: result, error: rpcError } = await supabase.rpc('submit_assessment', {
            p_candidate_id: candidateId,
            p_answers: candidateAnswers,
            p_metrics: assessmentMetrics 
        });

        if (rpcError) throw rpcError;
        
        const finalScore = result[0].score_achieved;
        document.getElementById('final-score').textContent = finalScore;
        
        showScreen('score-screen');

    } catch (error) {
        alert('A critical error occurred during final submission: ' + error.message);
    }
};


// --- EVENT HANDLERS ---

// 1. Handle Candidate Registration -> Instructions Screen
document.getElementById('candidate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('candidate-form').querySelector('button').disabled = true;

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const rollNumber = document.getElementById('roll-number').value;

    try {
        // A. Insert Candidate into 'candidates' table
        const { data: candidate, error: candidateError } = await supabase
            .from('candidates')
            .insert([{ name, email, roll_number: rollNumber }])
            .select('id')
            .single();

        if (candidateError) throw candidateError;
        candidateId = candidate.id;
        
        // B. Load 10 Random Questions
        const { data: questions, error: questionError } = await supabase
            .from('questions')
            .select('id, question_text, option_a, option_b, option_c, option_d')
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
        alert('An error occurred during registration or loading: ' + error.message);
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
