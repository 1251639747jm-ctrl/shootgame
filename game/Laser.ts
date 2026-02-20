import { Entity } from "./Entities";
import { EntityType, Vector2 } from "../types";
import { Player } from "./Entities";

// ---------------------------------------------------------
// 配置中心：在这里调整出你想要的“史诗感”
// ---------------------------------------------------------
const LASER_THEME = {
    CORE_COLOR: '#FFFFFF',         // 核心：纯白
    INNER_Glow: '#00FFFF',         // 内晕：青色
    OUTER_GLOW: '#0044FF',         // 外晕：深蓝
    ARC_COLOR: 'rgba(180, 255, 255, 0.8)', // 电弧颜色
    BEAM_WIDTH: 35,                // 基础宽度
    SEGMENTS: 5,                   // 电弧分段数（影响分支复杂度）
};

export class Laser extends Entity {
    owner: Player;
    timer: number = 0;
    seed: number = Math.random(); // 用于生成稳定的随机路径

    constructor(owner: Player) {
        const noseX = owner.position.x + 40 * Math.sin(owner.rotation);
        const noseY = owner.position.y - 40 * Math.cos(owner.rotation);
        super(noseX, noseY, EntityType.WEAPON_LASER);
        this.owner = owner;
    }

    update(dt: number) {
        if (this.owner.markedForDeletion) { this.markedForDeletion = true; return; }
        
        this.timer += dt;
        
        // 1. 同步位置和旋转
        this.rotation = this.owner.rotation;
        this.position.x = this.owner.position.x + 40 * Math.sin(this.rotation);
        this.position.y = this.owner.position.y - 40 * Math.cos(this.rotation);

        // 2. 核心：加上伤害数值逻辑
        // 根据等级和伤害倍率计算最终伤害
        const baseDamage = 60; // 激光每帧/秒的基础伤害
        const levelFactor = 1 + (this.owner.level * 0.2);
        
        // 把伤害数值赋给 entity，引擎会自动进行碰撞检测
        (this as any).damage = baseDamage * this.owner.damageMultiplier * levelFactor;

        // 3. 激光持续时间控制
        // 这里设为 1.2 秒，你可以根据需要调整
        if (this.timer > 1.2) {
            (this as any).damage = 0; // 消失前伤害归零
            this.markedForDeletion = true;
        }
    }
    static draw(ctx: CanvasRenderingContext2D, laser: Laser) {
        const { x, y } = laser.position;
        const rot = laser.rotation;
        const len = 1500; // 激光射程

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);

        // 开启叠加模式：让光看起来在燃烧
        ctx.globalCompositeOperation = 'lighter';

        // 1. 绘制底层：超宽动态光晕 (解决“肉感”的关键)
        this.drawGlow(ctx, len, laser);

        // 2. 绘制中层：流动能量束 (模拟质感)
        this.drawEnergyBeam(ctx, len, laser);

        // 3. 绘制核心：极亮白光
        this.drawCore(ctx, len, laser);

        // 4. 绘制顶层：随机分支电弧 (史诗感的来源)
        if (laser.timer < 0.8) {
            this.drawLightningArcs(ctx, len, laser);
        }

        // 5. 击中点火花 (Impact)
        this.drawImpact(ctx, -len, laser);

        ctx.restore();
    }

    // --- 细节渲染逻辑 ---

    private static drawGlow(ctx: CanvasRenderingContext2D, len: number, laser: Laser) {
        const w = LASER_THEME.BEAM_WIDTH * 3 * (0.8 + Math.random() * 0.2);
        const grad = ctx.createLinearGradient(-w, 0, w, 0);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, LASER_THEME.OUTER_GLOW);
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(-w/2, 0, w, -len);
        ctx.globalAlpha = 1.0;
    }

    private static drawEnergyBeam(ctx: CanvasRenderingContext2D, len: number, laser: Laser) {
        const w = LASER_THEME.BEAM_WIDTH;
        // 关键点：创建一个随时间位移的渐变，模拟能量“流动”
        const offset = (laser.timer * 2000) % len;
        const grad = ctx.createLinearGradient(0, -offset, 0, -offset - len);
        grad.addColorStop(0, LASER_THEME.INNER_Glow);
        grad.addColorStop(0.2, LASER_THEME.CORE_COLOR);
        grad.addColorStop(0.4, LASER_THEME.INNER_Glow);
        grad.addColorStop(0.7, LASER_THEME.OUTER_GLOW);
        grad.addColorStop(1, LASER_THEME.INNER_Glow);

        ctx.strokeStyle = grad;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -len);
        ctx.stroke();
    }

    private static drawCore(ctx: CanvasRenderingContext2D, len: number, laser: Laser) {
        const w = LASER_THEME.BEAM_WIDTH * 0.3;
        ctx.strokeStyle = LASER_THEME.CORE_COLOR;
        ctx.lineWidth = w;
        // 核心加入微小的左右随机偏移
        const jitter = (Math.random() - 0.5) * 3;
        ctx.beginPath();
        ctx.moveTo(jitter, 0);
        ctx.lineTo(jitter, -len);
        ctx.stroke();
    }

    private static drawLightningArcs(ctx: CanvasRenderingContext2D, len: number, laser: Laser) {
        ctx.strokeStyle = LASER_THEME.ARC_COLOR;
        ctx.lineWidth = 2;

        // 绘制两条交替穿梭的电弧
        for (let j = 0; j < 2; j++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            let curY = 0;
            const step = len / LASER_THEME.SEGMENTS;

            for (let i = 0; i < LASER_THEME.SEGMENTS; i++) {
                curY -= step;
                const curX = (Math.random() - 0.5) * LASER_THEME.BEAM_WIDTH * 2.5;
                ctx.lineTo(curX, curY);
            }
            ctx.stroke();
        }
    }

    private static drawImpact(ctx: CanvasRenderingContext2D, endY: number, laser: Laser) {
        // 击中点的剧烈闪光
        const size = 60 + Math.random() * 40;
        const grad = ctx.createRadialGradient(0, endY, 0, 0, endY, size);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.4, LASER_THEME.INNER_Glow);
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, endY, size, 0, Math.PI * 2);
        ctx.fill();

        // 随机溅射火星
        ctx.fillStyle = LASER_THEME.CORE_COLOR;
        for(let i=0; i<5; i++) {
            const px = (Math.random()-0.5) * 50;
            const py = endY + (Math.random()-0.5) * 50;
            ctx.fillRect(px, py, 4, 4);
        }
    }
}
