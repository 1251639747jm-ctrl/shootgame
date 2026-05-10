import { Player } from "./Entities";

/**
 * ============================================================================================
 * TYPE-ZERO INTERCEPTOR RENDERER v4.0 — "RAVEN"
 * ============================================================================================
 * 
 * 视觉风格：Cyber-Industrial, 细节更精致
 * 新增：
 *   - 精细化机翼武器挂架 & 导弹
 *   - 双层座舱 (反射条 + 内部仪表光)
 *   - 机腹面板铆钉 / 散热槽
 *   - 全模型 bank 时移动的高光
 *   - 重新设计的离子尾焰 (双色双层 + 马赫环)
 *   - 侧向 RCS 补正喷口
 *   - 前缘翼灯 + 尾舵闪烁灯
 */

const SHIP_CONFIG = {
    SCALE: 1.0,
    BANKING_STRENGTH: 0.25,
    COLORS: {
        HULL_DARK: '#0b1225',
        HULL_MID: '#1e2e4a',
        HULL_LIGHT: '#3b4f7a',
        HIGHLIGHT: '#93c5fd',
        ACCENT: '#0ea5e9',
        COCKPIT_TOP: '#fde68a',
        COCKPIT_MID: '#f59e0b',
        COCKPIT_LOW: '#7c2d12',
        ENGINE_CORE: '#e0fdff',
        ENGINE_MID: '#22d3ee',
        ENGINE_OUTER: '#0ea5e9'
    }
};

export class PlayerModel {
    /**
     * 主渲染入口
     */
    static draw(ctx: CanvasRenderingContext2D, player: Player) {
        const { x, y } = player.position;
        const time = performance.now() / 1000;

        // --- 1. 计算物理状态 ---
        const bankAngle = (player.velocity.x / 400) * SHIP_CONFIG.BANKING_STRENGTH;
        const clampedBank = Math.max(-0.4, Math.min(0.4, bankAngle));

        const thrustLevel = player.velocity.y < -10 ? 1.0 : 0.45;
        const speedShake = (Math.random() - 0.5) * (thrustLevel > 0.8 ? 1.4 : 0);

        ctx.save();
        ctx.translate(x + speedShake, y + speedShake);
        ctx.rotate(player.rotation + clampedBank);
        ctx.scale(SHIP_CONFIG.SCALE, SHIP_CONFIG.SCALE);

        // --- 2. 按层次绘制 ---

        // Layer A: 引擎尾焰
        this.drawEngineExhaust(ctx, thrustLevel, time);

        // Layer B: RCS 喷口
        this.drawRCSThrusters(ctx, player.velocity.x, time);

        // Layer C: 机身下层
        this.drawUnderstructure(ctx);

        // Layer D: 机翼 (内含武器挂架)
        this.drawWing(ctx, -1);
        this.drawWing(ctx,  1);

        // Layer E: 主机身
        this.drawMainHull(ctx, clampedBank);

        // Layer F: 前缘翼灯 / 外侧细节
        this.drawNavigationLights(ctx, time);

        // Layer G: 座舱
        this.drawCockpit(ctx, time);

        // Layer H: 充能特效
        if (player.isCharging) {
            this.drawChargingEffect(ctx, player.chargeLevel, time);
        }

        ctx.restore();
    }

    // =========================================================
    // 引擎尾焰 (双层 + 马赫环 + 喷口亮斑)
    // =========================================================
    private static drawEngineExhaust(ctx: CanvasRenderingContext2D, intensity: number, time: number) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const baseLen = 28 + intensity * 38;
        const flicker = Math.sin(time * 60) * 0.08 + 0.92;
        const len = baseLen * flicker;

        const engineY = 25;
        const engines = [-10, 10];

        engines.forEach(ex => {
            // 外层 (宽而淡)
            const outer = ctx.createLinearGradient(ex, engineY, ex, engineY + len);
            outer.addColorStop(0, 'rgba(14, 165, 233, 0.8)');
            outer.addColorStop(0.4, 'rgba(34, 211, 238, 0.5)');
            outer.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = outer;
            ctx.beginPath();
            ctx.moveTo(ex - 7, engineY);
            ctx.lineTo(ex + 7, engineY);
            ctx.lineTo(ex + 2, engineY + len);
            ctx.lineTo(ex - 2, engineY + len);
            ctx.closePath();
            ctx.fill();

            // 内层高温核心
            const inner = ctx.createLinearGradient(ex, engineY, ex, engineY + len * 0.75);
            inner.addColorStop(0, SHIP_CONFIG.COLORS.ENGINE_CORE);
            inner.addColorStop(0.5, SHIP_CONFIG.COLORS.ENGINE_MID);
            inner.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = inner;
            ctx.beginPath();
            ctx.moveTo(ex - 3, engineY);
            ctx.lineTo(ex + 3, engineY);
            ctx.lineTo(ex + 0.5, engineY + len * 0.75);
            ctx.lineTo(ex - 0.5, engineY + len * 0.75);
            ctx.closePath();
            ctx.fill();

            // 喷口亮斑
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(ex, engineY - 1, 2.2, 0, Math.PI * 2);
            ctx.fill();
        });

        // 马赫环 (高推力时显示)
        if (intensity > 0.8) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            for (let i = 1; i < 4; i++) {
                const dy = engineY + (len * 0.22 * i);
                const w = Math.max(1, 5 - i);
                engines.forEach(ex => {
                    ctx.beginPath();
                    ctx.ellipse(ex, dy, w, 1.6, 0, 0, Math.PI * 2);
                    ctx.fill();
                });
            }
        }

        ctx.restore();
    }

    // =========================================================
    // 姿态喷口 (RCS)
    // =========================================================
    private static drawRCSThrusters(ctx: CanvasRenderingContext2D, velX: number, time: number) {
        if (Math.abs(velX) < 10) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(200, 255, 255, 0.7)';

        const flareSize = (Math.sin(time * 40) + 2) * 2;

        if (velX < -10) {
            this.drawFlare(ctx, 32, -2, flareSize, Math.PI / 4);
            this.drawFlare(ctx, 32, 18, flareSize, Math.PI / 2);
        }
        if (velX > 10) {
            this.drawFlare(ctx, -32, -2, flareSize, -Math.PI / 4);
            this.drawFlare(ctx, -32, 18, flareSize, -Math.PI / 2);
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
        ctx.lineTo( 2, len);
        ctx.fill();
        ctx.restore();
    }

    // =========================================================
    // 下层结构 (机身-机翼连接)
    // =========================================================
    private static drawUnderstructure(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.moveTo(0, -38);
        ctx.lineTo(22, 22);
        ctx.lineTo(0, 32);
        ctx.lineTo(-22, 22);
        ctx.fill();

        // 黑色中线阴影
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -35);
        ctx.lineTo(0, 28);
        ctx.stroke();
    }

    // =========================================================
    // 主装甲 (机身 + 面板线 + 散热口)
    // =========================================================
    private static drawMainHull(ctx: CanvasRenderingContext2D, bank: number) {
        // 机身渐变 (高光跟随侧倾移动)
        const grad = ctx.createLinearGradient(-20, 0, 20, 0);
        grad.addColorStop(0, SHIP_CONFIG.COLORS.HULL_DARK);
        grad.addColorStop(Math.max(0, Math.min(1, 0.5 - bank * 0.8)), SHIP_CONFIG.COLORS.HULL_LIGHT);
        grad.addColorStop(1, SHIP_CONFIG.COLORS.HULL_DARK);

        ctx.fillStyle = grad;
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;

        // 主机身 (arrowhead)
        ctx.beginPath();
        ctx.moveTo(0, -44);
        ctx.lineTo(9, -12);
        ctx.lineTo(9, 22);
        ctx.lineTo(0, 30);
        ctx.lineTo(-9, 22);
        ctx.lineTo(-9, -12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 高光边缘 (沿鼻锥左侧)
        ctx.strokeStyle = `rgba(147, 197, 253, ${0.35 + Math.max(0, bank) * 1.5})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -42); ctx.lineTo(-8, -12);
        ctx.stroke();
        ctx.strokeStyle = `rgba(147, 197, 253, ${0.35 + Math.max(0, -bank) * 1.5})`;
        ctx.beginPath();
        ctx.moveTo(0, -42); ctx.lineTo(8, -12);
        ctx.stroke();

        // 面板线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -32); ctx.lineTo(0, 22);
        ctx.moveTo(-9, -10); ctx.lineTo(9, -10);
        ctx.moveTo(-9, 8); ctx.lineTo(9, 8);
        ctx.stroke();

        // 鼻锥前缘的蓝色能量条
        ctx.fillStyle = SHIP_CONFIG.COLORS.ACCENT;
        ctx.fillRect(-1, -38, 2, 24);
        ctx.fillStyle = 'rgba(224, 253, 255, 0.95)';
        ctx.fillRect(-0.4, -38, 0.8, 24);

        // 散热槽
        ctx.fillStyle = '#000000';
        ctx.fillRect(-6, 14, 3, 8);
        ctx.fillRect( 3, 14, 3, 8);

        // 铆钉
        ctx.fillStyle = '#0b1225';
        [[-5, -22], [5, -22], [-6, 2], [6, 2], [-5, 18], [5, 18]].forEach(([rx, ry]) => {
            ctx.beginPath(); ctx.arc(rx, ry, 0.9, 0, Math.PI * 2); ctx.fill();
        });
    }

    // =========================================================
    // 机翼 (带武器挂架 + 导弹)
    // =========================================================
    private static drawWing(ctx: CanvasRenderingContext2D, dir: number) {
        ctx.save();
        ctx.scale(dir, 1);

        // 机翼渐变
        const wingGrad = ctx.createLinearGradient(0, 0, 40, 0);
        wingGrad.addColorStop(0, '#334155');
        wingGrad.addColorStop(1, '#0b1225');

        ctx.fillStyle = wingGrad;
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(9, -8);
        ctx.lineTo(38, 12);
        ctx.lineTo(38, 24);
        ctx.lineTo(22, 34);
        ctx.lineTo(9, 22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 机翼表面细节线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.moveTo(12, 2); ctx.lineTo(32, 18);
        ctx.moveTo(14, 10); ctx.lineTo(30, 22);
        ctx.stroke();

        // 武器挂架 (pylon)
        ctx.fillStyle = '#111827';
        ctx.fillRect(19, 12, 5, 18);

        // 挂载导弹 (白色弹体 + 红色鼻锥 + 四片尾翼)
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(19.5, 14, 4, 14);
        // 鼻锥
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(19.5, 14);
        ctx.lineTo(23.5, 14);
        ctx.lineTo(21.5, 10);
        ctx.closePath();
        ctx.fill();
        // 尾翼
        ctx.fillStyle = '#374151';
        ctx.fillRect(18, 24, 1.5, 5);
        ctx.fillRect(23.5, 24, 1.5, 5);

        // 翼尖灯 (左红/右绿 外部根据 dir 翻转)
        const tipColor = dir === -1 ? '#ef4444' : '#22c55e';
        ctx.fillStyle = tipColor;
        ctx.fillRect(35, 20, 3, 3);
        // 翼尖小高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(35.5, 20.5, 1, 1);

        ctx.restore();
    }

    // =========================================================
    // 导航灯 (顶面闪烁灯)
    // =========================================================
    private static drawNavigationLights(ctx: CanvasRenderingContext2D, time: number) {
        const blink = (Math.sin(time * 6) + 1) / 2;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(248, 250, 252, ${0.2 + blink * 0.6})`;
        ctx.beginPath(); ctx.arc(0, -2, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(147, 197, 253, ${0.2 + (1 - blink) * 0.6})`;
        ctx.beginPath(); ctx.arc(0, 12, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // =========================================================
    // 座舱 (琥珀玻璃 + 反射光 + 内部仪表辉光)
    // =========================================================
    private static drawCockpit(ctx: CanvasRenderingContext2D, time: number) {
        // 外壳
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(0, -30); ctx.lineTo(5, -14); ctx.lineTo(0, -10); ctx.lineTo(-5, -14);
        ctx.closePath();
        ctx.fill();

        // 玻璃渐变
        const grad = ctx.createLinearGradient(0, -28, 0, -10);
        grad.addColorStop(0, SHIP_CONFIG.COLORS.COCKPIT_TOP);
        grad.addColorStop(0.5, SHIP_CONFIG.COLORS.COCKPIT_MID);
        grad.addColorStop(1, SHIP_CONFIG.COLORS.COCKPIT_LOW);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -28);
        ctx.lineTo(3.8, -14);
        ctx.lineTo(0, -11);
        ctx.lineTo(-3.8, -14);
        ctx.closePath();
        ctx.fill();

        // 内部仪表反射 (轻微脉动)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const beat = 0.4 + Math.sin(time * 3) * 0.15;
        ctx.fillStyle = `rgba(253, 224, 71, ${beat})`;
        ctx.beginPath();
        ctx.arc(0, -16, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 高光反射条
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath();
        ctx.moveTo(-0.5, -26);
        ctx.lineTo(1.2, -18);
        ctx.lineTo(-0.2, -16);
        ctx.closePath();
        ctx.fill();

        // 细边框
        ctx.strokeStyle = 'rgba(120, 53, 15, 0.8)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, -28); ctx.lineTo(3.8, -14); ctx.lineTo(0, -11); ctx.lineTo(-3.8, -14);
        ctx.closePath();
        ctx.stroke();
    }

    // =========================================================
    // 蓄力特效 (机头能量汇聚)
    // =========================================================
    private static drawChargingEffect(ctx: CanvasRenderingContext2D, level: number, time: number) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const pct = level / 100;
        const radius = 5 + pct * 16;

        // 核心光球
        const grad = ctx.createRadialGradient(0, -44, 0, 0, -44, radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, '#0ea5e9');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, -44, radius, 0, Math.PI * 2);
        ctx.fill();

        // 汇聚电弧
        if (pct > 0.3) {
            ctx.strokeStyle = '#e0f2fe';
            ctx.lineWidth = 1.5;
            const arcCount = Math.floor(pct * 5);

            for (let i = 0; i < arcCount; i++) {
                const angle = time * 10 + i * (Math.PI * 2 / arcCount);
                const dist = 30 - pct * 20;
                const sx = Math.cos(angle) * dist;
                const sy = -44 + Math.sin(angle) * dist;

                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(0, -44);
                ctx.stroke();
            }
        }

        ctx.restore();
    }
}
