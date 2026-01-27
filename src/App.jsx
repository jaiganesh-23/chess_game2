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
  let [prevSelectedPiece, setPrevSelectedPiece] = useState(null);
  let [prevSteps, setPrevSteps] = useState(null);
  let [specialLandingPoints, setSpecialLandingPoints] = useState(null);
  let [prevLandingPoints, setPrevLandingPoints] = useState([-1, -1]);
  let [check1, setCheck1] = useState(false);
  let [checkLandingPoints, setCheckLandingPoints] = useState(null);
  let [checkMate, setCheckMate] = useState(false);
  let [staleMate, setStaleMate] = useState(false);

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
      console.log('Board and turn updated. New turn:', newTurn);
    }
    if (message.gameState) {
      // Update game state from opponent's move
      setWhiteKingMoved(message.gameState.whiteKingMoved);
      setBlackKingMoved(message.gameState.blackKingMoved);
      setPrevLandingPoints(message.gameState.prevLandingPoints);
    }
  }, []);

  const handleBoardSync = useCallback((message) => {
    console.log('Board sync:', message);
    setBoard(message.board.map(row => [...row]));
    setTurn(message.turn);
  }, []);

  const handleOpponentDisconnect = useCallback(() => {
    alert('Opponent disconnected. Returning to landing page...');
    navigate('/');
  }, [navigate]);

  const handleGameOver = useCallback((message) => {
    console.log('Received GAME_OVER message:', message);
    alert(`Game Over! Result: ${message.result}`);
    navigate('/');
  }, [navigate]);

  const handleError = useCallback((error) => {
    console.error('WebSocket error:', error);
    alert('Connection error. Please return to landing page.');
    navigate('/');
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

  // Send move to opponent
  const sendMove = (moveData, boardState) => {
    if (wsConnectionRef.current) {
      console.log('sendMove called with gameId:', wsConnectionRef.current.gameId);
      console.log('Move data:', moveData);
      console.log('Sending board:', boardState);
      wsConnectionRef.current.sendMove(moveData, boardState, {
        board: boardState,
        whiteKingMoved,
        blackKingMoved,
        prevLandingPoints,
        turn
      });
    } else {
      console.warn('WebSocket connection not ready');
    }
  };

  // Sync board with opponent
  const syncBoardWithOpponent = () => {
    if (wsConnectionRef.current) {
      wsConnectionRef.current.syncBoard(board, turn);
    }
  };

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
        if(i<=7 && board[i][j].substring(0, 5) != "White"){
          points.push([i, j]);
        }

        i = row-1, j = col;
        if(i>=0 && board[i][j].substring(0, 5) != "White"){
          points.push([i, j]);
        }

        i = row, j = col+1;
        if(j<=7 && board[i][j].substring(0, 5) != "White"){
          points.push([i, j]);
        }

        i = row, j = col-1;
        if(j>=0 && board[i][j].substring(0, 5) != "White"){
          points.push([i, j]);
        }


        i = row-1, j = col-1;
        if(i>=0 && j>=0 && board[i][j].substring(0, 5) != "White"){
          points.push([i, j]);
        }

        i = row-1, j = col+1;
        if(i>=0 && j<=7 && board[i][j].substring(0, 5) != "White"){
          points.push([i, j]);
        }

        i = row+1, j = col-1;
        if(i<=7 && j>=0 && board[i][j].substring(0, 5) != "White"){
          points.push([i, j]);
        }

        i = row+1, j = col+1;
        if(i<=7 && j<=7 && board[i][j].substring(0, 5) != "White"){
          points.push([i, j]);
        }
      }

      if(curSelectedPiece.substr(6) == "Queen"){
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


        i = row-1, j = col-1;
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
    }
  }, [staleMate])

  useEffect(() => {
    if(checkMate){
      const winner = turn == "White" ? "Black" : "White";
      const message = turn == "White" ? "CheckMate Black Wins!" : "CheckMate White Wins!";
      alert(message);
      
      // Send GAME_OVER message to opponent and server
      if (wsConnectionRef.current) {
        console.log('Sending GAME_OVER message with result:', winner + ' Wins by CheckMate');
        console.log('GameId:', wsConnectionRef.current.gameId);
        wsConnectionRef.current.send({
          type: 'GAME_OVER',
          result: winner + ' Wins by CheckMate'
        });
        console.log('GAME_OVER message sent');
      } else {
        console.log('WebSocket not available, cannot send GAME_OVER');
      }
    }
  },[checkMate, turn, wsConnectionRef])

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
    if(selectedPiece == "White King"){
      setWhiteKingMoved((prev) => true);
    }
    if(selectedPiece == "Black King"){
      setBlackKingMoved((prev) => true);
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
    
    if(selectedPiece != null && selectedPiece.substring(6) == "King" && board[row][col].substring(0,5) == selectedPiece.substring(0,5) && board[row][col].substring(6) == "Rook"){
      let color = selectedPiece.substring(0,5);
      if(color == "White" && !whiteKingMoved){
        let rookLandingPoints = getPossibleLandingPoints("White Rook", [row, col], board);
        if(row == 0 && col == 0){
          if(rookLandingPoints.some(([r,c]) => r === 0 && c === 3)){
            setBoard((board) => {
              const newBoard = board.map((r, i) => 
                r.map((cell, j) => {
                    if(i == 0 && j == 0) return "X";
                    if(i == 0 && j == 2) return "White King";
                    if(i == 0 && j == 3) return "White Rook";
                    if(i == 0 && j == 4) return "X";
                    return cell;
                  })
                )
              return newBoard;
            })
          }
        }
        else if(row == 0 && col == 7){
          if(rookLandingPoints.some(([r,c]) => r === 0 && c === 5)){
            setBoard((board) => {
              const newBoard = board.map((r, i) => 
                r.map((cell, j) => {
                    if(i == 0 && j == 7) return "X";
                    if(i == 0 && j == 6) return "White King";
                    if(i == 0 && j == 5) return "White Rook";
                    if(i == 0 && j == 4) return "X";
                    return cell;
                  })
                )
              return newBoard;
            })
          }
        }
      }
      else if(color == "Black" && !blackKingMoved){
        let rookLandingPoints = getPossibleLandingPoints("Black Rook", [row, col], board);
        if(row == 7 && col == 0){
          if(rookLandingPoints.some(([r,c]) => r === 7 && c === 3)){
            setBoard((board) => {
              const newBoard = board.map((r, i) => 
                r.map((cell, j) => {
                    if(i == 7 && j == 0) return "X";
                    if(i == 7 && j == 2) return "Black King";
                    if(i == 7 && j == 3) return "Black Rook";
                    if(i == 7 && j == 4) return "X";
                    return cell;
                  })
                )
              return newBoard;
            })
          }
        }
        else if(row == 7 && col == 7){
          if(rookLandingPoints.some(([r,c]) => r === 7 && c === 5)){
            setBoard((board) => {
              const newBoard = board.map((r, i) => 
                r.map((cell, j) => {
                    if(i == 7 && j == 7) return "X";
                    if(i == 7 && j == 6) return "Black King";
                    if(i == 7 && j == 5) return "Black Rook";
                    if(i == 7 && j == 4) return "X";
                    return cell;
                  })
                )
              return newBoard;
            })
          }
        }
      }
    }
    else if(board[row][col] != "X"){
      const pieceColor = board[row][col].substring(0, 5);
      console.log('Clicked piece:', board[row][col], 'PieceColor:', pieceColor, 'Turn:', turn, 'PlayerColor:', playerColor, 'SelectedPiece:', selectedPiece);
      
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
