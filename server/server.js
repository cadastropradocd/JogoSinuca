'use strict';

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const FRICTION = 0.985;
const MIN_VELOCITY = 0.1;
const BALL_RADIUS = 10;
const POCKET_RADIUS = 18;
const TABLE_WIDTH = 800;
const TABLE_HEIGHT = 400;
const STATE_SYNC_INTERVAL = 50;

const rooms = new Map();

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function generatePlayerId() {
    return Math.random().toString(36).substring(2, 10);
}

const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        const filePath = path.join(__dirname, 'public', 'index.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/game.js') {
        const filePath = path.join(__dirname, 'public', 'game.js');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
    } else if (req.url === '/style.css') {
        const filePath = path.join(__dirname, 'public', 'style.css');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    let playerId = null;
    let roomCode = null;

    ws.sendJSON = function(obj) {
        this.send(JSON.stringify(obj));
    };

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            handleMessage(ws, msg);
        } catch (e) {
            console.error('Invalid message:', e);
        }
    });

    function handleMessage(ws, msg) {
        switch (msg.type) {
            case 'create':
                playerId = generatePlayerId();
                roomCode = generateRoomCode();

                const room = {
                    code: roomCode,
                    players: [playerId],
                    playerGroups: {},
                    state: createInitialState(),
                    currentPlayer: playerId,
                    currentPlayerIndex: 0,
                    shotInProgress: false,
                    lastStateBroadcast: 0
                };

                rooms.set(roomCode, room);
                ws.roomCode = roomCode;
                ws.playerId = playerId;

                ws.sendJSON({
                    type: 'created',
                    playerId: playerId,
                    roomCode: roomCode,
                    state: room.state
                });
                break;

            case 'join':
                playerId = generatePlayerId();
                roomCode = msg.roomCode.toUpperCase();

                const joinRoom = rooms.get(roomCode);
                if (!joinRoom) {
                    ws.sendJSON({ type: 'error', message: 'Sala não encontrada' });
                    return;
                }

                if (joinRoom.players.length >= 2) {
                    ws.sendJSON({ type: 'error', message: 'Sala lotada' });
                    return;
                }

                joinRoom.players.push(playerId);
                ws.roomCode = roomCode;
                ws.playerId = playerId;

                assignPlayerGroups(joinRoom);

                ws.sendJSON({
                    type: 'joined',
                    playerId: playerId,
                    roomCode: roomCode,
                    state: joinRoom.state
                });

                broadcastRoom(roomCode, {
                    type: 'state',
                    state: joinRoom.state
                });
                break;

            case 'shot':
                if (!ws.roomCode || !ws.playerId) return;

                const shotRoom = rooms.get(ws.roomCode);
                if (!shotRoom) return;

                if (shotRoom.currentPlayer !== ws.playerId) return;
                if (shotRoom.shotInProgress) return;

                const cueBall = shotRoom.state.balls.find(b => b.id === 0);
                if (!cueBall || cueBall.potted) return;

                cueBall.vx = Math.cos(msg.angle) * msg.velocity;
                cueBall.vy = Math.sin(msg.angle) * msg.velocity;

                shotRoom.shotInProgress = true;
                shotRoom.pottedThisShot = [];

                broadcastRoom(ws.roomCode, {
                    type: 'state',
                    state: shotRoom.state
                });
                break;
        }
    }

    ws.on('close', () => {
        if (ws.roomCode) {
            const room = rooms.get(ws.roomCode);
            if (room) {
                room.players = room.players.filter(p => p !== ws.playerId);
                if (room.players.length === 0) {
                    rooms.delete(ws.roomCode);
                }
            }
        }
    });
});

function assignPlayerGroups(room) {
    if (room.players.length === 2) {
        const randomAssign = Math.random() < 0.5;
        room.playerGroups[room.players[0]] = randomAssign ? 'solid' : 'striped';
        room.playerGroups[room.players[1]] = randomAssign ? 'striped' : 'solid';
    }
}

function broadcastRoom(roomCode, msg, excludePlayerId) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN &&
            client.roomCode === roomCode &&
            client.playerId !== excludePlayerId) {
            client.sendJSON(msg);
        }
    });
}

function broadcastRoomToAll(roomCode, msg) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.roomCode === roomCode) {
            client.sendJSON(msg);
        }
    });
}

function createInitialState() {
    const balls = [];

    balls.push({ id: 0, x: 200, y: TABLE_HEIGHT / 2, vx: 0, vy: 0, potted: false });

    const positions = [
        { x: 550, y: 150, id: 1 },
        { x: 570, y: 130, id: 9 },
        { x: 570, y: 170, id: 2 },
        { x: 590, y: 110, id: 10 },
        { x: 590, y: 150, id: 8 },
        { x: 590, y: 190, id: 11 },
        { x: 610, y: 130, id: 3 },
        { x: 610, y: 170, id: 12 },
        { x: 630, y: 150, id: 4 },
        { x: 630, y: 170, id: 13 },
        { x: 650, y: 150, id: 5 },
        { x: 650, y: 170, id: 14 },
        { x: 670, y: 150, id: 6 },
        { x: 670, y: 170, id: 15 },
        { x: 690, y: 150, id: 7 }
    ];

    for (const pos of positions) {
        balls.push({
            id: pos.id,
            x: pos.x,
            y: pos.y,
            vx: 0,
            vy: 0,
            potted: false
        });
    }

    return {
        balls: balls,
        currentPlayer: null,
        firstPottedType: null,
        gameOver: false,
        winner: null
    };
}

const pockets = [
    { x: 0, y: 0 },
    { x: TABLE_WIDTH / 2, y: 0 },
    { x: TABLE_WIDTH, y: 0 },
    { x: 0, y: TABLE_HEIGHT },
    { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT },
    { x: TABLE_WIDTH, y: TABLE_HEIGHT }
];

function updatePhysics(room) {
    if (!room.shotInProgress) return;

    let anyMoving = false;

    for (const ball of room.state.balls) {
        if (ball.potted) continue;

        if (Math.abs(ball.vx) > MIN_VELOCITY || Math.abs(ball.vy) > MIN_VELOCITY) {
            anyMoving = true;

            ball.x += ball.vx;
            ball.y += ball.vy;

            ball.vx *= FRICTION;
            ball.vy *= FRICTION;

            if (ball.x < BALL_RADIUS) {
                ball.x = BALL_RADIUS;
                ball.vx = -ball.vx * 0.8;
            } else if (ball.x > TABLE_WIDTH - BALL_RADIUS) {
                ball.x = TABLE_WIDTH - BALL_RADIUS;
                ball.vx = -ball.vx * 0.8;
            }

            if (ball.y < BALL_RADIUS) {
                ball.y = BALL_RADIUS;
                ball.vy = -ball.vy * 0.8;
            } else if (ball.y > TABLE_HEIGHT - BALL_RADIUS) {
                ball.y = TABLE_HEIGHT - BALL_RADIUS;
                ball.vy = -ball.vy * 0.8;
            }
        } else {
            ball.vx = 0;
            ball.vy = 0;
        }
    }

    for (let i = 0; i < room.state.balls.length; i++) {
        for (let j = i + 1; j < room.state.balls.length; j++) {
            collideBalls(room.state.balls[i], room.state.balls[j]);
        }
    }

    for (const ball of room.state.balls) {
        if (ball.potted) continue;

        for (const pocket of pockets) {
            const dx = ball.x - pocket.x;
            const dy = ball.y - pocket.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < POCKET_RADIUS) {
                ball.potted = true;
                ball.vx = 0;
                ball.vy = 0;
                room.pottedThisShot.push(ball.id);
                break;
            }
        }
    }

    if (!anyMoving) {
        room.shotInProgress = false;

        handleShotResult(room);
    }
}

function collideBalls(ball1, ball2) {
    if (ball1.potted || ball2.potted) return;

    const dx = ball2.x - ball1.x;
    const dy = ball2.y - ball1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < BALL_RADIUS * 2 && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;

        const dvx = ball1.vx - ball2.vx;
        const dvy = ball1.vy - ball2.vy;
        const dvn = dvx * nx + dvy * ny;

        if (dvn > 0) return;

        ball1.vx -= dvn * nx;
        ball1.vy -= dvn * ny;
        ball2.vx += dvn * nx;
        ball2.vy += dvn * ny;

        const overlap = BALL_RADIUS * 2 - dist;
        ball1.x -= (overlap / 2) * nx;
        ball1.y -= (overlap / 2) * ny;
        ball2.x += (overlap / 2) * nx;
        ball2.y += (overlap / 2) * ny;
    }
}

function handleShotResult(room) {
    if (room.state.gameOver) return;

    const balls = room.state.balls;
    const cueBall = balls.find(b => b.id === 0);
    const currentPlayerId = room.currentPlayer;
    const currentGroup = room.playerGroups[currentPlayerId];

    let cueBallPotted = false;
    const pottedBalls = [];
    const unpottedBalls = balls.filter(b => !b.potted && b.id !== 0);

    if (cueBall && cueBall.potted) {
        cueBallPotted = true;
        cueBall.x = 200;
        cueBall.y = TABLE_HEIGHT / 2;
        cueBall.potted = false;
    }

    for (const id of room.pottedThisShot || []) {
        if (id !== 0) {
            const ball = balls.find(b => b.id === id);
            if (ball && ball.potted) {
                pottedBalls.push(id);
            }
        }
    }

    const eightBallPotted = pottedBalls.includes(8);
    const myGroupBalls = currentGroup === 'solid'
        ? [1, 2, 3, 4, 5, 6, 7]
        : [9, 10, 11, 12, 13, 14, 15];
    const opponentGroup = currentGroup === 'solid' ? 'striped' : 'solid';
    const opponentGroupBalls = opponentGroup === 'solid'
        ? [1, 2, 3, 4, 5, 6, 7]
        : [9, 10, 11, 12, 13, 14, 15];

    const myGroupPotted = pottedBalls.filter(id => myGroupBalls.includes(id));
    const opponentGroupPotted = pottedBalls.filter(id => opponentGroupBalls.includes(id));

    if (eightBallPotted) {
        const myBallsRemaining = myGroupBalls.filter(id =>
            unpottedBalls.some(b => b.id === id)
        );

        if (myBallsRemaining.length === 0 && room.state.firstPottedType === currentGroup) {
            room.state.gameOver = true;
            room.state.winner = currentPlayerId;
            broadcastRoomToAll(room.code, { type: 'gameOver', winner: currentPlayerId });
        } else {
            room.state.gameOver = true;
            const winnerIndex = (room.currentPlayerIndex + 1) % room.players.length;
            room.state.winner = room.players[winnerIndex];
            broadcastRoomToAll(room.code, { type: 'gameOver', winner: room.state.winner });
        }

        resetGame(room);
        return;
    }

    if (cueBallPotted || pottedBalls.length === 0) {
        switchTurn(room);
    } else {
        let keepTurn = false;

        if (myGroupPotted.length > 0 && !opponentGroupPotted.length > 0) {
            keepTurn = true;
        } else if (myGroupPotted.length > 0 && opponentGroupPotted.length > 0) {
            keepTurn = true;
        }

        if (!keepTurn) {
            switchTurn(room);
        }
    }

    if (!room.state.firstPottedType && pottedBalls.length > 0) {
        const firstPotted = pottedBalls.find(id => id >= 1 && id <= 15);
        if (firstPotted) {
            room.state.firstPottedType = firstPotted <= 8 ? currentGroup : opponentGroup;
        }
    }

    broadcastRoomToAll(room.code, {
        type: 'state',
        state: room.state
    });
}

function switchTurn(room) {
    const otherPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
    room.currentPlayer = room.players[otherPlayerIndex];
    room.currentPlayerIndex = otherPlayerIndex;
    room.state.currentPlayer = room.currentPlayer;
}

function resetGame(room) {
    const balls = room.state.balls;

    for (const ball of balls) {
        ball.potted = false;
        ball.vx = 0;
        ball.vy = 0;
    }

    balls[0].x = 200;
    balls[0].y = TABLE_HEIGHT / 2;

    const positions = [
        { x: 550, y: 150, id: 1 },
        { x: 570, y: 130, id: 9 },
        { x: 570, y: 170, id: 2 },
        { x: 590, y: 110, id: 10 },
        { x: 590, y: 150, id: 8 },
        { x: 590, y: 190, id: 11 },
        { x: 610, y: 130, id: 3 },
        { x: 610, y: 170, id: 12 },
        { x: 630, y: 150, id: 4 },
        { x: 630, y: 170, id: 13 },
        { x: 650, y: 150, id: 5 },
        { x: 650, y: 170, id: 14 },
        { x: 670, y: 150, id: 6 },
        { x: 670, y: 170, id: 15 },
        { x: 690, y: 150, id: 7 }
    ];

    for (let i = 0; i < positions.length; i++) {
        const ball = balls[i + 1];
        ball.x = positions[i].x;
        ball.y = positions[i].y;
        ball.potted = false;
    }

    room.state.firstPottedType = null;
    room.state.gameOver = false;
    room.state.winner = null;

    room.currentPlayer = room.players[0];
    room.currentPlayerIndex = 0;
    room.state.currentPlayer = room.currentPlayer;
}

let lastSyncTime = Date.now();

setInterval(() => {
    for (const room of rooms.values()) {
        if (room.shotInProgress) {
            updatePhysics(room);
        }
    }

    const now = Date.now();
    if (now - lastSyncTime >= STATE_SYNC_INTERVAL) {
        for (const room of rooms.values()) {
            if (room.shotInProgress) {
                broadcastRoomToAll(room.code, {
                    type: 'state',
                    state: room.state
                });
            }
        }
        lastSyncTime = now;
    }
}, 1000 / 60);

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});