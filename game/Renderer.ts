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

/**
 * 渲染器 - 性能优化版
 * 关键优化：
 * 1. 避免每帧使用 shadowBlur (canvas 性能杀手)，只在少量重点元素上使用
 * 2. 大量背景元素 (stars / grid) 预渲染到离屏 canvas，减少每帧的 path/fill 调用
 * 3. 减少 save/restore 次数
 * 4. 批量绘制同类元素
 */
export class Renderer {
    ctx: CanvasRenderingContext2D;
    config: GameConfig;
    shakeOffset: { x: number; y: number } = { x: 0, y: 0 };

    // 背景缓存
    private bgCanvas: HTMLCanvasElement;
    private bgCtx: CanvasRenderingContext2D;
    private bgCacheWidth: number = 0;
    private bgCacheHeight: number = 0;

    constructor(ctx: CanvasRenderingContext2D, config: GameConfig) {
        this.ctx = ctx;
        this.config = config;

        this.bgCanvas = document.createElement('canvas');
        this.bgCtx = this.bgCanvas.getContext('2d')!;
    }

    setShake(x: number, y: number) {
        this.shakeOffset = { x, y };
    }

    /**
     * 预渲染背景渐变和网格到 offscreen canvas。
     * 只在尺寸变化时重新生成，普通帧只需要 drawImage。
     */
    private rebuildBgCache() {
        const w = this.config.width;
        const h = this.config.height;
        this.bgCanvas.width = w;
        this.bgCanvas.height = h;
        const bctx = this.bgCtx;

        // 深邃宇宙渐变
        const grad = bctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#020111');
        grad.addColorStop(0.5, '#0a051e');
        grad.addColorStop(1, '#050914');
        bctx.fillStyle = grad;
        bctx.fillRect(0, 0, w, h);

        // 静态网格 (不再动画，避免每帧重绘)
        if (this.config.settings.effectQuality !== 'LOW') {
            bctx.save();
            const gridSize = 120;
            bctx.lineWidth = 1;
            bctx.globalCompositeOperation = 'screen';

            for (let y = 0; y < h; y += gridSize) {
                const alpha = Math.max(0, (y / h) * 0.12);
                bctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
                bctx.beginPath();
                bctx.moveTo(0, y);
                bctx.lineTo(w, y);
                bctx.stroke();
            }
            for (let x = 0; x < w; x += gridSize) {
                const distToCenter = Math.abs(x - w / 2) / (w / 2);
                const alpha = (1 - distToCenter) * 0.06;
                bctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
                bctx.beginPath();
                bctx.moveTo(x, 0);
                bctx.lineTo(x, h);
                bctx.stroke();
            }
            bctx.restore();
        }

        this.bgCacheWidth = w;
        this.bgCacheHeight = h;
    }

    clear() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);

        if (
            this.bgCacheWidth !== this.config.width ||
            this.bgCacheHeight !== this.config.height
        ) {
            this.rebuildBgCache();
        }
        // 一次 drawImage 替代原来的多次 beginPath/stroke
        this.ctx.drawImage(this.bgCanvas, 0, 0);

        // 应用屏幕震动
        this.ctx.translate(this.shakeOffset.x, this.shakeOffset.y);
    }

    /**
     * 星云 - 保持轻量
     */
    drawNebula(nebula: Nebula) {
        const ctx = this.ctx;
        const time = performance.now() / 5000;

        ctx.save();
        ctx.translate(nebula.position.x, nebula.position.y);
        ctx.rotate(time + nebula.position.x * 0.001);
        ctx.globalCompositeOperation = 'screen';

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, nebula.scale);
        grad.addColorStop(0, nebula.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, nebula.scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * 星星 - 大幅简化：小星星只画一个矩形，大星星只画一个圆形
     * 不再使用 shadowBlur 和多重椭圆，200 颗星就能轻松渲染
     */
    drawStar(star: Star) {
        const ctx = this.ctx;

        // 闪烁（基于位置和时间）避免每颗星都调用 performance.now 后计算太多次
        const t = performance.now() * 0.004 + star.position.x * 0.01;
        const twinkle = 0.6 + Math.sin(t) * 0.4;
        const alpha = star.brightness * twinkle;

        if (star.radius < 1.0) {
            // 小星星：fillRect 比 arc + beginPath + fill 快得多
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillRect(star.position.x, star.position.y, 1, 1);
        } else {
            ctx.fillStyle = `rgba(200, 230, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(star.position.x, star.position.y, star.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * 流星 - 去掉 shadowBlur，保留核心视觉
     */
    drawMeteor(meteor: Meteor) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(meteor.position.x, meteor.position.y);
        ctx.rotate(meteor.rotation);

        ctx.fillStyle = '#9a3412';
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.5;

        const r = meteor.radius;
        ctx.beginPath();
        const spikes = 7;
        for (let i = 0; i < spikes * 2; i++) {
            const angle = (i / (spikes * 2)) * Math.PI * 2;
            const len = i % 2 === 0 ? r : r * 0.6;
            ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    drawPlayer(player: Player) {
        PlayerModel.draw(this.ctx, player);
    }

    drawEnemy(enemy: Enemy) {
        EnemyModel.draw(this.ctx, enemy);

        if (enemy.isBoss) {
            const ctx = this.ctx;
            ctx.save();
            ctx.translate(enemy.position.x, enemy.position.y);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.fillRect(-60, -120, 120, 12);
            ctx.strokeRect(-60, -120, 120, 12);

            ctx.fillStyle = '#dc2626';
            const healthRatio = Math.max(0, enemy.health / enemy.maxHealth);
            ctx.fillRect(-59, -119, 118 * healthRatio, 10);
            ctx.restore();
        }
    }

    /**
     * 子弹 - 去掉 shadowBlur (每帧可能几十颗子弹，blur 代价巨大)
     * 改用叠加一层更大更淡的形状模拟 glow
     */
    drawBullet(bullet: Bullet) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(bullet.position.x, bullet.position.y);
        ctx.rotate(bullet.rotation);
        ctx.globalCompositeOperation = 'lighter';

        if (bullet.type === EntityType.BULLET_PLAYER) {
            if (bullet.weaponType === WeaponType.RAILGUN) {
                // 电磁轨道炮：长条紫光 + 白色核心 + 两侧电轨
                ctx.fillStyle = 'rgba(167, 139, 250, 0.35)';
                ctx.fillRect(-8, -38, 16, 70);
                ctx.fillStyle = 'rgba(216, 180, 254, 0.9)';
                ctx.fillRect(-3, -38, 6, 70);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-1, -38, 2, 70);
                // 电轨光
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-6, -32); ctx.lineTo(-6, 30);
                ctx.moveTo(6, -32);  ctx.lineTo(6, 30);
                ctx.stroke();
            } else if (bullet.weaponType === WeaponType.SPREAD) {
                // 散弹：橙色小光点
                ctx.fillStyle = 'rgba(251, 146, 60, 0.45)';
                ctx.beginPath();
                ctx.arc(0, 0, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff7ed';
                ctx.beginPath();
                ctx.arc(0, 0, 3, 0, Math.PI * 2);
                ctx.fill();
            } else if (bullet.weaponType === WeaponType.FLAK) {
                // 高射炮: 带引信的黄色弹
                // 有引信 (未空爆) -> 画子弹主体
                if (bullet.fuseMax > 0) {
                    // 外晕
                    ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
                    ctx.beginPath();
                    ctx.arc(0, 0, 12, 0, Math.PI * 2);
                    ctx.fill();
                    // 壳体
                    ctx.fillStyle = '#78350f';
                    ctx.fillRect(-4, -8, 8, 16);
                    ctx.fillStyle = '#fbbf24';
                    ctx.fillRect(-3, -7, 6, 14);
                    // 警告灯闪烁
                    const blink = (performance.now() * 0.02) % 1 < 0.5;
                    ctx.fillStyle = blink ? '#fef08a' : '#f97316';
                    ctx.beginPath();
                    ctx.arc(0, 0, 2, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // 空爆后的碎片: 亮色长尾
                    ctx.fillStyle = 'rgba(253, 224, 71, 0.55)';
                    ctx.fillRect(-3, -10, 6, 14);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(-1, -10, 2, 14);
                }
            } else if (bullet.weaponType === WeaponType.HELIX) {
                // 螺旋: 绿色光子团
                ctx.fillStyle = 'rgba(74, 222, 128, 0.45)';
                ctx.beginPath();
                ctx.arc(0, 0, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#d1fae5';
                ctx.beginPath();
                ctx.arc(0, 0, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // VULCAN 默认
                ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
                ctx.fillRect(-5, -22, 10, 40);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-2, -20, 4, 35);
            }
        } else {
            // 敌方子弹 - 空投式 FLAK 专门绘制
            if (bullet.weaponType === WeaponType.VULCAN && (bullet as any)._isAirstrike) {
                // 下落的炸弹
                ctx.fillStyle = 'rgba(251, 146, 60, 0.35)';
                ctx.beginPath();
                ctx.arc(0, 0, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#7f1d1d';
                ctx.beginPath();
                ctx.arc(0, 0, 7, 0, Math.PI * 2);
                ctx.fill();
                // 警告闪烁
                const blink = (performance.now() * 0.025) % 1 < 0.5;
                ctx.fillStyle = blink ? '#fef08a' : '#f97316';
                ctx.beginPath();
                ctx.arc(0, 0, 3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = 'rgba(255, 0, 85, 0.35)';
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    /**
     * 充能粒子 - 去掉 shadowBlur
     */
    drawChargeParticle(p: ChargeParticle) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 外层淡光
        ctx.fillStyle = 'rgba(8, 145, 178, 0.5)';
        ctx.beginPath();
        ctx.arc(p.position.x, p.position.y, p.radius * 1.8, 0, Math.PI * 2);
        ctx.fill();
        // 核心
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.position.x, p.position.y, p.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawSkillShield(shield: Shield) {
        ShieldModel.draw(this.ctx, shield);
    }

    drawSkillShockwave(sw: Shockwave) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(sw.position.x, sw.position.y);
        ctx.globalCompositeOperation = 'lighter';

        ctx.strokeStyle = `rgba(255, 230, 100, ${sw.opacity})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(0, 0, sw.radius, 0, Math.PI * 2);
        ctx.stroke();

        // 内圈次高光
        ctx.strokeStyle = `rgba(255, 255, 255, ${sw.opacity * 0.5})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, sw.radius * 0.95, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    drawFloatingText(ft: FloatingText) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(ft.position.x, ft.position.y);

        const popScale = ft.life > 0.8 ? 1.5 - (1 - ft.life) * 2.5 : 1.0;
        const fadeScale = Math.max(0, ft.life);
        const scale = popScale * fadeScale;

        ctx.scale(scale, scale);
        ctx.globalAlpha = Math.min(1, ft.life * 2.5);

        ctx.font = '900 22px "Arial Black", Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 黑色描边
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(ft.text, 0, 0);

        // 主色填充
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, 0, 0);

        ctx.restore();
    }

    /**
     * 粒子 - 性能敏感，去掉 shadowBlur/ellipse rotation
     * 低画质下直接跳过一半粒子
     */
    drawParticle(p: Particle) {
        if (this.config.settings.effectQuality === 'LOW' && Math.random() > 0.5) return;

        const ctx = this.ctx;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;

        const size = p.size;
        // 用 fillRect 比 arc 快得多，对粒子来说像素差几乎看不出
        ctx.fillRect(p.position.x - size, p.position.y - size, size * 2, size * 2);

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    drawItem(item: Item) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(item.position.x, item.position.y);

        let color = '#fff';
        let label = '?';
        if (item.itemType === ItemType.HEALTH) {
            color = '#22c55e';
            label = '+HP';
        } else if (item.itemType === ItemType.MANA) {
            color = '#3b82f6';
            label = '+MP';
        } else if (item.itemType === ItemType.WEAPON_UP) {
            color = '#facc15';
            label = 'UP!';
        }

        ctx.rotate(item.wobble);

        // 外发光层（代替 shadowBlur）
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        // 主体
        ctx.fillStyle = 'rgba(10, 15, 30, 0.9)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-16, -16, 32, 32, 6);
        ctx.fill();
        ctx.stroke();

        // 文字
        ctx.fillStyle = color;
        ctx.font = 'bold 14px "Arial Black", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 1);

        ctx.restore();
    }
}
