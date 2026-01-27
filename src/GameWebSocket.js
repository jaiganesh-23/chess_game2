class GameWebSocket {
  constructor(gameId) {
    this.gameId = gameId;
    this.ws = null;
    this.listeners = new Map();
    this.connect();
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Connected to WebSocket server');
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('GameWebSocket received message type:', message.type);
        
        // Update gameId if server assigns one
        if (message.gameId && !this.gameId) {
          this.gameId = message.gameId;
        }
        
        this.emit(message.type, message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('Disconnected from WebSocket server');
      this.emit('disconnected');
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    console.log(`Emitting event: ${event}, listeners count:`, this.listeners.has(event) ? this.listeners.get(event).length : 0);
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => callback(data));
    } else {
      console.log(`No listeners for event: ${event}`);
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const fullMessage = { ...message };
      // Only add gameId if it exists
      if (this.gameId) {
        fullMessage.gameId = this.gameId;
      }
      console.log('GameWebSocket sending message:', fullMessage);
      this.ws.send(JSON.stringify(fullMessage));
    } else {
      console.error('WebSocket is not connected, cannot send:', message, 'WS state:', this.ws?.readyState);
    }
  }

  joinGame(color) {
    this.send({
      type: 'JOIN_GAME',
      color,
    });
  }

  sendMove(move, board, gameState) {
    console.log('GameWebSocket.sendMove called, gameId:', this.gameId);
    this.send({
      type: 'MOVE',
      move,
      board,
      gameState,
    });
  }

  syncBoard(board, turn) {
    this.send({
      type: 'SYNC_BOARD',
      board,
      turn,
    });
  }

  gameOver(result) {
    this.send({
      type: 'GAME_OVER',
      result,
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

export default GameWebSocket;

export const connectWebSocket = (onGameStarted, onOpponentMove, onGameOver, onOpponentDisconnected) => {
  // Dynamically build WebSocket URL based on current location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}`;

  console.log('Connecting to WebSocket at:', wsUrl);

  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log('Received message:', message);

      switch (message.type) {
        case 'GAME_STARTED':
          onGameStarted(message);
          break;
        case 'OPPONENT_MOVE':
          onOpponentMove(message);
          break;
        case 'GAME_OVER':
          onGameOver(message);
          break;
        case 'OPPONENT_DISCONNECTED':
          onOpponentDisconnected(message);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  };

  return ws;
};
