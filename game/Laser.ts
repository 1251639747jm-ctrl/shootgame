import { Entity } from "./Entities";
import { EntityType, Vector2 } from "../types";
import { Player } from "./Entities";

/**
 * 终极歼星激光配置
 */
const LASER_THEME = {
    COLORS: {
        CORE: '#FFFFFF',          // 刺眼的白热核心
        INNER: '#00FFFF',         // 高能青色
        OUTER: '#0033FF',         // 深渊蓝晕染
        ELECTRIC: '#88FFFF',      // 闪电白青色
        SPARK: '#FFDD00'          // 溅射火花颜色
    },
    STATS: {
        BASE_DAMAGE: 150,         // 毁灭性基础伤害
        LENGTH: 2500,             // 贯穿全屏的长度
        WIDTH: 45,                // 极宽的光束
    },
    PHASES: {
        CHARGE: 0.2,              // 聚能吸附时间
        FIRE: 1.2,                // 持续轰击时间
        DECAY: 0.3                // 冷却消散时间
    }
};

/**
 * 内部专属粒子类：为激光提供伴生的高能火花飞溅效果
 */
class LaserSpark {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number;
    
    constructor(startX: number, startY: number, angle: number) {
        this.x = startX;
        this.y = startY;
        // 顺着激光方向带有随机散射的爆发力
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
    
    // ==========================================
    // 核心修复：引擎碰撞检测所必须的几何属性
    // ==========================================
    startPoint: Vector2 = { x: 0, y: 0 };
    endPoint: Vector2 = { x: 0, y: 0 };
    length: number = LASER_THEME.STATS.LENGTH;
    currentWidth: number = 0;

    // 视觉特效参数
    private sparks: LaserSpark[] =[];
    private shakeIntensity: number = 0;
    private colorOffset: number = 0;

    constructor(owner: Player) {
        super(owner.position.x, owner.position.y, EntityType.WEAPON_LASER);
        this.owner = owner;
        this.rotation = owner.rotation;
        this.radius = LASER_THEME.STATS.WIDTH * 0.5;
        this.updateGeometry();
    }

    /**
     * 更新几何坐标 (专门喂给引擎底层的碰撞检测器)
     */
    private updateGeometry() {
        this.rotation = this.owner.rotation;
        
        // 起点：飞船正前方枪口
        this.startPoint.x = this.owner.position.x + 45 * Math.sin(this.rotation);
        this.startPoint.y = this.owner.position.y - 45 * Math.cos(this.rotation);
        
        // 终点：延伸至屏幕外
        this.endPoint.x = this.startPoint.x + Math.sin(this.rotation) * this.length;
        this.endPoint.y = this.startPoint.y - Math.cos(this.rotation) * this.length;
        
        // 同步基类坐标
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

        // ==========================================
        // 状态机与伤害计算
        // ==========================================
        let damageMultiplier = 0;

        if (this.timer < LASER_THEME.PHASES.CHARGE) {
            // 阶段 1：聚能蓄力 (无伤害)
            this.phase = 'charge';
            const progress = this.timer / LASER_THEME.PHASES.CHARGE;
            this.currentWidth = progress * 10;
            this.shakeIntensity = progress * 2;
            
        } else if (this.timer < LASER_THEME.PHASES.CHARGE + LASER_THEME.PHASES.FIRE) {
            // 阶段 2：毁天灭地 (全额伤害)
            this.phase = 'fire';
            damageMultiplier = 1.0;
            // 激光脉动宽度
            this.currentWidth = LASER_THEME.STATS.WIDTH + Math.sin(this.timer * 40) * 8;
            this.shakeIntensity = 5; // 强烈的视觉震颤
            
            // 疯狂生成伴生火花
            for(let i=0; i<3; i++) {
                this.sparks.push(new LaserSpark(this.startPoint.x, this.startPoint.y, this.rotation));
            }
        } else if (this.timer < LASER_THEME.PHASES.CHARGE + LASER_THEME.PHASES.FIRE + LASER_THEME.PHASES.DECAY) {
            // 阶段 3：能量衰减 (伤害递减)
            this.phase = 'decay';
            const timeInDecay = this.timer - (LASER_THEME.PHASES.CHARGE + LASER_THEME.PHASES.FIRE);
            const progress = 1 - (timeInDecay / LASER_THEME.PHASES.DECAY);
            this.currentWidth = LASER_THEME.STATS.WIDTH * progress;
            damageMultiplier = progress;
            this.shakeIntensity = progress * 2;
        } else {
            // 结束
            this.markedForDeletion = true;
        }

        // --- 核心：给引擎注入伤害数值 ---
        const levelBoost = 1 + (this.owner.level * 0.25);
        (this as any).damage = LASER_THEME.STATS.BASE_DAMAGE * this.owner.damageMultiplier * levelBoost * damageMultiplier;

        // ==========================================
        // 修复：更新火花粒子 (修复了之前的数组对象调用错误)
        // ==========================================
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const spark = this.sparks;
            spark.update(dt);
            if (spark.life <= 0) {
                this.sparks.splice(i, 1);
            }
        }

        // 颜色偏移（用于色散特效）
        this.colorOffset = (performance.now() * 5) % this.length;
    }

    /**
     * 终极核能渲染逻辑
     */
    static draw(ctx: CanvasRenderingContext2D, laser: Laser) {
        const { x, y } = laser.startPoint;
        const rot = laser.rotation;
        const len = laser.length;
        const w = laser.currentWidth;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);

        // 模拟超高能武器的枪口后坐力震颤
        const jitterX = (Math.random() - 0.5) * laser.shakeIntensity;
        ctx.translate(jitterX, 0);

        ctx.globalCompositeOperation = 'lighter';

        if (laser.phase === 'charge') {
            Laser.drawChargeEffect(ctx, laser);
        } else {
            // --- 第一层：RGB色散/空间扭曲层 (极具张力的3A级视觉) ---
            Laser.drawAberrationGlow(ctx, len, w, laser);

            // --- 第二层：超宽等离子外晕 ---
            Laser.drawVolumeGlow(ctx, len, w);

            // --- 第三层：奔腾的能量主脉络 ---
            Laser.drawEnergyCore(ctx, len, w, laser.colorOffset);

            // --- 第四层：高频暴走电弧 ---
            Laser.drawLightning(ctx, len, w, laser.phase);

            // --- 第五层：纯白切割准线 ---
            Laser.drawHotCenter(ctx, len, w);
        }

        // --- 第六层：物理飞溅火花 ---
        Laser.drawSparks(ctx, laser);

        ctx.restore();
    }

    private static drawChargeEffect(ctx: CanvasRenderingContext2D, laser: Laser) {
        const progress = laser.timer / LASER_THEME.PHASES.CHARGE;
        const radius = 60 * (1 - progress); // 能量球向内坍缩
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = LASER_THEME.COLORS.INNER;
        ctx.strokeStyle = LASER_THEME.COLORS.ELECTRIC;
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.1, radius), 0, Math.PI * 2);
        ctx.stroke();
        
        // 细微的吸能线
        for(let i=0; i<4; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = radius * 1.5;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle)*dist, Math.sin(angle)*dist);
            ctx.lineTo(0,0);
            ctx.stroke();
        }
    }

    private static drawAberrationGlow(ctx: CanvasRenderingContext2D, len: number, w: number, laser: Laser) {
        // 模拟相机色散(Chromatic Aberration)的红蓝错位光晕
        const shift = laser.shakeIntensity * 1.5;
        
        ctx.globalAlpha = 0.4;
        // 偏红层
        ctx.fillStyle = 'rgba(255, 0, 100, 0.5)';
        ctx.fillRect(-w * 1.5 - shift, 0, w * 3, -len);
        
        // 偏蓝层
        ctx.fillStyle = 'rgba(0, 100, 255, 0.5)';
        ctx.fillRect(-w * 1.5 + shift, 0, w * 3, -len);
        ctx.globalAlpha = 1.0;
    }

    private static drawVolumeGlow(ctx: CanvasRenderingContext2D, len: number, w: number) {
        const grad = ctx.createLinearGradient(-w*2, 0, w*2, 0);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.3, LASER_THEME.COLORS.OUTER);
        grad.addColorStop(0.5, LASER_THEME.COLORS.INNER);
        grad.addColorStop(0.7, LASER_THEME.COLORS.OUTER);
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.fillRect(-w*2, 0, w*4, -len);
    }

    private static drawEnergyCore(ctx: CanvasRenderingContext2D, len: number, w: number, offset: number) {
        // 纵向滚动的明暗交替渐变，极速前冲的质感
        const grad = ctx.createLinearGradient(0, -offset, 0, -offset - len);
        for(let i = 0; i <= 1; i += 0.1) {
            grad.addColorStop(i, i % 0.2 < 0.1 ? LASER_THEME.COLORS.CORE : LASER_THEME.COLORS.INNER);
        }

        ctx.strokeStyle = grad;
        ctx.lineWidth = w * 0.7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -len);
        ctx.stroke();
    }

    private static drawLightning(ctx: CanvasRenderingContext2D, len: number, w: number, phase: string) {
        if (phase !== 'fire') return;
        
        ctx.strokeStyle = LASER_THEME.COLORS.ELECTRIC;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'miter';

        // 生成3条狂暴的电流
        for (let j = 0; j < 3; j++) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            let curY = 0;
            const step = 80; // 闪电节点间距
            
            while (curY > -len) {
                curY -= step + Math.random() * 40;
                // 电弧横向跳跃，超出激光主体的范围，显得极度危险
                const curX = (Math.random() - 0.5) * w * 3.5;
                ctx.lineTo(curX, curY);
            }
            ctx.stroke();
        }
    }

    private static drawHotCenter(ctx: CanvasRenderingContext2D, len: number, w: number) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = w * 0.25; // 极细的致命核心
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -len);
        ctx.stroke();
        
        // 枪口极亮光斑爆发
        const flashRadius = w * 2.5 + Math.random() * 20;
        const radGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, flashRadius);
        radGrad.addColorStop(0, '#FFFFFF');
        radGrad.addColorStop(0.2, LASER_THEME.COLORS.INNER);
        radGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(0, 0, flashRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    private static drawSparks(ctx: CanvasRenderingContext2D, laser: Laser) {
        ctx.fillStyle = LASER_THEME.COLORS.SPARK;
        for (const spark of laser.sparks) {
            const alpha = spark.life / spark.maxLife;
            ctx.globalAlpha = alpha;
            // 因为已经在 ctx.translate(x, y) 并且 ctx.rotate(rot) 了
            // spark 的坐标是世界坐标系，所以需要转换成局部坐标系来绘制
            // 简单处理：将当前画笔重置，直接在世界坐标系画粒子
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0); // 重置到屏幕原点
            ctx.translate(spark.x, spark.y);
            
            // 拉长火花模拟极速运动轨迹
            const speed = Math.sqrt(spark.vx*spark.vx + spark.vy*spark.vy);
            const angle = Math.atan2(spark.vy, spark.vx);
            ctx.rotate(angle);
            
            ctx.fillRect(0, -spark.size/2, spark.size * (1 + speed/50), spark.size);
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;
    }
}
