import { Entity, Enemy } from "./Entities";
import { EntityType, Vector2 } from "../types";
import { Player } from "./Entities";

/**
 * 追踪导弹 - 性能+视觉重写版
 *
 * 视觉：
 *   - 锐利的三角箭型主体 + 发光钩型尾翼
 *   - 鼻锥热感红点
 *   - 简洁的圆形/椭圆等离子尾焰，粒子带颜色渐变 (从白 -> 粉 -> 紫)
 *
 * 性能：
 *   - 没有 shadowBlur
 *   - 粒子不再用 radialGradient 每个建一次，改为简单叠加两层 fillStyle
 *   - 粒子上限 ~22 个 (老实现每帧就生成 3 个，活 0.6s，满世界都是)
 *   - 简化 PID 控制 (一个纯比例项就够，去掉积分/微分)
 */

const MC = {
    LAUNCH_SPEED: 350,
    MAX_SPEED: 1100,
    ACCEL: 1500,
    TURN_SPEED_MAX: 5.5,
    BURN_TIME: 3.0,
    SCAN_RADIUS: 1400,
    MAX_LIFE: 5.5,
    MAX_PARTICLES: 22
};

class ExhaustParticle {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number;

    constructor(x: number, y: number, vx: number, vy: number, life: number, size: number) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.maxLife = life;
        this.life = life;
        this.size = size;
    }

    update(dt: number) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.9;
        this.vy *= 0.9;
        this.life -= dt;
        this.size *= 0.94;
    }
}

export class Missile extends Entity {
    damage: number;

    target: Enemy | null = null;
    private flightTime: number = 0;
    private speed: number;
    private engineActive: boolean = true;

    private particles: ExhaustParticle[] = [];
    private particleTimer: number = 0;

    constructor(x: number, y: number, rotation: number, owner: Player) {
        super(x, y, EntityType.WEAPON_MISSILE);
        this.rotation = rotation;
        this.radius = 14;
        this.damage = 80 * (owner.damageMultiplier || 1);

        this.speed = MC.LAUNCH_SPEED;
        this.velocity.x = Math.sin(rotation) * this.speed;
        this.velocity.y = -Math.cos(rotation) * this.speed;
    }

    update(dt: number, context?: any) {
        this.flightTime += dt;
        const enemies = Array.isArray(context) ? (context as Entity[]) : [];

        // 1) 寻敌
        if (!this.target || this.target.markedForDeletion) {
            this.target = null;
            let best: Enemy | null = null;
            let bestD = MC.SCAN_RADIUS;
            for (const e of enemies) {
                if (e instanceof Enemy && !e.markedForDeletion) {
                    const d = Math.hypot(e.position.x - this.position.x, e.position.y - this.position.y);
                    if (d < bestD) { bestD = d; best = e; }
                }
            }
            this.target = best;
        }

        // 2) 推进
        if (this.flightTime < MC.BURN_TIME && this.engineActive) {
            this.speed = Math.min(MC.MAX_SPEED, this.speed + MC.ACCEL * dt);
        } else {
            this.speed *= Math.pow(0.98, dt * 60); // mild drag
            this.engineActive = false;
        }

        // 3) 制导 - 比例导引, 足够了, 也更稳
        if (this.target && this.engineActive) {
            const dx = this.target.position.x - this.position.x;
            const dy = this.target.position.y - this.position.y;
            const desired = Math.atan2(dx, -dy);
            let diff = desired - this.rotation;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            const rate = Math.max(-MC.TURN_SPEED_MAX, Math.min(MC.TURN_SPEED_MAX, diff * 6));
            this.rotation += rate * dt;
        }

        // 4) 应用速度
        this.velocity.x = Math.sin(this.rotation) * this.speed;
        this.velocity.y = -Math.cos(this.rotation) * this.speed;
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        // 5) 尾焰 (节流 + 上限)
        this.particleTimer += dt;
        if (this.engineActive && this.particleTimer > 0.025 && this.particles.length < MC.MAX_PARTICLES) {
            this.particleTimer = 0;
            const a = this.rotation + Math.PI + (Math.random() - 0.5) * 0.35;
            const sp = this.speed * 0.35 + Math.random() * 140;
            // 尾部位置 (沿 -rotation 方向往后一点)
            const bx = this.position.x - Math.sin(this.rotation) * 14;
            const by = this.position.y + Math.cos(this.rotation) * 14;
            this.particles.push(new ExhaustParticle(
                bx, by,
                Math.sin(a) * sp, -Math.cos(a) * sp,
                0.25 + Math.random() * 0.2,
                6 + Math.random() * 5
            ));
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }

        if (this.flightTime > MC.MAX_LIFE) this.markedForDeletion = true;
    }

    static draw(ctx: CanvasRenderingContext2D, m: Missile) {
        // --- 尾焰 (粒子, 世界空间, 无 radialGradient) ---
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const p of m.particles) {
            const a = Math.max(0, p.life / p.maxLife);
            // 外层粉紫
            ctx.fillStyle = `rgba(216, 70, 239, ${a * 0.55})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            // 内层亮白
            ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.9})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.45, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // --- 本体 ---
        const s = 1.4;
        ctx.save();
        ctx.translate(m.position.x, m.position.y);
        ctx.rotate(m.rotation);

        // 外发光 (半透明更大弹体代替 shadowBlur)
        ctx.fillStyle = 'rgba(216, 70, 239, 0.25)';
        ctx.beginPath();
        ctx.moveTo(0, -22 * s);
        ctx.lineTo(10 * s, 14 * s);
        ctx.lineTo(-10 * s, 14 * s);
        ctx.closePath();
        ctx.fill();

        // 主体 (锐利三角箭)
        const hull = ctx.createLinearGradient(-6 * s, 0, 6 * s, 0);
        hull.addColorStop(0, '#4a044e');
        hull.addColorStop(0.5, '#a21caf');
        hull.addColorStop(1, '#4a044e');
        ctx.fillStyle = hull;
        ctx.strokeStyle = '#f5d0fe';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -20 * s);
        ctx.lineTo(7 * s, 10 * s);
        ctx.lineTo(0, 6 * s);
        ctx.lineTo(-7 * s, 10 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 中线高光
        ctx.strokeStyle = 'rgba(255, 230, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -18 * s);
        ctx.lineTo(0, 4 * s);
        ctx.stroke();

        // 钩型尾翼 (左右)
        ctx.fillStyle = '#701a75';
        ctx.strokeStyle = '#e9b0ff';
        ctx.lineWidth = 1;
        // 右
        ctx.beginPath();
        ctx.moveTo(5 * s, 2 * s);
        ctx.lineTo(13 * s, 10 * s);
        ctx.lineTo(7 * s, 10 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 左
        ctx.beginPath();
        ctx.moveTo(-5 * s, 2 * s);
        ctx.lineTo(-13 * s, 10 * s);
        ctx.lineTo(-7 * s, 10 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 鼻锥热感红点 (锁定目标时)
        if (m.target) {
            const blink = ((performance.now() * 0.012) | 0) & 1;
            ctx.fillStyle = blink ? '#ff2d4d' : '#7a0a20';
            ctx.beginPath();
            ctx.arc(0, -17 * s, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
