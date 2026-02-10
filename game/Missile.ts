import { Entity, Enemy } from "./Entities";
import { EntityType, Vector2, WeaponType } from "../types";
import { Player } from "./Entities";

export class Missile extends Entity {
    target: Entity | null = null;
    timer: number = 0;
    damage: number = 60;
    fuel: number = 2.5; 
    accelPhase: number = 0.3; 
    
    constructor(x: number, y: number, rotation: number, owner: Player) {
        super(x, y, EntityType.WEAPON_MISSILE);
        this.rotation = rotation;
        this.radius = 20; // Increased collision radius
        
        // Initial "Launch" velocity
        const speed = 250;
        this.velocity.x = Math.sin(rotation) * speed;
        this.velocity.y = -Math.cos(rotation) * speed;
        
        this.damage = 60 * owner.damageMultiplier;
    }

    update(dt: number, context?: Vector2 | Entity[]) {
        const entities = Array.isArray(context) ? context : undefined;
        this.timer += dt;
        
        // Find target if none
        if (!this.target && this.timer > 0.1 && entities) {
             let minDist = 1200;
             entities.forEach(e => {
                 if (e instanceof Enemy && !e.markedForDeletion) {
                     const d = Math.sqrt((e.position.x - this.position.x)**2 + (e.position.y - this.position.y)**2);
                     if (d < minDist) {
                         minDist = d;
                         this.target = e;
                     }
                 }
             });
        }
        
        // Tracking Logic
        if (this.timer > this.accelPhase && this.timer < this.fuel && this.target && !this.target.markedForDeletion) {
            const dx = this.target.position.x - this.position.x;
            const dy = this.target.position.y - this.position.y;
            const targetAngle = Math.atan2(dy, dx) + Math.PI/2; 
            
            const turnRate = 3.5 * dt; // Slightly slower turn for weightier feel
            let diff = targetAngle - this.rotation;
            
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            
            this.rotation += Math.max(-turnRate, Math.min(turnRate, diff));
        }

        // Acceleration
        const currentSpeed = 250 + Math.min(this.timer * 700, 900);
        
        this.velocity.x = Math.sin(this.rotation) * currentSpeed;
        this.velocity.y = -Math.cos(this.rotation) * currentSpeed;

        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        
        if (this.timer > 5.0) this.markedForDeletion = true;
    }

    static draw(ctx: CanvasRenderingContext2D, missile: Missile) {
        const { x, y } = missile.position;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(missile.rotation);
        
        // Scale up significantly
        const s = 2.0; 

        // --- TAIL FLAME ---
        ctx.globalCompositeOperation = 'lighter';
        const flicker = Math.random() * 0.4 + 0.8;
        const tailLength = 25 * s * flicker;
        
        // Core flame
        const gradFlame = ctx.createLinearGradient(0, 10*s, 0, 10*s + tailLength);
        gradFlame.addColorStop(0, '#ffffff');
        gradFlame.addColorStop(0.3, '#f0abfc'); // Pinkish
        gradFlame.addColorStop(1, 'rgba(192, 38, 211, 0)'); // Purple fade
        
        ctx.fillStyle = gradFlame;
        ctx.beginPath();
        ctx.moveTo(-4*s, 10*s);
        ctx.lineTo(4*s, 10*s);
        ctx.lineTo(0, 10*s + tailLength);
        ctx.fill();
        
        ctx.globalCompositeOperation = 'source-over';

        // --- MISSILE BODY (High Tech) ---
        // Metallic Gradient
        const gradBody = ctx.createLinearGradient(-5*s, 0, 5*s, 0);
        gradBody.addColorStop(0, '#4a044e'); // Dark Purple
        gradBody.addColorStop(0.5, '#e879f9'); // Light Purple highlight
        gradBody.addColorStop(1, '#4a044e');

        ctx.fillStyle = gradBody;
        ctx.strokeStyle = '#f0abfc';
        ctx.lineWidth = 1;

        // Main Fuselage
        ctx.beginPath();
        ctx.moveTo(0, -15*s); // Nose tip
        ctx.lineTo(5*s, -5*s);
        ctx.lineTo(5*s, 10*s);
        ctx.lineTo(-5*s, 10*s);
        ctx.lineTo(-5*s, -5*s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // --- FINS ---
        ctx.fillStyle = '#701a75'; // Darker fins
        
        // Rear Fins
        ctx.beginPath();
        ctx.moveTo(5*s, 5*s);
        ctx.lineTo(12*s, 12*s);
        ctx.lineTo(5*s, 10*s);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-5*s, 5*s);
        ctx.lineTo(-12*s, 12*s);
        ctx.lineTo(-5*s, 10*s);
        ctx.fill();
        ctx.stroke();
        
        // Front Canards
        ctx.beginPath();
        ctx.moveTo(5*s, -5*s);
        ctx.lineTo(9*s, -2*s);
        ctx.lineTo(5*s, 0);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-5*s, -5*s);
        ctx.lineTo(-9*s, -2*s);
        ctx.lineTo(-5*s, 0);
        ctx.fill();

        // Warhead Glow
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(0, -12*s, 2*s, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }
}
