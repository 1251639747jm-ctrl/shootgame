import { Entity, Enemy } from "./Entities";
import { EntityType, Vector2 } from "../types";
import { Entity, Enemy, Player } from "./Entities";

/**
 * HYPER BEAM LASER - 曲率光束 + 电影级光晕版
 *
 * 设计要点:
 * 1) 发射行为
 *    - 持续按开火键蓄力, 100% 后"自动发射一发"
 *    - 发射后进入 3 秒冷却 (Player.laserCooldown), 冷却期间无法再蓄力
 * 2) 伤害: 改为 DPS 模型 (每秒伤害), 伤害 = DPS * dt * (等级加成 * 玩家倍率 * 阶段衰减).
 *    相比旧版"每帧 160 damage" (≈9600 DPS), 大幅合理化.
 * 3) 视觉
 *    - 4 层光束 (深蓝外晕 / 蓝主体 / 青内层 / 纯白核心), 配合 shadowBlur 强光晕
 *    - 沿束体流动的高亮脉冲
 *    - 巨大枪口闪光 + 尾端光斑
 * 4) 拐弯寻敌
 *    - 光束以极小线段组成折线 (polyline), 每段都朝"前向锥内最近敌人"偏转
 *    - 每段最大偏转被限制 -> 形成柔和弧线
 *    - 打中某敌人后, 从命中点继续寻找"下一个"敌人, 从而依次贯穿多个目标
 */

const BEAM = {
    DPS: 320,                     // 每秒伤害 (单目标)
    LENGTH: 2400,                 // 光束总长
    WIDTH: 22,                    // 束体半宽 (视觉尺度)
    SEGMENT: 16,                  // 折线每段长度 (越短越柔滑)
    T_CHARGE: 0.10,               // 发射阶段的 "开场"
    T_FIRE:   1.00,               // 主发射
    T_DECAY:  0.30,               // 衰减

    MAX_BEND_PER_SEG: 0.12,       // 每段最大偏转 (弧度 ≈ 6.9°)
    SEEK_CONE: Math.PI * 0.95,    // 寻敌锥 (约 171°, 非常前向偏好)
    SEEK_RADIUS: 460              // 寻敌半径
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

// 沿光束向前流动的高亮脉冲 (用折线参数 0..1 表示位置)
class BeamPulse {
    progress: number = 0;   // 0 -> 1 (起点到尾端)
    speed: number;          // 每秒行进比例
    size: number;
    constructor() {
        this.speed = 2.4 + Math.random() * 1.6;   // 约 0.4~0.5 秒穿越整束
        this.size = 10 + Math.random() * 10;
    }
    update(dt: number) {
        this.progress += this.speed * dt;
    }
}

export class Laser extends Entity {
    owner: Player;
    timer: number = 0;
    phase: 'charge' | 'fire' | 'decay' = 'charge';

    startPoint: Vector2 = { x: 0, y: 0 };

    /**
     * 光束折线路径, 起点在 path[0] (枪口), 按顺序延伸.
     * 供渲染 + 碰撞 (GameEngine.checkCollisions) 共用.
     */
    path: Vector2[] = [];
    currentWidth: number = 0;
    length: number = BEAM.LENGTH;

    /**
     * 当前帧的"束体命中半径", 碰撞时用:
     * distance(enemy, path) < hitRadius + enemy.radius -> 命中
     */
    hitRadius: number = 0;

    /**
     * 当前帧的"单目标单帧伤害" = DPS * dt * multipliers.
     * 由 GameEngine 在碰撞检测时直接 applyDamage.
     */
    damage: number = 0;

    private sparks: Spark[] = [];
    private sparkTimer: number = 0;
    private pulses: BeamPulse[] = [];
    private pulseTimer: number = 0;

    constructor(owner: Player) {
        super(owner.position.x, owner.position.y, EntityType.WEAPON_LASER);
        this.owner = owner;
        this.rotation = owner.rotation;
        this.radius = 0; // 不参与默认圆形碰撞, 改走 pointNearPath
        this.updateStart();
    }

    private updateStart() {
        this.rotation = this.owner.rotation;
        const r = this.rotation;
        this.startPoint.x = this.owner.position.x + 34 * Math.sin(r);
        this.startPoint.y = this.owner.position.y - 34 * Math.cos(r);
        this.position.x = this.startPoint.x;
        this.position.y = this.startPoint.y;
    }

    /**
     * 每帧更新:
     * - 推进 timer / 阶段
     * - 根据存活敌人重新构建曲率光束路径
     * - 计算本帧 per-enemy 伤害值 (DPS * dt * ...)
     */
    update(dt: number, context?: any) {
        const enemies: Enemy[] = Array.isArray(context) ? (context as Enemy[]) : [];
        if (this.owner.markedForDeletion) {
            this.markedForDeletion = true;
            return;
        }
        this.timer += dt;
        this.updateStart();

        const t = this.timer;
        let dmgMult = 0;

        if (t < BEAM.T_CHARGE) {
            this.phase = 'charge';
            const p = t / BEAM.T_CHARGE;
            this.currentWidth = BEAM.WIDTH * (0.22 + p * 0.78);
        } else if (t < BEAM.T_CHARGE + BEAM.T_FIRE) {
            this.phase = 'fire';
            dmgMult = 1;
            this.currentWidth = BEAM.WIDTH + Math.sin(t * 30) * 2.2;
        } else if (t < BEAM.T_CHARGE + BEAM.T_FIRE + BEAM.T_DECAY) {
            this.phase = 'decay';
            const td = t - (BEAM.T_CHARGE + BEAM.T_FIRE);
            const p = 1 - td / BEAM.T_DECAY;
            this.currentWidth = BEAM.WIDTH * Math.max(0, p);
            dmgMult = p * p;
        } else {
            this.markedForDeletion = true;
            return;
        }

        // 过滤存活敌人
        const alive: Enemy[] = [];
        for (const e of enemies) if (!e.markedForDeletion) alive.push(e);
        this.buildPath(alive);

        // 束体命中半径 (随当前宽度变化)
        this.hitRadius = this.currentWidth * 0.85 + 4;

        // 本帧伤害 (per enemy)
        if (dmgMult > 0) {
            const levelBoost = 1 + this.owner.level * 0.18;
            const dps = BEAM.DPS * this.owner.damageMultiplier * levelBoost * dmgMult;
            this.damage = dps * dt;
        } else {
            this.damage = 0;
        }

        // 枪口火花
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

        // 流动脉冲
        if (this.phase === 'fire') {
            this.pulseTimer += dt;
            if (this.pulseTimer > 0.06) {
                this.pulseTimer = 0;
                this.pulses.push(new BeamPulse());
            }
        }
        for (let i = this.pulses.length - 1; i >= 0; i--) {
            this.pulses[i].update(dt);
            if (this.pulses[i].progress >= 1) this.pulses.splice(i, 1);
        }
    }

    /**
     * 构建曲率折线:
     *   - 起点在枪口, 初始方向为玩家朝向
     *   - 每段: 在前方锥内选一个最近敌人作为目标; 把当前方向向目标方向偏转 (不超过最大偏转角)
     *   - 段长度固定, 直到累计长度到 LENGTH 或段数上限
     *   - 一旦段尖足够靠近目标, 标记为"已命中"并切换到下一个目标, 实现"依次贯穿"
     */
    private buildPath(enemies: Enemy[]) {
        const path: Vector2[] = [];
        const steps = Math.ceil(BEAM.LENGTH / BEAM.SEGMENT);
        const chainHit = new Set<Enemy>();
        const hitR = this.currentWidth * 0.85 + 4;

        let x = this.startPoint.x;
        let y = this.startPoint.y;
        let a = this.rotation;
        path.push({ x, y });

        let target: Enemy | null = null;

        for (let i = 0; i < steps; i++) {
            // (re-)acquire target if needed
            if (!target || target.markedForDeletion || chainHit.has(target)) {
                target = this.pickTarget(x, y, a, enemies, chainHit);
            }

            if (target) {
                const dx = target.position.x - x;
                const dy = target.position.y - y;
                // angle 约定: (sin(a), -cos(a)) = 前向
                const desired = Math.atan2(dx, -dy);
                let diff = ((desired - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                const clamped = Math.max(-BEAM.MAX_BEND_PER_SEG, Math.min(BEAM.MAX_BEND_PER_SEG, diff));
                a += clamped;
            }

            // 前进一段
            x += Math.sin(a) * BEAM.SEGMENT;
            y -= Math.cos(a) * BEAM.SEGMENT;
            path.push({ x, y });

            // 链式命中: 若本段尖端已经进入敌人半径, 视为"贯穿"该敌人, 开始寻找下一个
            for (const e of enemies) {
                if (chainHit.has(e)) continue;
                const ex = e.position.x - x;
                const ey = e.position.y - y;
                const thresh = e.radius + hitR;
                if (ex * ex + ey * ey <= thresh * thresh) {
                    chainHit.add(e);
                    if (target === e) target = null; // 强制下帧重新选目标
                }
            }
        }

        this.path = path;
    }

    private pickTarget(x: number, y: number, a: number, enemies: Enemy[], hit: Set<Enemy>): Enemy | null {
        let best: Enemy | null = null;
        let bestScore = Infinity;
        const maxCone = BEAM.SEEK_CONE * 0.5;
        const r2 = BEAM.SEEK_RADIUS * BEAM.SEEK_RADIUS;

        for (const e of enemies) {
            if (hit.has(e)) continue;
            const dx = e.position.x - x;
            const dy = e.position.y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 > r2) continue;
            const desired = Math.atan2(dx, -dy);
            let diff = ((desired - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            if (Math.abs(diff) > maxCone) continue;
            const d = Math.sqrt(d2);
            const score = d + Math.abs(diff) * 140; // 偏离角度惩罚
            if (score < bestScore) {
                bestScore = score;
                best = e;
            }
        }
        return best;
    }

    /** 点到折线最近距离^2 */
    static pointDistanceSqToPath(px: number, py: number, path: Vector2[]): number {
        let best = Infinity;
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i], b = path[i + 1];
            const dx = b.x - a.x, dy = b.y - a.y;
            const len2 = dx * dx + dy * dy;
            if (len2 === 0) continue;
            let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
            if (t < 0) t = 0; else if (t > 1) t = 1;
            const cx = a.x + dx * t, cy = a.y + dy * t;
            const ex = px - cx, ey = py - cy;
            const d2 = ex * ex + ey * ey;
            if (d2 < best) best = d2;
        }
        return best;
    }

    static draw(ctx: CanvasRenderingContext2D, laser: Laser) {
        const path = laser.path;
        const w = laser.currentWidth;
        if (!path || path.length < 2 || w <= 0.5) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const tracePath = () => {
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
        };

        // --- 大型蓝色光晕 (用 shadowBlur 模拟电影级柔光) ---
        ctx.shadowBlur = 42;
        ctx.shadowColor = 'rgba(60, 140, 255, 0.95)';
        ctx.strokeStyle = 'rgba(30, 100, 220, 0.32)';
        ctx.lineWidth = w * 3.6;
        tracePath(); ctx.stroke();

        // --- 中层蓝 ---
        ctx.shadowBlur = 24;
        ctx.shadowColor = 'rgba(120, 200, 255, 0.9)';
        ctx.strokeStyle = 'rgba(80, 180, 255, 0.75)';
        ctx.lineWidth = w * 1.8;
        tracePath(); ctx.stroke();

        // --- 青内层 ---
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(180, 240, 255, 1)';
        ctx.strokeStyle = 'rgba(170, 240, 255, 0.95)';
        ctx.lineWidth = w * 0.85;
        tracePath(); ctx.stroke();

        // --- 纯白核心 ---
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, w * 0.3);
        tracePath(); ctx.stroke();

        // --- 沿路径流动的能量脉冲 ---
        if (path.length >= 2) {
            for (const p of laser.pulses) {
                const segT = Math.max(0, Math.min(1, p.progress)) * (path.length - 1);
                const i = Math.floor(segT);
                const f = segT - i;
                const pa = path[i];
                const pb = path[Math.min(path.length - 1, i + 1)];
                const px = pa.x + (pb.x - pa.x) * f;
                const py = pa.y + (pb.y - pa.y) * f;
                const tx = pb.x - pa.x;
                const ty = pb.y - pa.y;
                const ang = Math.atan2(ty, tx);
                const alpha = Math.max(0, Math.min(1, (1 - p.progress) * 1.6));
                ctx.save();
                ctx.translate(px, py);
                ctx.rotate(ang);
                ctx.fillStyle = `rgba(220, 245, 255, ${alpha * 0.55})`;
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size * 1.6, w * 0.95, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size, w * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        // --- 枪口闪光 ---
        const { x: mx, y: my } = path[0];
        const flash = 1 + Math.sin(performance.now() * 0.05) * 0.22;
        const mr = w * 3.2 * flash;
        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
        mg.addColorStop(0, 'rgba(255, 255, 255, 1)');
        mg.addColorStop(0.25, 'rgba(180, 240, 255, 0.8)');
        mg.addColorStop(1, 'rgba(20, 80, 255, 0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.fill();

        // --- 尾端光斑 ---
        const tail = path[path.length - 1];
        const tg = ctx.createRadialGradient(tail.x, tail.y, 0, tail.x, tail.y, w * 2);
        tg.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
        tg.addColorStop(1, 'rgba(20, 80, 255, 0)');
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.arc(tail.x, tail.y, w * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // --- 火花 (世界空间) ---
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
     * 由 Renderer/GameEngine 针对选中激光武器的玩家调用:
     *  - 冷却期: 绘制冷却环 + 倒计时
     *  - 蓄力期: 绘制能量汇聚特效
     */
    static drawChargingOverlay(ctx: CanvasRenderingContext2D, player: Player) {
        if (player.laserCooldown > 0) {
            Laser.drawCooldownOverlay(ctx, player);
            return;
        }
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

        // --- 中心核心 ---
        const coreR = 3 + charge * 14;
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2.4);
        cg.addColorStop(0, '#ffffff');
        cg.addColorStop(0.35, `rgba(180, 245, 255, ${0.8 + charge * 0.2})`);
        cg.addColorStop(1, 'rgba(30, 120, 255, 0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.arc(0, 0, coreR * 2.4, 0, Math.PI * 2);
        ctx.fill();

        // --- 电弧 ---
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
                const steps = 4;
                for (let s = 1; s <= steps; s++) {
                    const aa = a1 + ((a2 - a1) * s) / steps;
                    const rr = r + (Math.random() - 0.5) * 12;
                    ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
                }
                ctx.stroke();
            }
        }

        // --- 100% 蓄满冲击环 ---
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

    /**
     * 冷却环: 红->橙->绿, 玩家枪口上方显示剩余秒数.
     */
    static drawCooldownOverlay(ctx: CanvasRenderingContext2D, player: Player) {
        const cdMax = player.laserCooldownMax || 3;
        const ratio = Math.max(0, Math.min(1, player.laserCooldown / cdMax)); // 1 -> 0
        const filled = 1 - ratio; // 已恢复比例

        const muzzleX = player.position.x + 34 * Math.sin(player.rotation);
        const muzzleY = player.position.y - 34 * Math.cos(player.rotation);

        ctx.save();
        ctx.translate(muzzleX, muzzleY);

        // 底环
        ctx.strokeStyle = 'rgba(180, 200, 230, 0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();

        // 进度弧
        const col = ratio > 0.66 ? '#f87171' : ratio > 0.33 ? '#fbbf24' : '#86efac';
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + filled * Math.PI * 2);
        ctx.stroke();

        // 倒计时
        ctx.fillStyle = '#e0e7ff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.laserCooldown.toFixed(1), 0, 0);

        ctx.restore();
    }
}
