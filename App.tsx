import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, PlayerState, FallingObject } from './types';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  PAUSE_COMBO_TIMEOUT,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  PLAYER_Y_POSITION,
  PLAYER_SPEED,
  OBJECT_SIZE,
  OBJECT_SPEED,
  OBJECT_SPAWN_INTERVAL,
} from './constants';

// --- Helper Components ---

const Player: React.FC<{ player: PlayerState }> = ({ player }) => (
  <div
    className="absolute bg-cyan-400 rounded"
    style={{
      left: player.x,
      top: PLAYER_Y_POSITION,
      width: player.width,
      height: player.height,
    }}
  />
);

const Obstacle: React.FC<{ obstacle: FallingObject }> = ({ obstacle }) => (
  <div
    className="absolute bg-red-500 rounded-md"
    style={{
      left: obstacle.x,
      top: obstacle.y,
      width: obstacle.size,
      height: obstacle.size,
    }}
  />
);

interface OverlayProps {
  title: string;
  buttonText: string;
  onButtonClick: () => void;
  score?: number;
}
const GameOverlay: React.FC<OverlayProps> = ({ title, buttonText, onButtonClick, score }) => (
  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col justify-center items-center text-white z-10">
    <h1 className="text-6xl font-bold mb-2 drop-shadow-lg">{title}</h1>
    {score !== undefined && (
      <p className="text-2xl mb-4">Your Score: {score}</p>
    )}
    <button
      onClick={onButtonClick}
      className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xl font-semibold shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75"
    >
      {buttonText}
    </button>
  </div>
);

interface PauseComboProgressBarProps {
  progress: number;
}
const PauseComboProgressBar: React.FC<PauseComboProgressBarProps> = ({ progress }) => {
  if (progress <= 0) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-1/3 h-2 bg-slate-600 rounded-full overflow-hidden z-20 shadow">
      <div
        className="h-full bg-cyan-400 transition-all duration-100 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.Ready);
  const [player, setPlayer] = useState<PlayerState>({ x: GAME_WIDTH / 2 - PLAYER_WIDTH / 2, width: PLAYER_WIDTH, height: PLAYER_HEIGHT });
  const [objects, setObjects] = useState<FallingObject[]>([]);
  const [score, setScore] = useState(0);
  const [pauseComboProgress, setPauseComboProgress] = useState(0);

  const keysPressed = useRef<Set<string>>(new Set());
  const lastObjectSpawn = useRef<number>(0);
  const gameLoopRef = useRef<number>();
  const lastComboPressTime = useRef<number>(0);
  const comboStartTimeRef = useRef<number>(0);
  const comboAnimationRef = useRef<number>();

  const resetGame = () => {
    setPlayer({ x: GAME_WIDTH / 2 - PLAYER_WIDTH / 2, width: PLAYER_WIDTH, height: PLAYER_HEIGHT });
    setObjects([]);
    setScore(0);
    keysPressed.current.clear();
    setGameState(GameState.Active);
  };
  
  const cleanupCombo = useCallback(() => {
    lastComboPressTime.current = 0;
    if (comboAnimationRef.current) {
      cancelAnimationFrame(comboAnimationRef.current);
    }
    setPauseComboProgress(0);
  }, []);

  const resumeGame = useCallback(() => {
    if (gameState === GameState.Paused) {
      keysPressed.current.clear();
      cleanupCombo();
      setGameState(GameState.Active);
    }
  }, [gameState, cleanupCombo]);

  const animateComboBar = useCallback(() => {
    const now = Date.now();
    const elapsed = now - comboStartTimeRef.current;
    const progress = Math.max(0, 50 * (1 - elapsed / PAUSE_COMBO_TIMEOUT));

    setPauseComboProgress(progress);

    if (progress > 0) {
      comboAnimationRef.current = requestAnimationFrame(animateComboBar);
    } else {
      lastComboPressTime.current = 0; // Combo timed out
    }
  }, []);
  
  const handlePauseCombo = useCallback(() => {
    // Prevent pausing unless game is active or already paused
    if (gameState !== GameState.Active && gameState !== GameState.Paused) return;

    const now = Date.now();
    if (now - lastComboPressTime.current < PAUSE_COMBO_TIMEOUT) {
      // Double press detected
      if (gameState === GameState.Active) {
        setGameState(GameState.Paused);
      } else if (gameState === GameState.Paused) {
        setGameState(GameState.Active);
      }
      cleanupCombo();
    } else {
      // First press of a potential combo
      lastComboPressTime.current = now;
      comboStartTimeRef.current = now;
      if (comboAnimationRef.current) {
        cancelAnimationFrame(comboAnimationRef.current);
      }
      comboAnimationRef.current = requestAnimationFrame(animateComboBar);
    }
  }, [gameState, animateComboBar, cleanupCombo]);
  
  // Game Loop
  const gameLoop = useCallback(() => {
    if (gameState !== GameState.Active) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    // Player movement
    setPlayer(p => {
      let newX = p.x;
      if (keysPressed.current.has('ArrowLeft')) newX -= PLAYER_SPEED;
      if (keysPressed.current.has('ArrowRight')) newX += PLAYER_SPEED;
      newX = Math.max(0, Math.min(GAME_WIDTH - PLAYER_WIDTH, newX));
      return { ...p, x: newX };
    });

    // Object movement and spawning
    const now = Date.now();
    if (now - lastObjectSpawn.current > OBJECT_SPAWN_INTERVAL) {
      lastObjectSpawn.current = now;
      const newObject: FallingObject = {
        id: now,
        x: Math.random() * (GAME_WIDTH - OBJECT_SIZE),
        y: -OBJECT_SIZE,
        size: OBJECT_SIZE,
      };
      setObjects(o => [...o, newObject]);
    }

    setObjects(prevObjects => {
      const updatedObjects = prevObjects
        .map(obj => ({ ...obj, y: obj.y + OBJECT_SPEED }))
        .filter(obj => obj.y < GAME_HEIGHT);
        
      // Collision detection
      for (const obj of updatedObjects) {
        if (
          obj.y + obj.size > PLAYER_Y_POSITION &&
          obj.y < PLAYER_Y_POSITION + PLAYER_HEIGHT &&
          obj.x + obj.size > player.x &&
          obj.x < player.x + PLAYER_WIDTH
        ) {
          setGameState(GameState.GameOver);
        }
      }
      return updatedObjects;
    });

    setScore(s => s + 1);

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, player.x]);

  // Start/Stop game loop
  useEffect(() => {
    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameLoop]);

  // Keyboard input handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      keysPressed.current.add(e.key);

      if (keysPressed.current.has('ArrowLeft') && keysPressed.current.has('ArrowRight')) {
        handlePauseCombo();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (comboAnimationRef.current) cancelAnimationFrame(comboAnimationRef.current);
    };
  }, [handlePauseCombo]);

  const renderContent = () => {
    switch (gameState) {
      case GameState.Ready:
        return <GameOverlay title="Arrow Combo Game" buttonText="Start Game" onButtonClick={resetGame} />;
      case GameState.GameOver:
        return <GameOverlay title="Game Over" buttonText="Restart" onButtonClick={resetGame} score={score} />;
      case GameState.Paused:
        return <GameOverlay title="Paused" buttonText="Resume" onButtonClick={resumeGame} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-slate-100 font-sans">
      <div
        className="relative bg-slate-800 rounded-lg shadow-2xl overflow-hidden border-4 border-slate-700"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      >
        {renderContent()}
        <PauseComboProgressBar progress={pauseComboProgress} />
        
        {/* Score Display */}
        <div className="absolute top-4 right-4 text-2xl font-bold text-white z-5">
            Score: {score}
        </div>
        
        <Player player={player} />
        {objects.map(obj => <Obstacle key={obj.id} obstacle={obj} />)}
      </div>
       <p className="text-slate-400 mt-4">Use Left/Right arrows to move. Press Left+Right twice to pause/resume.</p>
    </div>
  );
};

export default App;
