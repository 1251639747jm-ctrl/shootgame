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
        WeaponType.LASER,
        WeaponType.PLASMA,
        WeaponType.TESLA,
        WeaponType.BOMB
    ];
    damageMultiplier: number = 1;

    fireRate: number = 90; // ms between vulcan shots
    lastShotTime: number = 0;

    chargeLevel: number = 0;
    chargeRate: number = 80; // per second
    isCharging: boolean = false;

    shieldActive: boolean = false; // used by PlayerModel

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

    constructor(x: number, y: number, difficulty: number = 1, isBoss: boolean = false) {
        // pick enemy type
        let type = EntityType.ENEMY_BASIC;
        if (!isBoss) {
            const roll = Math.random();
            if (roll < 0.15) type = EntityType.ENEMY_TANK;
            else if (roll < 0.4) type = EntityType.ENEMY_FAST;
            else if (roll < 0.55) type = EntityType.ENEMY_KAMIKAZE;
            else type = EntityType.ENEMY_BASIC;
        } else {
            type = EntityType.ENEMY_BOSS;
        }

        super(x, y, type);
        this.isBoss = isBoss;

        if (isBoss) {
            this.radius = 100;
            this.health = 4000 * difficulty;
            this.scoreValue = 1500;
            this.fireRate = 1.2;
            this.speed = 40;
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
        } else {
            this.radius = 24;
            this.health = 120 * difficulty;
            this.scoreValue = 50;
            this.fireRate = 1.8;
            this.speed = 120;
        }

        this.maxHealth = this.health;
        this.fireTimer = this.fireRate * (0.5 + Math.random() * 0.5);
        // initial downward velocity
        this.velocity.y = this.speed;
    }

    update(dt: number, playerPos?: Vector2) {
        // Boss hovers at top
        if (this.isBoss) {
            const targetY = 120;
            if (this.position.y < targetY) {
                this.velocity.y = 60;
            } else {
                this.velocity.y = 0;
                // side-to-side drift
                this.velocity.x = Math.sin(performance.now() / 1200) * 80;
            }
        } else if (this.type === EntityType.ENEMY_KAMIKAZE && playerPos) {
            // homing
            const dx = playerPos.x - this.position.x;
            const dy = playerPos.y - this.position.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            this.velocity.x = (dx / d) * this.speed;
            this.velocity.y = (dy / d) * this.speed;
        }

        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        this.fireTimer -= dt;

        // face the player roughly (pointing down by default)
        this.rotation += dt * 0.5;
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

        if (isPlayerBullet) {
            const speed = 900;
            this.velocity.x = Math.sin(this.rotation) * speed;
            this.velocity.y = -Math.cos(this.rotation) * speed;
            this.color = '#facc15';
            this.damage = 25 * (owner ? owner.damageMultiplier : 1);
        } else {
            // enemy bullets get velocity set externally
            this.color = '#ff4466';
            this.damage = 10;
            this.radius = 6;
        }
    }

    update(dt: number) {
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
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
