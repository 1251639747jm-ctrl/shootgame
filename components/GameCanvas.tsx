import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { GameEngine } from '../game/GameEngine';
import { GameState, GameRef, WeaponType, GameSettings } from '../types';

interface GameCanvasProps {
  gameState: GameState;
  onScoreChange: (score: number) => void;
  onHealthChange: (health: number) => void;
  onGameOver: (score: number) => void;
  onWeaponChange: (weapon: WeaponType) => void;
}

export const GameCanvas = forwardRef<GameRef, GameCanvasProps>(({ 
  gameState, 
  onScoreChange, 
  onHealthChange,
  onGameOver,
  onWeaponChange
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useImperativeHandle(ref, () => ({
    switchWeapon: () => {
      if (engineRef.current) {
        engineRef.current.triggerWeaponSwitch();
      }
    },
    triggerSkill: (index: number) => {
        if (engineRef.current) {
            engineRef.current.triggerSkill(index);
        }
    },
    getPlayerState: () => {
        return engineRef.current ? engineRef.current.getPlayerState() : null;
    },
    updateSettings: (settings: GameSettings) => {
        if (engineRef.current) {
            engineRef.current.updateSettings(settings);
        }
    }
  }));

  useEffect(() => {
    if (!canvasRef.current) return;

    engineRef.current = new GameEngine(
      canvasRef.current,
      onScoreChange,
      onHealthChange,
      onGameOver,
      onWeaponChange
    );

    const handleResize = () => {
      if (canvasRef.current && engineRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        engineRef.current.resize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!engineRef.current) return;

    if (gameState === GameState.PLAYING && engineRef.current.state !== GameState.PLAYING) {
      engineRef.current.start();
    }
  }, [gameState]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute top-0 left-0 w-full h-full block touch-none"
    />
  );
});