import { Vector2 } from "../types";

/**
 * 输入管理器 - 支持桌面键鼠 + 手机多点触控
 *
 * 手机多点触控设计：
 *   - 屏幕左半 = 虚拟摇杆 (一个手指拖动控制方向)
 *   - 屏幕右半 = 射击区 (另一个手指按住即开火)
 *   - 其他 UI 按钮 (技能/换武器) 通过 setTouchFilter() 注册为"不算游戏输入"的区域，
 *     避免按按钮时意外触发移动/开火，并允许这些手指与摇杆/射击同时存在。
 */
export class InputManager {
  // 键盘
  keys: { [key: string]: boolean } = {};
  keyPressMap: { [key: string]: boolean } = {};

  // 鼠标
  mousePos: Vector2 = { x: 0, y: 0 };
  isMouseDown: boolean = false;
  isClicked: boolean = false;       // 本帧是否有点击 (mouseup 时设 true, 消费后手动设 false)
  lastClickPos: Vector2 = { x: 0, y: 0 };

  // --- 触屏状态 ---
  // 摇杆
  private joystickTouchId: number | null = null;
  private joystickStart: Vector2 = { x: 0, y: 0 };
  private joystickCurrent: Vector2 = { x: 0, y: 0 };
  private joystickActive: boolean = false;
  public joystickBase: Vector2 = { x: 0, y: 0 };   // 供 HUD 绘制
  public joystickKnob: Vector2 = { x: 0, y: 0 };   // 供 HUD 绘制

  // 射击
  private firingTouches: Set<number> = new Set();

  // 被"UI 按钮"占用的手指, 不参与游戏输入
  private uiTouches: Set<number> = new Set();

  // 屏幕尺寸缓存 (用于判断左右半屏)
  private get screenW() { return window.innerWidth; }
  private get screenH() { return window.innerHeight; }

  // 最大摇杆拖动半径
  private readonly JOY_MAX_RADIUS = 70;

  constructor() {
    this.setupListeners();
  }

  // 给 UI 按钮调用：把这个 touchId 标记成 UI 触摸，后续 move/end 不参与游戏逻辑
  markUITouch(id: number) { this.uiTouches.add(id); }
  unmarkUITouch(id: number) { this.uiTouches.delete(id); }

  /**
   * 重置所有瞬时输入状态.
   * 子引擎 (如 RogueEngine) 启动前调用, 避免把启动按钮那次点击/按键误当成游戏内输入.
   */
  reset() {
    this.isMouseDown = false;
    this.isClicked = false;
    this.keys = {};
    this.keyPressMap = {};
    this.firingTouches.clear();
    this.uiTouches.clear();
    this.joystickTouchId = null;
    this.joystickActive = false;
  }

  private setupListeners() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (!this.keys[key]) this.keyPressMap[key] = true;
      this.keys[key] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    window.addEventListener('mousedown', () => { this.isMouseDown = true; });
    window.addEventListener('mouseup',   (e) => { this.isMouseDown = false; this.isClicked = true; this.lastClickPos = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('mousemove', (e) => {
      this.mousePos = { x: e.clientX, y: e.clientY };
    });

    // --- 多点触控 ---
    const onStart = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];

        // 兜底：如果按下的目标是 UI 按钮 (带 data-ui-button 属性)，忽略
        const target = t.target as HTMLElement | null;
        if (target && target.closest && target.closest('[data-ui-button]')) {
          this.uiTouches.add(t.identifier);
          continue;
        }
        if (this.uiTouches.has(t.identifier)) continue;

        const isLeft = t.clientX < this.screenW * 0.5;

        if (isLeft) {
          // 左半屏：摇杆 (如果已经有摇杆了，忽略额外的左侧点击)
          if (this.joystickTouchId === null) {
            this.joystickTouchId = t.identifier;
            this.joystickActive = true;
            this.joystickStart = { x: t.clientX, y: t.clientY };
            this.joystickCurrent = { x: t.clientX, y: t.clientY };
            this.joystickBase = { ...this.joystickStart };
            this.joystickKnob = { ...this.joystickStart };
          }
        } else {
          // 右半屏：射击
          this.firingTouches.add(t.identifier);
        }
      }
    };

    const onMove = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (this.uiTouches.has(t.identifier)) continue;

        if (t.identifier === this.joystickTouchId) {
          this.joystickCurrent = { x: t.clientX, y: t.clientY };

          // 夹住最大半径，超出则把"底座"跟着拖过去
          let dx = this.joystickCurrent.x - this.joystickBase.x;
          let dy = this.joystickCurrent.y - this.joystickBase.y;
          const dist = Math.hypot(dx, dy);
          if (dist > this.JOY_MAX_RADIUS) {
            const scale = this.JOY_MAX_RADIUS / dist;
            this.joystickBase.x = this.joystickCurrent.x - dx * scale;
            this.joystickBase.y = this.joystickCurrent.y - dy * scale;
            dx = this.joystickCurrent.x - this.joystickBase.x;
            dy = this.joystickCurrent.y - this.joystickBase.y;
          }
          this.joystickKnob = { ...this.joystickCurrent };
        }
      }
    };

    const onEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        this.uiTouches.delete(t.identifier);

        if (t.identifier === this.joystickTouchId) {
          this.joystickTouchId = null;
          this.joystickActive = false;
        }
        this.firingTouches.delete(t.identifier);
      }
    };

    // 注意: passive:false 让我们能 preventDefault (防止系统手势)
    window.addEventListener('touchstart',  onStart, { passive: false });
    window.addEventListener('touchmove',   onMove,  { passive: false });
    window.addEventListener('touchend',    onEnd,   { passive: false });
    window.addEventListener('touchcancel', onEnd,   { passive: false });
  }

  isKeyPressed(key: string): boolean {
    if (this.keyPressMap[key]) {
      this.keyPressMap[key] = false;
      return true;
    }
    return false;
  }

  // 是否触发射击（鼠标左键 / 空格 / 触屏右半屏按住）
  get isFiring(): boolean {
    return this.isMouseDown || !!this.keys[' '] || this.firingTouches.size > 0;
  }

  // 提供给 GameEngine 替代 isMouseDown 语义
  get _legacyIsMouseDown(): boolean { return this.isFiring; }

  getMovementVector(): Vector2 {
    const move = { x: 0, y: 0 };

    if (this.keys['w'] || this.keys['arrowup'])    move.y -= 1;
    if (this.keys['s'] || this.keys['arrowdown'])  move.y += 1;
    if (this.keys['a'] || this.keys['arrowleft'])  move.x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) move.x += 1;

    if (move.x !== 0 || move.y !== 0) {
      const length = Math.hypot(move.x, move.y);
      move.x /= length; move.y /= length;
      return move;
    }

    // 摇杆：输出归一化向量 (0..1)
    if (this.joystickActive) {
      const dx = this.joystickKnob.x - this.joystickBase.x;
      const dy = this.joystickKnob.y - this.joystickBase.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const mag = Math.min(1, dist / this.JOY_MAX_RADIUS);
        move.x = (dx / dist) * mag;
        move.y = (dy / dist) * mag;
      }
    }
    return move;
  }

  // 便于 HUD 读取摇杆状态
  getJoystickState() {
    return {
      active: this.joystickActive,
      base:   this.joystickBase,
      knob:   this.joystickKnob
    };
  }
}
