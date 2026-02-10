import { Entity } from "./Entities";
import { EntityType, Vector2 } from "../types";

/**
 * HELPER CLASS: Black Hole Particle
 * Represents a single piece of matter in the accretion disk.
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
        // Distribution: Biased towards center for density
        const r = Math.random();
        const distributionCurve = Math.pow(r, 3.0); 
        
        // Define ranges
        const horizonRadius = 40; 
        const diskWidth = maxRadius - horizonRadius;
        
        this.distance = horizonRadius + 5 + (distributionCurve * diskWidth);
        this.angle = Math.random() * Math.PI * 2;
        
        // --- ROTATION PHYSICS UPDATE ---
        // OLD: v ~ 1/sqrt(r) (Keplerian linear velocity) -> High overall speed
        // NEW: Define Angular Velocity directly.
        // Formula: Omega = Factor / Distance
        // This creates a strong differential: Inner spins FAST, Outer spins SLOW.
        // Factor 200:
        // at r=40 (Inner): 5 rad/s (~0.8 rev/s) - Fast
        // at r=320 (Outer): 0.6 rad/s (~0.1 rev/s) - Slow
        const angularFactor = 200; 
        this.speed = (angularFactor / this.distance) * (0.8 + Math.random() * 0.4);
        
        // Size variation
        // Inner particles are finer/sharper
        this.size = (Math.random() * 1.5) + (this.distance > 150 ? 0.8 : 0.5);
        
        this.wobblePhase = Math.random() * Math.PI * 2;
        this.wobbleSpeed = Math.random() * 2 + 1;

        // Color Grading
        const distNorm = (this.distance - horizonRadius) / diskWidth;
        
        if (distNorm < 0.1) {
            // Singularity Edge: Blinding White/Blue
            this.color = '255, 255, 255'; 
            this.targetAlpha = 0.95 + Math.random() * 0.05;
        } else if (distNorm < 0.25) {
            // Inner Ring: Electric Blue
            this.color = '50, 200, 255';
            this.targetAlpha = 0.9 + Math.random() * 0.1;
        } else if (distNorm < 0.5) {
            // Mid Ring: Cyan/Gold mix
            this.color = Math.random() > 0.5 ? '100, 255, 255' : '255, 220, 100';
            this.targetAlpha = 0.7 + Math.random() * 0.2;
        } else {
            // Outer Edge: Redshift/Dark matter
            this.color = '200, 50, 50';
            this.targetAlpha = 0.4 + Math.random() * 0.4;
        }
        
        this.alpha = startFullAlpha ? this.targetAlpha : 0;
    }

    update(dt: number, maxRadius: number) {
        // --- ROTATION UPDATE ---
        // this.speed is now Angular Velocity in radians/second
        this.angle += this.speed * dt; 
        
        // Wobble
        this.wobblePhase += this.wobbleSpeed * dt;
        
        // Spiral inward physics
        // Suction strength
        const suction = (1500 / this.distance);
        this.distance -= suction * dt; 
        
        if (this.alpha < this.targetAlpha) {
            this.alpha += dt * 3.0; 
        }

        // Respawn logic
        if (this.distance < 35) {
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
        this.maxRadius = startRadius + 400;
        this.life = 0.8;
        this.maxLife = 0.8;
    }

    update(dt: number) {
        this.radius += 200 * dt; // Faster ripples
        this.life -= dt * 0.8;
    }
}

export class BlackHole extends Entity {
    life: number = 8.0; 
    
    maxRadius: number = 320; 
    pullRadius: number = 550; 
    eventHorizonRadius: number = 40;
    
    particles: BHParticle[] = [];
    particleCount: number = 8000; 
    
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
            if (this.radius < this.maxRadius * 0.6) {
                this.radius += dt * 150;
            }
            
            this.life -= dt;
            if (this.life <= 0) {
                this.isDespawning = true;
            }
        } else {
            this.despawnTimer += dt;
            this.radius -= dt * 200;
            if (this.despawnTimer > 1.0) {
                this.markedForDeletion = true;
            }
        }
        
        const currentMaxR = this.isDespawning ? this.maxRadius * (1 - this.despawnTimer) : this.maxRadius;
        for (const p of this.particles) {
            p.update(dt, currentMaxR);
        }

        this.rippleTimer += dt;
        if (this.rippleTimer > 0.3 && !this.isDespawning) { 
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

        this.position.y -= 8 * dt; // Drift
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

        // --- LAYER 1: GRAVITATIONAL LENSING ---
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        const lensRadius = bh.maxRadius * 1.4;
        const lensGrad = ctx.createRadialGradient(0, 0, bh.eventHorizonRadius, 0, 0, lensRadius);
        lensGrad.addColorStop(0, '#000000'); 
        lensGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.95)');
        lensGrad.addColorStop(0.8, 'rgba(5, 5, 10, 0.2)');
        lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = lensGrad;
        ctx.beginPath();
        ctx.arc(0, 0, lensRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Ripples
        ctx.lineWidth = 1.5;
        for (const rip of bh.ripples) {
            const alpha = rip.life * 0.3;
            ctx.strokeStyle = `rgba(50, 100, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(0, 0, rip.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();

        // --- LAYER 2: HIGH DENSITY PARTICLE DISK ---
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        const baseGlow = ctx.createRadialGradient(0, 0, bh.eventHorizonRadius, 0, 0, bh.maxRadius * 0.8);
        baseGlow.addColorStop(0, 'rgba(0, 50, 255, 0.2)');
        baseGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = baseGlow;
        ctx.beginPath();
        ctx.arc(0, 0, bh.maxRadius, 0, Math.PI*2);
        ctx.fill();

        for (const p of bh.particles) {
            if (p.alpha <= 0.01) continue;

            const xPos = Math.cos(p.angle) * p.distance;
            const yPos = Math.sin(p.angle) * p.distance;

            ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
            
            // OPTIMIZATION: Use fillRect for small particles
            if (p.size < 1.5) {
                ctx.fillRect(xPos, yPos, p.size, p.size);
            } else {
                ctx.beginPath();
                ctx.arc(xPos, yPos, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Motion Streaks - Only for inner fast particles
            if (p.distance < 70) {
                ctx.strokeStyle = `rgba(${p.color}, ${p.alpha * 0.4})`;
                ctx.lineWidth = p.size;
                ctx.beginPath();
                ctx.moveTo(xPos, yPos);
                // Calculate tangent vector
                const trailLen = (200 / p.distance) * 8; 
                const tx = xPos - Math.sin(p.angle) * trailLen; 
                const ty = yPos + Math.cos(p.angle) * trailLen;
                ctx.lineTo(tx, ty);
                ctx.stroke();
            }
        }
        ctx.restore();

        // --- LAYER 3: THE EVENT HORIZON ---
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        
        // The Void
        ctx.fillStyle = '#000000';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 5; 
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Photon Ring 
        ctx.globalCompositeOperation = 'lighter';
        
        // Outer Accretion Glow
        ctx.shadowColor = '#0ea5e9';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius + 2, 0, Math.PI * 2);
        ctx.stroke();
        
        // Sharp Inner Ring
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, bh.eventHorizonRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

        ctx.restore();
    }
}