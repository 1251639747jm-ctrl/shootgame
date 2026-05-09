import { Shield } from "./Entities";

/**
 * 护盾 - 性能友好重写版
 *
 * 优化：
 *   - 蜂窝图案预渲染到离屏 canvas (只在尺寸变化时重绘)
 *   - 去掉 conicGradient 扫描、RGB 色散、shadowBlur
 *   - 去掉随机 glitch 抖动
 *   - 保留：等离子球体渐变、旋转蜂窝、旋转虚线环、边缘高光
 *   - 每帧绘制次数从 ~50+ 降到 5~6
 */
export class ShieldModel {
    // 离屏缓存
    private static cacheCanvas: HTMLCanvasElement | null = null;
    private static cacheCtx: CanvasRenderingContext2D | null = null;
    private static cacheRadius: number = -1;

    private static buildCache(r: number) {
        if (!ShieldModel.cacheCanvas) {
            ShieldModel.cacheCanvas = document.createElement('canvas');
            ShieldModel.cacheCtx = ShieldModel.cacheCanvas.getContext('2d')!;
        }
        const c = ShieldModel.cacheCanvas;
        const ctx = ShieldModel.cacheCtx!;
        const size = Math.ceil(r * 2) + 4;
        c.width = size;
        c.height = size;
        ctx.clearRect(0, 0, size, size);

        ctx.save();
        ctx.translate(size / 2, size / 2);

        // 只绘制蜂窝，用 clip 裁成圆
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.97, 0, Math.PI * 2);
        ctx.clip();

        ctx.strokeStyle = 'rgba(120, 220, 255, 0.55)';
        ctx.lineWidth = 1;

        const hexSize = 14;
        const hexH = hexSize * Math.sin(Math.PI / 3);

        ctx.beginPath();
        for (let i = -r - hexSize; i < r + hexSize; i += hexSize * 1.5) {
            for (let j = -r - hexSize; j < r + hexSize; j += hexH * 2) {
                const col = Math.round(i / (hexSize * 1.5));
                const yOffset = col % 2 === 0 ? 0 : hexH;
                const hx = i;
                const hy = j + yOffset;
                for (let k = 0; k < 6; k++) {
                    const a = (Math.PI / 3) * k;
                    const px = hx + hexSize * Math.cos(a);
                    const py = hy + hexSize * Math.sin(a);
                    if (k === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
            }
        }
        ctx.stroke();

        ctx.restore();
        ShieldModel.cacheRadius = r;
    }

    static draw(ctx: CanvasRenderingContext2D, shield: Shield) {
        const { x, y } = shield.position;
        const r = shield.radius;
        const time = performance.now() / 1000;

        if (
            !ShieldModel.cacheCanvas ||
            Math.abs(ShieldModel.cacheRadius - r) > 0.5
        ) {
            ShieldModel.buildCache(r);
        }

        ctx.save();
        ctx.translate(x, y);

        // 1) 中心等离子体 (一次 radialGradient, 便宜)
        const plasma = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        plasma.addColorStop(0, 'rgba(0, 50, 200, 0)');
        plasma.addColorStop(0.65, 'rgba(0, 160, 255, 0.12)');
        plasma.addColorStop(0.92, 'rgba(70, 210, 255, 0.45)');
        plasma.addColorStop(1, 'rgba(210, 250, 255, 0.75)');
        ctx.fillStyle = plasma;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'lighter';

        // 2) 缓存的蜂窝 (drawImage 一次搞定)
        ctx.save();
        ctx.rotate(time * 0.4);
        const cache = ShieldModel.cacheCanvas!;
        ctx.drawImage(cache, -cache.width / 2, -cache.height / 2);
        ctx.restore();

        // 3) 外圈旋转虚线 (单次 stroke)
        ctx.save();
        ctx.rotate(-time * 1.5);
        ctx.strokeStyle = 'rgba(150, 240, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([22, 14]);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 4) 边缘高光 (单次 stroke, 不用 shadowBlur)
        const edgePulse = 0.7 + Math.sin(time * 4) * 0.3;
        ctx.strokeStyle = `rgba(220, 255, 255, ${edgePulse})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        // 5) 淡淡的外辉光 (单次 stroke, 宽而淡)
        ctx.strokeStyle = 'rgba(100, 220, 255, 0.15)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(0, 0, r + 3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}
