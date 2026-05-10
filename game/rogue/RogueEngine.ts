import { Entity, Player, Enemy, Bullet, Particle, Star, Meteor, Nebula, Shield, Shockwave, FloatingText, ChargeParticle } from "../Entities";
import { Laser } from "../Laser";
import { BlackHole } from "../BlackHole";
import { TeslaLightning } from "../Tesla";
import { Bomb, Explosion } from "../Bomb";
import { Missile } from "../Missile";
import { EnemyLaser } from "../EnemyLaser";
import { InputManager } from "../InputManager";
import { Renderer } from "../Renderer";
import { GameState, EntityType, WeaponType, Vector2, GameSettings } from "../../types";
import { MagicCircle } from "./MagicCircle";
import {
    RogueState, RoguePhase, PerkId, PerkDef, CircleElement,
    StarterConfig, STARTER_OPTIONS, PERK_POOL,
    createRogueState, computeModifiers, drawPerks, RogueModifiers
} from "./RogueTypes";
import { RogueUI } from "./RogueUI";

/**
 * 肉鸽模式引擎
 *
 * 完全独立的游戏循环, 不依赖 GameEngine.
 * 流程: 选武器 -> [打 Boss -> 选增益] x N 层 -> 通关/死亡
 */
export class RogueEngine {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    input: InputManager;
    renderer: Renderer;
    ui: RogueUI;

    width: number;
    height: number;
    settings: GameSettings = { difficulty: 'NORMAL', effectQuality: 'HIGH' };

    state: RogueState;
    player: Player | null = null;
    entities: Entity[] = [];
    stars: (Star | Meteor | Nebula)[] = [];
    magicCircle: MagicCircle | null = null;

    lastTime: number = 0;
    shakeTimer: number = 0;
    shakeIntensity: number = 0;
    hitStopTimer: number = 0;

    bossDefeated: boolean = false;
    running: boolean = false;

    // 回调
    onExit: () => void;

    constructor(canvas: HTMLCanvasElement, onExit: () => void) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false })!;
        this.width = canvas.width;
        this.height = canvas.height;
        this.onExit = onExit;

        this.input = new InputManager();
        this.renderer = new Renderer(this.ctx, { width: this.width, height: this.height, settings: this.settings });
        this.ui = new RogueUI(this.ctx, this.width, this.height);
        this.state = createRogueState();

        this.initStars();
    }

    resize(w: number, h: number) {
        this.width = w;
        this.height = h;
        this.renderer.config.width = w;
        this.renderer.config.height = h;
        this.ui.resize(w, h);
    }

    start() {
        this.state = createRogueState();
        this.running = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop.bind(this));
    }

    stop() {
        this.running = false;
    }

    // ================== 游戏循环 ==================
    private loop(timestamp: number) {
        if (!this.running) return;
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame(this.loop.bind(this));
    }

    private update(dt: number) {
        // 更新星空背景
        this.stars.forEach(s => {
            s.update(dt);
            if (s.position.y > this.height + 100) {
                s.position.y = -100;
                s.position.x = Math.random() * this.width;
            }
        });

        switch (this.state.phase) {
            case RoguePhase.WEAPON_SELECT:
                this.updateWeaponSelect();
                break;
            case RoguePhase.FIGHTING:
                this.updateFighting(dt);
                break;
            case RoguePhase.PERK_SELECT:
                this.updatePerkSelect();
                break;
            case RoguePhase.GAME_OVER:
            case RoguePhase.VICTORY:
                this.updateEndScreen();
                break;
        }
    }

    // ================== 武器选择阶段 ==================
    private updateWeaponSelect() {
        // 处理点击
        if (this.input.isClicked) {
            const click = this.input.lastClickPos;
            const choice = this.ui.hitTestStarterCards(click.x, click.y);
            if (choice !== null) {
                this.state.starterWeapon = choice;
                // 魔法阵需要选派系 (简化: 随机或用第二次点击选)
                // 这里简化为: 先进入元素选择, 如果不是魔法阵直接开战
                if (choice === 'MAGIC_CIRCLE') {
                    // 简化: 点左半选火, 右半选电
                    this.state.circleElement = click.x < this.width / 2 ? CircleElement.FIRE : CircleElement.ELECTRIC;
                }
                this.startLayer();
            }
            this.input.isClicked = false;
        }
    }

    // ================== 战斗阶段 ==================
    private updateFighting(dt: number) {
        if (this.hitStopTimer > 0) { this.hitStopTimer -= dt; dt = 0; }
        if (this.shakeTimer > 0) { this.shakeTimer -= dt; if (this.shakeTimer <= 0) this.shakeIntensity = 0; }

        if (!this.player || this.player.markedForDeletion) {
            this.state.phase = RoguePhase.GAME_OVER;
            return;
        }

        // 玩家输入
        const moveVec = this.input.getMovementVector();
        this.player.acceleration.x = moveVec.x * this.player.thrust;
        this.player.acceleration.y = moveVec.y * this.player.thrust;

        // 开火逻辑 (简化版, 根据 starterWeapon 决定)
        this.handleWeaponFiring(dt);

        // 技能 (如果已解锁)
        if (this.input.isKeyPressed('1') && this.state.modifiers.hasShield) this.triggerSkill(1);
        if (this.input.isKeyPressed('2') && this.state.modifiers.hasBlackhole) this.triggerSkill(2);
        if (this.input.isKeyPressed('3') && this.state.modifiers.hasShockwave) this.triggerSkill(3);

        // 边界
        this.player.position.x = Math.max(20, Math.min(this.width - 20, this.player.position.x));
        this.player.position.y = Math.max(20, Math.min(this.height - 20, this.player.position.y));

        // 更新实体
        const enemies = this.entities.filter(e => e instanceof Enemy) as Enemy[];
        this.entities.forEach(entity => {
            if (entity instanceof Missile) entity.update(dt, enemies);
            else if (entity instanceof Laser) entity.update(dt, enemies);
            else entity.update(dt, this.player ? this.player.position : undefined);
        });

        // 魔法阵 tick
        if (this.magicCircle) {
            this.magicCircle.update(dt);
            const result = this.magicCircle.tryTick(enemies);
            if (result) {
                for (const e of result.hit) {
                    if (e.health <= 0) this.killEnemy(e);
                }
            }
        }

        // 简化碰撞 (玩家子弹 vs 敌人)
        this.checkCollisions();

        // 清理
        this.entities = this.entities.filter(e => !e.markedForDeletion);

        // 检查 Boss 是否死了
        const bossAlive = enemies.some(e => e.isBoss && !e.markedForDeletion);
        if (!bossAlive && this.bossDefeated === false && this.state.layer > 0) {
            // 可能 Boss 还没生成 (刚开始), 只有真正打过才算
            const hadBoss = this.entities.some(e => e instanceof Enemy && (e as Enemy).isBoss) === false
                && enemies.length > 0;
            // 简化判断: enemies 里没有 boss 了
            if (enemies.filter(e => !e.markedForDeletion).length === 0) {
                this.bossDefeated = true;
                this.onLayerClear();
            }
        }
    }

    // ================== Perk 选择阶段 ==================
    private updatePerkSelect() {
        if (this.input.isClicked) {
            const click = this.input.lastClickPos;
            const idx = this.ui.hitTestPerkCards(click.x, click.y, this.state.perkChoices.length);
            if (idx !== null && idx < this.state.perkChoices.length) {
                this.selectPerk(this.state.perkChoices[idx]);
            }
            this.input.isClicked = false;
        }
    }

    // ================== 结束画面 ==================
    private updateEndScreen() {
        if (this.input.isClicked) {
            this.input.isClicked = false;
            this.stop();
            this.onExit();
        }
    }

    // ================== 渲染 ==================
    private draw() {
        let shakeX = 0, shakeY = 0;
        if (this.shakeIntensity > 0) {
            shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            shakeY = (Math.random() - 0.5) * this.shakeIntensity;
        }
        this.renderer.setShake(shakeX, shakeY);
        this.renderer.clear();

        // 背景
        this.stars.forEach(s => {
            if (s.type === EntityType.NEBULA) this.renderer.drawNebula(s as Nebula);
            else if (s instanceof Meteor) this.renderer.drawMeteor(s);
            else this.renderer.drawStar(s as Star);
        });

        if (this.state.phase === RoguePhase.FIGHTING) {
            // 魔法阵 (在玩家下面)
            if (this.magicCircle) MagicCircle.draw(this.ctx, this.magicCircle);

            // 实体
            this.entities.forEach(e => {
                if (e instanceof Player) this.renderer.drawPlayer(e);
                else if (e instanceof Enemy) this.renderer.drawEnemy(e);
                else if (e instanceof Bullet) this.renderer.drawBullet(e);
                else if (e instanceof Laser) Laser.draw(this.ctx, e);
                else if (e instanceof EnemyLaser) EnemyLaser.draw(this.ctx, e);
                else if (e instanceof Missile) Missile.draw(this.ctx, e);
                else if (e instanceof Particle) this.renderer.drawParticle(e);
                else if (e instanceof FloatingText) this.renderer.drawFloatingText(e);
                else if (e instanceof Shield) this.renderer.drawSkillShield(e);
                else if (e instanceof Shockwave) this.renderer.drawSkillShockwave(e);
                else if (e instanceof BlackHole) BlackHole.draw(this.ctx, e);
                else if (e instanceof ChargeParticle) this.renderer.drawChargeParticle(e);
                else if (e instanceof Bomb) Bomb.draw(this.ctx, e);
                else if (e instanceof Explosion) Explosion.draw(this.ctx, e);
                else if (e instanceof TeslaLightning) TeslaLightning.draw(this.ctx, e);
            });

            // HUD
            this.ui.drawFightingHUD(this.state, this.player);
        }

        // 覆盖 UI
        switch (this.state.phase) {
            case RoguePhase.WEAPON_SELECT:
                this.ui.drawWeaponSelect(this.state);
                break;
            case RoguePhase.PERK_SELECT:
                this.ui.drawPerkSelect(this.state);
                break;
            case RoguePhase.GAME_OVER:
                this.ui.drawEndScreen(this.state, false);
                break;
            case RoguePhase.VICTORY:
                this.ui.drawEndScreen(this.state, true);
                break;
        }
    }

    // ================== 层级管理 ==================
    private startLayer() {
        this.state.layer++;
        this.state.phase = RoguePhase.FIGHTING;
        this.state.bossHpScale = 1 + (this.state.layer - 1) * 0.4;
        this.bossDefeated = false;

        // 创建玩家
        this.entities = [];
        this.player = new Player(this.width / 2, this.height - 100);
        this.applyModifiersToPlayer();
        this.entities.push(this.player);

        // 魔法阵
        if (this.state.starterWeapon === 'MAGIC_CIRCLE' && this.state.circleElement) {
            this.magicCircle = new MagicCircle(this.player, this.state.circleElement, this.state.modifiers);
        } else {
            this.magicCircle = null;
        }

        // 武器设置
        if (this.state.starterWeapon === 'VULCAN') {
            this.player.currentWeapon = WeaponType.VULCAN;
        } else if (this.state.starterWeapon === 'LASER') {
            this.player.currentWeapon = WeaponType.LASER;
        }
        // MAGIC_CIRCLE 不使用 currentWeapon 系统, 靠 MagicCircle 实体

        // 生成 Boss
        this.spawnLayerBoss();
    }

    private spawnLayerBoss() {
        const bossTypes = [EntityType.ENEMY_BOSS, EntityType.ENEMY_BOSS_CARRIER, EntityType.ENEMY_BOSS_REAVER];
        const chosen = bossTypes[Math.floor(Math.random() * bossTypes.length)];
        const boss = new Enemy(this.width / 2, -120, this.state.bossHpScale, true, chosen);
        this.entities.push(boss);
    }

    private onLayerClear() {
        if (this.state.layer >= this.state.maxLayers) {
            this.state.phase = RoguePhase.VICTORY;
            return;
        }
        // 进入选增益
        this.state.perkChoices = drawPerks(this.state, 3);
        this.state.phase = RoguePhase.PERK_SELECT;
    }

    private selectPerk(perk: PerkDef) {
        this.state.perks.push(perk.id);

        // 即时效果
        if (perk.id === PerkId.HEAL && this.player) {
            this.player.health = Math.min(this.player.maxHealth, this.player.health + this.player.maxHealth * 0.5);
        }
        if (perk.id === PerkId.MAX_HP_UP && this.player) {
            this.player.maxHealth += 30;
            this.player.health = this.player.maxHealth;
        }

        // 重新计算 modifiers
        this.state.modifiers = computeModifiers(this.state.perks);
        this.state.perkChoices = [];

        // 开始下一层
        this.startLayer();
    }

    private applyModifiersToPlayer() {
        if (!this.player) return;
        const m = this.state.modifiers;
        this.player.maxHealth = 100 + m.maxHpBonus;
        this.player.health = this.player.maxHealth;
        this.player.maxMana = 100 + m.maxManaBonus;
        this.player.mana = this.player.maxMana;
        this.player.thrust = 2000 * m.moveSpeedMultiplier;
        this.player.damageMultiplier = m.damageMultiplier;

        // 激光冷却缩减
        if (this.state.starterWeapon === 'LASER') {
            this.player.laserCooldownMax = Math.max(0.5, 3 - m.laserCdReduction);
        }

        // 射速 (机枪)
        if (this.state.starterWeapon === 'VULCAN') {
            this.player.fireRate = Math.max(30, 90 / m.fireRateMultiplier);
        }
    }

    // ================== 武器开火 ==================
    private handleWeaponFiring(dt: number) {
        if (!this.player) return;
        const now = performance.now();
        const isFiring = this.input.isFiring;

        if (this.state.starterWeapon === 'VULCAN') {
            if (isFiring && now - this.player.lastShotTime > this.player.fireRate) {
                this.player.lastShotTime = now;
                const wx = this.player.position.x;
                const wy = this.player.position.y;
                this.entities.push(new Bullet(wx, wy, true, WeaponType.VULCAN, -0.05, 0, this.player));
                this.entities.push(new Bullet(wx, wy, true, WeaponType.VULCAN, 0.05, 0, this.player));
                // 散射加成
                const extra = this.state.modifiers.spreadBonus;
                for (let i = 0; i < extra; i++) {
                    const off = (i + 1) * 0.12 * (i % 2 === 0 ? 1 : -1);
                    this.entities.push(new Bullet(wx, wy, true, WeaponType.VULCAN, off, 0, this.player));
                }
            }
        } else if (this.state.starterWeapon === 'LASER') {
            const existingBeam = this.entities.find(e => e instanceof Laser && (e as Laser).owner === this.player);
            if (this.player.laserCooldown > 0) {
                this.player.isCharging = false;
                this.player.chargeLevel = 0;
            } else if (isFiring && !existingBeam) {
                this.player.isCharging = true;
                this.player.chargeLevel = Math.min(100, this.player.chargeLevel + this.player.chargeRate * dt);
                if (this.player.chargeLevel >= 100) {
                    this.entities.push(new Laser(this.player));
                    this.player.chargeLevel = 0;
                    this.player.isCharging = false;
                    this.player.laserCooldown = this.player.laserCooldownMax;
                    this.addShake(10, 0.35);
                }
            } else {
                this.player.isCharging = false;
                this.player.chargeLevel = Math.max(0, this.player.chargeLevel - this.player.chargeRate * dt * 2);
            }
        }
        // MAGIC_CIRCLE 不需要手动开火, MagicCircle.tryTick 自动处理
    }

    // ================== 碰撞检测 (简化版) ==================
    private checkCollisions() {
        for (let i = 0; i < this.entities.length; i++) {
            const a = this.entities[i];
            if (a.markedForDeletion) continue;
            for (let j = i + 1; j < this.entities.length; j++) {
                const b = this.entities[j];
                if (b.markedForDeletion) continue;

                // 玩家子弹 vs 敌人
                const isPlayerBullet = a.type === EntityType.BULLET_PLAYER || b.type === EntityType.BULLET_PLAYER;
                const isEnemy = a instanceof Enemy || b instanceof Enemy;

                if (isPlayerBullet && isEnemy) {
                    const enemy = (a instanceof Enemy ? a : b) as Enemy;
                    const bullet = (a.type === EntityType.BULLET_PLAYER ? a : b) as Bullet;
                    const dx = a.position.x - b.position.x;
                    const dy = a.position.y - b.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bullet.radius + enemy.radius) {
                        // 暴击
                        let dmg = bullet.damage;
                        if (Math.random() < this.state.modifiers.critChance) dmg *= 2;
                        enemy.applyDamage(dmg);
                        bullet.markedForDeletion = true;
                        if (enemy.health <= 0) this.killEnemy(enemy);
                    }
                }

                // Laser vs enemy (polyline)
                const isLaserA = a instanceof Laser;
                const isLaserB = b instanceof Laser;
                if (isLaserA || isLaserB) {
                    const laser = (isLaserA ? a : b) as Laser;
                    const target = (isLaserA ? b : a);
                    if (target instanceof Enemy && laser.damage > 0 && laser.path && laser.path.length >= 2) {
                        const d2 = Laser.pointDistanceSqToPath(target.position.x, target.position.y, laser.path);
                        const r = laser.hitRadius + target.radius;
                        if (d2 <= r * r) {
                            let dmg = laser.damage;
                            if (Math.random() < this.state.modifiers.critChance) dmg *= 2;
                            target.applyDamage(dmg);
                            if (target.health <= 0) this.killEnemy(target);
                        }
                    }
                }

                // 敌弹 vs 玩家
                const isEnemyBullet = a.type === EntityType.BULLET_ENEMY || b.type === EntityType.BULLET_ENEMY;
                const isPlayer = a instanceof Player || b instanceof Player;
                if (isEnemyBullet && isPlayer) {
                    const player = (a instanceof Player ? a : b) as Player;
                    const bullet = (a.type === EntityType.BULLET_ENEMY ? a : b);
                    const dx = a.position.x - b.position.x;
                    const dy = a.position.y - b.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < player.radius + bullet.radius) {
                        bullet.markedForDeletion = true;
                        player.health -= 10;
                        this.addShake(12, 0.3);
                        if (player.health <= 0) {
                            player.markedForDeletion = true;
                        }
                    }
                }
            }
        }
    }

    // ================== 辅助 ==================
    private killEnemy(enemy: Enemy) {
        if (enemy.markedForDeletion) return;
        enemy.markedForDeletion = true;
        // 爆炸效果
        for (let i = 0; i < 12; i++) {
            this.entities.push(new Particle(enemy.position.x, enemy.position.y, '#ffaa00', 300, 0.4, 3));
        }
        this.addShake(enemy.isBoss ? 25 : 5, enemy.isBoss ? 1.5 : 0.2);
    }

    private addShake(intensity: number, duration: number) {
        this.shakeIntensity = intensity;
        this.shakeTimer = duration;
    }

    private triggerSkill(index: number) {
        if (!this.player) return;
        const p = this.player;
        if (index === 1 && p.skills.shield.current <= 0) {
            p.skills.shield.current = p.skills.shield.max * this.state.modifiers.skillCdMultiplier;
            p.skills.shield.active = true;
            p.skills.shield.activeTimer = p.skills.shield.duration;
            this.entities.push(new Shield(p));
        } else if (index === 2 && p.skills.blackhole.current <= 0) {
            p.skills.blackhole.current = p.skills.blackhole.max * this.state.modifiers.skillCdMultiplier;
            this.entities.push(new BlackHole(p.position.x, p.position.y - 250));
        } else if (index === 3 && p.skills.shockwave.current <= 0) {
            p.skills.shockwave.current = p.skills.shockwave.max * this.state.modifiers.skillCdMultiplier;
            this.entities.push(new Shockwave(p.position.x, p.position.y));
            this.addShake(20, 0.3);
        }
    }

    private initStars() {
        this.stars = [];
        for (let i = 0; i < 3; i++) this.stars.push(new Nebula(this.width, this.height));
        for (let i = 0; i < 150; i++) this.stars.push(new Star(this.width, this.height));
    }
}
