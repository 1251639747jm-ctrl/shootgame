import { Entity, Player, Enemy, Bullet, Particle, Star, Meteor, Nebula, Item, Shield, Shockwave, FloatingText, ChargeParticle } from "./Entities";
import { Laser } from "./Laser";
import { BlackHole } from "./BlackHole";
import { TeslaLightning } from "./Tesla";
import { Bomb, Explosion } from "./Bomb";
import { Missile } from "./Missile";
import { PlayerModel } from "./PlayerModel";
import { EnemyModel } from "./EnemyModel";
import { ShieldModel } from "./ShieldModel";
import { EntityType, GameConfig, WeaponType, ItemType } from "../types";

export class Renderer {
  ctx: CanvasRenderingContext2D;
  config: GameConfig;
  shakeOffset: {x: number, y: number} = {x:0, y:0};

  constructor(ctx: CanvasRenderingContext2D, config: GameConfig) {
    this.ctx = ctx;
    this.config = config;
  }

  setShake(x: number, y: number) {
      this.shakeOffset = {x, y};
  }

  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); 
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.config.height);
    grad.addColorStop(0, '#000000');
    grad.addColorStop(1, '#080c16');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.config.width, this.config.height);
    
    this.ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
  }

  drawNebula(nebula: Nebula) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createRadialGradient(nebula.position.x, nebula.position.y, 0, nebula.position.x, nebula.position.y, nebula.scale);
      grad.addColorStop(0, nebula.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(nebula.position.x, nebula.position.y, nebula.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
  }

  drawStar(star: Star) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
    ctx.beginPath();
    ctx.arc(star.position.x, star.position.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMeteor(meteor: Meteor) {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(meteor.position.x, meteor.position.y);
      ctx.rotate(meteor.rotation);
      
      ctx.fillStyle = '#374151'; 
      ctx.strokeStyle = '#1f2937'; 
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      const spikes = 7;
      const r = meteor.radius;
      for(let i=0; i<spikes * 2; i++) {
          const angle = (i/(spikes*2)) * Math.PI * 2;
          const len = (i % 2 === 0) ? r : r * 0.6;
          ctx.lineTo(Math.cos(angle)*len, Math.sin(angle)*len);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
  }

  drawPlayer(player: Player) {
      PlayerModel.draw(this.ctx, player);
  }

  drawChargeParticle(p: ChargeParticle) {
      this.ctx.save();
      this.ctx.translate(p.position.x, p.position.y);
      this.ctx.globalCompositeOperation = 'lighter';
      
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = '#00ffff';
      
      const grad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, p.radius);
      grad.addColorStop(0, '#ffffff'); 
      grad.addColorStop(0.4, '#a5f3fc'); 
      grad.addColorStop(1, '#0891b2'); 
      
      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.restore();
  }

  drawBullet(bullet: Bullet) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(bullet.position.x, bullet.position.y);
    ctx.rotate(bullet.rotation);
    ctx.globalCompositeOperation = 'lighter';

    if (bullet.type === EntityType.BULLET_PLAYER) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#facc15';
        ctx.fillStyle = '#fff';
        ctx.fillRect(-4, -15, 3, 25);
        ctx.fillRect(1, -15, 3, 25);
    } else {
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff0055';
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  drawEnemy(enemy: Enemy) {
      EnemyModel.draw(this.ctx, enemy);
      
      // Draw Boss Health Bar separately in world space
      if (enemy.isBoss) {
          this.ctx.save();
          this.ctx.translate(enemy.position.x, enemy.position.y);
          this.ctx.fillStyle = '#000';
          this.ctx.fillRect(-60, -120, 120, 10);
          this.ctx.fillStyle = '#dc2626';
          this.ctx.fillRect(-60, -120, 120 * (enemy.health / enemy.maxHealth), 10);
          this.ctx.restore();
      }
  }

  drawSkillShield(shield: Shield) {
      ShieldModel.draw(this.ctx, shield);
  }

  drawSkillShockwave(sw: Shockwave) {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(sw.position.x, sw.position.y);
      ctx.globalCompositeOperation = 'lighter';
      
      ctx.strokeStyle = `rgba(255, 200, 50, ${sw.opacity})`;
      ctx.lineWidth = 15;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 30;
      
      ctx.beginPath();
      ctx.arc(0, 0, sw.radius, 0, Math.PI*2);
      ctx.stroke();
      
      ctx.restore();
  }

  drawFloatingText(ft: FloatingText) {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(ft.position.x, ft.position.y);
      ctx.globalAlpha = ft.opacity;
      
      ctx.fillStyle = ft.color;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.font = 'bold 28px monospace'; 
      ctx.textAlign = 'center';
      
      const scale = Math.min(1.2, 1 + (1 - ft.life));
      ctx.scale(scale, scale);
      
      ctx.fillText(ft.text, 0, 0);
      
      ctx.restore();
  }

  drawItem(item: Item) {
      const ctx = this.ctx;
      ctx.save();
      ctx.translate(item.position.x, item.position.y);
      ctx.shadowBlur = 20;
      let color = '#fff';
      let label = '?';
      if (item.itemType === ItemType.HEALTH) { color = '#22c55e'; label = 'HP'; }
      if (item.itemType === ItemType.MANA) { color = '#3b82f6'; label = 'MP'; }
      if (item.itemType === ItemType.WEAPON_UP) { color = '#facc15'; label = 'UP'; }
      
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 2;
      
      ctx.rotate(item.wobble);
      
      ctx.beginPath();
      ctx.rect(-15, -15, 30, 30);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = color;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 1);
      
      ctx.restore();
  }

  drawParticle(p: Particle) {
    if (this.config.settings.effectQuality === 'LOW' && Math.random() > 0.5) return; 

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.globalAlpha = p.life;
    this.ctx.fillStyle = p.color;
    const speed = Math.sqrt(p.velocity.x**2 + p.velocity.y**2);
    const angle = Math.atan2(p.velocity.y, p.velocity.x);
    this.ctx.translate(p.position.x, p.position.y);
    this.ctx.rotate(angle);
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, p.size * (1 + speed/100), p.size, 0, 0, Math.PI*2);
    this.ctx.fill();
    this.ctx.restore();
  }
}