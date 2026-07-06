// --- STATE MANAGEMENT ---
let state = {
    board: Array(81).fill(0),       // Current player grid
    initial: Array(81).fill(0),     // Mask for given digits (true/false rules)
    solution: Array(81).fill(0),    // Generated full solution
    notes: Array(81).fill().map(() => Array(10).fill(false)), // 1-9 notes per cell
    selectedCell: null,
    difficulty: 'medium',
    timer: 0,
    hintsRemaining: 3,
    notesMode: false,
    isPaused: false
};

let timerInterval = null;

const BLANKS_MAP = { 'easy': 35, 'medium': 45, 'hard': 55 };

// --- SUDOKU ENGINE ---
function isValid(board, row, col, num) {
    for (let x = 0; x < 9; x++) {
        if (board[row * 9 + x] === num) return false;
        if (board[x * 9 + col] === num) return false;
    }
    let startRow = row - row % 3, startCol = col - col % 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[(i + startRow) * 9 + (j + startCol)] === num) return false;
        }
    }
    return true;
}

function solveSudoku(board) {
    for (let i = 0; i < 81; i++) {
        if (board[i] === 0) {
            let row = Math.floor(i / 9);
            let col = i % 9;
            let numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
            for (let num of numbers) {
                if (isValid(board, row, col, num)) {
                    board[i] = num;
                    if (solveSudoku(board)) return true;
                    board[i] = 0;
                }
            }
            return false;
        }
    }
    return true;
}

function generatePuzzle(difficulty) {
    let base = Array(81).fill(0);
    solveSudoku(base);
    state.solution = [...base];

    let blanks = BLANKS_MAP[difficulty] || 45;
    let cellIndices = Array.from({length: 81}, (_, i) => i).sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < blanks; i++) {
        base[cellIndices[i]] = 0;
    }
    
    state.board = [...base];
    state.initial = base.map(val => val !== 0);
    state.notes = Array(81).fill().map(() => Array(10).fill(false));
}

// --- DOM & RENDERING ---
const boardEl = document.getElementById('sudoku-board');

function createDOMBoard() {
    boardEl.innerHTML = '';
    for (let i = 0; i < 81; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        
        const notesContainer = document.createElement('div');
        notesContainer.classList.add('notes-container');
        for (let n = 1; n <= 9; n++) {
            const noteDigit = document.createElement('div');
            noteDigit.classList.add('note-digit');
            noteDigit.dataset.note = n;
            notesContainer.appendChild(noteDigit);
        }
        cell.appendChild(notesContainer);
        
        cell.addEventListener('click', () => handleCellClick(i));
        boardEl.appendChild(cell);
    }
}

function renderBoard() {
    const cells = document.querySelectorAll('.cell');
    const selRow = state.selectedCell !== null ? Math.floor(state.selectedCell / 9) : null;
    const selCol = state.selectedCell !== null ? state.selectedCell % 9 : null;

    cells.forEach((cell, i) => {
        const row = Math.floor(i / 9);
        const col = i % 9;
        const val = state.board[i];
        
        // Text configuration
        const textNode = cell.childNodes[1] || document.createTextNode('');
        if (!cell.childNodes[1]) cell.appendChild(textNode);
        
        const notesContainer = cell.querySelector('.notes-container');

        if (val !== 0) {
            textNode.textContent = val;
            notesContainer.classList.add('hidden');
        } else {
            textNode.textContent = '';
            notesContainer.classList.remove('hidden');
            // Render pencil marks
            notesContainer.querySelectorAll('.note-digit').forEach(noteEl => {
                const d = parseInt(noteEl.dataset.note);
                noteEl.textContent = state.notes[i][d] ? d : '';
            });
        }

        // Styles
        cell.className = 'cell';
        if (state.initial[i]) cell.classList.add('given');
        if (i === state.selectedCell) cell.classList.add('selected');
        else if (selRow !== null && (row === selRow || col === selCol || (Math.floor(row/3) === Math.floor(selRow/3) && Math.floor(col/3) === Math.floor(selCol/3)))) {
            cell.classList.add('related');
        }
    });
}

// --- INTERACTION LOGIC ---
function handleCellClick(index) {
    if (state.isPaused || state.initial[index]) return;
    state.selectedCell = (state.selectedCell === index) ? null : index;
    renderBoard();
}

function handleInput(value) {
    if (state.selectedCell === null || state.isPaused || state.initial[state.selectedCell]) return;
    const idx = state.selectedCell;

    if (value === 'erase') {
        state.board[idx] = 0;
        state.notes[idx].fill(false);
    } else {
        const num = parseInt(value);
        if (state.notesMode) {
            state.board[idx] = 0;
            state.notes[idx][num] = !state.notes[idx][num];
        } else {
            state.board[idx] = num;
            state.notes[idx].fill(false); // Clear notes on structural fill
            autoClearMates(idx, num);
        }
    }
    document.querySelectorAll('.cell')[idx].classList.remove('error');
    saveGame();
    renderBoard();
    checkWinCondition();
}

function autoClearMates(idx, num) {
    const row = Math.floor(idx / 9);
    const col = idx % 9;
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

// --- TIMER CONTROL ---
function updateTimerDisplay() {
    const mins = Math.floor(state.timer / 60).toString().padStart(2, '0');
    const secs = (state.timer % 60).toString().padStart(2, '0');
    document.getElementById('timer').textContent = `${mins}:${secs}`;
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!state.isPaused) {
            state.timer++;
            updateTimerDisplay();
            if (state.timer % 5 === 0) saveGame(); // Periodic save fallback
        }
    }, 1000);
}

function togglePause() {
    state.isPaused = !state.isPaused;
    document.getElementById('pause-overlay').classList.toggle('hidden', !state.isPaused);
    document.getElementById('pause-icon').innerHTML = state.isPaused 
        ? '<path d="M8 5v14l11-7z"/>' 
        : '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
}

// --- UTILITIES / BUTTONS ---
function checkBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, i) => {
        if (state.board[i] !== 0 && state.board[i] !== state.solution[i]) {
            cell.classList.add('error');
        }
    });
}

function triggerHint() {
    if (state.selectedCell === null || state.hintsRemaining <= 0 || state.isPaused || state.initial[state.selectedCell]) return;
    const idx = state.selectedCell;
    
    state.board[idx] = state.solution[idx];
    state.notes[idx].fill(false);
    state.hintsRemaining--;
    document.getElementById('hint-count').textContent = `Hints: ${state.hintsRemaining}/3`;
    
    saveGame();
    renderBoard();
    checkWinCondition();
}

function checkWinCondition() {
    if (state.board.every((val, i) => val === state.solution[i])) {
        clearInterval(timerInterval);
        localStorage.removeItem('sudoku_save_state');
        document.getElementById('win-time').textContent = `Final Time: ${document.getElementById('timer').textContent}`;
        document.getElementById('win-overlay').classList.remove('hidden');
    }
}

// --- INITIALIZATION & SAVE SYSTEM ---
function startNewGame() {
    state.difficulty = document.getElementById('difficulty-select').value;
    state.timer = 0;
    state.hintsRemaining = 3;
    state.selectedCell = null;
    state.isPaused = false;
    state.notesMode = false;
    
    document.getElementById('notes-status').textContent = 'OFF';
    document.getElementById('btn-notes').classList.remove('active');
    document.getElementById('hint-count').textContent = 'Hints: 3/3';
    document.getElementById('win-overlay').classList.add('hidden');
    document.getElementById('pause-overlay').classList.add('hidden');
    
    generatePuzzle(state.difficulty);
    updateTimerDisplay();
    renderBoard();
    startTimer();
    saveGame();
}

function saveGame() {
    localStorage.setItem('sudoku_save_state', JSON.stringify({
        board: state.board,
        initial: state.initial,
        solution: state.solution,
        notes: state.notes,
        difficulty: state.difficulty,
        timer: state.timer,
        hintsRemaining: state.hintsRemaining
    }));
}

function loadGame() {
    const raw = localStorage.getItem('sudoku_save_state');
    if (!raw) return false;
    try {
        const saved = JSON.parse(raw);
        state = { ...state, ...saved, isPaused: false, notesMode: false, selectedCell: null };
        document.getElementById('difficulty-select').value = state.difficulty;
        document.getElementById('hint-count').textContent = `Hints: ${state.hintsRemaining}/3`;
        updateTimerDisplay();
        renderBoard();
        startTimer();
        return true;
    } catch (e) {
        return false;
    }
}

// --- EVENT BINDINGS ---
document.addEventListener('DOMContentLoaded', () => {
    createDOMBoard();
    
    if (localStorage.getItem('sudoku_save_state')) {
        document.getElementById('resume-modal').classList.remove('hidden');
    } else {
        startNewGame();
    }
    
    // Setup handling visibility state
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && !state.isPaused) togglePause();
    });
});

// Keypad binding
document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', () => handleInput(btn.dataset.val));
});

// Desktop Keyboard Support
document.addEventListener('keydown', (e) => {
    if (state.selectedCell === null) return;
    if (e.key >= '1' && e.key <= '9') handleInput(e.key);
    else if (e.key === 'Backspace' || e.key === 'Delete') handleInput('erase');
});

// Actions strip
document.getElementById('btn-new').addEventListener('click', startNewGame);
document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-resume-icon').addEventListener('click', togglePause);
document.getElementById('btn-check').addEventListener('click', checkBoard);
document.getElementById('btn-hint').addEventListener('click', triggerHint);
document.getElementById('btn-win-close').addEventListener('click', startNewGame);

document.getElementById('btn-notes').addEventListener('click', () => {
    state.notesMode = !state.notesMode;
    document.getElementById('notes-status').textContent = state.notesMode ? 'ON' : 'OFF';
    document.getElementById('btn-notes').classList.toggle('active', state.notesMode);
});

// Modal Actions
document.getElementById('btn-resume').addEventListener('click', () => {
    document.getElementById('resume-modal').classList.add('hidden');
    loadGame();
});
document.getElementById('btn-new-past').addEventListener('click', () => {
    document.getElementById('resume-modal').classList.add('hidden');
    startNewGame();
});
