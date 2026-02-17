const firebaseConfig = {
  apiKey: "AIzaSyDT4Uwx3Oq5kIKFiPuThEbMuPR7SbNN3nQ",
  authDomain: "nialin-tictactoe-online.firebaseapp.com",
  projectId: "nialin-tictactoe-online",
  storageBucket: "nialin-tictactoe-online.firebasestorage.app",
  messagingSenderId: "617276374699",
  appId: "1:617276374699:web:241f54ebef136f0b46c1ee",
  measurementId: "G-J31XQG6ZHX"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let currentRoom = null;
let playerSymbol = null;
let myId = generateId();
let gameBoard = ['', '', '', '', '', '', '', '', ''];
let currentTurn = 'X';
let gameActive = false;
let players = { X: null, O: null };

function generateId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
}

document.getElementById('createBtn').addEventListener('click', createRoom);
document.getElementById('joinBtn').addEventListener('click', joinRoom);
document.getElementById('sendChat').addEventListener('click', sendChat);
document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
});
document.getElementById('copyRoomBtn').addEventListener('click', copyRoomCode);
document.getElementById('whatsappBtn').addEventListener('click', shareWhatsApp);
document.getElementById('telegramBtn').addEventListener('click', shareTelegram);
document.getElementById('cancelWaitBtn').addEventListener('click', cancelWaiting);

function createRoom() {
    const roomId = generateRoomId();
    currentRoom = roomId;
    playerSymbol = 'X';
    
    database.ref(`rooms/${roomId}`).set({
        board: ['', '', '', '', '', '', '', '', ''],
        currentTurn: 'X',
        players: { X: myId, O: null },
        gameActive: false,
        createdAt: Date.now()
    });
    
    document.getElementById('roomCodeDisplay').textContent = roomId;
    document.getElementById('waitingModal').style.display = 'flex';
    
    listenToRoom(roomId);
}

function joinRoom() {
    const roomId = document.getElementById('roomId').value.toUpperCase();
    if (roomId.length < 3) {
        alert('Masukkan kode ruangan yang valid!');
        return;
    }
    
    database.ref(`rooms/${roomId}`).once('value', (snapshot) => {
        const room = snapshot.val();
        if (!room) {
            alert('Ruangan tidak ditemukan!');
            return;
        }
        
        if (room.players.O) {
            alert('Ruangan sudah penuh!');
            return;
        }
        
        currentRoom = roomId;
        playerSymbol = 'O';
        
        database.ref(`rooms/${roomId}/players/O`).set(myId);
        database.ref(`rooms/${roomId}/gameActive`).set(true);
        
        listenToRoom(roomId);
    });
}

function listenToRoom(roomId) {
    const roomRef = database.ref(`rooms/${roomId}`);
    
    roomRef.on('value', (snapshot) => {
        const room = snapshot.val();
        if (!room) return;
        
        updateGameState(room);
    });
}

function updateGameState(room) {
    gameBoard = room.board;
    currentTurn = room.currentTurn;
    gameActive = room.gameActive;
    players = room.players;
    
    updateUI();
    
    if (room.players.X && room.players.O) {
        document.getElementById('waitingModal').style.display = 'none';
        document.getElementById('connectionStatus').textContent = '✅ Terhubung!';
        document.getElementById('connectionStatus').classList.add('connected');
    }
}

function updateUI() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, index) => {
        cell.textContent = gameBoard[index];
        cell.classList.remove('x', 'o', 'disabled');
        if (gameBoard[index]) {
            cell.classList.add(gameBoard[index].toLowerCase());
        }
        if (!gameActive || currentTurn !== playerSymbol || gameBoard[index] !== '') {
            cell.classList.add('disabled');
        }
    });
    
    document.getElementById('currentTurn').textContent = currentTurn;
    document.getElementById('playerXName').textContent = players.X ? 'Player X' : 'Menunggu...';
    document.getElementById('playerOName').textContent = players.O ? 'Player O' : 'Menunggu...';
    
    document.querySelector('.player-x').classList.toggle('active', currentTurn === 'X');
    document.querySelector('.player-o').classList.toggle('active', currentTurn === 'O');
}

function handleCellClick(index) {
    if (!gameActive || currentTurn !== playerSymbol || gameBoard[index] !== '') return;
    
    gameBoard[index] = playerSymbol;
    
    database.ref(`rooms/${currentRoom}`).update({
        board: gameBoard,
        currentTurn: playerSymbol === 'X' ? 'O' : 'X'
    });
    
    checkWinner();
}

function checkWinner() {
    const winningConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    
    for (let condition of winningConditions) {
        const [a, b, c] = condition;
        if (gameBoard[a] && gameBoard[a] === gameBoard[b] && gameBoard[a] === gameBoard[c]) {
            highlightWinningCells(condition);
            sendSystemMessage(`${gameBoard[a]} Menang!`);
            database.ref(`rooms/${currentRoom}/gameActive`).set(false);
            break;
        }
    }
    
    if (!gameBoard.includes('') && gameActive) {
        sendSystemMessage('Permainan Seri!');
        database.ref(`rooms/${currentRoom}/gameActive`).set(false);
    }
}

function highlightWinningCells(combo) {
    combo.forEach(index => {
        document.querySelector(`[data-index="${index}"]`).classList.add('win');
    });
}

function sendChat() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message || !currentRoom) return;
    
    database.ref(`rooms/${currentRoom}/chats`).push({
        sender: myId,
        message: message,
        timestamp: Date.now()
    });
    
    input.value = '';
}

function sendSystemMessage(message) {
    database.ref(`rooms/${currentRoom}/chats`).push({
        sender: 'system',
        message: message,
        timestamp: Date.now()
    });
}

database.ref('chats').on('child_added', (snapshot) => {
    const chat = snapshot.val();
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    if (chat.sender === 'system') {
        messageDiv.classList.add('system');
    } else if (chat.sender === myId) {
        messageDiv.classList.add('you');
    } else {
        messageDiv.classList.add('opponent');
    }
    
    messageDiv.textContent = chat.message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

document.querySelectorAll('.cell').forEach(cell => {
    cell.addEventListener('click', () => {
        const index = cell.getAttribute('data-index');
        handleCellClick(parseInt(index));
    });
});

function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function copyRoomCode() {
    if (!currentRoom) return;
    navigator.clipboard.writeText(currentRoom);
    alert('Kode ruangan disalin!');
}

function shareWhatsApp() {
    if (!currentRoom) return;
    const text = `Ayo main TicTacToe online! Kode ruangan: ${currentRoom}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
}

function shareTelegram() {
    if (!currentRoom) return;
    const text = `Ayo main TicTacToe online! Kode ruangan: ${currentRoom}`;
    window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(text)}`);
}

function cancelWaiting() {
    if (currentRoom) {
        database.ref(`rooms/${currentRoom}`).remove();
        currentRoom = null;
    }
    document.getElementById('waitingModal').style.display = 'none';
}