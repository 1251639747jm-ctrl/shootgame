import { Entity } from "./Entities";
import { EntityType, Vector2 } from "../types";
import { Player } from "./Entities";

const LASER_THEME = {
    COLORS: {
        CORE: '#FFFFFF',
        INNER: '#00FFFF',
        OUTER: '#0033FF',
        ELECTRIC: '#88FFFF',
        SPARK: '#FFDD00'
    },
    STATS: {
        BASE_DAMAGE: 160,
        LENGTH: 2000,
        WIDTH: 45,
    },
    PHASES: {
        CHARGE: 0.2,
        FIRE: 1.2,
        DECAY: 0.3
    }
};

class LaserSpark {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number;
    
    constructor(startX: number, startY: number, angle: number) {
        this.x = startX;
        this.y = startY;
        const scatter = angle + (Math.random() - 0.5) * 1.5;
        const speed = Math.random() * 600 + 200;
        this.vx = Math.sin(scatter) * speed;
        this.vy = -Math.cos(scatter) * speed;
        this.maxLife = Math.random() * 0.4 + 0.1;
        this.life = this.maxLife;
        this.size = Math.random() * 3 + 1;
    }
    
    update(dt: number) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }
}

export class Laser extends Entity {
    owner: Player;
    timer: number = 0;
    phase: 'charge' | 'fire' | 'decay' = 'charge';
    
    startPoint: Vector2 = { x: 0, y: 0 };
    endPoint: Vector2 = { x: 0, y: 0 };
    length: number = LASER_THEME.STATS.LENGTH;
    currentWidth: number = 0;

    private sparks: LaserSpark[] = [];
    private shakeIntensity: number = 0;

    constructor(owner: Player) {
        super(owner.position.x, owner.position.y, EntityType.WEAPON_LASER);
        this.owner = owner;
        this.rotation = owner.rotation;
        this.radius = LASER_THEME.STATS.WIDTH * 0.5;
        this.updateGeometry();
    }

    private updateGeometry() {
        this.rotation = this.owner.rotation;
        this.startPoint.x = this.owner.position.x + 45 * Math.sin(this.rotation);
        this.startPoint.y = this.owner.position.y - 45 * Math.cos(this.rotation);
        this.endPoint.x = this.startPoint.x + Math.sin(this.rotation) * this.length;
        this.endPoint.y = this.startPoint.y - Math.cos(this.rotation) * this.length;
        this.position.x = this.startPoint.x;
        this.position.y = this.startPoint.y;
    }

    update(dt: number) {
        if (this.owner.markedForDeletion) {
            this.markedForDeletion = true;
            return;
        }

        this.timer += dt;
        this.updateGeometry();

        let damageMultiplier = 0;

        if (this.timer < LASER_THEME.PHASES.CHARGE) {
            this.phase = 'charge';
            const progress = this.timer / LASER_THEME.PHASES.CHARGE;
            this.currentWidth = progress * 10;
            this.shakeIntensity = progress * 2;
        } else if (this.timer < LASER_THEME.PHASES.CHARGE + LASER_THEME.PHASES.FIRE) {
            this.phase = 'fire';
            damageMultiplier = 1.0;
            this.currentWidth = LASER_THEME.STATS.WIDTH + Math.sin(this.timer * 40) * 8;
            this.shakeIntensity = 5;
            
            for(let i=0; i<3; i++) {
                this.sparks.push(new LaserSpark(this.startPoint.x, this.startPoint.y, this.rotation));
            }
        } else if (this.timer < LASER_THEME.PHASES.CHARGE + LASER_THEME.PHASES.FIRE + LASER_THEME.PHASES.DECAY) {
            this.phase = 'decay';
            const timeInDecay = this.timer - (LASER_THEME.PHASES.CHARGE + LASER_THEME.PHASES.FIRE);
            const progress = 1 - (timeInDecay / LASER_THEME.PHASES.DECAY);
            this.currentWidth = LASER_THEME.STATS.WIDTH * progress;
            damageMultiplier = progress;
            this.shakeIntensity = progress * 2;
        } else {
            this.markedForDeletion = true;
        }

        const levelBoost = 1 + (this.owner.level * 0.25);
        (this as any).damage = LASER_THEME.STATS.BASE_DAMAGE * this.owner.damageMultiplier * levelBoost * damageMultiplier;

        // --- 修复关键点：正确遍历数组并调用对象的 update ---
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const s = this.sparks[i]; // 获取单个火花对象
            s.update(dt);             // 调用对象的 update
            if (s.life <= 0) {
                this.sparks.splice(i, 1);
            }
        }
    }

    static draw(ctx: CanvasRenderingContext2D, laser: Laser) {
        const { x, y } = laser.startPoint;
        const rot = laser.rotation;
        const len = laser.length;
        const w = laser.currentWidth;

        if (w <= 0.5) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);

        const jitterX = (Math.random() - 0.5) * laser.shakeIntensity;
        ctx.translate(jitterX, 0);

        ctx.globalCompositeOperation = 'lighter';

        if (laser.phase === 'charge') {
            Laser.drawChargeEffect(ctx, laser);
        } else {
            // 1. 色散外晕
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = 'rgba(255, 0, 100, 0.4)';
            ctx.fillRect(-w * 1.5 - 2, 0, w * 3, -len);
            ctx.fillStyle = 'rgba(0, 100, 255, 0.4)';
            ctx.fillRect(-w * 1.5 + 2, 0, w * 3, -len);
            ctx.globalAlpha = 1.0;

            // 2. 主能量束
            const beamGrad = ctx.createLinearGradient(-w, 0, w, 0);
            beamGrad.addColorStop(0, 'transparent');
            beamGrad.addColorStop(0.2, LASER_THEME.COLORS.OUTER);
            beamGrad.addColorStop(0.5, LASER_THEME.COLORS.INNER);
            beamGrad.addColorStop(0.8, LASER_THEME.COLORS.OUTER);
            beamGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = beamGrad;
            ctx.fillRect(-w * 1.5, 0, w * 3, -len);

            // 3. 核心动态流
            const flowOffset = (performance.now() * 0.5) % 100;
            ctx.strokeStyle = LASER_THEME.COLORS.CORE;
            ctx.setLineDash([20, 30]);
            ctx.lineDashOffset = flowOffset;
            ctx.lineWidth = w * 0.4;
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, -len); ctx.stroke();
            ctx.setLineDash([]);

            // 4. 电弧
            if (laser.phase === 'fire') {
                ctx.strokeStyle = LASER_THEME.COLORS.ELECTRIC;
                ctx.lineWidth = 2;
                for (let j = 0; j < 2; j++) {
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    for (let i = 1; i < 6; i++) {
                        ctx.lineTo((Math.random()-0.5) * w * 3, -len * (i/6));
                    }
                    ctx.stroke();
                }
            }

            // 5. 极亮中心线
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = w * 0.15;
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, -len); ctx.stroke();
        }

        // 6. 绘制火花 (重置 Transform 以防旋转冲突)
        ctx.restore();
        
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = LASER_THEME.COLORS.SPARK;
        for (const s of laser.sparks) {
            const alpha = s.life / s.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillRect(s.x, s.y, s.size, s.size);
        }
        ctx.restore();
    }

    private static drawChargeEffect(ctx: CanvasRenderingContext2D, laser: Laser) {
        const progress = laser.timer / LASER_THEME.PHASES.CHARGE;
        const r = 50 * (1 - progress);
        ctx.strokeStyle = LASER_THEME.COLORS.INNER;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1, r), 0, Math.PI * 2);
        ctx.stroke();
    }
}
