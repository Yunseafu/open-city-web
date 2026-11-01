/** Keyboard and mouse state, with pointer lock on the canvas. */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  leftDown = false;
  rightDown = false;
  locked = false;
  onLockChange: ((locked: boolean) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "Tab"].includes(e.code)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => {
      this.down.clear();
      this.leftDown = this.rightDown = false;
    });
    canvas.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.leftDown = true;
      if (e.button === 2) this.rightDown = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.leftDown = false;
      if (e.button === 2) this.rightDown = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) {
        this.leftDown = this.rightDown = false;
        this.down.clear();
      }
      this.onLockChange?.(this.locked);
    });
  }

  lock(): void {
    void this.canvas.requestPointerLock();
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True once per key press. */
  wasPressed(code: string): boolean {
    return this.pressed.delete(code);
  }

  /** Call at the end of every frame. */
  endFrame(): void {
    this.pressed.clear();
    this.mouseDX = this.mouseDY = 0;
  }
}
