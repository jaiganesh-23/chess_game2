import { useState, useEffect, useRef, use, useCallback } from 'react';
import { Routes, Route, useParams, useNavigate, useLocation } from 'react-router-dom';
import GameWebSocket from './GameWebSocket';
import './App.css';
import LandingPage from './LandingPage.jsx';

function GamePage() {
  const { gameId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [playerColor, setPlayerColor] = useState(location.state?.playerColor || null);
  const [opponentColor, setOpponentColor] = useState(location.state?.opponentColor || null);
  const wsConnectionRef = useRef(null);
  const prevBoardRef = useRef(null); // Track previous board state for movement detection
  
  let [board, setBoard] = useState([["White Rook", "White Knight", "White Bishop", "White Queen", "White King", "White Bishop", "White Knight", "White Rook"],
                                    ["White Pawn", "White Pawn", "White Pawn", "White Pawn", "White Pawn", "White Pawn", "White Pawn", "White Pawn"],
                                    ["X", "X", "X", "X", "X", "X", "X", "X"],
                                    ["X", "X", "X", "X", "X", "X", "X", "X"],
                                    ["X", "X", "X", "X", "X", "X", "X", "X"],
                                    ["X", "X", "X", "X", "X", "X", "X", "X"],
                                    ["Black Pawn", "Black Pawn", "Black Pawn", "Black Pawn", "Black Pawn", "Black Pawn", "Black Pawn", "Black Pawn"],
                                    ["Black Rook", "Black Knight", "Black Bishop", "Black Queen", "Black King", "Black Bishop", "Black Knight", "Black Rook"],
                                  ]);
  let [boardColors, setBoardColors] = useState([
    ["black", "white", "black", "white", "black", "white", "black", "white"],
    ["white", "black", "white", "black", "white", "black", "white", "black"],
    ["black", "white", "black", "white", "black", "white", "black", "white"],
    ["white", "black", "white", "black", "white", "black", "white", "black"],
    ["black", "white", "black", "white", "black", "white", "black", "white"],
    ["white", "black", "white", "black", "white", "black", "white", "black"],
    ["black", "white", "black", "white", "black", "white", "black", "white"],
    ["white", "black", "white", "black", "white", "black", "white", "black"],
  ])
  let [turn, setTurn] = useState("White");
  let [selectionPoints, setSelectionPoints] = useState(null);
  let [selectedPiece, setSelectedPiece] = useState(null);
  let [landingPoints, setLandingPoints] = useState([-1,-1]);
  let [possibleLandingPoints, setPossibleLandingPoints] = useState(null);
  let [whiteKingMoved, setWhiteKingMoved] = useState(false);
  let [blackKingMoved, setBlackKingMoved] = useState(false);
  // Track individual rook movements for castling validation
  let [whiteLeftRookMoved, setWhiteLeftRookMoved] = useState(false);   // a1 rook
  let [whiteRightRookMoved, setWhiteRightRookMoved] = useState(false); // h1 rook
  let [blackLeftRookMoved, setBlackLeftRookMoved] = useState(false);   // a8 rook
  let [blackRightRookMoved, setBlackRightRookMoved] = useState(false); // h8 rook
  let [prevSelectedPiece, setPrevSelectedPiece] = useState(null);
  let [prevSteps, setPrevSteps] = useState(null);
  let [specialLandingPoints, setSpecialLandingPoints] = useState(null);
  let [prevLandingPoints, setPrevLandingPoints] = useState([-1, -1]);
  let [check1, setCheck1] = useState(false);
  let [checkLandingPoints, setCheckLandingPoints] = useState(null);
  let [checkMate, setCheckMate] = useState(false);
  let [staleMate, setStaleMate] = useState(false);
  let [lastMovedColor, setLastMovedColor] = useState(null);

  // Set up event handlers using useCallback so they have correct closures
  const handleOpponentMove = useCallback((message) => {
    console.log('Opponent moved:', message);
    console.log('Message.turn:', message.turn, 'Message.gameState.turn:', message.gameState?.turn);
    console.log('Board in message:', message.board);
    if (message.board) {
      // Create new board reference to ensure React detects the change
      const newBoard = message.board.map(row => [...row]);
      console.log('Setting board to opponent board:', newBoard);
      setBoard(newBoard);
      // Use turn from message, or from gameState, or default to opposite of current
      const newTurn = message.turn || message.gameState?.turn;
      console.log('Setting turn to:', newTurn);
      setTurn(newTurn);
      // Track which color made this move
      const movedColor = newTurn === "White" ? "Black" : "White";
      setLastMovedColor(movedColor);
      console.log('Board and turn updated. New turn:', newTurn, 'Last moved color:', movedColor);
    }
    if (message.gameState) {
      // Update game state from opponent's move
      setWhiteKingMoved(message.gameState.whiteKingMoved);
      setBlackKingMoved(message.gameState.blackKingMoved);
      // Sync rook movement states - only allow transition from false to true, never back to false
      // This ensures rook movement is permanent
      if (message.gameState.whiteLeftRookMoved === true) {
        setWhiteLeftRookMoved(true);
      }
      if (message.gameState.whiteRightRookMoved === true) {
        setWhiteRightRookMoved(true);
      }
      if (message.gameState.blackLeftRookMoved === true) {
        setBlackLeftRookMoved(true);
      }
      if (message.gameState.blackRightRookMoved === true) {
        setBlackRightRookMoved(true);
      }
      setPrevLandingPoints(message.gameState.prevLandingPoints);
      // Show check alert if opponent put us in check
      if (message.gameState.isCheck) {
        alert("Check! You are in check!");
      }
    }
  }, []);

  const handleBoardSync = useCallback((message) => {
    console.log('Board sync:', message);
    setBoard(message.board.map(row => [...row]));
    setTurn(message.turn);
    const movedColor = message.turn === "White" ? "Black" : "White";
    setLastMovedColor(movedColor);
    
    // Also sync rook movement states if provided
    if (message.gameState) {
      if (message.gameState.whiteLeftRookMoved === true) {
        setWhiteLeftRookMoved(true);
      }
      if (message.gameState.whiteRightRookMoved === true) {
        setWhiteRightRookMoved(true);
      }
      if (message.gameState.blackLeftRookMoved === true) {
        setBlackLeftRookMoved(true);
      }
      if (message.gameState.blackRightRookMoved === true) {
        setBlackRightRookMoved(true);
      }
      if (message.gameState.whiteKingMoved === true) {
        setWhiteKingMoved(true);
      }
      if (message.gameState.blackKingMoved === true) {
        setBlackKingMoved(true);
      }
    }
  }, []);

  const handleOpponentDisconnect = useCallback(() => {
    alert('Opponent disconnected. Returning to landing page...');
    setTimeout(() => {
      navigate('/');
    }, 5000);
  }, [navigate]);

  const handleGameOver = useCallback((message) => {
    console.log('Received GAME_OVER message:', message);
    
    // Show appropriate alert based on who initiated and the result
    if (message.result.includes('StaleMate')) {
      alert(`Game Over! ${message.result}`);
    } else if (message.result.includes('CheckMate')) {
      alert(`Game Over! ${message.result}`);
    } else {
      alert(`Game Over! Result: ${message.result}`);
    }
    
    // Add a small delay before navigating to ensure alert is seen
    setTimeout(() => {
      navigate('/');
    }, 5000);
  }, [navigate]);

  const handleError = useCallback((error) => {
    console.error('WebSocket error:', error);
    alert('Connection error. Please return to landing page.');
    setTimeout(() => {
      navigate('/');
    }, 5000);
  }, [navigate]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!wsConnectionRef.current && gameId && playerColor) {
      // Check if there's already a WebSocket from LandingPage (via sessionStorage)
      const existingWs = window.gameWebSocket;
      
      if (existingWs && existingWs.gameId === gameId) {
        // Reuse existing connection
        wsConnectionRef.current = existingWs;
        console.log('Reusing existing WebSocket connection for game:', gameId);
      } else {
        // Create new connection
        const ws = new GameWebSocket(gameId);
        wsConnectionRef.current = ws;
        window.gameWebSocket = ws; // Store globally for reuse
        
        // Send GAME_CONNECTED message to notify server this connection is for the game
        const connectListener = () => {
          console.log('GamePage WebSocket connected, registering game connection');
          ws.send({
            type: 'REGISTER_PLAYER',
            gameId,
            playerColor
          });
        };

        ws.on('connected', connectListener);
      }
    }
  }, [gameId, playerColor]);

  // Set up listeners in a separate effect that depends on the handlers
  useEffect(() => {
    if (wsConnectionRef.current) {
      const ws = wsConnectionRef.current;
      
      ws.on('OPPONENT_MOVE', handleOpponentMove);
      ws.on('BOARD_SYNC', handleBoardSync);
      ws.on('OPPONENT_DISCONNECTED', handleOpponentDisconnect);
      ws.on('GAME_OVER', handleGameOver);
      ws.on('error', handleError);
      
      console.log('Listeners registered for OPPONENT_MOVE, BOARD_SYNC, etc.');

      return () => {
        console.log('Cleaning up listeners');
        ws.off('OPPONENT_MOVE', handleOpponentMove);
        ws.off('BOARD_SYNC', handleBoardSync);
        ws.off('OPPONENT_DISCONNECTED', handleOpponentDisconnect);
        ws.off('GAME_OVER', handleGameOver);
        ws.off('error', handleError);
      };
    }
  }, [handleOpponentMove, handleBoardSync, handleOpponentDisconnect, handleGameOver, handleError]);

  // Clear selected piece when board updates from opponent
  useEffect(() => {
    setSelectedPiece(null);
    setSelectionPoints(null);
    setPossibleLandingPoints(null);
  }, [board]);

  // Helper function to get current game state based on board position
  const getGameState = useCallback((boardState = board) => {
    return {
      whiteKingMoved: whiteKingMoved || boardState[0][4] !== "White King",
      blackKingMoved: blackKingMoved || boardState[7][4] !== "Black King",
      whiteLeftRookMoved: whiteLeftRookMoved || boardState[0][0] !== "White Rook",
      whiteRightRookMoved: whiteRightRookMoved || boardState[0][7] !== "White Rook",
      blackLeftRookMoved: blackLeftRookMoved || boardState[7][0] !== "Black Rook",
      blackRightRookMoved: blackRightRookMoved || boardState[7][7] !== "Black Rook"
    };
  }, [whiteKingMoved, blackKingMoved, whiteLeftRookMoved, whiteRightRookMoved, blackLeftRookMoved, blackRightRookMoved]);

  // Track rook movements by detecting changes in board state
  // Rook movement is PERSISTENT - once marked as moved, it never resets
  useEffect(() => {
    // Check white left rook (a1 = board[0][0])
    if (!whiteLeftRookMoved) {
      const currentAtA1 = board[0][0];
      const prevAtA1 = prevBoardRef.current ? prevBoardRef.current[0][0] : "White Rook";
      
      if (prevAtA1 === "White Rook" && currentAtA1 !== "White Rook") {
        console.log('White left rook moved from a1 - setting persistent flag');
        setWhiteLeftRookMoved(true);
      } else if (currentAtA1 !== "White Rook" && prevAtA1 !== "White Rook") {
        console.log('White left rook detected as moved (not at a1 in consecutive states)');
        setWhiteLeftRookMoved(true);
      }
    }

    // Check white right rook (h1 = board[0][7])
    if (!whiteRightRookMoved) {
      const currentAtH1 = board[0][7];
      const prevAtH1 = prevBoardRef.current ? prevBoardRef.current[0][7] : "White Rook";
      
      if (prevAtH1 === "White Rook" && currentAtH1 !== "White Rook") {
        console.log('White right rook moved from h1 - setting persistent flag');
        setWhiteRightRookMoved(true);
      } else if (currentAtH1 !== "White Rook" && prevAtH1 !== "White Rook") {
        console.log('White right rook detected as moved (not at h1 in consecutive states)');
        setWhiteRightRookMoved(true);
      }
    }

    // Check black left rook (a8 = board[7][0])
    if (!blackLeftRookMoved) {
      const currentAtA8 = board[7][0];
      const prevAtA8 = prevBoardRef.current ? prevBoardRef.current[7][0] : "Black Rook";
      
      if (prevAtA8 === "Black Rook" && currentAtA8 !== "Black Rook") {
        console.log('Black left rook moved from a8 - setting persistent flag');
        setBlackLeftRookMoved(true);
      } else if (currentAtA8 !== "Black Rook" && prevAtA8 !== "Black Rook") {
        console.log('Black left rook detected as moved (not at a8 in consecutive states)');
        setBlackLeftRookMoved(true);
      }
    }

    // Check black right rook (h8 = board[7][7])
    if (!blackRightRookMoved) {
      const currentAtH8 = board[7][7];
      const prevAtH8 = prevBoardRef.current ? prevBoardRef.current[7][7] : "Black Rook";
      
      if (prevAtH8 === "Black Rook" && currentAtH8 !== "Black Rook") {
        console.log('Black right rook moved from h8 - setting persistent flag');
        setBlackRightRookMoved(true);
      } else if (currentAtH8 !== "Black Rook" && prevAtH8 !== "Black Rook") {
        console.log('Black right rook detected as moved (not at h8 in consecutive states)');
        setBlackRightRookMoved(true);
      }
    }

    // Update the previous board reference for next comparison
    prevBoardRef.current = board.map(row => [...row]);
  }, [board, whiteLeftRookMoved, whiteRightRookMoved, blackLeftRookMoved, blackRightRookMoved]);



  // Send move to opponent
  const sendMove = useCallback((moveData, boardState) => {
    if (wsConnectionRef.current) {
      console.log('sendMove called with gameId:', wsConnectionRef.current.gameId);
      console.log('Move data:', moveData);
      
      const gameState = getGameState(boardState);
      console.log('Sending game state with move:', gameState);
      
      // Check if opponent is in check after this move
      const opponentColor = turn === "White" ? "Black" : "White";
      const isOpponentInCheck = isCheck(boardState, opponentColor);
      
      wsConnectionRef.current.sendMove(moveData, boardState, {
        ...gameState,
        prevLandingPoints,
        turn,
        isCheck: isOpponentInCheck
      });
    } else {
      console.warn('WebSocket connection not ready');
    }
  }, [getGameState, turn, prevLandingPoints]);

  // Sync board with opponent
  const syncBoardWithOpponent = useCallback(() => {
    if (wsConnectionRef.current) {
      const gameState = getGameState(board);
      console.log('Syncing board with game state:', gameState);
      wsConnectionRef.current.syncBoard(board, turn, gameState);
    }
  }, [board, turn, getGameState]);

  function getSpecialLandingPoints(curSelectedPiece, selectionPoints, prevLandingPoints){
    let points = [];
    let row = selectionPoints[0], col = selectionPoints[1];
    if(curSelectedPiece.substring(0, 5) == "Black"){
      if(curSelectedPiece.substring(6) == "Pawn"){
        if(row == prevLandingPoints[0] && col-1 == prevLandingPoints[1]){
          points.push([row-1, col-1]);
        }
        if(row == prevLandingPoints[0] && col+1 == prevLandingPoints[1]){
          points.push([row-1, col+1]);
        }
      }
    }
    if(curSelectedPiece.substring(0, 5) == "White"){
      if(curSelectedPiece.substring(6) == "Pawn"){
        if(row == prevLandingPoints[0] && col-1 == prevLandingPoints[1]){
          points.push([row+1, col-1]);
        }
        if(row == prevLandingPoints[0] && col+1 == prevLandingPoints[1]){
          points.push([row+1, col+1]);
        }
      }
    }
    return points;
  }

  function getAllPossibleMoves(board, color, prevLandingPoints, specialLandingPoints) {
    let allPossibleMoves = [];
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if (board[i][j] != "X" && board[i][j].substring(0, 5) == color) {
          let possibleLandingPoints = getPossibleLandingPoints(board[i][j], [i, j], board);
          if (possibleLandingPoints && possibleLandingPoints.length > 0) {
            for (let k = 0; k < possibleLandingPoints.length; k++) {
              let board3 = JSON.parse(JSON.stringify(board));
              board3 = board3.map((r, a) =>
                r.map((cell, b) => {
                  if (a === i && b === j) return "X";
                  if (a === possibleLandingPoints[k][0] && b === possibleLandingPoints[k][1]) return board[i][j];
                  return cell;
                })

              );
              let validateCheck = isCheck(board3, color);
              if (!validateCheck) {
                allPossibleMoves.push([[i, j], possibleLandingPoints[k]]);
              }
            }
          }
          if (specialLandingPoints && specialLandingPoints.length > 0) {
            for (let k = 0; k < specialLandingPoints.length; k++) {
              let board3 = JSON.parse(JSON.stringify(board));
              board3 = board3.map((r, i) =>
                r.map((cell, j) => {
                  if (i === selectionPoints[0] && j === selectionPoints[1]) return "X";
                  if (i === prevLandingPoints[0] && j === prevLandingPoints[1]) return "X";
                  if (i === specialLandingPoints[k][0] && j === specialLandingPoints[k][1]) return selectedPiece;
                  return cell;
                })
              );
              let validateCheck = isCheck(board3, color);
              if (!validateCheck) {
                allPossibleMoves.push([[i, j], specialLandingPoints[k]]);
              }
            }
          }
        }
      }
    }
    return allPossibleMoves;
  }

  function getPossibleLandingPoints(curSelectedPiece, selectionPoints, board){
    let points = [];
    let row = selectionPoints[0], col = selectionPoints[1];
    if(curSelectedPiece.substr(0, 5) == "Black") {
      if(curSelectedPiece.substr(6) == "Pawn") {
        if(col > 0 && row >= 1 && (board[row-1][col-1] != "X" && board[row-1][col-1].substring(0,5) != "Black") ) {
          points.push([row-1, col-1]);
        }
        if(col <= 6 && row >= 1 && (board[row-1][col+1] != "X" && board[row-1][col+1].substring(0,5) != "Black")) {
          console.log("here");
          points.push([row-1, col+1]);
        }
        let i = row-1, j = col, count = 0;
        if(i >= 0 && board[i][j] == "X") {
          points.push([i, j]);
        }
        i--;
        if(row == 6 && board[i][j] == "X" && board[i+1][j] == "X") {
          points.push([i, j]);
        }
      }

      if(curSelectedPiece.substr(6) == "Rook") {
        let i = row+1, j = col;
        while(i <= 7 && board[i][j] == "X") {
          points.push([i, j]);
          i++;
        }
        if(i <= 7 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }

        i = row-1, j = col;
        while(i >= 0 && board[i][j] == "X") {
          points.push([i, j]);
          i--;
        }
        if(i >= 0 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }

        i = row, j = col+1;
        while(j <= 7 && board[i][j] == "X") {
          points.push([i, j]);
          j++;
        }
        if(j <= 7 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }

        i = row, j = col-1;
        while(j >= 0 && board[i][j] == "X") {
          points.push([i, j]);
          j--;
        }
        if(j >= 0 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }
      }

      if(curSelectedPiece.substr(6) == "Bishop") {
        let i = row-1, j = col-1;
        while(i >= 0 && j >= 0 && board[i][j] == "X") {
          points.push([i, j]);
          i--;
          j--;
        }
        if(i >= 0 && j >= 0 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }

        i = row-1, j = col+1;
        while(i >= 0 && j <= 7 && board[i][j] == "X") {
          points.push([i, j]);
          i--;
          j++;
        }
        if(i >= 0 && j <= 7 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }

        i = row+1, j = col-1;
        while(i <= 7 && j >= 0 && board[i][j] == "X") {
          points.push([i, j]);
          i++;
          j--;
        }
        if(i <= 7 && j >= 0 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }

        i = row+1, j = col+1;
        while(i <= 7 && j <= 7 && board[i][j] == "X") {
          points.push([i, j]);
          i++;
          j++;
        }
        if(i <= 7 && j <= 7 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }
      }

      if(curSelectedPiece.substr(6) == "Knight") {
        let i = row, j = col;
        if(i <= 5 && j <= 6 && (board[i+2][j+1] == "X" || board[i+2][j+1].substring(0, 5) != "Black")) {
          points.push([i+2, j+1]);
        }
        if(i <= 5 && j >= 1 && (board[i+2][j-1] == "X" || board[i+2][j-1].substring(0, 5) != "Black")) {
          points.push([i+2, j-1]);
        }
        if(i >= 2 && j <= 6 && (board[i-2][j+1] == "X" || board[i-2][j+1].substring(0, 5) != "Black")) {
          points.push([i-2, j+1]);
        }
        if(i >= 2 && j >= 1 && (board[i-2][j-1] == "X" || board[i-2][j-1].substring(0, 5) != "Black")) {
          points.push([i-2, j-1]);
        }

        if(i <= 6 && j <= 5 && (board[i+1][j+2] == "X" || board[i+1][j+2].substring(0, 5) != "Black")) {
          points.push([i+1, j+2]);
        }
        if(i <= 6 && j >= 2 && (board[i+1][j-2] == "X" || board[i+1][j-2].substring(0, 5) != "Black")) {
          points.push([i+1, j-2]);
        }
        if(i >= 1 && j <= 5 && (board[i-1][j+2] == "X" || board[i-1][j+2].substring(0, 5) != "Black")) {
          points.push([i-1, j+2]);
        }
        if(i >= 1 && j >= 2 && (board[i-1][j-2] == "X" || board[i-1][j-2].substring(0, 5) != "Black")) {
          points.push([i-1, j-2]);
        }
      }

      if(curSelectedPiece.substr(6) == "King") {
        let i = row+1, j = col;
        if(i <= 7 && board[i][j].substring(0, 5) != "Black") {
          points.push([i, j]);
        }

        i = row-1, j = col;
        if(i >= 0 && board[i][j].substring(0, 5) != "Black") {
          points.push([i, j]);
        }

        i = row, j = col+1;
        if(j <= 7 && board[i][j].substring(0, 5) != "Black") {
          points.push([i, j]);
        }

        i = row, j = col-1;
        if(j >= 0 && board[i][j].substring(0, 5) != "Black") {
          points.push([i, j]);
        }

        i = row-1, j = col-1;
        if(i >= 0 && j >= 0 && board[i][j].substring(0, 5) != "Black") {
          points.push([i, j]);
        }

        i = row-1, j = col+1;
        if(i >= 0 && j <= 7 && board[i][j].substring(0, 5) != "Black") {
          points.push([i, j]);
        }

        i = row+1, j = col-1;
        if(i <= 7 && j >= 0 && board[i][j].substring(0, 5) != "Black") {
          points.push([i, j]);
        }

        i = row+1, j = col+1;
        if(i <= 7 && j <= 7 && board[i][j].substring(0, 5) != "Black") {
          points.push([i, j]);
        }
      }

      if(curSelectedPiece.substr(6) == "Queen") {
        let i = row+1, j = col;
        while(i <= 7 && board[i][j] == "X") {
          points.push([i, j]);
          i++;
        }
        if(i <= 7 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }

        i = row-1, j = col;
        while(i >= 0 && board[i][j] == "X") {
          points.push([i, j]);
          i--;
        }
        if(i >= 0 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }

        i = row, j = col+1;
        while(j <= 7 && board[i][j] == "X") {
          points.push([i, j]);
          j++;
        }
        if(j <= 7 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }

        i = row, j = col-1;
        while(j >= 0 && board[i][j] == "X") {
          points.push([i, j]);
          j--;
        }
        if(j >= 0 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }

        i = row-1, j = col-1;
        while(i >= 0 && j >= 0 && board[i][j] == "X") {
          points.push([i, j]);
          i--;
          j--;
        }
        if(i >= 0 && j >= 0 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }

        i = row-1, j = col+1;
        while(i >= 0 && j <= 7 && board[i][j] == "X") {
          points.push([i, j]);
          i--;
          j++;
        }
        if(i >= 0 && j <= 7 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }

        i = row+1, j = col-1;
        while(i <= 7 && j >= 0 && board[i][j] == "X") {
          points.push([i, j]);
          i++;
          j--;
        }
        if(i <= 7 && j >= 0 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }

        i = row+1, j = col+1;
        while(i <= 7 && j <= 7 && board[i][j] == "X") {
          points.push([i, j]);
          i++;
          j++;
        }
        if(i <= 7 && j <= 7 && board[i][j] != "X" && board[i][j].substring(0,5) == "White") {
          points.push([i, j]);
        }
      }
    }
    
    if(curSelectedPiece.substr(0, 5) == "White"){

      if(curSelectedPiece.substr(6) == "Pawn"){
        if(col>0 && row <= 6 && (board[row+1][col-1] != "X" && board[row+1][col-1].substring(0,5) != "White")){
          points.push([row+1, col-1]);
        }
        if(col<=6 && row<=6 && (board[row+1][col+1] != "X" && board[row+1][col+1].substring(0,5) != "White")){
          points.push([row+1, col+1]);
        }
        let i = row+1, j = col, count = 0;
        if(i<=7 && board[i][j] == "X"){
          points.push([i, j]);
        }
        i++;
        if(row == 1 && board[i][j] == "X" && board[i-1][j] == "X"){
          points.push([i, j]);
        }
      }

      if(curSelectedPiece.substr(6) == "Rook"){
        let i = row+1, j = col;
        while(i<=7 && board[i][j] == "X"){
          points.push([i, j]);
          i++;
        }
        if(i<=7 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black"){
          points.push([i, j]);
        }

        i = row-1, j = col;
        while(i>=0 && board[i][j] == "X"){
          points.push([i, j]);
          i--;
        }
        if(i>=0 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black"){
          points.push([i, j]);
        }

        i = row, j = col+1;
        while(j<=7 && board[i][j] == "X"){
          points.push([i, j]);
          j++;
        }
        if(j<=7 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black"){
          points.push([i, j]);
        }

        i = row, j = col-1;
        while(j>=0 && board[i][j] == "X"){
          points.push([i, j]);
          j--;
        }
        if(j>=0 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black"){
          points.push([i, j]);
        }
      }

      if(curSelectedPiece.substr(6) == "Bishop"){
        let i = row-1, j = col-1;
        while(i>=0 && j>=0 && board[i][j] == "X"){
          points.push([i, j]);
          i--;
          j--;
        }
        if(i>=0 && j>=0 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black"){
          points.push([i, j]);
        }

        i = row-1, j = col+1;
        while(i>=0 && j<=7 && board[i][j] == "X"){
          points.push([i, j]);
          i--;
          j++;
        }
        if(i>=0 && j<=7 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black"){
          points.push([i, j]);
        }

        i = row+1, j = col-1;
        while(i<=7 && j>=0 && board[i][j] == "X"){
          points.push([i, j]);
          i++;
          j--;
        }
        if(i<=7 && j>=0 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black"){
          points.push([i, j]);
        }

        i = row+1, j = col+1;
        while(i<=7 && j<=7 && board[i][j] == "X"){
          points.push([i, j]);
          i++;
          j++;
        }
        if(i<=7 && j<=7 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black"){
          points.push([i, j]);
        }
      }

      if(curSelectedPiece.substr(6) == "Knight"){
        let i = row, j = col;
        if(i<=5 && j<=6 && (board[i+2][j+1] == "X" || board[i+2][j+1].substring(0, 5) != "White")){
          points.push([i+2, j+1]);
        }
        if(i<=5 && j>=1 && (board[i+2][j-1] == "X" || board[i+2][j-1].substring(0, 5) != "White")){
          points.push([i+2, j-1]);
        }
        if(i>=2 && j<=6 && (board[i-2][j+1] == "X" || board[i-2][j+1].substring(0, 5) != "White")){
          points.push([i-2, j+1]);
        }
        if(i>=2 && j>=1 && (board[i-2][j-1] == "X" || board[i-2][j-1].substring(0, 5) != "White")){
          points.push([i-2, j-1]);
        }

        if(i<=6 && j<=5 && (board[i+1][j+2] == "X" || board[i+1][j+2].substring(0, 5) != "White")){
          points.push([i+1, j+2]);
        }
        if(i<=6 && j>=2 && (board[i+1][j-2] == "X" || board[i+1][j-2].substring(0, 5) != "White")){
          points.push([i+1, j-2]);
        }
        if(i>=1 && j<=5 && (board[i-1][j+2] == "X" || board[i-1][j+2].substring(0, 5) != "White")){
          points.push([i-1, j+2]);
        }
        if(i>=1 && j>=2 && (board[i-1][j-2] == "X" || board[i-1][j-2].substring(0, 5) != "White")){
          points.push([i-1, j-2]);
        }
      }

      if(curSelectedPiece.substr(6) == "King"){
        let i = row+1, j = col;
        if(i<=7 && board[i][j].substring(0, 5) != "White") {
          points.push([i, j]);
        }

        i = row-1, j = col;
        if(i>=0 && board[i][j].substring(0, 5) != "White") {
          points.push([i, j]);
        }

        i = row, j = col+1;
        if(j<=7 && board[i][j].substring(0, 5) != "White") {
          points.push([i, j]);
        }

        i = row, j = col-1;
        if(j>=0 && board[i][j].substring(0, 5) != "White") {
          points.push([i, j]);
        }


        i = row-1, j = col-1;
        if(i>=0 && j>=0 && board[i][j].substring(0, 5) != "White") {
          points.push([i, j]);
        }

        i = row-1, j = col+1;
        if(i>=0 && j<=7 && board[i][j].substring(0, 5) != "White") {
          points.push([i, j]);
        }

        i = row+1, j = col-1;
        if(i<=7 && j>=0 && board[i][j].substring(0, 5) != "White") {
          points.push([i, j]);
        }

        i = row+1, j = col+1;
        if(i<=7 && j<=7 && board[i][j].substring(0, 5) != "White") {
          points.push([i, j]);
        }
      }

      if(curSelectedPiece.substr(6) == "Queen"){
        let i = row+1, j = col;
        while(i<=7 && board[i][j] == "X") {
          points.push([i, j]);
          i++;
        }
        if(i<=7 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black") {
          points.push([i, j]);
        }

        i = row-1, j = col;
        while(i>=0 && board[i][j] == "X") {
          points.push([i, j]);
          i--;
        }
        if(i>=0 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black") {
          points.push([i, j]);
        }

        i = row, j = col+1;
        while(j<=7 && board[i][j] == "X") {
          points.push([i, j]);
          j++;
        }
        if(j<=7 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black") {
          points.push([i, j]);
        }

        i = row, j = col-1;
        while(j>=0 && board[i][j] == "X") {
          points.push([i, j]);
          j--;
        }
        if(j>=0 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black") {
          points.push([i, j]);
        }


        i = row-1, j = col-1;
        while(i>=0 && j>=0 && board[i][j] == "X") {
          points.push([i, j]);
          i--;
          j--;
        }
        if(i>=0 && j>=0 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black") {
          points.push([i, j]);
        }

        i = row-1, j = col+1;
        while(i>=0 && j<=7 && board[i][j] == "X") {
          points.push([i, j]);
          i--;
          j++;
        }
        if(i>=0 && j<=7 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black") {
          points.push([i, j]);
        }

        i = row+1, j = col-1;
        while(i<=7 && j>=0 && board[i][j] == "X") {
          points.push([i, j]);
          i++;
          j--;
        }
        if(i<=7 && j>=0 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black") {
          points.push([i, j]);
        }

        i = row+1, j = col+1;
        while(i<=7 && j<=7 && board[i][j] == "X") {
          points.push([i, j]);
          i++;
          j++;
        }
        if(i<=7 && j<=7 && board[i][j] != "X" && board[i][j].substring(0,5) == "Black") {
          points.push([i, j]);
        }
      }
    }

    return points;
  }

  function getKingPoints(board, color){
    for(let i=0;i<8;i++){
      for(let j=0;j<8;j++){
        if(board[i][j].substring(0, 5) == color && board[i][j].substring(6) == "King"){
          return [i, j];
        }
      }
    }
    return [-1, -1];
  }

  function isCheck(board, color){
    let kingPoints = getKingPoints(board, color);
    let check = false;
    for(let i=0;i<8;i++){
      for(let j=0;j<8;j++){
        if(board[i][j] != "X" && board[i][j].substring(0,5) != color){
          let possibleLandingPoints = getPossibleLandingPoints(board[i][j], [i,j], board);
          if(possibleLandingPoints != null && possibleLandingPoints.some(([r, c]) => r === kingPoints[0] && c === kingPoints[1])){
            check = true;
            break;
          }
        }
      }
      if(check) break;
    }
    return check;
  }

  async function getCheckLandingPoints(board, color){
    let points = [];
    for(let i=0;i<8;i++){
      for(let j=0;j<8;j++){
        if(board[i][j].substring(0, 5) == color){
          let possibleLandingPoints = getPossibleLandingPoints(board[i][j], [i, j], board);
          for(let k=0;k<possibleLandingPoints.length;k++){
            let currentLandingPoints = possibleLandingPoints[k];
            let board3 = await JSON.parse(JSON.stringify(board));
            board3 = await board3.map((r, a) =>
              r.map((cell, b) => {
                if(a === i && b === j) return "X";
                if(a === currentLandingPoints[0] && b === currentLandingPoints[1]) return board[i][j];
                return cell;
              })
            );
            let validateCheck = isCheck(board3, color);
            if(!validateCheck){
              points.push(currentLandingPoints);
            } 
          }
        }
      }
    }
    return points;
  }

  useEffect(() => {
    if(staleMate){
      if(turn == "White"){
        alert("White has no possible moves! StaleMate, Its a draw!");
      }
      else{
        alert("Black has no possible moves! StaleMate, Its a draw!");
      }
      if(wsConnectionRef.current){
        console.log('Sending GAME_OVER message with result: Draw by StaleMate');
        console.log('GameId:', wsConnectionRef.current.gameId);
        wsConnectionRef.current.send({
          type: 'GAME_OVER',
          result: 'Draw by StaleMate',
          initiatedBy: playerColor
        });
        console.log('GAME_OVER message sent');
      }
      else{
        console.log('WebSocket not available, cannot send GAME_OVER');
      }
      setTimeout(() => {
        navigate('/');
      }, 5000);
    }
  }, [staleMate, wsConnectionRef, playerColor, navigate])

  useEffect(() => {
    if(checkMate){
      const winner = turn == "White" ? "White" : "Black";
      const message = turn == "White" ? "CheckMate! White Wins!" : "CheckMate! Black Wins!";
      alert(message);
      
      // Send GAME_OVER message to opponent and server
      if (wsConnectionRef.current) {
        console.log('Sending GAME_OVER message with result:', winner + ' Wins by CheckMate');
        console.log('GameId:', wsConnectionRef.current.gameId);
        wsConnectionRef.current.send({
          type: 'GAME_OVER',
          result: winner + ' Wins by CheckMate',
          initiatedBy: playerColor
        });
        console.log('GAME_OVER message sent');
      } else {
        console.log('WebSocket not available, cannot send GAME_OVER');
      }
      setTimeout(() => {
        navigate('/');
      }, 5000);
    }
  },[checkMate, turn, wsConnectionRef, playerColor, navigate])

  useEffect(() => {
    setCheck1((prev) => isCheck(board, turn == "White"?"Black":"White"));
    if(isCheck(board, turn == "White"?"Black":"White")){
      alert("Check to " + (turn == "White"?"Black":"White"));
    }
    if(isCheck(board, turn == "White"?"Black":"White")){
      (async () => {
      const points = await getCheckLandingPoints(board, turn == "White" ? "Black" : "White");
      setCheckLandingPoints(points);
    })();
    }
    
    // Track king and rook movements ONLY when they are directly selected and moved
    // Do NOT track during castling (castling handles its own tracking)
    if(selectedPiece && selectionPoints && landingPoints){
      if(selectedPiece == "White King"){
        setWhiteKingMoved(true);
      }
      if(selectedPiece == "Black King"){
        setBlackKingMoved(true);
      }
      // Track rook movements ONLY if rook is directly selected and moved (not during castling)
      if(selectedPiece == "White Rook" && selectionPoints){
        // Left rook (a1) - but only if it actually moved
        if(selectionPoints[0] === 0 && selectionPoints[1] === 0){
          setWhiteLeftRookMoved(true);
        }
        // Right rook (h1) - but only if it actually moved
        else if(selectionPoints[0] === 0 && selectionPoints[1] === 7){
          setWhiteRightRookMoved(true);
        }
      }
      if(selectedPiece == "Black Rook" && selectionPoints){
        // Left rook (a8) - but only if it actually moved
        if(selectionPoints[0] === 7 && selectionPoints[1] === 0){
          setBlackLeftRookMoved(true);
        }
        // Right rook (h8) - but only if it actually moved
        else if(selectionPoints[0] === 7 && selectionPoints[1] === 7){
          setBlackRightRookMoved(true);
        }
      }
    }
    
    setPrevSelectedPiece(selectedPiece);
    if(selectionPoints != null && landingPoints != null){
      setPrevSteps(Math.abs(selectionPoints[0]-landingPoints[0]) + Math.abs(selectionPoints[1]-landingPoints[1]));
    }
    console.log(getAllPossibleMoves(board, turn == "White"?"Black":"White", prevLandingPoints, specialLandingPoints));
    if(getAllPossibleMoves(board, turn == "White"?"Black":"White", prevLandingPoints, specialLandingPoints).length == 0){
      if(isCheck(board, turn == "White"?"Black":"White")){
        setCheckMate((prev) => true);
      }
      else{
        setStaleMate((prev) => true);
      }
    }
    setPrevLandingPoints(landingPoints);
    
    // Track which color made this move (the current player)
    if (selectionPoints && landingPoints) {
      setLastMovedColor(playerColor);
    }
    
    // Send move to opponent via WebSocket BEFORE clearing state
    if (wsConnectionRef.current && selectionPoints && landingPoints) {
      console.log('Sending move:', { from: selectionPoints, to: landingPoints });
      sendMove(
        { from: selectionPoints, to: landingPoints },
        board
      );
    }
    
    setSelectedPiece((prev) => null);
    setSelectionPoints(null);
    setLandingPoints(null);
    setPossibleLandingPoints(null);
    setSpecialLandingPoints(null);
    // Don't flip turn here - wait for opponent's move message to update it
  }, [board])

  async function handleBoardClick(e){
    e.preventDefault();
    const row = parseInt(e.currentTarget.parentElement.className.match(/row-(\d+)/)[1], 10) - 1;
    const col = parseInt(e.currentTarget.className.match(/col-(\d+)/)[1], 10) - 1;
    
    // Helper function to validate castling move
    const validateCastling = (board, color, kingRow, kingCol, rookRow, rookCol) => {
      // Check if rook is in the expected position
      if (board[rookRow][rookCol] !== `${color} Rook`) {
        return false;
      }

      // Determine which side (left/right)
      const isLeftSide = rookCol === 0;
      
      // Check rook movement using BOTH board state AND persistent flags
      const rook_has_moved_flag = 
        (color === "White" && isLeftSide && whiteLeftRookMoved) ||
        (color === "White" && !isLeftSide && whiteRightRookMoved) ||
        (color === "Black" && isLeftSide && blackLeftRookMoved) ||
        (color === "Black" && !isLeftSide && blackRightRookMoved);

      const rook_at_starting_position = 
        (color === "White" && isLeftSide && board[0][0] === "White Rook") ||
        (color === "White" && !isLeftSide && board[0][7] === "White Rook") ||
        (color === "Black" && isLeftSide && board[7][0] === "Black Rook") ||
        (color === "Black" && !isLeftSide && board[7][7] === "Black Rook");

      // Check if king has moved from original position by examining board
      const king_at_starting_position = 
        (color === "White" && board[0][4] === "White King") ||
        (color === "Black" && board[7][4] === "Black King");

      // If rook has moved (via persistent flag OR not at starting position), castling is not allowed
      if (rook_has_moved_flag || !rook_at_starting_position || !king_at_starting_position) {
        return false;
      }

      // Check if king is in check
      if (isCheck(board, color)) {
        return false;
      }

      // Check if path is clear between king and rook
      const minCol = Math.min(kingCol, rookCol);
      const maxCol = Math.max(kingCol, rookCol);
      for (let c = minCol + 1; c < maxCol; c++) {
        if (board[kingRow][c] !== "X") {
          return false;
        }
      }

      // Determine landing position
      const landingCol = isLeftSide ? 2 : 6;
      const rookLandingCol = isLeftSide ? 3 : 5;

      // Create a temporary board with king in landing position
      const tempBoard = board.map((r, i) =>
        r.map((cell, j) => {
          if (i === kingRow && j === kingCol) return "X";
          if (i === kingRow && j === landingCol) return `${color} King`;
          return cell;
        })
      );

      // Check if king passes through check when moving to castle position
      if (isCheck(tempBoard, color)) {
        return false;
      }

      // All validations passed
      return { kingMove: [kingRow, landingCol], rookMove: [rookRow, rookLandingCol] };
    };

    // Handle castling move
    if (selectedPiece && selectedPiece.substring(6) === "King" && board[row][col].substring(0, 5) === selectedPiece.substring(0, 5) && board[row][col].substring(6) === "Rook") {
      const color = selectedPiece.substring(0, 5);
      // kingRow should be the row where the king is (from selectionPoints)
      const kingRow = selectionPoints[0];
      const kingCol = selectionPoints[1];
      const rookRow = row;
      const rookCol = col;
      
      const castlingResult = validateCastling(board, color, kingRow, kingCol, rookRow, rookCol);
      
      if (castlingResult) {
        const [newKingRow, newKingCol] = castlingResult.kingMove;
        const [newRookRow, newRookCol] = castlingResult.rookMove;

        const newBoard = board.map((r, i) =>
          r.map((cell, j) => {
            if (i === kingRow && j === kingCol) return "X"; // Clear king position
            if (i === rookRow && j === rookCol) return "X"; // Clear rook position
            if (i === newKingRow && j === newKingCol) return `${color} King`;
            if (i === newRookRow && j === newRookCol) return `${color} Rook`;
            return cell;
          })
        );

        setBoard(newBoard);

        // Update rook and king move tracking for castling
        if (color === "White") {
          if (rookCol === 0) setWhiteLeftRookMoved(true);
          else setWhiteRightRookMoved(true);
          setWhiteKingMoved(true);
        } else {
          if (rookCol === 0) setBlackLeftRookMoved(true);
          else setBlackRightRookMoved(true);
          setBlackKingMoved(true);
        }

        setSelectedPiece(null);
        setSelectionPoints(null);
        return; // Exit early after castling
      } else {
        // Castling is not valid, clear selection and alert user
        alert("Castling is not allowed. King or Rook has already moved, or path is blocked. Or King is in check.");
        setSelectedPiece(null);
        setSelectionPoints(null);
        return; // Prevent normal move logic from executing
      }
    }
    
    else if(board[row][col] != "X"){
      const pieceColor = board[row][col].substring(0, 5);
      console.log('Clicked piece:', board[row][col], 'PieceColor:', pieceColor, 'Turn:', turn, 'PlayerColor:', playerColor, 'SelectedPiece:', selectedPiece);
      
      // Check if player is trying to move same color twice in a row
      if (lastMovedColor === pieceColor && lastMovedColor === playerColor) {
        console.log('Cannot move same color twice in a row. Last moved:', lastMovedColor, 'Trying to move:', pieceColor);
        alert("You cannot move the same color twice in a row!");
        return;
      }
      
      // Only prevent selecting opponent's pieces if no piece is selected yet
      // If a piece is already selected, allow clicking on opponent pieces (for capturing)
      const canSelectOwnPiece = (!selectedPiece && turn == pieceColor && playerColor == pieceColor) || (selectedPiece != null && turn == pieceColor && playerColor == pieceColor);
      const isOpponentPiece = pieceColor !== playerColor;
      
      console.log('Can select this piece?', canSelectOwnPiece, 'Is opponent piece?', isOpponentPiece);
      
      if(canSelectOwnPiece && !isOpponentPiece){
        // Selecting own piece
        setSelectedPiece(board[row][col]);
        setSelectionPoints([row, col]);
        possibleLandingPoints = setPossibleLandingPoints(getPossibleLandingPoints(board[row][col], [row, col], board));
        if(prevSelectedPiece != null && prevSelectedPiece.substring(6) == "Pawn" && prevSteps == 2 && board[row][col].substring(6) == "Pawn"){
          setSpecialLandingPoints(getSpecialLandingPoints(board[row][col], [row, col], prevLandingPoints));
        }
      }
    }

    // Handle landing point selection (including capturing opponent pieces)
    if(selectedPiece != null && check1){
      let currentLandingPoints = [row, col];
      if (possibleLandingPoints.some(([r, c]) => r === currentLandingPoints[0] && c === currentLandingPoints[1]) && 
          checkLandingPoints != null &&
          checkLandingPoints.some(([r, c]) => r === currentLandingPoints[0] && c === currentLandingPoints[1])) {
        setLandingPoints(currentLandingPoints);
        let board3 = await JSON.parse(JSON.stringify(board));
        board3 = board3.map((r, i) =>
          r.map((cell, j) => {
            if (i === selectionPoints[0] && j === selectionPoints[1]) return "X";
            if (i === currentLandingPoints[0] && j === currentLandingPoints[1]) return selectedPiece;
            return cell;
          })
        );
        let validateCheck = isCheck(board3, turn);
        if(!validateCheck){
          if((selectedPiece == "White Pawn" && currentLandingPoints[0] == 7) || (selectedPiece == "Black Pawn" && currentLandingPoints[0] == 0)){
            if(currentLandingPoints[0] == 7)
              document.getElementsByClassName("WhitePieces")[0].style.display = "block";
            else
              document.getElementsByClassName("BlackPieces")[0].style.display = "block";
            setCheck1((prev) => false);
          }
          else{
              setBoard((board) => {
              const newBoard = board.map((r, i) =>
                r.map((cell, j) => {
                  if (i === selectionPoints[0] && j === selectionPoints[1]) return "X";
                  if (i === currentLandingPoints[0] && j === currentLandingPoints[1]) return selectedPiece;
                  return cell;
                })
              );
              return newBoard;
            });
            setCheck1((prev) => false);
          }
        }
        
      }
    

      if(specialLandingPoints != null && 
        specialLandingPoints.some(([r, c]) => r === currentLandingPoints[0] && c === currentLandingPoints[1]) && 
        checkLandingPoints.some(([r, c]) => r === currentLandingPoints[0] && c === currentLandingPoints[1])){
        setLandingPoints(currentLandingPoints);
        let board3 = await JSON.parse(JSON.stringify(board));
        board3 = board3.map((r, i) =>
          r.map((cell, j) => {
            if(i === selectionPoints[0] && j === selectionPoints[1]) return "X";
            if(i === prevLandingPoints[0] && j === prevLandingPoints[1]) return "X";
            if(i === currentLandingPoints[0] && j === currentLandingPoints[1]) return selectedPiece;
            return cell;
          })
        );
        let validateCheck = isCheck(board3, turn);
        if(!validateCheck){
          setBoard((board) => {
            const newBoard = board.map((r, i) =>
              r.map((cell, j) => {
                if(i === selectionPoints[0] && j === selectionPoints[1]) return "X";
                if(i === prevLandingPoints[0] && j === prevLandingPoints[1]) return "X";
                if(i === currentLandingPoints[0] && j === currentLandingPoints[1]) return selectedPiece;
                return cell;
              })
            );
            return newBoard;
          })
          setCheck1((prev) => false);
        }
      }
    }

    if(selectedPiece != null){
      let currentLandingPoints = [row, col];
      if (possibleLandingPoints.some(([r, c]) => r === currentLandingPoints[0] && c === currentLandingPoints[1])) {
        setLandingPoints(currentLandingPoints);
        let board3 = await JSON.parse(JSON.stringify(board));
        board3 = board3.map((r, i) =>
          r.map((cell, j) => {
            if (i === selectionPoints[0] && j === selectionPoints[1]) return "X";
            if (i === currentLandingPoints[0] && j === currentLandingPoints[1]) return selectedPiece;
            return cell;
          })
        );
        let validateCheck = isCheck(board3, turn);
        if(!validateCheck){
          if((selectedPiece == "White Pawn" && currentLandingPoints[0] == 7) || (selectedPiece == "Black Pawn" && currentLandingPoints[0] == 0)){
            if(currentLandingPoints[0] == 7)
              document.getElementsByClassName("WhitePieces")[0].style.display = "block";
            else
              document.getElementsByClassName("BlackPieces")[0].style.display = "block";
          }
          else{
              setBoard((board) => {
              const newBoard = board.map((r, i) =>
                r.map((cell, j) => {
                  if (i === selectionPoints[0] && j === selectionPoints[1]) return "X";
                  if (i === currentLandingPoints[0] && j === currentLandingPoints[1]) return selectedPiece;
                  return cell;
                })
              );
              return newBoard;
            });
          }
        }
      }
    

      if(specialLandingPoints != null && specialLandingPoints.some(([r, c]) => r === currentLandingPoints[0] && c === currentLandingPoints[1])){
        setLandingPoints(currentLandingPoints);
        let board3 = await JSON.parse(JSON.stringify(board));
        board3 = board3.map((r, i) =>
          r.map((cell, j) => {
            if(i === selectionPoints[0] && j === selectionPoints[1]) return "X";
            if(i === prevLandingPoints[0] && j === prevLandingPoints[1]) return "X";
            if(i === currentLandingPoints[0] && j === currentLandingPoints[1]) return selectedPiece;
            return cell;
          })
        );
        let validateCheck = isCheck(board3, turn);
        if(!validateCheck){
          setBoard((board) => {
            const newBoard = board.map((r, i) =>
              r.map((cell, j) => {
                if(i === selectionPoints[0] && j === selectionPoints[1]) return "X";
                if(i === prevLandingPoints[0] && j === prevLandingPoints[1]) return "X";
                if(i === currentLandingPoints[0] && j === currentLandingPoints[1]) return selectedPiece;
                return cell;
              })
            );
            return newBoard;
          })
        }
      }
    }
  }

  function handleWhitePiece(){
    let selectedWhitePiece = document.querySelector('input[name="white_piece"]:checked');
    if(selectedWhitePiece){
      let piece = selectedWhitePiece.value;
      setBoard((board) => {
        return board.map((row, i) =>
          row.map((cell, j) => {
            if(i === landingPoints[0] && j === landingPoints[1]) return piece;
            if(i === selectionPoints[0] && j === selectionPoints[1]) return "X";
            return cell;
          })
        );
      });
      document.getElementsByClassName("WhitePieces")[0].style.display = "none";
    }
    else{
      alert("Please select a piece to replace the white pawn");
    }
  }

  function handleBlackPiece(){
    let selectedBlackPiece = document.querySelector('input[name="black_piece"]:checked');
    if(selectedBlackPiece){
      let piece = selectedBlackPiece.value;
      setBoard((board) => {
        return board.map((row, i) =>
          row.map((cell, j) => {
            if(i === landingPoints[0] && j === landingPoints[1]) return piece;
            if(i === selectionPoints[0] && j === selectionPoints[1]) return "X";
            return cell;
          })
        );
      });
      document.getElementsByClassName("BlackPieces")[0].style.display = "none";
    }
    else{
      alert("Please select a piece to replace the black pawn");
    }
  }

  return (
    <>
      <div className='navbar'>
        <p className='heading'>Chess</p>
      </div>
      <div className='player-info'>
        <p>You are playing as: <span className='player-color'>{playerColor}</span></p>
      </div>
      <div className='WhitePieces'>
        <div className="whiteoverlay"></div>
        <div className='whitepieces'>
          <p>Select the new white piece</p>
          <div>
            <span>White Queen</span>
            <input type="radio" name="white_piece" value={"White Queen"}/>
          </div>
          <div>
            <span>White Rook</span>
            <input type="radio" name="white_piece" value={"White Rook"}/>
          </div>
          <div>
            <span>White Bishop</span>
            <input type="radio" name="white_piece" value={"White Bishop"}/>
          </div>
          <div>
            <span>White Knight</span>
            <input type="radio" name="white_piece" value={"White Knight"}/>
          </div>
          <div>
            <span>White Pawn</span>
            <input type="radio" name="white_piece" value={"White Pawn"}/>
          </div>
          <button type="button" onClick={() => handleWhitePiece()}>Submit</button>
        </div>
        
      </div>
      <div className='BlackPieces'>
        <div className="blackoverlay"></div>
        <div className='blackpieces'> 
          <p>Select the new black piece</p>
          <div>
            <span>Black Queen</span>
            <input type="radio" name="black_piece" value={"Black Queen"}/>
          </div>
          <div>
            <span>Black Rook</span>
            <input type="radio" name="black_piece" value={"Black Rook"}/>
          </div>
          <div>
            <span>Black Bishop</span>
            <input type="radio" name="black_piece" value={"Black Bishop"}/>
          </div>
          <div>
            <span>Black Knight</span>
            <input type="radio" name="black_piece" value={"Black Knight"}/>
          </div>
          <div>
            <span>Black Pawn</span>
            <input type="radio" name="black_piece" value={"Black Pawn"}/>
          </div>
          <button type="button" onClick={() => handleBlackPiece()}>Submit</button>
        </div>
      </div>

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
                    onClick={(e) => handleBoardClick(e)}
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
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/game/:gameId" element={<GamePage />} />
    </Routes>
  );
}
