/**
 * 肉鸽模式 - 类型定义
 *
 * 核心流程:
 *   选择初始武器 -> 第 N 层: 击败随机 Boss -> 选择增益 -> 下一层
 *
 * 初始武器: 机枪 / 激光 / 魔法阵 (三选一)
 * 魔法阵: 手动施法系统, 选择火 / 电派系, 各 5 个法术, Q 切换 / 开火释放
 *
 * 魔法阵增益分两类:
 *   1) 全法术整体增益: 冷却 / 伤害 / 范围 / 蓄力速度 (每法术都受益, 较小幅度)
 *   2) 单法术专属增益: 针对该法术的"痛点"做强化
 *      (例: 数量型 +N 颗, 单体型 加余震, 区域型 加时长 等)
 */

import { WeaponType, EntityType } from "../../types";

// ================== 魔法阵派系 ==================
export enum CircleElement {
    FIRE = 'FIRE',       // 火系: AOE / 范围爆发
    ELECTRIC = 'ELECTRIC' // 电系: 单体追踪 / 连锁
}

// ================== 魔法阵技能 ID ==================
export enum MagicSkillId {
    // 火系 5 个
    FIRE_METEOR  = 'FIRE_METEOR',   // 流星雨: 5 颗流星砸向目标点
    FIRE_NOVA    = 'FIRE_NOVA',     // 火焰新星: 玩家周围环形火浪扩散
    FIRE_MAGMA   = 'FIRE_MAGMA',    // 熔岩飞弹: 3 发追踪火球
    FIRE_INFERNO = 'FIRE_INFERNO',  // 烈焰风暴: 持续 4s 旋转火域
    FIRE_HAMMER  = 'FIRE_HAMMER',   // 火神之锤: Boss 头顶天降爆锤

    // 电系 5 个
    ELEC_CHAIN   = 'ELEC_CHAIN',    // 闪电链: 8 跳连锁
    ELEC_THUNDER = 'ELEC_THUNDER',  // 天雷: 5 道随机天雷
    ELEC_STATIC  = 'ELEC_STATIC',   // 静电场: 玩家持续电场
    ELEC_RAILGUN = 'ELEC_RAILGUN',  // 电磁轨道炮: 高伤穿透电弧
    ELEC_PLASMA  = 'ELEC_PLASMA',   // 电浆轰炸: 4 颗追踪电浆球
}

/** 魔法阵单个技能的元数据 */
export interface MagicSkillDef {
    id: MagicSkillId;
    name: string;
    castTime: number;       // 蓄力时长 (秒, 在玩家位置绘制法阵的时间)
    cooldown: number;       // 冷却 (秒)
    baseDamage: number;     // 基础伤害 (受 dmgMul 影响)
    baseRange: number;      // 基础范围参数 (语义因技能而异: 半径/距离/宽度等, 受 rangeMul 影响)
    color: string;          // 法阵主色
    runeStyle: number;      // 法阵图案样式 ID (0..9)
    desc: string;           // UI 描述
}

// ================== 肉鸽状态枚举 ==================
export enum RoguePhase {
    WEAPON_SELECT,   // 选初始武器
    ELEMENT_SELECT,  // 选魔法阵派系 (仅当选了魔法阵)
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

    // === 魔法阵 全法术整体增益 (4 类, 都受益小幅度) ===
    CIRCLE_CD_DOWN     = 'CIRCLE_CD_DOWN',     // 法术冷却 -20%
    CIRCLE_DMG_UP      = 'CIRCLE_DMG_UP',      // 法术伤害 +30%
    CIRCLE_RANGE_UP    = 'CIRCLE_RANGE_UP',    // 法术范围 +25%
    CIRCLE_QUICK_CAST  = 'CIRCLE_QUICK_CAST',  // 蓄力时长 -30%

    // === 魔法阵 单法术专属 (10 法术 × 2 = 20 个, 针对痛点) ===
    // 火系
    METEOR_COUNT       = 'METEOR_COUNT',       // 流星雨 +2 颗
    METEOR_SPLIT       = 'METEOR_SPLIT',       // 流星雨 落地分裂 3 颗子流星

    NOVA_DOUBLE        = 'NOVA_DOUBLE',        // 火焰新星 二段爆 (略大半径)
    NOVA_BURN          = 'NOVA_BURN',          // 火焰新星 留下 2s 灼烧地带

    MAGMA_COUNT        = 'MAGMA_COUNT',        // 熔岩飞弹 +2 颗
    MAGMA_EXPLODE      = 'MAGMA_EXPLODE',      // 熔岩飞弹 爆炸半径 +100%

    INFERNO_DURATION   = 'INFERNO_DURATION',   // 烈焰风暴 +2 秒持续
    INFERNO_FOLLOW     = 'INFERNO_FOLLOW',     // 烈焰风暴 跟随玩家

    HAMMER_AFTERSHOCK  = 'HAMMER_AFTERSHOCK',  // 火神之锤 +1 道余震环
    HAMMER_SPLASH      = 'HAMMER_SPLASH',      // 火神之锤 召唤 4 颗溅射流星

    // 电系
    CHAIN_JUMPS        = 'CHAIN_JUMPS',        // 闪电链 +4 跳
    CHAIN_NODECAY      = 'CHAIN_NODECAY',      // 闪电链 不衰减伤害

    THUNDER_BOLTS      = 'THUNDER_BOLTS',      // 天雷 +3 道
    THUNDER_OVERCHARGE = 'THUNDER_OVERCHARGE', // 天雷 蓄电核心 (1s 后再爆)

    STATIC_DURATION    = 'STATIC_DURATION',    // 静电场 +2 秒持续
    STATIC_SLOW        = 'STATIC_SLOW',        // 静电场 阵内减速 + 半径 +50%

    RAILGUN_WIDTH      = 'RAILGUN_WIDTH',      // 电磁轨道炮 宽度 +100%
    RAILGUN_DOUBLE     = 'RAILGUN_DOUBLE',     // 电磁轨道炮 双发

    PLASMA_COUNT       = 'PLASMA_COUNT',       // 电浆轰炸 +2 颗
    PLASMA_SPLIT       = 'PLASMA_SPLIT',       // 电浆轰炸 命中后分裂

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
    /** 是否只在选了特定法术派系时才出现 (用于专属增益限定到火系/电系) */
    requireSpell?: MagicSkillId;
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

/**
 * 每法术专属增益的扁平字典. 由 RogueModifiers.spellPerks[skillId] 索引到.
 * key 与 MagicCircle.fire() 内部使用的字符串保持一致.
 *   layers: 该 perk 已经被选了几次 (大部分 unique = 0 或 1)
 */
export type PerSpellPerks = { [key: string]: number };

export interface RogueModifiers {
    damageMultiplier: number;   // 1.0 = 基础
    fireRateMultiplier: number; // 1.0 = 基础
    spreadBonus: number;        // +N 弹数
    maxHpBonus: number;
    maxManaBonus: number;
    moveSpeedMultiplier: number;
    critChance: number;         // 0.0 ~ 1.0
    skillCdMultiplier: number;  // 1.0 = 基础, 越低越好

    // 魔法阵 全法术整体增益
    circleCdMul: number;        // 1.0 = 基础, < 1 缩短法术冷却
    circleDmgMul: number;       // 1.0 = 基础, > 1 增加法术伤害
    circleRangeMul: number;     // 1.0 = 基础, > 1 扩大法术范围
    circleCastSpeedMul: number; // 1.0 = 基础, < 1 蓄力更快

    // 魔法阵 单法术专属增益
    // spellPerks[FIRE_METEOR]['count'] = 1 -> 流星雨多了 1 层 "+2 颗" perk
    spellPerks: Record<MagicSkillId, PerSpellPerks>;

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
        desc: '5 个法术手动切换释放, 每个都有专属强化',
        color: '#a855f7',
        icon: '🔮'
    }
];

// ================== 所有增益定义池 ==================
export const PERK_POOL: PerkDef[] = [
    // ----- 通用 -----
    { id: PerkId.DMG_UP, name: '伤害强化', desc: '全局伤害 +25%', icon: '⚔️', color: '#ef4444' },
    { id: PerkId.FIRE_RATE_UP, name: '射速强化', desc: '射速 +20%', icon: '💨', color: '#f97316' },
    // 散射只对机枪有意义
    { id: PerkId.SPREAD_UP, name: '散射强化', desc: '散射弹数 +2', icon: '🌟', color: '#eab308', requireWeapon: 'VULCAN' },
    { id: PerkId.MAX_HP_UP, name: '生命强化', desc: '最大血量 +30, 立即回满', icon: '❤️', color: '#22c55e', maxStack: 5 },
    { id: PerkId.HEAL, name: '紧急修复', desc: '立即回复 50% 血量', icon: '💚', color: '#10b981' },
    { id: PerkId.MANA_UP, name: '魔力强化', desc: '最大魔力 +30', icon: '💙', color: '#3b82f6', maxStack: 4 },
    { id: PerkId.MOVE_SPEED_UP, name: '推进器升级', desc: '移速 +15%', icon: '🚀', color: '#06b6d4', maxStack: 3 },
    { id: PerkId.CRIT_CHANCE, name: '致命精度', desc: '暴击率 +10% (2x 伤害)', icon: '💥', color: '#dc2626', maxStack: 5 },

    // ----- 主动技能解锁 -----
    { id: PerkId.UNLOCK_SHIELD, name: '护盾模块', desc: '解锁"护盾"主动技能', icon: '🛡️', color: '#3b82f6', unique: true },
    { id: PerkId.UNLOCK_BLACKHOLE, name: '奇点引擎', desc: '解锁"黑洞"主动技能', icon: '🌀', color: '#6366f1', unique: true },
    { id: PerkId.UNLOCK_SHOCKWAVE, name: '冲击波芯片', desc: '解锁"冲击波"主动技能', icon: '💫', color: '#fbbf24', unique: true },
    { id: PerkId.SKILL_CD_DOWN, name: '冷却优化', desc: '所有技能冷却 -25%', icon: '⏱️', color: '#8b5cf6', maxStack: 3 },

    // ----- 魔法阵 全法术整体增益 (4 类) -----
    { id: PerkId.CIRCLE_CD_DOWN,    name: '法阵冷却',   desc: '所有法术冷却 -20%',   icon: '⏱️', color: '#a78bfa', requireWeapon: 'MAGIC_CIRCLE', maxStack: 4 },
    { id: PerkId.CIRCLE_DMG_UP,     name: '法阵增幅',   desc: '所有法术伤害 +30%',   icon: '🔥', color: '#f43f5e', requireWeapon: 'MAGIC_CIRCLE', maxStack: 5 },
    { id: PerkId.CIRCLE_RANGE_UP,   name: '法阵扩域',   desc: '所有法术范围 +25%',   icon: '⭕', color: '#c084fc', requireWeapon: 'MAGIC_CIRCLE', maxStack: 4 },
    { id: PerkId.CIRCLE_QUICK_CAST, name: '极速蓄力',   desc: '蓄力时长 -30%',       icon: '⚡', color: '#22d3ee', requireWeapon: 'MAGIC_CIRCLE', maxStack: 2 },

    // ----- 魔法阵 单法术专属 · 火系 -----
    { id: PerkId.METEOR_COUNT,      name: '流星增援', desc: '流星雨 +2 颗流星',         icon: '☄️', color: '#fb923c', requireSpell: MagicSkillId.FIRE_METEOR, maxStack: 3 },
    { id: PerkId.METEOR_SPLIT,      name: '碎裂陨石', desc: '流星落地分裂 3 颗子流星',  icon: '💥', color: '#f97316', requireSpell: MagicSkillId.FIRE_METEOR, unique: true },

    { id: PerkId.NOVA_DOUBLE,       name: '二段爆裂', desc: '火焰新星 0.3s 后再爆一次', icon: '🌋', color: '#fb923c', requireSpell: MagicSkillId.FIRE_NOVA, unique: true },
    { id: PerkId.NOVA_BURN,         name: '余烬地带', desc: '新星留下 2s 持续灼烧',     icon: '🔥', color: '#f97316', requireSpell: MagicSkillId.FIRE_NOVA, unique: true },

    { id: PerkId.MAGMA_COUNT,       name: '熔岩齐射', desc: '熔岩飞弹 +2 颗',            icon: '🪨', color: '#ef4444', requireSpell: MagicSkillId.FIRE_MAGMA, maxStack: 3 },
    { id: PerkId.MAGMA_EXPLODE,     name: '裂地爆炸', desc: '熔岩飞弹爆炸半径 +100%',    icon: '💣', color: '#dc2626', requireSpell: MagicSkillId.FIRE_MAGMA, maxStack: 2 },

    { id: PerkId.INFERNO_DURATION,  name: '永焰', desc: '烈焰风暴持续 +2 秒',           icon: '⏳', color: '#dc2626', requireSpell: MagicSkillId.FIRE_INFERNO, maxStack: 3 },
    { id: PerkId.INFERNO_FOLLOW,    name: '烈焰附身', desc: '烈焰风暴跟随玩家移动',     icon: '👤', color: '#fb923c', requireSpell: MagicSkillId.FIRE_INFERNO, unique: true },

    { id: PerkId.HAMMER_AFTERSHOCK, name: '余震', desc: '火神之锤 +1 道扩散冲击环',     icon: '〰️', color: '#fbbf24', requireSpell: MagicSkillId.FIRE_HAMMER, maxStack: 3 },
    { id: PerkId.HAMMER_SPLASH,     name: '飞火溅星', desc: '火神之锤召唤 4 颗溅射流星', icon: '🌟', color: '#fb923c', requireSpell: MagicSkillId.FIRE_HAMMER, unique: true },

    // ----- 魔法阵 单法术专属 · 电系 -----
    { id: PerkId.CHAIN_JUMPS,       name: '链式扩展', desc: '闪电链 +4 跳',              icon: '🔗', color: '#a78bfa', requireSpell: MagicSkillId.ELEC_CHAIN, maxStack: 2 },
    { id: PerkId.CHAIN_NODECAY,     name: '完美导体', desc: '闪电链跳数无伤害衰减',      icon: '⚡', color: '#c084fc', requireSpell: MagicSkillId.ELEC_CHAIN, unique: true },

    { id: PerkId.THUNDER_BOLTS,     name: '雷霆增幅', desc: '天雷 +3 道',                icon: '🌩️', color: '#c084fc', requireSpell: MagicSkillId.ELEC_THUNDER, maxStack: 2 },
    { id: PerkId.THUNDER_OVERCHARGE,name: '蓄电核心', desc: '天雷落点 1s 后再爆一次',    icon: '🔋', color: '#a78bfa', requireSpell: MagicSkillId.ELEC_THUNDER, unique: true },

    { id: PerkId.STATIC_DURATION,   name: '持久磁场', desc: '静电场持续 +2 秒',           icon: '⏳', color: '#8b5cf6', requireSpell: MagicSkillId.ELEC_STATIC, maxStack: 3 },
    { id: PerkId.STATIC_SLOW,       name: '电磁束缚', desc: '静电场范围 +50% & 减速敌人', icon: '🕸️', color: '#a78bfa', requireSpell: MagicSkillId.ELEC_STATIC, unique: true },

    { id: PerkId.RAILGUN_WIDTH,     name: '加宽聚束', desc: '电磁轨道炮宽度 +100%',       icon: '📐', color: '#22d3ee', requireSpell: MagicSkillId.ELEC_RAILGUN, maxStack: 2 },
    { id: PerkId.RAILGUN_DOUBLE,    name: '双管齐射', desc: '电磁轨道炮 0.12s 后再射一发', icon: '🎯', color: '#06b6d4', requireSpell: MagicSkillId.ELEC_RAILGUN, unique: true },

    { id: PerkId.PLASMA_COUNT,      name: '电浆增量', desc: '电浆轰炸 +2 颗',             icon: '🔮', color: '#6366f1', requireSpell: MagicSkillId.ELEC_PLASMA, maxStack: 2 },
    { id: PerkId.PLASMA_SPLIT,      name: '电浆裂变', desc: '电浆球命中后分裂 4 颗小球',  icon: '💠', color: '#818cf8', requireSpell: MagicSkillId.ELEC_PLASMA, unique: true },

    // ----- 激光 -----
    { id: PerkId.LASER_DPS_UP, name: '光束增幅', desc: '激光 DPS +30%', icon: '🔆', color: '#38bdf8', requireWeapon: 'LASER', maxStack: 4 },
    { id: PerkId.LASER_WIDTH_UP, name: '光束扩散', desc: '光束宽度 +40%', icon: '📐', color: '#06b6d4', requireWeapon: 'LASER', maxStack: 3 },
    { id: PerkId.LASER_CD_DOWN, name: '快速充能', desc: '冷却时间 -1 秒', icon: '⏩', color: '#0ea5e9', requireWeapon: 'LASER', maxStack: 2 },

    // ----- 机枪 -----
    { id: PerkId.VULCAN_BOUNCE, name: '弹射弹头', desc: '子弹命中后弹射 1 次', icon: '↗️', color: '#facc15', requireWeapon: 'VULCAN', unique: true },
    { id: PerkId.VULCAN_PIERCE, name: '穿甲弹', desc: '子弹穿透 +1 个敌人', icon: '🔩', color: '#d97706', requireWeapon: 'VULCAN', maxStack: 2 },
    { id: PerkId.VULCAN_EXPLOSIVE, name: '爆裂弹', desc: '命中时小范围爆炸', icon: '💣', color: '#ef4444', requireWeapon: 'VULCAN', unique: true },
];

/** 给单法术专属 perk 用: perk id -> [skillId, key]
 *  computeModifiers 根据这个表把 perk 累加到 spellPerks[skillId][key].
 *  key 必须和 MagicCircle.fire() 中 spellPerk(id, 'xxx') 的字符串一致.
 */
const SPELL_PERK_MAP: Partial<Record<PerkId, [MagicSkillId, string]>> = {
    [PerkId.METEOR_COUNT]:       [MagicSkillId.FIRE_METEOR, 'count'],
    [PerkId.METEOR_SPLIT]:       [MagicSkillId.FIRE_METEOR, 'split'],
    [PerkId.NOVA_DOUBLE]:        [MagicSkillId.FIRE_NOVA, 'doubleBlast'],
    [PerkId.NOVA_BURN]:          [MagicSkillId.FIRE_NOVA, 'burnGround'],
    [PerkId.MAGMA_COUNT]:        [MagicSkillId.FIRE_MAGMA, 'count'],
    [PerkId.MAGMA_EXPLODE]:      [MagicSkillId.FIRE_MAGMA, 'explode'],
    [PerkId.INFERNO_DURATION]:   [MagicSkillId.FIRE_INFERNO, 'duration'],
    [PerkId.INFERNO_FOLLOW]:     [MagicSkillId.FIRE_INFERNO, 'follow'],
    [PerkId.HAMMER_AFTERSHOCK]:  [MagicSkillId.FIRE_HAMMER, 'aftershock'],
    [PerkId.HAMMER_SPLASH]:      [MagicSkillId.FIRE_HAMMER, 'splash'],

    [PerkId.CHAIN_JUMPS]:        [MagicSkillId.ELEC_CHAIN, 'jumps'],
    [PerkId.CHAIN_NODECAY]:      [MagicSkillId.ELEC_CHAIN, 'noDecay'],
    [PerkId.THUNDER_BOLTS]:      [MagicSkillId.ELEC_THUNDER, 'bolts'],
    [PerkId.THUNDER_OVERCHARGE]: [MagicSkillId.ELEC_THUNDER, 'overcharge'],
    [PerkId.STATIC_DURATION]:    [MagicSkillId.ELEC_STATIC, 'duration'],
    [PerkId.STATIC_SLOW]:        [MagicSkillId.ELEC_STATIC, 'slow'],
    [PerkId.RAILGUN_WIDTH]:      [MagicSkillId.ELEC_RAILGUN, 'width'],
    [PerkId.RAILGUN_DOUBLE]:     [MagicSkillId.ELEC_RAILGUN, 'double'],
    [PerkId.PLASMA_COUNT]:       [MagicSkillId.ELEC_PLASMA, 'count'],
    [PerkId.PLASMA_SPLIT]:       [MagicSkillId.ELEC_PLASMA, 'split'],
};

/** 单法术 perk 限定到火/电系: 选了火系则只出现火系法术的 perk */
const SPELL_TO_ELEMENT: Record<MagicSkillId, CircleElement> = {
    [MagicSkillId.FIRE_METEOR]:  CircleElement.FIRE,
    [MagicSkillId.FIRE_NOVA]:    CircleElement.FIRE,
    [MagicSkillId.FIRE_MAGMA]:   CircleElement.FIRE,
    [MagicSkillId.FIRE_INFERNO]: CircleElement.FIRE,
    [MagicSkillId.FIRE_HAMMER]:  CircleElement.FIRE,
    [MagicSkillId.ELEC_CHAIN]:   CircleElement.ELECTRIC,
    [MagicSkillId.ELEC_THUNDER]: CircleElement.ELECTRIC,
    [MagicSkillId.ELEC_STATIC]:  CircleElement.ELECTRIC,
    [MagicSkillId.ELEC_RAILGUN]: CircleElement.ELECTRIC,
    [MagicSkillId.ELEC_PLASMA]:  CircleElement.ELECTRIC,
};

// ================== 工具函数 ==================

function emptySpellPerks(): Record<MagicSkillId, PerSpellPerks> {
    const out: any = {};
    for (const id of Object.values(MagicSkillId)) {
        out[id] = {};
    }
    return out as Record<MagicSkillId, PerSpellPerks>;
}

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
        circleCdMul: 1,
        circleDmgMul: 1,
        circleRangeMul: 1,
        circleCastSpeedMul: 1,
        spellPerks: emptySpellPerks(),
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
        // 单法术专属 perk: 通过 SPELL_PERK_MAP 累加到 spellPerks[skillId][key]
        const mapped = SPELL_PERK_MAP[p];
        if (mapped) {
            const [skillId, key] = mapped;
            m.spellPerks[skillId][key] = (m.spellPerks[skillId][key] ?? 0) + 1;
            continue;
        }

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

            case PerkId.CIRCLE_CD_DOWN:    m.circleCdMul *= 0.8; break;
            case PerkId.CIRCLE_DMG_UP:     m.circleDmgMul *= 1.3; break;
            case PerkId.CIRCLE_RANGE_UP:   m.circleRangeMul *= 1.25; break;
            case PerkId.CIRCLE_QUICK_CAST: m.circleCastSpeedMul *= 0.7; break;

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

/** 从 perk 池中按当前条件抽取 N 张不重复卡.
 * 规则: 尽量保证 "武器专属" 和 "通用" 都有出现, 避免玩家全是通用或全是武器偏科.
 */
export function drawPerks(
    state: RogueState,
    count: number = 3
): PerkDef[] {
    const eligible = PERK_POOL.filter(def => {
        // 武器限定
        if (def.requireWeapon && def.requireWeapon !== state.starterWeapon) return false;
        // 元素限定
        if (def.requireElement && def.requireElement !== state.circleElement) return false;
        // 法术专属: 仅当玩家选了魔法阵 + 该法术属于玩家当前派系时才出现
        if (def.requireSpell) {
            if (state.starterWeapon !== 'MAGIC_CIRCLE') return false;
            if (state.circleElement !== SPELL_TO_ELEMENT[def.requireSpell]) return false;
        }
        // 唯一性: 已经拥有则不再出现
        if (def.unique && state.perks.includes(def.id)) return false;
        // 叠加上限
        if (def.maxStack) {
            const c = state.perks.filter(p => p === def.id).length;
            if (c >= def.maxStack) return false;
        }
        return true;
    });

    // 分类: 武器专属 vs 通用
    const weaponSpecific = eligible.filter(d => d.requireWeapon || d.requireElement || d.requireSpell);
    const generic        = eligible.filter(d => !d.requireWeapon && !d.requireElement && !d.requireSpell);

    const shuffle = <T>(arr: T[]): T[] => {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    };

    const sWeapon  = shuffle(weaponSpecific);
    const sGeneric = shuffle(generic);
    const picked: PerkDef[] = [];

    // 先保证抽 1~2 张武器专属 (如果池子里有)
    const targetWeapon = Math.min(sWeapon.length, Math.max(1, Math.floor(count / 2)));
    for (let i = 0; i < targetWeapon && picked.length < count; i++) {
        picked.push(sWeapon[i]);
    }
    // 再填通用
    for (const g of sGeneric) {
        if (picked.length >= count) break;
        picked.push(g);
    }
    // 还不够 (通用不够时, 再塞武器专属)
    for (const w of sWeapon) {
        if (picked.length >= count) break;
        if (!picked.includes(w)) picked.push(w);
    }

    return picked.slice(0, count);
}

/** 创建初始 RogueState */
export function createRogueState(): RogueState {
    return {
        phase: RoguePhase.WEAPON_SELECT,
        layer: 0,
        maxLayers: 9999,   // 无限层 (UI 显示 "∞")
        starterWeapon: null,
        circleElement: null,
        perks: [],
        perkChoices: [],
        modifiers: computeModifiers([]),
        bossHpScale: 1
    };
}
