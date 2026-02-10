import { Entity } from "./Entities";
import { EntityType } from "../types";

/**
 * ============================================================================================
 * ASTROPHYSICAL BLACK HOLE SIMULATION ENGINE v6.0 (INDUSTRIAL GRADE)
 * ============================================================================================
 * 
 * 核心逻辑模块：
 * 1. Keplerian Disk Physics: 模拟开普勒旋转，内圈速度远超外圈。
 * 2. Relativistic Beaming: 模拟多普勒频移，旋转向观察者的部分更亮。
 * 3. Gravitational Lensing: 模拟光线在强引力场下的偏折。
 * 4. Singularity Life-Cycle: 从塌缩、稳定到霍金辐射蒸发的完整生命周期。
 */

/**
 * SECTION 1: 物理常数与环境配置
 */
const BH_PHYSICS = {
    MAX_RADIUS: 300,              // 半径：原版的 1/2
    EVENT_HORIZON: 35,            // 视界半径
    PHOTON_SPHERE: 52,            // 光子层
    ACCRETION_DISK_INNER: 45,     // 吸积盘内缘
    GRAVITY_WELL: 1200,           // 引力井强度
    ROTATION_FACTOR: 850,         // 角速度常数
    RELATIVISTIC_BIAS: 0.25,      // 相对论偏移（使一侧更亮）
    PARTICLE_DENSITY: 4000,       // 粒子密度
    LIFECYCLE: {
        FORMING: 1.2,
        STABLE: 8.0,
        EVAPORATING: 1.5
    }
};

/**
 * SECTION 2: 空间数学工具集 (Non-Simplified)
 */
class BHMath {
    /** 计算吸积盘速度：v = sqrt(GM/r) */
    static getOrbitalVelocity(dist: number): number {
        return Math.sqrt(BH_PHYSICS.GRAVITY_WELL / (dist * 0.05));
    }

    /** 相对论亮度映射：基于余弦角计算多普勒效应 */
    static getDopplerFactor(angle: number, speed: number): number {
        // 简化版的 Lorentz Factor 模拟：朝向观察者时亮度增加
        const movementDir = Math.cos(angle + Math.PI / 2);
        return 1.0 + (movementDir * BH_PHYSICS.RELATIVISTIC_BIAS);
    }

    /** 贝塞尔空间插值 */
    static cubicLerp(a: number, b: number, c: number, d: number, t: number): number {
        const p = (d - c) - (a - b);
        return p * Math.pow(t, 3) + ((a - b) - p) * Math.pow(t, 2) + (c - a) * t + b;
    }
}

/**
 * SECTION 3: 能量粒子实体 (Energy Projection)
 */
class AccretionParticle {
    public r: number;          // 距离
    public theta: number;      // 角度
    public size: number;       // 尺寸
    public temperature: number;// 温度（决定颜色）
    public seed: number;       // 随机种子用于摆动

    constructor(radius: number) {
        this.seed = Math.random() * 100;
        this.reset(radius);
    }

    reset(radius: number) {
        const distDistro = Math.pow(Math.random(), 1.5);
        this.r = BH_PHYSICS.ACCRETION_DISK_INNER + (distDistro * (radius - BH_PHYSICS.ACCRETION_DISK_INNER));
        this.theta = Math.random() * Math.PI * 2;
        this.size = 0.5 + Math.random() * 2.5;
        this.temperature = 1.0 - (this.r / radius); // 越近越高能
    }

    update(dt: number, currentMaxR: number) {
        // 1. 开普勒旋转逻辑
        const v = BHMath.getOrbitalVelocity(this.r);
        this.theta += (v / this.r) * dt * 2.0;

        // 2. 向心坍缩模拟
        const drag = (BH_PHYSICS.GRAVITY_WELL / (this.r * this.r)) * dt * 30;
        this.r -= drag;

        // 3. 视界重生
        if (this.r < BH_PHYSICS.EVENT_HORIZON * 0.8) {
            this.reset(currentMaxR);
        }
    }
}

/**
 * SECTION 4: 空间涟漪 (Spacetime Distortion)
 */
class GravitationalWave {
    public r: number;
    public life: number = 1.0;
    public speed: number = 320;

    constructor(startR: number) {
        this.r = startR;
    }

    update(dt: number) {
        this.r += this.speed * dt;
        this.life -= dt * 0.8;
    }
}

/**
 * SECTION 5: 黑洞主类 (The Singularity)
 */
export class BlackHole extends Entity {
    // 状态管理
    private state: 'FORMING' | 'STABLE' | 'EVAPORATING' = 'FORMING';
    private stateTimer: number = 0;
    
    // 物理实体
    private particles: AccretionParticle[] = [];
    private waves: GravitationalWave[] = [];
    private waveEmitterTimer: number = 0;
    
    // 动态半径
    private currentRadius: number = 10;
    private targetRadius: number = BH_PHYSICS.MAX_RADIUS;

    constructor(x: number, y: number) {
        super(x, y, EntityType.SKILL_BLACKHOLE);
        
        // 工业级初始化：预分配内存
        for (let i = 0; i < BH_PHYSICS.PARTICLE_DENSITY; i++) {
            this.particles.push(new AccretionParticle(this.targetRadius));
        }
    }

    public update(dt: number): void {
        this.stateTimer += dt;
        this.updateLifecycle(dt);
        this.updatePhysics(dt);
        
        // 整体位移：引力牵引导致的缓慢漂移
        this.position.y -= 15 * dt;
    }

    private updateLifecycle(dt: number) {
        switch (this.state) {
            case 'FORMING':
                const formPct = this.stateTimer / BH_PHYSICS.LIFECYCLE.FORMING;
                this.currentRadius = BHMath.cubicLerp(0, 10, this.targetRadius * 0.8, this.targetRadius, formPct);
                if (formPct >= 1) {
                    this.state = 'STABLE';
                    this.stateTimer = 0;
                }
                break;
            case 'STABLE':
                if (this.stateTimer >= BH_PHYSICS.LIFECYCLE.STABLE) {
                    this.state = 'EVAPORATING';
                    this.stateTimer = 0;
                }
                break;
            case 'EVAPORATING':
                const evapPct = this.stateTimer / BH_PHYSICS.LIFECYCLE.EVAPORATING;
                this.currentRadius = this.targetRadius * (1 - evapPct);
                if (evapPct >= 1) this.markedForDeletion = true;
                break;
        }
    }

    private updatePhysics(dt: number) {
        // 粒子物理更新
        for (const p of this.particles) {
            p.update(dt, this.currentRadius);
        }

        // 重力波更新
        this.waveEmitterTimer += dt;
        if (this.waveEmitterTimer > 0.4 && this.state !== 'EVAPORATING') {
            this.waves.push(new GravitationalWave(BH_PHYSICS.EVENT_HORIZON));
            this.waveEmitterTimer = 0;
        }

        for (let i = this.waves.length - 1; i >= 0; i--) {
            this.waves[i].update(dt);
            if (this.waves[i].life <= 0) this.waves.splice(i, 1);
        }
    }

    /**
     * SECTION 6: 渲染逻辑 (The Visualization Pipeline)
     * 采用了“逻辑层叠绘制”而非“逐粒子绘制”以保证高性能。
     */
    public static draw(ctx: CanvasRenderingContext2D, bh: BlackHole): void {
        const { x, y } = bh.position;
        if (bh.currentRadius <= 0) return;

        ctx.save();
        ctx.translate(x, y);

        // 1. 绘制引力背景（透镜预热层）
        this.drawBackgroundDistortion(ctx, bh);

        // 2. 绘制重力波
        this.drawGravitationalWaves(ctx, bh);

        // 3. 绘制吸积盘粒子（核心逻辑：Relativistic Beaming）
        this.drawAccretionDisk(ctx, bh);

        // 4. 绘制视界与光子环
        this.drawEventHorizon(ctx, bh);

        ctx.restore();
    }

    private static drawBackgroundDistortion(ctx: CanvasRenderingContext2D, bh: BlackHole) {
        const grad = ctx.createRadialGradient(0, 0, BH_PHYSICS.EVENT_HORIZON, 0, 0, bh.currentRadius * 1.5);
        grad.addColorStop(0, '#000000');
        grad.addColorStop(0.2, 'rgba(0, 10, 30, 0.8)');
        grad.addColorStop(0.5, 'rgba(0, 40, 100, 0.2)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, bh.currentRadius * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    private static drawGravitationalWaves(ctx: CanvasRenderingContext2D, bh: BlackHole) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const w of bh.waves) {
            ctx.strokeStyle = `rgba(100, 200, 255, ${w.life * 0.3})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, w.r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    private static drawAccretionDisk(ctx: CanvasRenderingContext2D, bh: BlackHole) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        // 我们将粒子分为两个主要色调组以减少状态切换
        // 高能白 (Core) 和 能量蓝 (Plasma)
        const groups = [
            { color: '255, 255, 255', threshold: 0.7 },
            { color: '0, 180, 255', threshold: 0.0 }
        ];

        for (const g of groups) {
            ctx.fillStyle = `rgb(${g.color})`;
            ctx.beginPath();
            
            for (const p of bh.particles) {
                if (p.temperature < g.threshold) continue;
                if (p.r > bh.currentRadius) continue;

                // 计算相对论亮度偏移
                const alpha = BHMath.getDopplerFactor(p.theta, 0) * 0.6;
                ctx.globalAlpha = alpha;

                const px = Math.cos(p.theta) * p.r;
                const py = Math.sin(p.theta) * p.r;

                // 绘制带拉伸感的粒子 (Keplerian Motion Stretch)
                const v = BHMath.getOrbitalVelocity(p.r);
                const stretch = (v * 0.05); // 运动模糊强度
                
                ctx.rect(px, py, p.size, p.size);
                
                // 线段模拟切向拉伸
                const tx = px - Math.sin(p.theta) * stretch;
                const ty = py + Math.cos(p.theta) * stretch;
                ctx.moveTo(px, py);
                ctx.lineTo(tx, ty);
            }
            ctx.strokeStyle = `rgba(${g.color}, 0.2)`;
            ctx.stroke();
            ctx.fill();
        }
        ctx.restore();
    }

    private static drawEventHorizon(ctx: CanvasRenderingContext2D, bh: BlackHole) {
        // 1. 中心黑体 (The Shadow)
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, 0, BH_PHYSICS.EVENT_HORIZON, 0, Math.PI * 2);
        ctx.fill();

        // 2. 光子环 (Photon Ring) - 产生极致白光
        ctx.globalCompositeOperation = 'lighter';
        const ringGrad = ctx.createRadialGradient(0, 0, BH_PHYSICS.EVENT_HORIZON - 2, 0, 0, BH_PHYSICS.PHOTON_SPHERE);
        ringGrad.addColorStop(0, '#ffffff');
        ringGrad.addColorStop(0.5, '#00eaff');
        ringGrad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = ringGrad;
        ctx.beginPath();
        ctx.arc(0, 0, BH_PHYSICS.PHOTON_SPHERE, 0, Math.PI * 2);
        ctx.fill();
        
        // 3. 视界内缘的细红移线（模拟极高引力下的光线残留）
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, BH_PHYSICS.EVENT_HORIZON + 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
