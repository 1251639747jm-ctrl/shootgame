import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { GameEngine } from '../game/GameEngine';
import { RogueEngine } from '../game/rogue';
import { GameState, GameRef, WeaponType, GameSettings, BotKind } from '../types';

interface GameCanvasProps {
  gameState: GameState;
  onScoreChange: (score: number) => void;
  onHealthChange: (health: number) => void;
  onGameOver: (score: number) => void;
  onWeaponChange: (weapon: WeaponType) => void;
  /** Rogue 模式内部自己死亡/通关/用户点击继续后通知 App 回菜单 */
  onRogueExit?: () => void;
}

export const GameCanvas = forwardRef<GameRef, GameCanvasProps>(({
  gameState,
  onScoreChange,
  onHealthChange,
  onGameOver,
  onWeaponChange,
  onRogueExit
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rogueRef = useRef<RogueEngine | null>(null);

  // 保存最新的 onRogueExit 引用, 方便 RogueEngine 回调读取
  const rogueExitRef = useRef(onRogueExit);
  useEffect(() => { rogueExitRef.current = onRogueExit; }, [onRogueExit]);

  const startRogue = () => {
    if (!canvasRef.current || !engineRef.current) return;
    // 让主引擎让位
    engineRef.current.suspendForRogue();
    if (!rogueRef.current) {
      rogueRef.current = new RogueEngine(canvasRef.current, () => {
        // 退出回调: 停掉 rogue, 回菜单
        rogueRef.current?.stop();
        rogueExitRef.current?.();
      });
    }
    rogueRef.current.resize(canvasRef.current.width, canvasRef.current.height);
    rogueRef.current.start();
  };

  const stopRogue = () => {
    rogueRef.current?.stop();
    // 回菜单背景 (先重置状态再调用 startMenuAnimation, 因为它对 ROGUE 状态 early-return)
    if (engineRef.current) {
      engineRef.current.state = GameState.MENU;
      engineRef.current.startMenuAnimation();
    }
  };

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
    selectWeapon: (w: WeaponType) => engineRef.current?.selectWeapon(w),
    startRogue,
    stopRogue
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
        rogueRef.current?.resize(window.innerWidth, window.innerHeight);
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
      rogueRef.current?.stop();
      engine.start();
    } else if (gameState === GameState.PRACTICE && engine.state !== GameState.PRACTICE) {
      rogueRef.current?.stop();
      engine.startPractice();
    } else if (gameState === GameState.ROGUE && engine.state !== GameState.ROGUE) {
      startRogue();
    } else if (gameState === GameState.MENU && engine.state !== GameState.MENU) {
      rogueRef.current?.stop();
      engine.stopPractice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full block touch-none"
    />
  );
});
