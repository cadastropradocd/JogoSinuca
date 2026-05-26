'use strict';

const TABLE_WIDTH = 800;
const TABLE_HEIGHT = 400;
const BALL_RADIUS = 10;
const POCKET_RADIUS = 18;

const BALL_COLORS = [
    '#ffffff',
    '#f7dc37',
    '#2266cc',
    '#dd3333',
    '#662266',
    '#ee7733',
    '#227722',
    '#331111',
    '#111111',
    '#f7dc37',
    '#2266cc',
    '#dd3333',
    '#662266',
    '#ee7733',
    '#227722',
    '#331111'
];

let ws = null;
let gameState = null;
let myPlayerId = null;
let isMyTurn = false;
let cueBallDragStart = null;
let aimLine = null;
let power = 0;

const canvas = document.getElementById('table');
const ctx = canvas.getContext('2d');
canvas.width = TABLE_WIDTH;
canvas.height = TABLE_HEIGHT;

const pockets = [
    { x: 0, y: 0 },
    { x: TABLE_WIDTH / 2, y: 0 },
    { x: TABLE_WIDTH, y: 0 },
    { x: 0, y: TABLE_HEIGHT },
    { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT },
    { x: TABLE_WIDTH, y: TABLE_HEIGHT }
];

function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
        console.log('Connected');
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
    };

    ws.onclose = () => {
        alert('Desconectado do servidor');
    };
}

function handleMessage(msg) {
    switch (msg.type) {
        case 'created':
            myPlayerId = msg.playerId;
            document.getElementById('roomCodeDisplay').textContent = `Sala: ${msg.roomCode}`;
            showGame();
            break;
        case 'joined':
            myPlayerId = msg.playerId;
            document.getElementById('roomCodeDisplay').textContent = `Sala: ${msg.roomCode}`;
            showGame();
            break;
        case 'state':
            gameState = msg.state;
            isMyTurn = msg.state.currentPlayer === myPlayerId && !gameState.gameOver;
            updateTurnIndicator();
            break;
        case 'gameOver':
            gameState = msg.state;
            if (msg.winner === myPlayerId) {
                alert('Você venceu! 🎉');
            } else {
                alert('Você perdeu!');
            }
            break;
        case 'error':
            alert(msg.message);
            break;
    }
}

function showGame() {
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('game').classList.remove('hidden');
}

function updateTurnIndicator() {
    const indicator = document.getElementById('turnIndicator');
    if (!gameState) return;
    
    const isMyTurnNow = gameState.currentPlayer === myPlayerId;
    indicator.textContent = isMyTurnNow ? 'Sua vez!' : 'Vez do oponente';
    indicator.style.color = isMyTurnNow ? '#4CAF50' : '#f44336';
}

function drawTable() {
    ctx.fillStyle = '#1a5c2e';
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    ctx.fillStyle = '#143d23';
    for (const pocket of pockets) {
        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawBall(ball) {
    if (!ball || ball.potted) return;

    const gradient = ctx.createRadialGradient(
        ball.x - 3, ball.y - 3, 2,
        ball.x, ball.y, BALL_RADIUS
    );
    
    const color = BALL_COLORS[ball.id] || '#ffffff';
    
    if (ball.id >= 9 && ball.id <= 15) {
        gradient.addColorStop(0, lightenColor(color, 40));
        gradient.addColorStop(0.5, color);
        gradient.addColorStop(1, darkenColor(color, 30));
    } else {
        gradient.addColorStop(0, lightenColor(color, 30));
        gradient.addColorStop(0.6, color);
        gradient.addColorStop(1, darkenColor(color, 40));
    }

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    if (ball.id >= 1 && ball.id <= 8) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ball.id.toString(), ball.x, ball.y + 1);
    } else if (ball.id >= 9 && ball.id <= 15) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ball.id.toString(), ball.x, ball.y + 1);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS - 3, -Math.PI * 0.3, Math.PI * 0.3);
        ctx.stroke();
    }
}

function lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function render() {
    drawTable();

    if (gameState && gameState.balls) {
        for (const ball of gameState.balls) {
            drawBall(ball);
        }
    }

    if (isMyTurn && cueBallDragStart && aimLine) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(cueBallDragStart.x, cueBallDragStart.y);
        ctx.lineTo(aimLine.endX, aimLine.endY);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    requestAnimationFrame(render);
}

function getCueBall() {
    if (!gameState || !gameState.balls) return null;
    return gameState.balls.find(b => b.id === 0);
}

function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('touchstart', onPointerDown);

function onPointerDown(e) {
    e.preventDefault();
    if (!isMyTurn || !gameState) return;

    const cueBall = getCueBall();
    if (!cueBall) return;

    const pos = getPointerPos(e);
    if (dist(pos.x, pos.y, cueBall.x, cueBall.y) <= BALL_RADIUS * 2) {
        cueBallDragStart = { x: cueBall.x, y: cueBall.y };
    }
}

document.addEventListener('mousemove', onPointerMove);
document.addEventListener('touchmove', onPointerMove);

function onPointerMove(e) {
    e.preventDefault();
    if (!cueBallDragStart) return;

    const pos = getPointerPos(e);
    const dx = cueBallDragStart.x - pos.x;
    const dy = cueBallDragStart.y - pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    power = Math.min(100, distance / 3);
    document.getElementById('powerFill').style.width = `${power}%`;

    const maxDist = 150;
    if (distance > maxDist) {
        const angle = Math.atan2(dy, dx);
        aimLine = {
            endX: cueBallDragStart.x + Math.cos(angle) * maxDist,
            endY: cueBallDragStart.y + Math.sin(angle) * maxDist
        };
    } else {
        aimLine = {
            endX: pos.x,
            endY: pos.y
        };
    }
}

document.addEventListener('mouseup', onPointerUp);
document.addEventListener('touchend', onPointerUp);

function onPointerUp(e) {
    if (!cueBallDragStart || power < 5) {
        cueBallDragStart = null;
        aimLine = null;
        power = 0;
        document.getElementById('powerFill').style.width = '0%';
        return;
    }

    const cueBall = getCueBall();
    if (!cueBall || !aimLine) return;

    const dx = cueBall.x - aimLine.endX;
    const dy = cueBall.y - aimLine.endY;
    const angle = Math.atan2(dy, dx);
    const velocity = power * 0.3;

    ws.send(JSON.stringify({
        type: 'shot',
        angle: angle,
        velocity: velocity
    }));

    cueBallDragStart = null;
    aimLine = null;
    power = 0;
    document.getElementById('powerFill').style.width = '0%';
}

document.getElementById('createBtn').addEventListener('click', () => {
    connect();
});

document.getElementById('joinBtn').addEventListener('click', () => {
    document.getElementById('joinForm').classList.remove('hidden');
});

document.getElementById('joinConfirmBtn').addEventListener('click', () => {
    const code = document.getElementById('roomCode').value.toUpperCase().trim();
    if (code.length !== 6) {
        alert('Código deve ter 6 caracteres');
        return;
    }
    connect();
});

render();

document.getElementById('restartBtn').addEventListener('click', () => {
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('game').classList.add('hidden');
    document.getElementById('joinForm').classList.add('hidden');
    document.getElementById('roomCode').value = '';
    document.getElementById('restartBtn').classList.add('hidden');
    gameState = null;
    myPlayerId = null;
    if (ws) {
        ws.close();
        ws = null;
    }
});