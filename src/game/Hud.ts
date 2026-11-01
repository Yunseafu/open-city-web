const CSS = `
#ui { position: fixed; inset: 0; pointer-events: none; font: 14px/1.5 "Segoe UI", "Microsoft YaHei", system-ui, sans-serif; color: #cfffff; text-shadow: 0 0 6px #0ff8; user-select: none; }
#ui .cross { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; opacity: .85; }
#ui .cross::before, #ui .cross::after { content: ""; position: absolute; background: #7ff; box-shadow: 0 0 4px #0ff; }
#ui .cross::before { left: 10px; top: 0; width: 2px; height: 22px; mask: linear-gradient(#000 35%, transparent 35% 65%, #000 65%); -webkit-mask: linear-gradient(#000 35%, transparent 35% 65%, #000 65%); }
#ui .cross::after { top: 10px; left: 0; height: 2px; width: 22px; mask: linear-gradient(90deg, #000 35%, transparent 35% 65%, #000 65%); -webkit-mask: linear-gradient(90deg, #000 35%, transparent 35% 65%, #000 65%); }
#ui .cross.hit::before, #ui .cross.hit::after { background: #fff; }
#ui .cross.kill::before, #ui .cross.kill::after { background: #f24; box-shadow: 0 0 6px #f24; }
#ui .stats { position: absolute; left: 24px; bottom: 24px; width: 260px; }
#ui .bar { height: 10px; background: #0008; border: 1px solid #0ff6; margin-top: 4px; }
#ui .bar > i { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, #f0a, #0ff); transition: width .15s; }
#ui .ammo { position: absolute; right: 28px; bottom: 24px; text-align: right; font-size: 34px; font-weight: 600; letter-spacing: 1px; }
#ui .ammo small { display: block; font-size: 12px; font-weight: 400; opacity: .8; }
#ui .obj { position: absolute; right: 24px; top: 20px; width: 330px; padding: 10px 14px; background: #000a; border-left: 3px solid #f0a; }
#ui .obj h4 { margin: 0 0 4px; font-size: 12px; letter-spacing: 2px; color: #f6c; }
#ui .obj p { margin: 0; }
#ui .obj .sub { opacity: .75; font-size: 12px; }
#ui .toast { position: absolute; left: 50%; top: 16%; transform: translateX(-50%); font-size: 20px; opacity: 0; transition: opacity .3s; text-align: center; padding: 6px 18px; background: #000a; }
#ui .toast.on { opacity: 1; }
#ui .flash { position: absolute; inset: 0; background: radial-gradient(transparent 40%, #f003 100%); opacity: 0; transition: opacity .25s; box-shadow: inset 0 0 120px #f00; }
#ui .wp { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); text-align: center; font-size: 12px; color: #ff4fd8; text-shadow: 0 0 6px #f0a; display: none; }
#ui .wp b { display: block; font-size: 22px; line-height: 1; }
#ui .center { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; flex-direction: column; background: #000b; pointer-events: auto; text-align: center; }
#ui .center.on { display: flex; }
#ui .center h1 { margin: 0 0 10px; font-size: 40px; letter-spacing: 6px; color: #0ff; }
#ui .center pre { margin: 14px 0 0; font: 14px/1.9 "Segoe UI", "Microsoft YaHei", sans-serif; opacity: .9; }
#ui .center .go { margin-top: 18px; padding: 10px 28px; border: 1px solid #0ff; color: #0ff; cursor: pointer; letter-spacing: 3px; }
#ui .seq { position: absolute; left: 50%; bottom: 22%; transform: translateX(-50%); display: none; gap: 10px; }
#ui .seq.on { display: flex; }
#ui .seq i { width: 26px; height: 26px; border-radius: 50%; background: #123; border: 1px solid #fff4; }
#ui .seq i.done { box-shadow: 0 0 10px currentColor; background: currentColor; }
`;

const COLOUR_CSS = ["#00e5ff", "#ff2bd6", "#ffb000"];

function el(cls: string, parent: HTMLElement, html = ""): HTMLDivElement {
  const d = document.createElement("div");
  d.className = cls;
  d.innerHTML = html;
  parent.appendChild(d);
  return d;
}

/** DOM overlay: crosshair, health, ammo, objective, waypoint marker and the start / death screens. */
export class Hud {
  private root: HTMLDivElement;
  private cross: HTMLDivElement;
  private healthFill: HTMLElement;
  private healthText: HTMLElement;
  private ammo: HTMLElement;
  private objTitle: HTMLElement;
  private objText: HTMLElement;
  private objSub: HTMLElement;
  private toast: HTMLDivElement;
  private flash: HTMLDivElement;
  private wp: HTMLDivElement;
  private wpDist: HTMLElement;
  private seq: HTMLDivElement;
  private start: HTMLDivElement;
  private death: HTMLDivElement;
  private done: HTMLDivElement;
  private toastTimer = 0;
  private crossTimer = 0;
  onStartClick: (() => void) | null = null;
  onRespawnClick: (() => void) | null = null;

  constructor() {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = el("", document.body) as HTMLDivElement;
    this.root.id = "ui";
    this.cross = el("cross", this.root);
    const stats = el("stats", this.root, `<div>生命 <span class="hp">100</span></div><div class="bar"><i></i></div>`);
    this.healthFill = stats.querySelector("i") as HTMLElement;
    this.healthText = stats.querySelector(".hp") as HTMLElement;
    this.ammo = el("ammo", this.root);
    const obj = el("obj", this.root, `<h4></h4><p></p><div class="sub"></div>`);
    this.objTitle = obj.querySelector("h4") as HTMLElement;
    this.objText = obj.querySelector("p") as HTMLElement;
    this.objSub = obj.querySelector(".sub") as HTMLElement;
    this.toast = el("toast", this.root);
    this.flash = el("flash", this.root);
    this.wp = el("wp", this.root, `<b>◆</b><span></span>`);
    this.wpDist = this.wp.querySelector("span") as HTMLElement;
    this.seq = el("seq", this.root);
    this.start = el(
      "center on",
      this.root,
      `<h1>OPEN CITY</h1><div>点击屏幕开始</div>
       <pre>W A S D  移动　　Shift  奔跑　　Space  跳跃
鼠标  瞄准　　左键  开枪　　右键  举枪瞄准
R  换弹　　E  互动　　Esc  暂停</pre><div class="go">开始游戏</div>`,
    );
    this.start.addEventListener("click", () => this.onStartClick?.());
    this.death = el("center", this.root, `<h1 style="color:#f24">你倒下了</h1><div class="go">点击重生</div>`);
    this.death.addEventListener("click", () => this.onRespawnClick?.());
    this.done = el("center", this.root, `<h1>任务完成</h1><div>你破解了终端并清理了街区。</div><pre>可以继续在城里自由探索。</pre><div class="go">继续探索</div>`);
    this.done.addEventListener("click", () => {
      this.done.classList.remove("on");
      this.onStartClick?.();
    });
  }

  showStart(on: boolean, text?: string): void {
    this.start.classList.toggle("on", on);
    if (text) (this.start.children[1] as HTMLElement).textContent = text;
  }
  showDeath(on: boolean): void {
    this.death.classList.toggle("on", on);
  }
  showComplete(): void {
    this.done.classList.add("on");
  }

  setHealth(hp: number, max: number): void {
    this.healthFill.style.width = `${Math.max(0, (hp / max) * 100)}%`;
    this.healthText.textContent = String(Math.max(0, Math.ceil(hp)));
  }
  setAmmo(mag: number, reserve: number, reloading: boolean): void {
    this.ammo.innerHTML = `${reloading ? "换弹中" : mag}<small>/ ${reserve}</small>`;
  }
  setObjective(title: string, text: string, sub = ""): void {
    this.objTitle.textContent = title;
    this.objText.textContent = text;
    this.objSub.textContent = sub;
  }
  say(text: string, ms = 2600): void {
    this.toast.textContent = text;
    this.toast.classList.add("on");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove("on"), ms);
  }
  damageFlash(): void {
    this.flash.style.transition = "none";
    this.flash.style.opacity = "1";
    requestAnimationFrame(() => {
      this.flash.style.transition = "opacity .5s";
      this.flash.style.opacity = "0";
    });
  }
  hitMarker(kill: boolean): void {
    this.cross.className = `cross ${kill ? "kill" : "hit"}`;
    window.clearTimeout(this.crossTimer);
    this.crossTimer = window.setTimeout(() => (this.cross.className = "cross"), kill ? 260 : 120);
  }
  setWaypoint(x: number, y: number, distance: number, visible: boolean): void {
    this.wp.style.display = visible ? "block" : "none";
    if (!visible) return;
    this.wp.style.left = `${x}px`;
    this.wp.style.top = `${y}px`;
    this.wpDist.textContent = `${Math.round(distance)} m`;
  }
  /** Sequence puzzle progress: `colours` are indices into the three neon colours. */
  setSequence(colours: number[] | null, done = 0): void {
    this.seq.classList.toggle("on", !!colours);
    if (!colours) return;
    this.seq.innerHTML = colours.map((c, i) => `<i class="${i < done ? "done" : ""}" style="color:${COLOUR_CSS[c]}"></i>`).join("");
  }
}
