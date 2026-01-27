import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GameWebSocket from './GameWebSocket';
import './App.css';

function LandingPage() {
    let [board] = useState([["White Rook", "White Knight", "White Bishop", "White Queen", "White King", "White Bishop", "White Knight", "White Rook"],
                            ["White Pawn", "White Pawn", "White Pawn", "White Pawn", "White Pawn", "White Pawn", "White Pawn", "White Pawn"],
                            ["X", "X", "X", "X", "X", "X", "X", "X"],
                            ["X", "X", "X", "X", "X", "X", "X", "X"],
                            ["X", "X", "X", "X", "X", "X", "X", "X"],
                            ["X", "X", "X", "X", "X", "X", "X", "X"],
                            ["Black Pawn", "Black Pawn", "Black Pawn", "Black Pawn", "Black Pawn", "Black Pawn", "Black Pawn", "Black Pawn"],
                            ["Black Rook", "Black Knight", "Black Bishop", "Black Queen", "Black King", "Black Bishop", "Black Knight", "Black Rook"],
                        ]);
    let [boardColors] = useState([
            ["black", "white", "black", "white", "black", "white", "black", "white"],
            ["white", "black", "white", "black", "white", "black", "white", "black"],
            ["black", "white", "black", "white", "black", "white", "black", "white"],
            ["white", "black", "white", "black", "white", "black", "white", "black"],
            ["black", "white", "black", "white", "black", "white", "black", "white"],
            ["white", "black", "white", "black", "white", "black", "white", "black"],
            ["black", "white", "black", "white", "black", "white", "black", "white"],
            ["white", "black", "white", "black", "white", "black", "white", "black"],
        ]);

    const navigate = useNavigate();
    const [isWaiting, setIsWaiting] = useState(false);
    const [playerColor, setPlayerColor] = useState(null);
    const [gameId, setGameId] = useState(null);
    const [wsConnection, setWsConnection] = useState(null);

    const startNewGame = () => {
        setIsWaiting(true);

        // Create WebSocket connection
        const ws = new GameWebSocket(null); // No gameId yet
        setWsConnection(ws);
        window.gameWebSocket = ws; // Store globally for reuse in GamePage

        // Listen for game assignment
        ws.on('WAITING_FOR_OPPONENT', (message) => {
            console.log('Waiting for opponent...', message);
            console.log('Setting gameId to:', message.gameId);
            console.log('Setting playerColor to:', message.yourColor);
            setGameId(message.gameId);
            setPlayerColor(message.yourColor);
        });

        // Listen for game start
        ws.on('GAME_STARTED', (message) => {
            console.log('Game started!', message);
            // Update websocket's gameId
            ws.gameId = message.gameId;
            window.gameWebSocket = ws;
            navigate(`/game/${message.gameId}`, { 
                state: { 
                    playerColor: message.yourColor,
                    opponentColor: message.opponentColor
                } 
            });
        });

        ws.on('error', (error) => {
            console.error('Connection error:', error);
            setIsWaiting(false);
            alert('Connection error. Please try again.');
        });

        ws.on('disconnected', () => {
            console.log('Disconnected from server');
            setIsWaiting(false);
        });

        // Send JOIN_GAME to server once connected
        ws.on('connected', () => {
            console.log('WebSocket connected, sending JOIN_GAME');
            ws.send({
                type: 'JOIN_GAME',
            });
        });

        // Listen for opponent disconnection
        ws.on('OPPONENT_DISCONNECTED', (message) => {
            console.log('Opponent disconnected:', message);
            alert('Your opponent has disconnected. The game will now end.');
            setIsWaiting(false);
            setPlayerColor(null);
            setGameId(null);
        });
    };

    const cancelWaiting = () => {
        if (wsConnection) {
            wsConnection.disconnect();
        }
        setIsWaiting(false);
        setPlayerColor(null);
        setGameId(null);
    };

    if (isWaiting) {
        return (
            <div className="landing-container">
                <div className="waiting-room">
                    <h2>Waiting for Opponent</h2>
                    {playerColor && <div className="color-badge">You are playing as: <strong>{playerColor}</strong></div>}
                    {!playerColor && <div className="color-badge">Assigning color...</div>}
                    {gameId && <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Game ID: {gameId}</p>}
                    <p>Waiting for another player to join...</p>
                    <div className="waiting-spinner"></div>
                    <button className="cancel-button" onClick={cancelWaiting}>Cancel</button>
                </div>
            </div>
        );
    }

    return (
        <div className="landing-container">
            <div className="board">
                {(() => {
                    const revBoard = board.slice().reverse();
                    const revColors = boardColors.slice().reverse();
                    return revBoard.map((row, rowIndex) => (
                        <div className={`row row-${7 - rowIndex + 1}`} key={rowIndex}>
                            {row.map((cell, colIndex) => {
                                const bg = revColors[rowIndex][colIndex] === "white" ? { backgroundColor: "white" } : { backgroundColor: "black" };
                                
                                let imgSrc = null;
                                if (cell !== "X") {
                                    const pieceKey = cell.replace(/\s+/g, "_"); 
                                    const bgName = revColors[rowIndex][colIndex] === "white" ? "White" : "Black";
                                    const ext = ".jpg"; 
                                    imgSrc = `/${pieceKey}_${bgName}${ext}`; 
                                }
                                return (
                                    <div
                                        className={`col col-${colIndex + 1}`}
                                        style={bg}
                                        key={colIndex}
                                    >
                                        {imgSrc ? <img src={imgSrc} className="piece" style={{ width: "100%", height: "100%" }} alt={cell} /> : null}
                                    </div>
                                );
                            })}
                        </div>
                    ));
                })()}
            </div>

            <div>
                <button className="play-button" onClick={startNewGame}>Play Now</button>
            </div>
        </div>
    );
}

export default LandingPage;

