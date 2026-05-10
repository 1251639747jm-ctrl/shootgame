import { Entity } from "./Entities";
import { Vector2 } from "../types";

/**
 * 敌方激光 (用于狙击机升级 / Boss 技能)
 *
 * 生命周期:
 *   1. telegraph  -> 细红虚线指示 (~0.6s)
 *   2. fire       -> 粗实心红色光束, 会持续伤害玩家 (~0.6s)
 *   3. decay      -> 快速消散 (~0.2s)
 *
 * 位置/旋转在构造时锁定, 不会追踪玩家 (这是"警告→锁定→开火"的游戏体感)
 */
export class EnemyLaser extends Entity {
    // 起点 (会跟随 owner 机体浮动)
    anchor: Vector2;
    anchorOffset: Vector2;
    owner: Entity | null;

    // 朝向: 正常朝下 (0), 但可以用 aimAngle 做扫射/扇形
    aimAngle: number;
    rotationRate: number = 0;  // 弧度/秒, 大于0则是扫射

    // 生命周期
    timer: number = 0;
    phaseTele: number = 0.65;
    phaseFire: number = 0.65;
    phaseDecay: number = 0.2;

    // 宽度 / 伤害
    length: number = 2200;
    maxWidth: number = 26;
    width: number = 0; // 当前实际宽度
    dps: number = 60;  // 持续伤害: 命中时每秒造成多少 HP

    // 视觉
    color: string = '#ef4444';
    coreColor: string = '#ffe4e6';

    get phase(): 'telegraph' | 'fire' | 'decay' | 'dead' {
        if (this.timer < this.phaseTele) return 'telegraph';
        if (this.timer < this.phaseTele + this.phaseFire) return 'fire';
        if (this.timer < this.phaseTele + this.phaseFire + this.phaseDecay) return 'decay';
        return 'dead';
    }

    constructor(
        start: Vector2,
        aimAngle: number,
        owner: Entity | null = null,
        opts?: { length?: number; maxWidth?: number; dps?: number; tele?: number; fire?: number; rotationRate?: number; color?: string; offset?: Vector2 }
    ) {
        // 借 Entity 构造; type 用 WEAPON_LASER 让碰撞/过滤逻辑统一
        super(start.x, start.y, 23 /* EntityType.WEAPON_LASER */);
        this.anchor = { x: start.x, y: start.y };
        this.anchorOffset = opts?.offset || { x: 0, y: 0 };
        this.owner = owner;
        this.aimAngle = aimAngle;

        if (opts?.length)     this.length = opts.length;
        if (opts?.maxWidth)   this.maxWidth = opts.maxWidth;
        if (opts?.dps)        this.dps = opts.dps;
        if (opts?.tele)       this.phaseTele = opts.tele;
        if (opts?.fire)       this.phaseFire = opts.fire;
        if (opts?.rotationRate) this.rotationRate = opts.rotationRate;
        if (opts?.color)      this.color = opts.color;

        this.radius = this.maxWidth * 0.5;
    }

    update(dt: number) {
        this.timer += dt;

        // 跟随发射者 (如果指定了 owner)
        if (this.owner && !this.owner.markedForDeletion) {
            this.anchor.x = this.owner.position.x + this.anchorOffset.x;
            this.anchor.y = this.owner.position.y + this.anchorOffset.y;
        }
        this.position.x = this.anchor.x;
        this.position.y = this.anchor.y;

        // 扫射式旋转
        if (this.rotationRate !== 0) {
            this.aimAngle += this.rotationRate * dt;
        }

        // 根据阶段决定宽度
        const p = this.phase;
        if (p === 'telegraph') {
            // 指示阶段宽度很细, 只做视觉提示
            const t = this.timer / this.phaseTele;
            this.width = 1.5 + t * 2;
        } else if (p === 'fire') {
            const t = (this.timer - this.phaseTele) / this.phaseFire;
            // 起始瞬间冲击到最大, 然后微波动
            if (t < 0.15) this.width = this.maxWidth * (t / 0.15);
            else this.width = this.maxWidth * (0.92 + 0.08 * Math.sin(this.timer * 40));
        } else if (p === 'decay') {
            const t = (this.timer - this.phaseTele - this.phaseFire) / this.phaseDecay;
            this.width = this.maxWidth * (1 - t);
        } else {
            this.markedForDeletion = true;
        }
    }

    /**
     * 给 GameEngine 判定是否命中某个点 (玩家).
     * 返回命中的"伤害乘数" (0 = 没打中, 1 = 直接命中).
     *
     * 激光几何:
     *   起点 = this.position
     *   在 canvas rotate(aimAngle) 后, 局部 +Y 方向 (0, length) 对应世界
     *   方向 (-sin(a), +cos(a))。所以 "前向" forward = (-sin(a), cos(a))。
     */
    hitTest(px: number, py: number, targetRadius: number): number {
        if (this.phase !== 'fire') return 0;

        const dx = px - this.position.x;
        const dy = py - this.position.y;
        const s = Math.sin(this.aimAngle);
        const c = Math.cos(this.aimAngle);

        // 沿朝向距离 (>0 = 在激光前方)
        const along = -dx * s + dy * c;
        // 侧向距离
        const side  =  dx * c + dy * s;

        if (along < -targetRadius || along > this.length + targetRadius) return 0;
        const absSide = Math.abs(side);
        const halfW = this.width * 0.5 + targetRadius * 0.3;
        if (absSide > halfW) return 0;

        // 越靠近中心伤害越高
        return 1 - Math.min(1, absSide / halfW) * 0.4;
    }

    static draw(ctx: CanvasRenderingContext2D, laser: EnemyLaser) {
        const p = laser.phase;
        if (p === 'dead') return;

        const { x, y } = laser.position;
        const len = laser.length;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(laser.aimAngle);
        ctx.globalCompositeOperation = 'lighter';

        if (p === 'telegraph') {
            // 虚线警戒
            const blink = 0.35 + 0.35 * Math.sin(laser.timer * 30);
            ctx.strokeStyle = `rgba(239, 68, 68, ${blink})`;
            ctx.lineWidth = laser.width;
            ctx.setLineDash([8, 10]);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, len);
            ctx.stroke();
            ctx.setLineDash([]);

            // 起点小光球
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
            g.addColorStop(0, 'rgba(255, 230, 230, 0.9)');
            g.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // fire / decay: 多层光束
            const w = laser.width;
            // 外晕
            ctx.fillStyle = 'rgba(190, 18, 60, 0.45)';
            ctx.fillRect(-w * 1.6, 0, w * 3.2, len);
            // 主体
            ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
            ctx.fillRect(-w * 0.85, 0, w * 1.7, len);
            // 内层亮
            ctx.fillStyle = '#fda4af';
            ctx.fillRect(-w * 0.4, 0, w * 0.8, len);
            // 纯白核心
            ctx.fillStyle = laser.coreColor;
            ctx.fillRect(-w * 0.15, 0, w * 0.3, len);

            // 枪口闪光
            const flash = 1 + Math.sin(laser.timer * 50) * 0.25;
            const mr = w * 2.4 * flash;
            const mg = ctx.createRadialGradient(0, 0, 0, 0, 0, mr);
            mg.addColorStop(0, 'rgba(255, 255, 255, 1)');
            mg.addColorStop(0.3, 'rgba(254, 202, 202, 0.8)');
            mg.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = mg;
            ctx.beginPath();
            ctx.arc(0, 0, mr, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
