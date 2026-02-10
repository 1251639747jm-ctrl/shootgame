import { Entity } from "./Entities";
import { EntityType, Vector2, WeaponType } from "../types";

export class Bomb extends Entity {
    targetY: number;
    timer: number = 0;
    detonationTime: number = 0.6; // Seconds until boom
    damage: number = 200; // Big AOE damage
    
    constructor(x: number, y: number, rotation: number) {
        super(x, y, EntityType.WEAPON_BOMB);
        this.radius = 12;
        this.rotation = rotation;
        // Move somewhat slowly forward
        const speed = 400;
        this.velocity.x = Math.sin(rotation) * speed;
        this.velocity.y = -Math.cos(rotation) * speed;
        this.targetY = y - 300; // Aim point
    }

    update(dt: number) {
        this.timer += dt;
        
        // Decelerate
        this.velocity.x *= 0.95;
        this.velocity.y *= 0.95;

        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        this.rotation += 5 * dt; // Spin

        if (this.timer >= this.detonationTime) {
            this.markedForDeletion = true;
            // Spawn explosion logic should be handled by Engine detecting deletion or explicit trigger
        }
    }

    static draw(ctx: CanvasRenderingContext2D, bomb: Bomb) {
        const { x, y } = bomb.position;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(bomb.rotation);

        // Bomb Body
        ctx.fillStyle = '#3f3f46';
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 14, 0, 0, Math.PI*2);
        ctx.fill();

        // Warning Light
        const blink = Math.floor(Date.now() / 100) % 2 === 0;
        ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = blink ? 10 : 0;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }
}

export class Explosion extends Entity {
    life: number = 0.5;
    maxRadius: number = 150;
    
    constructor(x: number, y: number) {
        super(x, y, EntityType.EXPLOSION_EFFECT);
        this.radius = 10;
    }

    update(dt: number) {
        this.life -= dt;
        this.radius += dt * 600; // Expand fast
        if (this.life <= 0) this.markedForDeletion = true;
    }

    static draw(ctx: CanvasRenderingContext2D, exp: Explosion) {
        const { x, y } = exp.position;
        const r = exp.radius;
        const alpha = Math.max(0, exp.life * 2);

        ctx.save();
        ctx.translate(x, y);
        ctx.globalCompositeOperation = 'lighter';

        // Shockwave Ring
        ctx.strokeStyle = `rgba(255, 100, 50, ${alpha})`;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.stroke();

        // Inner Fireball
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.8);
        grad.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
        grad.addColorStop(0.4, `rgba(255, 100, 0, ${alpha * 0.8})`);
        grad.addColorStop(1, `rgba(100, 0, 0, 0)`);
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.8, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }
}
