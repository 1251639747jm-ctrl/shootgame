import { Entity } from "./Entities";
import { EntityType } from "../types";

/**
 * 极致密度粒子：通过长线段模拟连续的等离子体流
 */
class BHParticle {
    angle: number;
    distance: number;
    speed: number;
    size: number;
    color: string;
    alpha: number;
    targetAlpha: number;
    // 保留扰动，增加细节
    wobblePhase: number;
    wobbleSpeed: number;
    
    constructor(maxRadius: number) {
        this.reset(maxRadius, true);
    }

    reset(maxRadius: number, startFullAlpha: boolean = false) {
        const r = Math.random();
        // 极致分布：2.5 的指数让物质高度集中在视界周围，形成厚实的内盘
        const distributionCurve = Math.pow(r, 2.5); 
        
        const horizonRadius = 45; 
        const diskWidth = maxRadius - horizonRadius;
        
        this.distance = horizonRadius + 2 + (distributionCurve * diskWidth);
        this.angle = Math.random() * Math.PI * 2;
        
        // 高速旋转：保底转速 + 幂律衰减
        const innerStrength = 150; 
        const baseRotation = 1.5; 
        this.speed = (innerStrength / Math.pow(this.distance, 0.6)) + baseRotation;
        this.speed *= (0.85 + Math.random() * 0.3);
        
        this.size = Math.random() * 1.5 + 0.5;
        this.wobblePhase = Math.random() * Math.PI * 2;
        this.wobbleSpeed = Math.random() * 2;

        // 全蓝色系：高能电荷蓝
        const bluePool = ['80, 180, 255', '150, 220, 255', '40, 100, 255'];
        this.color = bluePool[Math.floor(Math.random() * bluePool.length)];
        
        // 边缘粒子更透明，内圈粒子更浓厚
        const distNorm = (this.distance - horizonRadius) / diskWidth;
        this.targetAlpha = (1.0 - distNorm * 0.8) * (0.5 + Math.random() * 0.5);
        this.alpha = startFullAlpha ? this.targetAlpha : 0;
    }

    update(dt: number, maxRadius: number) {
        this.angle += this.speed * dt; 
        this.wobblePhase += this.wobbleSpeed * dt;
        
        // 强力向心坍缩
        const suction = (2200 / this.distance);
        this.distance -= suction * dt; 
        
        if (this.alpha < this.targetAlpha) {
            this.alpha += dt * 2.0; 
        }

        if (this.distance < 44) {
            this.reset(maxRadius, false);
        }
    }
}

/**
 * 空间涟漪效果（保留）
 */
class SpaceRipple {
    radius: number;
    maxRadius: number;
    life: number;
    constructor(startRadius: number) {
        this.radius = startRadius;
        this.maxRadius = startRadius + 600;
        this.life = 1.0;
    }
    update(dt: number) {
        this.radius += 300 * dt; 
        this.life -= dt * 0.7;
    }
}

export class BlackHole extends Entity {
    // --- 完整状态系统 ---
    life: number = 10.0; 
    maxRadius: number = 600; 
    eventHorizonRadius: number = 48;
    
    particles: BHParticle[] = [];
    particleCount: number = 18000; // 极致密度
    
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
        // --- 完整生命周期逻辑 ---
        if (!this.isDespawning) {
            this.spawnInTimer += dt;
            if (this.radius < this.maxRadius * 0.7) this.radius += dt * 200;
            this.life -= dt;
            if (this.life <= 0) this.isDespawning = true;
        } else {
            this.despawnTimer += dt;
            this.radius -= dt * 300;
            if (this.despawnTimer > 1.2) this.markedForDeletion = true;
        }
        
        const currentMaxR = this.isDespawning ? this.maxRadius * (1 - this.despawnTimer) : this.maxRadius;
        for (const p of this.particles) {
            p.update(dt, currentMaxR);
        }

        // 涟漪逻辑
        this.rippleTimer += dt;
        if (this.rippleTimer > 0.4 && !this.isDespawning) { 
            this.rippleTimer = 0;
            this.ripples.push(new SpaceRipple(this.eventHorizonRadius));
        }
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            this.ripples[i].update(dt);
            if (this.ripples[i].life <= 0) this.ripples.splice(i, 1);
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
        const lensRadius = bh.maxRadius * 1.5;
        const lensGrad = ctx.createRadialGradient(0, 0, bh.eventHorizonRadius, 0, 0, lensRadius);
        lensGrad.addColorStop(0, '#000000'); 
        lensGrad.addColorStop(0.3, 'rgba(0, 10, 35, 0.95)');
        lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = lensGrad;
        ctx.beginPath();
        ctx.arc(0, 0, lensRadius, 0, Math.PI * 2);
        ctx.fill();
        
        for (const rip of bh.ripples) {
            ctx.strokeStyle = `rgba(100, 160, 255, ${rip.life * 0.2})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, rip.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();

        // --- LAYER 2: 极致密度等离子体 ---
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        for (let i = 0; i < bh.particles.length; i++) {
            const p = bh.particles[i];
            if (p.alpha <= 0.05) continue;

            const xPos = Math.cos(p.angle) * p.distance;
            const yPos = Math.sin(p.angle) * p.distance;

            // 多普勒效应：模拟一侧更亮
            const cos = Math.cos(p.angle);
            const sideBrightness = 0.5 + (cos < 0 ? Math.abs(cos) * 0.7 : 0);

            ctx.strokeStyle = `rgba(${p.color}, ${p.alpha * sideBrightness})`;
            ctx.lineWidth = p.size;
            
            // 绘制极长连线，消除粒子感
            const lineLen = p.speed * p.distance * 0.08; 
            
            ctx.beginPath();
            ctx.moveTo(xPos, yPos);
            const tx = xPos - Math.sin(p.angle) * lineLen; 
            const ty = yPos + Math.cos(p.angle) * lineLen;
            ctx.lineTo(tx, ty);
            ctx.stroke();
            
            // 增加少量核心亮点，增加“碎屑”质感
            if (i % 20 === 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.3})`;
                ctx.fillRect(xPos, yPos, 1, 1);
            }
        }
        ctx.restore();

        // --- LAYER 3: 事件视界 & 光子环 ---
        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.shadowColor = '#0088ff';
        ctx.shadowBlur = 30; 
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.9)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius + 1, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius - 1, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
        ctx.restore();
    }
}
