import { Entity } from "./Entities";
import { EntityType } from "../types";

/**
 * 核心黑洞粒子：专注蓝白高能表现
 */
class BHParticle {
    angle: number;
    distance: number;
    speed: number;
    size: number;
    color: string;
    alpha: number;

    constructor(maxRadius: number) {
        this.reset(maxRadius);
        this.alpha = Math.random();
    }

    reset(maxRadius: number) {
        // 紧凑分布：粒子集中在中心 15 到 120 像素范围内
        this.distance = 15 + Math.random() * (maxRadius - 15);
        this.angle = Math.random() * Math.PI * 2;
        
        // 极高转速：模拟致密天体的吸积速度
        this.speed = (500 / this.distance) * (0.8 + Math.random() * 0.5);
        this.size = 1 + Math.random() * 2;

        // 蓝白配色：越靠近中心越白
        const ratio = this.distance / maxRadius;
        if (ratio < 0.3) {
            this.color = "255, 255, 255"; // 纯白核心
        } else {
            this.color = "0, 240, 255";   // 青蓝色边缘
        }
    }

    update(dt: number, maxRadius: number) {
        this.angle += this.speed * dt;
        // 持续向心力
        this.distance -= (800 / this.distance) * dt;

        if (this.distance < 12) {
            this.reset(maxRadius);
        }
    }
}

export class BlackHole extends Entity {
    life: number = 8.0;
    maxRadius: number = 120; // 显著缩小半径
    eventHorizonRadius: number = 18; // 事件视界大小
    
    particles: BHParticle[] = [];
    particleCount: number = 1200; // 性能优化点：大幅减少数量
    
    spawnTimer: number = 0;
    isDespawning: boolean = false;
    despawnTimer: number = 0;

    constructor(x: number, y: number) {
        super(x, y, EntityType.SKILL_BLACKHOLE);
        
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push(new BHParticle(this.maxRadius));
        }
    }

    update(dt: number) {
        this.spawnTimer += dt;
        
        if (!this.isDespawning) {
            this.life -= dt;
            if (this.life <= 0) this.isDespawning = true;
        } else {
            this.despawnTimer += dt;
            if (this.despawnTimer > 1.0) this.markedForDeletion = true;
        }

        const currentMaxR = this.isDespawning ? this.maxRadius * (1 - this.despawnTimer) : this.maxRadius;
        
        // 更新粒子逻辑
        for (const p of this.particles) {
            p.update(dt, currentMaxR);
        }

        // 缓慢位移
        this.position.y -= 10 * dt;
    }

    static draw(ctx: CanvasRenderingContext2D, bh: BlackHole) {
        const { x, y } = bh.position;
        
        // 整体缩放动画
        let scale = 1.0;
        if (bh.spawnTimer < 0.5) scale = bh.spawnTimer * 2;
        if (bh.isDespawning) scale = 1 - bh.despawnTimer;
        if (scale <= 0) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        // --- 第一步：底部环境辉光 (Glow) ---
        // 使用单次径向渐变代替多个粒子阴影，极大地提升性能
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, bh.maxRadius);
        glow.addColorStop(0, 'rgba(0, 150, 255, 0.4)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, bh.maxRadius, 0, Math.PI * 2);
        ctx.fill();

        // --- 第二步：批量绘制粒子 ---
        ctx.globalCompositeOperation = 'lighter';
        
        // 为了优化性能，我们分颜色组进行绘制，减少切换 fillStyle 的次数
        const colors = ["255, 255, 255", "0, 240, 255"];
        colors.forEach(targetColor => {
            ctx.fillStyle = `rgb(${targetColor})`;
            ctx.beginPath();
            
            for (const p of bh.particles) {
                if (p.color !== targetColor) continue;

                const px = Math.cos(p.angle) * p.distance;
                const py = Math.sin(p.angle) * p.distance;
                
                // 绘制主粒子
                ctx.rect(px, py, p.size, p.size);
                
                // 绘制拖尾（利用线段代替复杂的粒子群模拟）
                const trailLen = (150 / p.distance) * 8;
                const tx = px - Math.sin(p.angle) * trailLen;
                const ty = py + Math.cos(p.angle) * trailLen;
                
                // 线段绘制
                ctx.moveTo(px, py);
                ctx.lineTo(tx, ty);
            }
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(${targetColor}, 0.3)`;
            ctx.stroke();
            ctx.fill();
        });

        // --- 第三步：核心黑体与光环 ---
        ctx.globalCompositeOperation = 'source-over';
        
        // 纯黑核心
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius, 0, Math.PI * 2);
        ctx.fill();

        // 核心蓝白光环（Photon Ring）
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius + 1, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius - 1, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}
