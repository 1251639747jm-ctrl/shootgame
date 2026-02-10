import { Player } from "./Entities";

/**
 * ============================================================================================
 * TYPE-ZERO INTERCEPTOR RENDERER v3.0
 * ============================================================================================
 * 
 * 视觉风格：Cyber-Industrial
 * 核心技术：
 * 1. 动态侧倾 (Dynamic Banking): 根据 X轴速度计算机身旋转角度。
 * 2. 程序化纹理 (Procedural Texturing): 使用 Canvas API 绘制面板线和铆钉。
 * 3. 矢量尾焰 (Vector Exhaust): 引擎火焰随推力波动。
 */

const SHIP_CONFIG = {
    SCALE: 1.0,
    BANKING_STRENGTH: 0.25, // 侧倾灵敏度 (0-1)
    COLORS: {
        HULL_DARK: '#0f172a',
        HULL_LIGHT: '#334155',
        ACCENT: '#0ea5e9', // 霓虹蓝
        COCKPIT: '#f59e0b', // 琥珀色
        ENGINE_CORE: '#ccfbf1',
        ENGINE_OUTER: '#06b6d4'
    }
};

export class PlayerModel {
    /**
     * 主渲染入口
     */
    static draw(ctx: CanvasRenderingContext2D, player: Player) {
        const { x, y } = player.position;
        const time = Date.now() / 1000;
        
        // --- 1. 计算物理状态 ---
        // 侧倾角：根据水平速度模拟飞机转弯时的倾斜
        const bankAngle = (player.velocity.x / 400) * SHIP_CONFIG.BANKING_STRENGTH;
        // 限制最大侧倾角
        const clampedBank = Math.max(-0.4, Math.min(0.4, bankAngle));
        
        // 推力强度：根据垂直速度判断是否加速
        // 假设向上(-y)是加速
        const thrustLevel = player.velocity.y < -10 ? 1.0 : 0.4;
        const speedShake = (Math.random() - 0.5) * (thrustLevel > 0.8 ? 2 : 0);

        ctx.save();
        ctx.translate(x + speedShake, y + speedShake);
        ctx.rotate(player.rotation + clampedBank); // 叠加侧倾角
        ctx.scale(SHIP_CONFIG.SCALE, SHIP_CONFIG.SCALE);

        // --- 2. 绘制层级 ---
        
        // Layer A: 引擎尾焰 (最底层)
        this.drawEngineExhaust(ctx, thrustLevel, time);

        // Layer B: 姿态调整喷口 (RCS)
        this.drawRCSThrusters(ctx, player.velocity.x, time);

        // Layer C: 机身下层结构 (阴影与机械连接)
        this.drawUnderstructure(ctx);

        // Layer D: 主装甲与机翼
        this.drawMainHull(ctx, clampedBank);

        // Layer E: 座舱玻璃
        this.drawCockpit(ctx);

        // Layer F: 充能特效 (覆盖在机身上)
        if (player.isCharging) {
            this.drawChargingEffect(ctx, player.chargeLevel, time);
        }

        // Layer G: 护盾 (最顶层)
        // 假设 player 有 shieldActive 属性，如果没有可以忽略
        if ((player as any).shieldActive || (player as any).hp > 100) { // 简单判定有护盾
            this.drawEnergyShield(ctx, time);
        }

        ctx.restore();
    }

    /**
     * 绘制复杂的离子引擎尾焰
     */
    private static drawEngineExhaust(ctx: CanvasRenderingContext2D, intensity: number, time: number) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        const baseLen = 25 + intensity * 35;
        const flicker = Math.sin(time * 60) * 0.1 + 0.9;
        const len = baseLen * flicker;

        // 主引擎位置偏移
        const engineY = 25;
        const engineX_L = -8;
        const engineX_R = 8;

        // 渐变定义
        const grad = ctx.createLinearGradient(0, engineY, 0, engineY + len);
        grad.addColorStop(0, SHIP_CONFIG.COLORS.ENGINE_CORE);
        grad.addColorStop(0.3, SHIP_CONFIG.COLORS.ENGINE_OUTER);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;

        // 左引擎
        ctx.beginPath();
        ctx.moveTo(engineX_L - 4, engineY);
        ctx.lineTo(engineX_L + 4, engineY);
        ctx.lineTo(engineX_L, engineY + len);
        ctx.fill();

        // 右引擎
        ctx.beginPath();
        ctx.moveTo(engineX_R - 4, engineY);
        ctx.lineTo(engineX_R + 4, engineY);
        ctx.lineTo(engineX_R, engineY + len);
        ctx.fill();

        // 冲击波环 (Shock diamonds)
        if (intensity > 0.8) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            for(let i=1; i<3; i++) {
                const dy = engineY + (len * 0.3 * i);
                const w = 6 - i;
                ctx.beginPath();
                ctx.ellipse(engineX_L, dy, w, 2, 0, 0, Math.PI*2);
                ctx.ellipse(engineX_R, dy, w, 2, 0, 0, Math.PI*2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    /**
     * 绘制姿态控制喷口 (Reaction Control System)
     * 当飞船左右移动时喷射
     */
    private static drawRCSThrusters(ctx: CanvasRenderingContext2D, velX: number, time: number) {
        if (Math.abs(velX) < 10) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(200, 255, 255, 0.6)';

        const flareSize = (Math.sin(time * 40) + 2) * 2;
        
        // 向左飞 -> 右侧喷口喷射
        if (velX < -10) {
            this.drawFlare(ctx, 18, -5, flareSize, Math.PI / 4); // 右前翼
            this.drawFlare(ctx, 18, 15, flareSize, Math.PI / 2); // 右后翼
        }
        
        // 向右飞 -> 左侧喷口喷射
        if (velX > 10) {
            this.drawFlare(ctx, -18, -5, flareSize, -Math.PI / 4); // 左前翼
            this.drawFlare(ctx, -18, 15, flareSize, -Math.PI / 2); // 左后翼
        }

        ctx.restore();
    }

    private static drawFlare(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-2, len);
        ctx.lineTo(2, len);
        ctx.fill();
        ctx.restore();
    }

    /**
     * 绘制机械连接层 (连接机翼和机身的黑色结构)
     */
    private static drawUnderstructure(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(0, -35);
        ctx.lineTo(20, 20);
        ctx.lineTo(0, 30);
        ctx.lineTo(-20, 20);
        ctx.fill();
    }

    /**
     * 绘制主装甲 (Main Hull)
     * 包含复杂的面板线和光影
     */
    private static drawMainHull(ctx: CanvasRenderingContext2D, bank: number) {
        // 机身渐变 (模拟金属光泽)
        const grad = ctx.createLinearGradient(-20, 0, 20, 0);
        grad.addColorStop(0, SHIP_CONFIG.COLORS.HULL_DARK);
        grad.addColorStop(0.5 - bank * 0.3, SHIP_CONFIG.COLORS.HULL_LIGHT); // 高光随侧倾移动
        grad.addColorStop(1, SHIP_CONFIG.COLORS.HULL_DARK);

        ctx.fillStyle = grad;
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;

        // 1. 主机身形状 (Arrowhead)
        ctx.beginPath();
        ctx.moveTo(0, -42); // 鼻锥
        ctx.lineTo(8, -10);
        ctx.lineTo(8, 20);
        ctx.lineTo(0, 28);
        ctx.lineTo(-8, 20);
        ctx.lineTo(-8, -10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 2. 左翼 (Forward Swept Wing look)
        this.drawWing(ctx, -1, bank);
        
        // 3. 右翼
        this.drawWing(ctx, 1, bank);

        // 4. 表面细节 (面板线)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, -30); ctx.lineTo(0, 20); // 中轴线
        ctx.moveTo(-8, -10); ctx.lineTo(8, -10); // 横切线
        ctx.stroke();
        
        // 5. 散热口
        ctx.fillStyle = '#000000';
        ctx.fillRect(-6, 15, 4, 8);
        ctx.fillRect(2, 15, 4, 8);
    }

    private static drawWing(ctx: CanvasRenderingContext2D, dir: number, bank: number) {
        // dir: -1 for left, 1 for right
        ctx.save();
        ctx.scale(dir, 1); // 镜像绘制

        const wingGrad = ctx.createLinearGradient(0, 0, 40, 0);
        wingGrad.addColorStop(0, '#334155');
        wingGrad.addColorStop(1, '#0f172a');

        ctx.fillStyle = wingGrad;
        ctx.strokeStyle = '#64748b';

        ctx.beginPath();
        ctx.moveTo(8, -8);
        ctx.lineTo(35, 10);  // 翼尖前缘
        ctx.lineTo(35, 22);  // 翼尖
        ctx.lineTo(20, 32);  // 翼根后缘
        ctx.lineTo(8, 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 翼尖灯
        ctx.fillStyle = dir === -1 ? '#ef4444' : '#22c55e'; // 左红右绿
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 5;
        ctx.fillRect(33, 18, 3, 3);
        ctx.shadowBlur = 0;

        // 武器挂载点细节
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(20, 10, 4, 15);

        ctx.restore();
    }

    /**
     * 绘制座舱 (Cockpit)
     */
    private static drawCockpit(ctx: CanvasRenderingContext2D) {
        const grad = ctx.createLinearGradient(0, -25, 0, -5);
        grad.addColorStop(0, '#f59e0b'); // 金色顶部
        grad.addColorStop(0.5, '#d97706'); 
        grad.addColorStop(1, '#78350f'); // 暗色底部
        
        ctx.fillStyle = grad;
        // 玻璃反射光
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(4, -15);
        ctx.lineTo(0, -12);
        ctx.lineTo(-4, -15);
        ctx.closePath();
        ctx.fill();

        // 高光反射条
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.moveTo(0, -26);
        ctx.lineTo(2, -18);
        ctx.lineTo(0, -16);
        ctx.fill();
    }

    /**
     * 蓄力特效 (Charging)
     * 能量汇聚于机头，伴随电弧
     */
    private static drawChargingEffect(ctx: CanvasRenderingContext2D, level: number, time: number) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        const pct = level / 100;
        const radius = 5 + pct * 15;
        const color = `rgba(0, 255, 255, ${pct})`;

        // 核心光球
        const grad = ctx.createRadialGradient(0, -42, 0, 0, -42, radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#0ea5e9');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, -42, radius, 0, Math.PI * 2);
        ctx.fill();

        // 汇聚电弧 (Imploding Arcs)
        if (pct > 0.3) {
            ctx.strokeStyle = '#e0f2fe';
            ctx.lineWidth = 1.5;
            const arcCount = Math.floor(pct * 5);
            
            for(let i=0; i<arcCount; i++) {
                const angle = time * 10 + i * (Math.PI * 2 / arcCount);
                const dist = 30 - pct * 20; // 越充能越近
                const sx = Math.cos(angle) * dist;
                const sy = -42 + Math.sin(angle) * dist;
                
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(0, -42);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    /**
     * 能量护盾 (Energy Shield)
     * 六边形蜂窝网格力场
     */
    private static drawEnergyShield(ctx: CanvasRenderingContext2D, time: number) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        const radius = 55;
        const alpha = Math.abs(Math.sin(time * 2)) * 0.15 + 0.05;
        
        // 1. 护盾边缘
        ctx.strokeStyle = `rgba(14, 165, 233, ${alpha + 0.2})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 5, radius, 0, Math.PI * 2);
        ctx.stroke();

        // 2. 护盾填充 (微弱的蓝色)
        ctx.fillStyle = `rgba(14, 165, 233, ${alpha * 0.3})`;
        ctx.fill();

        // 3. 扫描线效果 (Holographic Scanline)
        ctx.beginPath();
        ctx.arc(0, 5, radius, 0, Math.PI * 2);
        ctx.clip(); // 限制绘制区域在圆内

        const scanY = (time * 100) % (radius * 2) - radius;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-radius, 5 + scanY);
        ctx.lineTo(radius, 5 + scanY);
        ctx.stroke();

        ctx.restore();
    }
}
