# Sinuca Online 8-Ball - Design

## Overview
Jogo de sinuca 8-ball multiplayer online no navegador, até 2 jogadores em tempo real via WebSocket.

## Tech Stack
- **Frontend:** HTML5 Canvas + vanilla JavaScript
- **Backend:** Node.js + ws (WebSocket library)
- **Comunicação:** WebSocket para tempo real

## Architecture

### Frontend (public/)
- `index.html` - Estrutura base
- `style.css` - Estilos minimalistas
- `game.js` - Lógica do cliente
  - Renderização Canvas da mesa
  - Sistema de input (drag para mirar/tacar)
  - Comunicação WebSocket
  - Interpolação de estado

### Backend (server/)
- `server.js` - Servidor Node.js
  - WebSocket server
  - Gestão de salas (criar/entrar via código)
  - Física server-side (autoridade única)
  - Validação de jogadas
  - Regras 8-ball

## Game Flow
1. Criar sala → recebe código (ex: "ABC123")
2. Outro jogador entra com código
3. Servidor distribui bolas (1-7 sólidas, 9-15 listradas)
4. Turnos alternados
5. Jogador vence ao encaçapar 8-ball após limpar suas bolas

## Physics
- Colisão bola-bola (elastic collision)
- Colisão bola-borda (reflexão)
- Fricção (desaceleração gradual)
- Detecção de encaçapadas

## Rules (8-Ball)
- Primeira bola encaçapada define grupo (sólida/listrada)
- Errar a 8-ball = derrota
- Errar qualquer tacada = passagem de turno
- Bloqueio (snooker) = falta

## UI Design
- Mesa verde estilo classic billiards
- Bolas com cores padrão (1-7 sólidas, 8 preta, 9-15 listradas)
- Indicador de turno
- Código da sala visível
- Joystick virtual de força (drag do branco)