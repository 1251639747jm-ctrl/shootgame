import { EntityType, ItemType, Vector2, WeaponType, SkillCooldown } from "../types";

export class Entity {
    position: Vector2;
    velocity: Vector2 = { x: 0, y: 0 };
    acceleration: Vector2 = { x: 0, y: 0 };
    radius: number = 10;
    rotation: number = 0;
    type: EntityType;
    markedForDeletion: boolean = false;

    constructor(x: number, y: number, type: EntityType) {
        this.position = { x, y };
        this.type = type;
    }

    update(dt: number, targetPos?: Vector2) {
        this.velocity.x += this.acceleration.x * dt;
        this.velocity.y += this.acceleration.y * dt;
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.acceleration.x = 0;
        this.acceleration.y = 0;
    }
}

/**
 * 玩家战机
 */
export class Player extends Entity {
    health: number = 100;
    maxHealth: number = 100;
    mana: number = 100;
    maxMana: number = 100;
    manaRegen: number = 8; // mana per second

    thrust: number = 2000;
    friction: number = 0.88;

    level: number = 1;
    xp: number = 0;
    xpToNext: number = 100;

    currentWeapon: WeaponType = WeaponType.VULCAN;
    weaponOrder: WeaponType[] = [
        WeaponType.VULCAN,
        WeaponType.SPREAD,
        WeaponType.LASER,
        WeaponType.RAILGUN,
        WeaponType.PLASMA,
        WeaponType.TESLA,
        WeaponType.BOMB,
        WeaponType.FLAK,
        WeaponType.HELIX
    ];
    damageMultiplier: number = 1;

    fireRate: number = 90; // ms between vulcan shots
    lastShotTime: number = 0;

    chargeLevel: number = 0;
    chargeRate: number = 80; // per second
    isCharging: boolean = false;

    // 激光冷却: 蓄满射出一发后, 3 秒内不能再次蓄力
    laserCooldown: number = 0;
    laserCooldownMax: number = 3; // seconds

    // 肉鸽模式激光加成 (由 RogueEngine 写入, 被 Laser.update 读)
    //   laserDpsMul: 倍率叠加 LASER_DPS_UP perk (默认 1)
    //   laserWidthMul: 倍率叠加 LASER_WIDTH_UP perk (默认 1)
    laserDpsMul: number = 1;
    laserWidthMul: number = 1;

    shieldActive: boolean = false; // used by PlayerModel
    invincible: boolean = false;   // 练习场无敌
    unlimitedMana: boolean = false;// 练习场魔法无限

    skills: {
        shield: SkillCooldown;
        blackhole: SkillCooldown;
        shockwave: SkillCooldown;
    } = {
        shield:    { current: 0, max: 12, active: false, duration: 4, activeTimer: 0 },
        blackhole: { current: 0, max: 18, active: false },
        shockwave: { current: 0, max: 8,  active: false }
    };

    constructor(x: number, y: number) {
        super(x, y, EntityType.PLAYER);
        this.radius = 22;
    }

    update(dt: number) {
        // apply acceleration
        this.velocity.x += this.acceleration.x * dt;
        this.velocity.y += this.acceleration.y * dt;
        // friction
        this.velocity.x *= Math.pow(this.friction, dt * 60);
        this.velocity.y *= Math.pow(this.friction, dt * 60);
        // move
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.acceleration.x = 0;
        this.acceleration.y = 0;

        // player rotation stays at 0 (PlayerModel handles visual banking based on velocity)
        this.rotation = 0;

        // mana regen
        this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt);

        // 激光冷却
        if (this.laserCooldown > 0) {
            this.laserCooldown = Math.max(0, this.laserCooldown - dt);
        }

        // skill cooldowns
        const skills: ('shield' | 'blackhole' | 'shockwave')[] = ['shield', 'blackhole', 'shockwave'];
        for (const k of skills) {
            const s = this.skills[k];
            if (s.current > 0) s.current = Math.max(0, s.current - dt);
        }

        // shield active timer
        if (this.skills.shield.active && this.skills.shield.activeTimer !== undefined) {
            this.skills.shield.activeTimer -= dt;
            if (this.skills.shield.activeTimer <= 0) {
                this.skills.shield.active = false;
            }
        }
        this.shieldActive = this.skills.shield.active;
    }

    switchWeapon() {
        const idx = this.weaponOrder.indexOf(this.currentWeapon);
        this.currentWeapon = this.weaponOrder[(idx + 1) % this.weaponOrder.length];
        // reset charge
        this.chargeLevel = 0;
        this.isCharging = false;
    }

    selectWeapon(w: WeaponType) {
        if (this.weaponOrder.indexOf(w) === -1) return;
        this.currentWeapon = w;
        this.chargeLevel = 0;
        this.isCharging = false;
    }

    gainXp(amount: number) {
        this.xp += amount;
        while (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this.level++;
            this.xpToNext = Math.floor(this.xpToNext * 1.5);
            this.damageMultiplier += 0.15;
            this.maxHealth += 10;
            this.health = Math.min(this.maxHealth, this.health + 30);
            this.maxMana += 10;
        }
    }
}

/**
 * 敌机
 */
export class Enemy extends Entity {
    health: number;
    maxHealth: number;
    scoreValue: number;
    isBoss: boolean;
    fireTimer: number;
    fireRate: number;
    speed: number;
    isPractice: boolean = false; // 练习场靶: 进顶后悬停, 不射击
    isStatic: boolean = false;   // 完全不动的靶子

    // 前向护盾 (ENEMY_SHIELDER 使用, 其他可选)
    shieldHealth: number = 0;
    maxShieldHealth: number = 0;
    shieldRegenDelay: number = 0; // 被击中后多少秒才开始恢复
    shieldFlashTimer: number = 0;  // 刚被打中的发光效果

    // 狙击机特有: 开火前的预瞄激光指示
    aimTimer: number = 0;          // 持续瞄准时间
    isAiming: boolean = false;

    // Boss 阶段相位计时: 用于复杂 Boss 弹幕模式切换
    phaseTimer: number = 0;
    phaseIndex: number = 0;

    // Boss 技能系统 (仅 Boss 使用)
    skillCooldown: number = 8;       // 技能间隔 (秒)
    skillTimer: number = 6;          // 开场 6s 后第一次释放
    skillActive: string | null = null; // 当前活跃技能名 (null = 无)
    skillPhaseTimer: number = 0;     // 技能持续时间
    dashSpeed: number = 0;           // 冲撞技能用

    constructor(
        x: number,
        y: number,
        difficulty: number = 1,
        isBoss: boolean = false,
        forcedType?: EntityType,
        opts?: { practice?: boolean; isStatic?: boolean }
    ) {
        // pick enemy type
        let type = EntityType.ENEMY_BASIC;
        if (forcedType !== undefined) {
            type = forcedType;
        } else if (isBoss) {
            type = EntityType.ENEMY_BOSS;
        } else {
            // 常规敌人抽签 (加入 3 种新型)
            const roll = Math.random();
            if (roll < 0.10)      type = EntityType.ENEMY_TANK;
            else if (roll < 0.28) type = EntityType.ENEMY_FAST;
            else if (roll < 0.40) type = EntityType.ENEMY_KAMIKAZE;
            else if (roll < 0.50) type = EntityType.ENEMY_SHIELDER;
            else if (roll < 0.60) type = EntityType.ENEMY_SNIPER;
            else if (roll < 0.72) type = EntityType.ENEMY_SWARMER;
            else                  type = EntityType.ENEMY_BASIC;
        }

        super(x, y, type);
        this.isBoss = (
            type === EntityType.ENEMY_BOSS ||
            type === EntityType.ENEMY_BOSS_CARRIER ||
            type === EntityType.ENEMY_BOSS_REAVER
        );
        this.isPractice = !!opts?.practice;
        this.isStatic = !!opts?.isStatic;

        if (type === EntityType.ENEMY_BOSS) {
            // 旗舰 BOSS: 均衡高血量
            this.radius = 100;
            this.health = 4000 * difficulty;
            this.scoreValue = 1500;
            this.fireRate = 1.2;
            this.speed = 40;
        } else if (type === EntityType.ENEMY_BOSS_CARRIER) {
            // 航母 BOSS: 高血量, 放出小僚机, 射速慢
            this.radius = 110;
            this.health = 5200 * difficulty;
            this.scoreValue = 2200;
            this.fireRate = 1.6;
            this.speed = 35;
        } else if (type === EntityType.ENEMY_BOSS_REAVER) {
            // 劫掠者 BOSS: 中血量, 敏捷, 高频弹幕 + 激光扫射
            this.radius = 85;
            this.health = 3400 * difficulty;
            this.scoreValue = 2000;
            this.fireRate = 0.9;
            this.speed = 70;
        } else if (type === EntityType.ENEMY_TANK) {
            this.radius = 32;
            this.health = 300 * difficulty;
            this.scoreValue = 150;
            this.fireRate = 2.2;
            this.speed = 70;
        } else if (type === EntityType.ENEMY_FAST) {
            this.radius = 20;
            this.health = 60 * difficulty;
            this.scoreValue = 80;
            this.fireRate = 1.3;
            this.speed = 240;
        } else if (type === EntityType.ENEMY_KAMIKAZE) {
            this.radius = 22;
            this.health = 80 * difficulty;
            this.scoreValue = 100;
            this.fireRate = 999; // doesn't fire
            this.speed = 320;
        } else if (type === EntityType.ENEMY_SHIELDER) {
            // 盾卫: 正面护盾, 需绕后或耗盾才能击穿
            this.radius = 30;
            this.health = 180 * difficulty;
            this.scoreValue = 180;
            this.fireRate = 2.6;
            this.speed = 80;
            this.shieldHealth = 250 * difficulty;
            this.maxShieldHealth = this.shieldHealth;
        } else if (type === EntityType.ENEMY_SNIPER) {
            // 狙击机: 远距离悬停, 预瞄后高伤慢速弹
            this.radius = 22;
            this.health = 100 * difficulty;
            this.scoreValue = 140;
            this.fireRate = 3.0; // 整体节奏慢
            this.speed = 60;
        } else if (type === EntityType.ENEMY_SWARMER) {
            // 蜂群个体: 血薄, 正弦蛇形走位, 散射小弹
            this.radius = 14;
            this.health = 35 * difficulty;
            this.scoreValue = 40;
            this.fireRate = 2.0;
            this.speed = 180;
        } else {
            this.radius = 24;
            this.health = 120 * difficulty;
            this.scoreValue = 50;
            this.fireRate = 1.8;
            this.speed = 120;
        }

        // 练习场里敌人血量翻 3 倍, 方便测试 DPS
        if (this.isPractice) {
            this.health *= 3;
            if (this.shieldHealth > 0) {
                this.shieldHealth *= 3;
                this.maxShieldHealth = this.shieldHealth;
            }
            // 不开火
            this.fireRate = 1e9;
        }

        this.maxHealth = this.health;
        this.fireTimer = this.fireRate * (0.5 + Math.random() * 0.5);
        // initial downward velocity
        this.velocity.y = this.speed;
        if (this.isStatic) this.velocity.y = 0;
    }

    update(dt: number, playerPos?: Vector2) {
        // 共用状态衰减
        if (this.shieldFlashTimer > 0) this.shieldFlashTimer -= dt;
        if (this.shieldRegenDelay > 0) this.shieldRegenDelay -= dt;
        // 盾再生 (仅盾卫)
        if (this.type === EntityType.ENEMY_SHIELDER &&
            this.maxShieldHealth > 0 &&
            this.shieldHealth < this.maxShieldHealth &&
            this.shieldRegenDelay <= 0) {
            this.shieldHealth = Math.min(
                this.maxShieldHealth,
                this.shieldHealth + this.maxShieldHealth * 0.15 * dt
            );
        }

        if (this.isStatic) {
            // 固定靶: 完全不动
            this.fireTimer -= dt;
            this.rotation += dt * 0.3;
            return;
        }

        // 练习场: 进顶后悬停, 不冲撞玩家
        if (this.isPractice) {
            const targetY = this.isBoss ? 150 : 180 + (this.position.x % 7) * 15;
            if (this.position.y < targetY) {
                this.velocity.y = this.speed * 0.6;
                this.velocity.x = 0;
            } else {
                this.velocity.y = 0;
                // 轻微左右漂移, 区分非静态靶
                this.velocity.x = Math.sin(performance.now() / 1500 + this.position.x * 0.01) * 40;
            }
            this.position.x += this.velocity.x * dt;
            this.position.y += this.velocity.y * dt;
            this.fireTimer -= dt;
            this.rotation += dt * 0.5;
            return;
        }

        // Boss hovers at top (所有 Boss 变体都在顶端悬停)
        if (this.isBoss) {
            const targetY = 120;
            if (this.position.y < targetY) {
                this.velocity.y = 60;
            } else {
                this.velocity.y = 0;
                // 不同 Boss 的巡航速度
                let drift = 80;
                if (this.type === EntityType.ENEMY_BOSS_REAVER) drift = 160;
                if (this.type === EntityType.ENEMY_BOSS_CARRIER) drift = 50;
                this.velocity.x = Math.sin(performance.now() / 1200) * drift;
            }
            this.phaseTimer += dt;
        } else if (this.type === EntityType.ENEMY_KAMIKAZE && playerPos) {
            // homing
            const dx = playerPos.x - this.position.x;
            const dy = playerPos.y - this.position.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            this.velocity.x = (dx / d) * this.speed;
            this.velocity.y = (dy / d) * this.speed;
        } else if (this.type === EntityType.ENEMY_SHIELDER) {
            // 盾卫: 慢速推进, 轻微摇摆, 正面朝下
            this.velocity.y = this.speed;
            this.velocity.x = Math.sin(performance.now() / 800 + this.position.x * 0.02) * 30;
        } else if (this.type === EntityType.ENEMY_SNIPER) {
            // 狙击机: 进入屏幕上 1/3 后悬停
            const targetY = 160 + (this.position.x % 5) * 15;
            if (this.position.y < targetY) {
                this.velocity.y = this.speed;
                this.velocity.x = 0;
            } else {
                this.velocity.y = 0;
                this.velocity.x = Math.sin(performance.now() / 2200 + this.position.x * 0.01) * 40;
            }
        } else if (this.type === EntityType.ENEMY_SWARMER) {
            // 蜂群个体: 正弦蛇形走位
            this.velocity.y = this.speed;
            this.velocity.x = Math.sin(performance.now() / 400 + this.position.x * 0.05) * 150;
        }

        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        this.fireTimer -= dt;

        // 狙击机: 开火前 0.8s 起预瞄激光
        if (this.type === EntityType.ENEMY_SNIPER) {
            this.isAiming = this.fireTimer > 0 && this.fireTimer < 0.8;
        }

        // face the player roughly (pointing down by default)
        // 盾卫/狙击/蜂群保持朝下不自转, 更有“阵型”感
        if (this.type !== EntityType.ENEMY_SHIELDER &&
            this.type !== EntityType.ENEMY_SNIPER &&
            this.type !== EntityType.ENEMY_SWARMER) {
            this.rotation += dt * 0.5;
        }
    }

    /**
     * 统一的伤害入口: 处理护盾吸收, 返回实际扣到本体的伤害
     */
    applyDamage(amount: number): number {
        if (this.shieldHealth > 0) {
            const absorbed = Math.min(this.shieldHealth, amount);
            this.shieldHealth -= absorbed;
            this.shieldRegenDelay = 2.5;
            this.shieldFlashTimer = 0.15;
            const leftover = amount - absorbed;
            if (leftover > 0) {
                this.health -= leftover;
            }
            return leftover;
        }
        this.health -= amount;
        return amount;
    }
}

/**
 * 子弹
 */
export class Bullet extends Entity {
    damage: number = 20;
    color: string = '#ffffff';
    target: Entity | null = null;
    angleOffset: number = 0;
    owner: Player | null = null;
    weaponType: WeaponType = WeaponType.VULCAN;
    // 穿透射击：命中敌人不消失，但每个敌人只命中一次
    piercing: boolean = false;
    hitEnemies: Set<any> = new Set();

    // === 肉鸽机枪升级标签 (由 RogueEngine.handleWeaponFiring 发射时贴) ===
    // pierceLeft: 还能穿过几个敌人. 0 = 不穿, 命中即删.
    pierceLeft: number = 0;
    // bouncesLeft: 命中后还能弹几次. 0 = 不弹, 命中即删.
    bouncesLeft: number = 0;
    // 命中时触发小 AOE 爆炸.
    explosive: boolean = false;

    // FLAK 专用: 多少秒后空爆 (负数=不空爆)
    fuseTimer: number = -1;
    fuseMax: number = -1;
    // FLAK 空爆时散射的碎片数 & 碎片伤害
    flakShards: number = 10;
    flakShardDamage: number = 14;

    // HELIX 专用: 正弦摆动
    helixPhase: number = 0;      // 初始相位 (0 或 PI, 决定双股分离)
    helixFreq: number = 8;       // 摆动频率
    helixAmp: number = 18;       // 摆动幅度 (像素)
    helixAge: number = 0;        // 发射后经过时间
    baseDir: Vector2 = { x: 0, y: 0 }; // 沿朝向的基础速度 (恒定)
    basePos: Vector2 = { x: 0, y: 0 }; // 发射位置 (用于算摆动)

    constructor(
        x: number,
        y: number,
        isPlayerBullet: boolean,
        weaponType: WeaponType = WeaponType.VULCAN,
        angleOffset: number = 0,
        rotation: number = 0,
        owner: Player | null = null
    ) {
        super(x, y, isPlayerBullet ? EntityType.BULLET_PLAYER : EntityType.BULLET_ENEMY);
        this.radius = 5;
        this.angleOffset = angleOffset;
        this.owner = owner;
        this.rotation = rotation + angleOffset;
        this.weaponType = weaponType;

        if (isPlayerBullet) {
            const dmgMul = owner ? owner.damageMultiplier : 1;

            if (weaponType === WeaponType.RAILGUN) {
                const speed = 1800;
                this.velocity.x = Math.sin(this.rotation) * speed;
                this.velocity.y = -Math.cos(this.rotation) * speed;
                this.color = '#a78bfa';
                this.damage = 180 * dmgMul;
                this.radius = 8;
                this.piercing = true;
            } else if (weaponType === WeaponType.SPREAD) {
                const speed = 780 + Math.random() * 80;
                this.velocity.x = Math.sin(this.rotation) * speed;
                this.velocity.y = -Math.cos(this.rotation) * speed;
                this.color = '#fb923c';
                this.damage = 18 * dmgMul;
                this.radius = 4;
            } else if (weaponType === WeaponType.FLAK) {
                // 高射弹: 向上发射, 到一定时间后自爆
                const speed = 680;
                this.velocity.x = Math.sin(this.rotation) * speed;
                this.velocity.y = -Math.cos(this.rotation) * speed;
                this.color = '#fbbf24';
                this.damage = 30 * dmgMul;
                this.flakShardDamage = 22 * dmgMul;
                this.radius = 7;
                this.fuseMax = 0.55; // 0.55 秒后空爆
                this.fuseTimer = this.fuseMax;
            } else if (weaponType === WeaponType.HELIX) {
                // 螺旋光弹: 初速度恒定, 靠 update 做正弦位移
                const speed = 820;
                this.baseDir = { x: Math.sin(this.rotation) * speed, y: -Math.cos(this.rotation) * speed };
                this.basePos = { x, y };
                this.velocity.x = this.baseDir.x;
                this.velocity.y = this.baseDir.y;
                this.color = '#86efac';
                this.damage = 22 * dmgMul;
                this.radius = 5;
                // helixPhase 由 angleOffset 传进来 (0 或 PI, 决定哪一股)
                this.helixPhase = angleOffset;
            } else {
                // VULCAN / 其他
                const speed = 900;
                this.velocity.x = Math.sin(this.rotation) * speed;
                this.velocity.y = -Math.cos(this.rotation) * speed;
                this.color = '#facc15';
                this.damage = 25 * dmgMul;
            }
        } else {
            // enemy bullets get velocity set externally
            this.color = '#ff4466';
            this.damage = 10;
            this.radius = 6;
        }
    }

    update(dt: number) {
        // HELIX: 用正弦摆动覆盖速度
        if (this.weaponType === WeaponType.HELIX && this.type === EntityType.BULLET_PLAYER) {
            this.helixAge += dt;
            // 沿朝向推进
            this.basePos.x += this.baseDir.x * dt;
            this.basePos.y += this.baseDir.y * dt;
            // 法向量 (对朝向正交)
            const nx =  Math.cos(this.rotation);
            const ny =  Math.sin(this.rotation);
            const wave = Math.sin(this.helixAge * this.helixFreq + this.helixPhase) * this.helixAmp;
            this.position.x = this.basePos.x + nx * wave;
            this.position.y = this.basePos.y + ny * wave;
            return;
        }

        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        // FLAK: 定时空爆 (GameEngine 会处理碎片生成)
        if (this.fuseTimer > 0) {
            this.fuseTimer -= dt;
            // 保留标记, 让 GameEngine 在 fuseTimer<=0 时生成散弹
        }
    }
}

/**
 * 粒子
 */
export class Particle extends Entity {
    life: number = 1;       // normalized 0..1 for rendering alpha
    _timeLeft: number;
    maxLife: number;
    color: string;
    size: number;

    constructor(
        x: number,
        y: number,
        color: string,
        speed: number = 200,
        life: number = 0.5,
        size: number = 3
    ) {
        super(x, y, EntityType.PARTICLE);
        this.color = color;
        this._timeLeft = life;
        this.maxLife = life;
        this.size = size;
        this.radius = size;
        this.life = 1;

        const angle = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random() * 0.7);
        this.velocity.x = Math.cos(angle) * s;
        this.velocity.y = Math.sin(angle) * s;
    }

    update(dt: number) {
        this._timeLeft -= dt;
        if (this._timeLeft <= 0) { this.markedForDeletion = true; return; }
        this.life = Math.max(0, this._timeLeft / this.maxLife);
        // drag
        this.velocity.x *= 0.95;
        this.velocity.y *= 0.95;
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        // fade size slightly
        this.size *= 0.99;
    }
}

/**
 * 星星背景
 */
export class Star extends Entity {
    brightness: number;

    constructor(screenWidth: number, screenHeight: number) {
        super(Math.random() * screenWidth, Math.random() * screenHeight, EntityType.STAR);
        this.radius = Math.random() * 1.5 + 0.3;
        this.brightness = 0.3 + Math.random() * 0.7;
        this.velocity.y = 20 + Math.random() * 60;
    }

    update(dt: number) {
        this.position.y += this.velocity.y * dt;
    }
}

/**
 * 流星
 */
export class Meteor extends Entity {
    constructor(screenWidth: number, screenHeight: number) {
        super(Math.random() * screenWidth, -50, EntityType.STAR);
        this.radius = 6 + Math.random() * 12;
        this.velocity.y = 250 + Math.random() * 150;
        this.velocity.x = (Math.random() - 0.5) * 60;
        this.rotation = Math.random() * Math.PI;
    }

    update(dt: number) {
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.rotation += dt * 2;
    }
}

/**
 * 星云
 */
export class Nebula extends Entity {
    scale: number;
    color: string;

    constructor(screenWidth: number, screenHeight: number) {
        super(Math.random() * screenWidth, Math.random() * screenHeight, EntityType.NEBULA);
        this.scale = 250 + Math.random() * 250;
        const palette = ['#7c3aed', '#0ea5e9', '#db2777', '#6366f1', '#06b6d4'];
        this.color = palette[Math.floor(Math.random() * palette.length)];
        this.velocity.y = 8 + Math.random() * 10;
    }

    update(dt: number) {
        this.position.y += this.velocity.y * dt;
    }
}

/**
 * 道具
 */
export class Item extends Entity {
    itemType: ItemType;
    wobble: number = 0;

    constructor(x: number, y: number) {
        super(x, y, EntityType.ITEM);
        this.radius = 16;
        this.velocity.y = 80;
        // random type
        const r = Math.random();
        if (r < 0.45) this.itemType = ItemType.HEALTH;
        else if (r < 0.8) this.itemType = ItemType.MANA;
        else this.itemType = ItemType.WEAPON_UP;
    }

    update(dt: number) {
        this.position.y += this.velocity.y * dt;
        this.wobble += dt * 2;
    }
}

/**
 * 护盾 (玩家技能)
 */
export class Shield extends Entity {
    owner: Player;
    life: number = 4;

    constructor(owner: Player) {
        super(owner.position.x, owner.position.y, EntityType.SKILL_SHIELD);
        this.owner = owner;
        this.radius = 55;
    }

    update(dt: number) {
        if (this.owner.markedForDeletion || !this.owner.skills.shield.active) {
            this.markedForDeletion = true;
            return;
        }
        // follow owner
        this.position.x = this.owner.position.x;
        this.position.y = this.owner.position.y;
    }
}

/**
 * 冲击波
 */
export class Shockwave extends Entity {
    life: number = 0.8;
    maxLife: number = 0.8;
    maxRadius: number = 600;
    opacity: number = 1;

    constructor(x: number, y: number) {
        super(x, y, EntityType.SKILL_SHOCKWAVE);
        this.radius = 10;
    }

    update(dt: number) {
        this.life -= dt;
        if (this.life <= 0) { this.markedForDeletion = true; return; }
        const t = 1 - (this.life / this.maxLife);
        this.radius = t * this.maxRadius;
        this.opacity = this.life / this.maxLife;
    }
}

/**
 * 浮动文字
 */
export class FloatingText extends Entity {
    life: number = 1;
    maxLife: number = 1;
    text: string;
    color: string;

    constructor(x: number, y: number, text: string, color: string) {
        super(x, y, EntityType.FLOATING_TEXT);
        this.text = text;
        this.color = color;
        this.velocity.y = -60;
    }

    update(dt: number) {
        this.life -= dt;
        if (this.life <= 0) { this.markedForDeletion = true; return; }
        this.position.y += this.velocity.y * dt;
        this.velocity.y *= 0.95;
    }
}

/**
 * 蓄力粒子 (激光武器充能时)
 */
export class ChargeParticle extends Entity {
    target: Player;
    life: number = 0.6;
    maxLife: number = 0.6;
    startDist: number;
    angle: number;

    constructor(target: Player) {
        super(target.position.x, target.position.y, EntityType.CHARGE_PARTICLE);
        this.target = target;
        this.radius = 2 + Math.random() * 2;
        this.angle = Math.random() * Math.PI * 2;
        this.startDist = 60 + Math.random() * 40;
    }

    update(dt: number) {
        this.life -= dt;
        if (this.life <= 0 || this.target.markedForDeletion) {
            this.markedForDeletion = true;
            return;
        }
        // spiral in toward target
        const t = this.life / this.maxLife;
        const d = this.startDist * t;
        this.angle += dt * 6;
        this.position.x = this.target.position.x + Math.cos(this.angle) * d;
        this.position.y = this.target.position.y - 30 + Math.sin(this.angle) * d;
    }
}
