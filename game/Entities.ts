import { EntityType } from "../types";
import { EnemyModel } from "./EnemyModel";

/**
 * 【安全护航】生产环境数值保护
 */
const Safe = {
    n: (v: any, def = 0) => (isFinite(v) && !isNaN(v) ? v : def),
    off: (v: number) => Math.max(0, Math.min(1, isFinite(v) ? v : 0))
};

export abstract class Entity {
    public id: string = crypto.randomUUID();
    public position: { x: number; y: number };
    public velocity: { x: number; y: number } = { x: 0, y: 0 };
    public acceleration: { x: number; y: number } = { x: 0, y: 0 };
    public radius: number;
    public rotation: number = 0;
    public isDead: boolean = false;
    protected friction: number = 0.95;

    constructor(x: number, y: number, radius: number) {
        this.position = { x: Safe.n(x), y: Safe.n(y) };
        this.radius = Safe.n(radius, 1);
    }

    update(dt: number) {
        const _dt = Safe.n(dt, 0.016);
        this.velocity.x += this.acceleration.x * _dt;
        this.velocity.y += this.acceleration.y * _dt;
        const damping = Math.pow(this.friction, _dt * 60);
        this.velocity.x *= damping;
        this.velocity.y *= damping;
        this.position.x += this.velocity.x * _dt;
        this.position.y += this.velocity.y * _dt;
        this.acceleration = { x: 0, y: 0 };
    }

    abstract draw(ctx: CanvasRenderingContext2D): void;
}

/**
 * 1. 玩家战机 - 保持最高工艺标准
 */
export class Player extends Entity {
    public health = 100; public maxHealth = 100; public energy = 100;
    public weaponLevel = 1; public shieldActive = false;
    public shield = { value: 100, max: 100, active: false };

    constructor(x: number, y: number) { super(x, y, 22); this.friction = 0.92; }

    update(dt: number) {
        super.update(dt);
        this.shield.active = this.shieldActive;
        const bank = Safe.n(this.velocity.x / 600 * 0.45);
        this.rotation += (bank - this.rotation) * Safe.n(dt) * 10;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const { x, y } = this.position;
        const t = performance.now() / 1000;
        ctx.save();
        ctx.translate(Safe.n(x), Safe.n(y));
        ctx.rotate(Safe.n(this.rotation));

        // 推进器 (马赫环)
        const p = 1 + Math.sin(t * 30) * 0.1;
        this.drawPlume(ctx, 0, 18, 8, 35 * p, '#0ea5e9');
        this.drawPlume(ctx, -14, 12, 4, 18 * p, '#38bdf8');
        this.drawPlume(ctx, 14, 12, 4, 18 * p, '#38bdf8');

        // 主体装甲 (钛金质感)
        const g = ctx.createLinearGradient(-15, -20, 15, 20);
        g.addColorStop(0, '#f8fafc'); g.addColorStop(0.5, '#64748b'); g.addColorStop(1, '#0f172a');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0,-30); ctx.lineTo(12,10); ctx.lineTo(0,16); ctx.lineTo(-12,10); ctx.fill();

        if (this.shieldActive) this.drawShieldRing(ctx, t);
        ctx.restore();
    }

    private drawPlume(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
        if (h <= 0) return;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, '#fff'); g.addColorStop(Safe.off(0.4), col); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y+h/2, w, h/2, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    private drawShieldRing(ctx: CanvasRenderingContext2D, t: number) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + Math.sin(t*10)*0.2})`;
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0,38,0,Math.PI*2); ctx.stroke();
        ctx.restore();
    }
}

/**
 * 2. 敌机 - 桥接 EnemyModel
 */
export class Enemy extends Entity {
    public health: number; public maxHealth: number; public type: EntityType;
    constructor(x: number, y: number, type: EntityType, hp: number = 100) {
        super(x, y, 20); this.type = type; this.health = hp; this.maxHealth = hp;
    }
    draw(ctx: CanvasRenderingContext2D) { EnemyModel.draw(ctx, this); }
}

/**
 * 3. 道具 (Item) - 全息浮空晶体
 */
export class Item extends Entity {
    constructor(x: number, y: number, public itemType: string) {
        super(x, y, 15);
        this.velocity.y = 80;
    }
    draw(ctx: CanvasRenderingContext2D) {
        const t = performance.now() / 1000;
        const { x, y } = this.position;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t);
        
        // 外部全息框
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.strokeRect(-12, -12, 24, 24);
        
        // 内部旋转核心
        ctx.rotate(-t * 2);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#eab308');
        ctx.fillStyle = g;
        ctx.fillRect(-6, -6, 12, 12);
        
        // 底部光效
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(250, 204, 21, ${0.2 + Math.sin(t*5)*0.1})`;
        ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

/**
 * 4. 冲击波 (Shockwave) - 能量扩散圈
 */
export class Shockwave extends Entity {
    public life = 1.0;
    constructor(x: number, y: number, public maxRadius: number) { super(x, y, 0); }
    update(dt: number) { this.life -= dt * 2; if (this.life <= 0) this.isDead = true; }
    draw(ctx: CanvasRenderingContext2D) {
        const { x, y } = this.position;
        const radius = (1 - this.life) * this.maxRadius;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.life})`;
        ctx.lineWidth = 4 * this.life;
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI*2); ctx.stroke();
        
        // 内层光环
        ctx.strokeStyle = `rgba(56, 189, 248, ${this.life * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, radius * 0.8, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
    }
}

/**
 * 5. 浮动文字 (FloatingText) - 伤害与提示文字
 */
export class FloatingText extends Entity {
    public life = 1.0;
    constructor(x: number, y: number, public text: string, public color: string) {
        super(x, y, 0);
        this.velocity.y = -60;
    }
    update(dt: number) { super.update(dt); this.life -= dt; if (this.life <= 0) this.isDead = true; }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = Safe.off(this.life);
        ctx.fillStyle = this.color;
        ctx.font = "bold 20px 'Exo 2', sans-serif";
        ctx.textAlign = "center";
        // 简单描边增强可读性
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(this.text, this.position.x, this.position.y);
        ctx.fillText(this.text, this.position.x, this.position.y);
        ctx.restore();
    }
}

/**
 * 6. 蓄力粒子 (ChargeParticle) - 向内吸入效果
 */
export class ChargeParticle extends Entity {
    public life = 1.0;
    private startDist: number;
    private angle: number;

    constructor(x: number, y: number) {
        super(x, y, 0);
        this.angle = Math.random() * Math.PI * 2;
        this.startDist = 40 + Math.random() * 40;
    }
    update(dt: number) { this.life -= dt * 1.5; if (this.life <= 0) this.isDead = true; }
    draw(ctx: CanvasRenderingContext2D) {
        const dist = this.life * this.startDist;
        const px = this.position.x + Math.cos(this.angle) * dist;
        const py = this.position.y + Math.sin(this.angle) * dist;
        
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(56, 189, 248, ${1 - this.life})`;
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

/**
 * 7. 星云 (Nebula) - 巨大的远景云雾
 */
export class Nebula extends Entity {
    constructor(x: number, y: number, public color: string) {
        super(x, y, 200 + Math.random() * 200);
        this.velocity.y = 15;
    }
    draw(ctx: CanvasRenderingContext2D) {
        const { x, y } = this.position;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const g = ctx.createRadialGradient(x, y, 0, x, y, this.radius);
        g.addColorStop(0, this.color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.12;
        ctx.beginPath(); ctx.arc(x, y, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

/**
 * 8. 环境与其他 (Bullet, Particle, Star, Meteor, Shield)
 */
export class Bullet extends Entity {
    public isEnemy: boolean;
    constructor(x: number, y: number, isEnemy: boolean) { super(x, y, 4); this.isEnemy = isEnemy; }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.translate(this.position.x, this.position.y); ctx.rotate(this.rotation);
        ctx.globalCompositeOperation = 'lighter';
        const col = this.isEnemy ? '#ff4444' : '#00f2ff';
        const g = ctx.createLinearGradient(0, -15, 0, 15);
        g.addColorStop(0, '#fff'); g.addColorStop(1, col);
        ctx.fillStyle = g; ctx.fillRect(-2, -15, 4, 30);
        ctx.restore();
    }
}

export class Particle extends Entity {
    public life = 1.0; constructor(x: number, y: number, public color: string) { super(x, y, 2); }
    update(dt: number) { super.update(dt); this.life -= dt; if (this.life <= 0) this.isDead = true; }
    draw(ctx: CanvasRenderingContext2D) {
        const speed = Math.hypot(this.velocity.x, this.velocity.y);
        const len = Math.min(speed * 0.1, 15);
        ctx.save(); ctx.translate(this.position.x, this.position.y); ctx.rotate(Math.atan2(this.velocity.y, this.velocity.x));
        ctx.globalAlpha = Safe.off(this.life); ctx.strokeStyle = this.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-len, 0); ctx.stroke(); ctx.restore();
    }
}

export class Star extends Entity {
    private sz = Math.random() * 2;
    constructor(x: number, y: number) { super(x, y, 0); this.velocity.y = 20 + Math.random()*100; }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random()*0.4})`;
        ctx.fillRect(this.position.x, this.position.y, this.sz, this.sz);
    }
}

export class Meteor extends Entity {
    private pts: number[] = [];
    constructor(x: number, y: number) {
        super(x, y, 15 + Math.random()*15); this.velocity.y = 100;
        for(let i=0; i<8; i++) this.pts.push(this.radius * (0.8 + Math.random()*0.4));
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.translate(this.position.x, this.position.y); ctx.fillStyle = '#4b5563';
        ctx.beginPath(); this.pts.forEach((r, i) => {
            const a = (i/8)*Math.PI*2; ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
        });
        ctx.closePath(); ctx.fill(); ctx.restore();
    }
}

export class Shield extends Entity {
    public life = 1.0;
    constructor(x: number, y: number, radius: number) { super(x, y, radius); }
    draw(ctx: CanvasRenderingContext2D) {
        // 独立护盾实体的绘制 (如掉落的护盾球)
        ctx.save();
        ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
    }
}
