import { Shield } from "./Entities";

export class ShieldModel {
    static draw(ctx: CanvasRenderingContext2D, shield: Shield) {
        const { x, y } = shield.position;
        const r = shield.radius;

        ctx.save();
        ctx.translate(x, y);

        const time = Date.now() / 1000;

        // --- 1. FRESNEL LENS EFFECT (Sphere Look) ---
        // Radial gradient: Transparent center -> Opaque edge
        const grad = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r);
        grad.addColorStop(0, 'rgba(0, 100, 255, 0)');        // Clear center
        grad.addColorStop(0.7, 'rgba(0, 150, 255, 0.05)');   // Slight tint
        grad.addColorStop(0.9, 'rgba(50, 180, 255, 0.3)');   // Edge accumulation
        grad.addColorStop(1, 'rgba(150, 220, 255, 0.7)');    // Rim highlight

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // --- 2. HOLOGRAPHIC HEXAGON GRID ---
        ctx.save();
        // Clip to the shield sphere
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();

        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 1;
        
        const hexSize = 15;
        const hexH = hexSize * Math.sin(Math.PI / 3);
        const hexR = hexSize;
        
        // Scanline effect: a band of brightness moving down
        const scanY = (Math.sin(time * 2) * r * 1.2);
        
        // Draw grid
        // Start from -r to +r
        for (let i = -r - hexSize; i < r + hexSize; i += hexSize * 1.5) {
            for (let j = -r - hexSize; j < r + hexSize; j += hexH * 2) {
                // Offset every other column
                const yOffset = (Math.floor(i / (hexSize * 1.5)) % 2 === 0) ? 0 : hexH;
                const hx = i;
                const hy = j + yOffset;

                // Check distance from scanline for brightness
                const distScan = Math.abs(hy - scanY);
                let alpha = 0.05; // Base visibility
                
                if (distScan < 30) {
                    alpha = 0.6 * (1 - distScan / 30);
                }
                
                // Random flicker
                if (Math.random() > 0.98) alpha = 0.8;

                if (alpha > 0.05) {
                    ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
                    
                    // Draw Hexagon Path
                    ctx.beginPath();
                    for (let k = 0; k < 6; k++) {
                        const angle = (Math.PI / 3) * k;
                        const px = hx + hexR * Math.cos(angle);
                        const py = hy + hexR * Math.sin(angle);
                        if (k === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.stroke();
                }
            }
        }
        ctx.restore();

        // --- 3. IMPACT RIPPLE (Optional, can be added if Shield entity tracks hit location) ---
        // For now, we just add a subtle rotating shimmer
        ctx.save();
        ctx.rotate(time * 0.5);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.8, 0, Math.PI*1.5);
        ctx.stroke();
        ctx.restore();

        // --- 4. OUTER ENERGY RIM ---
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = 'rgba(200, 255, 255, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.stroke();

        ctx.restore();
    }
}