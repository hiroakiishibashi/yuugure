/**
 * PixiHost - The PixiJS implementation of NMLHost (Phase 2).
 *
 * It replaces the Phase 1 DomHost: the NMLExecutor drives this host, and this
 * host renders the scene with PixiJS — layered <image> backdrops (GSAP fades),
 * a procedural Character (auto lip-sync while text types, idle while waiting),
 * an isometric RoomRenderer, a typewriter TextBox and a LifeMeter. Free-text
 * <input> and <option> menus are collected through a small DOM overlay on top
 * of the canvas (PixiJS has no native text input).
 *
 * Construct via the async factory: `const host = await PixiHost.create(rootEl)`.
 */

import { Application, Assets, Container, FillGradient, Graphics, Sprite, Text } from 'pixi.js';
import { gsap } from 'gsap';
import { AssetResolver } from './assets/AssetResolver';
import { PixelCharacter } from './character/PixelCharacter';
import { HOME_CHARACTER_ID } from '../game/characters';
import { ASSET_BASE } from '../assetBase';
import { RoomRenderer } from './room/RoomRenderer';
import { SpeechBubbles } from './ui/SpeechBubbles';
import { LifeMeter } from './ui/LifeMeter';
import type { ImageCommand, LifeUpdate, NMLHost, TextContext } from '../engine/nml/NMLExecutor';
import type { LifeText, ResolvedChoice } from '../engine/nml/NMLTypes';

const FPS = 15;
const WIDTH = 720;
const HEIGHT = 540;
const BACKDROP_WIDTH = 520; // photo backdrops (not pixel art) — scaled smoothly to fill
// Pixel art is only crisp at INTEGER scale + nearest-neighbor; a single factor
// keeps every sprite at the same pixel density (no per-asset "fit" distortion).
const PIXEL_SCALE = 2;
const CHARACTER_FRAME = 200; // creature GIFs are 200×200

export interface PixiHostOptions {
  assets?: AssetResolver;
  /** invoked on the NML <item> tag (e.g. to update an inventory) */
  onItem?: (type: string, action: string) => void;
}

export class PixiHost implements NMLHost {
  readonly app: Application;

  private readonly overlay: HTMLElement;
  private readonly assets: AssetResolver;

  private readonly imageLayer = new Container();
  private readonly layers = new Map<number, Container>();
  private readonly room: RoomRenderer;
  private readonly character: PixelCharacter;
  private readonly speech: SpeechBubbles;
  private readonly lifeMeter: LifeMeter;
  private readonly titleText: Text;
  private readonly liveBadge: Container;
  private readonly statusText: Text;

  private lifeText: LifeText = {};
  private waiter: (() => void) | null = null;
  /** while true, any host wait resolves immediately so an interrupted scene can
   *  unwind even if it reaches a <click>/<blank> after cancelWait() ran */
  private interrupting = false;
  private readonly onItemCb: ((type: string, action: string) => void) | undefined;
  private readonly keydownHandler: (e: KeyboardEvent) => void;

  private constructor(app: Application, root: HTMLElement, opts: PixiHostOptions) {
    this.app = app;
    // Salvaged room art lives under public/assets/ — load it for real, falling
    // back to a labelled placeholder only when an asset is genuinely missing.
    this.assets = opts.assets ?? new AssetResolver({ tryLoad: true, baseUrl: `${ASSET_BASE}assets` });
    this.onItemCb = opts.onItem;

    // wrapper holds the canvas + a DOM overlay for inputs/choices
    const wrapper = document.createElement('div');
    wrapper.className = 'nml-wrapper';
    wrapper.style.cssText = `position:relative;width:100%;max-width:${WIDTH}px;aspect-ratio:${WIDTH}/${HEIGHT};margin:0 auto;`;
    app.canvas.style.cssText = 'display:block;width:100%;height:100%;border-radius:12px;';
    wrapper.appendChild(app.canvas);
    this.overlay = document.createElement('div');
    this.overlay.className = 'nml-overlay';
    this.overlay.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
    wrapper.appendChild(this.overlay);
    root.innerHTML = '';
    root.appendChild(wrapper);
    injectStyles();

    // scene graph (back to front)
    const scene = new Container();
    this.room = new RoomRenderer({ cols: 6, rows: 6, tileW: 66, tileH: 32 });
    this.room.view.position.set(WIDTH / 2, 250);
    this.imageLayer.position.set(WIDTH / 2, 232);
    // The creature is the original pixel-art GIF, layered over the canvas.
    this.character = new PixelCharacter(HOME_CHARACTER_ID);

    this.titleText = new Text({
      text: '',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 19, fontWeight: '600', fill: 0xcfe6ff },
    });
    this.titleText.anchor.set(0.5, 0);
    this.titleText.position.set(WIDTH / 2, 16);
    this.liveBadge = this.buildLiveBadge();

    this.lifeMeter = new LifeMeter({ width: 220 });
    this.lifeMeter.view.position.set(24, 52);

    this.statusText = new Text({
      text: '',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 12, fill: 0x7f9bc0 },
    });
    this.statusText.anchor.set(1, 0);
    this.statusText.position.set(WIDTH - 16, 18);

    // room background: a blue vertical gradient (no photo needed)
    const bgGrad = new FillGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, 0x14304a);
    bgGrad.addColorStop(1, 0x3f6f98);
    const bg = new Graphics().rect(0, 0, WIDTH, HEIGHT).fill(bgGrad);
    scene.addChild(bg, this.imageLayer, this.room.view);
    scene.addChild(this.titleText, this.liveBadge, this.lifeMeter.view, this.statusText);
    app.stage.addChild(scene);
    // let the stage receive pointer move/up so furniture can be dragged
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    this.room.attachDrag(app.stage);
    // the pixel-art creature + speech bubbles live in the DOM overlay
    this.overlay.appendChild(this.character.el);
    this.speech = new SpeechBubbles(this.overlay);

    // click / key to advance the dialogue
    app.canvas.addEventListener('click', () => this.advance());
    this.keydownHandler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return; // don't steal typing
      if (e.key === 'Enter' || e.key === ' ') this.advance();
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  static async create(root: HTMLElement, opts: PixiHostOptions = {}): Promise<PixiHost> {
    const app = new Application();
    await app.init({
      width: WIDTH,
      height: HEIGHT,
      background: 0x16273a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    return new PixiHost(app, root, opts);
  }

  private advance(): void {
    if (this.speech.isTyping) {
      this.speech.skip();
      return;
    }
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w();
    }
  }

  /** When idle, only relax a *talking* character back to idle — keep an
   *  explicitly-set glad/sad pose visible through the wait. */
  private relaxToIdle(): void {
    if (this.character.state === 'talk') this.character.setState('idle');
  }

  // --- NMLHost: text ---

  async printText(text: string, ctx: TextContext): Promise<void> {
    this.speech.showIndicator(false);
    this.character.setState('talk');
    await this.speech.print(text, ctx.cps);
    this.relaxToIdle();
  }

  clearText(): void {
    this.speech.clear();
  }

  lineBreak(): void {
    this.speech.lineBreak();
  }

  // --- NMLHost: pacing ---

  waitClick(): Promise<void> {
    if (this.interrupting) return Promise.resolve();
    this.relaxToIdle();
    this.speech.showIndicator(true);
    return new Promise((resolve) => {
      this.waiter = () => {
        this.speech.showIndicator(false);
        resolve();
      };
    });
  }

  waitBlank(frames: number): Promise<void> {
    if (this.interrupting) return Promise.resolve();
    this.relaxToIdle();
    const ms = (Math.max(0, frames) / FPS) * 1000;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        resolve();
      }, ms);
      this.waiter = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  // --- NMLHost: character / meters ---

  setTitle(title: string): void {
    this.titleText.text = title;
  }

  playAnim(name: string): void {
    this.character.setAnim(name);
  }

  changeLife(update: LifeUpdate): void {
    this.lifeText = update.text;
    this.lifeMeter.set(update.value, {
      delta: update.delta,
      ...(this.lifeText.prefix !== undefined ? { prefix: this.lifeText.prefix } : {}),
      message: this.lifeMessage(update.delta),
    });
  }

  setLifeText(text: LifeText): void {
    this.lifeText = text;
  }

  private lifeMessage(delta: number): string {
    const t = this.lifeText;
    const verb = delta > 0 ? t.up : delta < 0 ? t.down : t.set;
    if (!verb && !t.prefix) return '';
    return `${t.prefix ?? ''}${verb ?? ''}`;
  }

  // --- NMLHost: assets ---

  async image(cmd: ImageCommand): Promise<void> {
    const duration = Math.max(0, cmd.timeFrames) / FPS;
    if (cmd.state === 'out') {
      const layer = this.layers.get(cmd.level);
      if (layer) {
        gsap.to(layer, { alpha: 0, duration, onComplete: () => layer.destroy({ children: true }) });
        this.layers.delete(cmd.level);
      }
      return;
    }
    // state === 'in'
    const display = await this.assets.load(cmd.src ?? '');
    // scale the salvaged 300px backdrop up to fill the scene behind the creature
    const w = display.width || 300;
    if (w > 0) display.scale.set(BACKDROP_WIDTH / w);
    const layer = new Container();
    layer.addChild(display);
    layer.alpha = 0;
    this.layers.get(cmd.level)?.destroy({ children: true });
    this.layers.set(cmd.level, layer);
    this.imageLayer.addChild(layer);
    gsap.to(layer, { alpha: 1, duration });
  }

  preload(_src: string): boolean {
    return true; // placeholder mode: report success so flag variables resolve
  }

  geturl(url: string): void {
    this.status(`→ ${url}`);
  }

  // --- NMLHost: input / choices (DOM overlay) ---

  requestInput(variable: string): Promise<string> {
    if (this.interrupting) return Promise.resolve('');
    this.relaxToIdle();
    this.speech.showIndicator(false);
    return new Promise((resolve) => {
      const box = this.overlayBox();
      box.innerHTML = `
        <input class="nml-input" type="text" placeholder="…" aria-label="${variable}" />
        <button class="nml-submit" type="button">けってい</button>`;
      const input = box.querySelector<HTMLInputElement>('.nml-input')!;
      const button = box.querySelector<HTMLButtonElement>('.nml-submit')!;
      const submit = () => {
        const value = input.value;
        box.remove();
        resolve(value);
      };
      button.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          submit();
        }
      });
      input.focus();
    });
  }

  requestChoice(choices: ResolvedChoice[]): Promise<number> {
    if (this.interrupting) return Promise.resolve(0);
    this.relaxToIdle();
    this.speech.showIndicator(false);
    return new Promise((resolve) => {
      const box = this.overlayBox();
      choices.forEach((choice, i) => {
        const button = document.createElement('button');
        button.className = 'nml-choice';
        button.type = 'button';
        button.textContent = choice.text;
        button.addEventListener('click', () => {
          box.remove();
          resolve(i);
        });
        box.appendChild(button);
      });
    });
  }

  login(): boolean {
    return true;
  }

  makeUser(): boolean {
    return true;
  }

  item(type: string, action: string): void {
    this.onItemCb?.(type, action);
    this.status(`item: ${type} (${action})`);
  }

  onEnd(evaluate: boolean): void {
    this.speech.showIndicator(false);
    this.status(`— おわり —${evaluate ? '' : '（評価なし）'}`);
  }

  private status(message: string): void {
    this.statusText.text = message;
  }

  /** A pointer-enabled container in the overlay, anchored over the text box. */
  private overlayBox(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'nml-controls';
    this.overlay.appendChild(box);
    return box;
  }

  // --- Phase 3 integration (room decoration + lifecycle) ---

  /** Swap the on-screen creature (entering a different room). */
  setCharacter(id: string): void {
    this.character.setCharacter(id);
  }

  /** The creature currently on screen (for persistence). */
  get characterId(): string {
    return this.character.characterId;
  }

  /** Set the room header (e.g. "A501号室　○○さんの へや" / "じぶんの へや"). */
  setRoomTitle(text: string): void {
    this.titleText.text = text;
  }

  /** Show/hide the "LIVE" badge (visiting another resident's room). */
  setLive(on: boolean): void {
    this.liveBadge.visible = on;
  }

  private buildLiveBadge(): Container {
    const badge = new Container();
    const g = new Graphics();
    g.roundRect(0, 0, 50, 20, 4).fill(0xd2483a);
    const t = new Text({ text: 'LIVE', style: { fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: '700', fill: 0xffffff } });
    t.anchor.set(0.5);
    t.position.set(25, 10);
    badge.addChild(g, t);
    badge.position.set(14, 12);
    badge.visible = false;
    return badge;
  }

  /** Remove all placed furniture (when switching rooms). */
  clearRoomItems(): void {
    this.room.clearItems();
  }

  /** Begin interrupting the current scene: finish typing, release any pending
   *  wait, and short-circuit any wait the unwinding scene reaches next. */
  cancelWait(): void {
    this.interrupting = true;
    this.speech.skip();
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      this.speech.showIndicator(false);
      w();
    }
  }

  /** Re-enable real waits for a freshly started scene (call before run()). */
  beginRun(): void {
    this.interrupting = false;
  }

  /** Place an item on the isometric room grid. With `art`, the real pixel-art
   *  sprite is used (scaled, standing on the tile); otherwise a labelled token. */
  async addRoomItem(name: string, col: number, row: number, art?: string): Promise<void> {
    let display: Container | null = null;
    if (art) {
      try {
        const texture = await Assets.load(art);
        texture.source.scaleMode = 'nearest'; // keep the ドット絵 crisp when scaled
        const sprite = new Sprite(texture);
        sprite.scale.set(PIXEL_SCALE); // uniform integer scale (no per-item fit distortion)
        sprite.anchor.set(0.5, 1); // base rests on the tile
        display = sprite;
      } catch {
        display = null;
      }
    }
    this.room.placeItem(display ?? this.itemToken(name), col, row);
  }

  /** Fallback labelled token when an item has no art. */
  private itemToken(name: string): Container {
    const token = new Container();
    const g = new Graphics();
    g.roundRect(-26, -46, 52, 46, 9)
      .fill({ color: 0x3a2f56, alpha: 0.96 })
      .stroke({ width: 1.5, color: 0x8a7bbf });
    const label = new Text({
      text: name,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 12, fill: 0xe8e2f2, align: 'center' },
    });
    label.anchor.set(0.5);
    label.position.set(0, -23);
    token.addChild(g, label);
    return token;
  }

  /** Tear down PixiJS + listeners (call on React unmount). */
  destroy(): void {
    window.removeEventListener('keydown', this.keydownHandler);
    this.overlay.innerHTML = '';
    this.app.destroy(true, { children: true });
  }
}

let stylesInjected = false;
function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  // creature frame shown at the same integer pixel density as the furniture
  const charPct = ((CHARACTER_FRAME * PIXEL_SCALE) / WIDTH) * 100;
  const style = document.createElement('style');
  style.textContent = `
    .nml-character {
      position: absolute; left: 50%; top: 62%;
      width: ${charPct.toFixed(2)}%; height: auto;
      transform: translate(-50%, -100%);     /* bottom-centre, standing on the floor */
      image-rendering: pixelated;            /* keep the ドット絵 crisp when scaled */
      pointer-events: none; user-select: none;
      transition: filter .45s ease, transform .45s ease;
    }
    .nml-character[data-mood="glad"] { filter: brightness(1.18) saturate(1.25); transform: translate(-50%, -106%); }
    .nml-character[data-mood="sad"]  { filter: brightness(0.78) saturate(0.65); transform: translate(-50%, -95%); }
    /* speech bubbles (creature dialogue), stacked above the head */
    .nml-bubbles {
      position: absolute; left: 50%; bottom: 50%;
      transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      width: 86%; pointer-events: none;
    }
    .nml-bubble {
      position: relative; max-width: 80%;
      background: #eaf2fb; color: #1c3148;
      border-radius: 14px; padding: 8px 14px;
      font-size: 15px; line-height: 1.5; text-align: center;
      box-shadow: 0 2px 6px rgba(0,0,0,.35);
      animation: nml-bubble-in .18s ease-out;
    }
    .nml-bubble::after {
      content: ''; position: absolute; left: 50%; bottom: -7px;
      transform: translateX(-50%);
      border: 7px solid transparent; border-top-color: #eaf2fb; border-bottom: 0;
    }
    @keyframes nml-bubble-in { from { opacity: 0; transform: translateY(6px) scale(.96); } }
    .nml-bubble-hint {
      position: absolute; right: 16px; bottom: 12px;
      color: #bcd8f4; font-size: 13px; pointer-events: none;
      animation: nml-blink 1s steps(2) infinite;
    }
    @keyframes nml-blink { 50% { opacity: .25; } }
    .nml-controls {
      position: absolute; left: 40px; right: 40px; bottom: 22px;
      display: flex; flex-wrap: wrap; gap: 10px; pointer-events: auto;
    }
    .nml-controls .nml-input { flex: 1 1 200px; padding: 10px 12px; font-size: 16px; border-radius: 8px;
      border: 1px solid #3c5a7e; background: #0d1828; color: #dceaf8; }
    .nml-controls .nml-submit, .nml-controls .nml-choice {
      padding: 10px 16px; font-size: 15px; cursor: pointer; border-radius: 8px;
      border: 1px solid #4f7bb0; background: #1e3550; color: #dceaf8; }
    .nml-controls .nml-submit:hover, .nml-controls .nml-choice:hover { background: #284766; }
  `;
  document.head.appendChild(style);
}
