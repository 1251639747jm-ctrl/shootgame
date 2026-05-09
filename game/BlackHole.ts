import { Entity } from "./Entities";
import { EntityType } from "../types";

/**
 * 黑洞技能 - 性能友好 & 视觉精炼版
 *
 * 核心设计：
 *   - 中心是一个纯黑事件视界 + 明亮光子环
 *   - 使用 2 条旋转渐变环 (accretion disk) 代替上万粒子
 *   - 少量 (~80) 螺旋粒子做点缀，而不是密密麻麻
 *   - 微量涟漪描边表示重力波
 *
 * 相比原先 15000 粒子/帧，绘制调用降低两个数量级
 */

class OrbitParticle {
    angle: number;
    distance: number;
    baseDistance: number;
    speed: number;
    size: number;
    color: string;
    life: number;
    maxLife: number;

    constructor() {
        this.angle = Math.random() * Math.PI * 2;
        this.baseDistance = 80 + Math.random() * 90;
        this.distance = this.baseDistance;
        this.speed = (260 / this.distance) * (0.9 + Math.random() * 0.3);
        this.size = Math.random() * 1.8 + 0.8;
        this.maxLife = 1.2 + Math.random() * 0.8;
        this.life = Math.random() * this.maxLife;

        // Cool accretion colours
        const roll = Math.random();
        if (roll < 0.55) this.color = '140, 230, 255';        // cyan
        else if (roll < 0.85) this.color = '90, 170, 255';    // mid blue
        else this.color = '255, 255, 255';                    // bright
    }

    update(dt: number) {
        this.angle += this.speed * dt;
        this.life -= dt;
        // slow inward drift
        this.distance -= dt * 18;
        if (this.life <= 0 || this.distance < 44) {
            this.angle = Math.random() * Math.PI * 2;
            this.baseDistance = 80 + Math.random() * 90;
            this.distance = this.baseDistance;
            this.life = this.maxLife;
        }
    }
}

export class BlackHole extends Entity {
    life: number = 7.0;

    maxRadius: number = 170;
    pullRadius: number = 360;
    eventHorizonRadius: number = 38;

    particles: OrbitParticle[] = [];
    particleCount: number = 80;

    spawnInTimer: number = 0;
    despawnTimer: number = 0;
    isDespawning: boolean = false;

    rippleTimer: number = 0;
    ripples: Array<{ r: number; life: number }> = [];

    constructor(x: number, y: number) {
        super(x, y, EntityType.SKILL_BLACKHOLE);
        this.radius = 10;
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push(new OrbitParticle());
        }
    }

    update(dt: number) {
        if (!this.isDespawning) {
            this.spawnInTimer = Math.min(1, this.spawnInTimer + dt * 2);
            if (this.radius < this.maxRadius) this.radius += dt * 200;
            this.life -= dt;
            if (this.life <= 0) this.isDespawning = true;
        } else {
            this.despawnTimer += dt;
            if (this.despawnTimer > 0.8) this.markedForDeletion = true;
        }

        for (const p of this.particles) p.update(dt);

        // ripples
        this.rippleTimer += dt;
        if (this.rippleTimer > 0.9 && !this.isDespawning) {
            this.rippleTimer = 0;
            this.ripples.push({ r: this.eventHorizonRadius * 1.2, life: 1 });
        }
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.r += dt * 180;
            r.life -= dt * 0.7;
            if (r.life <= 0) this.ripples.splice(i, 1);
        }

        // drift upward slowly
        this.position.y -= 4 * dt;
    }

    static draw(ctx: CanvasRenderingContext2D, bh: BlackHole) {
        const { x, y } = bh.position;

        // spawn/despawn scale
        let scale = bh.spawnInTimer;
        if (bh.isDespawning) scale = Math.max(0, 1 - bh.despawnTimer / 0.8);
        if (scale <= 0.01) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);

        const t = performance.now() * 0.0015;
        const eh = bh.eventHorizonRadius;
        const outer = bh.maxRadius;

        // 1) Soft gravitational halo (one radial gradient, cheap)
        ctx.globalCompositeOperation = 'lighter';
        const halo = ctx.createRadialGradient(0, 0, eh, 0, 0, outer);
        halo.addColorStop(0, 'rgba(20, 90, 200, 0.55)');
        halo.addColorStop(0.55, 'rgba(10, 60, 160, 0.18)');
        halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(0, 0, outer, 0, Math.PI * 2);
        ctx.fill();

        // 2) Accretion disk - two rotating bright arcs (very cheap, very pretty)
        ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
            const rot = t * (1 + i * 0.35) + i * Math.PI;
            const diskR = 70 + i * 18;
            ctx.save();
            ctx.rotate(rot);
            ctx.strokeStyle = i === 0
                ? 'rgba(180, 240, 255, 0.85)'
                : 'rgba(90, 170, 255, 0.55)';
            ctx.lineWidth = 6 - i * 2;
            ctx.beginPath();
            ctx.arc(0, 0, diskR, -Math.PI * 0.8, Math.PI * 0.2);
            ctx.stroke();
            ctx.restore();
        }

        // 3) Orbit particles (~80)
        for (const p of bh.particles) {
            const px = Math.cos(p.angle) * p.distance;
            const py = Math.sin(p.angle) * p.distance;
            const alpha = Math.min(1, p.life / p.maxLife);
            ctx.fillStyle = `rgba(${p.color}, ${alpha})`;
            ctx.fillRect(px - p.size * 0.5, py - p.size * 0.5, p.size, p.size);
        }

        // 4) Ripples
        ctx.globalCompositeOperation = 'source-over';
        for (const r of bh.ripples) {
            ctx.strokeStyle = `rgba(120, 200, 255, ${r.life * 0.35})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, r.r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 5) Photon ring (bright cyan)
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(120, 230, 255, 0.9)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, eh + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, eh + 0.5, 0, Math.PI * 2);
        ctx.stroke();

        // 6) Event horizon - pure black disc (drawn last so nothing leaks through)
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, 0, eh, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
