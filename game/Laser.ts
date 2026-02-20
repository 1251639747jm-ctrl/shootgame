import { Entity } from "./Entities";
import { EntityType, Vector2 } from "../types";
import { Player } from "./Entities";

/**
 * 史诗级激光配置 - 调整这里的数值可以改变激光的外观和威力
 */
const LASER_THEME = {
    COLORS: {
        CORE: '#FFFFFF',          // 核心：纯白
        INNER: '#00FFFF',         // 内晕：青色
        OUTER: '#0044FF',         // 外晕：深蓝
        ARC: 'rgba(200, 255, 255, 0.7)', // 电弧
    },
    WIDTH: {
        BASE: 35,                 // 基础宽度
        CORE_RATIO: 0.3,          // 核心所占比例
        GLOW_RATIO: 3.5,          // 光晕扩散比例
    },
    STATS: {
        BASE_DAMAGE: 120,         // 每秒基础伤害
        DURATION: 1.5,            // 激光持续时间 (秒)
        MAX_LEN: 1600,            // 最大射程
    }
};

export class Laser extends Entity {
    owner: Player;
    timer: number = 0;
    
    // 用于动画的高频随机值
    private flicker: number = 1.0;
    private jitterX: number = 0;

    constructor(owner: Player) {
        // 计算初始枪口位置
        const noseX = owner.position.x + 40 * Math.sin(owner.rotation);
        const noseY = owner.position.y - 40 * Math.cos(owner.rotation);
        
        super(noseX, noseY, EntityType.WEAPON_LASER);
        this.owner = owner;
        this.rotation = owner.rotation;
        
        // 初始化碰撞半径（重要：否则打不到人）
        this.radius = LASER_THEME.WIDTH.BASE * 0.8;
    }

    /**
     * 每帧更新逻辑：处理位置同步、伤害计算和生命周期
     */
    update(dt: number) {
        if (this.owner.markedForDeletion) {
            this.markedForDeletion = true;
            return;
        }

        this.timer += dt;

        // 1. 同步玩家位置与旋转（激光随动）
        this.rotation = this.owner.rotation;
        this.position.x = this.owner.position.x + 40 * Math.sin(this.rotation);
        this.position.y = this.owner.position.y - 40 * Math.cos(this.rotation);

        // 2. 核心：伤害逻辑计算
        // 伤害随等级提升：基础伤害 * 玩家倍率 * 等级加成
        const levelFactor = 1 + (this.owner.level * 0.2);
        const damageOutput = LASER_THEME.STATS.BASE_DAMAGE * this.owner.damageMultiplier * levelFactor;
        
        // 注入伤害属性供引擎检测
        (this as any).damage = damageOutput;

        // 3. 视觉抖动参数生成
        this.flicker = 0.8 + Math.random() * 0.4; // 模拟能量不稳定
        this.jitterX = (Math.random() - 0.5) * 4;

        // 4. 生命周期管理
        if (this.timer > LASER_THEME.STATS.DURATION) {
            (this as any).damage = 0;
            this.markedForDeletion = true;
        }
    }

    /**
     * 绘图逻辑：采用高性能分层渲染，无需 shadowBlur
     */
    static draw(ctx: CanvasRenderingContext2D, laser: Laser) {
        const { x, y } = laser.position;
        const rot = laser.rotation;
        const len = LASER_THEME.STATS.MAX_LEN;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);

        // 开启“叠加模式”模拟发光感
        ctx.globalCompositeOperation = 'lighter';

        // --- 第一层：外部扩散大光晕 (Volume Glow) ---
        this.drawOuterGlow(ctx, len, laser);

        // --- 第二层：流动性能量束 (Energy Flow) ---
        this.drawEnergyBeam(ctx, len, laser);

        // --- 第三层：随机分叉电弧 (Static Arcs) ---
        this.drawLightning(ctx, len, laser);

        // --- 第四层：极亮白光核心 (Plasma Core) ---
        this.drawCore(ctx, len, laser);

        // --- 第五层：端点效果 (Muzzle & Impact) ---
        this.drawFlares(ctx, len, laser);

        ctx.restore();
    }

    private static drawOuterGlow(ctx: CanvasRenderingContext2D, len: number, laser: Laser) {
        const w = LASER_THEME.WIDTH.BASE * LASER_THEME.WIDTH.GLOW_RATIO * laser.flicker;
        const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, LASER_THEME.COLORS.OUTER);
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.25; // 淡淡的晕染
        ctx.fillRect(-w / 2, 0, w, -len);
        ctx.globalAlpha = 1.0;
    }

    private static drawEnergyBeam(ctx: CanvasRenderingContext2D, len: number, laser: Laser) {
        const w = LASER_THEME.WIDTH.BASE * laser.flicker;
        // 秘诀：渐变随时间向下移动，产生能量流动的视觉差
        const offset = (laser.timer * 3000) % len;
        const grad = ctx.createLinearGradient(0, -offset, 0, -offset - len);
        grad.addColorStop(0, LASER_THEME.COLORS.INNER);
        grad.addColorStop(0.5, LASER_THEME.COLORS.CORE);
        grad.addColorStop(1, LASER_THEME.COLORS.INNER);

        ctx.lineWidth = w;
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -len);
        ctx.stroke();
    }

    private static drawLightning(ctx: CanvasRenderingContext2D, len: number, laser: Laser) {
        if (laser.timer > 1.2) return; // 衰减期不画电弧

        ctx.strokeStyle = LASER_THEME.COLORS.ARC;
        ctx.lineWidth = 1.5;
        
        for (let j = 0; j < 2; j++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const segments = 6;
            const step = len / segments;
            for (let i = 1; i <= segments; i++) {
                const jitter = (Math.random() - 0.5) * LASER_THEME.WIDTH.BASE * 2;
                ctx.lineTo(jitter, -i * step);
            }
            ctx.stroke();
        }
    }

    private static drawCore(ctx: CanvasRenderingContext2D, len: number, laser: Laser) {
        const w = LASER_THEME.WIDTH.BASE * LASER_THEME.WIDTH.CORE_RATIO;
        ctx.lineWidth = w;
        ctx.strokeStyle = LASER_THEME.COLORS.CORE;
        
        // 核心带一点点水平抖动
        ctx.beginPath();
        ctx.moveTo(laser.jitterX, 0);
        ctx.lineTo(laser.jitterX, -len);
        ctx.stroke();
    }

    private static drawFlares(ctx: CanvasRenderingContext2D, len: number, laser: Laser) {
        // 1. 枪口火光
        const muzzleSize = LASER_THEME.WIDTH.BASE * 3;
        const mGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, muzzleSize);
        mGrad.addColorStop(0, '#FFFFFF');
        mGrad.addColorStop(0.4, LASER_THEME.COLORS.INNER);
        mGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = mGrad;
        ctx.beginPath();
        ctx.arc(0, 0, muzzleSize, 0, Math.PI * 2);
        ctx.fill();

        // 2. 击中点闪光 (Impact)
        const impactY = -len;
        const iSize = 80 * laser.flicker;
        const iGrad = ctx.createRadialGradient(0, impactY, 0, 0, impactY, iSize);
        iGrad.addColorStop(0, '#FFFFFF');
        iGrad.addColorStop(0.5, LASER_THEME.COLORS.OUTER);
        iGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = iGrad;
        ctx.beginPath();
        ctx.arc(0, impactY, iSize, 0, Math.PI * 2);
        ctx.fill();
    }
}
