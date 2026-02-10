import { Entity, Enemy } from "./Entities";
import { EntityType, Vector2, WeaponType } from "../types";
import { Player } from "./Entities";

// --- 全局常数配置 ---
const MISSILE_CONFIG = {
    PHYSICS: {
        MAX_SPEED: 1200,            // 最大飞行速度 (px/s)
        LAUNCH_SPEED: 350,          // 初始发射速度
        ACCELERATION: 1800,         // 推进器加速度 (px/s²)
        TURN_SPEED_MAX: 5.5,        // 最大转弯速率 (rad/s)
        DRAG_COEFFICIENT: 0.02,     // 空气阻力系数
        PID_P: 4.5,                 // PID控制器-比例参数
        PID_I: 0.1,                 // PID控制器-积分参数
        PID_D: 0.8,                 // PID控制器-微分参数
    },
    THRUST: {
        BURN_TIME: 3.5,             // 推进器工作时间
        PULSE_RATE: 45,             // 尾焰脉动频率
        FLAME_SCALE: 2.8,           // 尾焰基础缩放（巨大尾焰关键点）
        CORE_TEMPERATURE: 2500,     // 模拟核心温度（影响颜色）
    },
    TARGETING: {
        SCAN_RADIUS: 1500,          // 雷达扫描范围
        LOST_TARGET_TIMEOUT: 1.0,   // 目标丢失后的自毁倒计时
        PREDICTION_STRENGTH: 0.85,   // 预测未来的权重 (0-1)
    }
};

/**
 * SECTION 1: 向量与姿态控制数学 (Vector & PID Math)
 */
class MissileMath {
    /** 计算拦截点：给定目标位置、目标速度、导弹位置和导弹速度 */
    static calculateIntercept(
        targetPos: Vector2,
        targetVel: Vector2,
        missilePos: Vector2,
        missileSpeed: number
    ): Vector2 {
        const relPos = { x: targetPos.x - missilePos.x, y: targetPos.y - missilePos.y };
        
        // 解二次方程: t²(v_e² - s_m²) + 2t(P_e · v_e) + P_e² = 0
        const a = targetVel.x * targetVel.x + targetVel.y * targetVel.y - missileSpeed * missileSpeed;
        const b = 2 * (relPos.x * targetVel.x + relPos.y * targetVel.y);
        const c = relPos.x * relPos.x + relPos.y * relPos.y;

        const disc = b * b - 4 * a * c;
        if (disc < 0) return targetPos; // 无法拦截则直接指向目标

        const t1 = (-b + Math.sqrt(disc)) / (2 * a);
        const t2 = (-b - Math.sqrt(disc)) / (2 * a);
        const t = Math.max(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);

        if (t < 0) return targetPos;

        return {
            x: targetPos.x + targetVel.x * t,
            y: targetPos.y + targetVel.y * t
        };
    }

    static getAngleDiff(target: number, current: number): number {
        let diff = target - current;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        return diff;
    }
}

/**
 * PID 控制器实现：防止导弹转向过于机械
 */
class PIDController {
    private p: number; private i: number; private d: number;
    private prevError: number = 0;
    private integral: number = 0;

    constructor(p: number, i: number, d: number) {
        this.p = p; this.i = i; this.d = d;
    }

    update(error: number, dt: number): number {
        this.integral += error * dt;
        const derivative = (error - this.prevError) / dt;
        this.prevError = error;
        return error * this.p + this.integral * this.i + derivative * this.d;
    }
}

/**
 * SECTION 2: 尾焰粒子引擎 (Plasma Exhaust Engine)
 * 负责生成巨大的、具有流体感的火焰效果。
 */
class ExhaustParticle {
    x: number; y: number;
    vx: number; vy: number;
    life: number; maxLife: number;
    size: number; color: string;

    constructor(x: number, y: number, vx: number, vy: number, maxLife: number, size: number, color: string) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.maxLife = maxLife;
        this.life = maxLife;
        this.size = size;
        this.color = color;
    }

    update(dt: number) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.size *= 0.96; // 逐渐变细
    }
}

/**
 * SECTION 3: 导弹实体核心 (The Missile Class)
 */
export class Missile extends Entity {
    // 目标系统
    public target: Enemy | null = null;
    private targetLostTimer: number = 0;
    
    // 物理系统
    private currentSpeed: number;
    private flightTime: number = 0;
    private pid: PIDController;
    private angularVelocity: number = 0;
    
    // 视觉系统
    private particles: ExhaustParticle[] = [];
    private engineActive: boolean = true;
    private trailTimer: number = 0;

    constructor(x: number, y: number, rotation: number, owner: Player) {
        super(x, y, EntityType.WEAPON_MISSILE);
        this.rotation = rotation;
        this.radius = 25;
        this.damage = 80 * (owner.damageMultiplier || 1);
        
        // 初始化速度
        this.currentSpeed = MISSILE_CONFIG.PHYSICS.LAUNCH_SPEED;
        this.velocity.x = Math.sin(rotation) * this.currentSpeed;
        this.velocity.y = -Math.cos(rotation) * this.currentSpeed;

        // 初始化PID转向控制器
        this.pid = new PIDController(
            MISSILE_CONFIG.PHYSICS.PID_P,
            MISSILE_CONFIG.PHYSICS.PID_I,
            MISSILE_CONFIG.PHYSICS.PID_D
        );
    }

    /**
     * 主更新逻辑
     */
    public update(dt: number, context?: any): void {
        this.flightTime += dt;
        this.trailTimer += dt;
        
        const entities = Array.isArray(context) ? context : [];

        // 1. 寻找目标逻辑 (基于雷达扫描)
        this.updateTargeting(entities);

        // 2. 推进系统逻辑
        this.updatePropulsion(dt);

        // 3. 姿态控制逻辑 (PID转向)
        this.updateGuidance(dt);

        // 4. 物理位移
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        // 5. 尾焰粒子生成
        this.updateExhaustParticles(dt);

        // 自毁逻辑
        if (this.flightTime > 6.0) this.markedForDeletion = true;
    }

    private updateTargeting(entities: Entity[]) {
        // 如果没有目标或目标已死，重新扫描
        if (!this.target || this.target.markedForDeletion) {
            this.target = null;
            let minDist = MISSILE_CONFIG.TARGETING.SCAN_RADIUS;
            
            entities.forEach(e => {
                if (e instanceof Enemy && !e.markedForDeletion) {
                    const d = Math.sqrt((e.position.x - this.position.x)**2 + (e.position.y - this.position.y)**2);
                    if (d < minDist) {
                        minDist = d;
                        this.target = e;
                    }
                }
            });

            if (!this.target) {
                this.targetLostTimer += 0.016; // 估计dt
                if (this.targetLostTimer > MISSILE_CONFIG.TARGETING.LOST_TARGET_TIMEOUT) {
                    this.engineActive = false; // 失去目标熄火自旋
                }
            } else {
                this.targetLostTimer = 0;
            }
        }
    }

    private updatePropulsion(dt: number) {
        if (this.flightTime < MISSILE_CONFIG.THRUST.BURN_TIME && this.engineActive) {
            // 加速阶段
            this.currentSpeed = Math.min(
                this.currentSpeed + MISSILE_CONFIG.PHYSICS.ACCELERATION * dt,
                MISSILE_CONFIG.PHYSICS.MAX_SPEED
            );
        } else {
            // 惯性阶段，受阻力影响
            this.currentSpeed *= (1 - MISSILE_CONFIG.PHYSICS.DRAG_COEFFICIENT);
            this.engineActive = false;
        }

        // 更新速度向量
        this.velocity.x = Math.sin(this.rotation) * this.currentSpeed;
        this.velocity.y = -Math.cos(this.rotation) * this.currentSpeed;
    }

    private updateGuidance(dt: number) {
        if (!this.target || !this.engineActive) return;

        // 获取预测拦截点
        const interceptPoint = MissileMath.calculateIntercept(
            this.target.position,
            (this.target as any).velocity || { x: 0, y: 0 },
            this.position,
            this.currentSpeed
        );

        // 计算目标偏角
        const dx = interceptPoint.x - this.position.x;
        const dy = interceptPoint.y - this.position.y;
        const targetAngle = Math.atan2(dx, -dy);

        // 使用PID计算角加速度
        const angleDiff = MissileMath.getAngleDiff(targetAngle, this.rotation);
        const torque = this.pid.update(angleDiff, dt);

        // 限制最大转向速率
        this.angularVelocity = Math.max(
            -MISSILE_CONFIG.PHYSICS.TURN_SPEED_MAX,
            Math.min(MISSILE_CONFIG.PHYSICS.TURN_SPEED_MAX, torque)
        );

        this.rotation += this.angularVelocity * dt;
    }

    private updateExhaustParticles(dt: number) {
        // 更新现有粒子
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }

        if (!this.engineActive) return;

        // 产生新粒子：巨大尾焰逻辑
        // 每一帧产生 3-5 个带有扰动的粒子
        const pCount = 3;
        for (let i = 0; i < pCount; i++) {
            const spread = 0.15;
            const pAngle = this.rotation + Math.PI + (Math.random() - 0.5) * spread;
            const pSpeed = this.currentSpeed * 0.5 + Math.random() * 200;
            
            const vx = Math.sin(pAngle) * pSpeed;
            const vy = -Math.cos(pAngle) * pSpeed;
            
            // 颜色从亮白到紫红色演变
            const colors = ['#ffffff', '#f0abfc', '#d946ef', '#701a75'];
            const color = colors[Math.floor(Math.random() * colors.length)];

            this.particles.push(new ExhaustParticle(
                this.position.x, 
                this.position.y,
                vx, vy,
                Math.random() * 0.4 + 0.2,
                Math.random() * 15 + 10,
                color
            ));
        }
    }

    /**
     * SECTION 4: 渲染逻辑 (The Visual Presentation)
     */
    static draw(ctx: CanvasRenderingContext2D, missile: Missile) {
        const { x, y } = missile.position;
        const scale = 2.2;

        ctx.save();
        
        // 1. 绘制粒子尾焰 (The Massive Plume)
        missile.drawPlume(ctx);

        // 2. 绘制导弹本体
        ctx.translate(x, y);
        ctx.rotate(missile.rotation);

        // 船体阴影
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(232, 121, 249, 0.5)';

        // 3. 过程化绘制弹体
        missile.drawHull(ctx, scale);

        ctx.restore();
    }

    private drawPlume(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        // 绘制每一个排气粒子
        this.particles.forEach(p => {
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
            grad.addColorStop(0, p.color);
            grad.addColorStop(1, 'transparent');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // 如果引擎开启，增加核心高亮
        if (this.engineActive) {
            const flicker = Math.sin(this.flightTime * 50) * 0.2 + 1.0;
            const plumeLen = 80 * flicker;
            const plumeWidth = 20 * flicker;

            const gradCore = ctx.createLinearGradient(0, 0, 0, plumeLen);
            gradCore.addColorStop(0, '#ffffff');
            gradCore.addColorStop(0.2, '#f0abfc');
            gradCore.addColorStop(1, 'transparent');

            ctx.translate(this.position.x, this.position.y);
            ctx.rotate(this.rotation + Math.PI);
            
            ctx.fillStyle = gradCore;
            ctx.beginPath();
            ctx.moveTo(-plumeWidth/2, 0);
            ctx.quadraticCurveTo(0, plumeLen * 1.2, plumeWidth/2, 0);
            ctx.fill();
        }
        ctx.restore();
    }

    private drawHull(ctx: CanvasRenderingContext2D, s: number) {
        // 弹体渐变色
        const hullGrad = ctx.createLinearGradient(-6*s, 0, 6*s, 0);
        hullGrad.addColorStop(0, '#2e1065'); // 深紫
        hullGrad.addColorStop(0.5, '#a21caf'); // 亮紫
        hullGrad.addColorStop(1, '#2e1065');

        ctx.fillStyle = hullGrad;
        ctx.strokeStyle = '#f5d0fe';
        ctx.lineWidth = 1.2;

        // 1. 主弹体 (尖头长方体)
        ctx.beginPath();
        ctx.moveTo(0, -18*s);       // 鼻锥
        ctx.bezierCurveTo(7*s, -12*s, 7*s, -8*s, 6*s, 12*s); // 右侧
        ctx.lineTo(-6*s, 12*s);     // 底部
        ctx.bezierCurveTo(-7*s, -8*s, -7*s, -12*s, 0, -18*s); // 左侧
        ctx.fill();
        ctx.stroke();

        // 2. 细节线条 (面板缝隙)
        ctx.beginPath();
        ctx.moveTo(-6*s, 0);
        ctx.lineTo(6*s, 0);
        ctx.moveTo(-6*s, 6*s);
        ctx.lineTo(6*s, 6*s);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.stroke();

        // 3. 尾部翼片 (尾翼)
        ctx.fillStyle = '#4a044e';
        // 左尾翼
        ctx.beginPath();
        ctx.moveTo(-6*s, 5*s);
        ctx.lineTo(-14*s, 14*s);
        ctx.lineTo(-6*s, 11*s);
        ctx.fill();
        ctx.stroke();
        // 右尾翼
        ctx.beginPath();
        ctx.moveTo(6*s, 5*s);
        ctx.lineTo(14*s, 14*s);
        ctx.lineTo(6*s, 11*s);
        ctx.fill();
        ctx.stroke();

        // 4. 引导头闪光 (战斗部就绪状态)
        if (this.target) {
            const blink = Math.sin(Date.now() * 0.01) > 0;
            ctx.fillStyle = blink ? '#ff0000' : '#440000';
            ctx.beginPath();
            ctx.arc(0, -14*s, 1.5*s, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
