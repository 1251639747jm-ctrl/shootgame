import { Player } from "./Entities";

export class PlayerModel {
  static draw(ctx: CanvasRenderingContext2D, player: Player) {
    const { x, y } = player.position;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(player.rotation);
    
    const s = 1.0; // Scale factor

    // --- 1. ADVANCED ENGINE EXHAUST ---
    const time = Date.now() / 1000;
    // Calculate thrust based on velocity (visual feedback)
    const thrustIntensity = Math.min(1.5, Math.max(0.8, Math.abs(player.velocity.y) / 200 + 1));
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    // F-117 Platypus exhaust configuration (wide, flat)
    const engineY = 28 * s;
    const exhaustBaseW = 10 * s;
    
    // Layer 1: Blue Core (Hot)
    const gradCore = ctx.createLinearGradient(0, engineY, 0, engineY + 40 * thrustIntensity);
    gradCore.addColorStop(0, 'rgba(200, 255, 255, 0.9)');
    gradCore.addColorStop(1, 'rgba(0, 100, 255, 0)');
    
    ctx.fillStyle = gradCore;
    // Left nozzle
    ctx.beginPath();
    ctx.moveTo(-12*s, engineY); ctx.lineTo(-4*s, engineY); ctx.lineTo(-8*s, engineY + 30*thrustIntensity); ctx.fill();
    // Right nozzle
    ctx.beginPath();
    ctx.moveTo(12*s, engineY); ctx.lineTo(4*s, engineY); ctx.lineTo(8*s, engineY + 30*thrustIntensity); ctx.fill();

    // Layer 2: Purple/Pink Afterburner (Turbulence)
    const flicker = Math.sin(time * 50) * 0.1 + 0.9;
    const gradOuter = ctx.createLinearGradient(0, engineY, 0, engineY + 60 * thrustIntensity * flicker);
    gradOuter.addColorStop(0, 'rgba(100, 100, 255, 0.5)');
    gradOuter.addColorStop(1, 'rgba(200, 50, 255, 0)');
    
    ctx.fillStyle = gradOuter;
    // Left turbulence
    ctx.beginPath(); ctx.moveTo(-14*s, engineY); ctx.lineTo(-2*s, engineY); ctx.lineTo(-8*s, engineY + 50*thrustIntensity*flicker); ctx.fill();
    // Right turbulence
    ctx.beginPath(); ctx.moveTo(14*s, engineY); ctx.lineTo(2*s, engineY); ctx.lineTo(8*s, engineY + 50*thrustIntensity*flicker); ctx.fill();
    
    ctx.restore();

    // --- 2. FUSELAGE GEOMETRY ---
    // Use Slate/Dark Blue gradients for stealth look
    const bodyGrad = ctx.createLinearGradient(-20, -20, 20, 20);
    bodyGrad.addColorStop(0, '#0f172a'); // Very dark slate
    bodyGrad.addColorStop(0.4, '#334155'); // Highlight where light hits
    bodyGrad.addColorStop(0.6, '#1e293b'); // Shadow
    bodyGrad.addColorStop(1, '#020617'); // Almost black

    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#475569'; // Panel lines color
    ctx.lineWidth = 1;

    // The iconic F-117 diamond/arrowhead shape
    ctx.beginPath();
    ctx.moveTo(0, -40*s);     // Nose Tip
    ctx.lineTo(6*s, -15*s);   // Cockpit side start
    ctx.lineTo(35*s, 20*s);   // Wing tip
    ctx.lineTo(18*s, 30*s);   // Trailing edge inner
    ctx.lineTo(24*s, 40*s);   // Tail fin tip
    ctx.lineTo(0, 32*s);      // Rear exhaust center
    ctx.lineTo(-24*s, 40*s);
    ctx.lineTo(-18*s, 30*s);
    ctx.lineTo(-35*s, 20*s);
    ctx.lineTo(-6*s, -15*s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // --- 3. SURFACE DETAILS (FACETS) ---
    // Draw lighter facets to simulate the stealth angles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    ctx.moveTo(0, -40*s);
    ctx.lineTo(0, 32*s);      // Center spine
    ctx.lineTo(18*s, 30*s);   // Right tail base
    ctx.lineTo(6*s, -15*s);   // Right cockpit side
    ctx.fill();

    // Intake Grilles (Rectangular grid intakes)
    ctx.fillStyle = '#000000';
    // Left Intake
    ctx.beginPath(); ctx.moveTo(-6*s, -8*s); ctx.lineTo(-12*s, 2*s); ctx.lineTo(-5*s, 2*s); ctx.lineTo(-3*s, -8*s); ctx.fill();
    // Right Intake
    ctx.beginPath(); ctx.moveTo(6*s, -8*s); ctx.lineTo(12*s, 2*s); ctx.lineTo(5*s, 2*s); ctx.lineTo(3*s, -8*s); ctx.fill();
    
    // Intake Mesh lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-6*s, -3*s); ctx.lineTo(-3*s, -3*s);
    ctx.moveTo(6*s, -3*s); ctx.lineTo(3*s, -3*s);
    ctx.stroke();

    // --- 4. COCKPIT CANOPY ---
    // F-117 has a very angular, gold-tinted canopy
    const cockpitGrad = ctx.createLinearGradient(0, -25, 0, -10);
    cockpitGrad.addColorStop(0, '#d97706'); // Gold/Amber top
    cockpitGrad.addColorStop(0.5, '#b45309'); 
    cockpitGrad.addColorStop(1, '#78350f'); // Darker bottom
    
    ctx.fillStyle = cockpitGrad;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 4;
    
    ctx.beginPath();
    ctx.moveTo(0, -28*s);
    ctx.lineTo(4*s, -18*s);
    ctx.lineTo(0, -15*s);
    ctx.lineTo(-4*s, -18*s);
    ctx.closePath();
    ctx.fill();
    
    // Glint on glass
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.moveTo(0, -28*s);
    ctx.lineTo(1.5*s, -22*s);
    ctx.lineTo(0, -20*s);
    ctx.fill();

    // --- 5. NAV LIGHTS ---
    // Left Red
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 6;
    ctx.fillRect(-35*s, 20*s, 2, 2);
    // Right Green
    ctx.fillStyle = '#22c55e';
    ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 6;
    ctx.fillRect(35*s, 20*s, 2, 2);
    ctx.shadowBlur = 0;

    // --- 6. CHARGING EFFECT ---
    if (player.isCharging) {
         ctx.save();
         ctx.globalCompositeOperation = 'lighter';
         const chargePct = player.chargeLevel / 100;
         const pulse = 1 + Math.sin(time * 30) * 0.2;
         
         // Glow accumulating at the nose
         ctx.shadowColor = '#00ffff';
         ctx.shadowBlur = 15 * chargePct * pulse;
         ctx.fillStyle = `rgba(0, 255, 255, ${chargePct})`;
         
         ctx.beginPath();
         ctx.arc(0, -40*s, 3 * chargePct * pulse, 0, Math.PI*2);
         ctx.fill();
         
         // Electricity lines running over the wings
         if (Math.random() > 0.5) {
             ctx.strokeStyle = `rgba(150, 255, 255, ${chargePct * 0.8})`;
             ctx.lineWidth = 1;
             ctx.beginPath();
             // Random path on left wing
             ctx.moveTo(0, -35*s);
             ctx.lineTo(-10*s + (Math.random()-0.5)*5, -10*s);
             ctx.lineTo(-35*s, 20*s);
             // Random path on right wing
             ctx.moveTo(0, -35*s);
             ctx.lineTo(10*s + (Math.random()-0.5)*5, -10*s);
             ctx.lineTo(35*s, 20*s);
             ctx.stroke();
         }
         
         ctx.restore();
    }

    ctx.restore();
  }
}