import { Entity } from "./Entities";
import { EntityType, Vector2 } from "../types";

/**
 * ============================================================================================
 * PERFORMANCE-OPTIMIZED TESLA DISCHARGE SYSTEM (V5.0 - TURBO)
 * ============================================================================================
 * 
 * 优化重点：
 * 1. 移除了导致掉帧的 shadowBlur。
 * 2. 使用离散噪点查找表替代实时 Perlin 计算。
 * 3. 优化了渲染管线，减少 GPU 状态切换。
 */

// --- 性能优化版查找表 ---
const NOISE_TABLE_SIZE = 512;
const NOISE_TABLE = Array.from({ length: NOISE_TABLE_SIZE }, () => Math.random() - 0.5);

const TESLA_PERF_CONFIG = {
    SEGMENTS_PER_BOLT: 12,       // 减少物理分段数
    MAX_BRANCHES: 2,             // 限制递归深度
    FLASH_INTERVAL: 0.08,        // 路径刷新频率（约12FPS的视觉刷新，足够欺骗眼睛）
    GLOW_PASSES: 3               // 模拟发光的描边层数
};

/**
 * 极简向量库，避免对象创建
 */
class FastVec {
    static distSq(x1: number, y1: number, x2: number, y2: number) {
        return (x1 - x2) ** 2 + (y1 - y2) ** 2;
    }
}

interface BoltPath {
    points: number[]; // 平铺数组 [x1, y1, x2, y2...] 性能优于 Vector2[]
    width: number;
    alpha: number;
}

export class TeslaLightning extends Entity {
    private boltPaths: BoltPath[] = [];
    private targets: Vector2[];
    private life: number;
    private maxLife: number;
    private flashTimer: number = 0;
    
    // 性能友好的颜色方案（直接使用字符串，避免每帧拼接）
    private static readonly COLORS = {
        CORE: '#ffffff',
        MID: 'rgba(165, 243, 252, 0.8)',
        OUTER: 'rgba(8, 145, 178, 0.3)'
    };

    constructor(start: Vector2, targets: Vector2[], life: number = 0.4) {
        super(start.x, start.y, EntityType.WEAPON_TESLA);
        this.targets = targets;
        this.maxLife = life;
        this.life = life;
        
        // 初始生成
        this.generateAllPaths();
    }

    /**
     * 核心优化：路径生成逻辑。
     * 只有在 flashTimer 超过阈值时才调用。
     */
    private generateAllPaths() {
        this.boltPaths = [];
        let curX = this.position.x;
        let curY = this.position.y;

        for (const target of this.targets) {
            this.createBolt(curX, curY, target.x, target.y, 1.0, 0);
            curX = target.x;
            curY = target.y;
        }
    }

    private createBolt(sx: number, sy: number, ex: number, ey: number, energy: number, depth: number) {
        const points: number[] = [sx, sy];
        const dx = ex - sx;
        const dy = ey - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const steps = TESLA_PERF_CONFIG.SEGMENTS_PER_BOLT;
        const nx = -dy / dist; // 法向量
        const ny = dx / dist;

        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            // 快速查找噪声
            const noiseIndex = Math.floor((sx + sy + i * 13) % NOISE_TABLE_SIZE);
            const jitter = NOISE_TABLE[noiseIndex] * (dist * 0.2) * (1 - t + 0.2);
            
            points.push(
                sx + dx * t + nx * jitter,
                sy + dy * t + ny * jitter
            );
        }
        points.push(ex, ey);

        this.boltPaths.push({
            points,
            width: 3 * energy,
            alpha: energy
        });

        // 限制分支生成，降低 CPU 消耗
        if (depth < 1 && Math.random() < 0.3) {
            const angle = (Math.random() - 0.5) * 1.2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const bx = sx + dx * 0.5;
            const by = sy + dy * 0.5;
            // 简单分支末梢
            this.createBolt(bx, by, bx + (dx * cos - dy * sin) * 0.5, by + (dx * sin + dy * cos) * 0.5, energy * 0.5, depth + 1);
        }
    }

    public update(dt: number) {
        this.life -= dt;
        this.flashTimer += dt;

        // 视觉欺骗：每秒只刷新 12 次路径，而不是 60 次
        if (this.flashTimer > TESLA_PERF_CONFIG.FLASH_INTERVAL) {
            this.generateAllPaths();
            this.flashTimer = 0;
        }

        if (this.life <= 0) {
            this.markedForDeletion = true;
        }
    }

    /**
     * 极速渲染管线
     */
    public static draw(ctx: CanvasRenderingContext2D, tesla: TeslaLightning) {
        const paths = tesla.boltPaths;
        if (paths.length === 0) return;

        const lifePct = tesla.life / tesla.maxLife;
        ctx.save();
        
        // 性能关键：只切换一次 lighter 模式
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 第一遍：绘制外发光（替代 shadowBlur）
        // 通过宽线条、低透明度模拟辉光
        ctx.strokeStyle = TeslaLightning.COLORS.OUTER;
        this.drawLayer(ctx, paths, 12 * lifePct);

        // 第二遍：绘制中层等离子体
        ctx.strokeStyle = TeslaLightning.COLORS.MID;
        this.drawLayer(ctx, paths, 5 * lifePct);

        // 第三遍：绘制白色核心
        ctx.strokeStyle = TeslaLightning.COLORS.CORE;
        this.drawLayer(ctx, paths, 1.5 * lifePct);

        ctx.restore();
    }

    private static drawLayer(ctx: CanvasRenderingContext2D, paths: BoltPath[], baseWidth: number) {
        ctx.beginPath();
        for (const path of paths) {
            const pts = path.points;
            ctx.lineWidth = baseWidth * path.width;
            ctx.moveTo(pts[0], pts[1]);
            for (let i = 2; i < pts.length; i += 2) {
                ctx.lineTo(pts[i], pts[i + 1]);
            }
        }
        ctx.stroke();
    }
}
