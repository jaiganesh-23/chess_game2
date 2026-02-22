import { WebSocketServer } from 'ws';
import http from 'http';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Serve React build
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for React Router
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ 
  server,
  perMessageDeflate: false // Disable compression for better compatibility
});

// Store waiting players and active games
const waitingPlayers = new Map(); // gameId -> { ws, color }
const activeGames = new Map(); // gameId -> { player1, player2, gameState }

wss.on('connection', (ws) => {
  let associatedGameId = null; // Track which game this connection belongs to
  console.log('New WebSocket connection');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      const { type, color, gameId } = message;
      
      console.log('Server received message type:', type, 'GameId:', gameId);

      if (type === 'REGISTER_PLAYER') {
        // Player from GamePage registering their connection
        const game = activeGames.get(gameId);
        if (game) {
          // Update the websocket reference for this player
          if (game.player1 && game.player1.color === message.playerColor) {
            game.player1.ws = ws;
            associatedGameId = gameId;
            console.log(`Player 1 (${message.playerColor}) registered connection for game ${gameId}`);
          } else if (game.player2 && game.player2.color === message.playerColor) {
            game.player2.ws = ws;
            associatedGameId = gameId;
            console.log(`Player 2 (${message.playerColor}) registered connection for game ${gameId}`);
          }
        }
      } else if (type === 'JOIN_GAME') {
        // Check if there's a waiting player
        let waitingGameId = null;
        for (const [gameId, player] of waitingPlayers.entries()) {
          if (player.ws.readyState === 1) { // Check connection is open
            waitingGameId = gameId;
            break;
          }
        }

        if (waitingGameId) {
          // Join existing waiting game
          const firstPlayer = waitingPlayers.get(waitingGameId);
          const opponentColor = firstPlayer.color === 'White' ? 'Black' : 'White';
          const secondPlayerColor = opponentColor;
          
          waitingPlayers.delete(waitingGameId);
          associatedGameId = waitingGameId;

          // Create active game
          activeGames.set(waitingGameId, {
            player1: firstPlayer,
            player2: { ws, color: secondPlayerColor },
            gameState: null,
          });

          console.log(`Game started: ${waitingGameId}, Player1(${firstPlayer.color}) vs Player2(${secondPlayerColor})`);

          // Notify both players that game started
          try {
            firstPlayer.ws.send(JSON.stringify({
              type: 'GAME_STARTED',
              yourColor: firstPlayer.color,
              opponentColor: secondPlayerColor,
              gameId: waitingGameId,
            }));
            console.log(`Sent GAME_STARTED to Player1 of game ${waitingGameId}`);
          } catch (err) {
            console.error('Error sending to player1:', err);
          }

          try {
            ws.send(JSON.stringify({
              type: 'GAME_STARTED',
              yourColor: secondPlayerColor,
              opponentColor: firstPlayer.color,
              gameId: waitingGameId,
            }));
            console.log(`Sent GAME_STARTED to Player2 of game ${waitingGameId}`);
          } catch (err) {
            console.error('Error sending to player2:', err);
          }
        } else {
          // Create new game and wait
          const gameId = uuidv4();
          const assignedColor = Math.random() > 0.5 ? 'White' : 'Black';
          
          waitingPlayers.set(gameId, { ws, color: assignedColor });
          associatedGameId = gameId;
          
          console.log(`New game created: ${gameId}, Player1 assigned ${assignedColor}`);

          ws.send(JSON.stringify({
            type: 'WAITING_FOR_OPPONENT',
            yourColor: assignedColor,
            gameId,
          }));
          console.log(`Sent WAITING_FOR_OPPONENT to Player1 of game ${gameId}`);
        }
      } else if (type === 'MOVE') {
        // Send move to opponent
        const gameId = message.gameId;
        console.log(`MOVE received for game ${gameId}`);
        const game = activeGames.get(gameId);
        if (game) {
          console.log(`Game found for ${gameId}, looking for opponent...`);
          const opponent =
            game.player1.ws === ws ? game.player2 : game.player1;
          console.log(`Opponent found:`, opponent ? 'yes' : 'no');
          if (opponent && opponent.ws.readyState === 1) { // 1 = OPEN
            console.log(`Sending OPPONENT_MOVE to opponent for game ${gameId}`);
            console.log('GameState being sent:', message.gameState);
            console.log('GameState turn value:', message.gameState?.turn);
            const currentTurn = message.gameState?.turn;
            const nextTurn = currentTurn === 'White' ? 'Black' : 'White';
            console.log('Current turn from gameState:', currentTurn, 'Next turn calculated:', nextTurn);
            opponent.ws.send(JSON.stringify({
              type: 'OPPONENT_MOVE',
              move: message.move,
              board: message.board,
              gameState: message.gameState,
              turn: nextTurn, // Flip turn for the opponent
            }));
          } else {
            console.log(`Opponent not ready or connection closed`);
          }
        } else {
          console.log(`Game ${gameId} not found in activeGames`);
          console.log(`Active games:`, Array.from(activeGames.keys()));
        }
      } else if (type === 'SYNC_BOARD') {
        // Send board state to opponent for synchronization
        const gameId = message.gameId;
        const game = activeGames.get(gameId);
        if (game) {
          const opponent =
            game.player1.ws === ws ? game.player2 : game.player1;
          if (opponent && opponent.ws.readyState === 1) {
            const syncMessage = {
              type: 'BOARD_SYNC',
              board: message.board,
              turn: message.turn,
            };
            // Include gameState if provided (for rook movement states)
            if (message.gameState) {
              syncMessage.gameState = message.gameState;
            }
            opponent.ws.send(JSON.stringify(syncMessage));
          }
        }
      } else if (type === 'GAME_OVER') {
        // Notify opponent of game over
        const gameId = message.gameId;
        console.log(`GAME_OVER received for game ${gameId}`);
        console.log('Active games before deletion:', Array.from(activeGames.keys()));
        console.log('Result:', message.result);
        const game = activeGames.get(gameId);
        if (game) {
          const opponent =
            game.player1.ws === ws ? game.player2 : game.player1;
          if (opponent && opponent.ws.readyState === 1) {
            opponent.ws.send(JSON.stringify({
              type: 'GAME_OVER',
              result: message.result,
            }));
            console.log(`Sent GAME_OVER to opponent for game ${gameId}`);
          }
        }
        const deleted = activeGames.delete(gameId);
        console.log(`Game ${gameId} deleted from activeGames:`, deleted);
        console.log('Active games after deletion:', Array.from(activeGames.keys()));
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    // Clean up - remove from waiting players or active games
    for (const [gameId, player] of waitingPlayers.entries()) {
      if (player.ws === ws) {
        console.log(`Removing waiting player from game ${gameId}`);
        waitingPlayers.delete(gameId);
        break;
      }
    }

    for (const [gameId, game] of activeGames.entries()) {
      if (game.player1.ws === ws || game.player2.ws === ws) {
        // Notify remaining player
        const opponent =
          game.player1.ws === ws ? game.player2 : game.player1;
        if (opponent && opponent.ws.readyState === 1) { // 1 = OPEN
          opponent.ws.send(JSON.stringify({
            type: 'OPPONENT_DISCONNECTED',
          }));
        }
        console.log(`Game ${gameId} ended due to disconnection`);
        activeGames.delete(gameId);
        break;
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
