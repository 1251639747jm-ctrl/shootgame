import { Entity } from "./Entities";
import { EntityType, Vector2, WeaponType } from "../types";
import { Player } from "./Entities";

export class Laser extends Entity {
    owner: Player;
    duration: number = 2.0;
    elapsed: number = 0;
    
    // Growth Animation Properties
    length: number = 0;
    maxLength: number = 1500; // Screen diagonal roughly
    growthSpeed: number = 4000; // Pixels per second (Fast but visible)
    
    width: number = 0;
    baseWidth: number = 45; 
    damagePerTick: number = 30; 

    constructor(owner: Player) {
        // Calculate nose position precisely
        const noseOffset = 40;
        const noseX = owner.position.x + noseOffset * Math.sin(owner.rotation);
        const noseY = owner.position.y - noseOffset * Math.cos(owner.rotation);
        
        super(noseX, noseY, EntityType.WEAPON_LASER);
        this.owner = owner;
        
        // Initial tiny length
        this.length = 10;
    }

    update(dt: number) {
        if (this.owner.markedForDeletion) {
            this.markedForDeletion = true;
            return;
        }

        this.elapsed += dt;

        // Sync position with player nose every frame
        const noseOffset = 40;
        this.position.x = this.owner.position.x + noseOffset * Math.sin(this.owner.rotation);
        this.position.y = this.owner.position.y - noseOffset * Math.cos(this.owner.rotation);
        this.rotation = this.owner.rotation;
        
        // Damage scaling
        const levelFactor = 1 + (this.owner.level * 0.2);
        const currentDamage = this.damagePerTick * this.owner.damageMultiplier;
        (this as any).damage = currentDamage;

        // --- 1. GROWTH LOGIC ---
        // Grow length linearly until max
        if (this.length < this.maxLength) {
            this.length += this.growthSpeed * dt;
            if (this.length > this.maxLength) this.length = this.maxLength;
        }

        // --- 2. WIDTH ANIMATION ---
        const targetWidth = (this.baseWidth * levelFactor);
        const lifePct = this.elapsed / this.duration;
        
        if (this.length < this.maxLength) {
             // While growing, the beam is slightly narrower (focusing energy)
             this.width = targetWidth * 0.7; 
        } else {
             // Stable Phase
             // Pop out effect at the end
             if (lifePct > 0.85) {
                const fadeOutPct = (lifePct - 0.85) / 0.15;
                this.width = targetWidth * (1 - fadeOutPct);
             } else {
                // Slight pulsation while active
                this.width = targetWidth * (1 + Math.sin(this.elapsed * 20) * 0.1);
             }
        }

        this.radius = this.width * 0.6; // Collision radius

        if (this.elapsed >= this.duration) {
            this.markedForDeletion = true;
        }
    }

    static draw(ctx: CanvasRenderingContext2D, laser: Laser) {
        const { x, y } = laser.position;
        const len = laser.length;
        const w = laser.width; 

        // Don't draw if invisible
        if (w < 1 || len < 5) return;

        const time = Date.now() / 1000;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(laser.rotation);
        
        // Use additive blending for light
        ctx.globalCompositeOperation = 'lighter';
        
        // --- LAYER 1: OUTER AURA (Wide, Blue/Purple) ---
        const auraW = w * 3.5;
        const gradAura = ctx.createLinearGradient(-auraW, 0, auraW, 0);
        gradAura.addColorStop(0, 'rgba(0, 0, 255, 0)');
        gradAura.addColorStop(0.2, 'rgba(0, 50, 255, 0.1)');
        gradAura.addColorStop(0.5, 'rgba(0, 150, 255, 0.3)');
        gradAura.addColorStop(0.8, 'rgba(0, 50, 255, 0.1)');
        gradAura.addColorStop(1, 'rgba(0, 0, 255, 0)');
        
        ctx.fillStyle = gradAura;
        ctx.fillRect(-auraW/2, 0, auraW, -len);

        // --- LAYER 2: CORE BEAM (Solid White/Cyan) ---
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
        
        const gradCore = ctx.createLinearGradient(-w*0.5, 0, w*0.5, 0);
        gradCore.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
        gradCore.addColorStop(0.5, '#ffffff'); // Pure white center
        gradCore.addColorStop(1, 'rgba(0, 255, 255, 0.8)');
        
        ctx.fillStyle = gradCore;
        ctx.fillRect(-w*0.5, 0, w, -len);
        ctx.shadowBlur = 0; // Reset shadow for performance

        // --- LAYER 3: INTERNAL ENERGY TEXTURE (Moving Chevrons) ---
        // Clip to the beam area to keep texture contained
        ctx.save();
        ctx.beginPath();
        ctx.rect(-w*0.4, -len, w*0.8, len);
        ctx.clip();
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        
        // Texture moves very fast
        const flowSpeed = time * 2500; 
        const spacing = 25; // Dense pattern
        
        // Loop enough times to cover the length
        const count = Math.ceil(len / spacing) + 2;
        
        for(let i=0; i < count; i++) {
            // Calculate Y position moving upwards (-Y)
            const yPos = -((i * spacing + flowSpeed) % len);
            
            ctx.beginPath();
            // Draw a V shape
            // M 0 y
            // L -w y+h
            // L +w y+h
            // Actually let's do a chevron: ^
            const chevronSize = w * 0.3;
            ctx.moveTo(-chevronSize, yPos + 10);
            ctx.lineTo(0, yPos);
            ctx.lineTo(chevronSize, yPos + 10);
            ctx.stroke();
        }
        ctx.restore();

        // --- LAYER 4: ELECTRIC ARCS (Outer Chaos) ---
        const arcCount = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#a5f3fc';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        for (let k = 0; k < arcCount; k++) {
            ctx.strokeStyle = k === 0 ? 'rgba(200, 255, 255, 0.8)' : 'rgba(0, 150, 255, 0.6)';
            ctx.lineWidth = k === 0 ? 1.5 : 1;
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            
            // Dynamic wave parameters
            const freq = 0.05;
            const amp = w * 1.1;
            const phase = time * 40 + (k * Math.PI); // Different phase for each arc
            
            // Step through length
            for(let stepY = 0; stepY < len; stepY += 15) {
                 const sine = Math.sin(stepY * freq + phase);
                 const noise = (Math.random() - 0.5) * 8; // Jitter
                 const xVal = sine * amp + noise;
                 ctx.lineTo(xVal, -stepY);
            }
            ctx.stroke();
        }

        // --- LAYER 5: IMPACT/MUZZLE FLARE ---
        // Draw a bright flare at the base (player nose)
        const flareSize = w * 2.5;
        const gradFlare = ctx.createRadialGradient(0, 0, 0, 0, 0, flareSize);
        gradFlare.addColorStop(0, '#ffffff');
        gradFlare.addColorStop(0.3, '#00ffff');
        gradFlare.addColorStop(1, 'rgba(0,0,255,0)');
        
        ctx.fillStyle = gradFlare;
        ctx.beginPath();
        ctx.arc(0, 0, flareSize, 0, Math.PI*2);
        ctx.fill();

        // Draw a flare at the tip if it hasn't reached full length yet (impact point)
        if (len < laser.maxLength) {
             ctx.fillStyle = '#ffffff';
             ctx.shadowBlur = 20;
             ctx.shadowColor = '#ffffff';
             ctx.beginPath();
             ctx.arc(0, -len, w * 1.2, 0, Math.PI*2);
             ctx.fill();
        }

        ctx.restore();
    }
}