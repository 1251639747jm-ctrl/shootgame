import { Enemy } from "./Entities";
import { EntityType } from "../types";

export class EnemyModel {
    static draw(ctx: CanvasRenderingContext2D, enemy: Enemy) {
        const { x, y } = enemy.position;
        // 使用 performance.now() 获取更平滑的动画时间流
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
            case EntityType.ENEMY_BOSS:
                this.renderBoss(ctx, enemy, time);
                break;
        }

        ctx.restore();
    }

    /**
     * 1. 基础侦察机 (紫色蜂群) - 仿生甲壳与悬浮引擎
     */
    private static renderBasic(ctx: CanvasRenderingContext2D, t: number) {
        const flicker = Math.sin(t * 15) * 0.2 + 0.8;
        
        // 引擎尾焰
        this.drawEnginePlume(ctx, -8, 12, 5, 18 * flicker, '#a855f7', '#d8b4fe');
        this.drawEnginePlume(ctx, 8, 12, 5, 18 * flicker, '#a855f7', '#d8b4fe');

        // 底层机翼 (深色衬底)
        ctx.fillStyle = '#1e1b4b';
        ctx.strokeStyle = '#4c1d95';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.quadraticCurveTo(22, -5, 20, 15);
        ctx.lineTo(8, 18); ctx.lineTo(0, 10); ctx.lineTo(-8, 18);
        ctx.lineTo(-20, 15); ctx.quadraticCurveTo(-22, -5, 0, -24);
        ctx.fill(); ctx.stroke();

        // 顶层装甲板 (金属紫渐变 3D感)
        const armorGrad = ctx.createLinearGradient(-15, -20, 15, 10);
        armorGrad.addColorStop(0, '#5b21b6');
        armorGrad.addColorStop(0.5, '#7c3aed');
        armorGrad.addColorStop(1, '#3b0764');
        ctx.fillStyle = armorGrad;
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.quadraticCurveTo(12, -2, 12, 10);
        ctx.lineTo(0, 5);
        ctx.lineTo(-12, 10);
        ctx.quadraticCurveTo(-12, -2, 0, -20);
        ctx.fill();

        // 高光边缘
        ctx.strokeStyle = 'rgba(216, 180, 254, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -20); ctx.quadraticCurveTo(12, -2, 12, 10);
        ctx.stroke();

        // 传感器核心 (发光复眼)
        ctx.globalCompositeOperation = 'lighter';
        const eyeGrad = ctx.createRadialGradient(0, -5, 0, 0, -5, 6);
        eyeGrad.addColorStop(0, '#ffffff');
        eyeGrad.addColorStop(0.3, '#c084fc');
        eyeGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = eyeGrad;
        ctx.beginPath(); ctx.arc(0, -5, 8, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * 2. 快速拦截机 (青色闪电) - 前掠翼流线型
     */
    private static renderFast(ctx: CanvasRenderingContext2D, t: number) {
        const pulse = Math.sin(t * 25) * 0.3 + 0.7;
        
        // 主引擎长尾焰
        this.drawEnginePlume(ctx, 0, 15, 6, 35 * pulse, '#06b6d4', '#cffafe');

        // 翼尖能量拉烟 (运动模糊感)
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(34, 211, 238, ${pulse * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-24, 12); ctx.lineTo(-24, 25 + 5 * pulse);
        ctx.moveTo(24, 12); ctx.lineTo(24, 25 + 5 * pulse);
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

        // 核心装甲 (青色高光)
        const hullGrad = ctx.createLinearGradient(-10, -30, 10, 20);
        hullGrad.addColorStop(0, '#0891b2');
        hullGrad.addColorStop(0.4, '#06b6d4');
        hullGrad.addColorStop(1, '#164e63');
        ctx.fillStyle = hullGrad;
        ctx.beginPath();
        ctx.moveTo(0, -32); ctx.lineTo(5, -8); ctx.lineTo(15, 10);
        ctx.lineTo(0, 15); ctx.lineTo(-15, 10); ctx.lineTo(-5, -8);
        ctx.closePath();
        ctx.fill();

        // 驾驶舱盖
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(0, -20); ctx.lineTo(3, -10); ctx.lineTo(0, -5); ctx.lineTo(-3, -10);
        ctx.fill();

        // 能量刻线
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -5); ctx.lineTo(0, 15);
        ctx.moveTo(-5, -8); ctx.lineTo(-24, 12);
        ctx.moveTo(5, -8); ctx.lineTo(24, 12);
        ctx.stroke();
    }

    /**
     * 3. 重型坦克 (橙色要塞) - 履带与重炮
     */
    private static renderTank(ctx: CanvasRenderingContext2D, t: number) {
        // [修复] 之前这里丢失了数组定义
        const engines = [-20, -10, 10, 20];
        engines.forEach(x => {
            this.drawEnginePlume(ctx, x, 25, 7, 15, '#ea580c', '#fef08a');
        });

        // 履带舱 (渐变金属)
        const trackGrad = ctx.createLinearGradient(-45, 0, -30, 0);
        trackGrad.addColorStop(0, '#1c1917');
        trackGrad.addColorStop(1, '#44403c');
        ctx.fillStyle = trackGrad;
        
        // 左履带
        ctx.fillRect(-45, -15, 15, 45);
        // 右履带 (镜像复用样式)
        ctx.save();
        ctx.translate(75, 0); // 移动到右侧相对位置
        ctx.fillRect(-45, -15, 15, 45); 
        ctx.restore();

        // 履带纹理
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = -10; i < 28; i += 6) {
            ctx.moveTo(-45, i); ctx.lineTo(-30, i);
            ctx.moveTo(30, i); ctx.lineTo(45, i);
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

        // 散热格栅 (发光橙色)
        ctx.fillStyle = '#f97316';
        for (let i = -15; i <= 15; i += 10) {
            ctx.fillRect(i - 2, 15, 4, 6);
        }

        // 炮塔圆座
        ctx.fillStyle = '#292524';
        ctx.beginPath(); ctx.arc(0, -5, 16, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 双联装炮管
        ctx.fillStyle = '#57534e';
        ctx.fillRect(-8, 0, 4, 38);
        ctx.fillRect(4, 0, 4, 38);
        // 制退器
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(-10, 32, 8, 8);
        ctx.fillRect(2, 32, 8, 8);
    }

    /**
     * 4. 自爆死士 (红色尖刺) - 不稳定能量体
     */
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

        // 核心点 (闪烁)
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = alert ? '#ffffff' : '#fca5a5';
        ctx.beginPath();
        ctx.arc(0, -5, 6 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * 5. BOSS 旗舰 (歼星级巨舰) - 复杂机械结构
     */
    private static renderBoss(ctx: CanvasRenderingContext2D, enemy: Enemy, t: number) {
        const s = 1.8; // 缩放系数
        const hpRatio = enemy.health / enemy.maxHealth;
        const isEnraged = hpRatio < 0.3;

        const mainColor = isEnraged ? '#facc15' : '#38bdf8'; 
        const darkMetal = '#0f172a';
        const panelMetal = '#1e293b';
        
        // [修复] 引擎阵列数组
        const enginePos = [-40, -25, -10, 10, 25, 40];
        enginePos.forEach(x => {
            this.drawEnginePlume(ctx, x * s, 45 * s, 10 * s, 30 * s, isEnraged ? '#ea580c' : '#0284c7', '#fff');
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
        ctx.setLineDash([]); // 重置虚线
        ctx.beginPath();
        ctx.moveTo(-20 * s, 0); ctx.lineTo(-20 * s, 35 * s);
        ctx.moveTo(20 * s, 0); ctx.lineTo(20 * s, 35 * s);
        ctx.stroke();

        // [修复] 武器阵列数组
        const weaponPos = [-65, 65]; 
        ctx.fillStyle = '#1e293b';
        weaponPos.forEach(x => {
            // 武器基座
            ctx.fillRect((x - 5) * s, 10 * s, 10 * s, 25 * s);
            // 炮口光辉
            ctx.save();
            ctx.fillStyle = mainColor;
            ctx.fillRect((x - 2) * s, 35 * s, 4 * s, 5 * s);
            ctx.restore();
        });

        // 反应堆 (Reactor)
        const pulse = 1 + Math.sin(t * (isEnraged ? 20 : 8)) * 0.15;
        const coreY = -15 * s;
        
        // 反应堆外环
        ctx.fillStyle = '#334155';
        ctx.beginPath(); ctx.arc(0, coreY, 24 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#020617';
        ctx.beginPath(); ctx.arc(0, coreY, 20 * s, 0, Math.PI * 2); ctx.fill();

        // 反应堆核心光辉
        ctx.globalCompositeOperation = 'lighter';
        const rGrad = ctx.createRadialGradient(0, coreY, 0, 0, coreY, 28 * s * pulse);
        rGrad.addColorStop(0, '#ffffff');
        rGrad.addColorStop(0.2, isEnraged ? '#fef08a' : '#bae6fd');
        rGrad.addColorStop(0.6, isEnraged ? 'rgba(239, 68, 68, 0.8)' : 'rgba(14, 165, 233, 0.8)');
        rGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = rGrad;
        ctx.beginPath(); ctx.arc(0, coreY, 28 * s * pulse, 0, Math.PI * 2); ctx.fill();

        // 十字光芒
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, coreY - 15 * s * pulse); ctx.lineTo(0, coreY + 15 * s * pulse);
        ctx.moveTo(-15 * s * pulse, coreY); ctx.lineTo(15 * s * pulse, coreY);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
    }

    /**
     * 通用：高性能矢量引擎尾焰 (带马赫环)
     */
    private static drawEnginePlume(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, length: number, color: string, coreColor: string) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        
        // 1. 等离子外焰
        const g = ctx.createRadialGradient(x, y, 0, x, y, length);
        g.addColorStop(0, color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        
        ctx.beginPath();
        ctx.ellipse(x, y + length * 0.4, width * 1.5, length, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. 马赫环核心 (高温区)
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.ellipse(x, y + length * 0.2, width * 0.6, length * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 3. 喷口亮斑
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, width * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
