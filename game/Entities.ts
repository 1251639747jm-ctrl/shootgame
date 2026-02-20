import { EntityType, WeaponType } from "../types";
import { EnemyModel } from "./EnemyModel"; // 引入上一轮优化的渲染器

// ==========================================
// 核心数学库 (内联优化以减少函数调用开销)
// ==========================================
const Vec2 = {
    add: (v1: {x:number, y:number}, v2: {x:number, y:number}) => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
    sub: (v1: {x:number, y:number}, v2: {x:number, y:number}) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
    mag: (v: {x:number, y:number}) => Math.sqrt(v.x * v.x + v.y * v.y),
    lerp: (a: number, b: number, t: number) => a + (b - a) * t,
    distSq: (v1: {x:number, y:number}, v2: {x:number, y:number}) => (v1.x - v2.x)**2 + (v1.y - v2.y)**2
};

/**
 * 基础实体抽象类
 * 实现了基于欧拉积分的物理运动与空间哈希所需的边界盒
 */
export abstract class Entity {
    public id: string = crypto.randomUUID();
    public position: { x: number; y: number };
    public velocity: { x: number; y: number } = { x: 0, y: 0 };
    public acceleration: { x: number; y: number } = { x: 0, y: 0 };
    
    public radius: number;
    public rotation: number = 0;
    public isDead: boolean = false;
    
    // 物理属性
    protected friction: number = 0.95; // 空气阻力 (0-1)
    protected mass: number = 1.0;

    constructor(x: number, y: number, radius: number) {
        this.position = { x, y };
        this.radius = radius;
    }

    /**
     * 物理核心更新 (dt: 秒)
     */
    update(dt: number) {
        // 1. 速度更新 (v = v0 + at)
        this.velocity.x += this.acceleration.x * dt;
        this.velocity.y += this.acceleration.y * dt;

        // 2. 阻尼衰减 (模拟大气摩擦)
        // 使用 time-step independent damping 公式: vel *= pow(damping, dt * 60)
        const d = Math.pow(this.friction, dt * 60);
        this.velocity.x *= d;
        this.velocity.y *= d;

        // 3. 位移更新 (x = x0 + vt)
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        // 4. 重置瞬时力
        this.acceleration = { x: 0, y: 0 };
    }

    /**
     * 施加力向量 (F = ma -> a = F/m)
     */
    applyForce(x: number, y: number) {
        this.acceleration.x += x / this.mass;
        this.acceleration.y += y / this.mass;
    }

    abstract draw(ctx: CanvasRenderingContext2D): void;
}

/**
 * ==========================================
 * 玩家战机 (Player)
 * ==========================================
 */
export class Player extends Entity {
    public health: number = 100;
    public maxHealth: number = 100;
    public energy: number = 100;
    
    // 状态机
    public shieldActive: boolean = false;
    public weaponLevel: number = 1;
    
    // 视觉平滑属性
    private targetRotation: number = 0;
    private engineThrust: number = 0;

    constructor(x: number, y: number) {
        super(x, y, 22); // 碰撞半径
        this.friction = 0.92; // 较高的阻力以获得精准操控感
        this.mass = 1.2;
    }

    update(dt: number) {
        super.update(dt);

        // 1. 动态侧倾 (Banking): 根据横向速度计算机身倾斜角
        // 速度越快，倾斜角度越大，最大倾斜 25度 (0.45 rad)
        const maxBankAngle = 0.45;
        const targetBank = (this.velocity.x / 600) * maxBankAngle;
        this.rotation = Vec2.lerp(this.rotation, targetBank, dt * 8);

        // 2. 能量自动恢复
        if (this.energy < 100 && !this.shieldActive) {
            this.energy += dt * 5;
        }

        // 3. 边界约束 (弹性墙壁)
        if (this.position.x < 30) this.applyForce(2000, 0);
        if (this.position.x > window.innerWidth - 30) this.applyForce(-2000, 0);
    }

    draw(ctx: CanvasRenderingContext2D) {
        // 调用我们之前写好的复杂渲染逻辑 (这里假设它在 Entity 内部，或者外部 Helper)
        // 由于 Player 比较特殊且通常单例，我们可以直接在这里写渲染，
        // 或者复用之前的 EnemyModel 风格的 PlayerModel
        this.renderPlayer(ctx);
    }

    // 也就是上一轮提供的 Player 渲染逻辑
    private renderPlayer(ctx: CanvasRenderingContext2D) {
        const { x, y } = this.position;
        const t = performance.now() / 1000;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(this.rotation);

        // --- 引擎尾焰 ---
        const thrust = 1 + Math.sin(t * 30) * 0.1; 
        this.drawEngine(ctx, 0, 18, 8, 32 * thrust); // 主
        this.drawEngine(ctx, -14, 12, 4, 16 * thrust); // 左副
        this.drawEngine(ctx, 14, 12, 4, 16 * thrust); // 右副

        // --- 机体 ---
        // 底部阴影层
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(0, -32); ctx.lineTo(24, 16); ctx.lineTo(0, 24); ctx.lineTo(-24, 16);
        ctx.fill();

        // 顶部装甲层 (金属光泽)
        const grad = ctx.createLinearGradient(-15, -20, 15, 20);
        grad.addColorStop(0, '#e2e8f0');
        grad.addColorStop(0.5, '#64748b');
        grad.addColorStop(1, '#1e293b');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -28); ctx.lineTo(12, 8); ctx.lineTo(0, 14); ctx.lineTo(-12, 8);
        ctx.fill();

        // 驾驶舱发光
        ctx.fillStyle = '#0ea5e9';
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.ellipse(0, -8, 3, 6, 0, 0, Math.PI*2); ctx.fill();
        
        // --- 护盾 ---
        if (this.shieldActive) {
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + Math.sin(t*10)*0.2})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI*2); ctx.stroke();
        }

        ctx.restore();
    }

    private drawEngine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, '#bae6fd'); // 核心白蓝
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(x, y + h/2, w/2, h/2, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }
}

/**
 * ==========================================
 * 敌人 (Enemy)
 * ==========================================
 */
export class Enemy extends Entity {
    public type: EntityType;
    public health: number;
    public maxHealth: number;
    
    // AI 专用变量
    private aiPhase: number = Math.random() * 100;
    private anchorY: number; // 悬停基准线

    constructor(x: number, y: number, type: EntityType) {
        super(x, y, 20);
        this.type = type;
        this.anchorY = y;
        
        // 根据类型初始化数值
        switch(type) {
            case EntityType.ENEMY_BOSS:
                this.health = 5000; this.radius = 80; this.friction = 0.98; break;
            case EntityType.ENEMY_TANK:
                this.health = 300; this.radius = 40; this.friction = 0.95; break;
            case EntityType.ENEMY_FAST:
                this.health = 40; this.radius = 15; this.friction = 0.99; break; // 极低阻力
            default: // BASIC
                this.health = 60; this.radius = 20; this.friction = 0.95; break;
        }
        this.maxHealth = this.health;
    }

    update(dt: number) {
        super.update(dt);
        this.aiPhase += dt;

        // --- 简易 AI 行为树 ---
        switch(this.type) {
            case EntityType.ENEMY_BASIC:
                // 正弦波下落
                this.velocity.y = 80;
                this.velocity.x = Math.sin(this.aiPhase * 2) * 100;
                this.rotation = Math.sin(this.aiPhase * 2) * 0.3;
                break;

            case EntityType.ENEMY_FAST:
                // 高速S型穿插
                this.velocity.y = 350;
                this.velocity.x = Math.cos(this.aiPhase * 5) * 250;
                // 强制朝向速度方向
                this.rotation = Math.atan2(this.velocity.y, this.velocity.x) - Math.PI/2;
                break;

            case EntityType.ENEMY_TANK:
                // 缓慢推进 + 阻尼感
                this.velocity.y = 40;
                break;

            case EntityType.ENEMY_BOSS:
                // 8字形悬停
                const targetX = window.innerWidth/2 + Math.sin(this.aiPhase * 0.5) * 300;
                const targetY = 150 + Math.sin(this.aiPhase) * 50;
                // 弹性跟随
                this.velocity.x += (targetX - this.position.x) * dt * 2;
                this.velocity.y += (targetY - this.position.y) * dt * 2;
                this.rotation = (this.velocity.x / 500) * 0.2;
                break;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        // ★ 核心连接点：调用外部优化好的 EnemyModel 进行渲染
        EnemyModel.draw(ctx, this);
    }
}

/**
 * ==========================================
 * 子弹 (Bullet) - 极致视觉
 * ==========================================
 */
export class Bullet extends Entity {
    public isEnemy: boolean;
    public damage: number;
    
    constructor(x: number, y: number, angle: number, isEnemy: boolean) {
        super(x, y, isEnemy ? 6 : 4);
        this.isEnemy = isEnemy;
        this.friction = 1.0; // 子弹无阻力
        this.damage = isEnemy ? 10 : 25;
        this.rotation = angle;

        const speed = isEnemy ? 400 : 1200;
        this.velocity.x = Math.sin(angle) * speed;
        this.velocity.y = -Math.cos(angle) * speed;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation);
        
        ctx.globalCompositeOperation = 'lighter';

        if (this.isEnemy) {
            // 敌方：脉冲等离子球 (不稳定的红/橙)
            const pulse = 1 + Math.sin(performance.now() / 50) * 0.2;
            // 外光晕
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 12 * pulse);
            g.addColorStop(0, 'rgba(239, 68, 68, 1)');
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(0, 0, 12 * pulse, 0, Math.PI*2); ctx.fill();
            // 核心
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
        } else {
            // 玩家：超高速激光束 (流体拉伸感)
            // 使用线性渐变模拟光剑效果
            const len = 30;
            const w = 4;
            const g = ctx.createLinearGradient(0, -len, 0, len);
            g.addColorStop(0, 'rgba(56, 189, 248, 0)'); // 尾部透明
            g.addColorStop(0.5, '#38bdf8'); // 中段青蓝
            g.addColorStop(1, '#ffffff'); // 头部极致亮白

            ctx.fillStyle = g;
            ctx.beginPath();
            // 绘制一个两头尖中间宽的梭形
            ctx.moveTo(0, -len);
            ctx.quadraticCurveTo(w, 0, 0, len);
            ctx.quadraticCurveTo(-w, 0, 0, -len);
            ctx.fill();
        }

        ctx.restore();
    }
}

/**
 * ==========================================
 * 粒子 (Particle) - 运动模糊技术
 * ==========================================
 */
export class Particle extends Entity {
    public life: number;
    public maxLife: number;
    public color: string;

    constructor(x: number, y: number, color: string, speed: number, life: number) {
        super(x, y, 0); // 粒子不需要碰撞半径
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.friction = 0.94; // 粒子会有较强的阻力

        // 随机爆炸方向
        const angle = Math.random() * Math.PI * 2;
        const v = Math.random() * speed;
        this.velocity = {
            x: Math.cos(angle) * v,
            y: Math.sin(angle) * v
        };
    }

    update(dt: number) {
        super.update(dt);
        this.life -= dt;
        if (this.life <= 0) this.isDead = true;
    }

    draw(ctx: CanvasRenderingContext2D) {
        const progress = this.life / this.maxLife; // 1.0 -> 0.0
        
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(this.position.x, this.position.y);

        // ★ 运动模糊核心：计算速度的大小，将其作为粒子的长度
        const speed = Vec2.mag(this.velocity);
        // 限制最大拉伸长度，避免过长
        const length = Math.min(speed * 0.06, 20); 
        
        // 旋转画布到速度方向
        const angle = Math.atan2(this.velocity.y, this.velocity.x);
        ctx.rotate(angle);

        // 绘制流星状线条 (头部不透明，尾部透明)
        const g = ctx.createLinearGradient(0, 0, -length, 0);
        g.addColorStop(0, this.color);
        g.addColorStop(1, 'transparent'); // 尾迹消失

        ctx.strokeStyle = g;
        ctx.lineWidth = 2 * progress; // 随时间变细
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-length, 0); // 向速度反方向延伸
        ctx.stroke();

        ctx.restore();
    }
}
