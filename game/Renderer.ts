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

    /**
     * ==========================================
     * 1. 终极背景渲染 (深空呼吸渐变 + 赛博穿梭网格)
     * ==========================================
     */
    clear() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); 
        const time = performance.now() / 1000;

        // 1. 深邃宇宙背景 (带微弱的呼吸感)
        const pulse = Math.sin(time * 0.5) * 0.05;
        const grad = this.ctx.createLinearGradient(0, 0, 0, this.config.height);
        grad.addColorStop(0, '#020111');
        grad.addColorStop(0.5, `rgba(${10 + pulse*50}, 5, 30, 1)`); // 中间紫色带呼吸
        grad.addColorStop(1, '#050914');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.config.width, this.config.height);
        
        // 2. 动态环境层 (可选：全息空间网格，增强速度感)
        if (this.config.settings.effectQuality !== 'LOW') {
            this.ctx.save();
            const gridSize = 120;
            // 网格向下高速流动
            const offsetY = (time * 150) % gridSize; 
            
            this.ctx.lineWidth = 1;
            this.ctx.globalCompositeOperation = 'screen';
            
            // 绘制横向扫描线 (带有向下消失的透视感)
            for(let y = offsetY; y < this.config.height; y += gridSize) {
                const alpha = Math.max(0, (y / this.config.height) * 0.15); // 越往下越亮
                this.ctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.config.width, y);
                this.ctx.stroke();
            }
            // 绘制垂直能量线
            for(let x = 0; x < this.config.width; x += gridSize) {
                const distToCenter = Math.abs(x - this.config.width/2) / (this.config.width/2);
                const alpha = (1 - distToCenter) * 0.08; // 中间亮两边暗
                this.ctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.config.height);
                this.ctx.stroke();
            }
            this.ctx.restore();
        }

        // 应用屏幕震动
        this.ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
    }

    /**
     * ==========================================
     * 2. 多重星云 (旋转气旋 + 复合光晕)
     * ==========================================
     */
    drawNebula(nebula: Nebula) {
        const ctx = this.ctx;
        const time = performance.now() / 3000;
        
        ctx.save();
        ctx.translate(nebula.position.x, nebula.position.y);
        ctx.rotate(time + nebula.position.x); // 每个星云有不同的自转初始相位
        
        ctx.globalCompositeOperation = 'screen';
        
        // 核心辉光层
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, nebula.scale);
        grad.addColorStop(0, nebula.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, nebula.scale, 0, Math.PI * 2);
        ctx.fill();

        // 旋涡云团层 (用交错的椭圆模拟)
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = nebula.color;
        for (let i = 0; i < 3; i++) {
            ctx.rotate(Math.PI / 1.5);
            ctx.beginPath();
            ctx.ellipse(nebula.scale * 0.2, 0, nebula.scale * 0.8, nebula.scale * 0.4, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }

    /**
     * ==========================================
     * 3. 钻石星辰 (高频闪烁 + 十字星芒)
     * ==========================================
     */
    drawStar(star: Star) {
        const ctx = this.ctx;
        const time = performance.now() / 1000;
        
        // 基于坐标和时间生成随机闪烁感
        const twinkle = 0.5 + Math.sin(time * 6 + star.position.x * 10) * 0.5;
        const alpha = star.brightness * (0.4 + twinkle * 0.6); // 保持一定基础亮度
        
        ctx.save();
        ctx.translate(star.position.x, star.position.y);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.globalCompositeOperation = 'lighter';

        // 基础星星实体
        ctx.beginPath();
        ctx.arc(0, 0, star.radius, 0, Math.PI * 2);
        ctx.fill();

        // 大星星添加极致的光晕和十字星芒 (Lens Flare)
        if (star.radius > 1.2 && this.config.settings.effectQuality !== 'LOW') {
            ctx.fillStyle = `rgba(150, 220, 255, ${alpha * 0.6})`;
            ctx.beginPath();
            // 横向星芒
            ctx.ellipse(0, 0, star.radius * 6, star.radius * 0.3, 0, 0, Math.PI*2);
            // 纵向星芒
            ctx.ellipse(0, 0, star.radius * 0.3, star.radius * 6, 0, 0, Math.PI*2);
            ctx.fill();
            
            // 核心高光晕染
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00ffff';
            ctx.beginPath();
            ctx.arc(0, 0, star.radius, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }

    /**
     * ==========================================
     * 4. 燃烧的岩浆陨石 (摩擦发热 + 表面裂纹)
     * ==========================================
     */
    drawMeteor(meteor: Meteor) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(meteor.position.x, meteor.position.y);
        ctx.rotate(meteor.rotation);
        
        // 大气摩擦的超热边缘发光
        ctx.shadowColor = '#ea580c'; // 橙红火光
        ctx.shadowBlur = 15;
        
        // 岩浆渐变底色
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, meteor.radius);
        grad.addColorStop(0, '#1f2937'); // 核心冷岩石
        grad.addColorStop(0.7, '#374151');
        grad.addColorStop(1, '#991b1b'); // 边缘烧红
        
        ctx.fillStyle = grad; 
        ctx.strokeStyle = '#f97316'; // 亮橙色描边
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        const spikes = 7;
        const r = meteor.radius;
        for(let i=0; i < spikes * 2; i++) {
            const angle = (i/(spikes*2)) * Math.PI * 2;
            const len = (i % 2 === 0) ? r : r * 0.6;
            ctx.lineTo(Math.cos(angle)*len, Math.sin(angle)*len);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // 表面熔岩裂纹点缀
        ctx.shadowBlur = 0; // 关掉阴影提高性能
        ctx.strokeStyle = '#facc15'; // 黄色裂纹
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-r*0.4, -r*0.2);
        ctx.lineTo(r*0.1, r*0.3);
        ctx.lineTo(r*0.4, 0);
        ctx.stroke();
        
        ctx.restore();
    }

    drawPlayer(player: Player) {
        PlayerModel.draw(this.ctx, player);
    }

    drawEnemy(enemy: Enemy) {
        EnemyModel.draw(this.ctx, enemy);
        
        // 优化 Boss 血条样式
        if (enemy.isBoss) {
            this.ctx.save();
            this.ctx.translate(enemy.position.x, enemy.position.y);
            // 边框底托
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.strokeStyle = '#ef4444';
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(-60, -120, 120, 12);
            this.ctx.strokeRect(-60, -120, 120, 12);
            
            // 动态发光血条
            this.ctx.fillStyle = '#dc2626';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#ef4444';
            const healthRatio = Math.max(0, enemy.health / enemy.maxHealth);
            this.ctx.fillRect(-59, -119, 118 * healthRatio, 10);
            this.ctx.restore();
        }
    }

    drawBullet(bullet: Bullet) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(bullet.position.x, bullet.position.y);
        ctx.rotate(bullet.rotation);
        ctx.globalCompositeOperation = 'lighter';

        if (bullet.type === EntityType.BULLET_PLAYER) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#facc15';
            ctx.fillStyle = '#fff';
            // 尾部拉长，增加射击速度感
            ctx.fillRect(-3, -20, 2, 35);
            ctx.fillRect(1, -20, 2, 35);
        } else {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff0055';
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            // 敌方光弹的外发光环
            ctx.strokeStyle = 'rgba(255, 0, 85, 0.8)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 9, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawChargeParticle(p: ChargeParticle) {
        // ... 原有逻辑很不错，保持不变
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

    drawSkillShield(shield: Shield) { ShieldModel.draw(this.ctx, shield); }

    drawSkillShockwave(sw: Shockwave) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(sw.position.x, sw.position.y);
        ctx.globalCompositeOperation = 'lighter';
        
        // 震荡波增加中心填充衰减，不仅仅是一个圈
        const grad = ctx.createRadialGradient(0, 0, sw.radius * 0.8, 0, 0, sw.radius);
        grad.addColorStop(0, 'rgba(251, 191, 36, 0)');
        grad.addColorStop(0.8, `rgba(251, 191, 36, ${sw.opacity * 0.5})`);
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, sw.radius, 0, Math.PI*2); ctx.fill();

        ctx.strokeStyle = `rgba(255, 230, 100, ${sw.opacity})`;
        ctx.lineWidth = 8;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(0, 0, sw.radius, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
    }

    /**
     * ==========================================
     * 5. 暴击跳字 (街机风格弹簧缩放 + 霓虹描边)
     * ==========================================
     */
    drawFloatingText(ft: FloatingText) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(ft.position.x, ft.position.y);
        
        // 出现时的夸张弹起效果，消失时的平滑缩放
        const popScale = ft.life > 0.8 ? 1.5 - (1 - ft.life) * 2.5 : 1.0;
        const fadeScale = Math.max(0, ft.life);
        const scale = popScale * fadeScale;
        
        ctx.scale(scale, scale);
        ctx.globalAlpha = Math.min(1, ft.life * 2.5); // 快速淡入，缓慢淡出
        
        ctx.font = '900 26px "Arial Black", Impact, sans-serif'; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 外层黑色粗描边垫底
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(ft.text, 0, 0);

        // 颜色光晕
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, 0, 0);

        // 核心白光叠加
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(ft.text, 0, 0);
        
        ctx.restore();
    }

    /**
     * ==========================================
     * 6. 高能等离子粒子 (极速物理拉伸变形)
     * ==========================================
     */
    drawParticle(p: Particle) {
        if (this.config.settings.effectQuality === 'LOW' && Math.random() > 0.5) return; 

        const ctx = this.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p.life;
        
        ctx.translate(p.position.x, p.position.y);
        const speed = Math.sqrt(p.velocity.x**2 + p.velocity.y**2);
        const angle = Math.atan2(p.velocity.y, p.velocity.x);
        ctx.rotate(angle);
        
        // 核心白光：让粒子看起来像高能光子
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.5, p.size * 0.5, 0, 0, Math.PI*2);
        ctx.fill();

        // 外围颜色：根据移动速度产生极致的残影拉伸
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        const stretchX = 1 + speed / 80; // 速度越快拉得越长
        const stretchY = 0.8; // 微微压扁
        ctx.ellipse(0, 0, p.size * stretchX, p.size * stretchY, 0, 0, Math.PI*2);
        ctx.fill();
        
        ctx.restore();
    }

    drawItem(item: Item) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(item.position.x, item.position.y);
        
        let color = '#fff';
        let label = '?';
        if (item.itemType === ItemType.HEALTH) { color = '#22c55e'; label = '+HP'; }
        if (item.itemType === ItemType.MANA) { color = '#3b82f6'; label = '+MP'; }
        if (item.itemType === ItemType.WEAPON_UP) { color = '#facc15'; label = 'UP!'; }
        
        // 物品外发光呼吸灯
        const time = performance.now() / 200;
        ctx.shadowBlur = 15 + Math.sin(time) * 10;
        ctx.shadowColor = color;
        
        ctx.rotate(item.wobble);
        
        // 半透明深色底托
        ctx.fillStyle = 'rgba(10, 15, 30, 0.8)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        
        ctx.beginPath();
        ctx.roundRect(-16, -16, 32, 32, 6); // 圆角矩形更高级
        ctx.fill();
        ctx.stroke();
        
        // 文字高光
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = color;
        ctx.font = 'bold 16px "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 1);
        
        ctx.restore();
    }
}
