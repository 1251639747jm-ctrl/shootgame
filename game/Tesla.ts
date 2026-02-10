import { Entity } from "./Entities";
import { EntityType, Vector2 } from "../types";
// --- 物理常数配置 ---
const TESLA_CONFIG = {
    PROPAGATION: {
        MAX_BRANCH_DEPTH: 4,        // 最大递归深度
        FORK_CHANCE: 0.28,          // 每个节点分叉的概率
        ATTENUATION: 0.75,          // 分支能量衰减率
        SEGMENT_MIN_LEN: 8,         // 最小线段长度
        SEGMENT_MAX_LEN: 18,        // 最大线段长度
        JITTER_STRENGTH: 22,        // 随机抖动强度
    },
    RENDER: {
        BLOOM_SAMPLES: 3,           // 辉光叠加次数
        GLOW_RADIUS: 25,            // 发光半径
        PERSISTENCE: 0.15,          // 视觉残留强度
        CORE_WIDTH: 3.5,            // 核心线条宽度
        FLICKER_HZ: 60,             // 闪烁频率
    },
    ATMOSPHERE: {
        IONIZATION_SCALE: 0.005,    // 噪声场缩放
        WIND_INFLUENCE: 0.2,        // 风力（漂移）影响
    }
};

/**
 * SECTION 1: 高级数学向量引擎
 * 用于处理复杂的顶点变换和电荷传导方向。
 */
class TeslaVec {
    static add(v1: Vector2, v2: Vector2): Vector2 {
        return { x: v1.x + v2.x, y: v1.y + v2.y };
    }

    static sub(v1: Vector2, v2: Vector2): Vector2 {
        return { x: v1.x - v2.x, y: v1.y - v2.y };
    }

    static mul(v: Vector2, s: number): Vector2 {
        return { x: v.x * s, y: v.y * s };
    }

    static mag(v: Vector2): number {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    }

    static normalize(v: Vector2): Vector2 {
        const m = this.mag(v);
        return m === 0 ? { x: 0, y: 0 } : this.mul(v, 1 / m);
    }

    static dist(v1: Vector2, v2: Vector2): number {
        return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2);
    }

    static lerp(v1: Vector2, v2: Vector2, t: number): Vector2 {
        return {
            x: v1.x + (v2.x - v1.x) * t,
            y: v1.y + (v2.y - v1.y) * t
        };
    }

    static rotate(v: Vector2, angle: number): Vector2 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
            x: v.x * cos - v.y * sin,
            y: v.x * sin + v.y * cos
        };
    }
}

/**
 * SECTION 2: 噪声与随机场逻辑
 * 模拟空气中不均匀的介电常数分布。
 */
class DielectricNoise {
    private static p: number[] = new Array(512);
    private static permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,72,55,243,69,185,112,224,225,103,70,24,242,38,153,150,155,248,127,192,207,114,31,141,123,5,107,176,195,12,184,81,180,246,251,19,228,223,84,181,193,59,121,113,9,218,110,47,199,93,17,206,104,119,152,145,236,170,51,202,66,128,156,61,215,98,221,178,144,213,204,67,106,78,191,157,14,212,183,124,19,205,172,118,50,4,163,115,101,235,82,43,97,22,222,42,210,49,201,250,58,45,214,232,126,85,227,249,241,182,154,162,253,167,39,138,238,255,29];

    static init() {
        for (let i = 0; i < 256; i++) this.p[256 + i] = this.p[i] = this.permutation[i];
    }

    private static fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
    private static lerp(t: number, a: number, b: number) { return a + t * (b - a); }
    private static grad(hash: number, x: number, y: number, z: number) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    static perlin(x: number, y: number, z: number) {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
        x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
        const u = this.fade(x), v = this.fade(y), w = this.fade(z);
        const A = this.p[X] + Y, AA = this.p[A] + Z, AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y, BA = this.p[B] + Z, BB = this.p[B + 1] + Z;

        return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)),
            this.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z))),
            this.lerp(v, this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))));
    }
}
DielectricNoise.init();

/**
 * SECTION 3: 电弧分支数据结构 (Bolt Branch)
 * 用于存储递归生成的电弧路径。
 */
class LightningBranch {
    public points: Vector2[] = [];
    public subBranches: LightningBranch[] = [];
    public depth: number;
    public energy: number;
    public thickness: number;

    constructor(start: Vector2, end: Vector2, depth: number, energy: number) {
        this.depth = depth;
        this.energy = energy;
        this.thickness = (1.5 / (depth + 1)) * energy;
        this.generatePath(start, end);
    }

    private generatePath(start: Vector2, end: Vector2) {
        const dist = TeslaVec.dist(start, end);
        const dir = TeslaVec.normalize(TeslaVec.sub(end, start));
        const perp = { x: -dir.y, y: dir.x };
        
        const segmentCount = Math.max(3, Math.floor(dist / TESLA_CONFIG.PROPAGATION.SEGMENT_MAX_LEN));
        this.points.push(start);

        for (let i = 1; i < segmentCount; i++) {
            const t = i / segmentCount;
            const basePos = TeslaVec.lerp(start, end, t);
            
            // 使用噪声产生自然弯曲
            const noiseVal = DielectricNoise.perlin(basePos.x * 0.01, basePos.y * 0.01, Date.now() * 0.001);
            const offsetDist = noiseVal * TESLA_CONFIG.PROPAGATION.JITTER_STRENGTH * (1 + this.depth * 0.5);
            
            const currentPoint = TeslaVec.add(basePos, TeslaVec.mul(perp, offsetDist));
            this.points.push(currentPoint);

            // 递归产生分叉
            if (this.depth < TESLA_CONFIG.PROPAGATION.MAX_BRANCH_DEPTH && Math.random() < TESLA_CONFIG.PROPAGATION.FORK_CHANCE) {
                const forkAngle = (Math.random() - 0.5) * Math.PI * 0.6;
                const forkLen = dist * (1 - t) * 0.6;
                const forkDir = TeslaVec.rotate(dir, forkAngle);
                const forkEnd = TeslaVec.add(currentPoint, TeslaVec.mul(forkDir, forkLen));
                
                this.subBranches.push(new LightningBranch(currentPoint, forkEnd, this.depth + 1, this.energy * 0.6));
            }
        }
        this.points.push(end);
    }

    public draw(ctx: CanvasRenderingContext2D, alpha: number) {
        if (this.points.length < 2) return;

        ctx.lineWidth = this.thickness;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);

        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.stroke();

        this.subBranches.forEach(b => b.draw(ctx, alpha));
    }
}

/**
 * SECTION 4: 主实体类 (The Tesla Lightning Entity)
 */
export class TeslaLightning extends Entity {
    private branches: LightningBranch[] = [];
    private targets: Vector2[];
    private life: number;
    private maxLife: number;
    private seed: number;
    private opacity: number = 1.0;

    // 颜色配置
    private static readonly COLORS = {
        CORE: '#ffffff',
        MID: '#a5f3fc',
        OUTER: '#0891b2',
        PLASMA: 'rgba(165, 243, 252, 0.2)'
    };

    constructor(start: Vector2, targets: Vector2[], life: number = 0.5) {
        super(start.x, start.y, EntityType.WEAPON_TESLA);
        this.targets = targets;
        this.maxLife = life;
        this.life = life;
        this.seed = Math.random() * 1000;
        this.rebuildBranches();
    }

    /**
     * 重建电弧拓扑结构
     * 每一帧或每隔几帧重建一次以产生动态闪烁感
     */
    private rebuildBranches() {
        this.branches = [];
        let currentPos = { x: this.position.x, y: this.position.y };

        this.targets.forEach((target, index) => {
            // 主干电弧
            this.branches.push(new LightningBranch(currentPos, target, 0, 1.0));
            
            // 在目标点产生溅射分叉（静电刷）
            for (let i = 0; i < 3; i++) {
                const splashAngle = Math.random() * Math.PI * 2;
                const splashLen = 20 + Math.random() * 40;
                const splashEnd = {
                    x: target.x + Math.cos(splashAngle) * splashLen,
                    y: target.y + Math.sin(splashAngle) * splashLen
                };
                this.branches.push(new LightningBranch(target, splashEnd, 1, 0.5));
            }

            currentPos = target;
        });
    }

    public update(dt: number) {
        this.life -= dt;
        
        // 基于剩余寿命计算透明度（非线性衰减）
        const t = this.life / this.maxLife;
        this.opacity = t > 0.8 ? 1.0 : t * 1.2;

        // 闪电在生命周期内会进行几次猛烈的形态重组
        if (Math.random() < 0.3) {
            this.rebuildBranches();
        }

        if (this.life <= 0) {
            this.markedForDeletion = true;
        }
    }

    /**
     * 核心渲染逻辑
     * 采用多层混合模式实现高能等离子体视觉
     */
    public static draw(ctx: CanvasRenderingContext2D, tesla: TeslaLightning) {
        if (tesla.branches.length === 0) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        // 1. 绘制外部辉光 (Outer Bloom)
        // 使用模糊和低透明度模拟大气散射
        ctx.shadowColor = TeslaLightning.COLORS.OUTER;
        ctx.shadowBlur = TESLA_CONFIG.RENDER.GLOW_RADIUS;
        ctx.strokeStyle = TeslaLightning.COLORS.OUTER;
        ctx.globalAlpha = tesla.opacity * 0.4;
        tesla.branches.forEach(b => b.draw(ctx, tesla.opacity));

        // 2. 绘制中间能量层 (Mid Energy)
        ctx.shadowBlur = 10;
        ctx.shadowColor = TeslaLightning.COLORS.MID;
        ctx.strokeStyle = TeslaLightning.COLORS.MID;
        ctx.globalAlpha = tesla.opacity * 0.7;
        tesla.branches.forEach(b => b.draw(ctx, tesla.opacity));

        // 3. 绘制炽热核心 (Hot Core)
        // 核心不带阴影以保证清晰度
        ctx.shadowBlur = 0;
        ctx.strokeStyle = TeslaLightning.COLORS.CORE;
        ctx.globalAlpha = tesla.opacity;
        tesla.branches.forEach(b => {
            const oldThickness = b.thickness;
            b.thickness *= 0.3; // 核心极细
            b.draw(ctx, tesla.opacity);
            b.thickness = oldThickness;
        });

        // 4. 绘制接触点火花 (Contact Sparks)
        TeslaLightning.drawImpactPoints(ctx, tesla);

        ctx.restore();
    }

    private static drawImpactPoints(ctx: CanvasRenderingContext2D, tesla: TeslaLightning) {
        ctx.fillStyle = TeslaLightning.COLORS.CORE;
        tesla.targets.forEach(target => {
            const size = Math.random() * 8 + 4;
            
            // 绘制十字光芒
            ctx.beginPath();
            ctx.arc(target.x, target.y, size * 0.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.lineWidth = 1;
            ctx.strokeStyle = TeslaLightning.COLORS.MID;
            
            // 绘制随机发散的电子
            for (let i = 0; i < 4; i++) {
                const angle = Math.random() * Math.PI * 2;
                const len = size * 3;
                ctx.beginPath();
                ctx.moveTo(target.x, target.y);
                ctx.lineTo(
                    target.x + Math.cos(angle) * len,
                    target.y + Math.sin(angle) * len
                );
                ctx.stroke();
            }
        });
    }
}
