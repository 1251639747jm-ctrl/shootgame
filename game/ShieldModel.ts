import { Shield } from "./Entities";

export class ShieldModel {
    // 预计算六边形常量
    private static readonly HEX_SIZE = 16;
    private static readonly HEX_H = ShieldModel.HEX_SIZE * Math.sin(Math.PI / 3);

    static draw(ctx: CanvasRenderingContext2D, shield: Shield) {
        const { x, y } = shield.position;
        const r = shield.radius;
        const time = performance.now() / 1000;

        ctx.save();
        ctx.translate(x, y);

        // 随机能量故障效果
        const isGlitching = Math.random() > 0.95;
        if (isGlitching) {
            ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
        }

        // =========================================================
        // LAYER 1: 核心等离子球体
        // =========================================================
        const plasmaGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        plasmaGrad.addColorStop(0, 'rgba(0, 50, 200, 0)');
        plasmaGrad.addColorStop(0.6, 'rgba(0, 150, 255, 0.05)');
        plasmaGrad.addColorStop(0.9, 'rgba(0, 200, 255, 0.4)');
        plasmaGrad.addColorStop(1, 'rgba(200, 255, 255, 0.8)');
        
        ctx.fillStyle = plasmaGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'lighter';

        // =========================================================
        // LAYER 2: 全息雷达扫描波
        // =========================================================
        if (typeof ctx.createConicGradient === 'function') {
            ctx.save();
            const sweep = ctx.createConicGradient(-time * 4, 0, 0);
            sweep.addColorStop(0, 'rgba(0, 255, 255, 0)');
            sweep.addColorStop(0.75, 'rgba(0, 255, 255, 0)');
            sweep.addColorStop(0.95, 'rgba(100, 255, 255, 0.4)');
            sweep.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
            
            ctx.fillStyle = sweep;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // =========================================================
        // LAYER 3: 蜂窝硬光矩阵
        // =========================================================
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
        ctx.clip();

        const hexGrad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
        const pulse = Math.sin(time * 5) * 0.2;
        hexGrad.addColorStop(0, `rgba(0, 200, 255, ${0.1 + pulse})`);
        hexGrad.addColorStop(0.8, 'rgba(0, 255, 255, 0.6)');
        hexGrad.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
        
        ctx.strokeStyle = hexGrad;
        ctx.lineWidth = 1;

        ctx.beginPath();
        const hexSize = ShieldModel.HEX_SIZE;
        const hexH = ShieldModel.HEX_H;
        for (let i = -r - hexSize; i < r + hexSize; i += hexSize * 1.5) {
            for (let j = -r - hexSize; j < r + hexSize; j += hexH * 2) {
                const yOffset = (Math.floor(i / (hexSize * 1.5)) % 2 === 0) ? 0 : hexH;
                const hx = i;
                const hy = j + yOffset;

                for (let k = 0; k < 6; k++) {
                    const angle = (Math.PI / 3) * k;
                    const px = hx + hexSize * Math.cos(angle);
                    const py = hy + hexSize * Math.sin(angle);
                    if (k === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
            }
        }
        ctx.stroke();
        ctx.restore();

        // =========================================================
        // LAYER 4: 机械拘束器 (修复了 setLineDash 报错)
        // =========================================================
        ctx.save();
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        
        // 内圈：长虚线刻度 [线长, 间距]
        ctx.save();
        ctx.rotate(-time * 1.5);
        ctx.strokeStyle = 'rgba(100, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([20, 10]); // 修复：传入了数组参数
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 外圈：极细短虚线 [线长, 间距]
        ctx.save();
        ctx.rotate(time * 4);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([40, 30]); // 修复：传入了数组参数
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        
        ctx.restore();

        // 重要：重置虚线状态，防止污染后续的其他绘制
        ctx.setLineDash([]);

        // =========================================================
        // LAYER 5: 色散边缘与故障
        // =========================================================
        const glitchOffset = isGlitching ? 3 : 1;
        ctx.lineWidth = 2.5;

        ctx.strokeStyle = 'rgba(255, 0, 80, 0.6)';
        ctx.beginPath();
        ctx.arc(-glitchOffset, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0, 100, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(glitchOffset, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = 'rgba(200, 255, 255, 1)';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        if (isGlitching) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            const glitchWidth = r * 1.5;
            const glitchY = (Math.random() - 0.5) * r * 1.5;
            ctx.fillRect(-glitchWidth / 2, glitchY, glitchWidth, 3);
        }

        ctx.restore();
    }
}
