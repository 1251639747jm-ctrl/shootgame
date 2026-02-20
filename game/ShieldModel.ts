import { Shield } from "./Entities";

export class ShieldModel {
    // 预计算六边形常量，避免在帧循环中重复计算 (性能优化)
    private static readonly HEX_SIZE = 16;
    private static readonly HEX_H = ShieldModel.HEX_SIZE * Math.sin(Math.PI / 3);

    static draw(ctx: CanvasRenderingContext2D, shield: Shield) {
        const { x, y } = shield.position;
        const r = shield.radius;
        const time = performance.now() / 1000;

        ctx.save();
        ctx.translate(x, y);

        // 随机能量故障/撕裂效果 (Glitch)
        const isGlitching = Math.random() > 0.95;
        if (isGlitching) {
            ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
        }

        // =========================================================
        // LAYER 1: 核心等离子球体 (内透体积光)
        // =========================================================
        const plasmaGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        plasmaGrad.addColorStop(0, 'rgba(0, 50, 200, 0)');       // 内部中空
        plasmaGrad.addColorStop(0.6, 'rgba(0, 150, 255, 0.05)'); // 渐渐变浓
        plasmaGrad.addColorStop(0.9, 'rgba(0, 200, 255, 0.4)');  // 边缘能量堆积
        plasmaGrad.addColorStop(1, 'rgba(200, 255, 255, 0.8)');  // 极限亮边
        
        ctx.fillStyle = plasmaGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // 开启叠加模式，开始渲染高能特效
        ctx.globalCompositeOperation = 'lighter';

        // =========================================================
        // LAYER 2: 全息雷达扫描波 (Radar Sweep)
        // 使用现代 Canvas 的圆锥渐变生成极具质感的旋转光束
        // =========================================================
        if (typeof ctx.createConicGradient === 'function') {
            ctx.save();
            // 逆时针高速扫描
            const sweep = ctx.createConicGradient(-time * 4, 0, 0);
            sweep.addColorStop(0, 'rgba(0, 255, 255, 0)');
            sweep.addColorStop(0.75, 'rgba(0, 255, 255, 0)');
            sweep.addColorStop(0.95, 'rgba(100, 255, 255, 0.4)');
            sweep.addColorStop(1, 'rgba(255, 255, 255, 0.8)'); // 扫描亮刃
            
            ctx.fillStyle = sweep;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // =========================================================
        // LAYER 3: 绝对防御·蜂窝硬光矩阵 (Hex Matrix)
        //：整个网格只有 1 次 beginPath 和 1 次 stroke
        // =========================================================
        ctx.save();
        // 裁剪出完美的球形护盾边缘
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
        ctx.clip();

        // 利用径向渐变作为网格的颜色，制造出越靠近边缘越亮的“3D球面球差”错觉
        const hexGrad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
        const pulse = Math.sin(time * 5) * 0.2; // 呼吸闪烁
        hexGrad.addColorStop(0, `rgba(0, 200, 255, ${0.1 + pulse})`);
        hexGrad.addColorStop(0.8, 'rgba(0, 255, 255, 0.6)');
        hexGrad.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
        
        ctx.strokeStyle = hexGrad;
        ctx.lineWidth = 1;

        // 生成网格路径
        ctx.beginPath();
        const hexSize = ShieldModel.HEX_SIZE;
        const hexH = ShieldModel.HEX_H;
        for (let i = -r - hexSize; i < r + hexSize; i += hexSize * 1.5) {
            for (let j = -r - hexSize; j < r + hexSize; j += hexH * 2) {
                const yOffset = (Math.floor(i / (hexSize * 1.5)) % 2 === 0) ? 0 : hexH;
                const hx = i;
                const hy = j + yOffset;

                // 绘制单个六边形
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
        ctx.stroke(); // 仅渲染一次！
        ctx.restore();

        // =========================================================
        // LAYER 4: 机械拘束器/自转能量环 (Tech Rings)
        // 妙用虚线阵列 (setLineDash) 生成复杂的科技UI感
        // =========================================================
        ctx.save();
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        
        // 内圈反向慢速转动
        ctx.rotate(-time * 1.5);
        ctx.strokeStyle = 'rgba(100, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash(); // 生成复杂的长短相间刻度
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
        ctx.stroke();

        // 外圈正向极速自旋
        ctx.rotate(time * 4);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.setLineDash();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // =========================================================
        // LAYER 5: 色散边缘与故障特效 (Aberration & Glitch FX)
        // 模拟高能护盾受压迫时的光学色差偏移
        // =========================================================
        const glitchOffset = isGlitching ? 3 : 1;
        ctx.lineWidth = 2.5;

        // 偏移红色通道
        ctx.strokeStyle = 'rgba(255, 0, 80, 0.6)';
        ctx.beginPath();
        ctx.arc(-glitchOffset, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        // 偏移蓝色通道
        ctx.strokeStyle = 'rgba(0, 100, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(glitchOffset, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        // 核心高亮青色层 (居中)
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = 'rgba(200, 255, 255, 1)';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();

        // 触发高亮电流切割 (瞬间白条)
        if (isGlitching) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            const glitchWidth = r * 1.5;
            const glitchY = (Math.random() - 0.5) * r * 1.5;
            ctx.fillRect(-glitchWidth / 2, glitchY, glitchWidth, 3);
        }

        ctx.restore();
    }
}
