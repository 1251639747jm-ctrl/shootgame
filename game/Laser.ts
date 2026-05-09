import { Entity } from "./Entities";
import { EntityType, Vector2 } from "../types";
import { Player } from "./Entities";

/**
 * HYPER BEAM 激光 - 视觉重写版
 *
 * 视觉目标：
 *   - 干净的三层光束：深蓝外晕 / 青色主体 / 纯白核心
 *   - 发射点有能量汇聚球
 *   - 束身微微脉动，末端有收束闪光
 *   - 去掉色散错位、虚线流纹等杂乱元素
 *   - 少量火花点缀
 *
 * 性能目标：
 *   - 不使用 shadowBlur
 *   - 每帧约 6~8 次 fillRect / arc，远低于原先
 */

const LASER = {
    DAMAGE: 160,
    LENGTH: 2000,
    WIDTH: 42,
    PHASE_CHARGE: 0.18,
    PHASE_FIRE:   1.15,
    PHASE_DECAY:  0.28,
    COLOR_CORE:   '#ffffff',
    COLOR_INNER:  '#6ef2ff',
    COLOR_MID:    '#1f9bff',
    COLOR_OUTER:  'rgba(20, 60, 200, 0.55)'
};

class Spark {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number;

    constructor(sx: number, sy: number, angle: number) {
        this.x = sx;
        this.y = sy;
        const spread = angle + (Math.random() - 0.5) * 1.8;
        const sp = Math.random() * 500 + 180;
        this.vx = Math.sin(spread) * sp;
        this.vy = -Math.cos(spread) * sp;
        this.maxLife = Math.random() * 0.35 + 0.1;
        this.life = this.maxLife;
        this.size = Math.random() * 2.2 + 0.8;
    }

    update(dt: number) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.92;
        this.vy *= 0.92;
        this.life -= dt;
    }
}

export class Laser extends Entity {
    owner: Player;
    timer: number = 0;
    phase: 'charge' | 'fire' | 'decay' = 'charge';

    startPoint: Vector2 = { x: 0, y: 0 };
    length: number = LASER.LENGTH;
    width: number = LASER.WIDTH * 0.5; // used for collision; becomes half the full beam width
    currentWidth: number = 0;

    damage: number = 0;

    private sparks: Spark[] = [];
    private sparkTimer: number = 0;

    constructor(owner: Player) {
        super(owner.position.x, owner.position.y, EntityType.WEAPON_LASER);
        this.owner = owner;
        this.rotation = owner.rotation;
        this.radius = LASER.WIDTH * 0.5;
        this.updateGeometry();
    }

    private updateGeometry() {
        this.rotation = this.owner.rotation;
        this.startPoint.x = this.owner.position.x + 40 * Math.sin(this.rotation);
        this.startPoint.y = this.owner.position.y - 40 * Math.cos(this.rotation);
        this.position.x = this.startPoint.x;
        this.position.y = this.startPoint.y;
    }

    update(dt: number) {
        if (this.owner.markedForDeletion) {
            this.markedForDeletion = true;
            return;
        }

        this.timer += dt;
        this.updateGeometry();

        let mult = 0;
        const t = this.timer;

        if (t < LASER.PHASE_CHARGE) {
            this.phase = 'charge';
            const p = t / LASER.PHASE_CHARGE;
            this.currentWidth = 4 + p * 6;
        } else if (t < LASER.PHASE_CHARGE + LASER.PHASE_FIRE) {
            this.phase = 'fire';
            mult = 1.0;
            // subtle pulse
            this.currentWidth = LASER.WIDTH + Math.sin(t * 24) * 4;
        } else if (t < LASER.PHASE_CHARGE + LASER.PHASE_FIRE + LASER.PHASE_DECAY) {
            this.phase = 'decay';
            const td = t - (LASER.PHASE_CHARGE + LASER.PHASE_FIRE);
            const p = 1 - (td / LASER.PHASE_DECAY);
            this.currentWidth = LASER.WIDTH * p;
            mult = p;
        } else {
            this.markedForDeletion = true;
            return;
        }

        const levelBoost = 1 + (this.owner.level * 0.22);
        this.damage = LASER.DAMAGE * this.owner.damageMultiplier * levelBoost * mult;

        // sparks at muzzle, rate-limited
        if (this.phase !== 'charge') {
            this.sparkTimer += dt;
            if (this.sparkTimer > 0.015) {
                this.sparkTimer = 0;
                const count = this.phase === 'fire' ? 2 : 1;
                for (let i = 0; i < count; i++) {
                    this.sparks.push(new Spark(this.startPoint.x, this.startPoint.y, this.rotation));
                }
            }
        }

        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const s = this.sparks[i];
            s.update(dt);
            if (s.life <= 0) this.sparks.splice(i, 1);
        }
    }

    static draw(ctx: CanvasRenderingContext2D, laser: Laser) {
        const { x, y } = laser.startPoint;
        const w = laser.currentWidth;
        if (w <= 0.5) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(laser.rotation);
        ctx.globalCompositeOperation = 'lighter';

        if (laser.phase === 'charge') {
            Laser.drawCharge(ctx, laser);
        } else {
            const len = laser.length;

            // 1) Outer glow (wide, soft)
            ctx.fillStyle = LASER.COLOR_OUTER;
            ctx.fillRect(-w * 1.6, -len, w * 3.2, len);

            // 2) Mid beam
            ctx.fillStyle = LASER.COLOR_MID;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(-w * 0.7, -len, w * 1.4, len);
            ctx.globalAlpha = 1;

            // 3) Inner bright
            ctx.fillStyle = LASER.COLOR_INNER;
            ctx.fillRect(-w * 0.38, -len, w * 0.76, len);

            // 4) Pure white core
            ctx.fillStyle = LASER.COLOR_CORE;
            ctx.fillRect(-w * 0.14, -len, w * 0.28, len);

            // 5) Muzzle flash ball at firing point
            const flash = 1 + Math.sin(performance.now() * 0.04) * 0.2;
            const mg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 2.2 * flash);
            mg.addColorStop(0, 'rgba(255, 255, 255, 1)');
            mg.addColorStop(0.3, 'rgba(160, 240, 255, 0.85)');
            mg.addColorStop(1, 'rgba(20, 80, 255, 0)');
            ctx.fillStyle = mg;
            ctx.beginPath();
            ctx.arc(0, 0, w * 2.2 * flash, 0, Math.PI * 2);
            ctx.fill();

            // 6) Tip bloom (far end)
            const tg = ctx.createRadialGradient(0, -len, 0, 0, -len, w * 1.4);
            tg.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            tg.addColorStop(1, 'rgba(20, 80, 255, 0)');
            ctx.fillStyle = tg;
            ctx.beginPath();
            ctx.arc(0, -len, w * 1.4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // 7) sparks (world space)
        if (laser.sparks.length) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (const s of laser.sparks) {
                const a = s.life / s.maxLife;
                ctx.fillStyle = `rgba(255, 235, 140, ${a})`;
                ctx.fillRect(s.x - s.size * 0.5, s.y - s.size * 0.5, s.size, s.size);
            }
            ctx.restore();
        }
    }

    private static drawCharge(ctx: CanvasRenderingContext2D, laser: Laser) {
        const p = laser.timer / LASER.PHASE_CHARGE;
        const r = 32 * (1 - p) + 8;

        // convergence ring
        ctx.strokeStyle = `rgba(120, 230, 255, ${0.3 + p * 0.7})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        // core dot
        const coreR = 2 + p * 6;
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2);
        cg.addColorStop(0, 'rgba(255, 255, 255, 1)');
        cg.addColorStop(1, 'rgba(100, 200, 255, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, coreR * 2, 0, Math.PI * 2);
        ctx.fill();
    }
}
