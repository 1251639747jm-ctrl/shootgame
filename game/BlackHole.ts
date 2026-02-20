import { Entity } from "./Entities";
import { EntityType } from "../types";

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
        // --- 核心改动：极致压缩分布半径 ---
        const r = Math.random();
        // 指数调小 (0.8)，让更多粒子挤在内圈
        const distributionCurve = Math.pow(r, 0.8); 
        
        const horizonRadius = 45; 
        // 这里的 120 决定了吸积盘的宽度，只保留中心明亮区
        const diskWidth = 120; 
        
        this.distance = horizonRadius + 2 + (distributionCurve * diskWidth);
        this.angle = Math.random() * Math.PI * 2;
        
        // 极高转速，模拟中心高能区
        const angularFactor = 550; 
        this.speed = (angularFactor / this.distance) * (0.8 + Math.random() * 0.4);
        
        this.size = (Math.random() * 1.8) + 0.6;
        this.wobblePhase = Math.random() * Math.PI * 2;
        this.wobbleSpeed = Math.random() * 2 + 1;

        // --- 核心改动：仅保留蓝白高亮色系 ---
        const distNorm = (this.distance - horizonRadius) / diskWidth;
        
        if (distNorm < 0.25) {
            // 最内圈：纯净白光
            this.color = '255, 255, 255'; 
            this.targetAlpha = 0.9 + Math.random() * 0.1;
        } else if (distNorm < 0.7) {
            // 中圈：亮青色 (Vibrant Cyan)
            this.color = Math.random() > 0.4 ? '100, 240, 255' : '50, 180, 255';
            this.targetAlpha = 0.8 + Math.random() * 0.2;
        } else {
            // 外圈过渡：深蓝色 (Deep Blue)
            this.color = '30, 100, 255';
            this.targetAlpha = 0.4 + Math.random() * 0.4;
        }
        
        this.alpha = startFullAlpha ? this.targetAlpha : 0;
    }

    update(dt: number, maxRadius: number) {
        this.angle += this.speed * dt; 
        this.wobblePhase += this.wobbleSpeed * dt;
        
        // 极强的中心吸力
        const suction = (2200 / this.distance);
        this.distance -= suction * dt; 
        
        if (this.alpha < this.targetAlpha) {
            this.alpha += dt * 2.0; 
        }

        // 越过视界后重生
        if (this.distance < 42) {
            this.reset(maxRadius, false);
        }
    }
}

/**
 * 空间涟漪 (微弱的扰动效果)
 */
class SpaceRipple {
    radius: number;
    maxRadius: number;
    life: number;
    maxLife: number;

    constructor(startRadius: number) {
        this.radius = startRadius;
        this.maxRadius = startRadius + 200;
        this.life = 1.0;
        this.maxLife = 1.0;
    }

    update(dt: number) {
        this.radius += 300 * dt; 
        this.life -= dt * 1.2;
    }
}

export class BlackHole extends Entity {
    life: number = 8.0; 
    
    // --- 整体半径缩小，聚焦中心 ---
    maxRadius: number = 220; 
    pullRadius: number = 400; 
    eventHorizonRadius: number = 45;
    
    particles: BHParticle[] = [];
    // 维持 15000 个粒子，在更小的空间内会显得非常明亮
    particleCount: number = 15000; 
    
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
            if (this.radius < this.maxRadius * 0.8) {
                this.radius += dt * 250;
            }
            
            this.life -= dt;
            if (this.life <= 0) {
                this.isDespawning = true;
            }
        } else {
            this.despawnTimer += dt;
            this.radius -= dt * 400;
            if (this.despawnTimer > 1.0) {
                this.markedForDeletion = true;
            }
        }
        
        const currentMaxR = this.isDespawning ? this.maxRadius * (1 - this.despawnTimer) : this.maxRadius;
        for (const p of this.particles) {
            p.update(dt, currentMaxR);
        }

        this.rippleTimer += dt;
        if (this.rippleTimer > 0.5 && !this.isDespawning) { 
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

        this.position.y -= 3 * dt; 
    }

    static draw(ctx: CanvasRenderingContext2D, bh: BlackHole) {
        const { x, y } = bh.position;
        
        let scale = 1.0;
        if (bh.spawnInTimer < 1.0) scale = Math.pow(bh.spawnInTimer, 0.5);
        if (bh.isDespawning) scale = Math.max(0, 1.0 - bh.despawnTimer);
        
        if (scale <= 0.01) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        // --- LAYER 1: 中心背景阴影 (缩小范围) ---
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        const lensRadius = bh.eventHorizonRadius * 3;
        const lensGrad = ctx.createRadialGradient(0, 0, bh.eventHorizonRadius, 0, 0, lensRadius);
        lensGrad.addColorStop(0, '#000000'); 
        lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = lensGrad;
        ctx.beginPath();
        ctx.arc(0, 0, lensRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // --- LAYER 2: 极亮吸积盘旋涡 ---
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        // 环境光晕也缩小，聚集在中心
        const baseGlow = ctx.createRadialGradient(0, 0, bh.eventHorizonRadius, 0, 0, bh.maxRadius);
        baseGlow.addColorStop(0, 'rgba(0, 100, 255, 0.4)');
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
            
            // 绘制粒子
            ctx.fillRect(xPos, yPos, p.size, p.size);
            
            // 短而密集的旋转拖尾
            if (p.distance < 180) {
                const trailAlpha = p.alpha * 0.4;
                ctx.strokeStyle = `rgba(${p.color}, ${trailAlpha})`;
                ctx.lineWidth = p.size;
                ctx.beginPath();
                ctx.moveTo(xPos, yPos);
                
                // 固定短拖尾长度，产生类似“拉丝”的液体质感
                const trailLen = 12; 
                const tx = xPos - Math.sin(p.angle) * trailLen; 
                const ty = yPos + Math.cos(p.angle) * trailLen;
                
                ctx.lineTo(tx, ty);
                ctx.stroke();
            }
        }
        ctx.restore();

        // --- LAYER 3: 事件视界 (黑洞本体) ---
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        
        ctx.fillStyle = '#000000';
        ctx.shadowColor = '#0088ff';
        ctx.shadowBlur = 15; 
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 强光光子环 (Photon Ring)
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 0;
        
        // 核心蓝环
        ctx.strokeStyle = '#0ea5e9';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius + 1, 0, Math.PI * 2);
        ctx.stroke();
        
        // 极细白环 (最亮边缘)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius - 0.5, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
        ctx.restore();
    }
}
