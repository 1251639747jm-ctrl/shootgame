import { EntityType } from "../types";
import { EnemyModel } from "./EnemyModel";

/**
 * 核心数学安全工具
 */
const Safe = {
    num: (n: number, def: number = 0) => (isFinite(n) && !isNaN(n) ? n : def),
    percent: (n: number) => Math.max(0, Math.min(1, isFinite(n) ? n : 0))
};

/**
 * ==========================================
 * 1. 基础实体 (Entity) - 物理与空间逻辑
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
    protected friction: number = 0.95;

    constructor(x: number, y: number, radius: number) {
        this.position = { x: Safe.num(x), y: Safe.num(y) };
        this.radius = Safe.num(radius, 1);
    }

    update(dt: number) {
        const _dt = Safe.num(dt, 0.016);
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
 * ==========================================
 * 2. 玩家战机 (Player) - 伪3D机甲工艺
 * ==========================================
 */
export class Player extends Entity {
    public health = 100;
    public maxHealth = 100;
    public energy = 100;
    public weaponLevel = 1;
    public shieldActive = false;
    
    // 对齐 UI 逻辑需要的属性结构
    public shield = { value: 100, max: 100, active: false };

    constructor(x: number, y: number) {
        super(x, y, 22);
        this.friction = 0.92;
    }

    update(dt: number) {
        super.update(dt);
        this.shield.active = this.shieldActive;
        
        // 动态侧倾
        const bank = Safe.num(this.velocity.x / 600 * 0.45);
        this.rotation += (bank - this.rotation) * Safe.num(dt) * 10;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const { x, y } = this.position;
        const t = performance.now() / 1000;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.rotation);

        // 1. 幽能推进器 (带马赫环)
        const p = 1 + Math.sin(t * 30) * 0.1;
        this.drawPlume(ctx, 0, 18, 8, 35 * p, '#0ea5e9', '#fff'); // 主引擎
        this.drawPlume(ctx, -14, 12, 4, 18 * p, '#38bdf8', '#bae6fd'); // 副
        this.drawPlume(ctx, 14, 12, 4, 18 * p, '#38bdf8', '#bae6fd');

        // 2. 底层机翼 (碳纤维质感)
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.moveTo(0, -32); ctx.lineTo(26, 16); ctx.lineTo(10, 16); ctx.lineTo(15, 26);
        ctx.lineTo(0, 20); ctx.lineTo(-15, 26); ctx.lineTo(-10, 16); ctx.lineTo(-26, 16);
        ctx.fill();

        // 3. 核心装甲 (钛金高光渐变)
        const g = ctx.createLinearGradient(-15, -20, 15, 20);
        g.addColorStop(0, '#f8fafc'); g.addColorStop(0.5, '#64748b'); g.addColorStop(1, '#0f172a');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -30); ctx.lineTo(12, 10); ctx.lineTo(0, 16); ctx.lineTo(-12, 10);
        ctx.fill();

        // 4. 驾驶舱 (幽蓝发光)
        ctx.globalCompositeOperation = 'lighter';
        const cg = ctx.createRadialGradient(0, -10, 0, 0, -10, 8);
        cg.addColorStop(0, '#fff'); cg.addColorStop(1, '#0284c7');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.ellipse(0, -10, 4, 10, 0, 0, Math.PI*2); ctx.fill();

        // 5. 护盾场
        if (this.shieldActive) {
            this.renderShield(ctx, t);
        }
        ctx.restore();
    }

    private drawPlume(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, core: string) {
        if (!isFinite(h) || h <= 0) return;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, core); g.addColorStop(0.4, col); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y + h/2, w, h/2, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    private renderShield(ctx: CanvasRenderingContext2D, t: number) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const p = 1 + Math.sin(t * 10) * 0.05;
        const g = ctx.createRadialGradient(0, 0, 30 * p, 0, 0, 40 * p);
        g.addColorStop(0, 'transparent'); g.addColorStop(0.9, 'rgba(56, 189, 248, 0.4)'); g.addColorStop(1, 'rgba(186, 230, 253, 0.8)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, 40 * p, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

/**
 * ==========================================
 * 3. 敌机 (Enemy) - 渲染器桥接
 * ==========================================
 */
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
    draw(ctx: CanvasRenderingContext2D) { EnemyModel.draw(ctx, this); }
}

/**
 * ==========================================
 * 4. 子弹与粒子 (Bullet & Particles)
 * ==========================================
 */
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
        if (this.isEnemy) {
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
            g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#ef4444'); g.addColorStop(1, 'transparent');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
        } else {
            const g = ctx.createLinearGradient(0, -18, 0, 18);
            g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#38bdf8'); g.addColorStop(1, 'transparent');
            ctx.fillStyle = g; ctx.fillRect(-2, -18, 4, 36);
        }
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
    }
    update(dt: number) { super.update(dt); this.life -= dt; if(this.life <= 0) this.isDead = true; }
    draw(ctx: CanvasRenderingContext2D) {
        const speed = Math.hypot(this.velocity.x, this.velocity.y);
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

/**
 * ==========================================
 * 5. 环境与特效 (补全构建所需的所有类)
 * ==========================================
 */

export class Star extends Entity {
    private size = Math.random() * 2;
    private b = Math.random();
    constructor(x: number, y: number) { super(x, y, 0); this.velocity.y = 20 + Math.random()*100; }
    draw(ctx: CanvasRenderingContext2D) {
        const a = this.b * (0.5 + Math.sin(performance.now()/500)*0.5);
        ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
        ctx.fillRect(this.position.x, this.position.y, this.size, this.size);
    }
}

export class Meteor extends Entity {
    private pts: number[] = [];
    constructor(x: number, y: number) {
        super(x, y, 15 + Math.random()*20);
        this.velocity = { x: (Math.random()-0.5)*50, y: 120 };
        for(let i=0; i<8; i++) this.pts.push(this.radius * (0.7 + Math.random()*0.5));
    }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.translate(this.position.x, this.position.y); ctx.rotate(this.rotation);
        ctx.fillStyle = '#475569'; ctx.beginPath();
        this.pts.forEach((r, i) => {
            const ang = (i / 8) * Math.PI * 2;
            ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
        });
        ctx.closePath(); ctx.fill(); ctx.restore();
    }
}

export class Nebula extends Entity {
    constructor(x: number, y: number, public color: string) { super(x, y, 200 + Math.random()*200); this.velocity.y = 10; }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        const g = ctx.createRadialGradient(this.position.x, this.position.y, 0, this.position.x, this.position.y, this.radius);
        g.addColorStop(0, this.color); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.globalAlpha = 0.15;
        ctx.beginPath(); ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

export class Item extends Entity {
    constructor(x: number, y: number, public itemType: string) { super(x, y, 15); this.velocity.y = 80; }
    draw(ctx: CanvasRenderingContext2D) {
        const t = performance.now()/1000;
        ctx.save(); ctx.translate(this.position.x, this.position.y); ctx.rotate(t);
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2; ctx.strokeRect(-10, -10, 20, 20);
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(250, 204, 21, 0.3)'; ctx.fillRect(-8, -8, 16, 16);
        ctx.restore();
    }
}

export class Shockwave extends Entity {
    public life = 1.0;
    constructor(x: number, y: number, public maxRadius: number) { super(x, y, 0); }
    update(dt: number) { this.life -= dt*2; if(this.life <= 0) this.isDead = true; }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,255,255,${this.life})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(this.position.x, this.position.y, this.maxRadius*(1-this.life), 0, Math.PI*2); ctx.stroke();
        ctx.restore();
    }
}

export class FloatingText extends Entity {
    public life = 1.0;
    constructor(x: number, y: number, public text: string, public color: string) { super(x, y, 0); this.velocity.y = -60; }
    update(dt: number) { super.update(dt); this.life -= dt; if(this.life <= 0) this.isDead = true; }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.globalAlpha = this.life; ctx.fillStyle = this.color; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
        ctx.fillText(this.text, this.position.x, this.position.y); ctx.restore();
    }
}

export class ChargeParticle extends Entity {
    public life = 1.0;
    constructor(x: number, y: number) { super(x, y, 0); }
    update(dt: number) { this.life -= dt; if(this.life <= 0) this.isDead = true; }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.save(); ctx.translate(this.position.x, this.position.y); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(56, 189, 248, ${this.life})`;
        for(let i=0; i<4; i++) {
            const a = (performance.now()/200) + (i*Math.PI/2);
            ctx.beginPath(); ctx.arc(Math.cos(a)*20*this.life, Math.sin(a)*20*this.life, 2, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
}

// 占位导出，确保 Shield 类存在（逻辑通常已整合在 Player 中）
export class Shield extends Entity { draw() {} }
