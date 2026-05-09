import React, { useState, useRef, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameState, WeaponType, GameRef, PlayerState, GameSettings } from './types';
import { Rocket, Trophy, Heart, Crosshair, Zap, Disc, Hexagon, Shield, CircleDot, Activity, Bomb, Settings, X } from 'lucide-react';

/**
 * 专门用于手机按钮的 Hook / HOC：
 *   - 按下 (pointerdown / touchstart) 立即触发 onPress
 *   - 把触摸标记为 "UI 触摸"，InputManager 会忽略它，
 *     因此技能按钮可以和摇杆、射击同时按
 *   - 阻止事件冒泡/默认，防止点击按钮时触发移动或开火
 */
function useUIButtonProps(
  gameRef: React.RefObject<GameRef>,
  onPress: () => void,
  opts?: { disabled?: boolean }
) {
  const disabled = !!opts?.disabled;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    // 把本次按下的每个手指注册为 UI 触摸
    for (let i = 0; i < e.changedTouches.length; i++) {
      gameRef.current?.markUITouch(e.changedTouches[i].identifier);
    }
    onPress();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // 解除 UI 触摸标记
    for (let i = 0; i < e.changedTouches.length; i++) {
      gameRef.current?.unmarkUITouch(e.changedTouches[i].identifier);
    }
  };

  // 桌面：鼠标点击按正常路径走即可
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    onPress();
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchEnd,
    onMouseDown: handleMouseDown
  };
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [health, setHealth] = useState(100);
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>(WeaponType.VULCAN);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('thunder_stealth_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [playerState, setPlayerState] = useState<PlayerState | null>(null);

  // Joystick visual state (repainted every 50ms along with playerState)
  const [joystick, setJoystick] = useState<{ active: boolean; base: { x: number; y: number }; knob: { x: number; y: number } }>({
    active: false, base: { x: 0, y: 0 }, knob: { x: 0, y: 0 }
  });

  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<GameSettings>({
    difficulty: 'NORMAL',
    effectQuality: 'HIGH'
  });

  const gameRef = useRef<GameRef>(null);

  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;
    const interval = setInterval(() => {
      if (gameRef.current) {
        const s = gameRef.current.getPlayerState();
        if (s) setPlayerState(s);
        setJoystick(gameRef.current.getJoystickState());
      }
    }, 50);
    return () => clearInterval(interval);
  }, [gameState]);

  useEffect(() => {
    if (gameRef.current) gameRef.current.updateSettings(settings);
  }, [settings]);

  const handleStartGame = () => {
    setGameState(GameState.PLAYING);
    setScore(0);
    setHealth(100);
    setPlayerState(null);
  };

  const handleGameOver = (finalScore: number) => {
    setGameState(GameState.GAME_OVER);
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('thunder_stealth_highscore', finalScore.toString());
    }
  };

  const getWeaponIcon = () => {
    switch (currentWeapon) {
      case WeaponType.LASER:  return <Zap size={24} className="text-cyan-400" />;
      case WeaponType.PLASMA: return <Disc size={24} className="text-fuchsia-400" />;
      case WeaponType.TESLA:  return <Activity size={24} className="text-blue-200" />;
      case WeaponType.BOMB:   return <Bomb size={24} className="text-red-400" />;
      case WeaponType.VULCAN:
      default:                return <Hexagon size={24} className="text-yellow-400" />;
    }
  };

  const getWeaponName = () => {
    switch (currentWeapon) {
      case WeaponType.LASER:  return "HYPER BEAM";
      case WeaponType.PLASMA: return "TRACKING MSL";
      case WeaponType.TESLA:  return "TESLA COIL";
      case WeaponType.BOMB:   return "DOOM BOMB";
      case WeaponType.VULCAN: return "VULCAN CANNON";
      default:                return "";
    }
  };

  const getSkillCooldownPercent = (k: 'shield' | 'blackhole' | 'shockwave') => {
    if (!playerState) return 0;
    const s = playerState.skills[k];
    if (s.current <= 0) return 0;
    return (s.current / s.max) * 100;
  };

  // ---- 技能按钮 (多点触控友好) ----
  const SkillButton: React.FC<{
    index: number;
    icon: React.ReactNode;
    skillKey: 'shield' | 'blackhole' | 'shockwave';
    colorClass: string;
  }> = ({ index, icon, skillKey, colorClass }) => {
    const cooldownPct = getSkillCooldownPercent(skillKey);
    const isReady = cooldownPct === 0;
    const isActive = playerState?.skills[skillKey].active;

    const btnProps = useUIButtonProps(
      gameRef,
      () => gameRef.current?.triggerSkill(index),
      { disabled: !isReady }
    );

    return (
      <button
        {...btnProps}
        disabled={!isReady}
        data-ui-button="skill"
        className={`relative flex flex-col items-center justify-center w-16 h-16 rounded overflow-hidden transition-all ${
          isReady ? 'active:scale-95 hover:brightness-110' : 'opacity-80'
        }`}
        style={{
          backgroundColor: 'rgba(10, 20, 40, 0.8)',
          borderColor: isReady ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)',
          borderWidth: '1px',
          touchAction: 'none'
        }}
      >
        {!isReady && (
          <div
            className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center"
            style={{ height: `${cooldownPct}%`, bottom: 0, top: 'auto' }}
          />
        )}
        {!isReady && (
          <span className="absolute z-30 font-bold text-white text-sm drop-shadow-md">
            {Math.ceil(playerState?.skills[skillKey].current || 0)}
          </span>
        )}
        {isActive && <div className={`absolute inset-0 z-0 animate-pulse ${colorClass} opacity-30`} />}
        <div className={`relative z-10 ${isReady ? colorClass : 'text-gray-500'}`}>{icon}</div>
        <span className={`text-[10px] mt-1 font-bold z-10 ${isReady ? 'text-white' : 'text-gray-500'}`}>{index}</span>
      </button>
    );
  };

  // ---- 换武器按钮 (多点触控友好) ----
  const WeaponButton: React.FC = () => {
    const btnProps = useUIButtonProps(gameRef, () => gameRef.current?.switchWeapon());
    return (
      <button
        {...btnProps}
        data-ui-button="weapon"
        style={{ touchAction: 'none' }}
        className="flex flex-col items-center justify-center w-24 h-24 bg-black/60 border-2 border-cyan-500/50 rounded-lg backdrop-blur-md active:scale-95 transition-all duration-150 group shadow-[0_0_20px_rgba(0,255,255,0.15)] hover:bg-cyan-900/30"
      >
        <div className="mb-2 group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
          {getWeaponIcon()}
        </div>
        <span className="text-[10px] text-cyan-100 font-bold tracking-widest">{getWeaponName()}</span>
      </button>
    );
  };

  // ---- 虚拟摇杆 (HUD) ----
  const Joystick: React.FC = () => {
    if (!joystick.active) return null;
    return (
      <>
        <div
          className="pointer-events-none absolute rounded-full border-2 border-cyan-300/60 bg-cyan-400/10"
          style={{
            width: 140, height: 140,
            left: joystick.base.x - 70,
            top: joystick.base.y - 70
          }}
        />
        <div
          className="pointer-events-none absolute rounded-full bg-cyan-300/70 border border-white/80 shadow-[0_0_18px_rgba(0,255,255,0.6)]"
          style={{
            width: 56, height: 56,
            left: joystick.knob.x - 28,
            top: joystick.knob.y - 28
          }}
        />
      </>
    );
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-black text-white font-mono select-none"
      style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <GameCanvas
        ref={gameRef}
        gameState={gameState}
        onScoreChange={setScore}
        onHealthChange={setHealth}
        onGameOver={handleGameOver}
        onWeaponChange={setCurrentWeapon}
      />

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-cyan-500/50 p-6 rounded-lg w-80 shadow-2xl relative">
            <button onClick={() => setShowSettings(false)} className="absolute top-2 right-2 text-gray-400 hover:text-white">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold text-cyan-400 mb-6 flex items-center gap-2">
              <Settings size={20} /> SETTINGS
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">DIFFICULTY</label>
                <div className="flex bg-black/50 rounded p-1">
                  {(['EASY', 'NORMAL', 'HARD'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setSettings({ ...settings, difficulty: d })}
                      className={`flex-1 py-1 text-xs font-bold rounded ${settings.difficulty === d ? 'bg-cyan-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">EFFECTS QUALITY</label>
                <div className="flex bg-black/50 rounded p-1">
                  {(['LOW', 'HIGH'] as const).map(q => (
                    <button
                      key={q}
                      onClick={() => setSettings({ ...settings, effectQuality: q })}
                      className={`flex-1 py-1 text-xs font-bold rounded ${settings.effectQuality === q ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings gear - only on menu / game-over (避免和游戏里左下摇杆区冲突) */}
      {gameState !== GameState.PLAYING && (
        <button
          onClick={() => setShowSettings(true)}
          className="absolute bottom-6 left-6 z-40 p-2 bg-black/40 border border-white/10 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <Settings size={24} />
        </button>
      )}

      {gameState === GameState.PLAYING && (
        <>
          {/* 顶部状态栏 */}
          <div className="absolute top-0 left-0 w-full p-4 pointer-events-none flex justify-between items-start z-10">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-cyan-400 bg-black/60 p-2 rounded border border-cyan-900/50 backdrop-blur-md shadow-[0_0_15px_rgba(0,255,255,0.2)]">
                <Trophy size={20} />
                <span className="text-xl font-bold">{score.toString().padStart(6, '0')}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-64">
              <div className="bg-black/60 p-2 rounded border border-red-900/50 backdrop-blur-md">
                <div className="flex items-center justify-between mb-1 text-red-400">
                  <div className="flex items-center gap-2">
                    <Heart size={16} fill="currentColor" />
                    <span className="text-sm">ARMOR</span>
                  </div>
                  <span className="text-xs">{Math.ceil(health)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden border border-white/10">
                  <div
                    className={`h-full transition-all duration-300 ${health > 30 ? 'bg-gradient-to-r from-red-600 to-red-500' : 'bg-red-600 animate-pulse'}`}
                    style={{ width: `${Math.max(0, health)}%` }}
                  />
                </div>
              </div>
              <div className="bg-black/60 p-2 rounded border border-blue-900/50 backdrop-blur-md">
                <div className="flex items-center gap-2 mb-1 text-blue-400">
                  <Activity size={16} />
                  <span className="text-sm">ENERGY</span>
                  <span className="ml-auto text-xs">{Math.floor(playerState?.mana || 0)}/{Math.floor(playerState?.maxMana || 100)}</span>
                </div>
                <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-blue-700 to-cyan-400 transition-all duration-100"
                    style={{ width: `${Math.min(100, ((playerState?.mana || 0) / (playerState?.maxMana || 100)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 虚拟摇杆 */}
          <Joystick />

          {/* 左下提示：MOVE */}
          <div className="absolute bottom-2 left-4 z-10 text-[10px] text-cyan-200/40 font-bold tracking-widest pointer-events-none">
            LEFT HALF · MOVE
          </div>
          {/* 右下提示：FIRE */}
          <div className="absolute bottom-2 right-4 z-10 text-[10px] text-rose-200/40 font-bold tracking-widest pointer-events-none">
            RIGHT HALF · FIRE
          </div>

          {/* 技能按钮 */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 z-20">
            <SkillButton index={1} icon={<Shield size={24} />} skillKey="shield" colorClass="text-blue-400 bg-blue-500" />
            <SkillButton index={2} icon={<CircleDot size={24} />} skillKey="blackhole" colorClass="text-indigo-400 bg-indigo-500" />
            <SkillButton index={3} icon={<Activity size={24} />} skillKey="shockwave" colorClass="text-yellow-400 bg-yellow-500" />
          </div>

          {/* 换武器按钮 */}
          <div className="absolute bottom-8 right-4 z-20">
            <WeaponButton />
          </div>
        </>
      )}

      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/80 backdrop-blur-sm">
          <div className="mb-12 text-center animate-pulse relative">
            <div className="absolute -inset-10 bg-cyan-500/20 blur-3xl rounded-full opacity-20" />
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent italic tracking-tighter drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]">
              THUNDER STEALTH
            </h1>
            <p className="text-cyan-200 mt-2 tracking-[0.3em] text-sm uppercase">Advanced Tactical Operations</p>
          </div>

          <div className="flex flex-col gap-6 w-72">
            <button
              onClick={handleStartGame}
              className="group relative px-8 py-4 bg-cyan-950/40 hover:bg-cyan-800/60 border border-cyan-500/50 text-cyan-100 font-bold tracking-widest transition-all duration-200 clip-path-polygon hover:scale-105 active:scale-95 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <span className="flex items-center justify-center gap-2 relative z-10">
                <Rocket className="group-hover:translate-x-1 transition-transform text-cyan-400" />
                ENGAGE
              </span>
            </button>

            <div className="text-center text-xs text-gray-400 mt-4 space-y-1 font-sans border-t border-white/10 pt-4">
              <p>📱 <span className="text-cyan-300">Mobile:</span> 左半屏拖动 = 移动 · 右半屏按住 = 开火</p>
              <p className="hidden md:block">🖥️ <span className="text-cyan-300">Desktop:</span> WASD 移动 · 鼠标/空格 开火</p>
              <p>技能：按屏幕右下方按钮 / 键盘 1 2 3</p>
            </div>
          </div>
        </div>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-red-950/40 backdrop-blur-md">
          <h2 className="text-7xl font-bold text-red-500 mb-2 drop-shadow-[0_0_15px_rgba(255,0,0,0.5)]">MIA</h2>
          <p className="text-xl text-red-200 mb-10 tracking-widest">MISSION FAILED</p>
          <div className="bg-black/80 p-8 rounded-xl border border-red-500/30 mb-8 text-center min-w-[280px] shadow-2xl">
            <div className="text-gray-400 text-xs mb-2 uppercase tracking-widest">Operation Score</div>
            <div className="text-5xl font-bold text-white mb-4 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{score}</div>
            {score >= highScore && score > 0 && (
              <div className="text-yellow-400 text-sm font-bold animate-bounce flex items-center justify-center gap-2">
                <Trophy size={14} /> NEW RECORD
              </div>
            )}
          </div>
          <button
            onClick={handleStartGame}
            className="px-8 py-3 bg-white text-black font-bold hover:bg-cyan-400 hover:scale-105 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          >
            <Crosshair size={20} />
            REDEPLOY
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
