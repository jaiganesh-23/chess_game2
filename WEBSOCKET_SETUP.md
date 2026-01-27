# Chess Game WebSocket Setup

## Overview
Your chess game now supports real-time multiplayer gameplay via WebSocket communication.

## Features Implemented

### 1. **WebSocket Server** (`server.js`)
- Node.js WebSocket server running on port 8080
- Handles game matchmaking between two players
- Manages real-time move communication
- Handles game state synchronization

### 2. **Landing Page with Waiting Room**
- "Play Now" button with new gradient styling
- First player gets randomly assigned a color (White or Black)
- Waiting room displays player color and waits for opponent
- Second player automatically joins the game when available
- Cancel button to exit waiting room

### 3. **Game Page with Multiplayer Support**
- Receives opponent moves via WebSocket
- Sends own moves to opponent in real-time
- Automatic board synchronization between players
- Handles opponent disconnection

### 4. **WebSocket Communication Module** (`GameWebSocket.js`)
- Abstraction layer for WebSocket communication
- Message types:
  - `JOIN_GAME`: Player joins a game with a specific color
  - `GAME_STARTED`: Both players notified when match is ready
  - `MOVE`: Send moves to opponent
  - `SYNC_BOARD`: Sync board state between players
  - `GAME_OVER`: Notify opponent of game end
  - `OPPONENT_DISCONNECTED`: Handle opponent disconnect

## How to Run

### 1. Start the WebSocket Server (in a separate terminal)
```bash
npm run server
```
The server will run on `ws://localhost:8080`

### 2. Start the Vite Dev Server (in another terminal)
```bash
npm run dev
```

### 3. Test the Game
- Open your browser and navigate to the Vite dev server URL (usually `http://localhost:5173`)
- Click "Play Now" button
- Your assigned color will be displayed
- Open another browser window/tab at the same URL
- Click "Play Now" on the second window
- The game will start automatically when both players have joined
- Moves will be synchronized in real-time between both players

## CSS Styling
The "Play Now" button now has:
- Gradient background (purple to violet)
- Hover effect with lift animation
- Enhanced shadow effects
- Modern rounded design

The waiting room features:
- Centered layout with gradient background
- Player color badge
- Loading spinner animation
- Cancel button for exiting

## File Structure
```
chess_game/
├── server.js                    # WebSocket server
├── src/
│   ├── GameWebSocket.js        # WebSocket client wrapper
│   ├── App.jsx                 # Game page component
│   ├── LandingPage.jsx         # Landing page with waiting room
│   ├── main.jsx                # Entry point with routing
│   └── App.css                 # Styles (updated with button CSS)
├── package.json                # Added "server" script
└── vite.config.js
```

## Important Notes
- Both players must be on the same network for the game to work
- The WebSocket server must be running while playing
- Game IDs are unique UUIDs for each game session
- Each player is randomly assigned White or Black color
