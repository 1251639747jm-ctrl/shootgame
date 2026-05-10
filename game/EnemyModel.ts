import { Enemy } from "./Entities";
import { EntityType } from "../types";

/**
 * 敌人模型统一渲染入口
 * 每个子渲染函数都已 translate + rotate 到敌人本体坐标, 朝下为 +y。
 */
export class EnemyModel {
    static draw(ctx: CanvasRenderingContext2D, enemy: Enemy) {
        const { x, y } = enemy.position;
        const time = performance.now() / 1000;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(enemy.rotation);

        switch (enemy.type) {
            case EntityType.ENEMY_BASIC:
                this.renderBasic(ctx, time);
                break;
            case EntityType.ENEMY_FAST:
                this.renderFast(ctx, time);
                break;
            case EntityType.ENEMY_TANK:
                this.renderTank(ctx, time);
                break;
            case EntityType.ENEMY_KAMIKAZE:
                this.renderKamikaze(ctx, time);
                break;
            case EntityType.ENEMY_SHIELDER:
                this.renderShielder(ctx, enemy, time);
                break;
            case EntityType.ENEMY_SNIPER:
                this.renderSniper(ctx, enemy, time);
                break;
            case EntityType.ENEMY_SWARMER:
                this.renderSwarmer(ctx, time);
                break;
            case EntityType.ENEMY_BOSS:
                this.renderBoss(ctx, enemy, time);
                break;
            case EntityType.ENEMY_BOSS_CARRIER:
                this.renderBossCarrier(ctx, enemy, time);
                break;
            case EntityType.ENEMY_BOSS_REAVER:
                this.renderBossReaver(ctx, enemy, time);
                break;
        }

        ctx.restore();
    }

    // =========================================================
    // 基础侦察机 —— 紫色甲壳 + 单眼
    // =========================================================
    private static renderBasic(ctx: CanvasRenderingContext2D, t: number) {
        const flicker = Math.sin(t * 15) * 0.2 + 0.8;

        // 引擎尾焰
        this.drawEnginePlume(ctx, -8, 12, 5, 18 * flicker, '#a855f7', '#f3e8ff');
        this.drawEnginePlume(ctx,  8, 12, 5, 18 * flicker, '#a855f7', '#f3e8ff');

        // 底层机翼 (深色衬底)
        ctx.fillStyle = '#1e1b4b';
        ctx.strokeStyle = '#4c1d95';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.quadraticCurveTo(22, -5, 20, 15);
        ctx.lineTo(10, 20); ctx.lineTo(0, 10); ctx.lineTo(-10, 20);
        ctx.lineTo(-20, 15); ctx.quadraticCurveTo(-22, -5, 0, -24);
        ctx.fill(); ctx.stroke();

        // 顶层装甲板
        const armorGrad = ctx.createLinearGradient(-15, -20, 15, 10);
        armorGrad.addColorStop(0, '#6d28d9');
        armorGrad.addColorStop(0.5, '#8b5cf6');
        armorGrad.addColorStop(1, '#3b0764');
        ctx.fillStyle = armorGrad;
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.quadraticCurveTo(12, -2, 12, 10);
        ctx.lineTo(0, 5);
        ctx.lineTo(-12, 10);
        ctx.quadraticCurveTo(-12, -2, 0, -20);
        ctx.fill();

        // 铆钉
        ctx.fillStyle = '#2e1065';
        ctx.beginPath(); ctx.arc(-7, -4, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc( 7, -4, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-6,  6, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc( 6,  6, 1.2, 0, Math.PI * 2); ctx.fill();

        // 高光边缘
        ctx.strokeStyle = 'rgba(216, 180, 254, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -20); ctx.quadraticCurveTo(12, -2, 12, 10);
        ctx.stroke();

        // 复眼
        ctx.globalCompositeOperation = 'lighter';
        const eyeGrad = ctx.createRadialGradient(0, -5, 0, 0, -5, 7);
        eyeGrad.addColorStop(0, '#ffffff');
        eyeGrad.addColorStop(0.35, '#c084fc');
        eyeGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = eyeGrad;
        ctx.beginPath(); ctx.arc(0, -5, 9, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // 眼瞳
        ctx.fillStyle = '#1e1b4b';
        ctx.beginPath(); ctx.arc(0, -5, 2.2, 0, Math.PI * 2); ctx.fill();
    }

    // =========================================================
    // 快速拦截机 —— 青色流线 + 运动模糊
    // =========================================================
    private static renderFast(ctx: CanvasRenderingContext2D, t: number) {
        const pulse = Math.sin(t * 25) * 0.3 + 0.7;

        // 主引擎长尾焰
        this.drawEnginePlume(ctx, 0, 15, 6, 38 * pulse, '#06b6d4', '#ecfeff');

        // 翼尖能量拉烟
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(34, 211, 238, ${pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-24, 12); ctx.lineTo(-24, 25 + 5 * pulse);
        ctx.moveTo( 24, 12); ctx.lineTo( 24, 25 + 5 * pulse);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';

        // 针式机身底盘
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(0, -35);
        ctx.lineTo(8, -10); ctx.lineTo(26, 15); ctx.lineTo(10, 15);
        ctx.lineTo(0, 20);
        ctx.lineTo(-10, 15); ctx.lineTo(-26, 15); ctx.lineTo(-8, -10);
        ctx.closePath();
        ctx.fill();

        // 核心装甲
        const hullGrad = ctx.createLinearGradient(-10, -30, 10, 20);
        hullGrad.addColorStop(0, '#0891b2');
        hullGrad.addColorStop(0.4, '#22d3ee');
        hullGrad.addColorStop(1, '#164e63');
        ctx.fillStyle = hullGrad;
        ctx.beginPath();
        ctx.moveTo(0, -32); ctx.lineTo(5, -8); ctx.lineTo(15, 10);
        ctx.lineTo(0, 15); ctx.lineTo(-15, 10); ctx.lineTo(-5, -8);
        ctx.closePath();
        ctx.fill();

        // 驾驶舱
        const canopy = ctx.createLinearGradient(0, -22, 0, -6);
        canopy.addColorStop(0, '#e0f2fe');
        canopy.addColorStop(1, '#155e75');
        ctx.fillStyle = canopy;
        ctx.beginPath();
        ctx.moveTo(0, -22); ctx.lineTo(3.5, -10); ctx.lineTo(0, -5); ctx.lineTo(-3.5, -10);
        ctx.fill();

        // 能量刻线
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -5); ctx.lineTo(0, 15);
        ctx.moveTo(-5, -8); ctx.lineTo(-24, 12);
        ctx.moveTo( 5, -8); ctx.lineTo( 24, 12);
        ctx.stroke();

        // 翼尖 LED
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(-25, 11, 2, 2);
        ctx.fillRect( 23, 11, 2, 2);
    }

    // =========================================================
    // 重型坦克 —— 履带 + 双联装重炮
    // =========================================================
    private static renderTank(ctx: CanvasRenderingContext2D, t: number) {
        // 引擎排气 (底部 4 个口)
        [-20, -10, 10, 20].forEach(ex => {
            this.drawEnginePlume(ctx, ex, 26, 6, 14, '#ea580c', '#fef08a');
        });

        // 履带舱 (左右各一块金属板)
        const trackGrad = ctx.createLinearGradient(-45, 0, -30, 0);
        trackGrad.addColorStop(0, '#1c1917');
        trackGrad.addColorStop(1, '#44403c');
        ctx.fillStyle = trackGrad;
        ctx.fillRect(-45, -15, 15, 45);
        ctx.fillRect( 30, -15, 15, 45);

        // 履带纹理
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = -10; i < 28; i += 6) {
            ctx.moveTo(-45, i); ctx.lineTo(-30, i);
            ctx.moveTo( 30, i); ctx.lineTo( 45, i);
        }
        ctx.stroke();

        // 主装甲块
        const armorGrad = ctx.createLinearGradient(0, -30, 0, 30);
        armorGrad.addColorStop(0, '#9a3412');
        armorGrad.addColorStop(0.5, '#c2410c');
        armorGrad.addColorStop(1, '#7c2d12');
        ctx.fillStyle = armorGrad;
        ctx.strokeStyle = '#fdba74';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(-20, -28); ctx.lineTo(20, -28);
        ctx.lineTo(35, -10); ctx.lineTo(35, 25);
        ctx.lineTo(-35, 25); ctx.lineTo(-35, -10);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 装甲面板线
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-35, 5); ctx.lineTo(35, 5);
        ctx.moveTo(0, -28); ctx.lineTo(0, -5);
        ctx.stroke();

        // 散热格栅
        ctx.fillStyle = '#f97316';
        for (let i = -15; i <= 15; i += 10) {
            ctx.fillRect(i - 2, 15, 4, 6);
        }

        // 发光警戒灯
        const warn = 0.5 + Math.sin(t * 6) * 0.5;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(251, 191, 36, ${warn})`;
        ctx.beginPath(); ctx.arc(-28,  0, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc( 28,  0, 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // 炮塔圆座
        ctx.fillStyle = '#292524';
        ctx.beginPath(); ctx.arc(0, -5, 16, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 双联装炮管
        ctx.fillStyle = '#57534e';
        ctx.fillRect(-8, 0, 4, 38);
        ctx.fillRect( 4, 0, 4, 38);
        // 制退器
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(-10, 32, 8, 8);
        ctx.fillRect( 2,  32, 8, 8);
    }

    // =========================================================
    // 自爆死士 —— 红色尖刺不稳定能量体
    // =========================================================
    private static renderKamikaze(ctx: CanvasRenderingContext2D, t: number) {
        const alert = Math.sin(t * 30) > 0;
        const pulse = 1 + Math.sin(t * 15) * 0.1;

        // 危险光晕
        ctx.globalCompositeOperation = 'lighter';
        const glowR = alert ? 35 : 25;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.6)');
        grad.addColorStop(0.4, 'rgba(220, 38, 38, 0.3)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, glowR, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // 尖刺外骨骼
        ctx.fillStyle = '#450a0a';
        ctx.strokeStyle = '#b91c1c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -35);
        ctx.lineTo(16, 12); ctx.lineTo(6, 6);
        ctx.lineTo(12, 20); ctx.lineTo(0, 10);
        ctx.lineTo(-12, 20); ctx.lineTo(-6, 6);
        ctx.lineTo(-16, 12);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 外壳裂缝 (警告条纹)
        ctx.strokeStyle = alert ? '#fca5a5' : '#7f1d1d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-8, -5); ctx.lineTo(8, -5);
        ctx.moveTo(-5,  0); ctx.lineTo(5,  0);
        ctx.stroke();

        // 核心点 (闪烁)
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = alert ? '#ffffff' : '#fca5a5';
        ctx.beginPath();
        ctx.arc(0, -5, 6 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    // =========================================================
    // 盾卫 —— 钢铁堡垒, 正面六角能量护盾
    // =========================================================
    private static renderShielder(ctx: CanvasRenderingContext2D, enemy: Enemy, t: number) {
        // 双引擎
        this.drawEnginePlume(ctx, -14, 18, 5, 14, '#0284c7', '#bae6fd');
        this.drawEnginePlume(ctx,  14, 18, 5, 14, '#0284c7', '#bae6fd');

        // 下层钢架
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(-30, -5); ctx.lineTo(-22, -22);
        ctx.lineTo(22, -22); ctx.lineTo(30, -5);
        ctx.lineTo(22, 22); ctx.lineTo(-22, 22);
        ctx.closePath();
        ctx.fill();

        // 主装甲 (厚重钢灰 + 蓝色条纹)
        const armorGrad = ctx.createLinearGradient(0, -25, 0, 20);
        armorGrad.addColorStop(0, '#475569');
        armorGrad.addColorStop(0.5, '#64748b');
        armorGrad.addColorStop(1, '#1e293b');
        ctx.fillStyle = armorGrad;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-25, -2); ctx.lineTo(-18, -20);
        ctx.lineTo(18, -20); ctx.lineTo(25, -2);
        ctx.lineTo(18, 18); ctx.lineTo(-18, 18);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 中央蓝色能量条
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(-3, -18, 6, 32);
        ctx.fillStyle = 'rgba(186, 230, 253, 0.8)';
        ctx.fillRect(-1, -18, 2, 32);

        // 两侧小炮
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-20, 10, 4, 16);
        ctx.fillRect( 16, 10, 4, 16);
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(-20, 22, 4, 4);
        ctx.fillRect( 16, 22, 4, 4);

        // 正面六边形护盾 (仅当有盾时绘制)
        if (enemy.shieldHealth > 0 && enemy.maxShieldHealth > 0) {
            const ratio = enemy.shieldHealth / enemy.maxShieldHealth;
            const flashBoost = enemy.shieldFlashTimer > 0 ? 0.6 : 0;
            const pulse = 0.35 + Math.sin(t * 4) * 0.08 + flashBoost;

            ctx.save();
            ctx.globalCompositeOperation = 'lighter';

            // 外发光
            const shieldR = 30;
            const glow = ctx.createRadialGradient(0, 20, 0, 0, 20, shieldR + 10);
            glow.addColorStop(0, `rgba(14, 165, 233, ${0.35 * ratio + flashBoost * 0.5})`);
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(0, 20, shieldR + 10, 0, Math.PI * 2); ctx.fill();

            // 六边形盾 (正面朝下)
            ctx.strokeStyle = `rgba(125, 211, 252, ${0.7 * ratio + flashBoost})`;
            ctx.lineWidth = 2.5;
            ctx.fillStyle = `rgba(14, 165, 233, ${pulse * ratio})`;

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const ang = Math.PI / 6 + (i * Math.PI) / 3;
                const px = Math.cos(ang) * shieldR;
                const py = 20 + Math.sin(ang) * shieldR;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 盾内蜂窝纹
            ctx.strokeStyle = `rgba(186, 230, 253, ${0.35 * ratio})`;
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                const ang = (i * Math.PI) / 3;
                ctx.beginPath();
                ctx.moveTo(-Math.cos(ang) * shieldR * 0.9, 20 - Math.sin(ang) * shieldR * 0.9);
                ctx.lineTo( Math.cos(ang) * shieldR * 0.9, 20 + Math.sin(ang) * shieldR * 0.9);
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    // =========================================================
    // 狙击机 —— 长管狙击炮 + 预瞄红线
    // =========================================================
    private static renderSniper(ctx: CanvasRenderingContext2D, enemy: Enemy, t: number) {
        // 预瞄激光 (开火前 0.8s)
        if (enemy.isAiming) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const blink = 0.5 + Math.sin(t * 30) * 0.4;
            ctx.strokeStyle = `rgba(248, 113, 113, ${blink})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(0, 18);
            ctx.lineTo(0, 900); // 指向屏幕下方
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // 底层机翼
        ctx.fillStyle = '#052e16';
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -22);
        ctx.lineTo(18, -6); ctx.lineTo(22, 8); ctx.lineTo(10, 10);
        ctx.lineTo(0, 16);
        ctx.lineTo(-10, 10); ctx.lineTo(-22, 8); ctx.lineTo(-18, -6);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 主机身 (墨绿金属)
        const hull = ctx.createLinearGradient(-8, -20, 8, 14);
        hull.addColorStop(0, '#14532d');
        hull.addColorStop(0.5, '#16a34a');
        hull.addColorStop(1, '#052e16');
        ctx.fillStyle = hull;
        ctx.beginPath();
        ctx.moveTo(0, -22); ctx.lineTo(6, -5); ctx.lineTo(6, 10);
        ctx.lineTo(0, 14); ctx.lineTo(-6, 10); ctx.lineTo(-6, -5);
        ctx.closePath();
        ctx.fill();

        // 光学狙击瞄具 (前端大凸透镜)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-5, -18, 10, 8);
        ctx.fillStyle = 'rgba(134, 239, 172, 0.9)';
        ctx.beginPath();
        ctx.arc(0, -14, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#052e16';
        ctx.beginPath();
        ctx.arc(0, -14, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // 长管主炮 (伸出机头)
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(-1.5, 4, 3, 22);
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(-2.5, 22, 5, 4);

        // 侧面弹仓
        ctx.fillStyle = '#14532d';
        ctx.fillRect(-14, 2, 3, 8);
        ctx.fillRect( 11, 2, 3, 8);

        // 闪烁指示灯
        const blink = enemy.isAiming ? (Math.sin(t * 40) * 0.5 + 0.5) : 0.3;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(248, 113, 113, ${blink})`;
        ctx.beginPath(); ctx.arc(0, -2, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    // =========================================================
    // 蜂群无人机 —— 小型三角, 黄色能量核
    // =========================================================
    private static renderSwarmer(ctx: CanvasRenderingContext2D, t: number) {
        const pulse = 0.7 + Math.sin(t * 18) * 0.3;

        // 尾焰
        this.drawEnginePlume(ctx, 0, 10, 3, 10, '#f59e0b', '#fef3c7');

        // 机身黑色三角
        ctx.fillStyle = '#18181b';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(11, 10); ctx.lineTo(0, 5); ctx.lineTo(-11, 10);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 中央黄色核心
        ctx.globalCompositeOperation = 'lighter';
        const core = ctx.createRadialGradient(0, -2, 0, 0, -2, 8);
        core.addColorStop(0, '#fde68a');
        core.addColorStop(0.4, `rgba(245, 158, 11, ${pulse})`);
        core.addColorStop(1, 'transparent');
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(0, -2, 8, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // 核心亮点
        ctx.fillStyle = '#fffbeb';
        ctx.beginPath(); ctx.arc(0, -2, 1.6, 0, Math.PI * 2); ctx.fill();
    }

    // =========================================================
    // Boss 旗舰 —— 歼星级, 复杂机械结构
    // =========================================================
    private static renderBoss(ctx: CanvasRenderingContext2D, enemy: Enemy, t: number) {
        const s = 1.8;
        const hpRatio = enemy.health / enemy.maxHealth;
        const isEnraged = hpRatio < 0.3;

        const mainColor = isEnraged ? '#facc15' : '#38bdf8';
        const darkMetal = '#0f172a';
        const panelMetal = '#1e293b';

        // 引擎阵列
        [-40, -25, -10, 10, 25, 40].forEach(ex => {
            this.drawEnginePlume(ctx, ex * s, 45 * s, 10 * s, 30 * s, isEnraged ? '#ea580c' : '#0284c7', '#fff');
        });

        // 底盘阴影
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.moveTo(0, -85 * s);
        ctx.lineTo(40 * s, -50 * s); ctx.lineTo(90 * s, 20 * s);
        ctx.lineTo(60 * s, 60 * s); ctx.lineTo(-60 * s, 60 * s);
        ctx.lineTo(-90 * s, 20 * s); ctx.lineTo(-40 * s, -50 * s);
        ctx.closePath();
        ctx.fill();

        // 主甲板装甲
        const deckGrad = ctx.createLinearGradient(-80 * s, 0, 80 * s, 0);
        deckGrad.addColorStop(0, darkMetal);
        deckGrad.addColorStop(0.5, panelMetal);
        deckGrad.addColorStop(1, darkMetal);
        ctx.fillStyle = deckGrad;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2 * s;

        ctx.beginPath();
        ctx.moveTo(0, -75 * s);
        ctx.lineTo(35 * s, -45 * s); ctx.lineTo(80 * s, 10 * s);
        ctx.lineTo(50 * s, 55 * s); ctx.lineTo(-50 * s, 55 * s);
        ctx.lineTo(-80 * s, 10 * s); ctx.lineTo(-35 * s, -45 * s);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 舰桥结构
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(0, -40 * s); ctx.lineTo(25 * s, -10 * s); ctx.lineTo(25 * s, 40 * s);
        ctx.lineTo(-25 * s, 40 * s); ctx.lineTo(-25 * s, -10 * s);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 战壕灯光
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(-20 * s, 0); ctx.lineTo(-20 * s, 35 * s);
        ctx.moveTo( 20 * s, 0); ctx.lineTo( 20 * s, 35 * s);
        ctx.stroke();

        // 武器阵列
        ctx.fillStyle = '#1e293b';
        [-65, 65].forEach(wx => {
            ctx.fillRect((wx - 5) * s, 10 * s, 10 * s, 25 * s);
            ctx.save();
            ctx.fillStyle = mainColor;
            ctx.fillRect((wx - 2) * s, 35 * s, 4 * s, 5 * s);
            ctx.restore();
        });

        // 反应堆
        const pulse = 1 + Math.sin(t * (isEnraged ? 20 : 8)) * 0.15;
        const coreY = -15 * s;

        ctx.fillStyle = '#334155';
        ctx.beginPath(); ctx.arc(0, coreY, 24 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#020617';
        ctx.beginPath(); ctx.arc(0, coreY, 20 * s, 0, Math.PI * 2); ctx.fill();

        ctx.globalCompositeOperation = 'lighter';
        const rGrad = ctx.createRadialGradient(0, coreY, 0, 0, coreY, 28 * s * pulse);
        rGrad.addColorStop(0, '#ffffff');
        rGrad.addColorStop(0.2, isEnraged ? '#fef08a' : '#bae6fd');
        rGrad.addColorStop(0.6, isEnraged ? 'rgba(239, 68, 68, 0.8)' : 'rgba(14, 165, 233, 0.8)');
        rGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = rGrad;
        ctx.beginPath(); ctx.arc(0, coreY, 28 * s * pulse, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, coreY - 15 * s * pulse); ctx.lineTo(0, coreY + 15 * s * pulse);
        ctx.moveTo(-15 * s * pulse, coreY); ctx.lineTo(15 * s * pulse, coreY);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
    }

    // =========================================================
    // BOSS · CARRIER —— 航母舰，甲板中央黄色跑道
    // =========================================================
    private static renderBossCarrier(ctx: CanvasRenderingContext2D, enemy: Enemy, t: number) {
        const s = 1.8;
        const hpRatio = enemy.health / enemy.maxHealth;
        const isEnraged = hpRatio < 0.3;
        const accent = isEnraged ? '#f472b6' : '#ec4899';

        // 引擎阵列 (底部 4 个巨型引擎)
        [-55, -20, 20, 55].forEach(ex => {
            this.drawEnginePlume(ctx, ex * s, 48 * s, 12 * s, 34 * s, isEnraged ? '#db2777' : '#a21caf', '#fce7f3');
        });

        // 外壳阴影
        ctx.fillStyle = '#1a0b1f';
        ctx.beginPath();
        ctx.moveTo(-95 * s, -15 * s);
        ctx.lineTo(-80 * s, -55 * s);
        ctx.lineTo( 80 * s, -55 * s);
        ctx.lineTo( 95 * s, -15 * s);
        ctx.lineTo( 70 * s,  55 * s);
        ctx.lineTo(-70 * s,  55 * s);
        ctx.closePath();
        ctx.fill();

        // 甲板主体 (宽扁)
        const deck = ctx.createLinearGradient(0, -50 * s, 0, 55 * s);
        deck.addColorStop(0, '#3f0f4a');
        deck.addColorStop(0.5, '#2e1065');
        deck.addColorStop(1, '#1a0b1f');
        ctx.fillStyle = deck;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(-85 * s, -10 * s);
        ctx.lineTo(-72 * s, -48 * s);
        ctx.lineTo( 72 * s, -48 * s);
        ctx.lineTo( 85 * s, -10 * s);
        ctx.lineTo( 62 * s,  48 * s);
        ctx.lineTo(-62 * s,  48 * s);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 飞行甲板跑道 (中心发光线)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const runway = ctx.createLinearGradient(0, -40 * s, 0, 40 * s);
        runway.addColorStop(0, 'rgba(250, 204, 21, 0.05)');
        runway.addColorStop(0.5, 'rgba(250, 204, 21, 0.35)');
        runway.addColorStop(1, 'rgba(250, 204, 21, 0.05)');
        ctx.fillStyle = runway;
        ctx.fillRect(-18 * s, -40 * s, 36 * s, 80 * s);
        ctx.restore();

        // 跑道中线 (虚线流光)
        ctx.save();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2;
        const dashOffset = (t * 60) % 24;
        ctx.setLineDash([10, 14]);
        ctx.lineDashOffset = -dashOffset;
        ctx.beginPath();
        ctx.moveTo(0, -40 * s); ctx.lineTo(0, 40 * s);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 两侧机库门 (动态开合)
        const bayOpen = 0.5 + Math.sin(t * 1.5) * 0.5;
        ctx.fillStyle = '#1f2937';
        // 左机库外框
        ctx.fillRect(-62 * s, -15 * s, 30 * s, 30 * s);
        ctx.fillRect( 32 * s, -15 * s, 30 * s, 30 * s);
        // 机库内部 (随开合变亮)
        ctx.fillStyle = `rgba(253, 224, 71, ${0.15 + bayOpen * 0.5})`;
        ctx.fillRect(-60 * s, -13 * s + (1 - bayOpen) * 12 * s, 26 * s, 26 * s * bayOpen);
        ctx.fillRect( 34 * s, -13 * s + (1 - bayOpen) * 12 * s, 26 * s, 26 * s * bayOpen);

        // 舰岛 (指挥塔, 偏右)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(20 * s, -40 * s, 20 * s, 22 * s);
        ctx.fillStyle = accent;
        ctx.fillRect(22 * s, -38 * s, 16 * s, 4 * s);
        ctx.fillStyle = 'rgba(253, 224, 71, 0.7)';
        ctx.fillRect(24 * s, -30 * s, 12 * s, 2 * s);

        // 周边警示灯
        const blink = Math.sin(t * 5) > 0;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = blink ? accent : '#7e22ce';
        [[-75, -25], [75, -25], [-68, 40], [68, 40]].forEach(([bx, by]) => {
            ctx.beginPath(); ctx.arc(bx * s, by * s, 3, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';

        // 中央反应堆 (较小, 集中在舰体后部)
        const pulse = 1 + Math.sin(t * 6) * 0.15;
        const coreY = 25 * s;
        ctx.fillStyle = '#0f172a';
        ctx.beginPath(); ctx.arc(-30 * s, coreY, 10 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc( 30 * s, coreY, 10 * s, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        [-30, 30].forEach(cx => {
            const grad = ctx.createRadialGradient(cx * s, coreY, 0, cx * s, coreY, 14 * s * pulse);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(0.4, accent);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(cx * s, coreY, 14 * s * pulse, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
    }

    // =========================================================
    // BOSS · REAVER —— 敏捷劫掠者, 猩红利刃造型
    // =========================================================
    private static renderBossReaver(ctx: CanvasRenderingContext2D, enemy: Enemy, t: number) {
        const s = 1.6;
        const hpRatio = enemy.health / enemy.maxHealth;
        const isEnraged = hpRatio < 0.3;
        const accent = isEnraged ? '#fde047' : '#ef4444';

        // 3 个大引擎
        this.drawEnginePlume(ctx, -25 * s, 38 * s, 9 * s, 28 * s, '#dc2626', '#fecaca');
        this.drawEnginePlume(ctx,   0,     42 * s, 11 * s, 36 * s, '#dc2626', '#fecaca');
        this.drawEnginePlume(ctx,  25 * s, 38 * s, 9 * s, 28 * s, '#dc2626', '#fecaca');

        // 旋转的利刃机翼 (4 把)
        const rot = t * (isEnraged ? 2.4 : 1.2);
        ctx.save();
        for (let i = 0; i < 4; i++) {
            ctx.save();
            ctx.rotate(rot + (i * Math.PI) / 2);
            // 刀刃背面
            const blade = ctx.createLinearGradient(0, 0, 0, 60 * s);
            blade.addColorStop(0, '#7f1d1d');
            blade.addColorStop(0.6, '#b91c1c');
            blade.addColorStop(1, '#111');
            ctx.fillStyle = blade;
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-6, 0);
            ctx.lineTo(6, 0);
            ctx.lineTo(10, 55 * s);
            ctx.lineTo(0, 65 * s);
            ctx.lineTo(-10, 55 * s);
            ctx.closePath();
            ctx.fill(); ctx.stroke();

            // 刀刃高光
            ctx.strokeStyle = 'rgba(254, 202, 202, 0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 5); ctx.lineTo(0, 60 * s);
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();

        // 核心装甲 (六边形战车)
        const hull = ctx.createRadialGradient(0, 0, 0, 0, 0, 50 * s);
        hull.addColorStop(0, '#b91c1c');
        hull.addColorStop(0.4, '#7f1d1d');
        hull.addColorStop(1, '#1c1917');
        ctx.fillStyle = hull;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const ang = Math.PI / 6 + (i * Math.PI) / 3;
            const px = Math.cos(ang) * 48 * s;
            const py = Math.sin(ang) * 48 * s;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 装甲板缝隙
        ctx.strokeStyle = 'rgba(127, 29, 29, 0.6)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            const ang = Math.PI / 6 + (i * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ang) * 46 * s, Math.sin(ang) * 46 * s);
            ctx.stroke();
        }

        // 中心颅形反应堆 (脉动红眼)
        const pulse = 1 + Math.sin(t * (isEnraged ? 14 : 6)) * 0.2;

        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath(); ctx.arc(0, 0, 22 * s, 0, Math.PI * 2); ctx.fill();

        ctx.globalCompositeOperation = 'lighter';
        const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 28 * s * pulse);
        core.addColorStop(0, '#fff');
        core.addColorStop(0.25, isEnraged ? '#fde047' : '#fb7185');
        core.addColorStop(0.7, 'rgba(220, 38, 38, 0.8)');
        core.addColorStop(1, 'transparent');
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(0, 0, 28 * s * pulse, 0, Math.PI * 2); ctx.fill();

        // 十字眼形光芒
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-16 * s * pulse, 0); ctx.lineTo(16 * s * pulse, 0);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';

        // 圆周小型副炮
        ctx.fillStyle = '#1c1917';
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
            const ang = (i * Math.PI) / 3 + Math.PI / 6;
            const px = Math.cos(ang) * 34 * s;
            const py = Math.sin(ang) * 34 * s;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }
    }

    // =========================================================
    // 通用: 离子引擎尾焰 (带马赫环)
    // =========================================================
    private static drawEnginePlume(
        ctx: CanvasRenderingContext2D,
        x: number, y: number,
        width: number, length: number,
        color: string, coreColor: string
    ) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const g = ctx.createRadialGradient(x, y, 0, x, y, length);
        g.addColorStop(0, color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;

        ctx.beginPath();
        ctx.ellipse(x, y + length * 0.4, width * 1.5, length, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.ellipse(x, y + length * 0.2, width * 0.6, length * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, width * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
