import { Entity, Player, Enemy, Bullet, Particle, Star, Meteor, Nebula, Shield, Shockwave, FloatingText, ChargeParticle } from "../Entities";
import { Laser } from "../Laser";
import { BlackHole } from "../BlackHole";
import { TeslaLightning } from "../Tesla";
import { Bomb, Explosion } from "../Bomb";
import { Missile } from "../Missile";
import { EnemyLaser } from "../EnemyLaser";
import { InputManager } from "../InputManager";
import { Renderer } from "../Renderer";
import { EntityType, WeaponType, GameSettings } from "../../types";
import { MagicCircle } from "./MagicCircle";
import {
    RogueState, RoguePhase, PerkId, PerkDef, CircleElement,
    createRogueState, computeModifiers, drawPerks
} from "./RogueTypes";
import { RogueUI } from "./RogueUI";

/**
 * 肉鸽模式引擎
 *
 * 完全独立的游戏循环, 不依赖 GameEngine.
 * 流程: 选武器 -> [打 Boss + 小怪 -> 选增益] x N 层 -> 通关/死亡
 *
 * 战斗阶段:
 * - Boss 从屏幕顶端出场, 持续释放弹幕
 * - 定时刷小怪波次, 层数越高刷的越密
 * - Boss 死亡后清场 -> 进入选 Perk
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
    boss: Enemy | null = null;

    lastTime: number = 0;
    shakeTimer: number = 0;
    shakeIntensity: number = 0;
    hitStopTimer: number = 0;

    // 小怪刷新计时
    minionSpawnTimer: number = 3; // 初始延迟 3s
    // Boss 出场宽限时间 (不会立即开火)
    bossGraceTimer: number = 0;

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
        // shake 无论在哪个阶段都要衰减, 避免 Boss 死后选 Perk 画面一直抖
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            if (this.shakeTimer <= 0) this.shakeIntensity = 0;
        }

        // 背景总是在更新
        this.stars.forEach(s => {
            s.update(dt);
            if (s.position.y > this.height + 100) {
                s.position.y = -100;
                s.position.x = Math.random() * this.width;
                if (s instanceof Meteor) s.markedForDeletion = true;
            }
        });
        this.stars = this.stars.filter(s => !s.markedForDeletion);
        if (Math.random() < 0.004) this.stars.push(new Meteor(this.width, this.height));

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
        if (this.input.isClicked) {
            const click = this.input.lastClickPos;
            const choice = this.ui.hitTestStarterCards(click.x, click.y);
            if (choice !== null) {
                this.state.starterWeapon = choice;
                if (choice === 'MAGIC_CIRCLE') {
                    // 点左半选火, 右半选电
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
        if (dt === 0) return;

        if (!this.player || this.player.markedForDeletion) {
            this.state.phase = RoguePhase.GAME_OVER;
            this.shakeIntensity = 0;
            this.shakeTimer = 0;
            this.input.isClicked = false;
            return;
        }

        // Boss 宽限时间 (出场 1.2s 内不开火, 避免秒伤玩家)
        if (this.bossGraceTimer > 0) this.bossGraceTimer -= dt;

        // ========== 玩家输入 ==========
        const moveVec = this.input.getMovementVector();
        this.player.acceleration.x = moveVec.x * this.player.thrust;
        this.player.acceleration.y = moveVec.y * this.player.thrust;

        this.handleWeaponFiring(dt);

        if (this.input.isKeyPressed('1') && this.state.modifiers.hasShield) this.triggerSkill(1);
        if (this.input.isKeyPressed('2') && this.state.modifiers.hasBlackhole) this.triggerSkill(2);
        if (this.input.isKeyPressed('3') && this.state.modifiers.hasShockwave) this.triggerSkill(3);

        // 边界
        this.player.position.x = Math.max(20, Math.min(this.width - 20, this.player.position.x));
        this.player.position.y = Math.max(20, Math.min(this.height - 20, this.player.position.y));

        // ========== 小怪刷新 ==========
        this.tickMinionSpawn(dt);

        // ========== 实体更新 ==========
        const enemies = this.entities.filter(e => e instanceof Enemy && !e.markedForDeletion) as Enemy[];
        const playerPos = this.player.position;
        this.entities.forEach(entity => {
            if (entity instanceof Missile) entity.update(dt, enemies);
            else if (entity instanceof Laser) entity.update(dt, enemies);
            else entity.update(dt, playerPos);
        });

        // ========== 敌人开火 (在 Enemy.update 之后, fireTimer 已被扣减) ==========
        if (this.bossGraceTimer <= 0) {
            for (const e of enemies) {
                if (e.markedForDeletion) continue;
                if (e.position.y < 0) continue; // 未进入屏幕时不开火
                if (e.fireTimer <= 0) {
                    this.fireEnemy(e);
                }
            }
        }

        // ========== 魔法阵 tick ==========
        if (this.magicCircle) {
            // 长按开火时激活 (伤害更高 + 视觉强化)
            this.magicCircle.setActive(this.input.isFiring);
            this.magicCircle.update(dt);
            const result = this.magicCircle.tryTick(enemies);
            if (result && result.hit.length > 0) {
                const dmgColor = this.magicCircle.element === CircleElement.FIRE ? '#fb923c' : '#c084fc';
                for (const e of result.hit) {
                    // 飘伤害数字, 让法阵有存在感
                    this.entities.push(new FloatingText(
                        e.position.x + (Math.random() - 0.5) * 20,
                        e.position.y + (Math.random() - 0.5) * 10,
                        Math.ceil(result.damage).toString(),
                        dmgColor
                    ));
                    if (e.health <= 0) this.killEnemy(e);
                }
            }
        }

        // ========== 碰撞 ==========
        this.checkCollisions(dt);

        // ========== 清理越界子弹/小怪 ==========
        for (const e of this.entities) {
            if (e.markedForDeletion) continue;
            if (e instanceof Bullet) {
                if (e.position.y > this.height + 80 || e.position.y < -200 ||
                    e.position.x < -100 || e.position.x > this.width + 100) {
                    e.markedForDeletion = true;
                }
            } else if (e instanceof Enemy && !e.isBoss) {
                if (e.position.y > this.height + 100) e.markedForDeletion = true;
            }
        }

        this.entities = this.entities.filter(e => !e.markedForDeletion);

        // ========== Boss 死亡判定 ==========
        if (!this.bossDefeated && this.boss && this.boss.markedForDeletion) {
            this.bossDefeated = true;
            // 清掉残余小怪/子弹, 避免选 Perk 时 UI 被挡
            for (const e of this.entities) {
                if (e instanceof Enemy && !e.isBoss) e.markedForDeletion = true;
                if (e instanceof Bullet && e.type === EntityType.BULLET_ENEMY) e.markedForDeletion = true;
            }
            this.entities = this.entities.filter(e => !e.markedForDeletion);
            // 重置震屏, 避免 Perk 选择画面抖
            this.shakeIntensity = 0;
            this.shakeTimer = 0;
            // 消除当前帧残留的点击, 避免立刻选中一张 perk
            this.input.isClicked = false;
            this.onLayerClear();
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
        // Perk 选择画面强制不抖屏 (双保险)
        if (this.state.phase !== RoguePhase.FIGHTING) { shakeX = 0; shakeY = 0; }
        this.renderer.setShake(shakeX, shakeY);
        this.renderer.clear();

        // 背景
        this.stars.forEach(s => {
            if (s.type === EntityType.NEBULA) this.renderer.drawNebula(s as Nebula);
            else if (s instanceof Meteor) this.renderer.drawMeteor(s);
            else this.renderer.drawStar(s as Star);
        });

        // 战斗中或 Perk/结束画面都要画场景 (作为背景)
        if (this.state.phase === RoguePhase.FIGHTING ||
            this.state.phase === RoguePhase.PERK_SELECT ||
            this.state.phase === RoguePhase.GAME_OVER ||
            this.state.phase === RoguePhase.VICTORY) {
            if (this.magicCircle) MagicCircle.draw(this.ctx, this.magicCircle);

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
        }

        // HUD (战斗中才画)
        if (this.state.phase === RoguePhase.FIGHTING) {
            this.ui.drawFightingHUD(this.state, this.player, this.boss);
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
        this.boss = null;

        // 清场
        this.entities = [];

        // 创建玩家
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

        // 生成 Boss
        this.spawnLayerBoss();

        // 小怪刷新计时重置 (出场 3s 后第一波小怪)
        this.minionSpawnTimer = 3;
        this.bossGraceTimer = 1.2;
    }

    private spawnLayerBoss() {
        const bossTypes = [EntityType.ENEMY_BOSS, EntityType.ENEMY_BOSS_CARRIER, EntityType.ENEMY_BOSS_REAVER];
        const chosen = bossTypes[Math.floor(Math.random() * bossTypes.length)];
        const boss = new Enemy(this.width / 2, -120, this.state.bossHpScale, true, chosen);
        this.boss = boss;
        this.entities.push(boss);
    }

    /**
     * 小怪定时刷新: 层数越高刷的越密/越多
     * 每波可能是 1 种常规敌人或 3~5 只蜂群
     */
    private tickMinionSpawn(dt: number) {
        if (!this.boss || this.boss.markedForDeletion) return;
        if (this.boss.position.y < 0) return; // boss 还没进场

        this.minionSpawnTimer -= dt;
        if (this.minionSpawnTimer > 0) return;

        // 刷新间隔: layer 1 每 4.5s, layer 10 每 2.0s
        const interval = Math.max(2.0, 5.0 - this.state.layer * 0.3);
        this.minionSpawnTimer = interval + (Math.random() - 0.5) * 0.6;

        // 怪数: layer 1 = 1, layer 10 ~ 3~4
        const baseCount = 1 + Math.floor(this.state.layer / 3);
        const difficulty = 0.8 + this.state.layer * 0.1;

        // 30% 概率刷一波蜂群
        if (Math.random() < 0.3 && this.state.layer >= 2) {
            const baseX = 100 + Math.random() * (this.width - 200);
            const count = 3 + Math.floor(Math.random() * 3);
            for (let i = 0; i < count; i++) {
                const sx = Math.max(30, Math.min(this.width - 30, baseX + (i - (count - 1) / 2) * 45));
                this.entities.push(new Enemy(sx, -60 - i * 25, difficulty, false, EntityType.ENEMY_SWARMER));
            }
            return;
        }

        // 普通小怪
        for (let i = 0; i < baseCount; i++) {
            const x = 50 + Math.random() * (this.width - 100);
            this.entities.push(new Enemy(x, -60 - i * 40, difficulty, false));
        }
    }

    private onLayerClear() {
        if (this.state.layer >= this.state.maxLayers) {
            this.state.phase = RoguePhase.VICTORY;
            return;
        }
        // 选增益
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

        // 重算 modifiers
        this.state.modifiers = computeModifiers(this.state.perks);
        this.state.perkChoices = [];

        // 下一层
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
                const pulseCount = 2 + Math.floor(this.player.chargeLevel / 25);
                for (let i = 0; i < pulseCount; i++) {
                    this.entities.push(new ChargeParticle(this.player));
                }
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
        // MAGIC_CIRCLE: 不需要手动开火, MagicCircle.tryTick 每帧自动 tick
    }

    // ================== 敌人开火 ==================
    private fireEnemy(e: Enemy) {
        // 重置计时
        e.fireTimer = e.fireRate * (0.7 + Math.random() * 0.6);
        if (!this.player) return;

        const t = e.type;

        if (t === EntityType.ENEMY_BOSS) {
            // 12 方向 + 瞄准
            const rot = performance.now() / 1000;
            for (let i = 0; i < 12; i++) {
                const angle = (i / 12) * Math.PI * 2 + rot;
                const b = new Bullet(e.position.x, e.position.y, false);
                b.velocity.x = Math.cos(angle) * 180;
                b.velocity.y = Math.sin(angle) * 180;
                this.entities.push(b);
            }
            const aim = new Bullet(e.position.x, e.position.y, false);
            const dx = this.player.position.x - e.position.x;
            const dy = this.player.position.y - e.position.y;
            const mag = Math.sqrt(dx * dx + dy * dy) || 1;
            aim.velocity.x = (dx / mag) * 420;
            aim.velocity.y = (dy / mag) * 420;
            aim.radius = 10;
            aim.damage = 14;
            this.entities.push(aim);
        } else if (t === EntityType.ENEMY_BOSS_CARRIER) {
            // 相位切换: 扇形 / 召唤
            e.phaseIndex = (e.phaseIndex + 1) % 3;
            if (e.phaseIndex === 2) {
                for (let i = 0; i < 2; i++) {
                    const sx = e.position.x + (i === 0 ? -60 : 60);
                    this.entities.push(new Enemy(sx, e.position.y + 40, this.state.bossHpScale * 0.8, false, EntityType.ENEMY_SWARMER));
                }
                this.entities.push(new FloatingText(e.position.x, e.position.y - 30, "DEPLOY!", '#f472b6'));
            } else {
                for (let i = 0; i < 7; i++) {
                    const spread = (i - 3) * 0.22;
                    const b = new Bullet(e.position.x, e.position.y + 30, false);
                    b.velocity.x = Math.sin(spread) * 300;
                    b.velocity.y = Math.cos(spread) * 300;
                    b.radius = 7;
                    this.entities.push(b);
                }
            }
        } else if (t === EntityType.ENEMY_BOSS_REAVER) {
            // 双旋 + 瞄准三连
            const rot = performance.now() / 700;
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2 + rot;
                const b1 = new Bullet(e.position.x, e.position.y, false);
                b1.velocity.x = Math.cos(a) * 230;
                b1.velocity.y = Math.sin(a) * 230;
                b1.radius = 5;
                this.entities.push(b1);
                const b2 = new Bullet(e.position.x, e.position.y, false);
                b2.velocity.x = Math.cos(-a) * 230;
                b2.velocity.y = Math.sin(-a) * 230;
                b2.radius = 5;
                this.entities.push(b2);
            }
            for (let i = -1; i <= 1; i++) {
                const b = new Bullet(e.position.x, e.position.y, false);
                const dx = this.player.position.x - e.position.x + i * 40;
                const dy = this.player.position.y - e.position.y;
                const mag = Math.sqrt(dx * dx + dy * dy) || 1;
                b.velocity.x = (dx / mag) * 460;
                b.velocity.y = (dy / mag) * 460;
                b.radius = 8;
                b.damage = 12;
                this.entities.push(b);
            }
        } else if (t === EntityType.ENEMY_KAMIKAZE) {
            // 神风不开火
        } else if (t === EntityType.ENEMY_SWARMER) {
            // 双发小散射
            for (let i = -1; i <= 1; i += 2) {
                const b = new Bullet(e.position.x, e.position.y + 10, false);
                const dx = this.player.position.x - e.position.x + i * 30;
                const dy = this.player.position.y - e.position.y;
                const mag = Math.sqrt(dx * dx + dy * dy) || 1;
                b.velocity.x = (dx / mag) * 240;
                b.velocity.y = (dy / mag) * 240;
                b.radius = 4;
                b.damage = 6;
                this.entities.push(b);
            }
        } else if (t === EntityType.ENEMY_SNIPER) {
            // 狙击: 预瞄红激光
            const dx = this.player.position.x - e.position.x;
            const dy = this.player.position.y - e.position.y;
            const angle = Math.atan2(-dx, dy);
            this.entities.push(new EnemyLaser(
                { x: e.position.x, y: e.position.y + 10 },
                angle,
                e,
                { tele: 0.55, fire: 0.35, maxWidth: 9, dps: 45, length: 1400, color: '#22c55e', offset: { x: 0, y: 10 } }
            ));
        } else {
            // ENEMY_BASIC / FAST / TANK / SHIELDER 朝玩家单发
            const dx = this.player.position.x - e.position.x;
            const dy = this.player.position.y - e.position.y;
            const mag = Math.sqrt(dx * dx + dy * dy) || 1;
            const b = new Bullet(e.position.x, e.position.y + 20, false);
            b.velocity.x = (dx / mag) * 280;
            b.velocity.y = (dy / mag) * 280;
            if (t === EntityType.ENEMY_SHIELDER) {
                b.radius = 8;
                b.damage = 12;
            }
            this.entities.push(b);
        }
    }

    // ================== 碰撞检测 (简化版) ==================
    private checkCollisions(dt: number) {
        // 先处理 EnemyLaser 持续伤害
        this.tickEnemyLaserDamage(dt);

        for (let i = 0; i < this.entities.length; i++) {
            const a = this.entities[i];
            if (a.markedForDeletion) continue;
            for (let j = i + 1; j < this.entities.length; j++) {
                const b = this.entities[j];
                if (b.markedForDeletion) continue;

                const isPlayerBullet = a.type === EntityType.BULLET_PLAYER || b.type === EntityType.BULLET_PLAYER;
                const isEnemy = a instanceof Enemy || b instanceof Enemy;

                // 玩家子弹 vs 敌人
                if (isPlayerBullet && isEnemy) {
                    const enemy = (a instanceof Enemy ? a : b) as Enemy;
                    const bullet = (a.type === EntityType.BULLET_PLAYER ? a : b) as Bullet;
                    const dx = a.position.x - b.position.x;
                    const dy = a.position.y - b.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < bullet.radius + enemy.radius) {
                        let dmg = bullet.damage;
                        let crit = false;
                        if (Math.random() < this.state.modifiers.critChance) { dmg *= 2; crit = true; }
                        enemy.applyDamage(dmg);
                        this.entities.push(new FloatingText(
                            enemy.position.x, enemy.position.y,
                            Math.ceil(dmg).toString(),
                            crit ? '#ff5555' : '#facc15'
                        ));
                        bullet.markedForDeletion = true;
                        if (enemy.health <= 0) this.killEnemy(enemy);
                    }
                    continue;
                }

                // Laser vs enemy
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
                            if (Math.random() < 0.3) {
                                this.entities.push(new FloatingText(
                                    target.position.x, target.position.y,
                                    Math.ceil(dmg * 60).toString(),
                                    '#7ef1ff'
                                ));
                            }
                            if (target.health <= 0) this.killEnemy(target);
                        }
                    }
                    continue;
                }

                // 敌弹 vs 玩家
                const isEnemyBullet = a.type === EntityType.BULLET_ENEMY || b.type === EntityType.BULLET_ENEMY;
                const isPlayer = a instanceof Player || b instanceof Player;
                if (isEnemyBullet && isPlayer) {
                    const player = (a instanceof Player ? a : b) as Player;
                    const bullet = (a.type === EntityType.BULLET_ENEMY ? a : b) as Bullet;
                    if (player.skills.shield.active) {
                        bullet.markedForDeletion = true;
                        continue;
                    }
                    const dx = a.position.x - b.position.x;
                    const dy = a.position.y - b.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < player.radius + bullet.radius) {
                        bullet.markedForDeletion = true;
                        const dmg = bullet.damage;
                        player.health -= dmg;
                        this.entities.push(new FloatingText(
                            player.position.x, player.position.y,
                            '-' + Math.ceil(dmg),
                            '#ff4444'
                        ));
                        this.addShake(8, 0.15);
                        if (player.health <= 0) {
                            player.markedForDeletion = true;
                        }
                    }
                    continue;
                }

                // 敌人冲撞玩家
                if (isEnemy && isPlayer) {
                    const player = (a instanceof Player ? a : b) as Player;
                    const enemy = (a instanceof Enemy ? a : b) as Enemy;
                    if (player.skills.shield.active) continue;
                    const dx = a.position.x - b.position.x;
                    const dy = a.position.y - b.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < player.radius + enemy.radius) {
                        // 小怪自杀/玩家掉血
                        if (!enemy.isBoss) {
                            enemy.markedForDeletion = true;
                        }
                        player.health -= 15;
                        this.entities.push(new FloatingText(
                            player.position.x, player.position.y, '-15', '#ff2222'
                        ));
                        this.addShake(14, 0.3);
                        if (player.health <= 0) player.markedForDeletion = true;
                    }
                    continue;
                }

                // Shield 反弹已在上面处理 (玩家侧)
                // Shockwave 群伤
                if (a.type === EntityType.SKILL_SHOCKWAVE || b.type === EntityType.SKILL_SHOCKWAVE) {
                    const wave = (a.type === EntityType.SKILL_SHOCKWAVE ? a : b) as Shockwave;
                    const other = a === wave ? b : a;
                    const dist = Math.sqrt((wave.position.x - other.position.x) ** 2 + (wave.position.y - other.position.y) ** 2);
                    if (Math.abs(dist - wave.radius) < 60) {
                        if (other instanceof Enemy) {
                            const dmg = 3;
                            other.applyDamage(dmg);
                            if (other.health <= 0) this.killEnemy(other);
                        } else if (other.type === EntityType.BULLET_ENEMY) {
                            other.markedForDeletion = true;
                        }
                    }
                }
            }
        }
    }

    /** 敌人激光 tick 伤害 */
    private tickEnemyLaserDamage(dt: number) {
        if (!this.player || this.player.markedForDeletion) return;
        if (this.player.skills.shield.active) return;
        for (const e of this.entities) {
            if (!(e instanceof EnemyLaser)) continue;
            const laser = e as EnemyLaser;
            if (laser.phase !== 'fire') continue;
            const mul = laser.hitTest(this.player.position.x, this.player.position.y, this.player.radius);
            if (mul <= 0) continue;
            const dmg = laser.dps * dt * mul;
            this.player.health -= dmg;
            if (Math.random() < 0.1) {
                this.entities.push(new FloatingText(
                    this.player.position.x, this.player.position.y,
                    '-' + Math.ceil(dmg * 8), '#ff6b6b'
                ));
            }
            this.addShake(3, 0.06);
            if (this.player.health <= 0) {
                this.player.markedForDeletion = true;
            }
            break;
        }
    }

    // ================== 辅助 ==================
    private killEnemy(enemy: Enemy) {
        if (enemy.markedForDeletion) return;
        enemy.markedForDeletion = true;
        // 爆炸
        for (let i = 0; i < (enemy.isBoss ? 40 : 12); i++) {
            this.entities.push(new Particle(
                enemy.position.x, enemy.position.y,
                enemy.isBoss ? '#ffdd55' : '#ffaa00',
                enemy.isBoss ? 600 : 300,
                0.4 + Math.random() * 0.3,
                2 + Math.random() * 3
            ));
        }
        // Boss 死亡震屏更克制, 避免 1.5s 过长
        this.addShake(enemy.isBoss ? 18 : 5, enemy.isBoss ? 0.6 : 0.15);
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
            this.addShake(15, 0.2);
        }
    }

    private initStars() {
        this.stars = [];
        for (let i = 0; i < 3; i++) this.stars.push(new Nebula(this.width, this.height));
        for (let i = 0; i < 150; i++) this.stars.push(new Star(this.width, this.height));
    }
}
