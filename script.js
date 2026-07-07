// --- APPLICATION STATE ---
let state = {
    board: Array(81).fill(0),
    initial: Array(81).fill(0),
    solution: Array(81).fill(0),
    notes: Array(81).fill().map(() => Array(10).fill(false)),
    history: [], // For Undo stack tracking
    selectedCell: null,
    difficulty: 'medium',
    timer: 0,
    hintsRemaining: 3,
    mistakes: 0,
    notesMode: false,
    isPaused: false
};

let timerInterval = null;

// Real Asymmetric Blanking Thresholds (Option B Engine Execution)
const BLANKS_MAP = {
    'easy': 34,
    'medium': 43,
    'hard': 50,
    'expert': 56,
    'master': 61,
    'extreme': 65
};

// --- CORE MATHEMATICAL ENGINE ---
function checkValidMove(board, row, col, num) {
    for (let x = 0; x < 9; x++) {
        if (board[row * 9 + x] === num || board[x * 9 + col] === num) return false;
    }
    let startRow = row - row % 3, startCol = col - col % 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[(i + startRow) * 9 + (j + startCol)] === num) return false;
        }
    }
    return true;
}

function solveGrid(board) {
    for (let i = 0; i < 81; i++) {
        if (board[i] === 0) {
            let row = Math.floor(i / 9), col = i % 9;
            let numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
            for (let num of numbers) {
                if (checkValidMove(board, row, col, num)) {
                    board[i] = num;
                    if (solveGrid(board)) return true;
                    board[i] = 0;
                }
            }
            return false;
        }
    }
    return true;
}

function generatePuzzle(difficultyTier) {
    let base = Array(81).fill(0);
    solveGrid(base);
    state.solution = [...base];

    let countToRemove = BLANKS_MAP[difficultyTier] || 43;
    let indices = Array.from({length: 81}, (_, i) => i).sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < countToRemove; i++) {
        base[indices[i]] = 0;
    }
    
    state.board = [...base];
    state.initial = base.map(val => val !== 0);
    state.notes = Array(81).fill().map(() => Array(10).fill(false));
    state.history = [];
}

// --- RENDER ROUTINES ---
const boardEl = document.getElementById('sudoku-board');

function initDOMBoard() {
    boardEl.innerHTML = '';
    for (let i = 0; i < 81; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        
        const notesGrid = document.createElement('div');
        notesGrid.classList.add('notes-grid');
        for (let n = 1; n <= 9; n++) {
            const noteCell = document.createElement('div');
            noteCell.classList.add('note-cell');
            noteCell.dataset.note = n;
            notesGrid.appendChild(noteCell);
        }
        cell.appendChild(notesGrid);
        cell.addEventListener('click', () => triggerCellSelection(i));
        boardEl.appendChild(cell);
    }
}

function updateUIRender() {
    const cells = document.querySelectorAll('.cell');
    const sRow = state.selectedCell !== null ? Math.floor(state.selectedCell / 9) : null;
    const sCol = state.selectedCell !== null ? state.selectedCell % 9 : null;

    cells.forEach((cell, i) => {
        const row = Math.floor(i / 9), col = i % 9;
        const val = state.board[i];
        const notesGrid = cell.querySelector('.notes-grid');
        
        let textNode = cell.childNodes[1];
        if (!textNode) {
            textNode = document.createTextNode('');
            cell.appendChild(textNode);
        }

        if (val !== 0) {
            textNode.textContent = val;
            notesGrid.classList.add('hidden');
        } else {
            textNode.textContent = '';
            notesGrid.classList.remove('hidden');
            notesGrid.querySelectorAll('.note-cell').forEach(nCell => {
                const num = parseInt(nCell.dataset.note);
                nCell.textContent = state.notes[i][num] ? num : '';
            });
        }

        // Apply Selection Highlighting Strategy
        cell.className = 'cell';
        if (state.initial[i]) cell.classList.add('given');
        if (i === state.selectedCell) cell.classList.add('selected');
        else if (sRow !== null && (row === sRow || col === sCol || (Math.floor(row/3) === Math.floor(sRow/3) && Math.floor(col/3) === Math.floor(sCol/3)))) {
            cell.classList.add('related');
        }
        if (val !== 0 && !state.initial[i] && val !== state.solution[i]) {
            cell.classList.add('error');
        }
    });

    // Update HUD Stats elements
    document.getElementById('hud-difficulty').textContent = state.difficulty.toUpperCase();
    document.getElementById('hud-mistakes').textContent = `${state.mistakes}/3`;
    document.getElementById('hint-badge').textContent = state.hintsRemaining;
}

// --- INTERACTIVE & MOVE LOGIC ---
function triggerCellSelection(index) {
    if (state.isPaused) return;
    state.selectedCell = (state.selectedCell === index) ? null : index;
    updateUIRender();
}

function processInput(inputVal) {
    if (state.selectedCell === null || state.isPaused || state.initial[state.selectedCell]) return;
    const idx = state.selectedCell;

    // Save previous state instance to History Stack for perfect Undos
    pushStateToHistory();

    if (inputVal === 'erase') {
        state.board[idx] = 0;
        state.notes[idx].fill(false);
    } else {
        const targetNumber = parseInt(inputVal);
        if (state.notesMode) {
            state.board[idx] = 0;
            state.notes[idx][targetNumber] = !state.notes[idx][targetNumber];
        } else {
            state.board[idx] = targetNumber;
            state.notes[idx].fill(false);
            
            // Real-Time Auto Check Validation Execution
            if (targetNumber !== state.solution[idx]) {
                state.mistakes++;
                document.getElementById('hud-mistakes').textContent = `${state.mistakes}/3`;
                if (state.mistakes >= 3) {
                    endGameFlow(false);
                    return;
                }
            } else {
                cascadeClearPencilMarks(idx, targetNumber);
            }
        }
    }
    saveGameStateToStorage();
    updateUIRender();
    evaluateWinState();
}

function cascadeClearPencilMarks(idx, num) {
    const row = Math.floor(idx / 9), col = idx % 9;
    for (let x = 0; x < 9; x++) {
        state.notes[row * 9 + x][num] = false;
        state.notes[x * 9 + col][num] = false;
    }
    let sr = row - row % 3, sc = col - col % 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            state.notes[(i + sr) * 9 + (j + sc)][num] = false;
        }
    }
}

function pushStateToHistory() {
    state.history.push(JSON.stringify({
        board: [...state.board],
        notes: state.notes.map(arr => [...arr]),
        mistakes: state.mistakes
    }));
    if (state.history.length > 20) state.history.shift(); // Bound size limit
}

function executeUndo() {
    if (state.history.length === 0 || state.isPaused) return;
    const pastFrame = JSON.parse(state.history.pop());
    state.board = pastFrame.board;
    state.notes = pastFrame.notes;
    state.mistakes = pastFrame.mistakes;
    updateUIRender();
    saveGameStateToStorage();
}

function executeHint() {
    if (state.selectedCell === null || state.hintsRemaining <= 0 || state.isPaused || state.initial[state.selectedCell]) return;
    const idx = state.selectedCell;
    
    pushStateToHistory();
    state.board[idx] = state.solution[idx];
    state.notes[idx].fill(false);
    state.initial[idx] = true; // Make it look permanent like given cells
    state.hintsRemaining--;
    
    saveGameStateToStorage();
    updateUIRender();
    evaluateWinState();
}

// --- SCREEN FLOW ROUTING ---
function navigateToScreen(screenId) {
    document.querySelectorAll('.screen').forEach(scr => scr.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function startFreshGameFlow(difficultySelected) {
    state.difficulty = difficultySelected;
    state.timer = 0;
    state.mistakes = 0;
    state.hintsRemaining = 3;
    state.selectedCell = null;
    state.isPaused = false;
    state.notesMode = false;

    document.getElementById('btn-notes').classList.remove('active');
    document.getElementById('notes-badge').textContent = 'OFF';
    document.getElementById('confetti-canvas').classList.add('hidden');

    generatePuzzle(state.difficulty);
    initDOMBoard();
    updateUIRender();
    navigateToScreen('screen-game');
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!state.isPaused) {
            state.timer++;
            formatTimeHUD();
        }
    }, 1000);
    saveGameStateToStorage();
}

function formatTimeHUD() {
    const mins = Math.floor(state.timer / 60).toString().padStart(2, '0');
    const secs = (state.timer % 60).toString().padStart(2, '0');
    document.getElementById('hud-timer').textContent = `${mins}:${secs}`;
}

function toggleGamePause() {
    state.isPaused = !state.isPaused;
    document.getElementById('pause-overlay').classList.toggle('hidden', !state.isPaused);
    document.getElementById('pause-icon').innerHTML = state.isPaused 
        ? '<path d="M8 5v14l11-7z"/>' 
        : '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
}

function evaluateWinState() {
    if (state.board.every((val, i) => val === state.solution[i])) {
        endGameFlow(true);
    }
}

function endGameFlow(isWinState) {
    clearInterval(timerInterval);
    localStorage.removeItem('sudoku_polished_save');
    document.getElementById('btn-resume-game').classList.add('hidden');

    document.getElementById('summary-title').textContent = isWinState ? 'Solved!' : 'Game Over';
    document.getElementById('sum-difficulty').textContent = state.difficulty.toUpperCase();
    document.getElementById('sum-time').textContent = document.getElementById('hud-timer').textContent;
    document.getElementById('sum-mistakes').textContent = `${state.mistakes}/3`;

    if (isWinState) {
        triggerConfettiCascade();
        setTimeout(() => navigateToScreen('screen-summary'), 2000);
    } else {
        navigateToScreen('screen-summary');
    }
}

// --- CONFETTI CELEBRATORY VISUAL ROUTINE ---
let confettiParticles = [];
function triggerConfettiCascade() {
    const canvas = document.getElementById('confetti-canvas');
    canvas.classList.remove('hidden');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    
    confettiParticles = Array.from({length: 120}, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height - 20,
        r: Math.random() * 6 + 4,
        d: Math.random() * canvas.height,
        color: `hsl(${Math.random() * 360}, 80%, 60%)`,
        tilt: Math.random() * 10 - 5,
        tiltAngleIncremental: Math.random() * 0.07 + 0.02,
        tiltAngle: 0
    }));

    let animationFrameId;
    function drawFrames() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let activeParticles = false;
        
        confettiParticles.forEach(p => {
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
            p.x += Math.sin(p.tiltAngle);
            p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 5;

            if (p.y < canvas.height) activeParticles = true;

            ctx.beginPath();
            ctx.lineWidth = p.r;
            ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
            ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
            ctx.stroke();
        });

        if (activeParticles) {
            animationFrameId = requestAnimationFrame(drawFrames);
        } else {
            cancelAnimationFrame(animationFrameId);
        }
    }
    drawFrames();
}

// --- RECOVERY STORAGE DATA LAYERS ---
function saveGameStateToStorage() {
    localStorage.setItem('sudoku_polished_save', JSON.stringify({
        board: state.board,
        initial: state.initial,
        solution: state.solution,
        notes: state.notes,
        difficulty: state.difficulty,
        timer: state.timer,
        hintsRemaining: state.hintsRemaining,
        mistakes: state.mistakes
    }));
}

function attemptResumeState() {
    const stored = localStorage.getItem('sudoku_polished_save');
    if (!stored) return;
    try {
        const parsed = JSON.parse(stored);
        state = { ...state, ...parsed, isPaused: false, notesMode: false, selectedCell: null, history: [] };
        initDOMBoard();
        formatTimeHUD();
        updateUIRender();
        navigateToScreen('screen-game');
        
        timerInterval = setInterval(() => {
            if (!state.isPaused) {
                state.timer++;
                formatTimeHUD();
            }
        }, 1000);
        document.getElementById('btn-resume-game').classList.remove('hidden');
    } catch(e) {
        localStorage.removeItem('sudoku_polished_save');
    }
}

// --- INTERACTION HOOKS & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('sudoku_polished_save')) {
        document.getElementById('btn-resume-game').classList.remove('hidden');
    }

    // Interactive Keypad Event Router
    document.querySelectorAll('.key-btn').forEach(btn => {
        btn.addEventListener('click', () => processInput(btn.dataset.val));
    });

    // Hardware Keyboard Input Bridge
    document.addEventListener('keydown', (e) => {
        if (state.selectedCell === null || state.isPaused) return;
        if (e.key >= '1' && e.key <= '9') processInput(e.key);
        else if (e.key === 'Backspace' || e.key === 'Delete') processInput('erase');
    });

    // Device Context Visbility Changes (Auto-Pause Engine)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && !state.isPaused && !document.getElementById('screen-game').classList.contains('hidden')) {
            toggleGamePause();
        }
    });
});

// Structural Navigation Click Targets
document.getElementById('btn-show-difficulties').addEventListener('click', () => {
    document.getElementById('difficulty-menu').classList.remove('hidden');
    document.getElementById('btn-show-difficulties').classList.add('hidden');
});

document.querySelectorAll('.diff-option').forEach(opt => {
    opt.addEventListener('click', () => {
        startFreshGameFlow(opt.dataset.diff);
    });
});

document.getElementById('btn-resume-game').addEventListener('click', attemptResumeState);

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    clearInterval(timerInterval);
    if (localStorage.getItem('sudoku_polished_save')) {
        document.getElementById('btn-resume-game').classList.remove('hidden');
    }
    document.getElementById('difficulty-menu').classList.add('hidden');
    document.getElementById('btn-show-difficulties').classList.remove('hidden');
    navigateToScreen('screen-splash');
});

document.getElementById('btn-pause').addEventListener('click', toggleGamePause);
document.getElementById('btn-resume').addEventListener('click', toggleGamePause);
document.getElementById('btn-undo').addEventListener('click', executeUndo);
document.getElementById('btn-hint').addEventListener('click', executeHint);
document.getElementById('btn-summary-restart').addEventListener('click', () => {
    document.getElementById('difficulty-menu').classList.remove('hidden');
    document.getElementById('btn-show-difficulties').classList.add('hidden');
    navigateToScreen('screen-splash');
});

document.getElementById('btn-erase').addEventListener('click', () => processInput('erase'));

document.getElementById('btn-notes').addEventListener('click', () => {
    state.notesMode = !state.notesMode;
    document.getElementById('notes-badge').textContent = state.notesMode ? 'ON' : 'OFF';
    document.getElementById('btn-notes').classList.toggle('active', state.notesMode);
});
