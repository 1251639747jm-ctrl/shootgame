import { EntityType, WeaponType } from "../types";
import { EnemyModel } from "./EnemyModel";

// ==========================================
// 1. 基础抽象类 (Entity)
// ==========================================
export abstract class Entity {
    public id: string = crypto.randomUUID();
    public position: { x: number; y: number };
    public velocity: { x: number; y: number } = { x: 0, y: 0 };
    public acceleration: { x: number; y: number } = { x: 0, y: 0 };
    public radius: number;
    public rotation: number = 0;
    public isDead: boolean = false;
    protected friction: number = 0.95;
    protected mass: number = 1.0;

    constructor(x: number, y: number, radius: number) {
        this.position = { x, y };
        this.radius = radius;
    }

    update(dt: number) {
        this.velocity.x += this.acceleration.x * dt;
        this.velocity.y += this.acceleration.y * dt;
        const d = Math.pow(this.friction, dt * 60);
        this.velocity.x *= d;
        this.velocity.y *= d;
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.acceleration = { x: 0, y: 0 };
    }

    applyForce(x: number, y: number) {
        this.acceleration.x += x / this.mass;
        this.acceleration.y += y / this.mass;
    }

    abstract draw(ctx: CanvasRenderingContext2D): void;
}

// ==========================================
// 2. 战斗单位 (Player & Enemy)
// ==========================================

export class Player extends Entity {
    public health: number = 100;
    public maxHealth: number = 100;
    public energy: number = 100;
    public shieldActive: boolean = false;

    constructor(x: number, y: number) {
        super(x, y, 22);
        this.friction = 0.92;
    }

    update(dt: number) {
        super.update(dt);
        const maxBank = 0.45;
        const targetBank = (this.velocity.x / 600) * maxBank;
        this.rotation += (targetBank - this.rotation) * dt * 8;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const { x, y } = this.position;
        const t = performance.now() / 1000;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.rotation);

        // 引擎排气
        const p = 1 + Math.sin(t * 30) * 0.1;
        this.drawThrust(ctx, 0, 18, 8, 30 * p, '#0ea5e9');
        this.drawThrust(ctx, -12, 12, 4, 15 * p, '#38bdf8');
        this.drawThrust(ctx, 12, 12, 4, 15 * p, '#38bdf8');

        // 机体
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(0, -30); ctx.lineTo(25, 15); ctx.lineTo(0, 22); ctx.lineTo(-25, 15);
        ctx.fill();

        const g = ctx.createLinearGradient(-15, -20, 15, 20);
        g.addColorStop(0, '#f8fafc'); g.addColorStop(1, '#475569');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -28); ctx.lineTo(12, 8); ctx.lineTo(0, 12); ctx.lineTo(-12, 8);
        ctx.fill();

        if (this.shieldActive) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI*2); ctx.stroke();
        }
        ctx.restore();
    }

    private drawThrust(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, '#fff'); g.addColorStop(0.2, col); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y + h/2, w/2, h/2, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

export class Enemy extends Entity {
    public health: number;
    public maxHealth: number;
    public type: EntityType;

    constructor(x: number, y: number, type: EntityType, hp: number = 100) {
        super(x, y, 20);
        this.type = type;
        this.health = hp;
        this.maxHealth = hp;
    }

    draw(ctx: CanvasRenderingContext2D) {
        EnemyModel.draw(ctx, this);
    }
}

// ==========================================
// 3. 道具与特效 (Item, Shield, Shockwave, etc.)
// ==========================================

export class Item extends Entity {
    constructor(x: number, y: number, public itemType: string) {
        super(x, y, 15);
        this.velocity.y = 100;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const t = performance.now() / 1000;
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(t * 2);
        
        // 旋转的科技立方体
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.strokeRect(-10, -10, 20, 20);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(250, 204, 21, 0.3)';
        ctx.fillRect(-8, -8, 16, 16);
        ctx.restore();
    }
}

export class Shield extends Entity {
    public life = 1.0;
    constructor(x: number, y: number, radius: number) { super(x, y, radius); }
    draw(ctx: CanvasRenderingContext2D) {
        // 逻辑在 Player.draw 中或独立渲染
    }
}

export class Shockwave extends Entity {
    public life = 1.0;
    constructor(x: number, y: number, public maxRadius: number) { super(x, y, 0); }
    update(dt: number) {
        this.life -= dt * 2;
        if (this.life <= 0) this.isDead = true;
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.life})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(this.position.x, this.position.y, this.maxRadius * (1 - this.life), 0, Math.PI*2); ctx.stroke();
        ctx.restore();
    }
}

export class FloatingText extends Entity {
    public life = 1.0;
    constructor(x: number, y: number, public text: string, public color: string) {
        super(x, y, 0);
        this.velocity.y = -50;
    }
    update(dt: number) {
        super.update(dt);
        this.life -= dt;
        if (this.life <= 0) this.isDead = true;
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.text, this.position.x, this.position.y);
        ctx.restore();
    }
}

export class Charge extends Entity {
    public life = 1.0;
    constructor(x: number, y: number) { super(x, y, 0); }
    draw(ctx: CanvasRenderingContext2D) {
        // 能量积攒特效
    }
}

// ==========================================
// 4. 环境物体 (Star, Meteor, Nebula)
// ==========================================

export class Star extends Entity {
    private size: number;
    private brightness: number;

    constructor(x: number, y: number) {
        super(x, y, 0);
        this.size = Math.random() * 2;
        this.velocity.y = 20 + Math.random() * 50;
        this.brightness = Math.random();
    }

    draw(ctx: CanvasRenderingContext2D) {
        const blink = this.brightness * (0.5 + Math.sin(performance.now()/500)*0.5);
        ctx.fillStyle = `rgba(255, 255, 255, ${blink})`;
        ctx.fillRect(this.position.x, this.position.y, this.size, this.size);
    }
}

export class Meteor extends Entity {
    constructor(x: number, y: number) {
        super(x, y, 15 + Math.random() * 20);
        this.velocity = { x: (Math.random()-0.5)*100, y: 150 + Math.random()*100 };
        this.rotation = Math.random() * Math.PI * 2;
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = '#444';
        ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

export class Nebula extends Entity {
    private color: string;
    constructor(x: number, y: number, color: string) {
        super(x, y, 100 + Math.random() * 200);
        this.color = color;
        this.velocity.y = 10;
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const g = ctx.createRadialGradient(this.position.x, this.position.y, 0, this.position.x, this.position.y, this.radius);
        g.addColorStop(0, this.color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.2;
        ctx.beginPath(); ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

// ==========================================
// 5. 子弹与粒子 (Bullet & Particle)
// ==========================================

export class Bullet extends Entity {
    public isEnemy: boolean;
    constructor(x: number, y: number, isEnemy: boolean) {
        super(x, y, 4);
        this.isEnemy = isEnemy;
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);
        ctx.globalCompositeOperation = 'lighter';
        const col = this.isEnemy ? '#ef4444' : '#0ea5e9';
        const g = ctx.createLinearGradient(0, -15, 0, 15);
        g.addColorStop(0, '#fff'); g.addColorStop(1, col);
        ctx.fillStyle = g;
        ctx.fillRect(-2, -15, 4, 30);
        ctx.restore();
    }
}

export class Particle extends Entity {
    public life = 1.0;
    public maxLife = 1.0;
    public color: string;
    constructor(x: number, y: number, color: string) {
        super(x, y, 2);
        this.color = color;
        this.friction = 0.95;
    }
    update(dt: number) {
        super.update(dt);
        this.life -= dt;
        if (this.life <= 0) this.isDead = true;
    }
    draw(ctx: CanvasRenderingContext2D) {
        const speed = Math.sqrt(this.velocity.x**2 + this.velocity.y**2);
        const len = Math.min(speed * 0.1, 20);
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(Math.atan2(this.velocity.y, this.velocity.x));
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, 0, -len, 0);
        g.addColorStop(0, this.color); g.addColorStop(1, 'transparent');
        ctx.strokeStyle = g; ctx.lineWidth = 2 * (this.life/this.maxLife);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-len, 0); ctx.stroke();
        ctx.restore();
    }
}
