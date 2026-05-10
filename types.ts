export interface Vector2 {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export enum GameState {
  MENU,
  PLAYING,
  GAME_OVER,
  PAUSED,
  VICTORY,
  PRACTICE // 武器试验场
}

// 练习场里可生成的 Bot 类型
export enum BotKind {
  BASIC,
  FAST,
  TANK,
  KAMIKAZE,
  SHIELDER,
  SNIPER,
  SWARMER,
  BOSS,
  BOSS_CARRIER,
  BOSS_REAVER,
  STATIC // 靶子：不动，用来测 DPS
}

export enum EntityType {
  PLAYER,
  ENEMY_BASIC,
  ENEMY_FAST,
  ENEMY_TANK,
  ENEMY_KAMIKAZE,
  ENEMY_SHIELDER,
  ENEMY_SNIPER,
  ENEMY_SWARMER,
  ENEMY_BOSS,
  ENEMY_BOSS_CARRIER,
  ENEMY_BOSS_REAVER,
  BULLET_PLAYER,
  BULLET_ENEMY,
  PARTICLE,
  CHARGE_PARTICLE, 
  STAR,
  NEBULA,
  ITEM,
  SKILL_SHIELD,
  SKILL_SHOCKWAVE,
  SKILL_BLACKHOLE,
  FLOATING_TEXT,
  // New Types
  WEAPON_LASER,
  WEAPON_TESLA,
  WEAPON_BOMB,
  WEAPON_MISSILE, // New
  EXPLOSION_EFFECT
}

export enum WeaponType {
  VULCAN,
  LASER,
  PLASMA,    // tracking missile
  TESLA,
  BOMB,
  RAILGUN,   // 电磁轨道炮: 高伤穿透
  SPREAD     // 散弹: 7发扇形
}

export enum ItemType {
  HEALTH,
  MANA, 
  WEAPON_UP
}

export interface SkillCooldown {
  current: number;
  max: number;
  active: boolean;
  duration?: number;
  activeTimer?: number;
}

export interface PlayerState {
    health: number;
    maxHealth: number;
    mana: number;
    maxMana: number;
    score: number;
    skills: {
        shield: SkillCooldown;
        blackhole: SkillCooldown;
        shockwave: SkillCooldown;
    }
}

export interface GameSettings {
    difficulty: 'EASY' | 'NORMAL' | 'HARD';
    effectQuality: 'LOW' | 'HIGH';
}

export interface GameConfig {
  width: number;
  height: number;
  settings: GameSettings;
}

export interface GameRef {
  switchWeapon: () => void;
  triggerSkill: (skillIndex: number) => void;
  getPlayerState: () => PlayerState | null;
  updateSettings: (settings: GameSettings) => void;
  // For touch HUD: notify engine when a touch belongs to a UI button, so the global
  // touch handler in InputManager ignores it for movement/firing.
  markUITouch: (id: number) => void;
  unmarkUITouch: (id: number) => void;
  getJoystickState: () => { active: boolean; base: Vector2; knob: Vector2 };
  // Practice mode
  startPractice: () => void;
  stopPractice: () => void;
  spawnPracticeBot: (kind: BotKind) => void;
  clearPracticeBots: () => void;
  selectWeapon: (w: WeaponType) => void;
}
