import React, { useState, useRef, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameState, WeaponType, GameRef, PlayerState, GameSettings, BotKind } from './types';
import {
  VulcanIcon, SpreadIcon, LaserIcon, RailgunIcon, MissileIcon, TeslaIcon, BombIcon, FlakIcon, HelixIcon,
  ShieldSkillIcon, BlackHoleIcon, ShockwaveIcon,
  ArmorIcon, EnergyIcon, TrophyIcon, RocketIcon, CrosshairIcon, TargetIcon,
  SettingsIcon, ExitIcon, TrashIcon, SwordsIcon, CloseIcon
} from './components/GameIcons';

/**
 * 多点触控 UI 按钮 hook:
 *  - 把触摸标记为 "UI 触摸" 避免和游戏摇杆/开火冲突
 *  - 按下即触发 onPress, 支持鼠标 + 触屏
 */
function useUIButtonProps(
  gameRef: React.RefObject<GameRef>,
  onPress: () => void,
  opts?: { disabled?: boolean }
) {
  const disabled = !!opts?.disabled;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault(); e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      gameRef.current?.markUITouch(e.changedTouches[i].identifier);
    }
    onPress();
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      gameRef.current?.unmarkUITouch(e.changedTouches[i].identifier);
    }
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault(); e.stopPropagation();
    onPress();
  };
  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchEnd,
    onMouseDown: handleMouseDown
  };
}

// =====================================================================
// 武器元数据: 图标 / 名称 / 主色
// =====================================================================
type WeaponMeta = {
  label: string;
  color: string;
  Icon: React.FC<{ size?: number; active?: boolean; className?: string }>;
};
const WEAPON_META: Record<WeaponType, WeaponMeta> = {
  [WeaponType.VULCAN]:  { label: 'VULCAN',   color: '#facc15', Icon: VulcanIcon },
  [WeaponType.SPREAD]:  { label: 'SCATTER',  color: '#fb923c', Icon: SpreadIcon },
  [WeaponType.LASER]:   { label: 'HYPER BEAM', color: '#22d3ee', Icon: LaserIcon },
  [WeaponType.RAILGUN]: { label: 'RAILGUN',  color: '#a78bfa', Icon: RailgunIcon },
  [WeaponType.PLASMA]:  { label: 'MISSILE',  color: '#f472b6', Icon: MissileIcon },
  [WeaponType.TESLA]:   { label: 'TESLA',    color: '#67e8f9', Icon: TeslaIcon },
  [WeaponType.BOMB]:    { label: 'DOOM BOMB', color: '#ef4444', Icon: BombIcon },
  [WeaponType.FLAK]:    { label: 'FLAK',     color: '#f59e0b', Icon: FlakIcon },
  [WeaponType.HELIX]:   { label: 'HELIX',    color: '#4ade80', Icon: HelixIcon }
};

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
    if (gameState !== GameState.PLAYING && gameState !== GameState.PRACTICE) return;
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
    setScore(0); setHealth(100); setPlayerState(null);
  };
  const handleStartPractice = () => {
    setGameState(GameState.PRACTICE);
    setScore(0); setHealth(100); setPlayerState(null);
  };
  const handleExitPractice = () => {
    setGameState(GameState.MENU);
    setPlayerState(null);
  };
  const handleStartRogue = () => {
    setGameState(GameState.ROGUE);
    setScore(0); setHealth(100); setPlayerState(null);
  };
  const handleExitRogue = () => {
    setGameState(GameState.MENU);
    setPlayerState(null);
  };
  const handleGameOver = (finalScore: number) => {
    setGameState(GameState.GAME_OVER);
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem('thunder_stealth_highscore', finalScore.toString());
    }
  };

  const getSkillCooldownPercent = (k: 'shield' | 'blackhole' | 'shockwave') => {
    if (!playerState) return 0;
    const s = playerState.skills[k];
    if (s.current <= 0) return 0;
    return (s.current / s.max) * 100;
  };

  // ====================================================================
  // 技能按钮 (自绘 SVG + 冷却环)
  // ====================================================================
  const SkillButton: React.FC<{
    index: number;
    Icon: React.FC<{ size?: number; active?: boolean }>;
    label: string;
    skillKey: 'shield' | 'blackhole' | 'shockwave';
    hotkey: string;
    color: string;
  }> = ({ index, Icon, label, skillKey, hotkey, color }) => {
    const cooldownPct = getSkillCooldownPercent(skillKey);
    const isReady = cooldownPct === 0;
    const isActive = playerState?.skills[skillKey].active;
    const btnProps = useUIButtonProps(gameRef, () => gameRef.current?.triggerSkill(index), { disabled: !isReady });

    const CIRC = 2 * Math.PI * 30;
    const dashOffset = CIRC * (1 - cooldownPct / 100);

    return (
      <button
        {...btnProps}
        disabled={!isReady}
        data-ui-button="skill"
        className={`relative flex items-center justify-center w-[68px] h-[68px] rounded-full transition-transform ${isReady ? 'active:scale-90 hover:scale-105' : 'opacity-85'}`}
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(20,30,60,0.95), rgba(0,0,0,0.85))`,
          boxShadow: isActive
            ? `0 0 24px ${color}, inset 0 0 14px ${color}`
            : isReady
              ? `0 0 14px ${color}40, inset 0 0 6px ${color}30`
              : `inset 0 0 6px rgba(0,0,0,0.6)`,
          border: `2px solid ${isReady ? color : '#3f3f46'}`,
          touchAction: 'none'
        }}
      >
        {/* 冷却扇形环 (SVG) */}
        {!isReady && (
          <svg className="absolute inset-0 -rotate-90" width="68" height="68" viewBox="0 0 68 68">
            <circle cx="34" cy="34" r="30" stroke="rgba(0,0,0,0.75)" strokeWidth="4" fill="none" />
            <circle
              cx="34" cy="34" r="30"
              stroke={color} strokeWidth="3" fill="none"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              opacity="0.55"
            />
          </svg>
        )}

        {!isReady && (
          <span className="absolute z-20 text-white font-bold text-base drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {Math.ceil(playerState?.skills[skillKey].current || 0)}
          </span>
        )}

        <Icon size={30} active={isReady} />

        {/* 数字快捷键角标 */}
        <span
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${color}, rgba(0,0,0,0.9))`,
            color: '#fff',
            border: `1px solid ${color}`,
            boxShadow: `0 0 4px ${color}`
          }}
        >
          {hotkey}
        </span>
      </button>
    );
  };

  // ====================================================================
  // 换武器按钮 (六边形, SVG 图标 + 彩色装饰)
  // ====================================================================
  const WeaponButton: React.FC = () => {
    const btnProps = useUIButtonProps(gameRef, () => gameRef.current?.switchWeapon());
    const meta = WEAPON_META[currentWeapon];
    return (
      <button
        {...btnProps}
        data-ui-button="weapon"
        style={{ touchAction: 'none' }}
        className="relative w-28 h-28 group"
      >
        {/* 六角形背景 */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-[0_0_12px_rgba(0,255,255,0.25)]">
          <defs>
            <linearGradient id="wbg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(20,40,70,0.95)" />
              <stop offset="1" stopColor="rgba(3,7,18,0.95)" />
            </linearGradient>
          </defs>
          <polygon
            points="50,4 92,27 92,73 50,96 8,73 8,27"
            fill="url(#wbg)"
            stroke={meta.color}
            strokeWidth="2.2"
          />
          <polygon
            points="50,10 86,30 86,70 50,90 14,70 14,30"
            fill="none"
            stroke={meta.color}
            strokeWidth="1"
            opacity="0.4"
          />
        </svg>
        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <meta.Icon size={36} active />
          <span className="text-[9px] font-bold tracking-[0.15em] mt-1" style={{ color: meta.color, textShadow: `0 0 4px ${meta.color}80` }}>
            {meta.label}
          </span>
        </div>
      </button>
    );
  };

  // ====================================================================
  // 虚拟摇杆
  // ====================================================================
  const Joystick: React.FC = () => {
    if (!joystick.active) return null;
    return (
      <>
        <svg
          className="pointer-events-none absolute"
          style={{ left: joystick.base.x - 70, top: joystick.base.y - 70 }}
          width="140" height="140" viewBox="0 0 140 140"
        >
          <defs>
            <radialGradient id="joyBase" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0.6" stopColor="rgba(34,211,238,0.0)" />
              <stop offset="0.85" stopColor="rgba(34,211,238,0.45)" />
              <stop offset="1" stopColor="rgba(34,211,238,0.1)" />
            </radialGradient>
          </defs>
          <circle cx="70" cy="70" r="68" fill="url(#joyBase)" />
          <circle cx="70" cy="70" r="68" fill="none" stroke="rgba(125,211,252,0.7)" strokeWidth="1.5" strokeDasharray="4 4" />
          {/* 内圈刻度 */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
            const r = (deg * Math.PI) / 180;
            const x1 = 70 + Math.cos(r) * 54;
            const y1 = 70 + Math.sin(r) * 54;
            const x2 = 70 + Math.cos(r) * 62;
            const y2 = 70 + Math.sin(r) * 62;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(125,211,252,0.4)" strokeWidth="1" />;
          })}
        </svg>
        <svg
          className="pointer-events-none absolute"
          style={{ left: joystick.knob.x - 32, top: joystick.knob.y - 32 }}
          width="64" height="64" viewBox="0 0 64 64"
        >
          <defs>
            <radialGradient id="joyKnob" cx="0.35" cy="0.3" r="0.7">
              <stop offset="0" stopColor="#a5f3fc" />
              <stop offset="0.6" stopColor="#22d3ee" />
              <stop offset="1" stopColor="#0891b2" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="28" fill="url(#joyKnob)" stroke="#e0f2fe" strokeWidth="1.5" />
          <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
          <circle cx="32" cy="32" r="10" fill="rgba(255,255,255,0.4)" />
        </svg>
      </>
    );
  };

  // ====================================================================
  // 状态条 (血量/能量) - 全部自绘
  // ====================================================================
  const StatBar: React.FC<{
    label: string;
    icon: React.ReactNode;
    value: number;
    max: number;
    color: string;
    color2: string;
    criticalPulse?: boolean;
  }> = ({ label, icon, value, max, color, color2, criticalPulse }) => {
    const pct = Math.max(0, Math.min(1, value / max));
    const critical = criticalPulse && pct < 0.3;
    return (
      <div className="bg-[rgba(3,7,18,0.75)] backdrop-blur-md border border-white/10 rounded-md px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5" style={{ color }}>
            {icon}
            <span className="text-[10px] font-bold tracking-[0.25em]">{label}</span>
          </div>
          <span className="text-[10px] text-white/80 font-mono">
            {Math.ceil(value)}<span className="text-white/40">/{Math.floor(max)}</span>
          </span>
        </div>
        <div className="relative h-2.5 rounded-sm overflow-hidden bg-black/60 border border-white/10">
          {/* 渐变填充 */}
          <div
            className={`h-full transition-all duration-200 ${critical ? 'animate-pulse' : ''}`}
            style={{
              width: `${pct * 100}%`,
              background: `linear-gradient(90deg, ${color2}, ${color})`,
              boxShadow: `0 0 8px ${color}80`
            }}
          />
          {/* 刻度 */}
          <div className="absolute inset-0 flex">
            {[25, 50, 75].map(n => (
              <div key={n} className="h-full border-l border-black/50" style={{ marginLeft: `${n}%`, position: 'absolute' }} />
            ))}
          </div>
        </div>
      </div>
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
        onRogueExit={handleExitRogue}
      />

      {/* =============== SETTINGS MODAL =============== */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[rgba(10,20,40,0.95)] border-2 border-cyan-500/60 p-6 rounded-xl w-80 shadow-[0_0_40px_rgba(0,255,255,0.25)] relative">
            <button onClick={() => setShowSettings(false)} className="absolute top-2 right-2 text-gray-400 hover:text-white">
              <CloseIcon size={24} />
            </button>
            <h2 className="text-xl font-bold text-cyan-400 mb-6 flex items-center gap-2">
              <SettingsIcon size={22} /> SETTINGS
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2 tracking-widest">DIFFICULTY</label>
                <div className="flex bg-black/50 rounded p-1 gap-1">
                  {(['EASY', 'NORMAL', 'HARD'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setSettings({ ...settings, difficulty: d })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded transition ${settings.difficulty === d
                        ? 'bg-gradient-to-b from-cyan-500 to-cyan-700 text-white shadow-[0_0_10px_rgba(0,200,255,0.5)]'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2 tracking-widest">EFFECTS QUALITY</label>
                <div className="flex bg-black/50 rounded p-1 gap-1">
                  {(['LOW', 'HIGH'] as const).map(q => (
                    <button
                      key={q}
                      onClick={() => setSettings({ ...settings, effectQuality: q })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded transition ${settings.effectQuality === q
                        ? 'bg-gradient-to-b from-purple-500 to-purple-700 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
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

      {/* =============== 齿轮 (菜单界面可见) =============== */}
      {gameState !== GameState.PLAYING && gameState !== GameState.ROGUE && (
        <button
          onClick={() => setShowSettings(true)}
          className="absolute bottom-6 left-6 z-40 p-2 bg-black/40 border border-white/10 rounded-md hover:bg-white/10 transition-colors"
        >
          <SettingsIcon size={22} />
        </button>
      )}

      {/* =============== 游戏中 HUD =============== */}
      {gameState === GameState.PLAYING && (
        <>
          <div className="absolute top-0 left-0 w-full p-3 pointer-events-none flex justify-between items-start z-10">
            {/* 左上: 分数 */}
            <div className="flex items-center gap-2 bg-[rgba(3,7,18,0.75)] backdrop-blur-md border border-cyan-900/60 px-3 py-2 rounded-md shadow-[0_0_16px_rgba(0,200,255,0.2)]">
              <TrophyIcon size={20} active />
              <div className="flex flex-col leading-none">
                <span className="text-[9px] text-cyan-400/70 tracking-[0.25em]">SCORE</span>
                <span className="text-lg font-bold text-cyan-100 font-mono">{score.toString().padStart(6, '0')}</span>
              </div>
            </div>

            {/* 右上: 血量 + 能量 */}
            <div className="flex flex-col gap-1.5 w-60">
              <StatBar
                label="ARMOR" icon={<ArmorIcon size={14} active />}
                value={health} max={playerState?.maxHealth || 100}
                color="#f87171" color2="#7f1d1d" criticalPulse
              />
              <StatBar
                label="ENERGY" icon={<EnergyIcon size={14} active />}
                value={playerState?.mana || 0} max={playerState?.maxMana || 100}
                color="#60a5fa" color2="#1e3a8a"
              />
            </div>
          </div>

          <Joystick />

          {/* 操作提示条 */}
          <div className="absolute bottom-1 left-4 z-10 text-[10px] text-cyan-200/40 font-bold tracking-widest pointer-events-none">
            LEFT HALF · MOVE
          </div>
          <div className="absolute bottom-1 right-4 z-10 text-[10px] text-rose-200/40 font-bold tracking-widest pointer-events-none">
            RIGHT HALF · FIRE
          </div>

          {/* 底部中央: 技能按钮 */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-20">
            <SkillButton index={1} Icon={ShieldSkillIcon} label="SHIELD"    skillKey="shield"    hotkey="1" color="#60a5fa" />
            <SkillButton index={2} Icon={BlackHoleIcon}   label="SINGULAR"  skillKey="blackhole" hotkey="2" color="#818cf8" />
            <SkillButton index={3} Icon={ShockwaveIcon}   label="SHOCKWAVE" skillKey="shockwave" hotkey="3" color="#fbbf24" />
          </div>

          {/* 底部右: 武器按钮 */}
          <div className="absolute bottom-6 right-4 z-20">
            <WeaponButton />
          </div>
        </>
      )}

      {/* =============== 练习场 =============== */}
      {gameState === GameState.PRACTICE && (
        <PracticeHUD
          gameRef={gameRef}
          playerState={playerState}
          joystick={joystick}
          currentWeapon={currentWeapon}
          onExit={handleExitPractice}
          useUIButtonProps={useUIButtonProps}
        />
      )}

      {/* =============== 肉鸽模式顶栏 (Canvas 自己绘 UI, 这里只提供退出按钮) =============== */}
      {gameState === GameState.ROGUE && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded border border-pink-500/50 bg-[rgba(30,5,30,0.85)] backdrop-blur-md shadow-[0_0_14px_rgba(244,114,182,0.3)]">
            <SwordsIcon size={14} active />
            <span className="text-[11px] font-black tracking-[0.3em] text-pink-200">ROGUE RUN</span>
          </div>
          <button
            onClick={handleExitRogue}
            className="pointer-events-auto flex items-center gap-1 px-3 py-1.5 rounded border border-red-500/50 bg-[rgba(60,10,10,0.8)] hover:bg-red-900/70 text-red-100 text-[11px] font-bold tracking-wider active:scale-95 transition backdrop-blur-md"
          >
            <ExitIcon size={14} />
            EXIT
          </button>
        </div>
      )}

      {/* =============== 主菜单 =============== */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/70 backdrop-blur-sm">
          {/* 标题 */}
          <div className="mb-12 text-center relative">
            <div className="absolute -inset-12 bg-cyan-500/20 blur-3xl rounded-full opacity-30 animate-pulse" />
            <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter"
                style={{
                  background: 'linear-gradient(90deg, #22d3ee, #60a5fa, #a78bfa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: 'drop-shadow(0 0 12px rgba(0,255,255,0.5))'
                }}>
              THUNDER STEALTH
            </h1>
            <p className="text-cyan-200/70 mt-2 tracking-[0.5em] text-xs uppercase">Advanced Tactical Operations</p>
          </div>

          {/* 分数展示 (有记录时) */}
          {highScore > 0 && (
            <div className="mb-8 flex items-center gap-3 px-5 py-2 rounded-full bg-[rgba(10,20,40,0.6)] border border-yellow-500/40 shadow-[0_0_14px_rgba(250,204,21,0.2)]">
              <TrophyIcon size={18} active />
              <span className="text-[11px] tracking-widest text-yellow-200/80">BEST</span>
              <span className="text-lg font-bold text-yellow-100 font-mono">{highScore.toString().padStart(6, '0')}</span>
            </div>
          )}

          {/* 主按钮 */}
          <div className="flex flex-col gap-4 w-72">
            <MenuButton onClick={handleStartGame} color="#22d3ee" icon={<RocketIcon size={22} active />} label="ENGAGE" primary />
            <MenuButton onClick={handleStartRogue} color="#f472b6" icon={<SwordsIcon size={18} active />} label="ROGUE RUN" />
            <MenuButton onClick={handleStartPractice} color="#a78bfa" icon={<TargetIcon size={22} active />} label="PRACTICE RANGE" />
          </div>

          {/* 操作说明 */}
          <div className="text-center text-[11px] text-gray-400 mt-10 space-y-1.5 max-w-sm font-sans">
            <p>📱 <span className="text-cyan-300">Mobile:</span> 左半屏拖动 = 移动 · 右半屏按住 = 开火</p>
            <p className="hidden md:block">🖥️ <span className="text-cyan-300">Desktop:</span> WASD 移动 · 鼠标/空格 开火 · Q 换武器</p>
            <p><span className="text-cyan-300">Skills:</span> 按屏幕右下方按钮或键盘 1 / 2 / 3</p>
            <p className="text-pink-300/80 pt-1 border-t border-white/5">肉鸽模式: 三选一武器 (机枪/激光/魔法阵) · 逐层打 Boss · 每层选增益</p>
            <p className="text-violet-300/80">试验场: 无敌 · 魔法无限 · 任选武器 · 放置 Bot 练手感</p>
          </div>
        </div>
      )}

      {/* =============== Game Over =============== */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-gradient-to-b from-red-950/40 via-black/70 to-red-950/50 backdrop-blur-md">
          <h2 className="text-7xl md:text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-br from-red-300 via-red-500 to-red-700 drop-shadow-[0_0_18px_rgba(239,68,68,0.5)]">
            MIA
          </h2>
          <p className="text-xl text-red-200/80 mb-8 tracking-[0.4em]">MISSION FAILED</p>

          <div className="relative mb-8 min-w-[320px]">
            <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 to-black/90 rounded-xl border-2 border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.3)]" />
            <div className="relative p-7 text-center">
              <div className="text-gray-400 text-[10px] mb-1 uppercase tracking-[0.3em]">OPERATION SCORE</div>
              <div className="text-5xl font-black text-white font-mono mb-3 drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]">{score}</div>
              {score >= highScore && score > 0 && (
                <div className="text-yellow-300 text-sm font-bold animate-bounce flex items-center justify-center gap-2 tracking-widest">
                  <TrophyIcon size={16} active /> NEW RECORD
                </div>
              )}
            </div>
          </div>

          <MenuButton onClick={handleStartGame} color="#22d3ee" icon={<CrosshairIcon size={20} active />} label="REDEPLOY" primary compact />
        </div>
      )}
    </div>
  );
};

export default App;

// =====================================================================
// 菜单按钮 (削角矩形, 扫光动画, 自绘图标)
// =====================================================================
const MenuButton: React.FC<{
  onClick: () => void;
  color: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  compact?: boolean;
}> = ({ onClick, color, icon, label, primary, compact }) => (
  <button
    onClick={onClick}
    className={`group relative overflow-hidden ${compact ? 'px-7 py-3' : 'px-8 py-4'} transition-all active:scale-95 hover:scale-105`}
    style={{
      background: `linear-gradient(135deg, rgba(10,20,40,0.9), rgba(3,7,18,0.9))`,
      border: `1.5px solid ${color}aa`,
      boxShadow: primary ? `0 0 22px ${color}44` : `0 0 12px ${color}33`,
      clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)'
    }}
  >
    {/* 扫光 */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `linear-gradient(90deg, transparent, ${color}22, transparent)`,
        transform: 'translateX(-100%)',
        animation: 'shine 2.8s infinite'
      }}
    />
    <span className="flex items-center justify-center gap-3 relative z-10 font-bold tracking-[0.25em]"
          style={{ color, textShadow: `0 0 6px ${color}80` }}>
      {icon}
      {label}
    </span>
    <style>{`@keyframes shine { 0% { transform: translateX(-100%); } 60%, 100% { transform: translateX(200%); } }`}</style>
  </button>
);

// =====================================================================
// 练习场 HUD
// =====================================================================
type UseUIBtnPropsFn = (
  gameRef: React.RefObject<GameRef>,
  onPress: () => void,
  opts?: { disabled?: boolean }
) => any;

const BOT_CONFIGS: Array<{ kind: BotKind; label: string; color: string }> = [
  { kind: BotKind.BASIC,        label: 'BASIC',    color: '#94a3b8' },
  { kind: BotKind.FAST,         label: 'FAST',     color: '#22d3ee' },
  { kind: BotKind.TANK,         label: 'TANK',     color: '#f59e0b' },
  { kind: BotKind.KAMIKAZE,     label: 'KAMI',     color: '#f43f5e' },
  { kind: BotKind.SHIELDER,     label: 'SHIELD',   color: '#0ea5e9' },
  { kind: BotKind.SNIPER,       label: 'SNIPER',   color: '#22c55e' },
  { kind: BotKind.SWARMER,      label: 'SWARM×5',  color: '#facc15' },
  { kind: BotKind.BOSS,         label: 'BOSS',     color: '#d946ef' },
  { kind: BotKind.BOSS_CARRIER, label: 'CARRIER',  color: '#ec4899' },
  { kind: BotKind.BOSS_REAVER,  label: 'REAVER',   color: '#ef4444' },
  { kind: BotKind.STATIC,       label: 'STATIC',   color: '#10b981' }
];

const WEAPON_ORDER_UI: WeaponType[] = [
  WeaponType.VULCAN, WeaponType.SPREAD, WeaponType.LASER,
  WeaponType.RAILGUN, WeaponType.PLASMA, WeaponType.TESLA,
  WeaponType.BOMB, WeaponType.FLAK, WeaponType.HELIX
];

const PracticeHUD: React.FC<{
  gameRef: React.RefObject<GameRef>;
  playerState: PlayerState | null;
  joystick: { active: boolean; base: { x: number; y: number }; knob: { x: number; y: number } };
  currentWeapon: WeaponType;
  onExit: () => void;
  useUIButtonProps: UseUIBtnPropsFn;
}> = ({ gameRef, joystick, currentWeapon, onExit, useUIButtonProps }) => {

  const BotButton: React.FC<{ kind: BotKind; label: string; color: string }> = ({ kind, label, color }) => {
    const btnProps = useUIButtonProps(gameRef, () => gameRef.current?.spawnPracticeBot(kind));
    return (
      <button
        {...btnProps}
        data-ui-button="practice-bot"
        style={{
          touchAction: 'none',
          borderColor: color + 'aa',
          background: `linear-gradient(135deg, ${color}22, rgba(0,0,0,0.6))`,
          color
        }}
        className="px-2.5 py-1.5 rounded text-[10px] font-black tracking-widest border backdrop-blur-md active:scale-95 transition hover:brightness-125"
      >
        {label}
      </button>
    );
  };

  const WeapChip: React.FC<{ w: WeaponType; active: boolean }> = ({ w, active }) => {
    const meta = WEAPON_META[w];
    const btnProps = useUIButtonProps(gameRef, () => gameRef.current?.selectWeapon(w));
    return (
      <button
        {...btnProps}
        data-ui-button="practice-weap"
        style={{ touchAction: 'none' }}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] font-bold tracking-widest backdrop-blur-md border active:scale-95 transition ${
          active
            ? 'border-white/60 shadow-[0_0_14px_rgba(255,255,255,0.3)]'
            : 'border-white/10 hover:border-white/30'
        }`}
        title={meta.label}
      >
        <meta.Icon size={18} active={active} />
        <span style={{ color: active ? '#fff' : meta.color }}>{meta.label}</span>
      </button>
    );
  };

  const clearProps = useUIButtonProps(gameRef, () => gameRef.current?.clearPracticeBots());
  const exitProps  = useUIButtonProps(gameRef, onExit);

  const SkillBtn: React.FC<{ index: number; Icon: React.FC<{ size?: number; active?: boolean }>; hotkey: string; color: string }> = ({ index, Icon, hotkey, color }) => {
    const btnProps = useUIButtonProps(gameRef, () => gameRef.current?.triggerSkill(index));
    return (
      <button
        {...btnProps}
        data-ui-button="skill"
        className="relative flex items-center justify-center w-[68px] h-[68px] rounded-full transition-transform active:scale-90"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(20,30,60,0.95), rgba(0,0,0,0.85))`,
          boxShadow: `0 0 14px ${color}40, inset 0 0 6px ${color}30`,
          border: `2px solid ${color}`,
          touchAction: 'none'
        }}
      >
        <Icon size={30} active />
        <span
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${color}, rgba(0,0,0,0.9))`,
            color: '#fff',
            border: `1px solid ${color}`
          }}
        >
          {hotkey}
        </span>
      </button>
    );
  };

  const WeapCycleBtn: React.FC = () => {
    const btnProps = useUIButtonProps(gameRef, () => gameRef.current?.switchWeapon());
    const meta = WEAPON_META[currentWeapon];
    return (
      <button
        {...btnProps}
        data-ui-button="weapon"
        style={{ touchAction: 'none' }}
        className="relative w-28 h-28"
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-[0_0_12px_rgba(192,132,252,0.25)]">
          <polygon
            points="50,4 92,27 92,73 50,96 8,73 8,27"
            fill="rgba(10,20,40,0.95)"
            stroke={meta.color}
            strokeWidth="2.2"
          />
          <polygon
            points="50,10 86,30 86,70 50,90 14,70 14,30"
            fill="none"
            stroke={meta.color}
            strokeWidth="1"
            opacity="0.4"
          />
        </svg>
        <div className="relative z-10 flex flex-col items-center justify-center h-full">
          <meta.Icon size={36} active />
          <span className="text-[9px] font-bold tracking-[0.15em] mt-1" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </div>
      </button>
    );
  };

  return (
    <>
      <div className="absolute top-0 left-0 w-full p-3 z-20 flex flex-col gap-2 pointer-events-none">
        {/* 顶栏 */}
        <div className="flex items-center justify-between gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 text-violet-300 bg-[rgba(3,7,18,0.8)] px-3 py-1.5 rounded border border-violet-500/40 backdrop-blur-md shadow-[0_0_12px_rgba(192,132,252,0.25)]">
            <TargetIcon size={16} active />
            <span className="text-[11px] font-black tracking-[0.3em]">PRACTICE RANGE</span>
          </div>
          <button
            {...exitProps}
            data-ui-button="practice-exit"
            style={{ touchAction: 'none' }}
            className="flex items-center gap-1 px-3 py-1.5 rounded border border-red-500/50 bg-[rgba(60,10,10,0.6)] hover:bg-red-900/60 text-red-100 text-[11px] font-bold tracking-wider active:scale-95 transition"
          >
            <ExitIcon size={16} />
            EXIT
          </button>
        </div>

        {/* Spawn Bots */}
        <div className="pointer-events-auto bg-[rgba(3,7,18,0.75)] border border-white/10 rounded p-2 backdrop-blur-md">
          <div className="text-[10px] text-gray-400 mb-1.5 tracking-widest flex items-center gap-1">
            <SwordsIcon size={12} /> SPAWN BOTS
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BOT_CONFIGS.map(b => (
              <BotButton key={b.kind} kind={b.kind} label={b.label} color={b.color} />
            ))}
            <button
              {...clearProps}
              data-ui-button="practice-clear"
              style={{ touchAction: 'none' }}
              className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded border text-[10px] font-bold tracking-widest border-red-500 bg-gradient-to-br from-red-950/80 to-red-900/60 text-red-100 hover:brightness-125 active:scale-95 transition"
            >
              <TrashIcon size={12} /> CLEAR
            </button>
          </div>
        </div>

        {/* Weapons */}
        <div className="pointer-events-auto bg-[rgba(3,7,18,0.75)] border border-white/10 rounded p-2 backdrop-blur-md">
          <div className="text-[10px] text-gray-400 mb-1.5 tracking-widest">WEAPONS</div>
          <div className="flex flex-wrap gap-1.5">
            {WEAPON_ORDER_UI.map(w => (
              <WeapChip key={w} w={w} active={currentWeapon === w} />
            ))}
          </div>
        </div>
      </div>

      {/* 摇杆 */}
      {joystick.active && (
        <>
          <div className="pointer-events-none absolute rounded-full border-2 border-cyan-300/60 bg-cyan-400/10"
               style={{ width: 140, height: 140, left: joystick.base.x - 70, top: joystick.base.y - 70 }} />
          <div className="pointer-events-none absolute rounded-full bg-cyan-300/70 border border-white/80 shadow-[0_0_18px_rgba(0,255,255,0.6)]"
               style={{ width: 56, height: 56, left: joystick.knob.x - 28, top: joystick.knob.y - 28 }} />
        </>
      )}

      <div className="absolute bottom-1 left-4 z-10 text-[10px] text-cyan-200/40 font-bold tracking-widest pointer-events-none">LEFT HALF · MOVE</div>
      <div className="absolute bottom-1 right-4 z-10 text-[10px] text-rose-200/40 font-bold tracking-widest pointer-events-none">RIGHT HALF · FIRE</div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-20">
        <SkillBtn index={1} Icon={ShieldSkillIcon} hotkey="1" color="#60a5fa" />
        <SkillBtn index={2} Icon={BlackHoleIcon}   hotkey="2" color="#818cf8" />
        <SkillBtn index={3} Icon={ShockwaveIcon}   hotkey="3" color="#fbbf24" />
      </div>

      <div className="absolute bottom-6 right-4 z-20">
        <WeapCycleBtn />
      </div>
    </>
  );
};
