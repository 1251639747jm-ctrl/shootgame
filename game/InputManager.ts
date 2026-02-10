import { Vector2 } from "../types";

export class InputManager {
  keys: { [key: string]: boolean } = {};
  keyPressMap: { [key: string]: boolean } = {}; // Track single presses
  mousePos: Vector2 = { x: 0, y: 0 };
  isMouseDown: boolean = false;
  
  // Mobile specific
  touchActive: boolean = false;
  touchStartPos: Vector2 = { x: 0, y: 0 };
  touchCurrentPos: Vector2 = { x: 0, y: 0 };

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (!this.keys[key]) {
        this.keyPressMap[key] = true; // Register press only on initial down
      }
      this.keys[key] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    window.addEventListener('mousedown', () => {
      this.isMouseDown = true;
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.mousePos = { x: e.clientX, y: e.clientY };
    });

    // Touch events for Mobile
    window.addEventListener('touchstart', (e) => {
      // Check if touch is not on a UI button (simple heuristic: logic handled in App/Canvas layers usually, 
      // but here we just grab coordinates. The App UI will stopPropagation for buttons)
      this.touchActive = true;
      this.isMouseDown = true; 
      if(e.touches.length > 0) {
        this.touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this.touchCurrentPos = { ...this.touchStartPos };
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if(e.touches.length > 0) {
        // e.preventDefault(); // Moved to App level or handled carefully to allow UI touches if needed
        this.touchCurrentPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      this.touchActive = false;
      this.isMouseDown = false;
    });
  }

  isKeyPressed(key: string): boolean {
    if (this.keyPressMap[key]) {
      this.keyPressMap[key] = false; // Consume the press
      return true;
    }
    return false;
  }

  getMovementVector(): Vector2 {
    const move = { x: 0, y: 0 };
    
    // Keyboard
    if (this.keys['w'] || this.keys['arrowup']) move.y -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) move.y += 1;
    if (this.keys['a'] || this.keys['arrowleft']) move.x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) move.x += 1;

    // Normalize keyboard vector
    if (move.x !== 0 || move.y !== 0) {
      const length = Math.sqrt(move.x * move.x + move.y * move.y);
      move.x /= length;
      move.y /= length;
      return move;
    }

    // Touch (Virtual Joystick logic)
    if (this.touchActive) {
      const dx = this.touchCurrentPos.x - this.touchStartPos.x;
      const dy = this.touchCurrentPos.y - this.touchStartPos.y;
      
      const dragSensitivity = 1.5;
      move.x = dx * dragSensitivity;
      move.y = dy * dragSensitivity;
      
      this.touchStartPos = { ...this.touchCurrentPos };
    }

    return move;
  }
}