import { Entity, Enemy, Player, Particle } from "../Entities";
import { EntityType, Vector2 } from "../../types";
import {
    CircleElement, RogueModifiers,
    MagicSkillId, MagicSkillDef
} from "./RogueTypes";

/**
 * 魔法阵武器 - 肉鸽模式专属 (重构版)
 *
 * 机制:
 * - 玩家选择魔法阵 (火 / 电) 后, 战机自带一个施法器 (MagicCircleCaster)
 * - 施法器维护 5 个独立技能, 各自有冷却
 * - 任何技能 ready 时, 引擎自动选一个开始施法:
 *     1) 在玩家位置绘制对应"法阵图案" (10 种独立样式, 蓄力期间从淡到亮)
 *     2) 蓄力完成后, 释放该技能的效果实体 (流星 / 新星 / 锤 / 闪电链 / 等)
 *     3) 该技能进入冷却, 引擎从其它 ready 技能中再选下一个
 *
 * 增益体系: 全部围绕 冷却 / 伤害 / 范围
 *   circleCdMul / circleDmgMul / circleRangeMul / circleCastSpeedMul
 */

// ============== Spell Context ==============
/** 引擎注入的能力包: 法术效果通过它操作世界 */
export interface SpellContext {
    /** 推送一个新实体到引擎 (用 函数 而不是数组引用, 因为 RogueEngine 会用 filter 重建数组) */
    pushEntity: (e: Entity) => void;
    getEnemies: () => Enemy[];                            // 当前活着的敌人
    damageEnemy: (e: Enemy, dmg: number, color: string) => void; // 应用伤害(含暴击/飘字/死亡判定)
    addShake: (intensity: number, duration: number) => void;
    width: number;
    height: number;
}

// ============== 技能数据表 ==============
export const FIRE_SKILLS: MagicSkillDef[] = [
    { id: MagicSkillId.FIRE_METEOR,  name: '流星雨',     castTime: 0.7, cooldown: 4.5, baseDamage: 95,  baseRange: 80,  color: '#fb923c', runeStyle: 0, desc: '5 颗流星砸向战场' },
    { id: MagicSkillId.FIRE_NOVA,    name: '火焰新星',   castTime: 0.5, cooldown: 3.2, baseDamage: 80,  baseRange: 360, color: '#f97316', runeStyle: 1, desc: '环形火浪向外扩散' },
    { id: MagicSkillId.FIRE_MAGMA,   name: '熔岩飞弹',   castTime: 0.4, cooldown: 2.0, baseDamage: 65,  baseRange: 60,  color: '#ef4444', runeStyle: 2, desc: '3 发追踪火球' },
    { id: MagicSkillId.FIRE_INFERNO, name: '烈焰风暴',   castTime: 1.0, cooldown: 7.0, baseDamage: 28,  baseRange: 220, color: '#dc2626', runeStyle: 3, desc: '4 秒持续旋转火域' },
    { id: MagicSkillId.FIRE_HAMMER,  name: '火神之锤',   castTime: 0.8, cooldown: 5.5, baseDamage: 240, baseRange: 100, color: '#fbbf24', runeStyle: 4, desc: '锁定强敌天降爆锤' },
];

export const ELECTRIC_SKILLS: MagicSkillDef[] = [
    { id: MagicSkillId.ELEC_CHAIN,   name: '闪电链',     castTime: 0.4, cooldown: 2.2, baseDamage: 75,  baseRange: 280, color: '#a78bfa', runeStyle: 5, desc: '连锁 8 跳' },
    { id: MagicSkillId.ELEC_THUNDER, name: '天雷',       castTime: 0.6, cooldown: 3.5, baseDamage: 80,  baseRange: 90,  color: '#c084fc', runeStyle: 6, desc: '5 道天雷随机轰击' },
    { id: MagicSkillId.ELEC_STATIC,  name: '静电场',     castTime: 0.8, cooldown: 6.5, baseDamage: 22,  baseRange: 280, color: '#8b5cf6', runeStyle: 7, desc: '4 秒玩家电场' },
    { id: MagicSkillId.ELEC_RAILGUN, name: '电磁轨道炮', castTime: 0.7, cooldown: 4.5, baseDamage: 200, baseRange: 26,  color: '#22d3ee', runeStyle: 8, desc: '高伤穿透电弧' },
    { id: MagicSkillId.ELEC_PLASMA,  name: '电浆轰炸',   castTime: 0.5, cooldown: 2.6, baseDamage: 78,  baseRange: 30,  color: '#6366f1', runeStyle: 9, desc: '4 颗追踪电浆' },
];

export function getSkillsForElement(el: CircleElement): MagicSkillDef[] {
    return el === CircleElement.FIRE ? FIRE_SKILLS : ELECTRIC_SKILLS;
}

// ============== 通用基类 ==============
/**
 * 魔法阵释放出的所有技能效果, 都继承自这个基类.
 * RogueEngine 在渲染时只要做 `instanceof MagicSpellFx` 一个判定, 调用其 `.draw(ctx)` 即可.
 */
export abstract class MagicSpellFx extends Entity {
    /** 子类实现: 每帧绘制 */
    abstract draw(ctx: CanvasRenderingContext2D): void;
}

// ============== 工具 ==============
function alphaHex(a: number): string {
    const v = Math.max(0, Math.min(255, Math.floor(a * 255)));
    return v.toString(16).padStart(2, '0');
}
function pointSegDist2(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) {
        const ddx = px - x1, ddy = py - y1;
        return ddx * ddx + ddy * ddy;
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    const ddx = px - cx, ddy = py - cy;
    return ddx * ddx + ddy * ddy;
}

// ============== 通用爆炸视觉 ==============
class FireBurst extends MagicSpellFx {
    age: number = 0;
    duration: number = 0.4;
    maxR: number;
    color: string;

    constructor(x: number, y: number, radius: number, color: string = '#fb923c') {
        super(x, y, EntityType.EXPLOSION_EFFECT);
        this.maxR = radius;
        this.color = color;
        this.radius = 0;
    }

    update(dt: number) {
        this.age += dt;
        if (this.age >= this.duration) this.markedForDeletion = true;
        this.radius = (this.age / this.duration) * this.maxR;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const t = this.age / this.duration;
        const r = this.radius;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createRadialGradient(this.position.x, this.position.y, 0, this.position.x, this.position.y, r);
        grad.addColorStop(0, `rgba(255,255,255,${(1 - t) * 0.85})`);
        grad.addColorStop(0.5, this.color + alphaHex((1 - t) * 0.7));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ============== 流星 ==============
export class MagicMeteor extends MagicSpellFx {
    targetX: number;
    targetY: number;
    damage: number;
    explodeRadius: number;
    sctx: SpellContext;
    speed: number = 1400;
    angle: number = 0;
    landed: boolean = false;
    trail: { x: number; y: number; alpha: number }[] = [];
    /** 流星雨专属增益: 落地分裂出 N 颗子流星 */
    splitCount: number = 0;

    constructor(startX: number, startY: number, targetX: number, targetY: number,
                damage: number, explodeRadius: number, ctx: SpellContext) {
        super(startX, startY, EntityType.PARTICLE);
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.explodeRadius = explodeRadius;
        this.sctx = ctx;
        this.radius = 12;
        const dx = targetX - startX;
        const dy = targetY - startY;
        this.angle = Math.atan2(dy, dx);
        const mag = Math.hypot(dx, dy) || 1;
        this.velocity.x = (dx / mag) * this.speed;
        this.velocity.y = (dy / mag) * this.speed;
    }

    update(dt: number) {
        if (this.landed) { this.markedForDeletion = true; return; }

        this.trail.push({ x: this.position.x, y: this.position.y, alpha: 1 });
        if (this.trail.length > 8) this.trail.shift();
        for (const t of this.trail) t.alpha *= 0.85;

        const prevDx = this.targetX - this.position.x;
        const prevDy = this.targetY - this.position.y;
        const prevDist = Math.hypot(prevDx, prevDy);

        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        const newDx = this.targetX - this.position.x;
        const newDy = this.targetY - this.position.y;
        const newDist = Math.hypot(newDx, newDy);

        if (newDist > prevDist || newDist < 12) {
            this.landed = true;
            this.position.x = this.targetX;
            this.position.y = this.targetY;
            const enemies = this.sctx.getEnemies();
            const r2 = this.explodeRadius * this.explodeRadius;
            for (const e of enemies) {
                if (e.markedForDeletion) continue;
                const dx = e.position.x - this.targetX;
                const dy = e.position.y - this.targetY;
                if (dx * dx + dy * dy <= r2) {
                    this.sctx.damageEnemy(e, this.damage, '#fb923c');
                }
            }
            this.sctx.pushEntity(new FireBurst(this.targetX, this.targetY, this.explodeRadius, '#fb923c'));
            for (let i = 0; i < 10; i++) {
                this.sctx.pushEntity(new Particle(this.targetX, this.targetY, '#fb923c', 320, 0.3 + Math.random() * 0.2, 2 + Math.random() * 3));
            }
            this.sctx.addShake(5, 0.15);

            // 流星雨 split perk: 落地后裂出 N 颗子流星
            if (this.splitCount > 0) {
                for (let i = 0; i < this.splitCount; i++) {
                    const a = (i / this.splitCount) * Math.PI * 2 + Math.random() * 0.4;
                    const dist = 80 + Math.random() * 60;
                    const stx = this.targetX + Math.cos(a) * dist;
                    const sty = this.targetY + Math.sin(a) * dist;
                    const sx = stx + (Math.random() - 0.5) * 80;
                    const sy = sty - 220;
                    const sub = new MagicMeteor(sx, sy, stx, sty, this.damage * 0.45, this.explodeRadius * 0.65, this.sctx);
                    // 子流星不再二次分裂, 防止指数膨胀
                    this.sctx.pushEntity(sub);
                }
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.landed) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < this.trail.length; i++) {
            const p = this.trail[i];
            ctx.fillStyle = `rgba(251, 146, 60, ${p.alpha * 0.4})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8 - i * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.translate(this.position.x, this.position.y);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#fb923c');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ============== 火焰新星 (扩散环) ==============
export class MagicNovaRing extends MagicSpellFx {
    cx: number;
    cy: number;
    maxR: number;
    damage: number;
    sctx: SpellContext;
    age: number = 0;
    duration: number = 0.5;
    hit: Set<Enemy> = new Set();

    constructor(cx: number, cy: number, maxR: number, damage: number, ctx: SpellContext) {
        super(cx, cy, EntityType.SKILL_SHOCKWAVE);
        this.cx = cx; this.cy = cy;
        this.maxR = maxR;
        this.damage = damage;
        this.sctx = ctx;
        this.radius = 0;
    }

    update(dt: number) {
        this.age += dt;
        if (this.age >= this.duration) { this.markedForDeletion = true; return; }
        const t = this.age / this.duration;
        this.radius = t * this.maxR;
        const innerR = Math.max(0, this.radius - 30);
        const outerR2 = this.radius * this.radius;
        const innerR2 = innerR * innerR;
        const enemies = this.sctx.getEnemies();
        for (const e of enemies) {
            if (e.markedForDeletion || this.hit.has(e)) continue;
            const dx = e.position.x - this.cx;
            const dy = e.position.y - this.cy;
            const d2 = dx * dx + dy * dy;
            if (d2 >= innerR2 && d2 <= outerR2) {
                this.sctx.damageEnemy(e, this.damage, '#f97316');
                this.hit.add(e);
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        const t = this.age / this.duration;
        const alpha = (1 - t) * 0.85;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createRadialGradient(this.cx, this.cy, Math.max(0, this.radius - 30), this.cx, this.cy, this.radius + 12);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.5, `rgba(251, 146, 60, ${alpha})`);
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.radius + 12, 0, Math.PI * 2);
        ctx.arc(this.cx, this.cy, Math.max(0, this.radius - 30), 0, Math.PI * 2, true);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 220, 100, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

// ============== 追踪飞弹 (火/电共用) ==============
export class MagicHomingOrb extends MagicSpellFx {
    target: Enemy | null;
    damage: number;
    explodeRadius: number;
    speed: number;
    age: number = 0;
    maxAge: number = 3;
    sctx: SpellContext;
    color: string;
    isElectric: boolean;
    trail: { x: number; y: number }[] = [];
    /** 转向强度 (默认 8); 熔岩飞弹 homing perk 把它调高 */
    steerStrength: number = 8;
    /** 电浆专属: 命中后分裂 4 颗小球 */
    splitOnHit: boolean = false;

    constructor(x: number, y: number, target: Enemy | null,
                damage: number, explodeRadius: number, ctx: SpellContext, isElectric: boolean,
                initialAngle: number = -Math.PI / 2) {
        super(x, y, EntityType.PARTICLE);
        this.target = target;
        this.damage = damage;
        this.explodeRadius = explodeRadius;
        this.speed = isElectric ? 700 : 540;
        this.sctx = ctx;
        this.isElectric = isElectric;
        this.color = isElectric ? '#a78bfa' : '#ef4444';
        this.radius = 8;
        // 初始向上偏移 + 散射, 让多发飞弹不会重叠
        this.velocity.x = Math.cos(initialAngle) * 240;
        this.velocity.y = Math.sin(initialAngle) * 240;
    }

    update(dt: number) {
        this.age += dt;
        if (this.age >= this.maxAge) { this.markedForDeletion = true; return; }

        if (!this.target || this.target.markedForDeletion) {
            const enemies = this.sctx.getEnemies();
            let best: Enemy | null = null;
            let bd = Infinity;
            for (const e of enemies) {
                if (e.markedForDeletion) continue;
                const dx = e.position.x - this.position.x;
                const dy = e.position.y - this.position.y;
                const d = dx * dx + dy * dy;
                if (d < bd) { bd = d; best = e; }
            }
            this.target = best;
        }

        if (this.target) {
            const dx = this.target.position.x - this.position.x;
            const dy = this.target.position.y - this.position.y;
            const dist = Math.hypot(dx, dy) || 1;
            const tvx = (dx / dist) * this.speed;
            const tvy = (dy / dist) * this.speed;
            const steer = this.steerStrength;
            this.velocity.x += (tvx - this.velocity.x) * Math.min(1, dt * steer);
            this.velocity.y += (tvy - this.velocity.y) * Math.min(1, dt * steer);

            if (dist < this.target.radius + this.radius) {
                this.sctx.damageEnemy(this.target, this.damage, this.color);
                if (this.explodeRadius > 0) {
                    const r2 = this.explodeRadius * this.explodeRadius;
                    const enemies = this.sctx.getEnemies();
                    for (const e of enemies) {
                        if (e === this.target || e.markedForDeletion) continue;
                        const ddx = e.position.x - this.position.x;
                        const ddy = e.position.y - this.position.y;
                        if (ddx * ddx + ddy * ddy <= r2) {
                            this.sctx.damageEnemy(e, this.damage * 0.5, this.color);
                        }
                    }
                }
                this.sctx.pushEntity(new FireBurst(this.position.x, this.position.y, Math.max(25, this.explodeRadius), this.color));

                // 电浆球 splitOnHit perk: 命中后裂出 4 颗低伤小球, 不再分裂
                if (this.splitOnHit) {
                    for (let i = 0; i < 4; i++) {
                        const ang = (i / 4) * Math.PI * 2 + Math.random() * 0.3;
                        const sub = new MagicHomingOrb(
                            this.position.x, this.position.y,
                            null, this.damage * 0.4, this.explodeRadius * 0.6,
                            this.sctx, this.isElectric, ang
                        );
                        sub.maxAge = 1.5;
                        sub.speed *= 0.85;
                        this.sctx.pushEntity(sub);
                    }
                }
                this.markedForDeletion = true;
                return;
            }
        }

        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        this.trail.push({ x: this.position.x, y: this.position.y });
        if (this.trail.length > 6) this.trail.shift();
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < this.trail.length; i++) {
            const p = this.trail[i];
            const a = (i / this.trail.length) * 0.5;
            ctx.fillStyle = this.isElectric ? `rgba(167, 139, 250, ${a})` : `rgba(239, 68, 68, ${a})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6 - i * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        const grad = ctx.createRadialGradient(this.position.x, this.position.y, 0, this.position.x, this.position.y, 14);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, this.color);
        grad.addColorStop(1, this.color + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ============== 持续区域: 火焰漩涡 / 静电场 ==============
export class MagicAuraField extends MagicSpellFx {
    cx: number;
    cy: number;
    fieldRadius: number;
    dmgPerTick: number;
    tickInterval: number = 0.25;
    tickTimer: number = 0;
    age: number = 0;
    duration: number;
    sctx: SpellContext;
    isElectric: boolean;
    rotationAngle: number = 0;
    followOwner: Player | null;
    /** 阵内小怪速度乘数 (1=不影响). 静电场 slow perk 设为 0.55 = 减速 45%. */
    slowFactor: number = 1;

    constructor(x: number, y: number, radius: number, dmgPerTick: number, duration: number,
                ctx: SpellContext, isElectric: boolean, followOwner: Player | null = null) {
        super(x, y, EntityType.SKILL_SHOCKWAVE);
        this.cx = x; this.cy = y;
        this.fieldRadius = radius;
        this.dmgPerTick = dmgPerTick;
        this.duration = duration;
        this.sctx = ctx;
        this.isElectric = isElectric;
        this.followOwner = followOwner;
        this.radius = 0;
    }

    update(dt: number) {
        this.age += dt;
        this.rotationAngle += dt * (this.isElectric ? 4 : 2);
        if (this.age >= this.duration) { this.markedForDeletion = true; return; }
        if (this.followOwner && !this.followOwner.markedForDeletion) {
            this.cx = this.followOwner.position.x;
            this.cy = this.followOwner.position.y;
            this.position.x = this.cx;
            this.position.y = this.cy;
        }
        this.tickTimer += dt;
        if (this.tickTimer >= this.tickInterval) {
            this.tickTimer -= this.tickInterval;
            const enemies = this.sctx.getEnemies();
            const r2 = this.fieldRadius * this.fieldRadius;
            const color = this.isElectric ? '#a78bfa' : '#fb923c';
            for (const e of enemies) {
                if (e.markedForDeletion) continue;
                const dx = e.position.x - this.cx;
                const dy = e.position.y - this.cy;
                if (dx * dx + dy * dy <= r2) {
                    this.sctx.damageEnemy(e, this.dmgPerTick, color);
                }
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        const t = this.age / this.duration;
        const fade = t < 0.85 ? 1 : Math.max(0, 1 - (t - 0.85) / 0.15);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(this.cx, this.cy);
        ctx.rotate(this.rotationAngle);
        const r = this.fieldRadius;

        if (this.isElectric) {
            ctx.strokeStyle = `rgba(167, 139, 250, ${0.6 * fade})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(196, 181, 253, ${0.4 * fade})`;
            ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.stroke();
            // 闪烁电弧
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                const x1 = Math.cos(a) * r * 0.4;
                const y1 = Math.sin(a) * r * 0.4;
                const x2 = Math.cos(a) * r * (0.85 + Math.random() * 0.15);
                const y2 = Math.sin(a) * r * (0.85 + Math.random() * 0.15);
                ctx.strokeStyle = `rgba(196, 181, 253, ${0.5 * fade})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 12;
                const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 12;
                ctx.lineTo(mx, my);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            g.addColorStop(0, `rgba(196, 181, 253, ${0.25 * fade})`);
            g.addColorStop(1, 'rgba(99, 102, 241, 0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        } else {
            // 火焰漩涡: 4 条旋转螺旋臂 + 中心火球
            for (let i = 0; i < 4; i++) {
                ctx.save();
                ctx.rotate((Math.PI / 2) * i);
                ctx.strokeStyle = `rgba(251, 146, 60, ${0.6 * fade})`;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                for (let j = 0; j <= 12; j++) {
                    const tt = j / 12;
                    const a = tt * Math.PI * 1.2;
                    const rr = tt * r;
                    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
                }
                ctx.stroke();
                ctx.restore();
            }
            ctx.strokeStyle = `rgba(239, 68, 68, ${0.55 * fade})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);
            g.addColorStop(0, `rgba(255, 200, 100, ${0.7 * fade})`);
            g.addColorStop(1, 'rgba(239, 68, 68, 0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
        }

        ctx.restore();
    }
}

// ============== 火神之锤 ==============
export class MagicHammerStrike extends MagicSpellFx {
    targetX: number;
    targetY: number;
    damage: number;
    impactRadius: number;
    age: number = 0;
    fallDuration: number = 0.4;
    landed: boolean = false;
    sctx: SpellContext;

    constructor(targetX: number, targetY: number, damage: number, impactRadius: number, ctx: SpellContext) {
        super(targetX, -200, EntityType.PARTICLE);
        this.targetX = targetX;
        this.targetY = targetY;
        this.damage = damage;
        this.impactRadius = impactRadius;
        this.sctx = ctx;
        this.radius = 18;
    }

    update(dt: number) {
        if (this.landed) { this.markedForDeletion = true; return; }
        this.age += dt;
        const t = Math.min(1, this.age / this.fallDuration);
        const ease = t * t;
        this.position.x = this.targetX;
        this.position.y = -200 + (this.targetY + 200) * ease;
        if (t >= 1) {
            this.landed = true;
            const enemies = this.sctx.getEnemies();
            const r2 = this.impactRadius * this.impactRadius;
            for (const e of enemies) {
                if (e.markedForDeletion) continue;
                const dx = e.position.x - this.targetX;
                const dy = e.position.y - this.targetY;
                if (dx * dx + dy * dy <= r2) {
                    this.sctx.damageEnemy(e, this.damage, '#fbbf24');
                }
            }
            this.sctx.pushEntity(new FireBurst(this.targetX, this.targetY, this.impactRadius * 1.4, '#fbbf24'));
            for (let i = 0; i < 22; i++) {
                this.sctx.pushEntity(new Particle(this.targetX, this.targetY, '#fbbf24', 480, 0.4 + Math.random() * 0.2, 2 + Math.random() * 4));
            }
            this.sctx.addShake(14, 0.3);
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.landed) return;
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.globalCompositeOperation = 'lighter';
        const trailLen = 200;
        const grad = ctx.createLinearGradient(0, -trailLen, 0, 0);
        grad.addColorStop(0, 'rgba(251, 191, 36, 0)');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0.7)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-12, -trailLen);
        ctx.lineTo(12, -trailLen);
        ctx.lineTo(8, 0);
        ctx.lineTo(-8, 0);
        ctx.closePath();
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#451a03';
        ctx.fillRect(-22, -16, 44, 32);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.strokeRect(-22, -16, 44, 32);
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(-3, -38, 6, 22);

        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(251, 191, 36, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ============== 闪电链 (一次性视觉) ==============
export class MagicChainBolt extends MagicSpellFx {
    points: Vector2[];
    age: number = 0;
    duration: number = 0.4;

    constructor(points: Vector2[]) {
        super(points[0]?.x ?? 0, points[0]?.y ?? 0, EntityType.PARTICLE);
        this.points = points;
        this.radius = 0;
    }

    update(dt: number) {
        this.age += dt;
        if (this.age >= this.duration) this.markedForDeletion = true;
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.points.length < 2) return;
        const t = this.age / this.duration;
        const alpha = 1 - t;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        ctx.strokeStyle = `rgba(167, 139, 250, ${alpha})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            const prev = this.points[i - 1];
            const cur = this.points[i];
            const mx = (prev.x + cur.x) / 2 + (Math.random() - 0.5) * 18;
            const my = (prev.y + cur.y) / 2 + (Math.random() - 0.5) * 18;
            ctx.lineTo(mx, my);
            ctx.lineTo(cur.x, cur.y);
        }
        ctx.stroke();

        // 白色亮芯
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.stroke();

        ctx.restore();
    }
}

// ============== 天雷 (有警告 -> 落雷) ==============
export class MagicThunderStrike extends MagicSpellFx {
    targetX: number;
    targetY: number;
    damage: number;
    impactRadius: number;
    age: number = 0;
    warnTime: number = 0.25;
    strikeTime: number = 0.5;
    struck: boolean = false;
    sctx: SpellContext;

    constructor(x: number, y: number, damage: number, radius: number, ctx: SpellContext) {
        super(x, y, EntityType.PARTICLE);
        this.targetX = x;
        this.targetY = y;
        this.damage = damage;
        this.impactRadius = radius;
        this.sctx = ctx;
        this.radius = 0;
    }

    update(dt: number) {
        this.age += dt;
        if (!this.struck && this.age >= this.warnTime) {
            this.struck = true;
            const enemies = this.sctx.getEnemies();
            const r2 = this.impactRadius * this.impactRadius;
            for (const e of enemies) {
                if (e.markedForDeletion) continue;
                const dx = e.position.x - this.targetX;
                const dy = e.position.y - this.targetY;
                if (dx * dx + dy * dy <= r2) {
                    this.sctx.damageEnemy(e, this.damage, '#c084fc');
                }
            }
            for (let i = 0; i < 10; i++) {
                this.sctx.pushEntity(new Particle(this.targetX, this.targetY, '#c084fc', 320, 0.3, 2 + Math.random() * 2));
            }
            this.sctx.addShake(4, 0.1);
        }
        if (this.age >= this.strikeTime) this.markedForDeletion = true;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (!this.struck) {
            const p = this.age / this.warnTime;
            const r = this.impactRadius * (1 - p * 0.4);
            ctx.strokeStyle = `rgba(196, 181, 253, ${0.4 + p * 0.5})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(this.targetX, this.targetY, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            const localT = (this.age - this.warnTime) / Math.max(0.001, this.strikeTime - this.warnTime);
            const alpha = 1 - localT;
            ctx.strokeStyle = `rgba(196, 181, 253, ${alpha})`;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(this.targetX, -50);
            let y = -50;
            while (y < this.targetY) {
                y += 30;
                const x = this.targetX + (Math.random() - 0.5) * 30;
                ctx.lineTo(x, Math.min(y, this.targetY));
            }
            ctx.lineTo(this.targetX, this.targetY);
            ctx.stroke();
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = `rgba(196, 181, 253, ${alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(this.targetX, this.targetY, this.impactRadius * (0.5 + localT * 0.5), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// ============== 电磁轨道炮 (穿透电弧) ==============
export class MagicRailBeam extends MagicSpellFx {
    sx: number; sy: number;
    ex: number; ey: number;
    width: number;
    damage: number;
    age: number = 0;
    duration: number = 0.5;
    damaged: boolean = false;
    sctx: SpellContext;

    constructor(sx: number, sy: number, ex: number, ey: number, width: number, damage: number, ctx: SpellContext) {
        super(sx, sy, EntityType.PARTICLE);
        this.sx = sx; this.sy = sy;
        this.ex = ex; this.ey = ey;
        this.width = width;
        this.damage = damage;
        this.sctx = ctx;
        this.radius = 0;
    }

    update(dt: number) {
        this.age += dt;
        if (!this.damaged) {
            this.damaged = true;
            const enemies = this.sctx.getEnemies();
            for (const e of enemies) {
                if (e.markedForDeletion) continue;
                const d2 = pointSegDist2(e.position.x, e.position.y, this.sx, this.sy, this.ex, this.ey);
                const r = this.width + e.radius;
                if (d2 <= r * r) {
                    this.sctx.damageEnemy(e, this.damage, '#22d3ee');
                }
            }
            this.sctx.addShake(8, 0.2);
        }
        if (this.age >= this.duration) this.markedForDeletion = true;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const t = this.age / this.duration;
        const alpha = 1 - t;
        const w = this.width * (1 - t * 0.4);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(34, 211, 238, ${alpha * 0.6})`;
        ctx.lineWidth = w * 2.5;
        ctx.beginPath(); ctx.moveTo(this.sx, this.sy); ctx.lineTo(this.ex, this.ey); ctx.stroke();
        ctx.strokeStyle = `rgba(125, 211, 252, ${alpha * 0.85})`;
        ctx.lineWidth = w * 1.2;
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = Math.max(1, w * 0.4);
        ctx.stroke();
        ctx.restore();
    }
}

// ============== 法阵图案绘制 (10 种 rune style) ==============
function drawBaseCircle(ctx: CanvasRenderingContext2D, r: number, progress: number, color: string, alpha: number) {
    ctx.strokeStyle = color + alphaHex(alpha);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = color + alphaHex(alpha * 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.stroke();
    // progress arc
    ctx.strokeStyle = color + 'ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
}

function drawRuneHexagram(ctx: CanvasRenderingContext2D, r: number, color: string, alpha: number) {
    ctx.strokeStyle = color + alphaHex(alpha);
    ctx.lineWidth = 2;
    const rr = r * 0.6;
    for (const start of [-Math.PI / 2, Math.PI / 2]) {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const a = start + (i * 2 * Math.PI) / 3;
            const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
    }
    ctx.fillStyle = color + alphaHex(alpha);
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawRuneSunwheel(ctx: CanvasRenderingContext2D, r: number, color: string, alpha: number) {
    ctx.strokeStyle = color + alphaHex(alpha);
    ctx.lineWidth = 2;
    const SPOKES = 8;
    for (let i = 0; i < SPOKES; i++) {
        const a = (i / SPOKES) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
        ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
        ctx.stroke();
        const tipX = Math.cos(a) * r * 0.85;
        const tipY = Math.sin(a) * r * 0.85;
        ctx.fillStyle = color + alphaHex(alpha * 0.8);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX + Math.cos(a + 0.4) * 8, tipY + Math.sin(a + 0.4) * 8);
        ctx.lineTo(tipX + Math.cos(a) * 16, tipY + Math.sin(a) * 16);
        ctx.lineTo(tipX + Math.cos(a - 0.4) * 8, tipY + Math.sin(a - 0.4) * 8);
        ctx.closePath();
        ctx.fill();
    }
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
        const x = Math.cos(a) * r * 0.25, y = Math.sin(a) * r * 0.25;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
}

function drawRuneTrident(ctx: CanvasRenderingContext2D, r: number, color: string, alpha: number) {
    ctx.strokeStyle = color + alphaHex(alpha);
    ctx.fillStyle = color + alphaHex(alpha * 0.5);
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
        const cx = Math.cos(a) * r * 0.5;
        const cy = Math.sin(a) * r * 0.5;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.25);
        ctx.lineTo(r * 0.18, r * 0.15);
        ctx.lineTo(-r * 0.18, r * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    ctx.stroke();
}

function drawRuneSpiral(ctx: CanvasRenderingContext2D, r: number, color: string, alpha: number, rotation: number) {
    ctx.strokeStyle = color + alphaHex(alpha);
    ctx.lineWidth = 2.5;
    const ARMS = 3;
    for (let arm = 0; arm < ARMS; arm++) {
        const offset = (arm / ARMS) * Math.PI * 2;
        ctx.beginPath();
        for (let t = 0; t <= 1; t += 0.04) {
            const a = offset + t * Math.PI * 2.2 + rotation * 0.3;
            const rr = t * r * 0.85;
            const x = Math.cos(a) * rr;
            const y = Math.sin(a) * rr;
            if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

function drawRuneAnvil(ctx: CanvasRenderingContext2D, r: number, color: string, alpha: number) {
    ctx.strokeStyle = color + alphaHex(alpha);
    ctx.lineWidth = 2.5;
    const s = r * 0.6;
    ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.beginPath();
    ctx.moveTo(-s, 0); ctx.lineTo(s, 0);
    ctx.moveTo(0, -s); ctx.lineTo(0, s);
    ctx.stroke();
    ctx.fillStyle = color + alphaHex(alpha);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        ctx.beginPath();
        ctx.arc(dx * s, dy * s, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.5);
    ctx.lineTo(s * 0.5, 0);
    ctx.lineTo(0, s * 0.5);
    ctx.lineTo(-s * 0.5, 0);
    ctx.closePath();
    ctx.stroke();
}

function drawRuneZigzag(ctx: CanvasRenderingContext2D, r: number, color: string, alpha: number) {
    ctx.strokeStyle = color + alphaHex(alpha);
    ctx.lineWidth = 2.5;
    const STEPS = 16;
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i++) {
        const a = (i / STEPS) * Math.PI * 2;
        const rr = (i % 2 === 0) ? r * 0.7 : r * 0.55;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // 中央闪电符号
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -r * 0.3);
    ctx.lineTo(r * 0.05, -r * 0.05);
    ctx.lineTo(-r * 0.05, 0);
    ctx.lineTo(r * 0.15, r * 0.3);
    ctx.lineWidth = 3;
    ctx.stroke();
}

function drawRuneStorm(ctx: CanvasRenderingContext2D, r: number, color: string, alpha: number) {
    ctx.strokeStyle = color + alphaHex(alpha);
    ctx.lineWidth = 2;
    const N = 6;
    for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const cx = Math.cos(a) * r * 0.55;
        const cy = Math.sin(a) * r * 0.55;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(-6, -10);
        ctx.lineTo(2, -2);
        ctx.lineTo(-2, 2);
        ctx.lineTo(6, 10);
        ctx.stroke();
        ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    ctx.stroke();
}

function drawRuneCircuit(ctx: CanvasRenderingContext2D, r: number, color: string, alpha: number) {
    ctx.strokeStyle = color + alphaHex(alpha);
    ctx.lineWidth = 1.5;
    const HEX = 6;
    for (let i = 0; i < HEX; i++) {
        const a = (i / HEX) * Math.PI * 2;
        const x1 = Math.cos(a) * r * 0.3;
        const y1 = Math.sin(a) * r * 0.3;
        const x2 = Math.cos(a) * r * 0.7;
        const y2 = Math.sin(a) * r * 0.7;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.fillStyle = color + alphaHex(alpha);
        ctx.beginPath();
        ctx.arc(x2, y2, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * r * 0.3, y = Math.sin(a) * r * 0.3;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
}

function drawRuneArrow(ctx: CanvasRenderingContext2D, r: number, color: string, alpha: number) {
    ctx.strokeStyle = color + alphaHex(alpha);
    ctx.fillStyle = color + alphaHex(alpha * 0.6);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.6);
    ctx.lineTo(0, -r * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.6);
    ctx.lineTo(r * 0.18, -r * 0.3);
    ctx.lineTo(-r * 0.18, -r * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        const y = i * r * 0.18;
        ctx.beginPath();
        ctx.moveTo(-r * 0.12, y);
        ctx.lineTo(r * 0.12, y);
        ctx.stroke();
    }
}

function drawRuneTetrastar(ctx: CanvasRenderingContext2D, r: number, color: string, alpha: number) {
    ctx.strokeStyle = color + alphaHex(alpha);
    ctx.fillStyle = color + alphaHex(alpha * 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i / 4) * Math.PI * 2;
        const tipX = Math.cos(a) * r * 0.7;
        const tipY = Math.sin(a) * r * 0.7;
        const inA = a + Math.PI / 4;
        const inX = Math.cos(inA) * r * 0.25;
        const inY = Math.sin(inA) * r * 0.25;
        if (i === 0) ctx.moveTo(tipX, tipY); else ctx.lineTo(tipX, tipY);
        ctx.lineTo(inX, inY);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

/** 在玩家位置绘制对应技能的法阵 (蓄力期间) */
function drawRune(ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
                  rotation: number, progress: number, skill: MagicSkillDef) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';

    const alpha = 0.3 + progress * 0.65;
    const scale = 0.6 + progress * 0.4;
    ctx.scale(scale, scale);
    const color = skill.color;

    // 外层: 旋转双环 + 进度条
    ctx.save();
    ctx.rotate(rotation * 0.3);
    drawBaseCircle(ctx, r, progress, color, alpha);
    ctx.restore();

    // 内层 rune (反向慢转)
    ctx.save();
    ctx.rotate(-rotation * 0.6);
    switch (skill.runeStyle) {
        case 0: drawRuneHexagram(ctx, r, color, alpha); break;
        case 1: drawRuneSunwheel(ctx, r, color, alpha); break;
        case 2: drawRuneTrident(ctx, r, color, alpha); break;
        case 3: drawRuneSpiral(ctx, r, color, alpha, rotation); break;
        case 4: drawRuneAnvil(ctx, r, color, alpha); break;
        case 5: drawRuneZigzag(ctx, r, color, alpha); break;
        case 6: drawRuneStorm(ctx, r, color, alpha); break;
        case 7: drawRuneCircuit(ctx, r, color, alpha); break;
        case 8: drawRuneArrow(ctx, r, color, alpha); break;
        case 9: drawRuneTetrastar(ctx, r, color, alpha); break;
    }
    ctx.restore();

    // 中心核心 (蓄满时极亮)
    const coreR = r * 0.16 * (0.7 + progress * 0.5);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2);
    grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(0.4, color + alphaHex(alpha * 0.7));
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, coreR * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ============== MagicCircle (Caster) ==============
/**
 * 玩家身上的施法器 — 手动施法版本.
 * 不参与碰撞 (radius=0).
 *
 * 核心机制:
 * - 玩家拥有 5 个法术, currentSpellIndex 指向 "当前选中".
 * - 长按开火: 在玩家身下绘制对应法阵蓄力, 蓄满 -> 释放 -> 进入冷却.
 * - 松开开火: 清空蓄力进度 (没浪费冷却, 避免误触).
 * - switchToNextReady() / setSpell(i): 切换当前选中 (Q 键 / UI 按钮调用).
 */
export class MagicCircle extends Entity {
    owner: Player;
    element: CircleElement;
    modifiers: RogueModifiers;
    skills: MagicSkillDef[];
    cooldowns: Map<MagicSkillId, number> = new Map();

    /** 当前选中法术索引 (0..skills.length-1) */
    currentSpellIndex: number = 0;

    /** 当前正在施法 (蓄力中). 注意: 仅当 isFiring 且选中法术 ready 时才存在 */
    casting: { skill: MagicSkillDef; elapsed: number; rotation: number } | null = null;

    /** 引擎注入的能力 */
    spellCtx: SpellContext;

    /** 视觉: 持续维持的"环境光晕" */
    haloRotation: number = 0;

    /** 切换法术后的高亮反馈 (0..1, 几帧内淡出) */
    switchFlashTimer: number = 0;

    constructor(owner: Player, element: CircleElement, modifiers: RogueModifiers, ctx: SpellContext) {
        super(owner.position.x, owner.position.y, EntityType.SKILL_SHOCKWAVE);
        this.owner = owner;
        this.element = element;
        this.modifiers = modifiers;
        this.spellCtx = ctx;
        this.skills = getSkillsForElement(element);
        for (const s of this.skills) this.cooldowns.set(s.id, 0);
        this.radius = 0;
    }

    updateModifiers(m: RogueModifiers) { this.modifiers = m; }

    /** 当前选中的法术 */
    getCurrentSpell(): MagicSkillDef {
        return this.skills[this.currentSpellIndex];
    }

    /** 当前选中法术的冷却剩余秒数 (0 = ready) */
    getCurrentCooldown(): number {
        return this.cooldowns.get(this.getCurrentSpell().id) ?? 0;
    }

    /** 任意法术的冷却剩余 */
    getCooldown(id: MagicSkillId): number {
        return this.cooldowns.get(id) ?? 0;
    }

    /** 切换到下一个 (按 Q / UI 按钮). 不要求 ready, 玩家可以提前选择. */
    switchToNext() {
        this.currentSpellIndex = (this.currentSpellIndex + 1) % this.skills.length;
        this.casting = null; // 切换会清空蓄力
        this.switchFlashTimer = 0.4;
    }

    /** 直接选中第 i 个法术 (UI 卡片点击) */
    setSpell(i: number) {
        if (i < 0 || i >= this.skills.length) return;
        if (i === this.currentSpellIndex) return;
        this.currentSpellIndex = i;
        this.casting = null;
        this.switchFlashTimer = 0.4;
    }

    /**
     * 每帧更新.
     * @param dt        delta seconds
     * @param _targetPos 兼容父类 Entity.update 签名 (不使用)
     * @param isFiring  玩家是否正在按住开火键 (鼠标/空格/触屏)
     */
    update(dt: number, _targetPos?: any, isFiring: boolean = false) {
        if (this.owner.markedForDeletion) {
            this.markedForDeletion = true;
            return;
        }
        // 跟随玩家
        this.position.x = this.owner.position.x;
        this.position.y = this.owner.position.y;
        this.haloRotation += dt * 0.6;
        if (this.switchFlashTimer > 0) this.switchFlashTimer = Math.max(0, this.switchFlashTimer - dt);

        // 冷却 tick (始终)
        for (const [id, cd] of this.cooldowns) {
            if (cd > 0) this.cooldowns.set(id, Math.max(0, cd - dt));
        }

        const current = this.getCurrentSpell();
        const currentCd = this.cooldowns.get(current.id) ?? 0;

        if (this.casting) {
            // 已经在蓄力中
            if (!isFiring) {
                // 玩家松开 -> 取消, 不消耗冷却 (avoid frustrating misfires)
                this.casting = null;
                return;
            }
            // 如果用户在蓄力中切换了, 蓄力对象会变, 这里我们对齐到 currentSpell:
            if (this.casting.skill.id !== current.id) {
                this.casting = null;
                return;
            }
            this.casting.elapsed += dt;
            this.casting.rotation += dt * 6;
            const total = this.casting.skill.castTime * this.modifiers.circleCastSpeedMul;
            if (this.casting.elapsed >= total) {
                this.fire(this.casting.skill);
                const fullCd = this.casting.skill.cooldown * this.modifiers.circleCdMul;
                this.cooldowns.set(this.casting.skill.id, fullCd);
                this.casting = null;
            }
        } else {
            // 不在蓄力: 按住 + 当前法术 ready -> 开始蓄力
            if (isFiring && currentCd <= 0) {
                this.casting = { skill: current, elapsed: 0, rotation: 0 };
            }
        }
    }

    /** 蓄力进度 0..1 (不在蓄力 = 0) */
    getCastProgress(): number {
        if (!this.casting) return 0;
        const total = this.casting.skill.castTime * this.modifiers.circleCastSpeedMul;
        return Math.min(1, this.casting.elapsed / Math.max(0.001, total));
    }

    private finalDamage(skill: MagicSkillDef): number {
        return skill.baseDamage * this.modifiers.damageMultiplier * this.modifiers.circleDmgMul;
    }
    private finalRange(skill: MagicSkillDef): number {
        return skill.baseRange * this.modifiers.circleRangeMul;
    }
    /** 取该法术的专属增益数量级 (perk 叠加层数) */
    private spellPerk(id: MagicSkillId, key: string): number {
        return this.modifiers.spellPerks[id]?.[key] ?? 0;
    }

    /** 蓄力完成 -> 释放对应技能 (应用每法术专属增益) */
    private fire(skill: MagicSkillDef) {
        const dmg = this.finalDamage(skill);
        const range = this.finalRange(skill);
        const ctx = this.spellCtx;
        const px = this.owner.position.x;
        const py = this.owner.position.y;
        const enemies = ctx.getEnemies();

        switch (skill.id) {
            case MagicSkillId.FIRE_METEOR: {
                // 痛点: 数量型 -> +N 颗 / 单颗伤害放大 / 命中后小流星溅射
                const extraCount = this.spellPerk(skill.id, 'count');           // +2/层
                const dmgBonus   = 1 + this.spellPerk(skill.id, 'dmgBonus') * 0.4; // +40%/层
                const splitOnLand = this.spellPerk(skill.id, 'split') > 0;
                const COUNT = 5 + extraCount;
                const finalDmg = dmg * dmgBonus;

                const pool = enemies.filter(e => !e.markedForDeletion);
                const launch = (i: number) => {
                    if (this.markedForDeletion || this.owner.markedForDeletion) return;
                    let tx: number, ty: number;
                    if (pool.length > 0) {
                        const t = pool[Math.floor(Math.random() * pool.length)];
                        tx = t.position.x + (Math.random() - 0.5) * 60;
                        ty = t.position.y + (Math.random() - 0.5) * 60;
                    } else {
                        tx = 100 + Math.random() * (ctx.width - 200);
                        ty = 80 + Math.random() * (ctx.height * 0.5);
                    }
                    const sx = tx + (Math.random() - 0.5) * 240;
                    const sy = -80 - Math.random() * 60;
                    const meteor = new MagicMeteor(sx, sy, tx, ty, finalDmg, range, ctx);
                    if (splitOnLand) (meteor as any).splitCount = 3;
                    ctx.pushEntity(meteor);
                };
                for (let i = 0; i < COUNT; i++) {
                    setTimeout(() => launch(i), i * 60);
                }
                break;
            }
            case MagicSkillId.FIRE_NOVA: {
                // 痛点: 一次性瞬伤 -> 二段爆 / 留下灼烧地带
                const doubleBlast = this.spellPerk(skill.id, 'doubleBlast') > 0;
                const burnGround  = this.spellPerk(skill.id, 'burnGround') > 0;

                ctx.pushEntity(new MagicNovaRing(px, py, range, dmg, ctx));
                ctx.addShake(4, 0.2);
                if (doubleBlast) {
                    setTimeout(() => {
                        if (this.markedForDeletion || this.owner.markedForDeletion) return;
                        ctx.pushEntity(new MagicNovaRing(px, py, range * 1.4, dmg * 0.7, ctx));
                    }, 280);
                }
                if (burnGround) {
                    ctx.pushEntity(new MagicAuraField(px, py, range * 0.7, dmg * 0.18, 2.0, ctx, false, null));
                }
                break;
            }
            case MagicSkillId.FIRE_MAGMA: {
                // 痛点: 追踪不稳/数量少 -> +飞弹 / 转向更快 / 爆炸半径加倍
                const extraCount = this.spellPerk(skill.id, 'count');           // +2/层
                const homing     = this.spellPerk(skill.id, 'homing');           // 转向因子叠加
                const explodeMul = 1 + this.spellPerk(skill.id, 'explode') * 1.0; // 半径 +100%/层
                const COUNT = 3 + extraCount;

                const sorted = [...enemies].filter(e => !e.markedForDeletion).sort((a, b) => {
                    const da = (a.position.x - px) ** 2 + (a.position.y - py) ** 2;
                    const db = (b.position.x - px) ** 2 + (b.position.y - py) ** 2;
                    return da - db;
                });
                const arc = 0.45 * (1 + Math.max(0, COUNT - 3) * 0.2);
                for (let i = 0; i < COUNT; i++) {
                    const target = sorted[i] ?? sorted[i % Math.max(1, sorted.length)] ?? null;
                    const a = -Math.PI / 2 + (i - (COUNT - 1) / 2) * arc;
                    const orb = new MagicHomingOrb(px, py, target, dmg, range * explodeMul, ctx, false, a);
                    if (homing > 0) orb.steerStrength = 8 + homing * 6; // 默认 8, perk 每层 +6
                    ctx.pushEntity(orb);
                }
                break;
            }
            case MagicSkillId.FIRE_INFERNO: {
                // 痛点: 持续短 / 跟不到敌人 -> 加时长 / 加 tick / 跟随玩家
                const extraDur  = this.spellPerk(skill.id, 'duration') * 2.0;     // +2s/层
                const tickRate  = 1 + this.spellPerk(skill.id, 'tickRate') * 0.5; // +50%/层
                const followMe  = this.spellPerk(skill.id, 'follow') > 0;

                const boss = enemies.find(e => e.isBoss && !e.markedForDeletion);
                const cx = followMe ? px : (boss ? boss.position.x : ctx.width / 2);
                const cy = followMe ? py : (boss ? boss.position.y : ctx.height * 0.4);
                const field = new MagicAuraField(cx, cy, range, dmg, 4.0 + extraDur, ctx, false, followMe ? this.owner : null);
                field.tickInterval = 0.25 / tickRate;
                ctx.pushEntity(field);
                break;
            }
            case MagicSkillId.FIRE_HAMMER: {
                // 痛点: 单体 / 单次 -> 余震环 / 加范围 / 召唤流星溅射
                const aftershocks = this.spellPerk(skill.id, 'aftershock'); // 1/2/3 道余震
                const radiusMul   = 1 + this.spellPerk(skill.id, 'radius') * 0.5;
                const splash      = this.spellPerk(skill.id, 'splash') > 0;

                const target = enemies.filter(e => !e.markedForDeletion).sort((a, b) => b.health - a.health)[0];
                if (target) {
                    const tx = target.position.x;
                    const ty = target.position.y;
                    const finalRadius = range * radiusMul;
                    ctx.pushEntity(new MagicHammerStrike(tx, ty, dmg, finalRadius, ctx));

                    // 余震: 每道延迟 250ms 发一波放大的火浪
                    for (let i = 0; i < aftershocks; i++) {
                        const delay = 280 + i * 220;
                        const r = finalRadius * (1.4 + i * 0.4);
                        const d = dmg * (0.5 - i * 0.08);
                        setTimeout(() => {
                            if (this.markedForDeletion || this.owner.markedForDeletion) return;
                            ctx.pushEntity(new MagicNovaRing(tx, ty, r, Math.max(8, d), ctx));
                        }, delay);
                    }
                    // 溅射 4 颗小流星到附近敌人
                    if (splash) {
                        const aliveOthers = enemies.filter(e => !e.markedForDeletion && e !== target);
                        for (let i = 0; i < 4; i++) {
                            const pick = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
                            const stx = pick ? pick.position.x : tx + (Math.random() - 0.5) * 200;
                            const sty = pick ? pick.position.y : ty + (Math.random() - 0.5) * 100;
                            const sx = stx + (Math.random() - 0.5) * 160;
                            const sy = -60 - Math.random() * 40;
                            setTimeout(() => {
                                if (this.markedForDeletion || this.owner.markedForDeletion) return;
                                ctx.pushEntity(new MagicMeteor(sx, sy, stx, sty, dmg * 0.4, finalRadius * 0.6, ctx));
                            }, 350 + i * 80);
                        }
                    }
                }
                break;
            }
            case MagicSkillId.ELEC_CHAIN: {
                // 痛点: 跳数有限/衰减 -> +跳数 / 不衰减 / 终点电浆爆
                const extraJumps = this.spellPerk(skill.id, 'jumps');   // +4/层
                const noDecay    = this.spellPerk(skill.id, 'noDecay') > 0;
                const finalBurst = this.spellPerk(skill.id, 'burst') > 0;
                const totalJumps = 7 + extraJumps; // 含起手 8 跳, +N 后 8+N 跳

                const sorted = [...enemies].filter(e => !e.markedForDeletion).sort((a, b) => {
                    const da = (a.position.x - px) ** 2 + (a.position.y - py) ** 2;
                    const db = (b.position.x - px) ** 2 + (b.position.y - py) ** 2;
                    return da - db;
                });
                if (sorted.length === 0) break;
                const points: Vector2[] = [{ x: px, y: py }];
                const hit = new Set<Enemy>();
                let current = sorted[0];
                hit.add(current);
                points.push({ x: current.position.x, y: current.position.y });
                this.spellCtx.damageEnemy(current, dmg, '#a78bfa');

                for (let i = 0; i < totalJumps; i++) {
                    let next: Enemy | null = null;
                    let nd = range * range;
                    for (const e of enemies) {
                        if (e.markedForDeletion || hit.has(e)) continue;
                        const ddx = e.position.x - current.position.x;
                        const ddy = e.position.y - current.position.y;
                        const d = ddx * ddx + ddy * ddy;
                        if (d < nd) { nd = d; next = e; }
                    }
                    if (!next) break;
                    hit.add(next);
                    points.push({ x: next.position.x, y: next.position.y });
                    const decay = noDecay ? 1 : Math.pow(0.85, i + 1);
                    this.spellCtx.damageEnemy(next, dmg * decay, '#a78bfa');
                    current = next;
                }
                ctx.pushEntity(new MagicChainBolt(points));
                if (finalBurst) {
                    // 在终点处补一个小型电系新星
                    const ex = points[points.length - 1].x;
                    const ey = points[points.length - 1].y;
                    ctx.pushEntity(new MagicNovaRing(ex, ey, 90, dmg * 0.5, ctx));
                }
                break;
            }
            case MagicSkillId.ELEC_THUNDER: {
                // 痛点: 散射 / 命中不准 -> +道数 / 蓄电后再爆 / 优先砸最强
                const extraBolts = this.spellPerk(skill.id, 'bolts');     // +3/层
                const overcharge = this.spellPerk(skill.id, 'overcharge') > 0;
                const targetTop  = this.spellPerk(skill.id, 'targetTop') > 0;
                const COUNT = 5 + extraBolts;

                const candidates = enemies.filter(e => !e.markedForDeletion);
                const sortedByHp = [...candidates].sort((a, b) => b.health - a.health);

                for (let i = 0; i < COUNT; i++) {
                    let tx: number, ty: number;
                    if (targetTop && sortedByHp.length > 0) {
                        const e = sortedByHp[i % sortedByHp.length];
                        tx = e.position.x + (Math.random() - 0.5) * 50;
                        ty = e.position.y + (Math.random() - 0.5) * 50;
                    } else if (candidates.length > 0 && Math.random() < 0.7) {
                        const e = candidates[Math.floor(Math.random() * candidates.length)];
                        tx = e.position.x + (Math.random() - 0.5) * 80;
                        ty = e.position.y + (Math.random() - 0.5) * 60;
                    } else {
                        tx = 80 + Math.random() * (ctx.width - 160);
                        ty = 80 + Math.random() * (ctx.height * 0.5);
                    }
                    const delay = i * 80;
                    setTimeout(() => {
                        if (this.markedForDeletion || this.owner.markedForDeletion) return;
                        ctx.pushEntity(new MagicThunderStrike(tx, ty, dmg, range, ctx));
                        // 蓄电核心: 落雷 1s 后再炸一发更大的
                        if (overcharge) {
                            setTimeout(() => {
                                if (this.markedForDeletion || this.owner.markedForDeletion) return;
                                ctx.pushEntity(new MagicThunderStrike(tx, ty, dmg * 1.5, range * 1.4, ctx));
                            }, 1000);
                        }
                    }, delay);
                }
                break;
            }
            case MagicSkillId.ELEC_STATIC: {
                // 痛点: 范围 / 持续 -> +时长 / +半径 / 减速
                const extraDur = this.spellPerk(skill.id, 'duration') * 2.0;
                const radiusMul = 1 + this.spellPerk(skill.id, 'radius') * 0.5;
                const slow = this.spellPerk(skill.id, 'slow') > 0;

                const field = new MagicAuraField(px, py, range * radiusMul, dmg, 4.0 + extraDur, ctx, true, this.owner);
                if (slow) field.slowFactor = 0.55; // 阵内小怪减速 45%
                ctx.pushEntity(field);
                break;
            }
            case MagicSkillId.ELEC_RAILGUN: {
                // 痛点: 单发 / 单方向 -> +宽度 / 双发 / 二次回程
                const widthMul = 1 + this.spellPerk(skill.id, 'width') * 1.0;
                const doubleShot = this.spellPerk(skill.id, 'double') > 0;
                const returnShot = this.spellPerk(skill.id, 'return') > 0;

                const candidates = enemies.filter(e => !e.markedForDeletion).sort((a, b) => b.health - a.health);
                const target = candidates[0];

                const fire = (dirX: number, dirY: number, delay: number = 0) => {
                    const REACH = 1500;
                    const ex = px + dirX * REACH;
                    const ey = py + dirY * REACH;
                    if (delay > 0) {
                        setTimeout(() => {
                            if (this.markedForDeletion || this.owner.markedForDeletion) return;
                            ctx.pushEntity(new MagicRailBeam(px, py, ex, ey, range * widthMul, dmg, ctx));
                        }, delay);
                    } else {
                        ctx.pushEntity(new MagicRailBeam(px, py, ex, ey, range * widthMul, dmg, ctx));
                    }
                };

                let dirX = 0, dirY = -1;
                if (target) {
                    const dx = target.position.x - px;
                    const dy = target.position.y - py;
                    const m = Math.hypot(dx, dy) || 1;
                    dirX = dx / m;
                    dirY = dy / m;
                }
                fire(dirX, dirY);

                if (doubleShot) {
                    // 第二发: 锁定第二强目标 (没有就反向)
                    const t2 = candidates[1];
                    let d2x = -dirX, d2y = -dirY;
                    if (t2) {
                        const dx = t2.position.x - px;
                        const dy = t2.position.y - py;
                        const m = Math.hypot(dx, dy) || 1;
                        d2x = dx / m;
                        d2y = dy / m;
                    }
                    fire(d2x, d2y, 120);
                }
                if (returnShot) {
                    fire(-dirX, -dirY, 240);
                }
                break;
            }
            case MagicSkillId.ELEC_PLASMA: {
                // 痛点: 球数 / 命中后无后续 -> +颗 / 命中后分裂 / 球间链电
                const extraCount = this.spellPerk(skill.id, 'count');     // +2/层
                const splitOnHit = this.spellPerk(skill.id, 'split') > 0;
                const interLink  = this.spellPerk(skill.id, 'link') > 0;
                const COUNT = 4 + extraCount;

                const sorted = [...enemies].filter(e => !e.markedForDeletion).sort((a, b) => {
                    const da = (a.position.x - px) ** 2 + (a.position.y - py) ** 2;
                    const db = (b.position.x - px) ** 2 + (b.position.y - py) ** 2;
                    return da - db;
                });
                const arc = 0.5 * (1 + Math.max(0, COUNT - 4) * 0.15);
                const orbs: MagicHomingOrb[] = [];
                for (let i = 0; i < COUNT; i++) {
                    const target = sorted[i] ?? sorted[i % Math.max(1, sorted.length)] ?? null;
                    const a = -Math.PI / 2 + (i - (COUNT - 1) / 2) * arc;
                    const orb = new MagicHomingOrb(px, py, target, dmg, range, ctx, true, a);
                    if (splitOnHit) (orb as any).splitOnHit = true;
                    orbs.push(orb);
                    ctx.pushEntity(orb);
                }
                if (interLink && orbs.length >= 2) {
                    // 在球之间画一个动态电链 (用 LinkedOrbsBolt 简化做法: 推一个随访问者)
                    ctx.pushEntity(new MagicOrbLink(orbs));
                }
                break;
            }
        }
    }

    // ================== 渲染 ==================
    static draw(ctx: CanvasRenderingContext2D, c: MagicCircle) {
        const isFire = c.element === CircleElement.FIRE;
        const baseColor = isFire ? '#fb923c' : '#a78bfa';

        // 1) 持续淡光环 (任何时候都在); 切换法术后短暂强化
        ctx.save();
        ctx.translate(c.position.x, c.position.y);
        ctx.globalCompositeOperation = 'lighter';
        ctx.rotate(c.haloRotation);
        const switchBoost = c.switchFlashTimer / 0.4;
        const haloAlpha = 0.18 + switchBoost * 0.4;
        ctx.strokeStyle = isFire ? `rgba(251, 146, 60, ${haloAlpha})` : `rgba(167, 139, 250, ${haloAlpha})`;
        ctx.lineWidth = 1.2 + switchBoost * 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            ctx.fillStyle = baseColor + '88';
            ctx.beginPath();
            ctx.arc(Math.cos(a) * 50, Math.sin(a) * 50, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // 2) 蓄力中 -> 绘制对应法阵
        if (c.casting) {
            const skill = c.casting.skill;
            const total = skill.castTime * c.modifiers.circleCastSpeedMul;
            const progress = Math.min(1, c.casting.elapsed / total);
            const range = c.finalRange(skill);
            const runeR = Math.min(150, 80 + range * 0.06);
            drawRune(ctx, c.position.x, c.position.y, runeR, c.casting.rotation, progress, skill);
        }
    }

    /** 给 UI 用: 当前正在施法的技能名 (用于 HUD 提示, 可为空) */
    getCastingLabel(): string | null {
        return this.casting ? this.casting.skill.name : null;
    }
}

// ============== 电浆球之间动态电链 (装饰 + 微伤, 仅 ELEC_PLASMA 的 link perk 用) ==============
export class MagicOrbLink extends MagicSpellFx {
    orbs: MagicHomingOrb[];
    age: number = 0;
    maxAge: number = 2.5;

    constructor(orbs: MagicHomingOrb[]) {
        super(0, 0, EntityType.PARTICLE);
        this.orbs = orbs;
        this.radius = 0;
    }

    update(dt: number) {
        this.age += dt;
        const alive = this.orbs.filter(o => !o.markedForDeletion);
        if (alive.length < 2 || this.age >= this.maxAge) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        const alive = this.orbs.filter(o => !o.markedForDeletion);
        if (alive.length < 2) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(167, 139, 250, 0.65)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < alive.length; i++) {
            for (let j = i + 1; j < alive.length; j++) {
                const a = alive[i].position;
                const b = alive[j].position;
                ctx.moveTo(a.x, a.y);
                const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 14;
                const my = (a.y + b.y) / 2 + (Math.random() - 0.5) * 14;
                ctx.lineTo(mx, my);
                ctx.lineTo(b.x, b.y);
            }
        }
        ctx.stroke();
        ctx.restore();
    }
}
