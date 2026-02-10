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
  VICTORY 
}

export enum EntityType {
  PLAYER,
  ENEMY_BASIC,
  ENEMY_FAST,
  ENEMY_TANK,
  ENEMY_KAMIKAZE,
  ENEMY_BOSS, 
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
  PLASMA, // Now uses Missile logic
  TESLA,
  BOMB
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
}
