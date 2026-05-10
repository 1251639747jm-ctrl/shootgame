import { Entity, Enemy, Player, Particle } from "../Entities";
import { EntityType, Vector2 } from "../../types";
import { CircleElement, RogueModifiers } from "./RogueTypes";

/**
 * 魔法阵武器 - 肉鸽模式专属
 *
 * 玩家选择魔法阵作为起始武器时生效:
 * - 在玩家脚下持续展开一个法阵 (跟随移动)
 * - 每隔一定时间 tick 一次, 对阵内所有敌人造成伤害
 * - 火系: 造成灼烧 DOT + 偶尔爆炸 (AOE 脉冲)
 * - 电系: 对最近目标放电, 连锁跳跃到周围敌人
 *
 * 视觉:
 * - 旋转的复杂法阵图案 (双层环 + 符文 + 核心光)
 * - 火系: 橙红色, 周围升腾火焰粒子
 * - 电系: 蓝紫色, 电弧闪烁
 */

const BASE = {
    RADIUS: 280,        // 基础半径 (够大罩住屏幕顶部 Boss)
    TICK_INTERVAL: 0.25, // 每 0.25 秒 tick 一次 (4 Hz)
    DPS_FIRE: 90,       // 火系每 tick 伤害
    DPS_ELEC: 80,       // 电系每 tick 伤害 (单目标, 但可连锁)
    BURN_DPS: 40,       // 火系灼烧额外 DPS
    CHAIN_COUNT: 5,     // 电系连锁数
    CHAIN_RANGE: 260,   // 连锁跳跃最大距离
    ELEC_SCAN_RANGE: 9999 // 电系起始目标搜索: 全屏 (解决"只在阵内触发"的问题)
};

/**
 * MagicCircle 实体: 跟随玩家, 持续对范围内敌人造成伤害.
 * 不参与碰撞系统 (radius=0), 伤害由自身 tick 逻辑处理.
 *
 * 按住开火键时, 法阵会激活 "活跃模式":
 * - tick 间隔减半 (伤害加倍 DPS)
 * - 半径稍微扩大, 有强化视觉
 * 松开后回到待机 tick, 继续低频输出.
 */
export class MagicCircle extends Entity {
    owner: Player;
    element: CircleElement;
    modifiers: RogueModifiers;

    // 法阵参数 (受 modifiers 影响)
    effectRadius: number;
    tickInterval: number;
    tickTimer: number = 0;

    // 视觉
    rotation: number = 0;
    pulseTimer: number = 0;

    // 电系连锁视觉 (画闪电用)
    chainTargets: Vector2[] = [];
    chainAlpha: number = 0;

    // 火系爆发视觉
    burstAlpha: number = 0;

    // 激活状态 (长按开火时)
    active: boolean = false;
    activeBlend: number = 0; // 0..1 平滑过渡

    constructor(owner: Player, element: CircleElement, modifiers: RogueModifiers) {
        super(owner.position.x, owner.position.y, EntityType.SKILL_SHOCKWAVE); // 借用一个 type 不影响逻辑
        this.owner = owner;
        this.element = element;
        this.modifiers = modifiers;
        this.radius = 0; // 不参与碰撞

        this.effectRadius = BASE.RADIUS * modifiers.circleRadiusMul;
        this.tickInterval = BASE.TICK_INTERVAL / modifiers.circleTickMul;
    }

    /** 更新 modifiers (每次选完 perk 后调用) */
    updateModifiers(m: RogueModifiers) {
        this.modifiers = m;
        this.effectRadius = BASE.RADIUS * m.circleRadiusMul;
        this.tickInterval = BASE.TICK_INTERVAL / m.circleTickMul;
    }

    update(dt: number, context?: any) {
        if (this.owner.markedForDeletion) {
            this.markedForDeletion = true;
            return;
        }

        // 跟随玩家
        this.position.x = this.owner.position.x;
        this.position.y = this.owner.position.y;

        // 激活过渡
        const target = this.active ? 1 : 0;
        this.activeBlend += (target - this.activeBlend) * Math.min(1, dt * 8);

        // 旋转动画 (激活时转速翻倍)
        this.rotation += dt * (1.2 + this.activeBlend * 1.5);
        this.pulseTimer += dt;

        // 衰减视觉
        if (this.chainAlpha > 0) this.chainAlpha = Math.max(0, this.chainAlpha - dt * 4);
        if (this.burstAlpha > 0) this.burstAlpha = Math.max(0, this.burstAlpha - dt * 3);

        // Tick 计时
        this.tickTimer += dt;
    }

    /** 外部 (RogueEngine) 每帧调用, 用来传递 "是否按住开火键" 的信息 */
    setActive(active: boolean) {
        this.active = active;
    }

    /**
     * 由 RogueEngine 每帧调用: 检查是否到 tick 时间, 是则对范围内敌人造成伤害.
     * 返回本次 tick 命中的敌人列表 (用于外部生成粒子/飘字).
     *
     * 火系: 只对阵内造成伤害 (AOE 范围输出).
     * 电系: 起始目标从全屏最近的敌人选出, 连锁跳到附近, 不要求必须在阵内
     *       (避免 Boss 在屏幕顶而法阵罩不到时完全打不到).
     */
    tryTick(enemies: Enemy[]): { hit: Enemy[]; damage: number; chains?: Vector2[] } | null {
        // 激活时 tick 间隔减半 (相当于 DPS 翻倍)
        const effectiveInterval = this.active ? this.tickInterval * 0.5 : this.tickInterval;
        if (this.tickTimer < effectiveInterval) return null;
        this.tickTimer -= effectiveInterval;

        if (this.element === CircleElement.FIRE) {
            // 火系: 阵内全体 tick
            const r2 = this.effectRadius * this.effectRadius;
            const inRange: Enemy[] = [];
            for (const e of enemies) {
                if (e.markedForDeletion) continue;
                const dx = e.position.x - this.position.x;
                const dy = e.position.y - this.position.y;
                if (dx * dx + dy * dy <= r2) inRange.push(e);
            }
            if (inRange.length === 0) return null;
            return this.tickFire(inRange);
        } else {
            // 电系: 全屏 (不在阵内也能连锁)
            const alive = enemies.filter(e => !e.markedForDeletion);
            if (alive.length === 0) return null;
            return this.tickElectric(alive);
        }
    }

    private tickFire(inRange: Enemy[]): { hit: Enemy[]; damage: number } {
        const baseDmg = BASE.DPS_FIRE * (BASE.TICK_INTERVAL) * this.modifiers.damageMultiplier * this.modifiers.circleBurnMul;
        for (const e of inRange) {
            e.applyDamage(baseDmg);
        }
        // 每 3 次 tick 来一个 AOE 爆发脉冲 (视觉 + 额外微伤)
        this.burstAlpha = 0.8;
        return { hit: inRange, damage: baseDmg };
    }

    private tickElectric(allEnemies: Enemy[]): { hit: Enemy[]; damage: number; chains: Vector2[] } {
        const baseDmg = BASE.DPS_ELEC * (BASE.TICK_INTERVAL) * this.modifiers.damageMultiplier;
        const chainCount = BASE.CHAIN_COUNT + this.modifiers.circleChainBonus;

        // 起始目标: 选全屏最近的敌人 (不再要求在阵内)
        let closest: Enemy | null = null;
        let closestDist = Infinity;
        for (const e of allEnemies) {
            if (e.markedForDeletion) continue;
            const dx = e.position.x - this.position.x;
            const dy = e.position.y - this.position.y;
            const d = dx * dx + dy * dy;
            if (d < closestDist) { closestDist = d; closest = e; }
        }
        if (!closest) return { hit: [], damage: 0, chains: [] };

        // 连锁闪电
        const hit: Enemy[] = [closest];
        const chains: Vector2[] = [{ x: this.position.x, y: this.position.y }, { x: closest.position.x, y: closest.position.y }];
        closest.applyDamage(baseDmg);

        let current = closest;
        const hitSet = new Set<Enemy>([closest]);

        for (let i = 0; i < chainCount; i++) {
            let next: Enemy | null = null;
            let nextDist = BASE.CHAIN_RANGE * BASE.CHAIN_RANGE;
            for (const e of allEnemies) {
                if (e.markedForDeletion || hitSet.has(e)) continue;
                const dx = e.position.x - current.position.x;
                const dy = e.position.y - current.position.y;
                const d = dx * dx + dy * dy;
                if (d < nextDist) { nextDist = d; next = e; }
            }
            if (!next) break;
            hitSet.add(next);
            hit.push(next);
            chains.push({ x: next.position.x, y: next.position.y });
            // 连锁伤害递减 15% (比之前 20% 温和些)
            const chainDmg = baseDmg * Math.pow(0.85, i + 1);
            next.applyDamage(chainDmg);
            current = next;
        }

        this.chainTargets = chains;
        this.chainAlpha = 1;

        return { hit, damage: baseDmg, chains };
    }

    // ================== 渲染 ==================
    static draw(ctx: CanvasRenderingContext2D, circle: MagicCircle) {
        const { x, y } = circle.position;
        const activeBoost = circle.activeBlend;
        const r = circle.effectRadius * (1 + activeBoost * 0.08);
        const rot = circle.rotation;
        const isFire = circle.element === CircleElement.FIRE;
        const now = performance.now() * 0.001;

        ctx.save();
        ctx.translate(x, y);
        ctx.globalCompositeOperation = 'lighter';

        // --- 外环 ---
        ctx.save();
        ctx.rotate(rot);
        const outerAlpha = 0.55 + activeBoost * 0.35;
        ctx.strokeStyle = isFire
            ? `rgba(251, 146, 60, ${outerAlpha})`
            : `rgba(139, 92, 246, ${outerAlpha})`;
        ctx.lineWidth = 2 + activeBoost * 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        // 符文标记 (6 个等距点)
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const rx = Math.cos(a) * r;
            const ry = Math.sin(a) * r;
            ctx.fillStyle = isFire ? '#fb923c' : '#a78bfa';
            ctx.beginPath();
            ctx.arc(rx, ry, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // --- 内环 (反向旋转) ---
        ctx.save();
        ctx.rotate(-rot * 1.5);
        ctx.strokeStyle = isFire ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // --- 中心核心脉动 ---
        const pulse = 0.8 + Math.sin(now * 4) * 0.2;
        const coreR = 16 * pulse;
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2);
        if (isFire) {
            coreGrad.addColorStop(0, 'rgba(255, 255, 200, 0.9)');
            coreGrad.addColorStop(0.4, 'rgba(251, 146, 60, 0.6)');
            coreGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        } else {
            coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            coreGrad.addColorStop(0.4, 'rgba(139, 92, 246, 0.6)');
            coreGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
        }
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, coreR * 2, 0, Math.PI * 2);
        ctx.fill();

        // --- 十字星线 ---
        ctx.save();
        ctx.rotate(rot * 0.5);
        ctx.strokeStyle = isFire ? 'rgba(251, 191, 36, 0.35)' : 'rgba(167, 139, 250, 0.35)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(0, 20);
            ctx.lineTo(0, r * 0.85);
            ctx.stroke();
        }
        ctx.restore();

        // --- 火系爆发脉冲 ---
        if (isFire && circle.burstAlpha > 0) {
            ctx.fillStyle = `rgba(255, 100, 0, ${circle.burstAlpha * 0.3})`;
            ctx.beginPath();
            ctx.arc(0, 0, r * (1 + circle.burstAlpha * 0.15), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore(); // 结束 translate

        // --- 电系连锁闪电 ---
        if (!isFire && circle.chainAlpha > 0 && circle.chainTargets.length >= 2) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(139, 92, 246, ${circle.chainAlpha})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(circle.chainTargets[0].x, circle.chainTargets[0].y);
            for (let i = 1; i < circle.chainTargets.length; i++) {
                const pt = circle.chainTargets[i];
                // Zig-zag 效果
                const prev = circle.chainTargets[i - 1];
                const mx = (prev.x + pt.x) / 2 + (Math.random() - 0.5) * 20;
                const my = (prev.y + pt.y) / 2 + (Math.random() - 0.5) * 20;
                ctx.lineTo(mx, my);
                ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();

            // 白色核心线
            ctx.strokeStyle = `rgba(255, 255, 255, ${circle.chainAlpha * 0.7})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(circle.chainTargets[0].x, circle.chainTargets[0].y);
            for (let i = 1; i < circle.chainTargets.length; i++) {
                ctx.lineTo(circle.chainTargets[i].x, circle.chainTargets[i].y);
            }
            ctx.stroke();
            ctx.restore();
        }
    }
}
