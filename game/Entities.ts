import { EntityType, Vector2, WeaponType, ItemType } from "../types";

export abstract class Entity {
  id: number;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  type: EntityType;
  markedForDeletion: boolean = false;
  rotation: number = 0;
  opacity: number = 1;

  constructor(x: number, y: number, type: EntityType) {
    this.id = Math.random();
    this.position = { x, y };
    this.velocity = { x: 0, y: 0 };
    this.type = type;
    this.radius = 10;
  }

  abstract update(dt: number, context?: Vector2 | Entity[]): void;
}

export class Player extends Entity {
  health: number = 100;
  maxHealth: number = 100;
  mana: number = 100;
  maxMana: number = 100;
  manaRegen: number = 5; 

  level: number = 1;
  xp: number = 0;
  nextLevelXp: number = 1000;
  damageMultiplier: number = 1.0;

  acceleration: Vector2 = { x: 0, y: 0 };
  drag: number = 5.0;
  thrust: number = 2500; 
  maxSpeed: number = 650;
  
  lastShotTime: number = 0;
  fireRate: number = 80;
  currentWeapon: WeaponType = WeaponType.VULCAN;

  isCharging: boolean = false;
  chargeLevel: number = 0; 
  chargeRate: number = 100; 
  
  skills = {
    shield: { current: 0, max: 20, active: false, duration: 5, activeTimer: 0 },
    blackhole: { current: 0, max: 15, active: false },
    shockwave: { current: 0, max: 10, active: false }
  };

  constructor(x: number, y: number) {
    super(x, y, EntityType.PLAYER);
    this.radius = 20; 
  }

  update(dt: number) {
    this.velocity.x += this.acceleration.x * dt;
    this.velocity.y += this.acceleration.y * dt;
    this.velocity.x -= this.velocity.x * this.drag * dt;
    this.velocity.y -= this.velocity.y * this.drag * dt;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    const maxBank = 0.4;
    const targetRotation = (this.velocity.x / this.maxSpeed) * maxBank;
    this.rotation = targetRotation;

    this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt);

    if (this.skills.shield.current > 0) this.skills.shield.current -= dt;
    if (this.skills.blackhole.current > 0) this.skills.blackhole.current -= dt;
    if (this.skills.shockwave.current > 0) this.skills.shockwave.current -= dt;

    if (this.skills.shield.active) {
        this.skills.shield.activeTimer -= dt;
        if (this.skills.shield.activeTimer <= 0) {
            this.skills.shield.active = false;
        }
    }
  }

  gainXp(amount: number) {
      this.xp += amount;
      if (this.xp >= this.nextLevelXp) {
          this.xp -= this.nextLevelXp;
          this.level++;
          this.nextLevelXp = Math.floor(this.nextLevelXp * 1.5);
          this.damageMultiplier += 0.3; 
          this.health = this.maxHealth;
          this.mana = this.maxMana;
      }
  }

  switchWeapon() {
    this.chargeLevel = 0;
    this.isCharging = false;
    // Cycle including new weapons
    if (this.currentWeapon === WeaponType.VULCAN) this.currentWeapon = WeaponType.PLASMA;
    else if (this.currentWeapon === WeaponType.PLASMA) this.currentWeapon = WeaponType.TESLA;
    else if (this.currentWeapon === WeaponType.TESLA) this.currentWeapon = WeaponType.BOMB;
    else if (this.currentWeapon === WeaponType.BOMB) this.currentWeapon = WeaponType.LASER;
    else this.currentWeapon = WeaponType.VULCAN;
  }
}

export class Bullet extends Entity {
  damage: number = 10;
  color: string;
  weaponType: WeaponType | null = null;
  target?: Entity;
  
  constructor(x: number, y: number, isPlayer: boolean, weaponType: WeaponType = WeaponType.VULCAN, angleOffset: number = 0, initialRotation: number = 0, owner?: Player) {
    super(x, y, isPlayer ? EntityType.BULLET_PLAYER : EntityType.BULLET_ENEMY);
    this.radius = 5;
    this.rotation = initialRotation + angleOffset;

    if (isPlayer) {
      this.weaponType = weaponType;
      const dmgMult = owner ? owner.damageMultiplier : 1;

      switch (weaponType) {
        case WeaponType.VULCAN:
        default:
          this.color = '#facc15';
          this.damage = 30 * dmgMult;
          const speedV = 1600;
          this.velocity.x = Math.sin(this.rotation + angleOffset) * speedV;
          this.velocity.y = -Math.cos(this.rotation + angleOffset) * speedV;
          this.radius = 4;
          break;
      }
    } else {
      this.color = '#ff0055';
      this.velocity.y = 400;
      this.velocity.x = Math.sin(angleOffset) * 150;
      this.radius = 7;
    }
  }

  update(dt: number) {
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.rotation = Math.atan2(this.velocity.y, this.velocity.x) + Math.PI/2;
  }
}

export class FloatingText extends Entity {
    text: string;
    life: number = 1.0;
    color: string;
    startY: number;
    
    constructor(x: number, y: number, text: string, color: string) {
        super(x, y, EntityType.FLOATING_TEXT);
        this.text = text;
        this.color = color;
        this.startY = y;
        this.velocity.y = -60;
        this.velocity.x = (Math.random() - 0.5) * 20;
    }
    
    update(dt: number) {
        this.life -= dt;
        this.position.y += this.velocity.y * dt;
        this.position.x += this.velocity.x * dt;
        this.opacity = Math.max(0, this.life);
        if (this.life <= 0) this.markedForDeletion = true;
    }
}

export class ChargeParticle extends Entity {
    target: Player;
    speed: number;
    
    constructor(player: Player) {
        // Calculate spawn position relative to nose
        const angle = Math.random() * Math.PI * 2;
        const dist = 100 + Math.random() * 60;
        
        // Player nose offset is approx (0, -35) rotated by player.rotation
        const noseX = player.position.x + 35 * Math.sin(player.rotation);
        const noseY = player.position.y - 35 * Math.cos(player.rotation);

        super(noseX + Math.cos(angle)*dist, noseY + Math.sin(angle)*dist, EntityType.CHARGE_PARTICLE);
        
        this.target = player;
        this.speed = 100 + Math.random() * 150;
        this.radius = 1.5 + Math.random() * 2; 
    }
    
    update(dt: number) {
        // Target is the nose of the plane
        const tx = this.target.position.x + 35 * Math.sin(this.target.rotation);
        const ty = this.target.position.y - 35 * Math.cos(this.target.rotation);

        const dx = tx - this.position.x;
        const dy = ty - this.position.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // Accelerate significantly as it gets closer
        this.speed += 800 * dt;
        
        if (dist < 10) {
            this.markedForDeletion = true; 
        } else {
            this.position.x += (dx/dist) * this.speed * dt;
            this.position.y += (dy/dist) * this.speed * dt;
        }
    }
}

export class Shield extends Entity {
    owner: Player;
    constructor(player: Player) {
        super(player.position.x, player.position.y, EntityType.SKILL_SHIELD);
        this.owner = player;
        this.radius = 60;
    }
    update(dt: number) {
        if (!this.owner.skills.shield.active) {
            this.markedForDeletion = true;
        }
        this.position = { ...this.owner.position };
    }
}

export class Shockwave extends Entity {
    maxRadius: number = 800;
    constructor(x: number, y: number) {
        super(x, y, EntityType.SKILL_SHOCKWAVE);
        this.radius = 10;
        this.opacity = 1.0;
    }
    update(dt: number) {
        this.radius += 1500 * dt; 
        this.opacity -= 1.2 * dt;
        if (this.opacity <= 0) this.markedForDeletion = true;
    }
}

export class Enemy extends Entity {
  health: number;
  maxHealth: number;
  scoreValue: number;
  patternTimer: number = 0;
  fireTimer: number = 0;
  fireRate: number;
  startX: number;
  isBoss: boolean = false;

  constructor(x: number, y: number, difficultyMult: number, isBoss: boolean = false) {
    let type = EntityType.ENEMY_BASIC;
    if (isBoss) type = EntityType.ENEMY_BOSS;
    else {
        const rand = Math.random();
        if (rand > 0.90) type = EntityType.ENEMY_TANK;
        else if (rand > 0.7) type = EntityType.ENEMY_FAST;
        else if (rand > 0.6) type = EntityType.ENEMY_KAMIKAZE;
    }

    super(x, y, type);
    this.startX = x;
    this.isBoss = isBoss;

    const hpScale = Math.max(1, difficultyMult);

    switch (type) {
      case EntityType.ENEMY_BOSS:
        this.health = 15000 * hpScale;
        this.maxHealth = this.health;
        this.radius = 90;
        this.scoreValue = 20000;
        this.velocity.y = 20; 
        this.fireRate = 800;
        break;
      case EntityType.ENEMY_TANK:
        this.health = 800 * hpScale;
        this.radius = 45;
        this.scoreValue = 800;
        this.velocity.y = 40;
        this.fireRate = 1800;
        break;
      case EntityType.ENEMY_KAMIKAZE:
        this.health = 60 * hpScale;
        this.radius = 15;
        this.scoreValue = 300;
        this.velocity.y = 450; 
        this.fireRate = 99999; 
        break;
      case EntityType.ENEMY_FAST:
        this.health = 150 * hpScale;
        this.radius = 20;
        this.scoreValue = 200;
        this.velocity.y = 250;
        this.fireRate = 1200;
        break;
      case EntityType.ENEMY_BASIC:
      default:
        this.health = 200 * hpScale;
        this.radius = 25;
        this.scoreValue = 100;
        this.velocity.y = 120;
        this.fireRate = 2200;
        break;
    }
    this.maxHealth = Math.max(this.maxHealth || this.health, this.health);
    this.fireTimer = Math.random() * this.fireRate;
  }

  update(dt: number, context?: Vector2 | Entity[]) {
    const playerPos = (context && !Array.isArray(context)) ? context : undefined;
    this.patternTimer += dt;

    if (this.isBoss) {
        if (this.position.y < 150) {
            this.position.y += this.velocity.y * dt;
        } else {
             this.position.x = this.startX + Math.sin(this.patternTimer * 0.6) * 250;
        }
        this.rotation = Math.PI;
    } else if (this.type === EntityType.ENEMY_KAMIKAZE && playerPos) {
        const dx = playerPos.x - this.position.x;
        const dy = playerPos.y - this.position.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        this.velocity.x += (dx / dist) * 800 * dt;
        this.velocity.y += (dy / dist) * 800 * dt;
    } else if (this.type === EntityType.ENEMY_FAST) {
        this.position.x = this.startX + Math.sin(this.patternTimer * 3) * 100;
    }

    if (!this.isBoss || this.position.y < 150) {
         if (this.type !== EntityType.ENEMY_KAMIKAZE) {
             this.position.x += this.velocity.x * dt;
             this.position.y += this.velocity.y * dt;
         } else {
             this.position.x += this.velocity.x * dt;
             this.position.y += this.velocity.y * dt;
         }
    }
    
    if (this.type === EntityType.ENEMY_KAMIKAZE) {
        this.rotation = Math.atan2(this.velocity.y, this.velocity.x) + Math.PI/2;
    } else {
        this.rotation = Math.PI;
    }

    this.fireTimer -= dt * 1000;
  }
}

export class Item extends Entity {
    itemType: ItemType;
    wobble: number = 0;

    constructor(x: number, y: number) {
        super(x, y, EntityType.ITEM);
        const r = Math.random();
        if (r < 0.25) this.itemType = ItemType.HEALTH; 
        else if (r < 0.6) this.itemType = ItemType.MANA;
        else this.itemType = ItemType.WEAPON_UP; 
        
        this.radius = 18;
        this.velocity.y = 80;
    }

    update(dt: number) {
        this.wobble += dt * 5;
        this.position.y += this.velocity.y * dt;
        this.position.x += Math.sin(this.wobble) * 30 * dt;
    }
}

export class Particle extends Entity {
  life: number = 1.0;
  decay: number;
  color: string;
  size: number;
  
  constructor(x: number, y: number, color: string, speed: number, life: number, size: number) {
    super(x, y, EntityType.PARTICLE);
    this.color = color;
    this.life = life;
    this.decay = 1 / life;
    this.size = size;
    
    const angle = Math.random() * Math.PI * 2;
    const spd = Math.random() * speed;
    this.velocity.x = Math.cos(angle) * spd;
    this.velocity.y = Math.sin(angle) * spd;
  }

  update(dt: number) {
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.life -= this.decay * dt;
    if (this.life <= 0) this.markedForDeletion = true;
  }
}

export class Star extends Entity {
  speed: number;
  brightness: number;
  size: number;

  constructor(width: number, height: number) {
    super(Math.random() * width, Math.random() * height, EntityType.STAR);
    const depth = Math.random(); 
    this.speed = 40 + depth * 80; 
    this.radius = 0.5 + depth * 1.2;
    this.brightness = 0.2 + depth * 0.8;
    this.velocity.y = this.speed;
  }

  update(dt: number) {
    this.position.y += this.velocity.y * dt;
  }
}

export class Nebula extends Entity {
    color: string;
    scale: number;
    
    constructor(width: number, height: number) {
        super(Math.random() * width, -400, EntityType.NEBULA);
        const hue = Math.random() * 40 + 200; 
        this.color = `hsla(${hue}, 60%, 20%, 0.1)`; 
        this.velocity.y = 15; 
        this.scale = 300 + Math.random() * 200;
    }

    update(dt: number) {
        this.position.y += this.velocity.y * dt;
    }
}

export class Meteor extends Entity {
  speed: number;
  rotationSpeed: number;

  constructor(width: number, height: number) {
    super(Math.random() * width, -100, EntityType.STAR); 
    this.speed = 300 + Math.random() * 200;
    this.radius = 15 + Math.random() * 25;
    this.velocity.y = this.speed;
    this.velocity.x = (Math.random() - 0.5) * 150;
    this.rotationSpeed = (Math.random() - 0.5) * 3;
  }

  update(dt: number) {
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.rotation += this.rotationSpeed * dt;
  }
}