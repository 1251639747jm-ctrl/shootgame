import React from 'react';

/**
 * 自绘游戏图标集。
 * 每个图标都是一个 ViewBox 24x24 的 SVG, 风格是:
 *   - 深底 + 高饱和霓虹线条
 *   - 渐变填充 + 光晕感 (drop-shadow)
 *   - 和游戏里的 Canvas 模型尽量一致
 *
 * 用法: <VulcanIcon size={24} />
 */

type IconProps = {
  size?: number;
  className?: string;
  /** 是否点亮 (加强发光) */
  active?: boolean;
};

const withGlow = (color: string, active?: boolean): React.CSSProperties => ({
  filter: active
    ? `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 10px ${color})`
    : `drop-shadow(0 0 2px ${color})`
});

// ============ 武器图标 ============

export const VulcanIcon: React.FC<IconProps> = ({ size = 24, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#facc15', active)}>
    <defs>
      <linearGradient id="vulcG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fde047" />
        <stop offset="1" stopColor="#a16207" />
      </linearGradient>
    </defs>
    {/* 三联炮管 */}
    <rect x="4" y="14" width="2.5" height="6" fill="url(#vulcG)" stroke="#713f12" strokeWidth="0.5" />
    <rect x="10.75" y="14" width="2.5" height="6" fill="url(#vulcG)" stroke="#713f12" strokeWidth="0.5" />
    <rect x="17.5" y="14" width="2.5" height="6" fill="url(#vulcG)" stroke="#713f12" strokeWidth="0.5" />
    {/* 上方子弹飞行轨迹 */}
    <rect x="4.75" y="2" width="1" height="4" fill="#fef08a" />
    <rect x="11.5" y="4" width="1" height="4" fill="#fef08a" />
    <rect x="18.25" y="2" width="1" height="4" fill="#fef08a" />
    {/* 底座 */}
    <rect x="2" y="18" width="20" height="4" rx="1" fill="#3f2f0a" stroke="#facc15" strokeWidth="0.8" />
    {/* 火花 */}
    <circle cx="5.9" cy="14" r="1" fill="#fff" opacity="0.9" />
    <circle cx="12.75" cy="14" r="1" fill="#fff" opacity="0.9" />
    <circle cx="19.5" cy="14" r="1" fill="#fff" opacity="0.9" />
  </svg>
);

export const SpreadIcon: React.FC<IconProps> = ({ size = 24, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#fb923c', active)}>
    {/* 扇形投射线 */}
    {[-60, -40, -20, 0, 20, 40, 60].map((deg, i) => {
      const rad = (deg * Math.PI) / 180;
      const x = 12 + Math.sin(rad) * 9;
      const y = 20 - Math.cos(rad) * 9;
      return <line key={i} x1="12" y1="20" x2={x} y2={y} stroke="#fb923c" strokeWidth="1.2" strokeLinecap="round" />;
    })}
    {/* 子弹头 */}
    {[-60, -40, -20, 0, 20, 40, 60].map((deg, i) => {
      const rad = (deg * Math.PI) / 180;
      const x = 12 + Math.sin(rad) * 9;
      const y = 20 - Math.cos(rad) * 9;
      return <circle key={i} cx={x} cy={y} r="1.3" fill="#fff7ed" />;
    })}
    {/* 枪口 */}
    <path d="M 12 22 L 9 18 L 15 18 Z" fill="#c2410c" stroke="#fb923c" strokeWidth="0.6" />
  </svg>
);

export const LaserIcon: React.FC<IconProps> = ({ size = 24, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#22d3ee', active)}>
    <defs>
      <linearGradient id="laserG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="rgba(255,255,255,0)" />
        <stop offset="0.3" stopColor="#67e8f9" />
        <stop offset="1" stopColor="#ffffff" />
      </linearGradient>
    </defs>
    {/* 外晕 */}
    <rect x="8" y="2" width="8" height="16" fill="#0891b2" opacity="0.35" rx="1" />
    {/* 主光束 */}
    <rect x="9.5" y="2" width="5" height="16" fill="url(#laserG)" />
    {/* 纯白核心 */}
    <rect x="11.25" y="2" width="1.5" height="16" fill="#ffffff" />
    {/* 枪口光斑 */}
    <circle cx="12" cy="20" r="3" fill="#67e8f9" opacity="0.55" />
    <circle cx="12" cy="20" r="1.6" fill="#fff" />
    {/* 上方发光环 */}
    <ellipse cx="12" cy="3" rx="3" ry="1" fill="#fff" opacity="0.7" />
  </svg>
);

export const RailgunIcon: React.FC<IconProps> = ({ size = 24, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#a78bfa', active)}>
    {/* 两条平行电轨 */}
    <line x1="7" y1="2" x2="7" y2="22" stroke="#a78bfa" strokeWidth="1.2" />
    <line x1="17" y1="2" x2="17" y2="22" stroke="#a78bfa" strokeWidth="1.2" />
    {/* 电弧 */}
    <path d="M 7 6 L 10 8 L 14 5 L 17 7" stroke="#fff" strokeWidth="1" fill="none" strokeLinecap="round" />
    <path d="M 7 14 L 10 13 L 14 15 L 17 12" stroke="#fff" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.7" />
    {/* 中心弹丸 */}
    <rect x="10" y="8" width="4" height="10" rx="1" fill="#c4b5fd" stroke="#fff" strokeWidth="0.6" />
    <rect x="11.25" y="8" width="1.5" height="10" fill="#fff" />
    {/* 枪口闪光 */}
    <circle cx="12" cy="22" r="2" fill="#fff" opacity="0.85" />
  </svg>
);

export const MissileIcon: React.FC<IconProps> = ({ size = 24, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#f472b6', active)}>
    <defs>
      <linearGradient id="msl" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fce7f3" />
        <stop offset="0.5" stopColor="#e879f9" />
        <stop offset="1" stopColor="#701a75" />
      </linearGradient>
    </defs>
    {/* 导弹主体 */}
    <path d="M 12 2 L 15 8 L 15 16 L 12 18 L 9 16 L 9 8 Z" fill="url(#msl)" stroke="#fff" strokeWidth="0.6" />
    {/* 鼻锥高光 */}
    <path d="M 12 2 L 13 6 L 11 6 Z" fill="#fff" opacity="0.85" />
    {/* 翼 */}
    <path d="M 9 14 L 5 18 L 8 18 Z" fill="#a21caf" stroke="#f5d0fe" strokeWidth="0.5" />
    <path d="M 15 14 L 19 18 L 16 18 Z" fill="#a21caf" stroke="#f5d0fe" strokeWidth="0.5" />
    {/* 尾焰 */}
    <path d="M 10 18 L 12 22 L 14 18 Z" fill="#fbbf24" opacity="0.85" />
    <path d="M 11 18 L 12 21 L 13 18 Z" fill="#fff" />
  </svg>
);

export const TeslaIcon: React.FC<IconProps> = ({ size = 24, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#67e8f9', active)}>
    {/* 闪电主干 */}
    <path d="M 13 2 L 8 12 L 12 12 L 9 22 L 17 10 L 13 10 L 16 2 Z"
          fill="#a5f3fc" stroke="#fff" strokeWidth="0.8" strokeLinejoin="miter" />
    {/* 内侧高光 */}
    <path d="M 13 3 L 9.5 11 L 12 11 L 11 18 L 15.5 11 L 13 11 L 15 3 Z"
          fill="#fff" opacity="0.7" />
    {/* 电花 */}
    <circle cx="5" cy="7" r="0.8" fill="#67e8f9" />
    <circle cx="19" cy="6" r="0.8" fill="#67e8f9" />
    <circle cx="4" cy="17" r="0.8" fill="#a5f3fc" />
    <circle cx="20" cy="16" r="0.8" fill="#a5f3fc" />
  </svg>
);

export const BombIcon: React.FC<IconProps> = ({ size = 24, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#ef4444', active)}>
    <defs>
      <radialGradient id="bombG" cx="0.35" cy="0.35">
        <stop offset="0" stopColor="#64748b" />
        <stop offset="1" stopColor="#0f172a" />
      </radialGradient>
    </defs>
    {/* 炸弹壳 */}
    <circle cx="12" cy="14" r="7" fill="url(#bombG)" stroke="#fff" strokeWidth="0.6" />
    {/* 高光 */}
    <circle cx="9" cy="11" r="2" fill="#fff" opacity="0.35" />
    {/* 导火索 */}
    <path d="M 12 7 Q 16 5 15 2" stroke="#a16207" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    {/* 点燃的火花 */}
    <circle cx="15" cy="2" r="1.6" fill="#fde047" />
    <circle cx="15" cy="2" r="0.8" fill="#fff" />
    <circle cx="16.5" cy="2.5" r="0.6" fill="#f97316" opacity="0.9" />
    <circle cx="14" cy="1" r="0.5" fill="#f97316" opacity="0.9" />
    {/* 中央警示灯 */}
    <circle cx="12" cy="14" r="2" fill="#ef4444" stroke="#fff" strokeWidth="0.6" />
    <circle cx="12" cy="14" r="0.8" fill="#fff" />
  </svg>
);

export const FlakIcon: React.FC<IconProps> = ({ size = 24, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#f59e0b', active)}>
    {/* 中心炮弹爆裂 */}
    <circle cx="12" cy="12" r="3.5" fill="#fbbf24" stroke="#78350f" strokeWidth="0.8" />
    <circle cx="12" cy="12" r="1.4" fill="#fff" />
    {/* 八方向弹片 */}
    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
      const r = (deg * Math.PI) / 180;
      const x1 = 12 + Math.cos(r) * 5;
      const y1 = 12 + Math.sin(r) * 5;
      const x2 = 12 + Math.cos(r) * 10;
      const y2 = 12 + Math.sin(r) * 10;
      return (
        <g key={i}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fbbf24" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx={x2} cy={y2} r="1" fill="#fef3c7" />
        </g>
      );
    })}
    {/* 外圈爆炸光环 */}
    <circle cx="12" cy="12" r="10.5" fill="none" stroke="#f59e0b" strokeWidth="0.5" opacity="0.5" strokeDasharray="2 2" />
  </svg>
);

export const HelixIcon: React.FC<IconProps> = ({ size = 24, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#4ade80', active)}>
    <defs>
      <linearGradient id="helixA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#86efac" />
        <stop offset="1" stopColor="#15803d" />
      </linearGradient>
      <linearGradient id="helixB" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5eead4" />
        <stop offset="1" stopColor="#0f766e" />
      </linearGradient>
    </defs>
    {/* 两条螺旋 */}
    <path d="M 7 2 Q 17 7 7 12 Q 17 17 7 22" stroke="url(#helixA)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M 17 2 Q 7 7 17 12 Q 7 17 17 22" stroke="url(#helixB)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    {/* 交汇点 */}
    <circle cx="12" cy="7" r="1.4" fill="#fff" />
    <circle cx="12" cy="12" r="1.4" fill="#fff" />
    <circle cx="12" cy="17" r="1.4" fill="#fff" />
  </svg>
);

// ============ 技能图标 ============

export const ShieldSkillIcon: React.FC<IconProps> = ({ size = 24, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#60a5fa', active)}>
    <defs>
      <linearGradient id="shG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#93c5fd" />
        <stop offset="1" stopColor="#1e3a8a" />
      </linearGradient>
    </defs>
    {/* 六边形护盾外壳 */}
    <path d="M 12 2 L 20 6 L 20 14 L 12 22 L 4 14 L 4 6 Z" fill="url(#shG)" stroke="#fff" strokeWidth="0.8" />
    {/* 内部蜂窝 */}
    <path d="M 12 6 L 16 8 L 16 12 L 12 14 L 8 12 L 8 8 Z" fill="none" stroke="#dbeafe" strokeWidth="0.6" opacity="0.7" />
    <line x1="12" y1="6" x2="12" y2="14" stroke="#dbeafe" strokeWidth="0.4" opacity="0.5" />
    <line x1="8" y1="8" x2="16" y2="12" stroke="#dbeafe" strokeWidth="0.4" opacity="0.5" />
    <line x1="16" y1="8" x2="8" y2="12" stroke="#dbeafe" strokeWidth="0.4" opacity="0.5" />
    {/* 中心能量 */}
    <circle cx="12" cy="10" r="1.8" fill="#fff" opacity="0.9" />
  </svg>
);

export const BlackHoleIcon: React.FC<IconProps> = ({ size = 24, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#818cf8', active)}>
    {/* 吸积盘外环 */}
    <ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#818cf8" strokeWidth="1" opacity="0.6" />
    <ellipse cx="12" cy="12" rx="8" ry="3" fill="none" stroke="#a5b4fc" strokeWidth="1.2" />
    {/* 光子环 */}
    <circle cx="12" cy="12" r="5.2" fill="none" stroke="#c7d2fe" strokeWidth="0.8" opacity="0.85" />
    {/* 事件视界 (纯黑) */}
    <circle cx="12" cy="12" r="4" fill="#000" stroke="#fff" strokeWidth="0.6" />
    {/* 吸积尘埃粒子 */}
    <circle cx="20" cy="12" r="0.7" fill="#c7d2fe" />
    <circle cx="4" cy="12" r="0.7" fill="#c7d2fe" />
    <circle cx="17" cy="9" r="0.5" fill="#a5f3fc" />
    <circle cx="7" cy="15" r="0.5" fill="#a5f3fc" />
  </svg>
);

export const ShockwaveIcon: React.FC<IconProps> = ({ size = 24, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#fbbf24', active)}>
    {/* 三圈扩散 */}
    <circle cx="12" cy="12" r="9" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.55" />
    <circle cx="12" cy="12" r="6" fill="none" stroke="#fcd34d" strokeWidth="1.5" opacity="0.85" />
    <circle cx="12" cy="12" r="3" fill="none" stroke="#fef08a" strokeWidth="2" />
    {/* 中心爆点 */}
    <circle cx="12" cy="12" r="1.5" fill="#fff" />
    {/* 放射线 */}
    {[0, 60, 120, 180, 240, 300].map((deg, i) => {
      const r = (deg * Math.PI) / 180;
      const x1 = 12 + Math.cos(r) * 3.5;
      const y1 = 12 + Math.sin(r) * 3.5;
      const x2 = 12 + Math.cos(r) * 5.5;
      const y2 = 12 + Math.sin(r) * 5.5;
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fef08a" strokeWidth="1" strokeLinecap="round" />;
    })}
  </svg>
);

// ============ HUD 状态图标 ============

export const ArmorIcon: React.FC<IconProps> = ({ size = 18, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#ef4444', active)}>
    <defs>
      <linearGradient id="armG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fca5a5" />
        <stop offset="1" stopColor="#991b1b" />
      </linearGradient>
    </defs>
    {/* 盾形护甲 */}
    <path d="M 12 2 L 20 5 L 19 13 Q 19 18 12 22 Q 5 18 5 13 L 4 5 Z"
          fill="url(#armG)" stroke="#fff" strokeWidth="0.7" />
    {/* 护甲板分隔线 */}
    <line x1="12" y1="5" x2="12" y2="21" stroke="#000" strokeWidth="0.5" opacity="0.35" />
    <line x1="6" y1="9" x2="18" y2="9" stroke="#000" strokeWidth="0.5" opacity="0.35" />
    {/* 中央十字强化标 */}
    <path d="M 12 8 L 12 14 M 10 11 L 14 11" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
    {/* 铆钉 */}
    <circle cx="8" cy="7" r="0.5" fill="#fff" opacity="0.6" />
    <circle cx="16" cy="7" r="0.5" fill="#fff" opacity="0.6" />
  </svg>
);

export const EnergyIcon: React.FC<IconProps> = ({ size = 18, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#60a5fa', active)}>
    {/* 能量核心 - 六边形 */}
    <path d="M 12 3 L 19 7 L 19 16 L 12 21 L 5 16 L 5 7 Z"
          fill="#1e40af" stroke="#93c5fd" strokeWidth="0.8" />
    {/* 内部闪电 */}
    <path d="M 13 7 L 9 13 L 12 13 L 11 18 L 15 11 L 12 11 L 14 7 Z"
          fill="#fff" stroke="#bfdbfe" strokeWidth="0.4" />
    {/* 角上能量节点 */}
    <circle cx="12" cy="3" r="1" fill="#dbeafe" />
    <circle cx="12" cy="21" r="1" fill="#dbeafe" />
  </svg>
);

export const TrophyIcon: React.FC<IconProps> = ({ size = 20, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#fde047', active)}>
    <defs>
      <linearGradient id="trophyG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fef08a" />
        <stop offset="1" stopColor="#a16207" />
      </linearGradient>
    </defs>
    {/* 奖杯主体 */}
    <path d="M 6 4 L 18 4 L 17 11 Q 17 16 12 16 Q 7 16 7 11 Z"
          fill="url(#trophyG)" stroke="#713f12" strokeWidth="0.8" />
    {/* 左右耳 */}
    <path d="M 6 5 Q 3 5 3 8 Q 3 11 6 11" fill="none" stroke="#a16207" strokeWidth="1.2" />
    <path d="M 18 5 Q 21 5 21 8 Q 21 11 18 11" fill="none" stroke="#a16207" strokeWidth="1.2" />
    {/* 底座 */}
    <rect x="9" y="16" width="6" height="2" fill="#713f12" />
    <rect x="7" y="18" width="10" height="2.5" rx="0.5" fill="#a16207" stroke="#fde047" strokeWidth="0.6" />
    {/* 高光 */}
    <path d="M 8 6 L 9 10" stroke="#fff" strokeWidth="0.8" opacity="0.6" />
    {/* 五角星 */}
    <path d="M 12 7 L 12.8 9 L 14.9 9 L 13.2 10.3 L 13.9 12.3 L 12 11.1 L 10.1 12.3 L 10.8 10.3 L 9.1 9 L 11.2 9 Z"
          fill="#fff" opacity="0.9" />
  </svg>
);

export const RocketIcon: React.FC<IconProps> = ({ size = 20, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#22d3ee', active)}>
    {/* 机身 */}
    <path d="M 12 2 L 15 8 L 15 16 L 12 18 L 9 16 L 9 8 Z"
          fill="#334155" stroke="#22d3ee" strokeWidth="0.8" />
    {/* 鼻锥 */}
    <path d="M 12 2 L 13 6 L 11 6 Z" fill="#22d3ee" />
    {/* 座舱 */}
    <circle cx="12" cy="10" r="1.6" fill="#fde047" stroke="#78350f" strokeWidth="0.4" />
    {/* 机翼 */}
    <path d="M 9 13 L 4 18 L 8 17 Z" fill="#0f172a" stroke="#22d3ee" strokeWidth="0.6" />
    <path d="M 15 13 L 20 18 L 16 17 Z" fill="#0f172a" stroke="#22d3ee" strokeWidth="0.6" />
    {/* 尾焰 */}
    <path d="M 10 18 L 12 23 L 14 18 Z" fill="#22d3ee" opacity="0.9" />
    <path d="M 11 18 L 12 22 L 13 18 Z" fill="#fff" />
  </svg>
);

export const CrosshairIcon: React.FC<IconProps> = ({ size = 20, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#f87171', active)}>
    <circle cx="12" cy="12" r="9" fill="none" stroke="#f87171" strokeWidth="1.2" />
    <circle cx="12" cy="12" r="4" fill="none" stroke="#f87171" strokeWidth="1" />
    <circle cx="12" cy="12" r="1.2" fill="#fff" />
    <line x1="12" y1="1" x2="12" y2="5" stroke="#f87171" strokeWidth="1.2" />
    <line x1="12" y1="19" x2="12" y2="23" stroke="#f87171" strokeWidth="1.2" />
    <line x1="1" y1="12" x2="5" y2="12" stroke="#f87171" strokeWidth="1.2" />
    <line x1="19" y1="12" x2="23" y2="12" stroke="#f87171" strokeWidth="1.2" />
  </svg>
);

export const TargetIcon: React.FC<IconProps> = ({ size = 20, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#c4b5fd', active)}>
    <circle cx="12" cy="12" r="9" fill="none" stroke="#a78bfa" strokeWidth="1" />
    <circle cx="12" cy="12" r="6" fill="none" stroke="#c4b5fd" strokeWidth="1" />
    <circle cx="12" cy="12" r="3" fill="#7c3aed" stroke="#fff" strokeWidth="0.8" />
    <circle cx="12" cy="12" r="1" fill="#fff" />
    {/* 红点标记 */}
    <circle cx="20" cy="5" r="1.5" fill="#ef4444" />
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size = 20, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#94a3b8', active)}>
    {/* 齿轮 */}
    <g>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
        <rect key={i} x="11" y="2" width="2" height="4" fill="#cbd5e1" transform={`rotate(${deg} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="7" fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="#cbd5e1" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="1" fill="#fff" />
    </g>
  </svg>
);

export const ExitIcon: React.FC<IconProps> = ({ size = 18, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#ef4444', active)}>
    <path d="M 14 3 L 4 3 L 4 21 L 14 21" stroke="#f87171" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M 10 12 L 21 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    <path d="M 17 8 L 21 12 L 17 16" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 14, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#ef4444', active)}>
    <path d="M 5 6 L 19 6" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M 9 6 L 9 4 L 15 4 L 15 6" fill="none" stroke="#ef4444" strokeWidth="1.5" />
    <path d="M 6 6 L 7 20 Q 7 21 8 21 L 16 21 Q 17 21 17 20 L 18 6 Z" fill="#450a0a" stroke="#ef4444" strokeWidth="1.2" />
    <line x1="10" y1="10" x2="10" y2="17" stroke="#fca5a5" strokeWidth="1" />
    <line x1="12" y1="10" x2="12" y2="17" stroke="#fca5a5" strokeWidth="1" />
    <line x1="14" y1="10" x2="14" y2="17" stroke="#fca5a5" strokeWidth="1" />
  </svg>
);

export const SwordsIcon: React.FC<IconProps> = ({ size = 11, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#94a3b8', active)}>
    {/* 左剑 */}
    <line x1="6" y1="2" x2="14" y2="14" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
    <circle cx="5" cy="2" r="1.2" fill="#fde047" />
    {/* 右剑 */}
    <line x1="18" y1="2" x2="10" y2="14" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
    <circle cx="19" cy="2" r="1.2" fill="#fde047" />
    {/* 交叉 */}
    <circle cx="12" cy="14" r="2" fill="#64748b" stroke="#fff" strokeWidth="0.6" />
    <rect x="11" y="14" width="2" height="8" fill="#64748b" stroke="#e2e8f0" strokeWidth="0.5" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size = 24, className, active }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={withGlow('#94a3b8', active)}>
    <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
