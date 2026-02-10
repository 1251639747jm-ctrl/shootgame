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
        // 分布逻辑：降低指数（从3.0降至1.8），使粒子更均匀地分布在广阔的盘面上
        const r = Math.random();
        const distributionCurve = Math.pow(r, 1.8); 
        
        const horizonRadius = 45; 
        const diskWidth = maxRadius - horizonRadius;
        
        this.distance = horizonRadius + 5 + (distributionCurve * diskWidth);
        this.angle = Math.random() * Math.PI * 2;
        
        // 角速度逻辑：增加 angularFactor (200 -> 450) 确保外圈也有明显的旋转感
        const angularFactor = 450; 
        this.speed = (angularFactor / this.distance) * (0.8 + Math.random() * 0.4);
        
        // 尺寸：内圈粒子更细碎，模拟高能射线
        this.size = (Math.random() * 1.6) + (this.distance > 250 ? 1.0 : 0.5);
        
        this.wobblePhase = Math.random() * Math.PI * 2;
        this.wobbleSpeed = Math.random() * 2 + 1;

        // --- 核心：蓝色吸积盘颜色分布优化 ---
        const distNorm = (this.distance - horizonRadius) / diskWidth;
        
        if (distNorm < 0.08) {
            // 视界边缘：极致白光
            this.color = '255, 255, 255'; 
            this.targetAlpha = 0.95 + Math.random() * 0.05;
        } else if (distNorm < 0.55) {
            // 蓝色漩涡区：扩大了范围 (从0.25扩到0.55)
            // 混合使用深天蓝和亮青色
            this.color = Math.random() > 0.3 ? '50, 180, 255' : '100, 240, 255';
            this.targetAlpha = 0.8 + Math.random() * 0.2;
        } else if (distNorm < 0.8) {
            // 中间过渡带：蓝金交替
            this.color = Math.random() > 0.7 ? '150, 200, 255' : '200, 180, 100';
            this.targetAlpha = 0.5 + Math.random() * 0.3;
        } else {
            // 边缘区：暗红色散
            this.color = '180, 60, 40';
            this.targetAlpha = 0.3 + Math.random() * 0.3;
        }
        
        this.alpha = startFullAlpha ? this.targetAlpha : 0;
    }

    update(dt: number, maxRadius: number) {
        this.angle += this.speed * dt; 
        this.wobblePhase += this.wobbleSpeed * dt;
        
        // 吸引力物理：离中心越近吸力指数级增强
        const suction = (1800 / this.distance);
        this.distance -= suction * dt; 
        
        if (this.alpha < this.targetAlpha) {
            this.alpha += dt * 2.0; 
        }

        // 越过事件视界后重生
        if (this.distance < 40) {
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
        this.radius += 250 * dt; 
        this.life -= dt * 0.7;
    }
}

export class BlackHole extends Entity {
    life: number = 10.0; 
    
    // --- 扩大半径参数 ---
    maxRadius: number = 600; 
    pullRadius: number = 900; 
    eventHorizonRadius: number = 45;
    
    particles: BHParticle[] = [];
    particleCount: number = 15000; // 增加粒子数量以维持大面积下的密度
    
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

        this.position.y -= 5 * dt; // 缓慢向上漂移
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

        // --- LAYER 1: 空间扭曲背景 (引力透镜效果) ---
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        const lensRadius = bh.maxRadius * 1.5;
        const lensGrad = ctx.createRadialGradient(0, 0, bh.eventHorizonRadius, 0, 0, lensRadius);
        lensGrad.addColorStop(0, '#000000'); 
        lensGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.9)');
        lensGrad.addColorStop(0.7, 'rgba(10, 20, 40, 0.3)');
        lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = lensGrad;
        ctx.beginPath();
        ctx.arc(0, 0, lensRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 空间涟漪
        ctx.lineWidth = 2;
        for (const rip of bh.ripples) {
            const alpha = rip.life * 0.25;
            ctx.strokeStyle = `rgba(100, 150, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(0, 0, rip.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();

        // --- LAYER 2: 核心蓝色吸积盘 ---
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        // 底层的环境光
        const baseGlow = ctx.createRadialGradient(0, 0, bh.eventHorizonRadius, 0, 0, bh.maxRadius);
        baseGlow.addColorStop(0, 'rgba(0, 80, 255, 0.3)');
        baseGlow.addColorStop(0.5, 'rgba(0, 20, 100, 0.1)');
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
            
            // 优化：根据粒子大小选择绘制方式
            if (p.size < 1.8) {
                ctx.fillRect(xPos, yPos, p.size, p.size);
            } else {
                ctx.beginPath();
                ctx.arc(xPos, yPos, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // --- 关键：扩大后的旋转纹理线 ---
            // 将判定范围从 70 扩大到 350
            if (p.distance < 350) {
                const trailAlpha = p.alpha * (1 - (p.distance / 350)) * 0.5;
                ctx.strokeStyle = `rgba(${p.color}, ${trailAlpha})`;
                ctx.lineWidth = p.size * 0.8;
                ctx.beginPath();
                ctx.moveTo(xPos, yPos);
                
                // 增加拖尾长度随旋转速度变化的逻辑
                const trailLen = (300 / p.distance) * 10; 
                const tx = xPos - Math.sin(p.angle) * trailLen; 
                const ty = yPos + Math.cos(p.angle) * trailLen;
                
                ctx.lineTo(tx, ty);
                ctx.stroke();
            }
        }
        ctx.restore();

        // --- LAYER 3: 事件视界 (中心黑体) ---
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        
        // 黑洞中心
        ctx.fillStyle = '#000000';
        ctx.shadowColor = '#0066ff';
        ctx.shadowBlur = 20; 
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 视界边缘的强光环 (Photon Ring)
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 0;
        
        // 蓝色外发光
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
