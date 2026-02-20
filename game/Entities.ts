import { EntityType, WeaponType } from "../types";
import { EnemyModel } from "./EnemyModel";

/**
 * ==========================================
 * 1. 基础实体抽象类 (Core Entity)
 * ==========================================
 */
export abstract class Entity {
    public id: string = crypto.randomUUID();
    public position: { x: number; y: number };
    public velocity: { x: number; y: number } = { x: 0, y: 0 };
    public acceleration: { x: number; y: number } = { x: 0, y: 0 };
    
    public radius: number;
    public rotation: number = 0;
    public isDead: boolean = false;
    
    // 物理参数
    protected friction: number = 1.0; // 1.0 = 无阻力
    protected mass: number = 1.0;

    constructor(x: number, y: number, radius: number) {
        this.position = { x, y };
        this.radius = radius;
    }

    update(dt: number) {
        // 1. 速度更新 (v = v0 + at)
        this.velocity.x += this.acceleration.x * dt;
        this.velocity.y += this.acceleration.y * dt;

        // 2. 阻尼衰减
        if (this.friction < 1.0) {
            const damping = Math.pow(this.friction, dt * 60);
            this.velocity.x *= damping;
            this.velocity.y *= damping;
        }

        // 3. 位移更新
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        // 4. 重置瞬时力
        this.acceleration = { x: 0, y: 0 };
    }

    applyForce(x: number, y: number) {
        this.acceleration.x += x / this.mass;
        this.acceleration.y += y / this.mass;
    }

    abstract draw(ctx: CanvasRenderingContext2D): void;
}

/**
 * ==========================================
 * 2. 玩家战机 (Player)
 * ==========================================
 */
export class Player extends Entity {
    public health: number = 100;
    public maxHealth: number = 100;
    public energy: number = 100;
    public shieldActive: boolean = false;
    public weaponLevel: number = 1;

    constructor(x: number, y: number) {
        super(x, y, 20);
        this.friction = 0.92;
        this.mass = 1.2;
    }

    update(dt: number) {
        super.update(dt);
        const maxBankAngle = 0.45;
        const targetRotation = (this.velocity.x / 600) * maxBankAngle;
        this.rotation += (targetRotation - this.rotation) * dt * 10;
        
        if (!this.shieldActive && this.energy < 100) {
            this.energy += dt * 5;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        const { x, y } = this.position;
        const t = performance.now() / 1000;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.rotation);

        // 引擎光效
        const pulse = 1 + Math.sin(t * 20) * 0.1;
        this.drawThruster(ctx, 0, 18, 8, 32 * pulse, '#0ea5e9');
        this.drawThruster(ctx, -12, 12, 4, 16 * pulse, '#38bdf8');
        this.drawThruster(ctx, 12, 12, 4, 16 * pulse, '#38bdf8');

        // 机身
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(0, -32); ctx.lineTo(24, 16); ctx.lineTo(0, 24); ctx.lineTo(-24, 16);
        ctx.fill();

        // 顶部装甲
        const g = ctx.createLinearGradient(-15, -20, 15, 20);
        g.addColorStop(0, '#e2e8f0');
        g.addColorStop(0.5, '#64748b');
        g.addColorStop(1, '#1e293b');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -28); ctx.lineTo(12, 8); ctx.lineTo(0, 14); ctx.lineTo(-12, 8);
        ctx.fill();

        // 驾驶舱
        ctx.fillStyle = '#bae6fd';
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.ellipse(0, -8, 3, 6, 0, 0, Math.PI*2); ctx.fill();

        // 护盾
        if (this.shieldActive) {
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + Math.sin(t*10)*0.2})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI*2); ctx.stroke();
        }

        ctx.restore();
    }

    private drawThruster(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.3, color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y + h/2, w/2, h/2, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

/**
 * ==========================================
 * 3. 敌人 (Enemy)
 * ==========================================
 */
export class Enemy extends Entity {
    public type: EntityType;
    public health: number;
    public maxHealth: number;

    constructor(x: number, y: number, type: EntityType, hp: number) {
        super(x, y, 20);
        this.type = type;
        this.health = hp;
        this.maxHealth = hp;
        
        switch(type) {
            case EntityType.ENEMY_BOSS: this.radius = 80; this.friction = 0.98; break;
            case EntityType.ENEMY_TANK: this.radius = 40; this.friction = 0.96; break;
            case EntityType.ENEMY_FAST: this.radius = 15; this.friction = 0.99; break;
            default: this.friction = 0.95; break;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        EnemyModel.draw(ctx, this);
    }
}

/**
 * ==========================================
 * 4. 子弹 (Bullet)
 * ==========================================
 */
export class Bullet extends Entity {
    public isEnemy: boolean;
    public damage: number;

    constructor(x: number, y: number, angle: number, isEnemy: boolean) {
        super(x, y, isEnemy ? 6 : 4);
        this.isEnemy = isEnemy;
        this.damage = isEnemy ? 10 : 25;
        this.rotation = angle;
        
        const speed = isEnemy ? 400 : 1200;
        this.velocity.x = Math.sin(angle) * speed;
        this.velocity.y = -Math.cos(angle) * speed;
        this.friction = 1.0;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);
        ctx.globalCompositeOperation = 'lighter';

        if (this.isEnemy) {
            const pulse = 1 + Math.sin(performance.now() / 50) * 0.2;
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 10 * pulse);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.4, '#ef4444');
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(0, 0, 10 * pulse, 0, Math.PI*2); ctx.fill();
        } else {
            const len = 35;
            const w = 4;
            const g = ctx.createLinearGradient(0, -len, 0, len);
            g.addColorStop(0, 'rgba(56, 189, 248, 0)');
            g.addColorStop(0.4, '#38bdf8');
            g.addColorStop(1, '#ffffff');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(0, -len);
            ctx.quadraticCurveTo(w, 0, 0, len);
            ctx.quadraticCurveTo(-w, 0, 0, -len);
            ctx.fill();
        }
        ctx.restore();
    }
}

/**
 * ==========================================
 * 5. 粒子与特效 (Particles & VFX)
 * ==========================================
 */

export class Particle extends Entity {
    public life: number;
    public maxLife: number;
    public color: string;

    constructor(x: number, y: number, color: string, speed: number, life: number) {
        super(x, y, 1);
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.friction = 0.94;

        const angle = Math.random() * Math.PI * 2;
        const v = Math.random() * speed;
        this.velocity = { x: Math.cos(angle) * v, y: Math.sin(angle) * v };
    }

    update(dt: number) {
        super.update(dt);
        this.life -= dt;
        if (this.life <= 0) this.isDead = true;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const alpha = this.life / this.maxLife;
        const speed = Math.hypot(this.velocity.x, this.velocity.y);
        const len = Math.min(speed * 0.08, 20);
        
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(Math.atan2(this.velocity.y, this.velocity.x));
        ctx.globalCompositeOperation = 'lighter';
        
        const g = ctx.createLinearGradient(0, 0, -len, 0);
        g.addColorStop(0, this.color);
        g.addColorStop(1, 'transparent');
        
        ctx.strokeStyle = g;
        ctx.lineWidth = 2 * alpha;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-len, 0); ctx.stroke();
        ctx.restore();
    }
}

export class Shockwave extends Entity {
    public life: number = 0.5;
    public maxLife: number = 0.5;
    public maxRadius: number;

    constructor(x: number, y: number, maxRadius: number = 100) {
        super(x, y, 0);
        this.maxRadius = maxRadius;
    }

    update(dt: number) {
        this.life -= dt;
        if (this.life <= 0) this.isDead = true;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const progress = 1 - (this.life / this.maxLife);
        const radius = progress * this.maxRadius;
        const alpha = this.life / this.maxLife;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 5 * alpha;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

// [修复] 此类重命名为 ChargeParticle 以匹配 GameEngine 的导入
export class ChargeParticle extends Entity {
    public life: number = 1.0;
    
    constructor(x: number, y: number) { super(x, y, 0); }
    
    update(dt: number) {
        this.life -= dt;
        if (this.life <= 0) this.isDead = true;
    }
    
    draw(ctx: CanvasRenderingContext2D) {
        const t = performance.now();
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.globalCompositeOperation = 'lighter';
        // 向内吸入的粒子效果
        for(let i=0; i<4; i++) {
            const angle = (t/200) + (Math.PI*2 * i / 4);
            const r = 20 * this.life;
            ctx.fillStyle = `rgba(14, 165, 233, ${this.life})`;
            ctx.beginPath();
            ctx.arc(Math.cos(angle)*r, Math.sin(angle)*r, 3, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }
}

export class FloatingText extends Entity {
    public text: string;
    public color: string;
    public life: number = 0.8;

    constructor(x: number, y: number, text: string, color: string) {
        super(x, y, 0);
        this.text = text;
        this.color = color;
        this.velocity.y = -60;
    }

    update(dt: number) {
        super.update(dt);
        this.life -= dt;
        if (this.life <= 0) this.isDead = true;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = "bold 18px 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 2;
        ctx.fillText(this.text, this.position.x, this.position.y);
        ctx.restore();
    }
}

/**
 * ==========================================
 * 6. 环境物体 (Environment)
 * ==========================================
 */

export class Star extends Entity {
    private brightness: number;
    private size: number;

    constructor(x: number, y: number) {
        super(x, y, 0);
        this.size = Math.random() * 2 + 0.5;
        this.brightness = Math.random();
        this.velocity.y = 10 + Math.random() * 80;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const t = performance.now() / 1000;
        const blink = 0.5 + 0.5 * Math.sin(t * 2 + this.brightness * 10);
        ctx.fillStyle = `rgba(255, 255, 255, ${this.brightness * blink})`;
        ctx.fillRect(this.position.x, this.position.y, this.size, this.size);
    }
}

export class Meteor extends Entity {
    private rotSpeed: number;
    private drawPoints: number[]; // 缓存顶点防止闪烁

    constructor(x: number, y: number) {
        super(x, y, 15 + Math.random() * 20);
        this.velocity = { x: (Math.random() - 0.5) * 50, y: 100 + Math.random() * 100 };
        this.rotSpeed = (Math.random() - 0.5) * 2;
        // 生成固定的形状顶点
        this.drawPoints = [];
        for(let i=0; i<6; i++) {
             this.drawPoints.push(this.radius * (0.8 + Math.random()*0.4));
        }
    }

    update(dt: number) {
        super.update(dt);
        this.rotation += this.rotSpeed * dt;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);
        
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        for(let i=0; i<6; i++) {
            const angle = (Math.PI * 2 * i) / 6;
            const r = this.drawPoints[i];
            ctx.lineTo(Math.cos(angle)*r, Math.sin(angle)*r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

export class Nebula extends Entity {
    private color: string;

    constructor(x: number, y: number, color: string = '#4c1d95') {
        super(x, y, 150 + Math.random() * 150);
        this.color = color;
        this.velocity.y = 15;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const g = ctx.createRadialGradient(this.position.x, this.position.y, 0, this.position.x, this.position.y, this.radius);
        g.addColorStop(0, this.color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.15;
        ctx.beginPath(); ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

/**
 * ==========================================
 * 7. 道具 (Items)
 * ==========================================
 */
export class Item extends Entity {
    public type: string; // 'upgrade', 'heal'

    constructor(x: number, y: number, type: string) {
        super(x, y, 15);
        this.type = type;
        this.velocity.y = 80;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const t = performance.now() / 1000;
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(Math.sin(t) * 0.5);

        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.strokeRect(-10, -10, 20, 20);
        
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(251, 191, 36, ${0.4 + Math.sin(t*5)*0.2})`;
        ctx.fillRect(-8, -8, 16, 16);
        
        ctx.restore();
    }
}

export class Shield extends Entity {
    public life: number = 1.0;
    constructor(x: number, y: number) { super(x, y, 30); }
    draw(ctx: CanvasRenderingContext2D) { /* 逻辑通常在 Player.draw 中 */ }
}
