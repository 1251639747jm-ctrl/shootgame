/**
 * 肉鸽模式 - 类型定义
 *
 * 核心流程:
 *   选择初始武器 -> 第 N 层: 击败随机 Boss -> 选择增益 -> 下一层
 *
 * 初始武器: 机枪 / 激光 / 魔法阵 (三选一)
 * 魔法阵: 独立升级路线, 可选火系/电系派系
 */

import { WeaponType, EntityType } from "../../types";

// ================== 魔法阵派系 ==================
export enum CircleElement {
    FIRE = 'FIRE',       // 火系: 持续灼烧 + 范围爆炸
    ELECTRIC = 'ELECTRIC' // 电系: 连锁闪电 + 眩晕
}

// ================== 肉鸽状态枚举 ==================
export enum RoguePhase {
    WEAPON_SELECT,   // 选初始武器
    FIGHTING,        // 战斗中 (打 Boss)
    PERK_SELECT,     // 每层结束选增益
    GAME_OVER,       // 死亡
    VICTORY          // 通关 (可选)
}

// ================== 增益/Perk 定义 ==================
export enum PerkId {
    // 通用增益
    DMG_UP          = 'DMG_UP',          // +25% 伤害
    FIRE_RATE_UP    = 'FIRE_RATE_UP',    // +20% 射速
    SPREAD_UP       = 'SPREAD_UP',       // +2 散射弹数
    MAX_HP_UP       = 'MAX_HP_UP',       // +30 最大血量 + 立即回满
    HEAL            = 'HEAL',            // 回复 50% 血量
    MANA_UP         = 'MANA_UP',         // +30 最大魔力
    MOVE_SPEED_UP   = 'MOVE_SPEED_UP',   // +15% 移速
    CRIT_CHANCE     = 'CRIT_CHANCE',     // +10% 暴击率 (2x伤害)

    // 技能解锁
    UNLOCK_SHIELD   = 'UNLOCK_SHIELD',   // 解锁护盾
    UNLOCK_BLACKHOLE= 'UNLOCK_BLACKHOLE',// 解锁黑洞
    UNLOCK_SHOCKWAVE= 'UNLOCK_SHOCKWAVE',// 解锁冲击波
    SKILL_CD_DOWN   = 'SKILL_CD_DOWN',   // 技能冷却 -25%

    // 魔法阵专属 (仅当武器 = MAGIC_CIRCLE 时出现)
    CIRCLE_RADIUS_UP = 'CIRCLE_RADIUS_UP',   // 法阵半径 +20%
    CIRCLE_TICK_UP   = 'CIRCLE_TICK_UP',     // 法阵 tick 频率 +30%
    CIRCLE_BURN_UP   = 'CIRCLE_BURN_UP',     // (火) 灼烧伤害 +40%
    CIRCLE_CHAIN_UP  = 'CIRCLE_CHAIN_UP',    // (电) 连锁数 +2
    CIRCLE_SLOW      = 'CIRCLE_SLOW',        // 法阵内敌人减速 50%

    // 激光专属
    LASER_DPS_UP     = 'LASER_DPS_UP',       // 激光 DPS +30%
    LASER_WIDTH_UP   = 'LASER_WIDTH_UP',     // 光束宽度 +40%
    LASER_CD_DOWN    = 'LASER_CD_DOWN',      // 冷却 -1s

    // 机枪专属
    VULCAN_BOUNCE    = 'VULCAN_BOUNCE',      // 子弹弹射 1 次
    VULCAN_PIERCE    = 'VULCAN_PIERCE',      // 子弹穿透 1 个敌人
    VULCAN_EXPLOSIVE = 'VULCAN_EXPLOSIVE',   // 子弹命中爆炸 (小 AOE)
}

export interface PerkDef {
    id: PerkId;
    name: string;
    desc: string;
    icon: string;       // 简易 emoji/字符, 用于 canvas 绘制
    color: string;      // 卡片主色
    /** 是否只在特定武器时出现 */
    requireWeapon?: 'VULCAN' | 'LASER' | 'MAGIC_CIRCLE';
    /** 是否只在特定元素时出现 */
    requireElement?: CircleElement;
    /** 是否只出现一次 (解锁类) */
    unique?: boolean;
    /** 最多叠几层 (默认无限) */
    maxStack?: number;
}

// ================== 肉鸽运行时状态 ==================
export interface RogueState {
    phase: RoguePhase;
    layer: number;                      // 当前层 (从 1 开始)
    maxLayers: number;                  // 总层数 (默认 10)
    starterWeapon: 'VULCAN' | 'LASER' | 'MAGIC_CIRCLE' | null;
    circleElement: CircleElement | null;

    // 已获得的增益 (可重复, 叠加)
    perks: PerkId[];

    // 当前可选的 3 张卡 (PERK_SELECT 时填充)
    perkChoices: PerkDef[];

    // 累计数值修改 (从 perks 计算得出, 每次选完重新计算)
    modifiers: RogueModifiers;

    // Boss 血量倍率 (随层数递增)
    bossHpScale: number;
}

export interface RogueModifiers {
    damageMultiplier: number;   // 1.0 = 基础
    fireRateMultiplier: number; // 1.0 = 基础
    spreadBonus: number;        // +N 弹数
    maxHpBonus: number;
    maxManaBonus: number;
    moveSpeedMultiplier: number;
    critChance: number;         // 0.0 ~ 1.0
    skillCdMultiplier: number;  // 1.0 = 基础, 越低越好

    // 魔法阵
    circleRadiusMul: number;
    circleTickMul: number;
    circleBurnMul: number;
    circleChainBonus: number;
    circleSlowFactor: number;

    // 激光
    laserDpsMul: number;
    laserWidthMul: number;
    laserCdReduction: number;

    // 机枪
    vulcanBounce: number;
    vulcanPierce: number;
    vulcanExplosive: boolean;

    // 技能解锁
    hasShield: boolean;
    hasBlackhole: boolean;
    hasShockwave: boolean;
}

// ================== 初始武器配置 ==================
export interface StarterConfig {
    key: 'VULCAN' | 'LASER' | 'MAGIC_CIRCLE';
    name: string;
    desc: string;
    color: string;
    icon: string;
}

export const STARTER_OPTIONS: StarterConfig[] = [
    {
        key: 'VULCAN',
        name: '机枪',
        desc: '高射速连发, 升级可获得弹射/穿透/爆炸',
        color: '#facc15',
        icon: '🔫'
    },
    {
        key: 'LASER',
        name: '激光',
        desc: '蓄力单发高伤光束, 升级可拓宽/加 DPS/缩冷却',
        color: '#38bdf8',
        icon: '⚡'
    },
    {
        key: 'MAGIC_CIRCLE',
        name: '魔法阵',
        desc: '持续范围伤害, 可选火系(灼烧)或电系(连锁)',
        color: '#a855f7',
        icon: '🔮'
    }
];

// ================== 所有增益定义池 ==================
export const PERK_POOL: PerkDef[] = [
    // 通用
    { id: PerkId.DMG_UP, name: '伤害强化', desc: '全局伤害 +25%', icon: '⚔️', color: '#ef4444' },
    { id: PerkId.FIRE_RATE_UP, name: '射速强化', desc: '射速 +20%', icon: '💨', color: '#f97316' },
    { id: PerkId.SPREAD_UP, name: '散射强化', desc: '散射弹数 +2', icon: '🌟', color: '#eab308' },
    { id: PerkId.MAX_HP_UP, name: '生命强化', desc: '最大血量 +30, 立即回满', icon: '❤️', color: '#22c55e', maxStack: 5 },
    { id: PerkId.HEAL, name: '紧急修复', desc: '立即回复 50% 血量', icon: '💚', color: '#10b981' },
    { id: PerkId.MANA_UP, name: '魔力强化', desc: '最大魔力 +30', icon: '💙', color: '#3b82f6', maxStack: 4 },
    { id: PerkId.MOVE_SPEED_UP, name: '推进器升级', desc: '移速 +15%', icon: '🚀', color: '#06b6d4', maxStack: 3 },
    { id: PerkId.CRIT_CHANCE, name: '致命精度', desc: '暴击率 +10% (2x 伤害)', icon: '💥', color: '#dc2626', maxStack: 5 },

    // 技能解锁
    { id: PerkId.UNLOCK_SHIELD, name: '护盾模块', desc: '解锁"护盾"主动技能', icon: '🛡️', color: '#3b82f6', unique: true },
    { id: PerkId.UNLOCK_BLACKHOLE, name: '奇点引擎', desc: '解锁"黑洞"主动技能', icon: '🌀', color: '#6366f1', unique: true },
    { id: PerkId.UNLOCK_SHOCKWAVE, name: '冲击波芯片', desc: '解锁"冲击波"主动技能', icon: '💫', color: '#fbbf24', unique: true },
    { id: PerkId.SKILL_CD_DOWN, name: '冷却优化', desc: '所有技能冷却 -25%', icon: '⏱️', color: '#8b5cf6', maxStack: 3 },

    // 魔法阵
    { id: PerkId.CIRCLE_RADIUS_UP, name: '法阵扩展', desc: '法阵半径 +20%', icon: '⭕', color: '#c084fc', requireWeapon: 'MAGIC_CIRCLE', maxStack: 4 },
    { id: PerkId.CIRCLE_TICK_UP, name: '法阵频率', desc: 'Tick 频率 +30%', icon: '🔄', color: '#a78bfa', requireWeapon: 'MAGIC_CIRCLE', maxStack: 3 },
    { id: PerkId.CIRCLE_BURN_UP, name: '烈焰强化', desc: '灼烧伤害 +40%', icon: '🔥', color: '#f97316', requireWeapon: 'MAGIC_CIRCLE', requireElement: CircleElement.FIRE, maxStack: 4 },
    { id: PerkId.CIRCLE_CHAIN_UP, name: '连锁扩展', desc: '闪电连锁数 +2', icon: '⚡', color: '#38bdf8', requireWeapon: 'MAGIC_CIRCLE', requireElement: CircleElement.ELECTRIC, maxStack: 3 },
    { id: PerkId.CIRCLE_SLOW, name: '法阵束缚', desc: '法阵内敌人减速 50%', icon: '🕸️', color: '#d946ef', requireWeapon: 'MAGIC_CIRCLE', unique: true },

    // 激光
    { id: PerkId.LASER_DPS_UP, name: '光束增幅', desc: '激光 DPS +30%', icon: '🔆', color: '#38bdf8', requireWeapon: 'LASER', maxStack: 4 },
    { id: PerkId.LASER_WIDTH_UP, name: '光束扩散', desc: '光束宽度 +40%', icon: '📐', color: '#06b6d4', requireWeapon: 'LASER', maxStack: 3 },
    { id: PerkId.LASER_CD_DOWN, name: '快速充能', desc: '冷却时间 -1 秒', icon: '⏩', color: '#0ea5e9', requireWeapon: 'LASER', maxStack: 2 },

    // 机枪
    { id: PerkId.VULCAN_BOUNCE, name: '弹射弹头', desc: '子弹命中后弹射 1 次', icon: '↗️', color: '#facc15', requireWeapon: 'VULCAN', unique: true },
    { id: PerkId.VULCAN_PIERCE, name: '穿甲弹', desc: '子弹穿透 +1 个敌人', icon: '🔩', color: '#d97706', requireWeapon: 'VULCAN', maxStack: 2 },
    { id: PerkId.VULCAN_EXPLOSIVE, name: '爆裂弹', desc: '命中时小范围爆炸', icon: '💣', color: '#ef4444', requireWeapon: 'VULCAN', unique: true },
];

// ================== 工具函数 ==================

/** 根据当前状态计算 modifiers */
export function computeModifiers(perks: PerkId[]): RogueModifiers {
    const m: RogueModifiers = {
        damageMultiplier: 1,
        fireRateMultiplier: 1,
        spreadBonus: 0,
        maxHpBonus: 0,
        maxManaBonus: 0,
        moveSpeedMultiplier: 1,
        critChance: 0,
        skillCdMultiplier: 1,
        circleRadiusMul: 1,
        circleTickMul: 1,
        circleBurnMul: 1,
        circleChainBonus: 0,
        circleSlowFactor: 0,
        laserDpsMul: 1,
        laserWidthMul: 1,
        laserCdReduction: 0,
        vulcanBounce: 0,
        vulcanPierce: 0,
        vulcanExplosive: false,
        hasShield: false,
        hasBlackhole: false,
        hasShockwave: false
    };

    for (const p of perks) {
        switch (p) {
            case PerkId.DMG_UP:           m.damageMultiplier *= 1.25; break;
            case PerkId.FIRE_RATE_UP:     m.fireRateMultiplier *= 1.2; break;
            case PerkId.SPREAD_UP:        m.spreadBonus += 2; break;
            case PerkId.MAX_HP_UP:        m.maxHpBonus += 30; break;
            case PerkId.MANA_UP:          m.maxManaBonus += 30; break;
            case PerkId.MOVE_SPEED_UP:    m.moveSpeedMultiplier *= 1.15; break;
            case PerkId.CRIT_CHANCE:      m.critChance = Math.min(1, m.critChance + 0.1); break;
            case PerkId.SKILL_CD_DOWN:    m.skillCdMultiplier *= 0.75; break;

            case PerkId.UNLOCK_SHIELD:    m.hasShield = true; break;
            case PerkId.UNLOCK_BLACKHOLE: m.hasBlackhole = true; break;
            case PerkId.UNLOCK_SHOCKWAVE: m.hasShockwave = true; break;

            case PerkId.CIRCLE_RADIUS_UP: m.circleRadiusMul *= 1.2; break;
            case PerkId.CIRCLE_TICK_UP:   m.circleTickMul *= 1.3; break;
            case PerkId.CIRCLE_BURN_UP:   m.circleBurnMul *= 1.4; break;
            case PerkId.CIRCLE_CHAIN_UP:  m.circleChainBonus += 2; break;
            case PerkId.CIRCLE_SLOW:      m.circleSlowFactor = 0.5; break;

            case PerkId.LASER_DPS_UP:     m.laserDpsMul *= 1.3; break;
            case PerkId.LASER_WIDTH_UP:   m.laserWidthMul *= 1.4; break;
            case PerkId.LASER_CD_DOWN:    m.laserCdReduction += 1; break;

            case PerkId.VULCAN_BOUNCE:    m.vulcanBounce = 1; break;
            case PerkId.VULCAN_PIERCE:    m.vulcanPierce += 1; break;
            case PerkId.VULCAN_EXPLOSIVE: m.vulcanExplosive = true; break;

            case PerkId.HEAL: break; // 即时效果, 不影响 modifiers
        }
    }
    return m;
}

/** 从 perk 池中按当前条件抽取 N 张不重复卡 */
export function drawPerks(
    state: RogueState,
    count: number = 3
): PerkDef[] {
    const eligible = PERK_POOL.filter(def => {
        // 武器限定
        if (def.requireWeapon && def.requireWeapon !== state.starterWeapon) return false;
        // 元素限定
        if (def.requireElement && def.requireElement !== state.circleElement) return false;
        // 唯一性: 已经拥有则不再出现
        if (def.unique && state.perks.includes(def.id)) return false;
        // 叠加上限
        if (def.maxStack) {
            const count = state.perks.filter(p => p === def.id).length;
            if (count >= def.maxStack) return false;
        }
        return true;
    });

    // Fisher-Yates 取前 N 个
    const shuffled = [...eligible];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
}

/** 创建初始 RogueState */
export function createRogueState(): RogueState {
    return {
        phase: RoguePhase.WEAPON_SELECT,
        layer: 0,
        maxLayers: 10,
        starterWeapon: null,
        circleElement: null,
        perks: [],
        perkChoices: [],
        modifiers: computeModifiers([]),
        bossHpScale: 1
    };
}
