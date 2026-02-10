import { Entity, Player, Enemy, Bullet, Particle, Star, Meteor, Nebula, Item, Shield, Shockwave, FloatingText, ChargeParticle } from "./Entities";
import { Laser } from "./Laser";
import { BlackHole } from "./BlackHole";
import { TeslaLightning } from "./Tesla";
import { Bomb, Explosion } from "./Bomb";
import { Missile } from "./Missile";
import { InputManager } from "./InputManager";
import { Renderer } from "./Renderer";
import { GameState, EntityType, GameConfig, WeaponType, ItemType, PlayerState, Vector2, GameSettings } from "../types";

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
  
  triggerWeaponSwitch() {
    if (this.player && !this.player.markedForDeletion) {
      this.player.switchWeapon();
      this.onWeaponChange(this.player.currentWeapon);
    }
  }
  
  triggerSkill(index: number) {
      if (!this.player || this.player.markedForDeletion) return;
      const p = this.player;
      
      if (index === 1 && p.skills.shield.current <= 0 && p.mana >= 40) {
          p.mana -= 40;
          p.skills.shield.current = p.skills.shield.max;
          p.skills.shield.active = true;
          p.skills.shield.activeTimer = p.skills.shield.duration;
          this.entities.push(new Shield(p));
          this.addShake(5, 0.2);
          this.spawnFloatingText("SHIELD!", '#3b82f6');
      } 
      else if (index === 2 && p.skills.blackhole.current <= 0 && p.mana >= 60) {
          p.mana -= 60;
          p.skills.blackhole.current = p.skills.blackhole.max;
          this.entities.push(new BlackHole(p.position.x, p.position.y - 300));
          this.addShake(10, 0.5);
          this.spawnFloatingText("SINGULARITY!", '#6366f1');
      }
      else if (index === 3 && p.skills.shockwave.current <= 0 && p.mana >= 50) {
          p.mana -= 50;
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
    if (this.state !== GameState.PLAYING) return;

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

    if (this.player && !this.player.markedForDeletion) {
      const moveVec = this.input.getMovementVector();
      this.player.acceleration.x = moveVec.x * this.player.thrust;
      this.player.acceleration.y = moveVec.y * this.player.thrust;
      
      if (this.input.isKeyPressed('q')) this.triggerWeaponSwitch();
      if (this.input.isKeyPressed('1')) this.triggerSkill(1);
      if (this.input.isKeyPressed('2')) this.triggerSkill(2);
      if (this.input.isKeyPressed('3')) this.triggerSkill(3);

      const now = performance.now();
      const isFiring = (this.input.isMouseDown || this.input.keys[' ']);
      
      const existingBeam = this.entities.find(e => e instanceof Laser && e.owner === this.player);

      // Weapon Logic
      if (this.player.currentWeapon === WeaponType.LASER) {
          if (isFiring) {
              this.player.isCharging = true;
              this.player.chargeLevel = Math.min(100, this.player.chargeLevel + this.player.chargeRate * dt);
              // Spawn multiple particles per frame for density
              for(let i=0; i<3; i++) {
                 this.entities.push(new ChargeParticle(this.player));
              }
          } else {
              if (this.player.isCharging && this.player.chargeLevel >= 100 && !existingBeam) {
                  // Spawn new Laser module
                  this.entities.push(new Laser(this.player));
                  this.addShake(5, 2.0); 
                  this.player.chargeLevel = 0;
              }
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
                      e.health -= dmg;
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
                  e.health -= dmg;
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
                  e.health -= dmg;
                  this.spawnFloatingText(dmg.toString(), '#ffffff', e.position);
                  if (e.health <= 0) this.killEnemy(e);
              }
          });
      }

      // Enemy Fire
      if (entity instanceof Enemy) {
         if (entity.fireTimer <= 0) {
            entity.fireTimer = entity.fireRate / Math.min(this.difficultyMultiplier, 2.5);
            
            if (entity.type === EntityType.ENEMY_BOSS) {
                // BOSS PATTERN
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
            } else {
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

    if (this.player && this.player.markedForDeletion) {
      this.state = GameState.GAME_OVER;
      this.onGameOver(this.score);
    }
  }

  killEnemy(enemy: Enemy) {
      if (enemy.markedForDeletion) return;
      enemy.markedForDeletion = true;
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
      this.entities.push(new Enemy(this.width/2, -100, this.difficultyMultiplier, true));
  }

  spawnEnemy() {
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
                    other.health -= dmg; 
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
                     other.health -= dmg;
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
                    const dmg = (laser as any).damage || 10;
                    target.health -= dmg;
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
                    target.health -= dmg;
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
        
        bullet.markedForDeletion = true;
        enemy.health -= bullet.damage;
        
        this.createExplosion(enemy.position.x, enemy.position.y, bullet.color, 2);
        this.spawnFloatingText(Math.ceil(bullet.damage).toString(), '#facc15', enemy.position);
        if (enemy.health <= 0) this.killEnemy(enemy);
    }

    if ((isEnemyBullet && isPlayer) || (isEnemy && isPlayer)) {
        const player = (a instanceof Player) ? a : b as Player;
        const other = (a === player) ? b : a;
        
        if (player.skills.shield.active) return; 

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
    
    this.entities.forEach(e => {
        if (e instanceof Shield) this.renderer.drawSkillShield(e);
        if (e instanceof FloatingText) this.renderer.drawFloatingText(e);
    });
  }
}