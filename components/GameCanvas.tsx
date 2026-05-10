import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { GameEngine } from '../game/GameEngine';
import { GameState, GameRef, WeaponType, GameSettings, BotKind } from '../types';

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
    switchWeapon: () => engineRef.current?.triggerWeaponSwitch(),
    triggerSkill: (index: number) => engineRef.current?.triggerSkill(index),
    getPlayerState: () => engineRef.current ? engineRef.current.getPlayerState() : null,
    updateSettings: (settings: GameSettings) => engineRef.current?.updateSettings(settings),
    markUITouch: (id: number) => engineRef.current?.input.markUITouch(id),
    unmarkUITouch: (id: number) => engineRef.current?.input.unmarkUITouch(id),
    getJoystickState: () => engineRef.current
      ? engineRef.current.input.getJoystickState()
      : { active: false, base: { x: 0, y: 0 }, knob: { x: 0, y: 0 } },
    startPractice: () => engineRef.current?.startPractice(),
    stopPractice: () => engineRef.current?.stopPractice(),
    spawnPracticeBot: (kind: BotKind) => engineRef.current?.spawnPracticeBot(kind),
    clearPracticeBots: () => engineRef.current?.clearPracticeBots(),
    selectWeapon: (w: WeaponType) => engineRef.current?.selectWeapon(w)
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

    engineRef.current.startMenuAnimation();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (gameState === GameState.PLAYING && engine.state !== GameState.PLAYING) {
      engine.start();
    } else if (gameState === GameState.PRACTICE && engine.state !== GameState.PRACTICE) {
      engine.startPractice();
    } else if (gameState === GameState.MENU && engine.state !== GameState.MENU) {
      engine.stopPractice();
    }
  }, [gameState]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full block touch-none"
    />
  );
});
