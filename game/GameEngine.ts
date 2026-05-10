import { Entity, Player, Enemy, Bullet, Particle, Star, Meteor, Nebula, Item, Shield, Shockwave, FloatingText, ChargeParticle } from "./Entities";
import { Laser } from "./Laser";
import { BlackHole } from "./BlackHole";
import { TeslaLightning } from "./Tesla";
import { Bomb, Explosion } from "./Bomb";
import { Missile } from "./Missile";
import { EnemyLaser } from "./EnemyLaser";
import { InputManager } from "./InputManager";
import { Renderer } from "./Renderer";
import { GameState, EntityType, GameConfig, WeaponType, ItemType, PlayerState, Vector2, GameSettings, BotKind } from "../types";

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  input: InputManager;
  renderer: Renderer;
  
  state: GameState = GameState.MENU;
  width: number;
  height: number;
  
  player: Player | null = null;
  entities: Entity[] = [];
  stars: (Star | Meteor | Nebula)[] = [];
  
  score: number = 0;
  difficultyMultiplier: number = 1;
  settings: GameSettings = { difficulty: 'NORMAL', effectQuality: 'HIGH' };
  
  lastTime: number = 0;
  spawnTimer: number = 0;
  
  bossActive: boolean = false;
  bossNextSpawnScore: number = 2000;
  
  shakeTimer: number = 0;
  shakeIntensity: number = 0;
  hitStopTimer: number = 0;

  onScoreChange: (score: number) => void;
  onHealthChange: (health: number) => void;
  onGameOver: (finalScore: number) => void;
  onWeaponChange: (weapon: WeaponType) => void;

  constructor(
    canvas: HTMLCanvasElement, 
    onScoreChange: (s: number) => void, 
    onHealthChange: (h: number) => void,
    onGameOver: (s: number) => void,
    onWeaponChange: (w: WeaponType) => void
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.width = canvas.width;
    this.height = canvas.height;
    
    this.onScoreChange = onScoreChange;
    this.onHealthChange = onHealthChange;
    this.onGameOver = onGameOver;
    this.onWeaponChange = onWeaponChange;

    this.input = new InputManager();
    this.renderer = new Renderer(this.ctx, { width: this.width, height: this.height, settings: this.settings });

    this.initStars();
  }

  updateSettings(settings: GameSettings) {
      this.settings = settings;
      this.renderer.config.settings = settings;
  }

  getPlayerState(): PlayerState | null {
      if (!this.player) return null;
      return {
          health: this.player.health,
          maxHealth: this.player.maxHealth,
          mana: this.player.mana,
          maxMana: this.player.maxMana,
          score: this.score,
          skills: this.player.skills
      };
  }

  initStars() {
    this.stars = [];
    for(let i=0; i<3; i++) {
        this.stars.push(new Nebula(this.width, this.height));
    }
    for (let i = 0; i < 200; i++) {
      this.stars.push(new Star(this.width, this.height));
    }
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.renderer.config.width = width;
    this.renderer.config.height = height;
  }

  startMenuAnimation() {
    if (this.state === GameState.PLAYING || this.state === GameState.PRACTICE || this.state === GameState.ROGUE) return;
    this.state = GameState.MENU;
    this.lastTime = performance.now();
    requestAnimationFrame(this.menuLoop.bind(this));
  }

  /** 让 GameEngine 暂停让位给 RogueEngine (共用 canvas) */
  suspendForRogue() {
    this.state = GameState.ROGUE;
    this.entities = [];
    this.player = null;
  }

  menuLoop(timestamp: number) {
    if (this.state === GameState.PLAYING || this.state === GameState.PRACTICE || this.state === GameState.ROGUE) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    // Update stars/nebula/meteors
    this.stars.forEach(star => {
      star.update(dt);
      if (star.position.y > this.height + 100) {
        star.position.y = -100;
        star.position.x = Math.random() * this.width;
        if (star instanceof Meteor) star.markedForDeletion = true;
      }
    });
    this.stars = this.stars.filter(s => !s.markedForDeletion);

    if (Math.random() < 0.005) {
      this.stars.push(new Meteor(this.width, this.height));
    }

    // Draw background only
    this.renderer.setShake(0, 0);
    this.renderer.clear();
    this.stars.forEach(s => { if (s.type === EntityType.NEBULA) this.renderer.drawNebula(s as Nebula); });
    this.stars.forEach(s => { if (s.type !== EntityType.NEBULA) { if (s instanceof Meteor) this.renderer.drawMeteor(s); else this.renderer.drawStar(s as Star); } });

    requestAnimationFrame(this.menuLoop.bind(this));
  }

  start() {
    this.entities = [];
    this.player = new Player(this.width / 2, this.height - 100);
    this.entities.push(this.player);
    this.score = 0;
    this.difficultyMultiplier = 1;
    this.bossActive = false;
    this.bossNextSpawnScore = 3000;
    this.state = GameState.PLAYING;
    this.onScoreChange(0);
    this.onHealthChange(100);
    this.onWeaponChange(WeaponType.VULCAN);
    
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  // ================== 武器试验场 ==================
  startPractice() {
    this.entities = [];
    this.player = new Player(this.width / 2, this.height - 120);
    this.player.invincible = true;
    this.player.unlimitedMana = true;
    this.player.level = 3;                 // 给点等级, 散弹/Vulcan 多几发
    this.player.damageMultiplier = 1;
    this.entities.push(this.player);
    this.score = 0;
    this.bossActive = false;
    this.state = GameState.PRACTICE;
    this.onScoreChange(0);
    this.onHealthChange(this.player.health);
    this.onWeaponChange(this.player.currentWeapon);
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  stopPractice() {
    // 回到菜单背景动画
    this.state = GameState.MENU;
    this.entities = [];
    this.player = null;
    this.lastTime = performance.now();
    requestAnimationFrame(this.menuLoop.bind(this));
  }

  spawnPracticeBot(kind: BotKind) {
    if (this.state !== GameState.PRACTICE) return;
    const x = 80 + Math.random() * (this.width - 160);
    const y = -60;

    switch (kind) {
      case BotKind.BASIC:
        this.entities.push(new Enemy(x, y, 1, false, EntityType.ENEMY_BASIC, { practice: true }));
        break;
      case BotKind.FAST:
        this.entities.push(new Enemy(x, y, 1, false, EntityType.ENEMY_FAST, { practice: true }));
        break;
      case BotKind.TANK:
        this.entities.push(new Enemy(x, y, 1, false, EntityType.ENEMY_TANK, { practice: true }));
        break;
      case BotKind.KAMIKAZE:
        this.entities.push(new Enemy(x, y, 1, false, EntityType.ENEMY_KAMIKAZE, { practice: true }));
        break;
      case BotKind.SHIELDER:
        this.entities.push(new Enemy(x, y, 1, false, EntityType.ENEMY_SHIELDER, { practice: true }));
        break;
      case BotKind.SNIPER:
        this.entities.push(new Enemy(x, y, 1, false, EntityType.ENEMY_SNIPER, { practice: true }));
        break;
      case BotKind.SWARMER:
        // 5 只一起出
        for (let i = 0; i < 5; i++) {
          const sx = Math.max(40, Math.min(this.width - 40, x + (i - 2) * 45));
          this.entities.push(new Enemy(sx, y - i * 20, 1, false, EntityType.ENEMY_SWARMER, { practice: true }));
        }
        break;
      case BotKind.BOSS: {
        // 只允许同时一个 Boss
        const hasBoss = this.entities.some(e => e instanceof Enemy && (e as Enemy).isBoss);
        if (hasBoss) return;
        this.entities.push(new Enemy(this.width / 2, -100, 1, true, EntityType.ENEMY_BOSS, { practice: true }));
        break;
      }
      case BotKind.BOSS_CARRIER: {
        const hasBoss = this.entities.some(e => e instanceof Enemy && (e as Enemy).isBoss);
        if (hasBoss) return;
        this.entities.push(new Enemy(this.width / 2, -100, 1, true, EntityType.ENEMY_BOSS_CARRIER, { practice: true }));
        break;
      }
      case BotKind.BOSS_REAVER: {
        const hasBoss = this.entities.some(e => e instanceof Enemy && (e as Enemy).isBoss);
        if (hasBoss) return;
        this.entities.push(new Enemy(this.width / 2, -100, 1, true, EntityType.ENEMY_BOSS_REAVER, { practice: true }));
        break;
      }
      case BotKind.STATIC:
        // 固定靶: 放在屏幕中间偏上
        this.entities.push(new Enemy(x, this.height * 0.35, 1, false, EntityType.ENEMY_TANK, { practice: true, isStatic: true }));
        break;
    }
  }

  clearPracticeBots() {
    this.entities.forEach(e => {
      if (e instanceof Enemy) e.markedForDeletion = true;
    });
  }

  selectWeapon(w: WeaponType) {
    if (!this.player || this.player.markedForDeletion) return;
    this.player.selectWeapon(w);
    this.onWeaponChange(this.player.currentWeapon);
  }
  // ================================================
  
  triggerWeaponSwitch() {
    if (this.player && !this.player.markedForDeletion) {
      this.player.switchWeapon();
      this.onWeaponChange(this.player.currentWeapon);
    }
  }
  
  triggerSkill(index: number) {
      if (!this.player || this.player.markedForDeletion) return;
      const p = this.player;
      const freeCost = p.unlimitedMana;

      if (index === 1 && p.skills.shield.current <= 0 && (freeCost || p.mana >= 40)) {
          if (!freeCost) p.mana -= 40;
          p.skills.shield.current = p.skills.shield.max;
          p.skills.shield.active = true;
          p.skills.shield.activeTimer = p.skills.shield.duration;
          this.entities.push(new Shield(p));
          this.addShake(5, 0.2);
          this.spawnFloatingText("SHIELD!", '#3b82f6');
      } 
      else if (index === 2 && p.skills.blackhole.current <= 0 && (freeCost || p.mana >= 60)) {
          if (!freeCost) p.mana -= 60;
          p.skills.blackhole.current = p.skills.blackhole.max;
          this.entities.push(new BlackHole(p.position.x, p.position.y - 300));
          this.addShake(10, 0.5);
          this.spawnFloatingText("SINGULARITY!", '#6366f1');
      }
      else if (index === 3 && p.skills.shockwave.current <= 0 && (freeCost || p.mana >= 50)) {
          if (!freeCost) p.mana -= 50;
          p.skills.shockwave.current = p.skills.shockwave.max;
          this.entities.push(new Shockwave(p.position.x, p.position.y));
          this.addShake(25, 0.4);
          this.spawnFloatingText("SHOCKWAVE!", '#fbbf24');
      }
  }
  
  addShake(intensity: number, duration: number) {
      this.shakeIntensity = intensity;
      this.shakeTimer = duration;
  }
  
  spawnFloatingText(text: string, color: string, pos?: Vector2) {
      const x = pos ? pos.x : (this.player ? this.player.position.x : this.width/2);
      const y = pos ? pos.y : (this.player ? this.player.position.y - 40 : this.height/2);
      this.entities.push(new FloatingText(x, y, text, color));
  }

  loop(timestamp: number) {
    if (this.state !== GameState.PLAYING && this.state !== GameState.PRACTICE) return;

    let dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); 
    this.lastTime = timestamp;

    if (this.hitStopTimer > 0) {
        this.hitStopTimer -= dt;
        dt = 0; 
    }

    this.update(dt);
    this.draw();

    requestAnimationFrame(this.loop.bind(this));
  }

  update(dt: number) {
    if (dt === 0) return; 

    if (this.shakeTimer > 0) {
        this.shakeTimer -= dt;
        if (this.shakeTimer <= 0) this.shakeIntensity = 0;
    }

    const isPractice = this.state === GameState.PRACTICE;

    if (!isPractice) {
      // Difficulty Settings Logic
      let difficultyBase = 1;
      if (this.settings.difficulty === 'EASY') difficultyBase = 0.5;
      if (this.settings.difficulty === 'HARD') difficultyBase = 1.5;

      this.difficultyMultiplier = difficultyBase + (this.score / 5000);

      // Boss Spawning
      if (this.score > this.bossNextSpawnScore && !this.bossActive) {
          this.spawnBoss();
      }

      this.spawnTimer += dt;
      const spawnRate = this.bossActive ? 2.5 : Math.max(0.3, 1.8 - (this.difficultyMultiplier * 0.1));
      if (this.spawnTimer > spawnRate && !this.bossActive) {
        this.spawnTimer = 0;
        this.spawnEnemy();
      } else if (this.bossActive && this.spawnTimer > 3.0) {
          this.spawnTimer = 0;
          this.spawnEnemy();
      }

      if (Math.random() < 0.005) {
          this.stars.push(new Meteor(this.width, this.height));
      }
    } else {
      // 练习场: 只刷点陨石当背景, 别的什么都不自动发生
      if (Math.random() < 0.003) {
          this.stars.push(new Meteor(this.width, this.height));
      }
    }

    if (this.player && !this.player.markedForDeletion) {
      const moveVec = this.input.getMovementVector();
      this.player.acceleration.x = moveVec.x * this.player.thrust;
      this.player.acceleration.y = moveVec.y * this.player.thrust;
      
      if (this.input.isKeyPressed('q')) this.triggerWeaponSwitch();
      if (this.input.isKeyPressed('1')) this.triggerSkill(1);
      if (this.input.isKeyPressed('2')) this.triggerSkill(2);
      if (this.input.isKeyPressed('3')) this.triggerSkill(3);

      const now = performance.now();
      const isFiring = this.input.isFiring;
      
      const existingBeam = this.entities.find(e => e instanceof Laser && e.owner === this.player);

      // Weapon Logic
      if (this.player.currentWeapon === WeaponType.LASER) {
          // 冷却中, 彻底锁定: 不蓄力、不发射
          if (this.player.laserCooldown > 0) {
              this.player.isCharging = false;
              this.player.chargeLevel = 0;
          } else if (isFiring && !existingBeam) {
              this.player.isCharging = true;
              this.player.chargeLevel = Math.min(100, this.player.chargeLevel + this.player.chargeRate * dt);

              // 充能粒子 (密度随 chargeLevel 提升)
              const pulseCount = 2 + Math.floor(this.player.chargeLevel / 25);
              for (let i = 0; i < pulseCount; i++) {
                  this.entities.push(new ChargeParticle(this.player));
              }

              // 蓄满 -> 只发射一发, 随后进入 3s 冷却
              if (this.player.chargeLevel >= 100) {
                  this.entities.push(new Laser(this.player));
                  this.addShake(10, 0.35);
                  this.player.chargeLevel = 0;
                  this.player.isCharging = false;
                  this.player.laserCooldown = this.player.laserCooldownMax;
              }
          } else {
              this.player.isCharging = false;
              this.player.chargeLevel = Math.max(0, this.player.chargeLevel - this.player.chargeRate * dt * 2);
          }
      } 
      else if (this.player.currentWeapon === WeaponType.TESLA) {
          if (isFiring && now - this.player.lastShotTime > 150) {
              this.player.lastShotTime = now;
              const enemies = this.entities.filter(e => e instanceof Enemy && !e.markedForDeletion) as Enemy[];
              enemies.sort((a, b) => {
                  const da = (a.position.x - this.player!.position.x)**2 + (a.position.y - this.player!.position.y)**2;
                  const db = (b.position.x - this.player!.position.x)**2 + (b.position.y - this.player!.position.y)**2;
                  return da - db;
              });
              
              const targets = enemies.slice(0, 3).map(e => e.position);
              if (targets.length > 0) {
                  this.entities.push(new TeslaLightning(this.player.position, targets));
                  enemies.slice(0, 3).forEach(e => {
                      const dmg = 60 * this.player!.damageMultiplier;
                      e.applyDamage(dmg);
                      this.spawnFloatingText(Math.ceil(dmg).toString(), '#00ffff', e.position);
                      if(e.health <= 0) this.killEnemy(e);
                  });
              }
          }
      }
      else if (this.player.currentWeapon === WeaponType.BOMB) {
          if (isFiring && now - this.player.lastShotTime > 800) {
              this.player.lastShotTime = now;
              this.entities.push(new Bomb(this.player.position.x, this.player.position.y, this.player.rotation));
          }
      }
      else if (this.player.currentWeapon === WeaponType.PLASMA) {
           // Now using Missile Logic
           if (isFiring && now - this.player.lastShotTime > 300) {
               this.player.lastShotTime = now;
               // Fire multiple missiles based on level
               const count = 1 + Math.min(2, Math.floor(this.player.level / 2));
               for(let i=0; i<count; i++) {
                   const angleOff = (i - (count-1)/2) * 0.3;
                   this.entities.push(new Missile(this.player.position.x, this.player.position.y, this.player.rotation + angleOff, this.player));
               }
           }
      }
      else if (this.player.currentWeapon === WeaponType.FLAK) {
          // 高射炮: 中节奏, 定时空爆成弹片
          if (isFiring && now - this.player.lastShotTime > 520) {
              this.player.lastShotTime = now;
              const wx = this.player.position.x;
              const wy = this.player.position.y;
              const rot = this.player.rotation;
              // 单发为主, 满级后三发并排
              const count = this.player.level >= 3 ? 3 : 1;
              for (let i = 0; i < count; i++) {
                  const off = (i - (count - 1) / 2) * 0.05;
                  this.entities.push(new Bullet(wx + (i - (count - 1) / 2) * 14, wy, true, WeaponType.FLAK, off, rot, this.player));
              }
              this.addShake(4, 0.1);
              for (let i = 0; i < 6; i++) {
                  this.entities.push(new Particle(wx, wy - 10, '#fef3c7', 280, 0.2, 2));
              }
          }
      }
      else if (this.player.currentWeapon === WeaponType.HELIX) {
          // 螺旋光子流: 双股正弦前进
          if (isFiring && now - this.player.lastShotTime > 110) {
              this.player.lastShotTime = now;
              const wx = this.player.position.x;
              const wy = this.player.position.y;
              const rot = this.player.rotation;
              // 两股: 相位差 PI, 一起发射 -> 像 DNA 双螺旋
              this.entities.push(new Bullet(wx, wy, true, WeaponType.HELIX, 0,        rot, this.player));
              this.entities.push(new Bullet(wx, wy, true, WeaponType.HELIX, Math.PI, rot, this.player));
              // 等级高时多一对, 偏移点相位
              if (this.player.level >= 3) {
                  this.entities.push(new Bullet(wx, wy, true, WeaponType.HELIX,  Math.PI / 2, rot, this.player));
                  this.entities.push(new Bullet(wx, wy, true, WeaponType.HELIX, -Math.PI / 2, rot, this.player));
              }
          }
      }
      else if (this.player.currentWeapon === WeaponType.RAILGUN) {
          // 电磁轨道炮：慢节奏、高伤、穿透
          if (isFiring && now - this.player.lastShotTime > 650) {
              this.player.lastShotTime = now;
              const wx = this.player.position.x;
              const wy = this.player.position.y;
              const rot = this.player.rotation;
              this.entities.push(new Bullet(wx, wy, true, WeaponType.RAILGUN, 0, rot, this.player));
              this.addShake(6, 0.12);
              // 枪口火花
              for (let i = 0; i < 8; i++) {
                  this.entities.push(new Particle(wx, wy - 10, '#c4b5fd', 350, 0.25, 2));
              }
          }
      }
      else if (this.player.currentWeapon === WeaponType.SPREAD) {
          // 散弹：7 发扇形，射速略慢
          if (isFiring && now - this.player.lastShotTime > 280) {
              this.player.lastShotTime = now;
              const wx = this.player.position.x;
              const wy = this.player.position.y;
              const rot = this.player.rotation;
              const pellets = 5 + Math.min(4, this.player.level); // 等级越高越多
              const spread = 0.55; // 总弧度
              for (let i = 0; i < pellets; i++) {
                  const t = pellets === 1 ? 0 : (i / (pellets - 1) - 0.5);
                  const off = t * spread;
                  this.entities.push(new Bullet(wx, wy, true, WeaponType.SPREAD, off, rot, this.player));
              }
              this.addShake(3, 0.08);
          }
      }
      else {
          // Vulcan
          if (isFiring && now - this.player.lastShotTime > this.player.fireRate) {
            this.player.lastShotTime = now;
            const wx = this.player.position.x;
            const wy = this.player.position.y;
            const rot = this.player.rotation; 
            
            this.entities.push(new Bullet(wx, wy, true, WeaponType.VULCAN, -0.05, rot, this.player)); 
            this.entities.push(new Bullet(wx, wy, true, WeaponType.VULCAN, 0.05, rot, this.player));
            if (this.player.level >= 2) {
                 this.entities.push(new Bullet(wx, wy, true, WeaponType.VULCAN, -0.15, rot, this.player)); 
                 this.entities.push(new Bullet(wx, wy, true, WeaponType.VULCAN, 0.15, rot, this.player));
            }
          }
      }

      this.player.position.x = Math.max(20, Math.min(this.width - 20, this.player.position.x));
      this.player.position.y = Math.max(20, Math.min(this.height - 20, this.player.position.y));
    }

    this.stars.forEach(star => {
      star.update(dt);
      if (star.position.y > this.height + 100) {
        star.position.y = -100;
        star.position.x = Math.random() * this.width;
        if (star instanceof Meteor) star.markedForDeletion = true;
      }
    });

    const enemies = this.entities.filter(e => e instanceof Enemy) as Enemy[];
    
    this.entities.forEach(entity => {
      const playerPos = this.player ? this.player.position : undefined;
      
      if (entity instanceof ChargeParticle) {
          if (entity.target.markedForDeletion) entity.markedForDeletion = true;
      }

      // MISSILE TRAIL LOGIC
      if (entity instanceof Missile && !entity.markedForDeletion) {
          if (Math.random() < 0.3) {
              const trail = new Particle(entity.position.x, entity.position.y, '#e879f9', 50, 0.5, 3);
              // Drift opposite to missile
              trail.velocity.x = -entity.velocity.x * 0.2 + (Math.random()-0.5)*20;
              trail.velocity.y = -entity.velocity.y * 0.2 + (Math.random()-0.5)*20;
              this.entities.push(trail);
          }
      }

      const targetPos = (entity instanceof Bullet && entity.target) ? entity.target.position : playerPos;

      // Pass enemies list for Missile tracking
      if (entity instanceof Missile) {
          entity.update(dt, enemies);
      } else if (entity instanceof Laser) {
          // 激光需要敌人列表做拐弯寻敌
          entity.update(dt, enemies);
      } else {
          entity.update(dt, targetPos);
      }
      
      // Bomb detonation check
      if (entity instanceof Bomb && entity.markedForDeletion && entity.timer >= entity.detonationTime) {
          this.createExplosion(entity.position.x, entity.position.y, '#ff4400', 30, 600);
          this.entities.push(new Explosion(entity.position.x, entity.position.y));
          this.addShake(20, 0.4);
          // AOE Damage
          enemies.forEach(e => {
              const dist = Math.sqrt((e.position.x - entity.position.x)**2 + (e.position.y - entity.position.y)**2);
              if (dist < 150) {
                  const dmg = entity.damage * (this.player ? this.player.damageMultiplier : 1);
                  e.applyDamage(dmg);
                  this.spawnFloatingText(Math.ceil(dmg).toString(), '#ff0000', e.position);
                  if (e.health <= 0) this.killEnemy(e);
              }
          });
      }

      // FLAK: 引信到期 -> 空爆 + 散射碎片
      if (entity instanceof Bullet &&
          entity.weaponType === WeaponType.FLAK &&
          entity.fuseMax > 0 &&
          entity.fuseTimer <= 0 &&
          !entity.markedForDeletion) {
          entity.markedForDeletion = true;
          const bx = entity.position.x;
          const by = entity.position.y;
          // 光效
          this.createExplosion(bx, by, '#fde047', 18, 400);
          this.entities.push(new Explosion(bx, by));
          this.addShake(6, 0.15);
          // 放射状碎片
          const shards = entity.flakShards;
          for (let i = 0; i < shards; i++) {
              const ang = (i / shards) * Math.PI * 2 + Math.random() * 0.2;
              const sp = 620 + Math.random() * 180;
              const b = new Bullet(bx, by, true, WeaponType.FLAK, 0, 0, this.player);
              b.velocity.x = Math.cos(ang) * sp;
              b.velocity.y = Math.sin(ang) * sp;
              b.color = '#fde047';
              b.damage = entity.flakShardDamage;
              b.radius = 4;
              b.fuseMax = -1;
              b.fuseTimer = -1;
              // 碎片朝向 (纯视觉)
              b.rotation = ang;
              this.entities.push(b);
          }
      }

      // Black Hole Death
      if (entity instanceof BlackHole && entity.markedForDeletion && entity.life <= 0) {
          // Explode
          this.createExplosion(entity.position.x, entity.position.y, '#818cf8', 50, 800);
          this.entities.push(new Explosion(entity.position.x, entity.position.y));
          this.addShake(30, 0.6);
          // Huge Final Damage
          enemies.forEach(e => {
              const dist = Math.sqrt((e.position.x - entity.position.x)**2 + (e.position.y - entity.position.y)**2);
              if (dist < 300) {
                  const dmg = 500;
                  e.applyDamage(dmg);
                  this.spawnFloatingText(dmg.toString(), '#ffffff', e.position);
                  if (e.health <= 0) this.killEnemy(e);
              }
          });
      }

      // Boss 技能 tick (放在 fire 之前)
      if (entity instanceof Enemy && entity.isBoss && !entity.isPractice) {
          this.tickBossSkill(entity, dt);
      }

      // Enemy Fire
      if (entity instanceof Enemy && !entity.isPractice) {
         if (entity.fireTimer <= 0) {
            entity.fireTimer = entity.fireRate / Math.min(this.difficultyMultiplier, 2.5);

            if (entity.type === EntityType.ENEMY_BOSS) {
                // 经典 Boss: 12 方向 + 单发瞄准
                for(let i=0; i<12; i++) {
                    const angle = (i / 12) * Math.PI * 2 + Date.now()/1000;
                    const b = new Bullet(entity.position.x, entity.position.y, false);
                    b.velocity.x = Math.cos(angle) * 200;
                    b.velocity.y = Math.sin(angle) * 200;
                    this.entities.push(b);
                }
                if (this.player) {
                    const b = new Bullet(entity.position.x, entity.position.y, false);
                    const dx = this.player.position.x - entity.position.x;
                    const dy = this.player.position.y - entity.position.y;
                    const mag = Math.sqrt(dx*dx+dy*dy);
                    b.velocity.x = (dx/mag)*450;
                    b.velocity.y = (dy/mag)*450;
                    b.radius = 12;
                    this.entities.push(b);
                }
            } else if (entity.type === EntityType.ENEMY_BOSS_CARRIER) {
                // 航母 Boss: 相位切换 —— 扇形弹幕 / 放出 2 个蜂群僚机
                entity.phaseIndex = (entity.phaseIndex + 1) % 3;
                if (entity.phaseIndex === 2) {
                    // 放出僚机
                    for (let i = 0; i < 2; i++) {
                        const sx = entity.position.x + (i === 0 ? -60 : 60);
                        this.entities.push(new Enemy(sx, entity.position.y + 40, this.difficultyMultiplier * 0.8, false, EntityType.ENEMY_SWARMER));
                    }
                    this.spawnFloatingText("DEPLOY!", '#f472b6', { x: entity.position.x, y: entity.position.y - 30 });
                } else {
                    // 向下扇形 7 连
                    for (let i = 0; i < 7; i++) {
                        const spread = (i - 3) * 0.22;
                        const b = new Bullet(entity.position.x, entity.position.y + 30, false);
                        b.velocity.x = Math.sin(spread) * 320;
                        b.velocity.y = Math.cos(spread) * 320;
                        b.radius = 7;
                        this.entities.push(b);
                    }
                }
            } else if (entity.type === EntityType.ENEMY_BOSS_REAVER) {
                // 劫掠者: 快节奏双旋弹幕 + 瞄准三连
                const t = Date.now() / 700;
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2 + t;
                    const b1 = new Bullet(entity.position.x, entity.position.y, false);
                    b1.velocity.x = Math.cos(a) * 240;
                    b1.velocity.y = Math.sin(a) * 240;
                    b1.radius = 5;
                    this.entities.push(b1);
                    const b2 = new Bullet(entity.position.x, entity.position.y, false);
                    b2.velocity.x = Math.cos(-a) * 240;
                    b2.velocity.y = Math.sin(-a) * 240;
                    b2.radius = 5;
                    this.entities.push(b2);
                }
                if (this.player) {
                    for (let i = -1; i <= 1; i++) {
                        const b = new Bullet(entity.position.x, entity.position.y, false);
                        const dx = this.player.position.x - entity.position.x + i * 40;
                        const dy = this.player.position.y - entity.position.y;
                        const mag = Math.sqrt(dx*dx+dy*dy);
                        b.velocity.x = (dx/mag) * 500;
                        b.velocity.y = (dy/mag) * 500;
                        b.radius = 8;
                        this.entities.push(b);
                    }
                }
            } else if (entity.type === EntityType.ENEMY_SNIPER) {
                // 狙击机: 预瞄激光 (短促红光束)
                if (this.player) {
                    const dx = this.player.position.x - entity.position.x;
                    const dy = this.player.position.y - entity.position.y;
                    // EnemyLaser 的 forward = (-sin(a), +cos(a)), 所以瞄 (dx, dy) 时:
                    //   -sin(a)=dx/mag, cos(a)=dy/mag  ->  a = atan2(-dx, dy)
                    const angle = Math.atan2(-dx, dy);
                    this.entities.push(new EnemyLaser(
                        { x: entity.position.x, y: entity.position.y + 10 },
                        angle,
                        entity,
                        { tele: 0.55, fire: 0.35, maxWidth: 9, dps: 45, length: 1400, color: '#22c55e', offset: { x: 0, y: 10 } }
                    ));
                }
            } else if (entity.type === EntityType.ENEMY_SWARMER) {
                // 蜂群: 双发小散射
                if (this.player) {
                    for (let i = -1; i <= 1; i += 2) {
                        const b = new Bullet(entity.position.x, entity.position.y + 10, false);
                        const dx = this.player.position.x - entity.position.x + i * 30;
                        const dy = this.player.position.y - entity.position.y;
                        const mag = Math.sqrt(dx*dx+dy*dy) || 1;
                        b.velocity.x = (dx/mag) * 260;
                        b.velocity.y = (dy/mag) * 260;
                        b.radius = 4;
                        b.damage = 6;
                        this.entities.push(b);
                    }
                }
            } else {
                // ENEMY_BASIC / FAST / TANK / SHIELDER —— 朝玩家单发
                let vx = 0; let vy = 300;
                if (this.player) {
                    const dx = this.player.position.x - entity.position.x;
                    const dy = this.player.position.y - entity.position.y;
                    const mag = Math.sqrt(dx*dx + dy*dy);
                    vx = (dx/mag) * 300; vy = (dy/mag) * 300;
                }
                if (entity.type !== EntityType.ENEMY_KAMIKAZE) {
                    const b = new Bullet(entity.position.x, entity.position.y + 20, false);
                    b.velocity.x = vx; b.velocity.y = vy;
                    // 盾卫: 弹更重 + 射速感
                    if (entity.type === EntityType.ENEMY_SHIELDER) {
                        b.radius = 8;
                        b.damage = 12;
                    }
                    this.entities.push(b);
                }
            }
         }
      }

      if (entity.position.y > this.height + 100 || entity.position.y < -1200 || 
          entity.position.x < -100 || entity.position.x > this.width + 100) {
        if (entity.type !== EntityType.PLAYER && entity.type !== EntityType.NEBULA && !entity.type.toString().startsWith('SKILL')) {
          entity.markedForDeletion = true;
        }
      }
    });

    // EnemyLaser 持续伤害扫描
    this.tickEnemyLaserDamage(dt);
    // Boss 追踪光球 (HOMING_ORBS)
    this.tickHomingOrbs(dt);
    // Boss 布雷 (MINEFIELD)
    this.tickMines(dt);

    this.checkCollisions();

    this.entities = this.entities.filter(e => !e.markedForDeletion);
    this.stars = this.stars.filter(s => !s.markedForDeletion);

    // 练习场: 玩家总是满血满蓝, 技能即时冷却
    if (isPractice && this.player && !this.player.markedForDeletion) {
      this.player.health = this.player.maxHealth;
      this.player.mana = this.player.maxMana;
      this.player.skills.shield.current = 0;
      this.player.skills.blackhole.current = 0;
      this.player.skills.shockwave.current = 0;
      this.onHealthChange(this.player.health);
    }

    if (this.player && this.player.markedForDeletion && !isPractice) {
      this.state = GameState.GAME_OVER;
      this.onGameOver(this.score);
      // Restart background animation for the game over screen
      this.lastTime = performance.now();
      requestAnimationFrame(this.menuLoop.bind(this));
    }
  }

  killEnemy(enemy: Enemy) {
      if (enemy.markedForDeletion) return;
      enemy.markedForDeletion = true;

      // 练习场: 不计分, 不掉落道具, 不长经验
      if (enemy.isPractice) {
          this.createExplosion(enemy.position.x, enemy.position.y, '#ffaa00', 15, 300);
          if (enemy.isBoss) this.addShake(30, 2.0);
          return;
      }

      this.score += enemy.scoreValue;
      this.onScoreChange(this.score);
      this.createExplosion(enemy.position.x, enemy.position.y, '#ffaa00', 15, 300);

      if (enemy.isBoss) {
          this.bossActive = false;
          // Set NEXT spawn score way ahead
          this.bossNextSpawnScore = this.score + 5000;
          this.addShake(30, 2.0);
          for(let i=0; i<5; i++) this.dropItem(enemy.position.x + (Math.random()-0.5)*100, enemy.position.y + (Math.random()-0.5)*100);
      } else {
          this.dropItem(enemy.position.x, enemy.position.y);
      }

      if(this.player) this.player.gainXp(enemy.isBoss ? 2000 : 50);
  }

  spawnBoss() {
      this.bossActive = true;
      // 轮换三种 Boss, 每次选一种
      const pool = [EntityType.ENEMY_BOSS, EntityType.ENEMY_BOSS_CARRIER, EntityType.ENEMY_BOSS_REAVER];
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      this.entities.push(new Enemy(this.width/2, -100, this.difficultyMultiplier, true, chosen));
  }

  spawnEnemy() {
    // 小概率刷一波蜂群 (4~6 只)
    if (Math.random() < 0.12) {
      const baseX = 120 + Math.random() * (this.width - 240);
      const count = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const sx = Math.max(30, Math.min(this.width - 30, baseX + (i - (count - 1) / 2) * 45));
        this.entities.push(new Enemy(sx, -60 - i * 25, this.difficultyMultiplier, false, EntityType.ENEMY_SWARMER));
      }
      return;
    }

    const x = 40 + Math.random() * (this.width - 80);
    this.entities.push(new Enemy(x, -50, this.difficultyMultiplier));
  }
  
  dropItem(x: number, y: number) {
      if (Math.random() > 0.6) { 
          this.entities.push(new Item(x, y));
      }
  }

  createExplosion(x: number, y: number, color: string, count: number, speed: number = 200) {
    if (this.settings.effectQuality === 'LOW') count = Math.ceil(count / 3);
    for (let i = 0; i < count; i++) {
      this.entities.push(new Particle(x, y, color, speed, 0.4 + Math.random() * 0.4, 2 + Math.random() * 3));
    }
  }

  checkCollisions() {
    for (let i = 0; i < this.entities.length; i++) {
      const a = this.entities[i];
      if (a.markedForDeletion) continue;

      for (let j = i + 1; j < this.entities.length; j++) {
        const b = this.entities[j];
        if (b.markedForDeletion) continue;

        // Shockwave Logic
        if (a.type === EntityType.SKILL_SHOCKWAVE || b.type === EntityType.SKILL_SHOCKWAVE) {
            const wave = (a.type === EntityType.SKILL_SHOCKWAVE ? a : b) as Shockwave;
            const other = a === wave ? b : a;
            const dist = Math.sqrt((wave.position.x - other.position.x)**2 + (wave.position.y - other.position.y)**2);
            
            if (Math.abs(dist - wave.radius) < 60) {
                if (other instanceof Enemy) {
                    const dmg = 2;
                    other.applyDamage(dmg);
                    this.spawnFloatingText(dmg.toString(), '#fbbf24', other.position);
                    if (other.health <= 0) this.killEnemy(other);
                } else if (other.type === EntityType.BULLET_ENEMY) {
                    other.markedForDeletion = true;
                }
            }
            continue;
        }

        // Black Hole Logic
        if (a.type === EntityType.SKILL_BLACKHOLE || b.type === EntityType.SKILL_BLACKHOLE) {
            const bh = (a.type === EntityType.SKILL_BLACKHOLE ? a : b) as BlackHole;
            const other = a === bh ? b : a;
            const dx = bh.position.x - other.position.x;
            const dy = bh.position.y - other.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
                
            if (other instanceof Enemy && !other.isBoss) {
                 if (dist < bh.pullRadius) {
                     other.position.x += (dx/dist) * 3;
                     other.position.y += (dy/dist) * 3;
                 }
                 if (dist < 40) {
                     const dmg = 5;
                     other.applyDamage(dmg);
                     if (other.health <= 0) this.killEnemy(other);
                 }
            } else if (other.type === EntityType.BULLET_ENEMY) {
                if (dist < bh.radius + 20) {
                    other.markedForDeletion = true;
                    if (this.player) {
                        this.player.health = Math.min(this.player.maxHealth, this.player.health + 1);
                        this.onHealthChange(this.player.health);
                    }
                }
            }
            continue;
        }

        // Item Pickup
        if ((a.type === EntityType.ITEM && b instanceof Player) || (b.type === EntityType.ITEM && a instanceof Player)) {
            const item = (a.type === EntityType.ITEM ? a : b) as Item;
            const player = (a instanceof Player ? a : b) as Player;
            
            if (Math.sqrt((a.position.x - b.position.x)**2 + (a.position.y - b.position.y)**2) < player.radius + item.radius) {
                item.markedForDeletion = true;
                if (item.itemType === ItemType.HEALTH) {
                    player.health = Math.min(player.maxHealth, player.health + 30);
                    this.onHealthChange(player.health);
                    this.spawnFloatingText("+HP", "#22c55e", item.position);
                } else if (item.itemType === ItemType.MANA) {
                    player.mana = Math.min(player.maxMana, player.mana + 50);
                    this.spawnFloatingText("+MANA", "#3b82f6", item.position);
                } else if (item.itemType === ItemType.WEAPON_UP) {
                    player.gainXp(300); 
                    this.spawnFloatingText("LEVEL UP!", "#facc15", item.position);
                }
                this.onScoreChange(this.score);
                this.createExplosion(item.position.x, item.position.y, '#fff', 10);
            }
            continue;
        }

        // Combat Collision
        if ((a.type === EntityType.BULLET_PLAYER && b.type === EntityType.PLAYER) ||
            (a.type === EntityType.BULLET_ENEMY && (b instanceof Enemy)) ||
            (a instanceof Enemy && b instanceof Enemy)) {
          continue;
        }
        
        // Shield
        if ((a instanceof Player && a.skills.shield.active) || (b instanceof Player && b.skills.shield.active)) {
             const player = (a instanceof Player) ? a : b as Player;
             const other = (a === player) ? b : a;
             if (Math.sqrt((a.position.x - b.position.x)**2 + (a.position.y - b.position.y)**2) < 50 + other.radius) {
                 if (other.type === EntityType.BULLET_ENEMY) other.markedForDeletion = true;
                 continue; 
             }
        }

        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        let collision = false;
        
        // LASER COLLISION (曲率折线)
        const isLaserA = (a instanceof Laser);
        const isLaserB = (b instanceof Laser);
        
        if (isLaserA || isLaserB) {
            const laser = (isLaserA ? a : b) as Laser;
            const target = isLaserA ? b : a;

            // 仅对敌人生效, 其它实体不跟激光碰撞
            if (target instanceof Enemy && laser.damage > 0 && laser.path && laser.path.length >= 2) {
                const d2 = Laser.pointDistanceSqToPath(target.position.x, target.position.y, laser.path);
                const r = laser.hitRadius + target.radius;
                if (d2 <= r * r) {
                    const dmg = laser.damage;
                    target.applyDamage(dmg);
                    // 视觉: 光束打击点处小爆光
                    if (Math.random() < 0.4) {
                        this.createExplosion(
                            target.position.x + (Math.random() - 0.5) * 20,
                            target.position.y + (Math.random() - 0.5) * 20,
                            '#7ef1ff', 1
                        );
                    }
                    // 伤害数字节流, 避免每帧飘字噪声
                    if (Math.random() < 0.25) {
                        this.spawnFloatingText(
                            Math.ceil(dmg * 60).toString(), // 近似 DPS 感观
                            '#7ef1ff',
                            { x: target.position.x, y: target.position.y }
                        );
                    }
                    if (target.health <= 0) this.killEnemy(target);
                }
            }
            continue; // 激光自己不触发通用碰撞
        } else if (a instanceof Missile || b instanceof Missile) {
            const missile = (a instanceof Missile) ? a : b as unknown as Missile;
            const target = (a instanceof Missile) ? b : a;
            
            if (dist < missile.radius + target.radius) {
                if (target instanceof Enemy) {
                    missile.markedForDeletion = true;
                    this.createExplosion(missile.position.x, missile.position.y, '#d946ef', 15);
                    this.entities.push(new Explosion(missile.position.x, missile.position.y));
                    const dmg = missile.damage;
                    target.applyDamage(dmg);
                    this.spawnFloatingText(Math.ceil(dmg).toString(), '#d946ef', target.position);
                    if (target.health <= 0) this.killEnemy(target);
                }
                continue;
            }
        } else {
            if (dist < a.radius + b.radius) collision = true;
        }

        if (collision) {
          this.handleCollision(a, b);
        }
      }
    }
  }

  handleCollision(a: Entity, b: Entity) {
    const isPlayer = a instanceof Player || b instanceof Player;
    const isEnemy = a instanceof Enemy || b instanceof Enemy;
    const isPlayerBullet = (a.type === EntityType.BULLET_PLAYER || b.type === EntityType.BULLET_PLAYER);
    const isEnemyBullet = (a.type === EntityType.BULLET_ENEMY || b.type === EntityType.BULLET_ENEMY);

    if (isPlayerBullet && isEnemy) {
        const enemy = (a instanceof Enemy) ? a : b as Enemy;
        const bullet = (a.type === EntityType.BULLET_PLAYER) ? a as Bullet : b as Bullet;

        // 穿透子弹 (RAILGUN): 每个敌人只能被同一发打中一次, 但子弹不消失
        if (bullet.piercing) {
            if (bullet.hitEnemies.has(enemy)) return;
            bullet.hitEnemies.add(enemy);
        } else {
            bullet.markedForDeletion = true;
        }

        enemy.applyDamage(bullet.damage);

        this.createExplosion(enemy.position.x, enemy.position.y, bullet.color, 2);
        this.spawnFloatingText(Math.ceil(bullet.damage).toString(), '#facc15', enemy.position);
        if (enemy.health <= 0) this.killEnemy(enemy);
    }

    if ((isEnemyBullet && isPlayer) || (isEnemy && isPlayer)) {
        const player = (a instanceof Player) ? a : b as Player;
        const other = (a === player) ? b : a;

        if (player.skills.shield.active) return;

        // 练习场: 玩家无敌, 只是清掉打中的弹
        if (player.invincible) {
            if (other instanceof Bullet) other.markedForDeletion = true;
            return;
        }

        if (other instanceof Bullet) other.markedForDeletion = true;
        else if (other instanceof Enemy) {
             other.health -= 100; 
             if(other.health <= 0) this.killEnemy(other);
        }

        const dmg = 10;
        player.health -= dmg;
        this.onHealthChange(player.health);
        this.spawnFloatingText("-" + dmg, '#ff0000', player.position);
        
        this.createExplosion(player.position.x, player.position.y, '#ff0000', 20, 400);
        this.addShake(15, 0.4);
        this.hitStopTimer = 0.05; 

        if (player.health <= 0) {
            player.markedForDeletion = true;
            this.createExplosion(player.position.x, player.position.y, '#00eaff', 60, 500);
        }
    }
  }

  // Draw ...
  draw() {
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeIntensity > 0) {
        shakeX = (Math.random() - 0.5) * this.shakeIntensity;
        shakeY = (Math.random() - 0.5) * this.shakeIntensity;
    }
    this.renderer.setShake(shakeX, shakeY);
    this.renderer.clear();
    
    this.stars.forEach(s => { if (s.type === EntityType.NEBULA) this.renderer.drawNebula(s as Nebula); });
    this.stars.forEach(s => { if (s.type !== EntityType.NEBULA) { if (s instanceof Meteor) this.renderer.drawMeteor(s); else this.renderer.drawStar(s as Star); } });
    
    // Render order
    this.entities.forEach(e => {
        if (e instanceof Shockwave) this.renderer.drawSkillShockwave(e);
        if (e instanceof BlackHole) BlackHole.draw(this.ctx, e);
    });

    this.entities.forEach(e => { if(e instanceof Item) this.renderer.drawItem(e); });
    
    this.entities.forEach(e => {
      if (e instanceof Player) this.renderer.drawPlayer(e);
      else if (e instanceof Enemy) this.renderer.drawEnemy(e);
      else if (e instanceof Bullet) this.renderer.drawBullet(e);
      else if (e instanceof Missile) Missile.draw(this.ctx, e);
      else if (e instanceof Laser) Laser.draw(this.ctx, e);
      else if (e instanceof EnemyLaser) EnemyLaser.draw(this.ctx, e);
      else if (e instanceof TeslaLightning) TeslaLightning.draw(this.ctx, e);
      else if (e instanceof Bomb) Bomb.draw(this.ctx, e);
      else if (e instanceof Explosion) Explosion.draw(this.ctx, e);
      else if (e instanceof Particle) this.renderer.drawParticle(e);
      else if (e instanceof ChargeParticle) this.renderer.drawChargeParticle(e);
    });

    // 激光充能/冷却视觉 (在玩家枪口上)
    if (this.player && !this.player.markedForDeletion &&
        this.player.currentWeapon === WeaponType.LASER &&
        (this.player.chargeLevel > 0 || this.player.laserCooldown > 0)) {
        Laser.drawChargingOverlay(this.ctx, this.player);
    }
    
    this.entities.forEach(e => {
        if (e instanceof Shield) this.renderer.drawSkillShield(e);
        if (e instanceof FloatingText) this.renderer.drawFloatingText(e);
    });
  }

  // ================== Boss 技能系统 ==================
  /**
   * 每帧对 Boss 做一次技能调度.
   * 轻量 FSM: 冷却 -> telegraph -> active -> recover -> 冷却
   * 技能根据 Boss 类型不同:
   *   ENEMY_BOSS         : LASER_SWEEP  (旋转激光) / SPIRAL_SHOWER (螺旋密弹)
   *   ENEMY_BOSS_CARRIER : SUMMON_WAVE (一次召唤 4-5 只僚机) / AIRSTRIKE (纵列 FLAK 式空爆弹)
   *   ENEMY_BOSS_REAVER  : DASH_SLASH  (冲撞+爪击) / TWIN_LASERS (双斜射激光)
   *
   * 所有技能都在 Boss 头顶显示"警戒条"是靠 spawnFloatingText 实现, 比 UI 图开发快很多.
   */
  private tickBossSkill(boss: Enemy, dt: number) {
    // 未进入屏幕时不释放技能
    if (boss.position.y < 120) return;

    // 激怒阶段 (血量 < 35%) 冷却缩短 1.6 倍
    const hpRatio = boss.health / boss.maxHealth;
    const enraged = hpRatio < 0.35;

    if (!boss.skillActive) {
        boss.skillTimer -= dt * (enraged ? 1.6 : 1);
        if (boss.skillTimer <= 0) {
            this.beginBossSkill(boss, enraged);
        }
        return;
    }

    // 活跃技能: 由各技能自己管理 skillPhaseTimer
    boss.skillPhaseTimer += dt;
    this.runBossSkill(boss, dt, enraged);
  }

  private beginBossSkill(boss: Enemy, enraged: boolean) {
    // 在 Boss 支持的技能池里随机挑一个
    let pool: string[] = [];
    if (boss.type === EntityType.ENEMY_BOSS)         pool = ['LASER_SWEEP', 'SPIRAL_SHOWER', 'SHOTGUN_BURST', 'HOMING_ORBS'];
    if (boss.type === EntityType.ENEMY_BOSS_CARRIER) pool = ['SUMMON_WAVE', 'AIRSTRIKE', 'MINEFIELD', 'BEAM_CURTAIN'];
    if (boss.type === EntityType.ENEMY_BOSS_REAVER)  pool = ['DASH_SLASH', 'TWIN_LASERS', 'PHASE_SHIFT', 'CROSS_LASERS'];

    const skill = pool[Math.floor(Math.random() * pool.length)];
    boss.skillActive = skill;
    boss.skillPhaseTimer = 0;

    // 全局警示
    const label: Record<string, string> = {
      LASER_SWEEP: '! 激光扫射 !',
      SPIRAL_SHOWER: '! 螺旋弹幕 !',
      SUMMON_WAVE: '! 召唤僚机 !',
      AIRSTRIKE: '! 空爆打击 !',
      DASH_SLASH: '! 冲撞突袭 !',
      TWIN_LASERS: '! 双向激光 !',
      SHOTGUN_BURST: '! 散弹齐射 !',
      HOMING_ORBS: '! 追踪光球 !',
      MINEFIELD: '! 布雷战场 !',
      BEAM_CURTAIN: '! 激光帘幕 !',
      PHASE_SHIFT: '! 相位闪现 !',
      CROSS_LASERS: '! 十字激光 !'
    };
    this.spawnFloatingText(label[skill] || '! 技能 !', enraged ? '#f97316' : '#fde047', {
      x: boss.position.x, y: boss.position.y - boss.radius - 20
    });
    this.addShake(6, 0.2);

    // 按技能做一次"发动"(发射激光 / 召唤 / 等)
    if (skill === 'LASER_SWEEP') {
      // 一条旋转激光, 从斜左下开始, 慢速扫过 +-60 度
      // aimAngle = 0 表示正下方, 所以 -PI/3 ~ +PI/3 就是左斜到右斜
      const startAngle = -Math.PI / 3;
      const rate = Math.PI / 3; // 3 秒扫 PI
      this.entities.push(new EnemyLaser(
        { x: boss.position.x, y: boss.position.y + 20 },
        startAngle,
        boss,
        { tele: 0.7, fire: 2.0, maxWidth: 22, dps: 55, rotationRate: enraged ? rate * 1.5 : rate, offset: { x: 0, y: 20 } }
      ));
    } else if (skill === 'TWIN_LASERS') {
      // 两条对称斜向激光 (不旋转, 短促但密)
      [-1, 1].forEach(s => {
        this.entities.push(new EnemyLaser(
          { x: boss.position.x, y: boss.position.y + 20 },
          s * Math.PI / 5,
          boss,
          { tele: 0.5, fire: 1.2, maxWidth: 18, dps: 50, offset: { x: 0, y: 20 } }
        ));
      });
    } else if (skill === 'SUMMON_WAVE') {
      // 一口气释放 5 只蜂群 + 可能 1 只狙击机
      for (let i = 0; i < 5; i++) {
        const sx = boss.position.x + (i - 2) * 36;
        this.entities.push(new Enemy(sx, boss.position.y + 40, this.difficultyMultiplier * 0.9, false, EntityType.ENEMY_SWARMER));
      }
      if (enraged) {
        this.entities.push(new Enemy(boss.position.x, boss.position.y + 50, this.difficultyMultiplier, false, EntityType.ENEMY_SNIPER));
      }
    } else if (skill === 'AIRSTRIKE') {
      // 纵列掉下来的炸弹 (用 FLAK-like 敌弹: 直接用 Bullet 标红色并设定 fuseMax)
      for (let i = 0; i < 6; i++) {
        const sx = boss.position.x + (Math.random() - 0.5) * (this.width * 0.7);
        const b = new Bullet(sx, boss.position.y + 30, false);
        b.velocity.x = 0;
        b.velocity.y = 260;
        b.radius = 9;
        b.damage = 16;
        (b as any)._isAirstrike = true;
        // 引信 1.1 ~ 1.6s
        b.fuseMax = 1.0 + Math.random() * 0.6;
        b.fuseTimer = b.fuseMax;
        b.flakShards = 6;
        b.flakShardDamage = 10;
        b.color = '#fb923c';
        this.entities.push(b);
      }
    } else if (skill === 'SHOTGUN_BURST') {
      // ENEMY_BOSS: 短促三连散弹, 每连朝玩家方向 9 弹扇形, 弹速较快
      // 实际开火放在 runBossSkill 的节拍触发里
      // 这里仅记一次轻震屏, 引导玩家绷紧
      this.addShake(4, 0.2);
    } else if (skill === 'HOMING_ORBS') {
      // ENEMY_BOSS: 放出 5 个缓速追踪能量球
      // 每个球是朝玩家缓慢追踪的敌弹 (设置 target=player, 在 checkCollisions 外靠 tick 给它加速度)
      if (this.player) {
        for (let i = 0; i < 5; i++) {
          const ang = (i - 2) * 0.35;
          const sx = boss.position.x + Math.sin(ang) * 40;
          const sy = boss.position.y + 30 + Math.cos(ang) * 10;
          const b = new Bullet(sx, sy, false);
          // 初速度朝向玩家大致方向
          const dx = this.player.position.x - sx;
          const dy = this.player.position.y - sy;
          const mag = Math.sqrt(dx * dx + dy * dy) || 1;
          b.velocity.x = (dx / mag) * 140;
          b.velocity.y = (dy / mag) * 140;
          b.radius = 10;
          b.damage = 14;
          b.color = '#a855f7';
          (b as any)._isHomingOrb = true;
          (b as any)._homingLife = enraged ? 3.6 : 3.0;
          this.entities.push(b);
        }
      }
    } else if (skill === 'MINEFIELD') {
      // ENEMY_BOSS_CARRIER: 在屏幕上半部分空投 8 颗激活慢的浮空雷
      // 先下落 -> 到达随机停留深度后悬停 -> 之后进入"接触即爆"状态, 持续到生命结束自爆
      for (let i = 0; i < 8; i++) {
        const sx = 80 + Math.random() * (this.width - 160);
        const b = new Bullet(sx, boss.position.y + 30, false);
        b.velocity.x = 0;
        b.velocity.y = 200;
        b.radius = 14;
        b.damage = 22;
        b.color = '#ef4444';
        (b as any)._isMine = true;
        // 目标停留深度 (屏幕中段)
        (b as any)._mineHoldY = 180 + Math.random() * (this.height * 0.5);
        (b as any)._mineArmed = false;      // 是否已就位激活
        (b as any)._mineArmTimer = 0.6 + Math.random() * 0.4;  // 激活前的延迟
        (b as any)._mineLife = enraged ? 8 : 11; // 到期自爆
        (b as any)._mineBlastShards = 8;
        (b as any)._mineBlastDamage = 10;
        this.entities.push(b);
      }
    } else if (skill === 'BEAM_CURTAIN') {
      // ENEMY_BOSS_CARRIER: 4~5 条不同延迟开火的垂直激光, 玩家需从缝隙穿过
      // 用 owner=null 让激光钉死在世界坐标, 不随 Boss 漂移
      const beams = enraged ? 5 : 4;
      const gap = this.width / (beams + 1);
      for (let i = 0; i < beams; i++) {
        const bx = gap * (i + 1);
        this.entities.push(new EnemyLaser(
          { x: bx, y: boss.position.y + 20 },
          0,  // 正下方
          null,
          {
            tele: 0.9 + i * 0.15,   // 逐条错开, 形成"节拍"
            fire: 1.1,
            maxWidth: 16,
            dps: 45,
            length: this.height,
            offset: { x: 0, y: 0 }
          }
        ));
      }
    } else if (skill === 'PHASE_SHIFT') {
      // ENEMY_BOSS_REAVER: 瞬移 3 次, 每次到达后放一圈放射弹
      // 第一次瞬移立即执行, 之后 2 次由 runBossSkill 的节拍触发
      this.phaseShiftBlink(boss);
    } else if (skill === 'CROSS_LASERS') {
      // ENEMY_BOSS_REAVER: 4 条十字激光一起扫, 以 Boss 为中心缓慢旋转
      const rate = enraged ? Math.PI * 0.5 : Math.PI * 0.35;
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        this.entities.push(new EnemyLaser(
          { x: boss.position.x, y: boss.position.y },
          ang,
          boss,
          {
            tele: 0.55,
            fire: 2.4,
            maxWidth: 14,
            dps: 42,
            length: 1600,
            rotationRate: rate,
            offset: { x: 0, y: 0 }
          }
        ));
      }
    }
    // DASH_SLASH 在 runBossSkill 里管 (需要逐帧移动)
  }

  /**
   * PHASE_SHIFT 辅助: 让 Boss 瞬移到一个随机安全位置, 并在原地和新位置放一圈放射弹 + 粒子.
   */
  private phaseShiftBlink(boss: Enemy) {
    const oldX = boss.position.x;
    const oldY = boss.position.y;

    // 旧位置残影 + 小爆光
    this.createExplosion(oldX, oldY, '#c084fc', 16, 280);

    // 新位置: 屏幕顶端 1/3 内, 远离原位, 避免贴墙
    const margin = 120;
    let nx = margin + Math.random() * (this.width - margin * 2);
    // 尽量和老位置拉开距离
    if (Math.abs(nx - oldX) < 160) {
      nx = oldX > this.width / 2 ? margin + 40 : this.width - margin - 40;
    }
    const ny = 110 + Math.random() * 120;

    boss.position.x = nx;
    boss.position.y = ny;
    // 清一下速度, 免得 Boss 的默认漂移和瞬移叠加
    boss.velocity.x = 0;
    boss.velocity.y = 0;

    // 到达时的圆环爆光
    this.createExplosion(nx, ny, '#c084fc', 24, 360);
    this.addShake(8, 0.2);

    // 到达时放 10 发放射弹
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      const b = new Bullet(nx, ny, false);
      b.velocity.x = Math.cos(ang) * 260;
      b.velocity.y = Math.sin(ang) * 260;
      b.radius = 5;
      b.damage = 9;
      b.color = '#c084fc';
      this.entities.push(b);
    }
  }

  private runBossSkill(boss: Enemy, dt: number, enraged: boolean) {
    const t = boss.skillPhaseTimer;
    const s = boss.skillActive;

    if (s === 'LASER_SWEEP' || s === 'TWIN_LASERS') {
      // 等激光结束 (2.2s ~ 2.7s)
      if (t > (s === 'LASER_SWEEP' ? 2.8 : 1.8)) {
        boss.skillActive = null;
        boss.skillTimer = enraged ? 4.5 : 7.0;
      }
      return;
    }

    if (s === 'SUMMON_WAVE') {
      if (t > 0.6) {
        boss.skillActive = null;
        boss.skillTimer = enraged ? 6 : 9;
      }
      return;
    }

    if (s === 'AIRSTRIKE') {
      if (t > 1.2) {
        boss.skillActive = null;
        boss.skillTimer = enraged ? 5 : 8;
      }
      return;
    }

    if (s === 'SPIRAL_SHOWER') {
      // 持续 1.6 秒, 每 60ms 发一圈 6 发
      const ticks = Math.floor(t / 0.06);
      const prev  = Math.floor((t - dt) / 0.06);
      if (ticks > prev) {
        const n = 6;
        const rot = t * 4; // 旋转
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2 + rot;
          const b = new Bullet(boss.position.x, boss.position.y, false);
          b.velocity.x = Math.cos(ang) * 280;
          b.velocity.y = Math.sin(ang) * 280;
          b.radius = 5;
          b.damage = 8;
          b.color = '#38bdf8';
          this.entities.push(b);
        }
      }
      if (t > 1.8) {
        boss.skillActive = null;
        boss.skillTimer = enraged ? 4 : 7;
      }
      return;
    }

    if (s === 'SHOTGUN_BURST') {
      // 3 次 "扇形散射", 在 0.25s / 0.75s / 1.25s 各发一次
      // 每发 9 弹扇形, 朝玩家方向
      const beats = [0.25, 0.75, 1.25];
      for (const beat of beats) {
        if (t >= beat && (t - dt) < beat && this.player) {
          const dx = this.player.position.x - boss.position.x;
          const dy = this.player.position.y - boss.position.y;
          const base = Math.atan2(dy, dx);
          const pellets = enraged ? 11 : 9;
          const spread = 0.7;
          for (let i = 0; i < pellets; i++) {
            const off = pellets === 1 ? 0 : (i / (pellets - 1) - 0.5) * spread;
            const ang = base + off;
            const b = new Bullet(boss.position.x, boss.position.y + 20, false);
            const sp = 360 + Math.random() * 80;
            b.velocity.x = Math.cos(ang) * sp;
            b.velocity.y = Math.sin(ang) * sp;
            b.radius = 5;
            b.damage = 9;
            b.color = '#fbbf24';
            this.entities.push(b);
          }
          this.addShake(3, 0.1);
        }
      }
      if (t > 1.8) {
        boss.skillActive = null;
        boss.skillTimer = enraged ? 4 : 6.5;
      }
      return;
    }

    if (s === 'HOMING_ORBS') {
      // 被动技能: 放出的 _isHomingOrb 子弹在 tickHomingOrbs 里自行追踪
      // 这里仅等待 3.5s 结束
      if (t > 3.5) {
        boss.skillActive = null;
        boss.skillTimer = enraged ? 5 : 8;
      }
      return;
    }

    if (s === 'MINEFIELD') {
      // 雷在 tickMines 里自行处理, 这里只等冷却回合
      if (t > 0.8) {
        boss.skillActive = null;
        boss.skillTimer = enraged ? 6 : 9;
      }
      return;
    }

    if (s === 'BEAM_CURTAIN') {
      // 激光帘幕: 等所有激光自然结束, ~2.8s 足够
      if (t > 2.8) {
        boss.skillActive = null;
        boss.skillTimer = enraged ? 5 : 8;
      }
      return;
    }

    if (s === 'PHASE_SHIFT') {
      // 瞬移 3 次, 分别在 t=0 (begin 时已做), 0.5, 1.0
      if (t >= 0.5 && (t - dt) < 0.5) this.phaseShiftBlink(boss);
      if (t >= 1.0 && (t - dt) < 1.0) this.phaseShiftBlink(boss);
      if (t > 1.5) {
        boss.skillActive = null;
        boss.skillTimer = enraged ? 5 : 7.5;
      }
      return;
    }

    if (s === 'CROSS_LASERS') {
      // 4 条十字激光在 beginBossSkill 里已发射, 持续 ~3.2s 等它们自然结束
      if (t > 3.2) {
        boss.skillActive = null;
        boss.skillTimer = enraged ? 5.5 : 8;
      }
      return;
    }

    if (s === 'DASH_SLASH') {
      // 分三阶段: 0-0.5 蓄力(朝玩家)  0.5-1.1 冲刺  1.1-1.6 回位
      if (!this.player) { boss.skillActive = null; boss.skillTimer = 5; return; }
      if (t < 0.5) {
        // 蓄力 - Boss 轻微后退
        boss.position.y -= 60 * dt;
      } else if (t < 1.1) {
        // 冲刺: 朝玩家位置直冲
        const dx = this.player.position.x - boss.position.x;
        const dy = this.player.position.y - boss.position.y;
        const mag = Math.sqrt(dx * dx + dy * dy) || 1;
        const dashSp = enraged ? 780 : 560;
        boss.position.x += (dx / mag) * dashSp * dt;
        boss.position.y += (dy / mag) * dashSp * dt;
        // 留下高速痕迹
        if (Math.random() < 0.6) {
          this.entities.push(new Particle(boss.position.x, boss.position.y, '#ef4444', 40, 0.35, 6));
        }
      } else if (t < 1.6) {
        // 回位 (缓慢上升)
        boss.position.y -= 120 * dt;
      } else {
        boss.skillActive = null;
        boss.skillTimer = enraged ? 4 : 6;
      }
    }
  }

  // ================== EnemyLaser 每帧伤害扫描 ==================
  private tickEnemyLaserDamage(dt: number) {
    if (!this.player || this.player.markedForDeletion) return;
    // 练习场玩家无敌, 短路
    if (this.player.invincible) return;
    // 护盾开启时直接吸收
    if (this.player.skills.shield.active) return;

    for (const e of this.entities) {
      if (!(e instanceof EnemyLaser)) continue;
      const laser = e as EnemyLaser;
      if (laser.phase !== 'fire') continue;

      const mul = laser.hitTest(this.player.position.x, this.player.position.y, this.player.radius);
      if (mul <= 0) continue;

      const dmg = laser.dps * dt * mul;
      this.player.health -= dmg;
      this.onHealthChange(this.player.health);

      // 抖屏 + 偶尔飘字 (不要每帧都飘)
      if (Math.random() < 0.12) {
        this.spawnFloatingText('-' + Math.ceil(dmg * 8), '#ff6b6b', this.player.position);
      }
      this.addShake(3, 0.06);

      if (this.player.health <= 0) {
        this.player.markedForDeletion = true;
        this.createExplosion(this.player.position.x, this.player.position.y, '#00eaff', 60, 500);
      }
      // 激光同一帧不重复伤害同一个玩家
      break;
    }
  }

  // ================== Boss 追踪光球 (HOMING_ORBS) 每帧 tick ==================
  /**
   * 带有 _isHomingOrb 标记的敌弹会在这里做缓慢转向 + 寿命衰减.
   * 到期后自爆, 爆炸向四周散射 4 发普通弹 (避免玩家"绕一圈就没事").
   */
  private tickHomingOrbs(dt: number) {
    if (!this.player) return;
    for (const e of this.entities) {
      if (!(e instanceof Bullet)) continue;
      if (e.markedForDeletion) continue;
      if (!(e as any)._isHomingOrb) continue;

      // 减寿
      (e as any)._homingLife -= dt;
      if ((e as any)._homingLife <= 0) {
        // 自爆
        e.markedForDeletion = true;
        this.createExplosion(e.position.x, e.position.y, '#a855f7', 14, 320);
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + Math.random() * 0.3;
          const b = new Bullet(e.position.x, e.position.y, false);
          b.velocity.x = Math.cos(ang) * 280;
          b.velocity.y = Math.sin(ang) * 280;
          b.radius = 4;
          b.damage = 7;
          b.color = '#c084fc';
          this.entities.push(b);
        }
        continue;
      }

      // 缓慢转向玩家 (低转向率, 给玩家回避空间)
      if (this.player && !this.player.markedForDeletion) {
        const dx = this.player.position.x - e.position.x;
        const dy = this.player.position.y - e.position.y;
        const desired = Math.atan2(dy, dx);
        const current = Math.atan2(e.velocity.y, e.velocity.x);
        let diff = ((desired - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const turnRate = 1.6; // 弧度/秒
        const clamp = Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
        const newAng = current + clamp;
        // 保持速度大小恒定
        const speed = Math.sqrt(e.velocity.x * e.velocity.x + e.velocity.y * e.velocity.y) || 140;
        const targetSp = 170;
        const finalSp = speed + (targetSp - speed) * Math.min(1, dt * 2);
        e.velocity.x = Math.cos(newAng) * finalSp;
        e.velocity.y = Math.sin(newAng) * finalSp;
      }

      // 尾迹粒子
      if (Math.random() < 0.35) {
        const trail = new Particle(e.position.x, e.position.y, '#a855f7', 40, 0.4, 4);
        trail.velocity.x *= 0.2;
        trail.velocity.y *= 0.2;
        this.entities.push(trail);
      }
    }
  }

  // ================== Boss 布雷 (MINEFIELD) 每帧 tick ==================
  /**
   * 带 _isMine 标记的敌弹:
   *  1) 先下落到 _mineHoldY 停住
   *  2) _mineArmTimer 倒计时后"激活"(外圈闪烁), 到期自爆放射 8 发
   *  3) 在激活状态下玩家靠近也立即引爆 (接触感知范围 60px)
   */
  private tickMines(dt: number) {
    for (const e of this.entities) {
      if (!(e instanceof Bullet)) continue;
      if (e.markedForDeletion) continue;
      if (!(e as any)._isMine) continue;

      const holdY = (e as any)._mineHoldY as number;

      // 下落减速
      if (e.position.y < holdY) {
        // 正常由 Bullet.update 推进, 这里什么都不做
      } else {
        // 停下来悬浮
        e.velocity.y *= 0.86;
        if (Math.abs(e.velocity.y) < 2) e.velocity.y = 0;
        // 微微左右漂
        e.velocity.x = Math.sin(performance.now() / 500 + e.position.x) * 10;

        // 激活倒计时
        if (!(e as any)._mineArmed) {
          (e as any)._mineArmTimer -= dt;
          if ((e as any)._mineArmTimer <= 0) {
            (e as any)._mineArmed = true;
            // 激活视觉小闪
            this.createExplosion(e.position.x, e.position.y, '#ef4444', 3, 120);
          }
        }
      }

      // 寿命衰减 (到期自爆)
      (e as any)._mineLife -= dt;
      let explode = (e as any)._mineLife <= 0;

      // 激活后, 玩家靠近 60px 也引爆
      if (!explode && (e as any)._mineArmed && this.player && !this.player.markedForDeletion) {
        const dx = this.player.position.x - e.position.x;
        const dy = this.player.position.y - e.position.y;
        if (dx * dx + dy * dy < 60 * 60) explode = true;
      }

      if (explode) {
        e.markedForDeletion = true;
        this.createExplosion(e.position.x, e.position.y, '#ef4444', 20, 420);
        this.addShake(6, 0.2);

        const shards = (e as any)._mineBlastShards as number;
        const shardDmg = (e as any)._mineBlastDamage as number;
        for (let i = 0; i < shards; i++) {
          const ang = (i / shards) * Math.PI * 2;
          const b = new Bullet(e.position.x, e.position.y, false);
          b.velocity.x = Math.cos(ang) * 340;
          b.velocity.y = Math.sin(ang) * 340;
          b.radius = 5;
          b.damage = shardDmg;
          b.color = '#fca5a5';
          this.entities.push(b);
        }
      }
    }
  }
}