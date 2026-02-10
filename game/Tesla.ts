import { Entity } from "./Entities";
import { EntityType, Vector2 } from "../types";

export class TeslaLightning extends Entity {
    targets: Vector2[] = [];
    life: number = 0.4; // Increased life to see animation
    maxLife: number = 0.4;
    damage: number = 60; 

    constructor(start: Vector2, targets: Vector2[]) {
        super(start.x, start.y, EntityType.WEAPON_TESLA);
        this.targets = targets; 
    }

    update(dt: number) {
        this.life -= dt;
        if (this.life <= 0) this.markedForDeletion = true;
    }

    static draw(ctx: CanvasRenderingContext2D, tesla: TeslaLightning) {
        if (tesla.targets.length === 0) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        let currentPos = tesla.position;
        
        // Calculate propagation
        const totalTargets = tesla.targets.length;
        const progress = 1 - (tesla.life / tesla.maxLife); // 0 to 1
        
        // Propagation speed: reaches all targets by 50% of life
        const propagationSpeed = 2.0; 
        const visibleIndexFloat = progress * (totalTargets + 1) * propagationSpeed;
        const visibleTargets = Math.floor(visibleIndexFloat);

        tesla.targets.forEach((target, index) => {
            if (index >= visibleTargets) return;

            const dist = Math.sqrt((target.x - currentPos.x)**2 + (target.y - currentPos.y)**2);
            const steps = Math.floor(dist / 10);
            
            // Fade out old bolts
            const segmentAge = Math.max(0, visibleIndexFloat - index); 
            // If segmentAge is large (meaning bolt appeared long ago), fade it? 
            // Actually let's keep them visible but flicker
            
            ctx.strokeStyle = '#a5f3fc'; 
            ctx.lineWidth = 3;
            ctx.shadowColor = '#0891b2';
            ctx.shadowBlur = 15;

            ctx.beginPath();
            ctx.moveTo(currentPos.x, currentPos.y);

            for (let i = 1; i < steps; i++) {
                const t = i / steps;
                const tx = currentPos.x + (target.x - currentPos.x) * t;
                const ty = currentPos.y + (target.y - currentPos.y) * t;
                const jitter = (Math.random() - 0.5) * 30;
                ctx.lineTo(tx + jitter, ty + jitter);
            }
            ctx.lineTo(target.x, target.y);
            ctx.stroke();

            // Inner White Core
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(currentPos.x, currentPos.y);
            for (let i = 1; i < steps; i++) {
                const t = i / steps;
                const tx = currentPos.x + (target.x - currentPos.x) * t;
                const ty = currentPos.y + (target.y - currentPos.y) * t;
                const jitter = (Math.random() - 0.5) * 15;
                ctx.lineTo(tx + jitter, ty + jitter);
            }
            ctx.lineTo(target.x, target.y);
            ctx.stroke();

            currentPos = target;
        });

        ctx.restore();
    }
}
