export interface Env {}

const TABLE_WIDTH = 800;
const TABLE_HEIGHT = 400;
const BALL_RADIUS = 10;
const POCKET_RADIUS = 18;
const FRICTION = 0.985;
const MIN_VELOCITY = 0.1;

const rooms = new Map<string, any>();

function genCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function genId(): string {
    return Math.random().toString(36).substring(2, 10);
}

const pockets = [
    { x: 0, y: 0 },
    { x: TABLE_WIDTH / 2, y: 0 },
    { x: TABLE_WIDTH, y: 0 },
    { x: 0, y: TABLE_HEIGHT },
    { x: TABLE_WIDTH / 2, y: TABLE_HEIGHT },
    { x: TABLE_WIDTH, y: TABLE_HEIGHT }
];

function createInitialState() {
    const balls = [{ id: 0, x: 200, y: TABLE_HEIGHT / 2, vx: 0, vy: 0, potted: false }];
    const positions = [
        [550, 150, 1], [570, 130, 9], [570, 170, 2], [590, 110, 10], [590, 150, 8], [590, 190, 11],
        [610, 130, 3], [610, 170, 12], [630, 150, 4], [630, 170, 13], [650, 150, 5], [650, 170, 14],
        [670, 150, 6], [670, 170, 15], [690, 150, 7]
    ];
    for (const [x, y, id] of positions) {
        balls.push({ id, x, y, vx: 0, vy: 0, potted: false });
    }
    return { balls, currentPlayer: null, firstPottedType: null, gameOver: false, winner: null };
}

const HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sinuca Online 8-Ball</title>
    <style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#1a472a;min-height:100vh;display:flex;justify-content:center;align-items:center}
#app{width:100%;max-width:900px;padding:20px}
.screen{display:flex;flex-direction:column;align-items:center;gap:20px}
.hidden{display:none!important}
h1{color:#f5deb3;font-size:2.5rem;text-shadow:2px 2px 4px rgba(0,0,0,0.5)}
.buttons{display:flex;gap:15px}
button{padding:15px 30px;font-size:1.1rem;background:linear-gradient(180deg,#8b4513,#654321);color:#f5deb3;border:3px solid #d4a574;border-radius:8px;cursor:pointer}
button:hover{transform:scale(1.05)}
#joinForm{display:flex;gap:10px;align-items:center}
#roomCode{padding:12px 15px;font-size:1.2rem;text-transform:uppercase;letter-spacing:3px;text-align:center;border:2px solid #d4a574;border-radius:6px;background:#2d1f14;color:#f5deb3}
#header{display:flex;justify-content:space-between;width:100%;color:#f5deb3;font-size:1.1rem}
#table{background:#1a5c2e;border:15px solid #5c3d2e;border-radius:8px;box-shadow:inset 0 0 30px rgba(0,0,0,0.3),0 8px 25px rgba(0,0,0,0.5);cursor:crosshair}
.hint{color:#87a96b;font-size:.9rem}
#powerBar{width:300px;height:20px;background:#2d1f14;border:2px solid #d4a574;border-radius:10px;overflow:hidden}
#powerFill{width:0%;height:100%;background:linear-gradient(90deg,#4CAF50,#FFEB3B,#f44336)}
    </style>
</head>
<body>
    <div id="app">
        <div id="menu" class="screen">
            <h1>Sinuca Online</h1>
            <div class="buttons">
                <button id="createBtn">Criar Sala</button>
                <button id="joinBtn">Entrar numa Sala</button>
            </div>
            <div id="joinForm" class="hidden">
                <input type="text" id="roomCode" placeholder="Codigo" maxlength="6">
                <button id="joinConfirmBtn">Entrar</button>
            </div>
        </div>
        <div id="game" class="screen hidden">
            <div id="header">
                <span id="roomCodeDisplay">Sala: ---</span>
                <span id="turnIndicator">Turno: ---</span>
            </div>
            <canvas id="table"></canvas>
            <div id="powerBar"><div id="powerFill"></div></div>
            <p class="hint">Arraste a bola branca para mirar e soltar</p>
        </div>
    </div>
    <script>
(function(){
const TW=800,TH=400,BR=10,PR=18;
const COL=['#fff','#f7dc37','#2266cc','#dd3333','#662266','#ee7733','#227722','#331111','#111',
'#f7dc37','#2266cc','#dd3333','#662266','#ee7733','#227722','#331111'];
let ws=null,g=null,myId=null,isMy=false,cueD=null,aim=null,power=0;
const ca=document.getElementById('table'),cx=ca.getContext('2d');
ca.width=TW;ca.height=TH;
const pk=[{x:0,y:0},{x:TW/2,y:0},{x:TW,y:0},{x:0,y:TH},{x:TW/2,y:TH},{x:TW,y:TH}];

function con(){
    ws=new WebSocket((location.protocol==='https'?'wss':'ws')+'//'+location.host);
    ws.onmessage=e=>{const m=JSON.parse(e.data);switch(m.type){
        case'created':case'joined':myId=m.playerId;document.getElementById('roomCodeDisplay').textContent='Sala: '+m.roomCode;showG();break;
        case'state':g=m.state;isMy=g.currentPlayer===myId&&!g.gameOver;upInd();break;
        case'gameOver':alert(m.winner===myId?'Voce venceu!':'Perdeu!');location.reload();break;
        case'error':alert(m.message);break;
    }};
}
function showG(){document.getElementById('menu').classList.add('hidden');document.getElementById('game').classList.remove('hidden');}
function upInd(){const i=document.getElementById('turnIndicator');i.textContent=isMy?'Sua vez!':'Vez do oponente';i.style.color=isMy?'#4CAF50':'#f44336';}
function drT(){cx.fillStyle='#1a5c2e';cx.fillRect(0,0,TW,TH);cx.fillStyle='#143d23';pk.forEach(p=>{cx.beginPath();cx.arc(p.x,p.y,PR,0,6.28);cx.fill();});}
function drB(b){if(!b||b.potted)return;const gr=cx.createRadialGradient(b.x-3,b.y-3,2,b.x,b.y,BR),c=COL[b.id];gr.addColorStop(0,b.id>=9?lc(c,40):lc(c,30));gr.addColorStop(.6,c);gr.addColorStop(1,b.id>=9?dc(c,30):dc(c,40));cx.beginPath();cx.arc(b.x,b.y,BR,0,6.28);cx.fillStyle=gr;cx.fill();cx.fillStyle='#fff';cx.font='bold 8px Arial';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(b.id.toString(),b.x,b.y+1);}
function lc(c,p){const n=parseInt(c.slice(1),16),a=Math.round(2.55*p);return'#'+((0x1000000+(Math.min(255,n>>16+a)<<16)+(Math.min(255,(n>>8&255)+a)<<8)+(Math.min(255,(n&255)+a))).toString(16).slice(1));}
function dc(c,p){const n=parseInt(c.slice(1),16),a=Math.round(2.55*p);return'#'+((0x1000000+(Math.max(0,n>>16-a)<<16)+(Math.max(0,(n>>8&255)-a)<<8)+(Math.max(0,(n&255)-a))).toString(16).slice(1));}
function ren(){drT();if(g&&g.balls)g.balls.forEach(drB);if(isMy&&cueD&&aim){cx.strokeStyle='rgba(255,255,255,0.5)';cx.lineWidth=2;cx.setLineDash([5,5]);cx.beginPath();cx.moveTo(cueD.x,cueD.y);cx.lineTo(aim.ex,aim.ey);cx.stroke();cx.setLineDash([]);}requestAnimationFrame(ren);}
function gc(){return g?.balls?.find(b=>b.id===0);}
function gp(e){const r=ca.getBoundingClientRect();return{x:(e.touches?e.touches[0].clientX:e.clientX-r.left)*TW/r.width,y:(e.touches?e.touches[0].clientY:e.clientY-r.top)*TH/r.height};}
function ds(x1,y1,x2,y2){return Math.sqrt((x2-x1)**2+(y2-y1)**2);}
ca.onmousedown=ca.ontouchstart=e=>{e.preventDefault();if(!isMy||!g)return;const cb=gc(),p=gp(e);if(cb&&ds(p.x,p.y,cb.x,cb.y)<BR*2)cueD={x:cb.x,y:cb.y};};
document.onmousemove=document.ontouchmove=e=>{e.preventDefault();if(!cueD)return;const p=gp(e),dx=cueD.x-p.x,dy=cueD.y-p.y;power=Math.min(100,Math.sqrt(dx*dx+dy*dy)/3);document.getElementById('powerFill').style.width=power+'%';const md=150,d=Math.sqrt(dx*dx+dy*dy);if(d>md){const a=Math.atan2(dy,dx);aim={ex:cueD.x+Math.cos(a)*md,ey:cueD.y+Math.sin(a)*md};}else aim={ex:p.x,ey:p.y};};
document.onmouseup=document.ontouchend=e=>{if(!cueD||power<5){cueD=null;aim=null;power=0;document.getElementById('powerFill').style.width='0%';return;}const cb=gc();if(!cb||!aim)return;const dx=cb.x-aim.ex,dy=cb.y-aim.ey;ws.send(JSON.stringify({type:'shot',angle:Math.atan2(dy,dx),velocity:power*0.3}));cueD=null;aim=null;power=0;document.getElementById('powerFill').style.width='0%';};
document.getElementById('createBtn').onclick=con;
document.getElementById('joinBtn').onclick=()=>document.getElementById('joinForm').classList.remove('hidden');
document.getElementById('joinConfirmBtn').onclick=()=>{const c=document.getElementById('roomCode').value.toUpperCase().trim();if(c.length!==6)return alert('6 caracteres');con();};
ren();
})();
    </script>
</body>
</html>`;

async function handleRequest(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === '/') {
        return new Response(HTML, { headers: { 'Content-Type': 'text/html' } });
    }

    if (req.headers.get('Upgrade') === 'websocket') {
        return handleWebSocket(req);
    }

    return new Response('Not Found', { status: 404 });
}

async function handleWebSocket(req: Request): Promise<Response> {
    const { socket, response } = new WebSocketPair();

    let playerId = '';
    let roomCode = '';
    let clients: WebSocket[] = [socket];
    let room: any = null;

    (socket as any).roomCode = '';
    (socket as any).playerId = '';

    socket.addEventListener('message', (e: MessageEvent) => {
        try {
            const msg = JSON.parse(e.data as string);
            switch (msg.type) {
                case 'create': {
                    playerId = genId();
                    roomCode = genCode();
                    room = {
                        code: roomCode,
                        players: [playerId],
                        playerGroups: {},
                        state: createInitialState(),
                        currentPlayer: playerId,
                        currIdx: 0,
                        shotInProgress: false,
                        clients
                    };
                    rooms.set(roomCode, room);
                    (socket as any).roomCode = roomCode;
                    (socket as any).playerId = playerId;
                    socket.send(JSON.stringify({ type: 'created', playerId, roomCode, state: room.state }));
                    break;
                }
                case 'join': {
                    playerId = genId();
                    roomCode = msg.roomCode.toUpperCase();
                    room = rooms.get(roomCode);
                    if (!room) {
                        socket.send(JSON.stringify({ type: 'error', message: 'Sala nao encontrada' }));
                        return;
                    }
                    if (room.players.length >= 2) {
                        socket.send(JSON.stringify({ type: 'error', message: 'Sala lotada' }));
                        return;
                    }
                    room.players.push(playerId);
                    room.clients.push(socket);
                    if (room.players.length === 2) {
                        const rand = Math.random() < 0.5;
                        room.playerGroups[room.players[0]] = rand ? 'solid' : 'striped';
                        room.playerGroups[room.players[1]] = rand ? 'striped' : 'solid';
                    }
                    (socket as any).roomCode = roomCode;
                    (socket as any).playerId = playerId;
                    socket.send(JSON.stringify({ type: 'joined', playerId, roomCode, state: room.state }));
                    broadcast(room, { type: 'state', state: room.state });
                    break;
                }
                case 'shot': {
                    room = rooms.get((socket as any).roomCode);
                    if (!room || room.currentPlayer !== playerId || room.shotInProgress) return;
                    const cb = room.state.balls.find((b: any) => b.id === 0);
                    if (!cb || cb.potted) return;
                    cb.vx = Math.cos(msg.angle) * msg.velocity;
                    cb.vy = Math.sin(msg.angle) * msg.velocity;
                    room.shotInProgress = true;
                    room.pottedThisShot = [];
                    room.lastUpdate = Date.now();
                    broadcast(room, { type: 'state', state: room.state });
                    startPhysics(room);
                    break;
                }
            }
        } catch {
            // ignore parse errors
        }
    });

    socket.addEventListener('close', () => {
        const rc = (socket as any).roomCode;
        if (rc) {
            const r = rooms.get(rc);
            if (r) {
                r.players = r.players.filter((p: string) => p !== playerId);
                r.clients = r.clients.filter((c: WebSocket) => c !== socket);
                if (r.players.length === 0) {
                    rooms.delete(rc);
                }
            }
        }
    });

    return response;
}

function broadcast(room: any, msg: object) {
    room.clients.forEach((c: WebSocket) => {
        try {
            c.send(JSON.stringify(msg));
        } catch {
            // ignore send errors
        }
    });
}

function startPhysics(room: any) {
    const loop = () => {
        if (!room.shotInProgress) {
            checkShotResult(room);
            return;
        }
        updatePhysics(room);
        if (Date.now() - room.lastUpdate >= 50) {
            broadcast(room, { type: 'state', state: room.state });
            room.lastUpdate = Date.now();
        }
        setTimeout(loop, 1000 / 60);
    };
    loop();
}

function updatePhysics(room: any) {
    let moving = false;
    for (const b of room.state.balls) {
        if (b.potted) continue;
        if (Math.abs(b.vx) > MIN_VELOCITY || Math.abs(b.vy) > MIN_VELOCITY) {
            moving = true;
            b.x += b.vx;
            b.y += b.vy;
            b.vx *= FRICTION;
            b.vy *= FRICTION;
            if (b.x < BALL_RADIUS) {
                b.x = BALL_RADIUS;
                b.vx *= -0.8;
            } else if (b.x > TABLE_WIDTH - BALL_RADIUS) {
                b.x = TABLE_WIDTH - BALL_RADIUS;
                b.vx *= -0.8;
            }
            if (b.y < BALL_RADIUS) {
                b.y = BALL_RADIUS;
                b.vy *= -0.8;
            } else if (b.y > TABLE_HEIGHT - BALL_RADIUS) {
                b.y = TABLE_HEIGHT - BALL_RADIUS;
                b.vy *= -0.8;
            }
        } else {
            b.vx = 0;
            b.vy = 0;
        }
    }
    for (let i = 0; i < room.state.balls.length; i++) {
        for (let j = i + 1; j < room.state.balls.length; j++) {
            collide(room.state.balls[i], room.state.balls[j]);
        }
    }
    for (const b of room.state.balls) {
        if (b.potted) continue;
        for (const p of pockets) {
            const dx = b.x - p.x;
            const dy = b.y - p.y;
            if (Math.sqrt(dx * dx + dy * dy) < POCKET_RADIUS) {
                b.potted = true;
                room.pottedThisShot.push(b.id);
                break;
            }
        }
    }
}

function collide(b1: any, b2: any) {
    if (b1.potted || b2.potted) return;
    const dx = b2.x - b1.x;
    const dy = b2.y - b1.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < BALL_RADIUS * 2 && d > 0) {
        const nx = dx / d;
        const ny = dy / d;
        const dv = (b1.vx - b2.vx) * nx + (b1.vy - b2.vy) * ny;
        if (dv > 0) return;
        b1.vx -= dv * nx;
        b1.vy -= dv * ny;
        b2.vx += dv * nx;
        b2.vy += dv * ny;
        const ov = (BALL_RADIUS * 2 - d) / 2;
        b1.x -= ov * nx;
        b1.y -= ov * ny;
        b2.x += ov * nx;
        b2.y += ov * ny;
    }
}

function checkShotResult(room: any) {
    const balls = room.state.balls;
    const cb = balls.find((b: any) => b.id === 0);
    const currGrp = room.playerGroups[room.currentPlayer];

    if (cb?.potted) {
        cb.x = 200;
        cb.y = TABLE_HEIGHT / 2;
        cb.potted = false;
    }

    const potted = room.pottedThisShot.filter((id: number) => id !== 0);
    const eight = potted.includes(8);
    const mine = currGrp === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
    const myPut = potted.filter((id: number) => mine.includes(id));
    const oppPut = potted.filter((id: number) => !mine.includes(id) && id !== 8);

    if (eight) {
        const left = mine.filter(id => !potted.includes(id));
        if (left.length === 0 && room.state.firstPottedType === currGrp) {
            broadcast(room, { type: 'gameOver', winner: room.currentPlayer });
        } else {
            const winIdx = (room.currIdx + 1) % room.players.length;
            broadcast(room, { type: 'gameOver', winner: room.players[winIdx] });
        }
        resetGame(room);
        return;
    }

    if (potted.length === 0 || cb?.potted) {
        switchTurn(room);
    } else if (myPut.length > 0) {
        // keep turn
    } else {
        switchTurn(room);
    }

    if (!room.state.firstPottedType && potted.length > 0) {
        const first = potted.find(id => id >= 1 && id <= 15);
        if (first) {
            room.state.firstPottedType = first <= 8 ? currGrp : (currGrp === 'solid' ? 'striped' : 'solid');
        }
    }

    broadcast(room, { type: 'state', state: room.state });
}

function switchTurn(room: any) {
    room.currIdx = (room.currIdx + 1) % room.players.length;
    room.currentPlayer = room.players[room.currIdx];
    room.state.currentPlayer = room.currentPlayer;
}

function resetGame(room: any) {
    const balls = room.state.balls;
    for (const b of balls) {
        b.potted = false;
        b.vx = 0;
        b.vy = 0;
    }
    balls[0].x = 200;
    balls[0].y = TABLE_HEIGHT / 2;

    const positions = [
        [550, 150, 1], [570, 130, 9], [570, 170, 2], [590, 110, 10], [590, 150, 8], [590, 190, 11],
        [610, 130, 3], [610, 170, 12], [630, 150, 4], [630, 170, 13], [650, 150, 5], [650, 170, 14],
        [670, 150, 6], [670, 170, 15], [690, 150, 7]
    ];
    positions.forEach(([x, y, id], i) => {
        balls[i + 1].x = x;
        balls[i + 1].y = y;
        balls[i + 1].potted = false;
    });

    room.state.firstPottedType = null;
    room.state.gameOver = false;
    room.currentPlayer = room.players[0];
    room.currIdx = 0;
    room.state.currentPlayer = room.currentPlayer;
}

export default { fetch: (req: Request, env: Env) => handleRequest(req, env) };