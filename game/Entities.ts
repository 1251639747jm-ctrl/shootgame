import { EntityType, Vector2, WeaponType, ItemType } from "../types";

/**
 * ==================================================================================
 * SECTION 1: 核心物理与基础系统
 * ==================================================================================
 */

// 增加基础向量运算助手，减少代码冗余并提升计算复杂度
const vec = {
    add: (v1: Vector2, v2: Vector2) => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
    sub: (v1: Vector2, v2: Vector2) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
    mul: (v: Vector2, s: number) => ({ x: v.x * s, y: v.y * s }),
    mag: (v: Vector2) => Math.sqrt(v.x * v.x + v.y * v.y),
    normalize: (v: Vector2) => {
        const m = Math.sqrt(v.x * v.x + v.y * v.y);
        return m > 0 ? { x: v.x / m, y: v.y / m } : { x: 0, y: 0 };
    },
    dist: (v1: Vector2, v2: Vector2) => Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2),
    lerp: (v1: Vector2, v2: Vector2, t: number) => ({
        x: v1.x + (v2.x - v1.x) * t,
        y: v1.y + (v2.y - v1.y) * t
    })
};

export abstract class Entity {
    id: string = crypto.randomUUID();
    position: Vector2;
    velocity: Vector2 = { x: 0, y: 0 };
    acceleration: Vector2 = { x: 0, y: 0 };
    
    radius: number = 10;
    type: EntityType;
    rotation: number = 0;
    targetRotation: number = 0;
    
    opacity: number = 1;
    markedForDeletion: boolean = false;
    
    // 视觉与物理层级
    zOrder: number = 0;
    mass: number = 1.0;
    friction: number = 0.95; // 阻尼系数

    // 时间戳管理
    spawnTime: number = performance.now();
    age: number = 0;

    constructor(x: number, y: number, type: EntityType) {
        this.position = { x, y };
        this.type = type;
    }

    /**
     * 基础物理更新逻辑
     */
    protected applyPhysics(dt: number) {
        // 速度集成 (Euler Integration)
        this.velocity.x += this.acceleration.x * dt;
        this.velocity.y += this.acceleration.y * dt;
        
        // 摩擦力/空气阻力
        this.velocity.x *= (1 - (1 - this.friction) * dt * 60);
        this.velocity.y *= (1 - (1 - this.friction) * dt * 60);
        
        // 位移集成
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        
        // 重置加速度
        this.acceleration = { x: 0, y: 0 };
        
        // 角度平滑平冲 (插值旋转)
        const rotationSpeed = 10;
        let diff = this.targetRotation - this.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.rotation += diff * dt * rotationSpeed;
        
        this.age += dt;
    }

    abstract update(dt: number, context?: any): void;
}

/**
 * ==================================================================================
 * SECTION 2: 英雄舰船 (PLAYER)
 * ==================================================================================
 */

export class Player extends Entity {
    // 基础属性
    health: number = 100;
    maxHealth: number = 100;
    mana: number = 100;
    maxMana: number = 100;
    manaRegen: number = 8;

    // 成长体系
    level: number = 1;
    xp: number = 0;
    nextLevelXp: number = 1000;
    damageMultiplier: number = 1.0;

    // 进阶物理参数
    thrustPower: number = 4200;
    maxSpeed: number = 750;
    bankingAngle: number = 0.5; // 侧倾感
    
    // 武器系统
    currentWeapon: WeaponType = WeaponType.VULCAN;
    fireRateMultiplier: number = 1.0;
    lastShotTime: number = 0;
    
    // 蓄力与超载系统
    isCharging: boolean = false;
    chargeLevel: number = 0;
    overdriveActive: boolean = false;
    overdriveEnergy: number = 0;

    // 技能系统 (对象字典化)
    skills = {
        shield: { current: 0, max: 20, active: false, duration: 6, cost: 40 },
        blackhole: { current: 0, max: 30, active: false, cost: 70 },
        shockwave: { current: 0, max: 12, cost: 30 }
    };

    constructor(x: number, y: number) {
        super(x, y, EntityType.PLAYER);
        this.radius = 22;
        this.friction = 0.92;
        this.zOrder = 100;
    }

    update(dt: number) {
        this.applyPhysics(dt);

        // 动态侧倾逻辑：根据水平速度改变旋转角度，增强飞行感
        this.targetRotation = (this.velocity.x / this.maxSpeed) * this.bankingAngle;

        // 能量回收与过载逻辑
        this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt);
        
        if (this.overdriveActive) {
            this.overdriveEnergy -= dt * 20;
            this.manaRegen = 20; // 过载状态回蓝极快
            if (this.overdriveEnergy <= 0) this.overdriveActive = false;
        }

        // 技能冷却递减
        Object.values(this.skills).forEach(s => {
            if (s.current > 0) s.current -= dt;
        });

        // 边界约束 (弹性约束)
        const margin = 50;
        if (this.position.x < margin) { this.acceleration.x += 5000 * dt; this.velocity.x *= 0.9; }
        if (this.position.x > 2000 - margin) { this.acceleration.x -= 5000 * dt; this.velocity.x *= 0.9; }
    }

    useSkill(skillName: 'shield' | 'blackhole' | 'shockwave'): boolean {
        const s = this.skills[skillName];
        if (s.current <= 0 && this.mana >= s.cost) {
            this.mana -= s.cost;
            s.current = s.max;
            return true;
        }
        return false;
    }

    gainXp(amount: number) {
        this.xp += amount;
        if (this.xp >= this.nextLevelXp) {
            this.level++;
            this.xp -= this.nextLevelXp;
            this.nextLevelXp = Math.floor(this.nextLevelXp * 1.6);
            this.damageMultiplier += 0.25;
            this.maxHealth += 20;
            this.health = this.maxHealth;
            // 升级爆发冲击波钩子可以在外部调用
        }
    }
}

/**
 * ==================================================================================
 * SECTION 3: 智能敌机 (STEERING AI)
 * ==================================================================================
 */

export class Enemy extends Entity {
    health: number;
    maxHealth: number;
    scoreValue: number;
    
    // AI 状态机
    behaviorState: 'cruise' | 'attack' | 'retreat' | 'orbit' = 'cruise';
    fireTimer: number = 0;
    fireRate: number;
    
    isBoss: boolean = false;
    bossPhase: number = 1;
    
    private startX: number;
    private wanderOffset: number = Math.random() * Math.PI * 2;

    constructor(x: number, y: number, difficultyMult: number, isBoss: boolean = false) {
        const type = isBoss ? EntityType.ENEMY_BOSS : Enemy.getRandomType();
        super(x, y, type);
        this.startX = x;
        this.isBoss = isBoss;
        this.friction = 0.96;

        // 根据类型初始化复杂的数值矩阵
        this.setupStats(difficultyMult);
    }

    private static getRandomType(): EntityType {
        const r = Math.random();
        if (r > 0.9) return EntityType.ENEMY_TANK;
        if (r > 0.7) return EntityType.ENEMY_FAST;
        if (r > 0.5) return EntityType.ENEMY_KAMIKAZE;
        return EntityType.ENEMY_BASIC;
    }

    private setupStats(difficulty: number) {
        const scale = 1 + difficulty * 0.5;
        switch (this.type) {
            case EntityType.ENEMY_BOSS:
                this.health = 25000 * scale;
                this.radius = 110;
                this.fireRate = 600;
                this.scoreValue = 5000;
                break;
            case EntityType.ENEMY_TANK:
                this.health = 1200 * scale;
                this.radius = 48;
                this.fireRate = 2000;
                this.scoreValue = 1000;
                break;
            case EntityType.ENEMY_KAMIKAZE:
                this.health = 100 * scale;
                this.radius = 18;
                this.fireRate = Infinity;
                this.scoreValue = 400;
                this.friction = 0.99; // 几乎无阻力
                break;
            default:
                this.health = 250 * scale;
                this.radius = 28;
                this.fireRate = 2500;
                this.scoreValue = 150;
        }
        this.maxHealth = this.health;
    }

    update(dt: number, playerPos?: Vector2) {
        this.applyPhysics(dt);
        this.fireTimer -= dt * 1000;

        if (this.isBoss) {
            this.updateBossAI(dt);
        } else {
            this.updateNormalAI(dt, playerPos);
        }
    }

    /**
     * 实现转向力 AI：让敌机移动更自然，不是死板的直线
     */
    private updateNormalAI(dt: number, playerPos?: Vector2) {
        if (!playerPos) return;

        const dist = vec.dist(this.position, playerPos);

        switch (this.type) {
            case EntityType.ENEMY_KAMIKAZE:
                // 狂暴冲锋 AI：不断修正方向指向玩家
                const chargeForce = vec.mul(vec.normalize(vec.sub(playerPos, this.position)), 1200);
                this.acceleration = vec.add(this.acceleration, chargeForce);
                this.targetRotation = Math.atan2(this.velocity.y, this.velocity.x) + Math.PI/2;
                break;

            case EntityType.ENEMY_FAST:
                // 骚扰 AI：在玩家上方进行“S”型穿插
                const targetX = this.startX + Math.sin(this.age * 4) * 300;
                const steerX = (targetX - this.position.x) * 10;
                this.acceleration.x = steerX;
                this.velocity.y = 350;
                this.targetRotation = Math.PI + Math.sin(this.age * 4) * 0.3;
                break;

            case EntityType.ENEMY_TANK:
                // 阵地 AI：缓慢推进，锁定玩家方向瞄准
                this.velocity.y = 80;
                this.targetRotation = Math.atan2(playerPos.y - this.position.y, playerPos.x - this.position.x) - Math.PI/2;
                break;

            default:
                // 基础 AI：波浪形前进
                this.velocity.y = 150;
                this.velocity.x = Math.sin(this.age * 2 + this.wanderOffset) * 100;
                this.targetRotation = Math.PI;
        }
    }

    private updateBossAI(dt: number) {
        // 多阶段血量控制
        const hpPercent = this.health / this.maxHealth;
        if (hpPercent < 0.3) this.bossPhase = 3;
        else if (hpPercent < 0.7) this.bossPhase = 2;

        // BOSS 独特的 8 字形飞行轨迹
        const targetX = this.startX + Math.sin(this.age * 0.8) * 400;
        const targetY = 180 + Math.cos(this.age * 1.6) * 80;
        
        this.position.x = vec.lerp(this.position, {x: targetX, y: targetY}, dt * 2).x;
        this.position.y = vec.lerp(this.position, {x: targetX, y: targetY}, dt * 2).y;
        
        // 旋转：轻微摇摆
        this.targetRotation = Math.PI + Math.sin(this.age) * 0.1;
    }
}

/**
 * ==================================================================================
 * SECTION 4: 粒子、弹药与环境
 * ==================================================================================
 */

export class Bullet extends Entity {
    damage: number;
    weaponType: WeaponType | null;
    isPlayerBullet: boolean;
    
    // 进阶属性：寿命、尾迹强度
    life: number = 2.5;
    trailTimer: number = 0;

    constructor(x: number, y: number, isPlayer: boolean, type: WeaponType, angle: number, owner: Player | null) {
        super(x, y, isPlayer ? EntityType.BULLET_PLAYER : EntityType.BULLET_ENEMY);
        this.isPlayerBullet = isPlayer;
        this.weaponType = type;
        this.rotation = angle;
        this.friction = 1.0; // 子弹通常不损失速度

        const mult = owner ? owner.damageMultiplier : 1;
        this.setupBullet(type, angle, mult);
    }

    private setupBullet(type: WeaponType, angle: number, mult: number) {
        const speed = 1500;
        this.damage = 35 * mult;
        
        // 根据武器类型定制物理属性
        if (this.isPlayerBullet) {
            switch(type) {
                case WeaponType.PLASMA:
                    this.damage *= 1.8;
                    this.velocity = { x: Math.sin(angle)*1100, y: -Math.cos(angle)*1100 };
                    this.radius = 8;
                    break;
                case WeaponType.TESLA:
                    this.damage *= 0.6; // 靠射速
                    this.velocity = { x: Math.sin(angle)*2200, y: -Math.cos(angle)*2200 };
                    this.radius = 3;
                    break;
                default:
                    this.velocity = { x: Math.sin(angle)*speed, y: -Math.cos(angle)*speed };
                    this.radius = 5;
            }
        } else {
            this.velocity = { x: Math.sin(angle)*500, y: Math.cos(angle)*500 };
            this.radius = 6;
        }
    }

    update(dt: number) {
        this.applyPhysics(dt);
        this.life -= dt;
        if (this.life <= 0) this.markedForDeletion = true;
    }
}

export class Star extends Entity {
    parallaxSpeed: number;
    color: string;

    constructor(w: number, h: number) {
        // 随机深度模拟 3D 效果
        const depth = Math.random();
        super(Math.random() * w, Math.random() * h, EntityType.STAR);
        
        this.parallaxSpeed = 50 + depth * 250;
        this.radius = 0.4 + depth * 1.8;
        this.opacity = 0.2 + depth * 0.8;
        
        // 远处的星发蓝，近处的星发白
        this.color = depth < 0.3 ? '#88aaff' : '#ffffff';
    }

    update(dt: number) {
        this.position.y += this.parallaxSpeed * dt;
        // 循环背景
        if (this.position.y > 2000) {
            this.position.y = -10;
            this.position.x = Math.random() * 2000;
        }
    }
}

/**
 * 动效系统：残影粒子
 */
export class Particle extends Entity {
    private initialLife: number;
    private shrink: boolean;

    constructor(x: number, y: number, color: string, speed: number, life: number, size: number, shrink: boolean = true) {
        super(x, y, EntityType.PARTICLE);
        this.initialLife = life;
        this.age = life;
        this.radius = size;
        this.shrink = shrink;
        this.friction = 0.94;

        const angle = Math.random() * Math.PI * 2;
        const s = Math.random() * speed;
        this.velocity = { x: Math.cos(angle) * s, y: Math.sin(angle) * s };
    }

    update(dt: number) {
        this.applyPhysics(dt);
        this.age -= dt;
        this.opacity = this.age / this.initialLife;
        if (this.shrink) this.radius *= (1 - dt * 2);
        if (this.age <= 0) this.markedForDeletion = true;
    }
}

// 其余辅助类 (FloatingText, Item, Nebula, Meteor) 可以基于此物理模型快速扩展...
