import { Entity, Player, Enemy, Bullet, Particle, Star, Meteor, Nebula, Item, Shield, Shockwave, FloatingText, ChargeParticle } from "./Entities";
import { Laser } from "./Laser";
import { BlackHole } from "./BlackHole";
import { TeslaLightning } from "./Tesla";
import { Bomb, Explosion } from "./Bomb";
import { Missile } from "./Missile";
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
    if (this.state === GameState.PLAYING || this.state === GameState.PRACTICE) return;
    this.state = GameState.MENU;
    this.lastTime = performance.now();
    requestAnimationFrame(this.menuLoop.bind(this));
  }

  menuLoop(timestamp: number) {
    if (this.state === GameState.PLAYING || this.state === GameState.PRACTICE) return;

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
          if (isFiring) {
              this.player.isCharging = true;
              this.player.chargeLevel = Math.min(100, this.player.chargeLevel + this.player.chargeRate * dt);

              // 充能粒子 (密度随 chargeLevel 提升)
              const pulseCount = 2 + Math.floor(this.player.chargeLevel / 25);
              for (let i = 0; i < pulseCount; i++) {
                  this.entities.push(new ChargeParticle(this.player));
              }

              // 充满即发射，不需要放手
              if (this.player.chargeLevel >= 100 && !existingBeam) {
                  this.entities.push(new Laser(this.player));
                  this.addShake(8, 0.3);
                  this.player.chargeLevel = 0;
                  this.player.isCharging = false;
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
                // 狙击机: 高伤慢速瞄准弹
                if (this.player) {
                    const b = new Bullet(entity.position.x, entity.position.y + 10, false);
                    const dx = this.player.position.x - entity.position.x;
                    const dy = this.player.position.y - entity.position.y;
                    const mag = Math.sqrt(dx*dx+dy*dy) || 1;
                    b.velocity.x = (dx/mag) * 600;
                    b.velocity.y = (dy/mag) * 600;
                    b.damage = 20;
                    b.radius = 9;
                    (b as any).color = '#34d399';
                    this.entities.push(b);
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
        
        // LASER COLLISION
        const isLaserA = (a instanceof Laser);
        const isLaserB = (b instanceof Laser);
        
        if (isLaserA || isLaserB) {
            const laser = isLaserA ? a : b as Laser;
            const target = isLaserA ? b : a;
            
            const relX = Math.abs(target.position.x - laser.position.x);
            const relY = laser.position.y - target.position.y; // Positive if above
            
            if (relX < (laser.width || laser.radius) + target.radius && relY > 0 && relY < laser.length) {
                collision = true;
                if (target instanceof Enemy) {
                    const dmg = laser.damage || 10;
                    target.applyDamage(dmg);
                    this.createExplosion(target.position.x + (Math.random()-0.5)*20, target.position.y, '#0ff', 1);
                    this.spawnFloatingText(Math.ceil(dmg).toString(), '#0ff', {x: target.position.x + (Math.random()-0.5)*20, y: target.position.y});
                    if (target.health <= 0) this.killEnemy(target);
                    continue;
                }
            }
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
      else if (e instanceof TeslaLightning) TeslaLightning.draw(this.ctx, e);
      else if (e instanceof Bomb) Bomb.draw(this.ctx, e);
      else if (e instanceof Explosion) Explosion.draw(this.ctx, e);
      else if (e instanceof Particle) this.renderer.drawParticle(e);
      else if (e instanceof ChargeParticle) this.renderer.drawChargeParticle(e);
    });

    // 激光充能视觉 (在玩家头顶)
    if (this.player && !this.player.markedForDeletion &&
        this.player.currentWeapon === WeaponType.LASER &&
        this.player.chargeLevel > 0) {
        Laser.drawChargingOverlay(this.ctx, this.player);
    }
    
    this.entities.forEach(e => {
        if (e instanceof Shield) this.renderer.drawSkillShield(e);
        if (e instanceof FloatingText) this.renderer.drawFloatingText(e);
    });
  }
}