import { Entity } from "./Entities";
import { EntityType } from "../types";

/**
 * ============================================================================================
 * SINGULARITY RADIANCE ENGINE v7.0 - "BEYOND THE LIGHT"
 * ============================================================================================
 * 
 * 核心逻辑：
 * 1. 绝对视界（The Void）：使用渲染层级确保中心点没有任何光线逃逸。
 * 2. 动量梯度（Momentum Gradient）：内圈角速度接近光速，外圈缓慢。
 * 3. 物质流（Accretion Stream）：粒子不是简单的圆周运动，而是带有向心螺旋的切向运动。
 * 4. 磁场偏折（Magnetic Jitter）：模拟高能等离子体在强磁场下的不规则颤动。
 */

const BH_SETTINGS = {
    RADIUS: 300,                  // 视觉半径
    VOID_RADIUS: 42,              // 绝对黑体半径
    PHOTON_SPHERE: 55,            // 光子球层（最亮处）
    PARTICLE_COUNT: 15000,         // 粒子密度
    SPIRAL_FACTOR: 0.15,          // 向心螺旋系数
    MIN_ALPHA: 0.1,
    MAX_ALPHA: 0.9,
    COLORS: {
        HOT: "255, 255, 255",     // 高能区
        PLASMA: "0, 180, 255",    // 中能区
        VOID: "#000000"           // 视界
    }
};

/**
 * SECTION 1: 高级轨道物理粒子
 */
class AccretionParticle {
    public x: number = 0;
    public y: number = 0;
    public angle: number;
    public dist: number;
    public speed: number;
    public size: number;
    public life: number;
    public color: string;
    private orbitId: number;

    constructor(maxR: number) {
        this.orbitId = Math.random();
        this.reset(maxR, true);
    }

    reset(maxR: number, initial: boolean = false) {
        // 分层轨道分布逻辑
        const r = Math.random();
        this.dist = BH_SETTINGS.VOID_RADIUS + (Math.pow(r, 1.2) * (maxR - BH_SETTINGS.VOID_RADIUS));
        this.angle = Math.random() * Math.PI * 2;
        
        // 物理角速度：内快外慢
        this.speed = (600 / Math.sqrt(this.dist)) * 0.5;
        this.size = 0.5 + Math.random() * 2;
        this.life = initial ? Math.random() : 1.0;
        
        // 颜色映射逻辑
        const distRatio = (this.dist - BH_SETTINGS.VOID_RADIUS) / maxR;
        if (distRatio < 0.15) {
            this.color = BH_SETTINGS.COLORS.HOT;
        } else {
            this.color = BH_SETTINGS.COLORS.PLASMA;
        }
    }

    update(dt: number, maxR: number) {
        // 1. 旋转与向心复合运动
        this.angle += this.speed * dt * 50;
        
        // 螺旋塌缩逻辑：粒子在旋转的同时被吸向中心
        const radialPull = (BH_SETTINGS.SPIRAL_FACTOR * this.speed * 20);
        this.dist -= radialPull * dt;

        // 2. 更新笛卡尔坐标用于渲染
        this.x = Math.cos(this.angle) * this.dist;
        this.y = Math.sin(this.angle) * this.dist;

        // 3. 生命衰减与视界吞噬
        if (this.dist < BH_SETTINGS.VOID_RADIUS * 0.9) {
            this.reset(maxR);
        }
    }
}

/**
 * SECTION 2: 黑洞实体
 */
export class BlackHole extends Entity {
    private particles: AccretionParticle[] = [];
    private lifeTime: number = 0;
    private maxLife: number = 10.0;
    private isClosing: boolean = false;
    private scale: number = 0;

    constructor(x: number, y: number) {
        super(x, y, EntityType.SKILL_BLACKHOLE);
        
        // 预分配粒子内存池
        for (let i = 0; i < BH_SETTINGS.PARTICLE_COUNT; i++) {
            this.particles.push(new AccretionParticle(BH_SETTINGS.RADIUS));
        }
    }

    update(dt: number) {
        this.lifeTime += dt;
        
        // 1. 状态控制逻辑
        if (!this.isClosing) {
            // 展开动画
            this.scale = Math.min(1.0, this.scale + dt * 1.5);
            if (this.lifeTime > this.maxLife) this.isClosing = true;
        } else {
            // 塌缩动画
            this.scale -= dt * 2.0;
            if (this.scale <= 0) this.markedForDeletion = true;
        }

        // 2. 粒子物理演算 (Non-Simplified)
        for (const p of this.particles) {
            p.update(dt, BH_SETTINGS.RADIUS);
        }

        // 3. 空间微漂移
        this.position.y -= 8 * dt;
    }

    /**
     * SECTION 3: 渲染管线
     * 严格遵循黑洞物理视觉层次
     */
    static draw(ctx: CanvasRenderingContext2D, bh: BlackHole) {
        const { x, y } = bh.position;
        if (bh.scale <= 0) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(bh.scale, bh.scale);

        // --- LAYER 1: 引力透镜边缘 (Lensing Glow) ---
        // 模拟光线在引力边缘的微弱偏折背景
        const lensGrad = ctx.createRadialGradient(0, 0, BH_SETTINGS.VOID_RADIUS, 0, 0, BH_SETTINGS.RADIUS);
        lensGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        lensGrad.addColorStop(0.2, 'rgba(0, 30, 80, 0.4)');
        lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = lensGrad;
        ctx.beginPath();
        ctx.arc(0, 0, BH_SETTINGS.RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // --- LAYER 2: 吸积盘粒子流 (Accretion Disk) ---
        // 我们利用混合模式模拟高能等离子体
        ctx.globalCompositeOperation = 'lighter';
        
        // 分颜色组渲染以提升性能
        const colorKeys = [BH_SETTINGS.COLORS.HOT, BH_SETTINGS.COLORS.PLASMA];
        
        for (const color of colorKeys) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${color}, 0.2)`;
            ctx.fillStyle = `rgb(${color})`;
            ctx.lineWidth = 1;

            for (const p of bh.particles) {
                if (p.color !== color) continue;

                // 物理特征：越靠近中心，粒子由于高速运动呈现更明显的“切向拉伸”
                const stretch = (1.5 - (p.dist / BH_SETTINGS.RADIUS)) * 15;
                const tx = p.x - Math.sin(p.angle) * stretch;
                const ty = p.y + Math.cos(p.angle) * stretch;

                // 绘制带运动模糊效果的物质流
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(tx, ty);
                
                // 绘制高能核心点
                if (p.orbitId > 0.8) {
                    ctx.rect(p.x, p.y, p.size, p.size);
                }
            }
            ctx.stroke();
            ctx.fill();
        }

        // --- LAYER 3: 光子球层 (Photon Sphere) ---
        // 这是事件视界外最后一层肉眼可见的极亮环
        ctx.globalCompositeOperation = 'lighter';
        const ringGrad = ctx.createRadialGradient(0, 0, BH_SETTINGS.VOID_RADIUS, 0, 0, BH_SETTINGS.PHOTON_SPHERE);
        ringGrad.addColorStop(0, '#ffffff');
        ringGrad.addColorStop(0.4, '#00d2ff');
        ringGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = ringGrad;
        ctx.beginPath();
        ctx.arc(0, 0, BH_SETTINGS.PHOTON_SPHERE, 0, Math.PI * 2);
        ctx.fill();

        // --- LAYER 4: 绝对事件视界 (The Event Horizon) ---
        // 无论外部多亮，中心必须是死寂的黑
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = BH_SETTINGS.COLORS.VOID;
        ctx.beginPath();
        ctx.arc(0, 0, BH_SETTINGS.VOID_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // 为视界增加一层极细的边缘波纹，模拟霍金辐射边缘
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, BH_SETTINGS.VOID_RADIUS + 0.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}
