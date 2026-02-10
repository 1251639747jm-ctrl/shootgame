import { Entity } from "./Entities";
import { EntityType } from "../types";

/**
 * HELPER CLASS: Black Hole Particle
 * 经过深度优化的全蓝色系粒子，支持高速外圈旋转
 */
class BHParticle {
    angle: number;
    distance: number;
    speed: number;
    size: number;
    color: string;
    alpha: number;
    targetAlpha: number;
    wobblePhase: number;
    wobbleSpeed: number;
    
    constructor(maxRadius: number) {
        this.reset(maxRadius, true);
    }

    reset(maxRadius: number, startFullAlpha: boolean = false) {
        const r = Math.random();
        // 分布曲线：1.8 使得粒子在广阔的盘面上分布更均匀
        const distributionCurve = Math.pow(r, 1.8); 
        
        const horizonRadius = 45; 
        const diskWidth = maxRadius - horizonRadius;
        
        this.distance = horizonRadius + 5 + (distributionCurve * diskWidth);
        this.angle = Math.random() * Math.PI * 2;
        
        // --- 核心修改：不影响内部速度的情况下加大外围速度 ---
        // 使用幂函数衰减 (0.6次方) 代替线性衰减，并增加保底转速 (1.2)
        const innerStrength = 130; 
        const baseRotation = 1.2; 
        this.speed = (innerStrength / Math.pow(this.distance, 0.6)) + baseRotation;
        
        // 加入随机扰动，让粒子层级感更强
        this.speed *= (0.8 + Math.random() * 0.4);
        
        // 尺寸：内圈粒子细小，外圈粒子稍大增加填充感
        this.size = (Math.random() * 1.5) + (this.distance > 300 ? 1.0 : 0.4);
        
        this.wobblePhase = Math.random() * Math.PI * 2;
        this.wobbleSpeed = Math.random() * 2 + 1;

        // --- 全蓝色系逻辑 ---
        const distNorm = (this.distance - horizonRadius) / diskWidth;
        const bluePool = [
            '50, 160, 255',   // 电光蓝
            '80, 200, 255',   // 亮青蓝
            '120, 230, 255',  // 极亮蓝
            '40, 90, 230'     // 深空蓝
        ];
        
        this.color = bluePool[Math.floor(Math.random() * bluePool.length)];
        
        // 越靠近中心透明度越高（越浓厚）
        this.targetAlpha = (1.0 - distNorm * 0.6) * (0.6 + Math.random() * 0.4);
        this.alpha = startFullAlpha ? this.targetAlpha : 0;
    }

    update(dt: number, maxRadius: number) {
        // 旋转更新
        this.angle += this.speed * dt; 
        
        // 吸入物理：向心吸力
        const suction = (1800 / this.distance);
        this.distance -= suction * dt; 
        
        if (this.alpha < this.targetAlpha) {
            this.alpha += dt * 2.0; 
        }

        // 越过视界重生
        if (this.distance < 42) {
            this.reset(maxRadius, false);
        }
    }
}

/**
 * HELPER CLASS: Spacetime Ripple
 */
class SpaceRipple {
    radius: number;
    maxRadius: number;
    life: number;
    maxLife: number;

    constructor(startRadius: number) {
        this.radius = startRadius;
        this.maxRadius = startRadius + 600;
        this.life = 1.0;
        this.maxLife = 1.0;
    }

    update(dt: number) {
        this.radius += 280 * dt; 
        this.life -= dt * 0.7;
    }
}

export class BlackHole extends Entity {
    life: number = 10.0; 
    
    // --- 超大半径参数 ---
    maxRadius: number = 600; 
    pullRadius: number = 1000; 
    eventHorizonRadius: number = 45;
    
    particles: BHParticle[] = [];
    particleCount: number = 15000; // 高密度粒子
    
    ripples: SpaceRipple[] = [];
    rippleTimer: number = 0;
    
    spawnInTimer: number = 0;
    despawnTimer: number = 0;
    isDespawning: boolean = false;
    
    constructor(x: number, y: number) {
        super(x, y, EntityType.SKILL_BLACKHOLE);
        this.radius = 10; 
        
        for(let i=0; i<this.particleCount; i++) {
            this.particles.push(new BHParticle(this.maxRadius));
        }
    }

    update(dt: number) {
        if (!this.isDespawning) {
            this.spawnInTimer += dt;
            if (this.radius < this.maxRadius * 0.7) {
                this.radius += dt * 200;
            }
            
            this.life -= dt;
            if (this.life <= 0) {
                this.isDespawning = true;
            }
        } else {
            this.despawnTimer += dt;
            this.radius -= dt * 300;
            if (this.despawnTimer > 1.2) {
                this.markedForDeletion = true;
            }
        }
        
        const currentMaxR = this.isDespawning ? this.maxRadius * (1 - this.despawnTimer) : this.maxRadius;
        for (const p of this.particles) {
            p.update(dt, currentMaxR);
        }

        this.rippleTimer += dt;
        if (this.rippleTimer > 0.4 && !this.isDespawning) { 
            this.rippleTimer = 0;
            this.ripples.push(new SpaceRipple(this.eventHorizonRadius));
        }
        
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.update(dt);
            if (r.life <= 0) {
                this.ripples.splice(i, 1);
            }
        }

        this.position.y -= 5 * dt; // 缓慢漂移
    }

    static draw(ctx: CanvasRenderingContext2D, bh: BlackHole) {
        const { x, y } = bh.position;
        
        let scale = 1.0;
        if (bh.spawnInTimer < 1.0) scale = Math.pow(bh.spawnInTimer, 0.5);
        if (bh.isDespawning) scale = Math.max(0, 1.2 - bh.despawnTimer);
        
        if (scale <= 0.01) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        // --- LAYER 1: 空间背景 & 涟漪 ---
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        const lensRadius = bh.maxRadius * 1.5;
        const lensGrad = ctx.createRadialGradient(0, 0, bh.eventHorizonRadius, 0, 0, lensRadius);
        lensGrad.addColorStop(0, '#000000'); 
        lensGrad.addColorStop(0.3, 'rgba(0, 10, 30, 0.9)');
        lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = lensGrad;
        ctx.beginPath();
        ctx.arc(0, 0, lensRadius, 0, Math.PI * 2);
        ctx.fill();
        
        for (const rip of bh.ripples) {
            ctx.strokeStyle = `rgba(80, 140, 255, ${rip.life * 0.25})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, rip.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();

        // --- LAYER 2: 全蓝色粒子吸积盘 ---
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        // 核心蓝光氛围
        const baseGlow = ctx.createRadialGradient(0, 0, bh.eventHorizonRadius, 0, 0, bh.maxRadius);
        baseGlow.addColorStop(0, 'rgba(0, 120, 255, 0.4)');
        baseGlow.addColorStop(0.7, 'rgba(0, 30, 100, 0.1)');
        baseGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = baseGlow;
        ctx.beginPath();
        ctx.arc(0, 0, bh.maxRadius, 0, Math.PI*2);
        ctx.fill();

        for (const p of bh.particles) {
            if (p.alpha <= 0.05) continue;

            const xPos = Math.cos(p.angle) * p.distance;
            const yPos = Math.sin(p.angle) * p.distance;

            ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
            
            // 绘制粒子主体
            if (p.size < 1.6) {
                ctx.fillRect(xPos, yPos, p.size, p.size);
            } else {
                ctx.beginPath();
                ctx.arc(xPos, yPos, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // 绘制拖尾线 (范围扩大到 550, 且长度随速度动态变化)
            if (p.distance < 550) {
                const trailAlpha = p.alpha * (1 - (p.distance / bh.maxRadius)) * 0.6;
                ctx.strokeStyle = `rgba(${p.color}, ${trailAlpha})`;
                ctx.lineWidth = p.size * 0.8;
                
                // 拖尾长度计算：速度 * 距离因子
                const trailLen = p.speed * p.distance * 0.06; 
                const tx = xPos - Math.sin(p.angle) * trailLen; 
                const ty = yPos + Math.cos(p.angle) * trailLen;
                
                ctx.beginPath();
                ctx.moveTo(xPos, yPos);
                ctx.lineTo(tx, ty);
                ctx.stroke();
            }
        }
        ctx.restore();

        // --- LAYER 3: 视界核心 ---
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        
        ctx.fillStyle = '#000000';
        ctx.shadowColor = '#0088ff';
        ctx.shadowBlur = 25; 
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 蓝色光环
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius + 1, 0, Math.PI * 2);
        ctx.stroke();
        
        // 内部极细白环
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius - 1, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
        ctx.restore();
    }
}
