import { Enemy } from "./Entities";
import { EntityType } from "../types";

export class EnemyModel {
  static draw(ctx: CanvasRenderingContext2D, enemy: Enemy) {
    const { x, y } = enemy.position;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(enemy.rotation);
    ctx.globalCompositeOperation = 'source-over';

    switch (enemy.type) {
        case EntityType.ENEMY_BASIC:
            EnemyModel.drawBasic(ctx);
            break;
        case EntityType.ENEMY_FAST:
            EnemyModel.drawFast(ctx);
            break;
        case EntityType.ENEMY_TANK:
            EnemyModel.drawTank(ctx);
            break;
        case EntityType.ENEMY_KAMIKAZE:
            EnemyModel.drawKamikaze(ctx);
            break;
        case EntityType.ENEMY_BOSS:
            EnemyModel.drawBoss(ctx, enemy);
            break;
    }

    ctx.restore();
  }

  // --- 1. BASIC ENEMY (PURPLE DRONE) ---
  private static drawBasic(ctx: CanvasRenderingContext2D) {
      const s = 1.0;
      
      // Rear Engine Glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#a855f7';
      ctx.shadowColor = '#d8b4fe';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(-8, 15, 3, 0, Math.PI*2);
      ctx.arc(8, 15, 3, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      // Main Hull Gradient
      const grad = ctx.createLinearGradient(-15, 0, 15, 0);
      grad.addColorStop(0, '#1e1b4b'); // Dark Indigo
      grad.addColorStop(0.5, '#4c1d95'); // Violet Highlight
      grad.addColorStop(1, '#1e1b4b'); 

      ctx.fillStyle = grad;
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 1;

      // Shape: Arrowhead with forward prongs
      ctx.beginPath();
      ctx.moveTo(0, -25); // Nose
      ctx.lineTo(6, -10);
      ctx.lineTo(22, 5);  // Wing
      ctx.lineTo(15, 20); // Rear Side
      ctx.lineTo(0, 15);  // Rear Center
      ctx.lineTo(-15, 20);
      ctx.lineTo(-22, 5);
      ctx.lineTo(-6, -10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Mechanical Panel Lines
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-6, -10); ctx.lineTo(6, -10); // Crossbar
      ctx.moveTo(0, -10); ctx.lineTo(0, 15);   // Spine
      ctx.stroke();

      // Central Eye (Sensor)
      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.arc(0, -5, 4, 0, Math.PI*2); ctx.fill();
      // Glowing pupil
      ctx.fillStyle = '#f0abfc';
      ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(0, -5, 2, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
  }

  // --- 2. FAST ENEMY (CYAN INTERCEPTOR) ---
  private static drawFast(ctx: CanvasRenderingContext2D) {
      const s = 1.1;

      // Single Central Engine
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#22d3ee';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(-4, 25); ctx.lineTo(0, 45); ctx.lineTo(4, 25);
      ctx.fill();
      ctx.restore();

      const grad = ctx.createLinearGradient(0, -20, 0, 20);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#0e7490'); // Cyan Dark
      grad.addColorStop(1, '#0f172a');

      ctx.fillStyle = grad;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1;

      // Shape: Forward swept wings, needle-like
      ctx.beginPath();
      ctx.moveTo(0, -35); // Long nose
      ctx.lineTo(5, -15);
      ctx.lineTo(25, 10); // Wing tip forward
      ctx.lineTo(8, 25);  // Rear fuselage
      ctx.lineTo(0, 20);  // Exhaust
      ctx.lineTo(-8, 25);
      ctx.lineTo(-25, 10);
      ctx.lineTo(-5, -15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Canards (Front control surfaces)
      ctx.fillStyle = '#155e75';
      ctx.beginPath();
      ctx.moveTo(5, -15); ctx.lineTo(12, -20); ctx.lineTo(5, -10);
      ctx.moveTo(-5, -15); ctx.lineTo(-12, -20); ctx.lineTo(-5, -10);
      ctx.fill();
      ctx.stroke();

      // Cockpit Strip
      ctx.fillStyle = '#ccfbf1';
      ctx.beginPath();
      ctx.moveTo(0, -20); ctx.lineTo(2, -10); ctx.lineTo(-2, -10);
      ctx.fill();
  }

  // --- 3. TANK ENEMY (ORANGE BOMBER) ---
  private static drawTank(ctx: CanvasRenderingContext2D) {
      const grad = ctx.createLinearGradient(-25, -25, 25, 25);
      grad.addColorStop(0, '#270a05'); // Dark Brown
      grad.addColorStop(0.5, '#7c2d12'); // Rust
      grad.addColorStop(1, '#270a05');

      // Four Heavy Engines
      ctx.fillStyle = '#f97316';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#fdba74';
      [-20, -10, 10, 20].forEach(x => {
          ctx.fillRect(x-3, 25, 6, 6);
      });
      ctx.shadowBlur = 0;

      ctx.fillStyle = grad;
      ctx.strokeStyle = '#c2410c';
      ctx.lineWidth = 2;

      // Shape: Flying Wing / Fortress
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(15, -20);
      ctx.lineTo(40, 0);  // Wide Wing Start
      ctx.lineTo(40, 25); // Squared off wingtip
      ctx.lineTo(10, 35); // Rear body
      ctx.lineTo(-10, 35);
      ctx.lineTo(-40, 25);
      ctx.lineTo(-40, 0);
      ctx.lineTo(-15, -20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Heavy Armor Plating (Rectangles)
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-10, -10, 20, 30); // Central block
      ctx.strokeRect(-10, -10, 20, 30);
      
      ctx.fillRect(-35, 5, 10, 15); // Left wing plate
      ctx.fillRect(25, 5, 10, 15); // Right wing plate

      // Turret
      ctx.fillStyle = '#18181b';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
      // Barrel
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, 40); ctx.stroke();
  }

  // --- 4. KAMIKAZE ENEMY (RED SPIKE) ---
  private static drawKamikaze(ctx: CanvasRenderingContext2D) {
      const grad = ctx.createLinearGradient(-10, 0, 10, 0);
      grad.addColorStop(0, '#450a0a');
      grad.addColorStop(0.5, '#dc2626');
      grad.addColorStop(1, '#450a0a');

      ctx.save();
      // Entire body glows dangerously
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12;
      
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1.5;

      // Shape: Shuriken / Spike
      ctx.beginPath();
      ctx.moveTo(0, -30); // Very long point
      ctx.lineTo(8, 0);
      ctx.lineTo(15, 10); // Back spike
      ctx.lineTo(0, 5);
      ctx.lineTo(-15, 10);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
      
      // Blinking Self-Destruct Light
      const blink = Math.sin(Date.now()/50) > 0;
      ctx.fillStyle = blink ? '#ffffff' : '#7f1d1d';
      ctx.beginPath(); ctx.arc(0, -5, 3, 0, Math.PI*2); ctx.fill();
  }

  // --- 5. BOSS (MASSIVE FLAGSHIP) ---
  private static drawBoss(ctx: CanvasRenderingContext2D, enemy: Enemy) {
      const s = 1.6; // Scale

      // Metallic Hull
      const grad = ctx.createLinearGradient(-60, 0, 60, 0);
      grad.addColorStop(0, '#09090b');
      grad.addColorStop(0.5, '#3f3f46');
      grad.addColorStop(1, '#09090b');

      // Massive Engine Exhausts
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#b91c1c';
      ctx.shadowBlur = 25;
      ctx.fillRect(-35*s, 30*s, 15*s, 15*s);
      ctx.fillRect(20*s, 30*s, 15*s, 15*s);
      ctx.restore();
      
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;

      // Complex Geometrical Hull
      ctx.beginPath();
      ctx.moveTo(0, -70*s); // Nose
      ctx.lineTo(25*s, -40*s);
      ctx.lineTo(70*s, -20*s); // Wing tip
      ctx.lineTo(50*s, 30*s);  // Rear wing edge
      ctx.lineTo(20*s, 50*s);  // Engine housing
      ctx.lineTo(-20*s, 50*s);
      ctx.lineTo(-50*s, 30*s);
      ctx.lineTo(-70*s, -20*s);
      ctx.lineTo(-25*s, -40*s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Mechanical Vents (Dark areas)
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.moveTo(-10*s, -50*s); ctx.lineTo(10*s, -50*s); ctx.lineTo(0, 0);
      ctx.fill();
      
      // Glowing Energy Lines (Vents)
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(let i=0; i<6; i++) {
          const y = -45*s + i*7*s;
          ctx.moveTo(-6*s, y); ctx.lineTo(6*s, y);
      }
      ctx.stroke();

      // Core Reactor (Pulsating)
      const pulse = 1 + Math.sin(Date.now() / 150) * 0.2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 30 * pulse;
      ctx.fillStyle = `rgba(220, 38, 38, ${pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, 12*s, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
  }
}