import { Entity } from "./Entities";
import { EntityType, Vector2 } from "../types";
import { Player } from "./Entities";

// 激光配置：只需调整这里即可改变手感
const LASER_STYLE = {
    CORE_WIDTH: 12,        // 中心白光宽度
    GLOW_LAYERS: 3,        // 晕染层数
    MAX_LEN: 1600,         // 最大长度
    COLORS: {
        MAIN: '#00ffff',   // 青色外壳
        CORE: '#ffffff',   // 白色核心
        HINT: '#0088ff'    // 辅助深蓝色
    },
    PHASES: { CHARGE: 0.1, SUSTAIN: 0.8, DECAY: 0.2 }
};

export class Laser extends Entity {
    owner: Player;
    phase: 'charging' | 'firing' | 'decaying' = 'charging';
    timer: number = 0;
    currentWidth: number = 0;
    
    // 抖动参数
    private jitter: number = 0;
    private flicker: number = 0;

    constructor(owner: Player) {
        const noseX = owner.position.x + 40 * Math.sin(owner.rotation);
        const noseY = owner.position.y - 40 * Math.cos(owner.rotation);
        super(noseX, noseY, EntityType.WEAPON_LASER);
        
        this.owner = owner;
    }

    update(dt: number) {
        if (this.owner.markedForDeletion) { this.markedForDeletion = true; return; }

        this.timer += dt;
        
        // 1. 简单的状态机控制宽度
        if (this.timer < LASER_STYLE.PHASES.CHARGE) {
            this.phase = 'charging';
            this.currentWidth = (this.timer / LASER_STYLE.PHASES.CHARGE) * 5;
        } else if (this.timer < LASER_STYLE.PHASES.SUSTAIN) {
            this.phase = 'firing';
            this.currentWidth = LASER_STYLE.CORE_WIDTH + Math.sin(this.timer * 50) * 2; // 高频脉动
        } else {
            this.phase = 'decaying';
            const progress = (this.timer - LASER_STYLE.PHASES.SUSTAIN) / LASER_STYLE.PHASES.DECAY;
            this.currentWidth = LASER_STYLE.CORE_WIDTH * (1 - progress);
            if (progress >= 1) this.markedForDeletion = true;
        }

        // 2. 更新位置和旋转
        this.rotation = this.owner.rotation;
        this.position.x = this.owner.position.x + 40 * Math.sin(this.rotation);
        this.position.y = this.owner.position.y - 40 * Math.cos(this.rotation);

        // 3. 计算伤害逻辑（简化）
        (this as any).damage = this.phase === 'firing' ? 50 * this.owner.damageMultiplier : 0;
        
        // 4. 生成高频随机值供渲染使用
        this.jitter = (Math.random() - 0.5) * 4;
        this.flicker = Math.random() > 0.8 ? 1.2 : 1.0; 
    }

    static draw(ctx: CanvasRenderingContext2D, laser: Laser) {
        const { x, y } = laser.position;
        const len = LASER_STYLE.MAX_LEN;
        const rot = laser.rotation;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);

        // 激光末端位置（本地坐标）
        const endY = -len;

        // 开启“叠加模式”，这是发光效果的灵魂
        ctx.globalCompositeOperation = 'lighter';

        // --- 核心渲染步骤（无 shadowBlur 方案） ---

        // 1. 外部大范围弱光晕 (Aura)
        this.drawBeamLayer(ctx, endY, laser.currentWidth * 4, `rgba(0, 150, 255, ${0.1 * laser.flicker})`);

        // 2. 中层彩色光束 (Outer Beam)
        this.drawBeamLayer(ctx, endY, laser.currentWidth * 2, `rgba(0, 255, 255, ${0.3 * laser.flicker})`);

        // 3. 内层高能光束 (Inner Beam)
        this.drawBeamLayer(ctx, endY, laser.currentWidth * 1.2, LASER_STYLE.COLORS.MAIN);

        // 4. 极致白光核心 (Core)
        // 核心加入 jitter 模拟空气电离抖动
        ctx.translate(laser.jitter, 0);
        this.drawBeamLayer(ctx, endY, laser.currentWidth * 0.4, LASER_STYLE.COLORS.CORE);

        // 5. 绘制枪口爆发点 (Muzzle Flash)
        this.drawMuzzle(ctx, laser);

        ctx.restore();
    }

    private static drawBeamLayer(ctx: CanvasRenderingContext2D, endY: number, width: number, color: string) {
        if (width <= 0) return;
        ctx.beginPath();
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.moveTo(0, 0);
        ctx.lineTo(0, endY);
        ctx.stroke();
    }

    private static drawMuzzle(ctx: CanvasRenderingContext2D, laser: Laser) {
        const size = laser.currentWidth * 5;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, LASER_STYLE.COLORS.MAIN);
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();

        // 绘制一个十字闪光加强视觉冲击
        if (laser.phase === 'firing') {
            ctx.fillStyle = 'white';
            const spike = size * 1.5;
            ctx.fillRect(-spike, -1, spike * 2, 2);
            ctx.fillRect(-1, -spike, 2, spike * 2);
        }
    }
}
