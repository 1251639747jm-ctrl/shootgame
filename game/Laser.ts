import { Entity } from "./Entities";
import { EntityType, Vector2 } from "../types";
import { Player } from "./Entities";

/**
 * HYPER BEAM LASER - 视觉重制版
 *
 * 两个阶段：
 * 1. 充能阶段 (在 Player.chargeLevel 上)
 *    由 drawChargingOverlay 绘制在玩家头顶：
 *    - 4 个围绕轨道旋转的能量球, 随充能进度向中心汇聚
 *    - 中心白色高能核心脉动
 *    - 外圈描边随进度收紧并变亮
 *    - 电弧在玩家与核心之间跳动
 *    - 100% 蓄满时一圈扩散光波
 *
 * 2. 发射阶段 (这个 Laser 实体)
 *    - 巨大短暂的枪口闪光
 *    - 4 层同心光束：深蓝外晕 / 蓝主体 / 青色内层 / 纯白核心
 *    - 沿光束向上流动的亮白能量脉冲 (模糊感 + 动能)
 *    - 少量火花，末端柔和光斑
 */

const BEAM = {
    DAMAGE: 160,
    LENGTH: 2500,
    WIDTH: 48,
    T_CHARGE: 0.10,   // 发射阶段的 "拔剑" 开场
    T_FIRE:   1.10,   // 主发射
    T_DECAY:  0.30
};

class Spark {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number;

    constructor(sx: number, sy: number, angle: number) {
        this.x = sx; this.y = sy;
        const a = angle + (Math.random() - 0.5) * 2.2;
        const s = Math.random() * 560 + 220;
        this.vx = Math.sin(a) * s;
        this.vy = -Math.cos(a) * s;
        this.maxLife = Math.random() * 0.4 + 0.1;
        this.life = this.maxLife;
        this.size = Math.random() * 2.4 + 0.8;
    }
    update(dt: number) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.9;
        this.vy *= 0.9;
        this.life -= dt;
    }
}

// 沿光束向上流动的高亮脉冲
class BeamPulse {
    y: number;   // local y (along beam), 0 at muzzle, negative = forward
    speed: number;
    size: number;
    life: number;
    constructor(len: number) {
        this.y = 0;
        this.speed = 2400 + Math.random() * 1500;
        this.size = 12 + Math.random() * 14;
        this.life = len / this.speed;
    }
    update(dt: number) {
        this.y -= this.speed * dt;
        this.life -= dt;
    }
}

export class Laser extends Entity {
    owner: Player;
    timer: number = 0;
    phase: 'charge' | 'fire' | 'decay' = 'charge';

    startPoint: Vector2 = { x: 0, y: 0 };
    length: number = BEAM.LENGTH;
    width: number = BEAM.WIDTH * 0.5;  // 半宽，给 GameEngine 的碰撞用
    currentWidth: number = 0;

    damage: number = 0;

    private sparks: Spark[] = [];
    private sparkTimer: number = 0;

    private pulses: BeamPulse[] = [];
    private pulseTimer: number = 0;

    constructor(owner: Player) {
        super(owner.position.x, owner.position.y, EntityType.WEAPON_LASER);
        this.owner = owner;
        this.rotation = owner.rotation;
        this.radius = BEAM.WIDTH * 0.5;
        this.updateGeometry();
    }

    private updateGeometry() {
        this.rotation = this.owner.rotation;
        this.startPoint.x = this.owner.position.x + 34 * Math.sin(this.rotation);
        this.startPoint.y = this.owner.position.y - 34 * Math.cos(this.rotation);
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

        if (t < BEAM.T_CHARGE) {
            this.phase = 'charge';
            const p = t / BEAM.T_CHARGE;
            this.currentWidth = 6 + p * 12;
        } else if (t < BEAM.T_CHARGE + BEAM.T_FIRE) {
            this.phase = 'fire';
            mult = 1;
            this.currentWidth = BEAM.WIDTH + Math.sin(t * 28) * 4;
        } else if (t < BEAM.T_CHARGE + BEAM.T_FIRE + BEAM.T_DECAY) {
            this.phase = 'decay';
            const td = t - (BEAM.T_CHARGE + BEAM.T_FIRE);
            const p = 1 - (td / BEAM.T_DECAY);
            this.currentWidth = BEAM.WIDTH * p;
            mult = p * p; // damage falls off faster
        } else {
            this.markedForDeletion = true;
            return;
        }

        const levelBoost = 1 + this.owner.level * 0.22;
        this.damage = BEAM.DAMAGE * this.owner.damageMultiplier * levelBoost * mult;

        // 火花
        if (this.phase !== 'charge') {
            this.sparkTimer += dt;
            if (this.sparkTimer > 0.012) {
                this.sparkTimer = 0;
                const n = this.phase === 'fire' ? 2 : 1;
                for (let i = 0; i < n; i++) {
                    this.sparks.push(new Spark(this.startPoint.x, this.startPoint.y, this.rotation));
                }
            }
        }
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            this.sparks[i].update(dt);
            if (this.sparks[i].life <= 0) this.sparks.splice(i, 1);
        }

        // 光束脉冲
        if (this.phase === 'fire') {
            this.pulseTimer += dt;
            if (this.pulseTimer > 0.07) {
                this.pulseTimer = 0;
                this.pulses.push(new BeamPulse(this.length));
            }
        }
        for (let i = this.pulses.length - 1; i >= 0; i--) {
            this.pulses[i].update(dt);
            if (this.pulses[i].life <= 0) this.pulses.splice(i, 1);
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

        const len = laser.length;

        // 1) 外晕 (深蓝大块)
        ctx.fillStyle = 'rgba(24, 72, 220, 0.45)';
        ctx.fillRect(-w * 1.7, -len, w * 3.4, len);

        // 2) 主体蓝
        ctx.fillStyle = 'rgba(40, 150, 255, 0.75)';
        ctx.fillRect(-w * 0.9, -len, w * 1.8, len);

        // 3) 内层亮青
        ctx.fillStyle = '#7ef1ff';
        ctx.fillRect(-w * 0.45, -len, w * 0.9, len);

        // 4) 纯白核心
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-w * 0.16, -len, w * 0.32, len);

        // 5) 沿光束向上飞的能量脉冲 (椭圆亮斑)
        for (const p of laser.pulses) {
            const alpha = Math.max(0, Math.min(1, p.life * 4));
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.ellipse(0, p.y, w * 0.45, p.size, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(160, 240, 255, ${alpha * 0.6})`;
            ctx.beginPath();
            ctx.ellipse(0, p.y, w * 0.9, p.size * 1.5, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 6) 枪口闪光 (脉动)
        const flash = 1 + Math.sin(performance.now() * 0.05) * 0.22;
        const mr = w * 2.4 * flash;
        const mg = ctx.createRadialGradient(0, 0, 0, 0, 0, mr);
        mg.addColorStop(0, 'rgba(255, 255, 255, 1)');
        mg.addColorStop(0.25, 'rgba(180, 240, 255, 0.8)');
        mg.addColorStop(1, 'rgba(20, 80, 255, 0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(0, 0, mr, 0, Math.PI * 2);
        ctx.fill();

        // 7) 远端收束光斑
        const tg = ctx.createRadialGradient(0, -len, 0, 0, -len, w * 1.5);
        tg.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        tg.addColorStop(1, 'rgba(20, 80, 255, 0)');
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.arc(0, -len, w * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // 8) 火花 (世界空间)
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

    /**
     * 充能阶段的 HUD overlay。
     * 由 Renderer 在 draw() 里针对 Player.isCharging 调用。
     *
     * @param player         当前玩家
     */
    static drawChargingOverlay(ctx: CanvasRenderingContext2D, player: Player) {
        const charge = player.chargeLevel / 100; // 0..1
        if (charge <= 0.001) return;

        const muzzleX = player.position.x + 34 * Math.sin(player.rotation);
        const muzzleY = player.position.y - 34 * Math.cos(player.rotation);
        const now = performance.now() * 0.001;

        ctx.save();
        ctx.translate(muzzleX, muzzleY);
        ctx.globalCompositeOperation = 'lighter';

        // --- 外圈能量环 ---
        const ringR = 46 * (1 - charge * 0.55);
        ctx.strokeStyle = `rgba(120, 230, 255, ${0.3 + charge * 0.7})`;
        ctx.lineWidth = 1.5 + charge * 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();

        // 内圈虚线环 (反向旋转)
        ctx.save();
        ctx.rotate(-now * 3);
        ctx.setLineDash([6, 8]);
        ctx.strokeStyle = `rgba(200, 250, 255, ${0.5 * charge})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, ringR - 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // --- 4 个旋转能量球 ---
        const orbCount = 4;
        const orbR = 4 + charge * 6;
        for (let i = 0; i < orbCount; i++) {
            const a = now * 4 + (i / orbCount) * Math.PI * 2;
            const d = ringR * (1 - charge * 0.15);
            const ox = Math.cos(a) * d;
            const oy = Math.sin(a) * d;

            const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, orbR * 2.2);
            og.addColorStop(0, '#ffffff');
            og.addColorStop(0.4, 'rgba(150, 240, 255, 0.9)');
            og.addColorStop(1, 'rgba(30, 120, 255, 0)');
            ctx.fillStyle = og;
            ctx.beginPath();
            ctx.arc(ox, oy, orbR * 2.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- 中心核心 (随 charge 变大变亮) ---
        const coreR = 3 + charge * 14;
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2.4);
        cg.addColorStop(0, '#ffffff');
        cg.addColorStop(0.35, `rgba(180, 245, 255, ${0.8 + charge * 0.2})`);
        cg.addColorStop(1, 'rgba(30, 120, 255, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, coreR * 2.4, 0, Math.PI * 2);
        ctx.fill();

        // --- 电弧 (充能 > 30% 时出现) ---
        if (charge > 0.3) {
            ctx.strokeStyle = `rgba(200, 250, 255, ${(charge - 0.3) * 1.4})`;
            ctx.lineWidth = 1.6;
            const arcs = Math.floor(charge * 5);
            for (let i = 0; i < arcs; i++) {
                const a1 = now * 10 + i;
                const a2 = a1 + Math.PI;
                const r = ringR * (0.55 + Math.random() * 0.35);
                ctx.beginPath();
                ctx.moveTo(Math.cos(a1) * r, Math.sin(a1) * r);
                // zig-zag to opposite point
                const steps = 4;
                for (let s = 1; s <= steps; s++) {
                    const aa = a1 + ((a2 - a1) * s) / steps;
                    const rr = r + (Math.random() - 0.5) * 12;
                    ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
                }
                ctx.stroke();
            }
        }

        // --- 100% 蓄满：扩散冲击环 ---
        if (charge >= 0.999) {
            const pulse = 0.5 + 0.5 * Math.sin(now * 16);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 + pulse * 0.4})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, ringR + 12 + pulse * 8, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }
}
