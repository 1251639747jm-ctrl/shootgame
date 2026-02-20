import { Enemy } from "./Entities";
import { EntityType } from "../types";

export class EnemyModel {
    static draw(ctx: CanvasRenderingContext2D, enemy: Enemy) {
        const { x, y } = enemy.position;
        const time = performance.now() / 1000;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(enemy.rotation);

        // 根据机型调用极致渲染函数
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
     * 1. 基础侦察机 (紫色蜂群) - 强化悬浮感
     */
    private static renderBasic(ctx: CanvasRenderingContext2D, t: number) {
        const flicker = Math.sin(t * 15) * 0.2 + 0.8;
        
        // 双引擎尾焰 (无 ShadowBlur 发光方案)
        ctx.globalCompositeOperation = 'lighter';
        this.drawEngineGlow(ctx, -8, 14, 6 * flicker, '#a855f7');
        this.drawEngineGlow(ctx, 8, 14, 6 * flicker, '#a855f7');
        ctx.globalCompositeOperation = 'source-over';

        // 主机壳：复合装甲色
        const g = ctx.createLinearGradient(-15, 0, 15, 0);
        g.addColorStop(0, '#1e1b4b');
        g.addColorStop(0.5, '#4c1d95');
        g.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = g;
        ctx.strokeStyle = '#7c3aed';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(0, -22); ctx.lineTo(18, 5); ctx.lineTo(12, 18);
        ctx.lineTo(0, 12); ctx.lineTo(-12, 18); ctx.lineTo(-18, 5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 传感器“核心”
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(0, -2, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = `rgba(216, 180, 254, ${flicker})`;
        ctx.beginPath(); ctx.arc(0, -2, 2, 0, Math.PI*2); ctx.fill();
    }

    /**
     * 2. 快速拦截机 (青色闪电) - 强化流线型与速度感
     */
    private static renderFast(ctx: CanvasRenderingContext2D, t: number) {
        const pulse = Math.sin(t * 25) * 0.3 + 0.7;
        
        // 极长束能尾焰
        ctx.globalCompositeOperation = 'lighter';
        this.drawEngineGlow(ctx, 0, 20, 12 * pulse, '#22d3ee');
        ctx.globalCompositeOperation = 'source-over';

        // 针式船体
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(0, -32); ctx.lineTo(6, -10); ctx.lineTo(24, 12);
        ctx.lineTo(0, 18); ctx.lineTo(-24, 12); ctx.lineTo(-6, -10);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 能量刻线
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
        ctx.beginPath();
        ctx.moveTo(-4, -5); ctx.lineTo(-18, 8);
        ctx.moveTo(4, -5); ctx.lineTo(18, 8);
        ctx.stroke();
    }

    /**
     * 3. 重型坦克 (橙色要塞) - 强化厚重感与工业磨损
     */
    private static renderTank(ctx: CanvasRenderingContext2D, t: number) {
        // 四座重型发动机
        ctx.globalCompositeOperation = 'lighter';
        [-20, -10, 10, 20].forEach(x => this.drawEngineGlow(ctx, x, 28, 8, '#f97316'));
        ctx.globalCompositeOperation = 'source-over';

        // 宽体飞翼布局
        const g = ctx.createLinearGradient(-40, 0, 40, 0);
        g.addColorStop(0, '#270a05');
        g.addColorStop(0.5, '#7c2d12');
        g.addColorStop(1, '#270a05');
        ctx.fillStyle = g;
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        ctx.moveTo(0, -25); ctx.lineTo(42, 5); ctx.lineTo(42, 28);
        ctx.lineTo(-42, 28); ctx.lineTo(-42, 5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 顶层防御塔底座
        ctx.fillStyle = '#18181b';
        ctx.beginPath(); ctx.arc(0, 5, 12, 0, Math.PI*2); ctx.fill();
        ctx.stroke();
        
        // 炮管细节
        ctx.strokeStyle = '#9a3412';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, 38); ctx.stroke();
    }

    /**
     * 4. 自爆死士 (红色尖刺) - 极高频闪烁警告
     */
    private static renderKamikaze(ctx: CanvasRenderingContext2D, t: number) {
        const alert = Math.sin(t * 40) > 0;
        
        // 危险的红色能量外溢
        ctx.globalCompositeOperation = 'lighter';
        const glowR = alert ? 35 : 20;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, glowR, 0, Math.PI*2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        // 尖刺造型
        ctx.fillStyle = alert ? '#f87171' : '#7f1d1d';
        ctx.strokeStyle = '#fee2e2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -30); ctx.lineTo(12, 10); ctx.lineTo(0, 4); ctx.lineTo(-12, 10);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    }

    /**
     * 5. BOSS 旗舰 (歼星级巨舰) - 多层细节与核能反应堆
     */
    private static renderBoss(ctx: CanvasRenderingContext2D, enemy: Enemy, t: number) {
        const s = 1.8;
        const hpRatio = enemy.health / enemy.maxHealth;

        // 引擎矩阵 (六座重型推进器)
        ctx.globalCompositeOperation = 'lighter';
        [-40, -25, -10, 10, 25, 40].forEach(x => {
            this.drawEngineGlow(ctx, x*s, 40*s, 15*s, hpRatio < 0.3 ? '#facc15' : '#ef4444');
        });

        // 主体框架：金属质感
        const g = ctx.createLinearGradient(-80, 0, 80, 0);
        g.addColorStop(0, '#09090b');
        g.addColorStop(0.5, '#27272a');
        g.addColorStop(1, '#09090b');
        ctx.fillStyle = g;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.moveTo(0, -75*s); 
        ctx.lineTo(35*s, -45*s); ctx.lineTo(80*s, 10*s); 
        ctx.lineTo(50*s, 55*s); ctx.lineTo(-50*s, 55*s);
        ctx.lineTo(-80*s, 10*s); ctx.lineTo(-35*s, -45*s);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // 表面装甲分缝（科技感细节）
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(-30*s, -20*s); ctx.lineTo(30*s, -20*s);
        ctx.moveTo(-50*s, 10*s); ctx.lineTo(50*s, 10*s);
        ctx.stroke();
        ctx.setLineDash([]);

        // 核心能量炉 (Reactor) - 随生命值改变颜色
        const pulse = 1 + Math.sin(t * 10) * 0.15;
        const reactorColor = hpRatio > 0.4 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(250, 204, 21, 0.8)';
        
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const rGrad = ctx.createRadialGradient(0, -10, 0, 0, -10, 20*s*pulse);
        rGrad.addColorStop(0, '#fff');
        rGrad.addColorStop(0.5, reactorColor);
        rGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = rGrad;
        ctx.beginPath(); ctx.arc(0, -10, 20*s*pulse, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    /**
     * 高性能光晕辅助函数 (替代 ShadowBlur)
     */
    private static drawEngineGlow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
        ctx.save();
        const g = ctx.createRadialGradient(x, y, 0, x, y, size);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.4, color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
