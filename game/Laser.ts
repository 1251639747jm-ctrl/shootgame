import { Entity } from "./Entities";
import { EntityType, Vector2, WeaponType } from "../types";
import { Player } from "./Entities";

/**
 * ==================================================================================
 * SECTION 1: CONFIGURATION & CONSTANTS
 * 
 * 这里的配置项用于微调激光的每一个视觉细节。
 * 为了达到极致的效果，我们将参数拆分得非常细致。
 * ==================================================================================
 */

const LASER_CONFIG = {
    core: {
        baseWidth: 45,
        maxLength: 1500,
        growthSpeed: 4500,
        color: { h: 180, s: 100, l: 50 }, // Cyan base
        pulseRate: 15, // Hz
        jitterAmount: 2.5, // Pixel jitter
    },
    phases: {
        chargeDuration: 0.3,
        sustainDuration: 2.0,
        decayDuration: 0.4,
    },
    arcs: {
        enabled: true,
        count: 4,
        segmentLength: 30,
        wanderSpeed: 8.0,
        color: 'rgba(200, 240, 255, 0.7)',
        width: 1.5,
        bloomStrength: 15,
    },
    particles: {
        density: 2, // Particles per frame
        muzzleFlashSize: 80,
        impactFlashSize: 60,
        heatHazeEnabled: true,
    },
    physics: {
        segments: 40, // Number of segments for the beam "rope"
        stiffness: 0.8,
        damping: 0.6,
    }
};

/**
 * ==================================================================================
 * SECTION 2: MATH & UTILITY LIBRARY
 * 
 * 为了不依赖外部库并增加逻辑复杂度，我们在内部实现完整的数学工具。
 * 包含：向量运算、随机数生成、柏林噪声、插值函数。
 * ==================================================================================
 */

class MathUtils {
    static PI = Math.PI;
    static TWO_PI = Math.PI * 2;

    static clamp(val: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, val));
    }

    static lerp(start: number, end: number, t: number): number {
        return start * (1 - t) + end * t;
    }

    static degToRad(deg: number): number {
        return deg * (this.PI / 180);
    }

    static randRange(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    static randInt(min: number, max: number): number {
        return Math.floor(this.randRange(min, max));
    }

    static map(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    // Ease Out Expo function for punchy animations
    static easeOutExpo(x: number): number {
        return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
    }
    
    // Ease In Out Sine for smooth transitions
    static easeInOutSine(x: number): number {
        return -(Math.cos(Math.PI * x) - 1) / 2;
    }

    static distSq(x1: number, y1: number, x2: number, y2: number): number {
        const dx = x1 - x2;
        const dy = y1 - y2;
        return dx * dx + dy * dy;
    }
}

/**
 * Custom Color Helper to handle dynamic HSLA transitions without string parsing overhead in loops
 */
class ColorRGBA {
    r: number; g: number; b: number; a: number;

    constructor(r: number, g: number, b: number, a: number = 1.0) {
        this.r = r; this.g = g; this.b = b; this.a = a;
    }

    static fromHSL(h: number, s: number, l: number, a: number = 1.0): ColorRGBA {
        s /= 100;
        l /= 100;
        const k = (n: number) => (n + h / 30) % 12;
        const a_val = s * Math.min(l, 1 - l);
        const f = (n: number) => l - a_val * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return new ColorRGBA(Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4)), a);
    }

    toString(): string {
        return `rgba(${this.r},${this.g},${this.b},${this.a})`;
    }
    
    // Lighten the color for additive blending
    lighten(amount: number): ColorRGBA {
        return new ColorRGBA(
            Math.min(255, this.r + amount),
            Math.min(255, this.g + amount),
            Math.min(255, this.b + amount),
            this.a
        );
    }
}

/**
 * IMPLEMENTATION: PERLIN NOISE
 * 
 * 一个完整的柏林噪声实现，用于生成自然的闪电路径和能量波动。
 * 这里的逻辑没有精简，保留了完整的置换表计算。
 */
class PerlinNoise {
    private p: number[] = [];
    private permutation: number[] = [
        151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
        190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,
        125,136,171,168, 68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,
        105,92,41,55,46,245,40,244,102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,
        196,135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,72,55,243,69,185,112,224,225,103,
        70,24,242,38,153,150,155,248,127,192,207,114,31,141,123,5,107,176,195,12,184,81,180,246,251,19,228,
        223,84,181,193,59,121,113,9,218,110,47,199,93,17,206,104,119,152,145,236,170,51,202,66,128,156,61,
        215,98,221,178,144,213,204,67,106,78,191,157,14,212,183,124,19,205,172,118,50,4,163,115,101,235,82,
        43,97,22,222,42,210,49,201,250,58,45,214,232,126,85,227,249,241,182,154,162,253,167,39,138,238,255,29
    ];

    constructor() {
        this.calculatePermutations();
    }

    private calculatePermutations() {
        this.p = new Array(512);
        for (let i = 0; i < 256; i++) {
            this.p[256 + i] = this.p[i] = this.permutation[i];
        }
    }

    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private lerp(t: number, a: number, b: number): number {
        return a + t * (b - a);
    }

    private grad(hash: number, x: number, y: number, z: number): number {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    public noise(x: number, y: number, z: number): number {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);

        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        const A = this.p[X] + Y;
        const AA = this.p[A] + Z;
        const AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y;
        const BA = this.p[B] + Z;
        const BB = this.p[B + 1] + Z;

        return this.lerp(w,
            this.lerp(v,
                this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)),
                this.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z))
            ),
            this.lerp(v,
                this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))
            )
        );
    }
}

// Global Noise Instance
const noiseGen = new PerlinNoise();

/**
 * ==================================================================================
 * SECTION 3: PARTICLE SYSTEM
 * 
 * 激光不仅仅是光束，它周围应该有飞舞的火花、冷凝的烟雾和能量残渣。
 * 我们实现一个全功能的粒子系统。
 * ==================================================================================
 */

enum ParticleType {
    SPARK,
    SMOKE,
    ENERGY_RING,
    DISTORTION_WAVE,
    GLOW_ORB
}

class Particle {
    pos: Vector2;
    vel: Vector2;
    acc: Vector2;
    life: number;
    maxLife: number;
    size: number;
    type: ParticleType;
    color: ColorRGBA;
    rotation: number = 0;
    rotSpeed: number = 0;
    
    constructor(x: number, y: number, type: ParticleType, color: ColorRGBA) {
        this.pos = { x, y };
        this.type = type;
        this.color = color;
        this.acc = { x: 0, y: 0 };
        this.vel = { x: 0, y: 0 };
        this.rotation = Math.random() * Math.PI * 2;
        
        // Initialize based on type
        switch (type) {
            case ParticleType.SPARK:
                this.maxLife = MathUtils.randRange(0.2, 0.6);
                this.size = MathUtils.randRange(2, 5);
                const angle = MathUtils.randRange(0, Math.PI * 2);
                const speed = MathUtils.randRange(100, 300);
                this.vel.x = Math.cos(angle) * speed;
                this.vel.y = Math.sin(angle) * speed;
                this.acc.y = 200; // Gravity-ish
                break;

            case ParticleType.SMOKE:
                this.maxLife = MathUtils.randRange(0.5, 1.2);
                this.size = MathUtils.randRange(10, 30);
                this.vel.x = MathUtils.randRange(-20, 20);
                this.vel.y = MathUtils.randRange(-50, -10);
                this.rotSpeed = MathUtils.randRange(-2, 2);
                break;
                
            case ParticleType.ENERGY_RING:
                this.maxLife = 0.4;
                this.size = 1;
                this.vel = {x: 0, y: 0}; // Expands in place
                break;
            
            case ParticleType.GLOW_ORB:
                this.maxLife = MathUtils.randRange(0.1, 0.3);
                this.size = MathUtils.randRange(20, 60);
                this.vel = { x: (Math.random()-0.5)*50, y: (Math.random()-0.5)*50 };
                break;

            default:
                this.maxLife = 1;
                this.size = 1;
        }
        
        this.life = this.maxLife;
    }

    update(dt: number) {
        this.vel.x += this.acc.x * dt;
        this.vel.y += this.acc.y * dt;
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
        this.life -= dt;
        this.rotation += this.rotSpeed * dt;

        // Type specific updates
        if (this.type === ParticleType.ENERGY_RING) {
            this.size += 150 * dt; // Expansion
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (this.life <= 0) return;
        
        const alpha = MathUtils.clamp(this.life / this.maxLife, 0, 1);
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.rotation);
        
        switch(this.type) {
            case ParticleType.SPARK:
                ctx.globalCompositeOperation = 'lighter';
                ctx.fillStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${alpha})`;
                ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
                break;

            case ParticleType.SMOKE:
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = `rgba(100, 100, 100, ${alpha * 0.3})`;
                ctx.beginPath();
                ctx.arc(0, 0, this.size, 0, Math.PI * 2);
                ctx.fill();
                break;

            case ParticleType.ENERGY_RING:
                ctx.globalCompositeOperation = 'lighter';
                ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${alpha})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(0, 0, this.size * 0.5, this.size, 0, 0, Math.PI*2);
                ctx.stroke();
                break;
            
            case ParticleType.GLOW_ORB:
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
                grad.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${alpha})`);
                grad.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, this.size, 0, Math.PI*2);
                ctx.fill();
                break;
        }
        ctx.restore();
    }
}

class ParticleEmitter {
    particles: Particle[] = [];
    
    emit(x: number, y: number, type: ParticleType, count: number, color: ColorRGBA) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, type, color));
        }
    }
    
    update(dt: number) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    draw(ctx: CanvasRenderingContext2D) {
        this.particles.forEach(p => p.draw(ctx));
    }
}

/**
 * ==================================================================================
 * SECTION 4: BEAM SEGMENT SYSTEM
 * 
 * 激光主体。我们不画一条直线，而是定义一系列的“骨骼”点。
 * 每一帧，这些点都会根据Perlin噪声进行偏移，模拟光束的不稳定性。
 * ==================================================================================
 */

class BeamSegment {
    pos: Vector2;
    originalPos: Vector2;
    widthScale: number = 1.0;
    
    constructor(x: number, y: number) {
        this.pos = { x, y };
        this.originalPos = { x, y };
    }
}

/**
 * ==================================================================================
 * SECTION 5: MAIN LASER CLASS
 * 
 * 核心逻辑。将所有子系统组合在一起。
 * ==================================================================================
 */

enum LaserPhase {
    CHARGING,   // 预热，光束细小，能量聚集
    FIRING,     // 爆发，瞬间达到最大宽度
    SUSTAINING, // 持续输出，轻微抖动
    DECAYING    // 能量耗尽，光束断裂、变细
}

export class Laser extends Entity {
    // Relationships
    owner: Player;
    
    // State Management
    phase: LaserPhase = LaserPhase.CHARGING;
    timeInPhase: number = 0;
    elapsed: number = 0;
    
    // Physics & Geometry
    length: number = 0;
    currentWidth: number = 0;
    targetWidth: number = 0;
    rotation: number = 0;
    startPoint: Vector2 = { x: 0, y: 0 };
    endPoint: Vector2 = { x: 0, y: 0 };
    segments: BeamSegment[] = [];
    
    // Sub-systems
    emitter: ParticleEmitter;
    noiseTime: number = 0;
    
    // Game Mechanics
    damagePerTick: number = 30;
    
    // Visual Parameters
    primaryColor: ColorRGBA;
    secondaryColor: ColorRGBA;
    coreColor: ColorRGBA;
    
    constructor(owner: Player) {
        // Initialize parent
        // 计算初始枪口位置
        const noseOffset = 40;
        const noseX = owner.position.x + noseOffset * Math.sin(owner.rotation);
        const noseY = owner.position.y - noseOffset * Math.cos(owner.rotation);
        
        super(noseX, noseY, EntityType.WEAPON_LASER);
        
        this.owner = owner;
        this.rotation = owner.rotation;
        this.startPoint = { x: noseX, y: noseY };
        this.endPoint = { x: noseX, y: noseY };
        
        // Initialize Subsystems
        this.emitter = new ParticleEmitter();
        this.initializeColors();
        this.initializeSegments();
        
        // Initial state
        this.phase = LaserPhase.CHARGING;
        this.length = 10;
        
        // Play sound (if we had a sound manager, we would trigger it here)
        // Audio.play("laser_charge");
    }

    private initializeColors() {
        // Cyan base scheme
        this.primaryColor = new ColorRGBA(0, 255, 255, 1.0);
        this.secondaryColor = new ColorRGBA(0, 100, 255, 0.6);
        this.coreColor = new ColorRGBA(255, 255, 255, 1.0);
    }

    private initializeSegments() {
        this.segments = [];
        const count = LASER_CONFIG.physics.segments;
        for (let i = 0; i <= count; i++) {
            this.segments.push(new BeamSegment(this.position.x, this.position.y));
        }
    }

    // ==============================================================================
    // UPDATE LOGIC
    // ==============================================================================

    update(dt: number) {
        if (this.owner.markedForDeletion) {
            this.markedForDeletion = true;
            return;
        }

        this.elapsed += dt;
        this.timeInPhase += dt;
        this.noiseTime += dt * 5.0; // Noise moves faster than time

        // Sync with player movement
        this.updatePositionAndRotation();
        
        // Update Beam Logic based on State Machine
        this.updateStateLogic(dt);
        
        // Update Beam Geometry (Wobble, Length, Width)
        this.updateGeometry(dt);
        
        // Update Particles
        this.updateParticles(dt);
        
        // Update Damage
        this.updateDamage(dt);
    }

    private updatePositionAndRotation() {
        const noseOffset = 40;
        this.startPoint.x = this.owner.position.x + noseOffset * Math.sin(this.owner.rotation);
        this.startPoint.y = this.owner.position.y - noseOffset * Math.cos(this.owner.rotation);
        this.rotation = this.owner.rotation;
        this.position.x = this.startPoint.x;
        this.position.y = this.startPoint.y;
    }

    private updateStateLogic(dt: number) {
        switch (this.phase) {
            case LaserPhase.CHARGING:
                // Pre-fire charge up. Beam is thin, particles gathering.
                if (this.timeInPhase >= LASER_CONFIG.phases.chargeDuration) {
                    this.transitionTo(LaserPhase.FIRING);
                }
                break;

            case LaserPhase.FIRING:
                // Instant expansion to full power
                // Very short duration
                if (this.timeInPhase >= 0.1) {
                    this.transitionTo(LaserPhase.SUSTAINING);
                }
                break;

            case LaserPhase.SUSTAINING:
                // Main firing duration
                if (this.timeInPhase >= LASER_CONFIG.phases.sustainDuration) {
                    this.transitionTo(LaserPhase.DECAYING);
                }
                break;

            case LaserPhase.DECAYING:
                // Cool down and fade out
                if (this.timeInPhase >= LASER_CONFIG.phases.decayDuration) {
                    this.markedForDeletion = true;
                }
                break;
        }
    }

    private transitionTo(newPhase: LaserPhase) {
        this.phase = newPhase;
        this.timeInPhase = 0;
        
        // Transition Effects
        if (newPhase === LaserPhase.FIRING) {
            // Big muzzle flash
            this.emitter.emit(this.startPoint.x, this.startPoint.y, ParticleType.ENERGY_RING, 3, this.primaryColor);
            this.emitter.emit(this.startPoint.x, this.startPoint.y, ParticleType.GLOW_ORB, 5, this.coreColor);
        }
    }

    private updateGeometry(dt: number) {
        // 1. Calculate Target Length
        let targetLen = LASER_CONFIG.core.maxLength;
        if (this.phase === LaserPhase.CHARGING) {
            targetLen = MathUtils.lerp(0, 100, this.timeInPhase / LASER_CONFIG.phases.chargeDuration);
        } else if (this.phase === LaserPhase.FIRING) {
             // Instant growth
             targetLen = LASER_CONFIG.core.maxLength;
        }
        
        // Smooth length interpolation
        const growSpeed = LASER_CONFIG.core.growthSpeed;
        if (this.length < targetLen) {
            this.length += growSpeed * dt;
            if (this.length > targetLen) this.length = targetLen;
        }

        // 2. Calculate Target Width
        let widthMultiplier = 1.0;
        if (this.phase === LaserPhase.CHARGING) widthMultiplier = 0.1;
        else if (this.phase === LaserPhase.FIRING) widthMultiplier = 1.5; // Pop effect
        else if (this.phase === LaserPhase.SUSTAINING) widthMultiplier = 1.0 + Math.sin(this.elapsed * 20) * 0.1; // Pulse
        else if (this.phase === LaserPhase.DECAYING) widthMultiplier = MathUtils.lerp(1.0, 0, this.timeInPhase / LASER_CONFIG.phases.decayDuration);

        this.currentWidth = LASER_CONFIG.core.baseWidth * widthMultiplier * (1 + (this.owner.level * 0.2));
        this.radius = this.currentWidth * 0.5; // Physics Body radius

        // 3. Update Segment Positions (The "Wobbly Rope" logic)
        // Calculate the ideal end point based on rotation
        this.endPoint.x = this.startPoint.x + Math.sin(this.rotation) * this.length;
        this.endPoint.y = this.startPoint.y - Math.cos(this.rotation) * this.length;

        const count = this.segments.length;
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const seg = this.segments[i];
            
            // Linear position along the beam
            const baseX = MathUtils.lerp(this.startPoint.x, this.endPoint.x, t);
            const baseY = MathUtils.lerp(this.startPoint.y, this.endPoint.y, t);
            
            // Apply Perlin Noise Offset (Lateral Movement)
            // We use 3D noise: (t, time, 0)
            const noiseScale = 0.05; // Spatial frequency
            const noiseAmp = this.phase === LaserPhase.CHARGING ? 2 : 5; // Jitter amplitude
            
            // Perpendicular vector for offset
            const perpX = Math.cos(this.rotation);
            const perpY = Math.sin(this.rotation);
            
            const noiseVal = noiseGen.noise(i * noiseScale, this.noiseTime, 0) - 0.5;
            const offset = noiseVal * noiseAmp * LASER_CONFIG.core.jitterAmount;
            
            seg.pos.x = baseX + perpX * offset;
            seg.pos.y = baseY + perpY * offset;
            
            // Scale width near ends (taper)
            // Taper start (0-0.1) and end (0.9-1.0)
            if (t < 0.1) seg.widthScale = t * 10;
            else if (t > 0.9) seg.widthScale = (1 - t) * 10;
            else seg.widthScale = 1.0;
        }
    }

    private updateParticles(dt: number) {
        this.emitter.update(dt);

        // Constant emission while firing
        if (this.phase === LaserPhase.SUSTAINING || this.phase === LaserPhase.FIRING) {
            // Muzzle sparks
            if (Math.random() < 0.3) {
                this.emitter.emit(this.startPoint.x, this.startPoint.y, ParticleType.SPARK, 1, new ColorRGBA(200, 255, 255));
            }
            
            // Beam body particles (glitter)
            if (Math.random() < 0.2) {
                const t = Math.random();
                const x = MathUtils.lerp(this.startPoint.x, this.endPoint.x, t);
                const y = MathUtils.lerp(this.startPoint.y, this.endPoint.y, t);
                this.emitter.emit(x, y, ParticleType.GLOW_ORB, 1, this.secondaryColor);
            }

            // Impact particles (if we were checking collision with world here)
            // For now, simulate impact at end of beam
            if (this.length >= LASER_CONFIG.core.maxLength * 0.9) {
                if (Math.random() < 0.5) {
                    this.emitter.emit(this.endPoint.x, this.endPoint.y, ParticleType.SMOKE, 1, new ColorRGBA(100, 200, 255));
                    this.emitter.emit(this.endPoint.x, this.endPoint.y, ParticleType.SPARK, 2, this.primaryColor);
                }
            }
        }
    }

    private updateDamage(dt: number) {
        if (this.phase === LaserPhase.CHARGING || this.phase === LaserPhase.DECAYING) {
            (this as any).damage = 0;
            return;
        }
        
        const levelFactor = 1 + (this.owner.level * 0.2);
        const currentDamage = this.damagePerTick * this.owner.damageMultiplier * levelFactor;
        
        // If firing (burst), double damage
        const phaseMult = this.phase === LaserPhase.FIRING ? 2.0 : 1.0;
        
        (this as any).damage = currentDamage * phaseMult;
    }

    // ==============================================================================
    // DRAWING LOGIC (The Visual Heavy Lifting)
    // ==============================================================================

    static draw(ctx: CanvasRenderingContext2D, laser: Laser) {
        if (laser.phase === LaserPhase.DECAYING && laser.currentWidth < 1) return;

        const time = Date.now() / 1000;

        ctx.save();
        
        // Enable additive blending for glowing light effects
        ctx.globalCompositeOperation = 'lighter';

        // 1. Draw Heat Haze / Distortion (Background layer)
        // In a real engine, this would be a shader. Here we simulate it with low-alpha wide strokes.
        if (LASER_CONFIG.particles.heatHazeEnabled) {
            Laser.drawHeatDistortion(ctx, laser);
        }

        // 2. Draw Secondary Glow (The Aura)
        Laser.drawOuterGlow(ctx, laser);

        // 3. Draw Electric Arcs (The Chaos)
        if (LASER_CONFIG.arcs.enabled) {
            Laser.drawElectricArcs(ctx, laser, time);
        }

        // 4. Draw The Main Beam (Core)
        Laser.drawCoreBeam(ctx, laser);

        // 5. Draw Muzzle Flash & Impact Flare
        Laser.drawFlares(ctx, laser, time);

        // 6. Draw Particles
        laser.emitter.draw(ctx);

        ctx.restore();
    }

    /**
     * Renders a wide, low-opacity path to simulate air distortion
     */
    private static drawHeatDistortion(ctx: CanvasRenderingContext2D, laser: Laser) {
        ctx.beginPath();
        const segments = laser.segments;
        if (segments.length < 2) return;

        ctx.moveTo(segments[0].pos.x, segments[0].pos.y);
        for(let i = 1; i < segments.length; i++) {
            ctx.lineTo(segments[i].pos.x, segments[i].pos.y);
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = laser.currentWidth * 4;
        ctx.strokeStyle = `rgba(0, 0, 0, 0.05)`; // Very subtle darkening
        // Note: 'lighter' comp op might negate black, but in standard rendering it adds. 
        // For pure distortion we usually need shaders, but here we add a faint color tint
        ctx.strokeStyle = `rgba(0, 50, 255, 0.03)`;
        ctx.stroke();
    }

    /**
     * Renders the soft colored aura around the beam
     */
    private static drawOuterGlow(ctx: CanvasRenderingContext2D, laser: Laser) {
        const segments = laser.segments;
        if (segments.length < 2) return;

        // Multi-pass stroke for gradient look
        const passes = 3;
        const baseW = laser.currentWidth * 2.5;

        for (let k = 0; k < passes; k++) {
            const w = baseW * (1 - k/passes);
            const alpha = 0.1 + (k * 0.05);
            
            ctx.beginPath();
            ctx.moveTo(segments[0].pos.x, segments[0].pos.y);
            
            // Use quadratic bezier for smoother visual curve through segment points
            for (let i = 1; i < segments.length - 1; i++) {
                const xc = (segments[i].pos.x + segments[i+1].pos.x) / 2;
                const yc = (segments[i].pos.y + segments[i+1].pos.y) / 2;
                ctx.quadraticCurveTo(segments[i].pos.x, segments[i].pos.y, xc, yc);
            }
            // Connect last point
            const last = segments[segments.length - 1];
            ctx.lineTo(last.pos.x, last.pos.y);

            ctx.lineWidth = w;
            ctx.strokeStyle = `rgba(${laser.secondaryColor.r}, ${laser.secondaryColor.g}, ${laser.secondaryColor.b}, ${alpha})`;
            ctx.stroke();
        }
    }

    /**
     * Renders procedural lightning arcs wrapping around the beam
     */
    private static drawElectricArcs(ctx: CanvasRenderingContext2D, laser: Laser, time: number) {
        if (laser.phase === LaserPhase.CHARGING) return; // No arcs during charge

        ctx.save();
        ctx.shadowBlur = 5;
        ctx.shadowColor = laser.primaryColor.toString();
        ctx.strokeStyle = 'rgba(200, 255, 255, 0.8)';
        ctx.lineWidth = 1.5;

        const count = LASER_CONFIG.arcs.count;
        const speed = LASER_CONFIG.arcs.wanderSpeed;
        
        for (let arcIdx = 0; arcIdx < count; arcIdx++) {
            ctx.beginPath();
            
            // Each arc has a different phase offset
            const arcPhase = arcIdx * (Math.PI * 2 / count);
            
            // Move along the main segments
            for (let i = 0; i < laser.segments.length; i++) {
                const seg = laser.segments[i];
                const progress = i / laser.segments.length;
                
                // Sine wave wrapping
                // Frequency increases slightly along the beam
                const freq = 0.1 * (1 + progress); 
                const sineVal = Math.sin(i * freq + time * speed + arcPhase);
                
                // Amplitude expands and contracts
                const amp = laser.currentWidth * (1.2 + Math.sin(time * 10) * 0.2);
                
                // Calculate perpendicular offset
                const dx = Math.cos(laser.rotation) * sineVal * amp;
                const dy = Math.sin(laser.rotation) * sineVal * amp;
                
                // Add Perlin Jitter for "Lightning" jaggedness
                const jitterX = (noiseGen.noise(i * 0.3, time * 2, arcIdx) - 0.5) * 15;
                const jitterY = (noiseGen.noise(i * 0.3 + 100, time * 2, arcIdx) - 0.5) * 15;

                const tx = seg.pos.x - dy + jitterX; // Note: -dy gives perpendicular 
                const ty = seg.pos.y + dx + jitterY;

                if (i === 0) ctx.moveTo(tx, ty);
                else ctx.lineTo(tx, ty);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * Renders the bright white core
     */
    private static drawCoreBeam(ctx: CanvasRenderingContext2D, laser: Laser) {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'white';
        
        ctx.beginPath();
        const segments = laser.segments;
        if (segments.length > 0) {
            ctx.moveTo(segments[0].pos.x, segments[0].pos.y);
            for (let i = 1; i < segments.length; i++) {
                ctx.lineTo(segments[i].pos.x, segments[i].pos.y);
            }
        }
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // Inner core is narrower
        ctx.lineWidth = laser.currentWidth * 0.6;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        
        // Draw a second, even thinner core for the "hot" center
        ctx.lineWidth = laser.currentWidth * 0.3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke(); // Double stroke for intensity
        
        ctx.restore();
    }

    /**
     * Draws lens flares and muzzle effects
     */
    private static drawFlares(ctx: CanvasRenderingContext2D, laser: Laser, time: number) {
        const sx = laser.startPoint.x;
        const sy = laser.startPoint.y;
        
        // 1. Muzzle Flare
        const muzzlePulse = 1 + Math.sin(time * 30) * 0.2;
        const muzzleSize = laser.currentWidth * 2.5 * muzzlePulse;
        
        // Radial Gradient for Muzzle
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, muzzleSize);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, laser.primaryColor.toString());
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, muzzleSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Diffraction Spikes (Star shape)
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(time * 2); // Slow rotation
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        
        const spikes = 4;
        const outerRad = muzzleSize * 1.5;
        const innerRad = muzzleSize * 0.2;
        
        ctx.beginPath();
        for(let i=0; i<spikes*2; i++){
            const rad = (i % 2 === 0) ? outerRad : innerRad;
            const a = (i / (spikes*2)) * Math.PI * 2;
            ctx.lineTo(Math.cos(a)*rad, Math.sin(a)*rad);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 2. Impact Flare (End of beam)
        // Only draw if beam is fully extended or hitting something
        const ex = laser.endPoint.x;
        const ey = laser.endPoint.y;
        const lastSeg = laser.segments[laser.segments.length-1];
        
        // Use last segment position for accuracy in case of wobble
        const ix = lastSeg.pos.x;
        const iy = lastSeg.pos.y;

        const impactSize = laser.currentWidth * 3 * Math.random();
        
        // Draw chaotic circles at impact
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ix, iy, impactSize, 0, Math.PI*2);
        ctx.stroke();
        
        const gradImpact = ctx.createRadialGradient(ix, iy, 0, ix, iy, impactSize * 1.5);
        gradImpact.addColorStop(0, '#ffffff');
        gradImpact.addColorStop(0.5, laser.primaryColor.toString());
        gradImpact.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = gradImpact;
        ctx.fill();
    }
}
