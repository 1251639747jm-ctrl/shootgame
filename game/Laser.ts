/**
 * Advanced Laser Weapon System
 * Version: 2.0.0
 * 包含了粒子系统、噪声扰动、多阶渲染管线与复杂的物理逻辑
 */

import { Entity } from "./Entities";
import { EntityType, Vector2, WeaponType } from "../types";
import { Player } from "./Entities";

// --- 基础常量定义 ---
const LASER_CONFIG = {
    MAX_LENGTH: 2000,
    DEFAULT_DURATION: 2.5,
    GROWTH_SPEED: 6000,
    BASE_WIDTH: 50,
    PARTICLE_COUNT: 40,
    NOISE_STEPS: 12,
    ARC_STIFFNESS: 0.4,
    SHAKE_INTENSITY: 5,
    HEAT_INCREMENT: 0.1
};

// --- 1. 高级数学与噪声工具 ---
class LaserMath {
    /**
     * 生成伪随机噪声，用于电弧波动
     */
    static lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    static smoothStep(edge0: number, edge1: number, x: number): number {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    }

    /**
     * 获取激光束上的扰动偏移
     */
    static getNoise(seed: number, octaves: number): number {
        let result = 0;
        let amp = 1;
        let freq = 1;
        for (let i = 0; i < octaves; i++) {
            result += Math.sin(seed * freq) * amp;
            amp *= 0.5;
            freq *= 2.1;
        }
        return result;
    }
}

// --- 2. 内部粒子系统 ---
interface LaserParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    color: string;
    type: 'spark' | 'smoke' | 'plasma';
}

class ParticleController {
    particles: LaserParticle[] = [];

    spawn(x: number, y: number, angle: number, type: 'spark' | 'plasma') {
        const speed = Math.random() * 500 + 200;
        const spread = type === 'spark' ? 0.8 : 0.2;
        const finalAngle = angle + (Math.random() - 0.5) * spread;

        this.particles.push({
            x, y,
            vx: Math.cos(finalAngle) * speed,
            vy: Math.sin(finalAngle) * speed,
            life: 1.0,
            maxLife: 0.5 + Math.random() * 0.5,
            size: Math.random() * 5 + 2,
            color: type === 'spark' ? '#00ffff' : '#ffffff',
            type
        });
    }

    update(dt: number) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt / p.maxLife;
            p.vx *= 0.95; // 阻尼
            p.vy *= 0.95;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.particles) {
            const alpha = p.life;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// --- 3. 激光核心类 ---
export enum LaserState {
    IDLE,
    WARMUP,   // 预热阶段
    FIRING,   // 满功率发射
    COOLING,  // 结束消散
    OVERHEAT  // 过热惩罚
}

export class Laser extends Entity {
    // 基础引用
    owner: Player;
    
    // 状态控制
    state: LaserState = LaserState.WARMUP;
    elapsed: number = 0;
    duration: number = LASER_CONFIG.DEFAULT_DURATION;
    
    // 物理属性
    length: number = 0;
    targetLength: number = LASER_CONFIG.MAX_LENGTH;
    width: number = 0;
    heat: number = 0;
    
    // 视觉控制
    pulsePhase: number = 0;
    jitterAmount: number = 0;
    particleSystem: ParticleController;
    
    // 骨架电弧点 (用于动态贝塞尔计算)
    arcPoints: Vector2[] = [];

    constructor(owner: Player) {
        // 计算发射起始点 (玩家飞船头部)
        const noseOffset = 45;
        const startX = owner.position.x + Math.sin(owner.rotation) * noseOffset;
        const startY = owner.position.y - Math.cos(owner.rotation) * noseOffset;
        
        super(startX, startY, EntityType.WEAPON_LASER);
        
        this.owner = owner;
        this.particleSystem = new ParticleController();
        this.initArcPoints();
        
        // 初始化伤害逻辑
        (this as any).damage = 50; 
    }

    private initArcPoints() {
        for (let i = 0; i < 10; i++) {
            this.arcPoints.push({ x: 0, y: 0 });
        }
    }

    /**
     * 核心逻辑更新循环
     */
    update(dt: number) {
        if (!this.checkOwnerValidity()) return;

        this.elapsed += dt;
        this.updatePosition();
        this.updateStateLogic(dt);
        this.updatePhysicalEffects(dt);
        this.particleSystem.update(dt);
        
        // 动态碰撞半径
        this.radius = this.width * 0.75;
    }

    private checkOwnerValidity(): boolean {
        if (this.owner.markedForDeletion) {
            this.markedForDeletion = true;
            return false;
        }
        return true;
    }

    /**
     * 同步玩家位置与角度
     */
    private updatePosition() {
        const offset = 45;
        this.position.x = this.owner.position.x + Math.sin(this.owner.rotation) * offset;
        this.position.y = this.owner.position.y - Math.cos(this.owner.rotation) * offset;
        this.rotation = this.owner.rotation;
    }

    /**
     * 处理激光的不同阶段生命周期
     */
    private updateStateLogic(dt: number) {
        const levelFactor = 1 + (this.owner.level * 0.15);
        const baseWidth = LASER_CONFIG.BASE_WIDTH * levelFactor;

        switch (this.state) {
            case LaserState.WARMUP:
                this.handleWarmup(dt, baseWidth);
                break;
            case LaserState.FIRING:
                this.handleFiring(dt, baseWidth);
                break;
            case LaserState.COOLING:
                this.handleCooling(dt);
                break;
        }
    }

    private handleWarmup(dt: number, targetWidth: number) {
        // 预热阶段：激光快速伸长，宽度从0到70%
        const warmupTime = 0.2;
        if (this.elapsed < warmupTime) {
            this.length += LASER_CONFIG.GROWTH_SPEED * dt;
            this.width = LaserMath.lerp(0, targetWidth * 0.7, this.elapsed / warmupTime);
        } else {
            this.state = LaserState.FIRING;
        }
        
        if (this.length > this.targetLength) this.length = this.targetLength;
    }

    private handleFiring(dt: number, targetWidth: number) {
        // 发射阶段：保持长度，宽度脉动，生成粒子
        this.length = this.targetLength;
        
        // 宽度脉动算法：基础宽度 + 正弦波动 + 随机抖动
        this.pulsePhase += dt * 30;
        const pulse = Math.sin(this.pulsePhase) * 5;
        const jitter = (Math.random() - 0.5) * 3;
        this.width = targetWidth + pulse + jitter;

        // 生成枪口与束流粒子
        if (Math.random() > 0.5) {
            this.particleSystem.spawn(this.position.x, this.position.y, this.rotation - Math.PI / 2, 'spark');
        }

        // 生命周期检查
        if (this.elapsed >= this.duration) {
            this.state = LaserState.COOLING;
        }

        // 震屏反馈逻辑 (假设外部 camera 有 shake 方法)
        if ((window as any).camera) {
            (window as any).camera.shake(LASER_CONFIG.SHAKE_INTENSITY);
        }
    }

    private handleCooling(dt: number) {
        // 冷却阶段：激光变细并迅速消失
        const coolingSpeed = 5.0;
        this.width -= this.width * coolingSpeed * dt;
        this.length *= 0.98;

        if (this.width < 1) {
            this.markedForDeletion = true;
        }
    }

    private updatePhysicalEffects(dt: number) {
        // 更新伤害数值（基于当前宽度，宽度越宽伤害越高）
        (this as any).damage = (this.width / LASER_CONFIG.BASE_WIDTH) * 40 * this.owner.damageMultiplier;
        
        // 更新电弧骨架点
        const time = Date.now() / 1000;
        for (let i = 0; i < this.arcPoints.length; i++) {
            const pct = i / this.arcPoints.length;
            const noise = LaserMath.getNoise(time * 10 + pct * 5, 2);
            this.arcPoints[i].x = noise * 15; // 横向摆动
        }
    }

    // ==========================================
    // 渲染系统：复杂的 Canvas 绘制流程
    // ==========================================

    static draw(ctx: CanvasRenderingContext2D, laser: Laser) {
        if (laser.width <= 0.5) return;

        ctx.save();
        
        // 1. 设置基础坐标系
        ctx.translate(laser.position.x, laser.position.y);
        ctx.rotate(laser.rotation);

        // 2. 启用加法合成模式实现发光效果
        ctx.globalCompositeOperation = 'lighter';

        // 3. 绘制层级
        this.drawOuterGlow(ctx, laser);
        this.drawSecondaryPlasma(ctx, laser);
        this.drawMainBeam(ctx, laser);
        this.drawEnergyCore(ctx, laser);
        this.drawElectricArcs(ctx, laser);
        this.drawInternalTexture(ctx, laser);
        this.drawMuzzleFlare(ctx, laser);
        this.drawImpactPoint(ctx, laser);

        ctx.restore();

        // 4. 独立渲染粒子系统（不受 translate 影响）
        laser.particleSystem.draw(ctx);
    }

    /**
     * 第一层：最外层大面积辉光（蓝/紫色虚影）
     */
    private static drawOuterGlow(ctx: CanvasRenderingContext2D, laser: Laser) {
        const glowWidth = laser.width * 5;
        const grad = ctx.createLinearGradient(-glowWidth/2, 0, glowWidth/2, 0);
        
        grad.addColorStop(0, 'rgba(0, 50, 255, 0)');
        grad.addColorStop(0.3, 'rgba(0, 100, 255, 0.15)');
        grad.addColorStop(0.5, 'rgba(60, 150, 255, 0.25)');
        grad.addColorStop(0.7, 'rgba(0, 100, 255, 0.15)');
        grad.addColorStop(1, 'rgba(0, 50, 255, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(-glowWidth/2, 0, glowWidth, -laser.length);
    }

    /**
     * 第二层：次级等离子体（带扰动的青色边缘）
     */
    private static drawSecondaryPlasma(ctx: CanvasRenderingContext2D, laser: Laser) {
        const w = laser.width * 2.2;
        ctx.save();
        ctx.filter = 'blur(8px)';
        
        const grad = ctx.createLinearGradient(-w/2, 0, w/2, 0);
        grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
        grad.addColorStop(0.5, 'rgba(0, 255, 255, 0.4)');
        grad.addColorStop(1, 'rgba(0, 255, 255, 0)');

        ctx.fillStyle = grad;
        // 增加轻微的左右摆动模拟流体感
        const shift = Math.sin(Date.now() / 100) * 5;
        ctx.fillRect(-w/2 + shift, 0, w, -laser.length);
        ctx.restore();
    }

    /**
     * 第三层：主束流（高饱和度青色）
     */
    private static drawMainBeam(ctx: CanvasRenderingContext2D, laser: Laser) {
        const w = laser.width;
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00ffff';
        
        const grad = ctx.createLinearGradient(-w/2, 0, w/2, 0);
        grad.addColorStop(0, 'rgba(100, 255, 255, 0.9)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(1, 'rgba(100, 255, 255, 0.9)');

        ctx.fillStyle = grad;
        ctx.fillRect(-w/2, 0, w, -laser.length);
        ctx.shadowBlur = 0;
    }

    /**
     * 第四层：核心高能线（纯白，细窄）
     */
    private static drawEnergyCore(ctx: CanvasRenderingContext2D, laser: Laser) {
        const coreW = laser.width * 0.2;
        ctx.fillStyle = '#ffffff';
        ctx.filter = 'blur(2px)';
        ctx.fillRect(-coreW/2, 0, coreW, -laser.length);
        ctx.filter = 'none';
    }

    /**
     * 第五层：动态电弧（不规则闪烁线）
     */
    private static drawElectricArcs(ctx: CanvasRenderingContext2D, laser: Laser) {
        const time = Date.now() / 1000;
        const count = 3;
        
        for (let i = 0; i < count; i++) {
            ctx.beginPath();
            ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,0.8)' : 'rgba(0,255,255,0.4)';
            ctx.lineWidth = 1.5;
            
            ctx.moveTo(0, 0);
            
            const segments = 15;
            const segmentLen = laser.length / segments;
            const phaseOffset = i * Math.PI;
            
            for (let j = 1; j <= segments; j++) {
                const y = -j * segmentLen;
                const xNoise = Math.sin(y * 0.01 + time * 20 + phaseOffset) * (laser.width * 0.6);
                const jitter = (Math.random() - 0.5) * 10;
                ctx.lineTo(xNoise + jitter, y);
            }
            ctx.stroke();
        }
    }

    /**
     * 第六层：内部流体纹理（向上滚动的箭头/能量块）
     */
    private static drawInternalTexture(ctx: CanvasRenderingContext2D, laser: Laser) {
        ctx.save();
        // 剪裁区域限制在激光宽度内
        ctx.beginPath();
        ctx.rect(-laser.width/2, -laser.length, laser.width, laser.length);
        ctx.clip();

        const time = Date.now() / 1000;
        const scrollSpeed = 3000;
        const textureSpacing = 120;
        const offset = (time * scrollSpeed) % textureSpacing;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 3;

        for (let y = 0; y < laser.length + textureSpacing; y += textureSpacing) {
            const currentY = -(y - offset);
            if (currentY > 0 || currentY < -laser.length) continue;

            // 绘制 V 型高能压缩波形
            ctx.beginPath();
            ctx.moveTo(-laser.width * 0.4, currentY + 20);
            ctx.lineTo(0, currentY);
            ctx.lineTo(laser.width * 0.4, currentY + 20);
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * 第七层：枪口火花与爆发点
     */
    private static drawMuzzleFlare(ctx: CanvasRenderingContext2D, laser: Laser) {
        const flareSize = laser.width * 3.5;
        const time = Date.now() / 1000;
        
        // 动态旋转的十字光芒
        ctx.save();
        ctx.rotate(time * 5);
        
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, flareSize);
        grad.addColorStop(0, 'white');
        grad.addColorStop(0.2, 'cyan');
        grad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = grad;
        // 绘制两个交错的长方体形成星芒
        ctx.fillRect(-flareSize, -laser.width/4, flareSize*2, laser.width/2);
        ctx.fillRect(-laser.width/4, -flareSize, laser.width/2, flareSize*2);
        
        ctx.beginPath();
        ctx.arc(0, 0, flareSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * 第八层：末端冲击点（物理撞击感）
     */
    private static drawImpactPoint(ctx: CanvasRenderingContext2D, laser: Laser) {
        if (laser.length < 100) return;

        const impactX = 0;
        const impactY = -laser.length;
        const size = laser.width * (1.5 + Math.random() * 0.5);

        ctx.save();
        ctx.translate(impactX, impactY);
        
        // 冲击波圆环
        ctx.beginPath();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
        ctx.stroke();

        // 核心亮点
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        grad.addColorStop(0, 'white');
        grad.addColorStop(0.4, 'rgba(0, 255, 255, 0.8)');
        grad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ==========================================
    // 额外逻辑：过热系统与交互
    // ==========================================

    /**
     * 计算激光与特定点的交互强度（用于外部调用，如击退敌机）
     */
    public getInteractionForce(targetPos: Vector2): Vector2 | null {
        return null; 
    }

    /**
     * 激光销毁时的残余处理
     */
    public onDestroy() {
        // 触发最终的粒子爆发
        for (let i = 0; i < 20; i++) {
            this.particleSystem.spawn(this.position.x, this.position.y, Math.random() * Math.PI * 2, 'spark');
        }
    }
}
