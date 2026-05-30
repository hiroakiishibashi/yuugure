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

import { Application, Container, Graphics, Text } from 'pixi.js';
import { gsap } from 'gsap';
import { AssetResolver } from './assets/AssetResolver';
import { Character } from './character/Character';
import { RoomRenderer } from './room/RoomRenderer';
import { TextBox } from './ui/TextBox';
import { LifeMeter } from './ui/LifeMeter';
import type { ImageCommand, LifeUpdate, NMLHost, TextContext } from '../engine/nml/NMLExecutor';
import type { LifeText, ResolvedChoice } from '../engine/nml/NMLTypes';

const FPS = 15;
const WIDTH = 720;
const HEIGHT = 540;

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
  private readonly character: Character;
  private readonly textBox: TextBox;
  private readonly lifeMeter: LifeMeter;
  private readonly titleText: Text;
  private readonly statusText: Text;

  private lifeText: LifeText = {};
  private waiter: (() => void) | null = null;
  private readonly onItemCb: ((type: string, action: string) => void) | undefined;
  private readonly keydownHandler: (e: KeyboardEvent) => void;

  private constructor(app: Application, root: HTMLElement, opts: PixiHostOptions) {
    this.app = app;
    this.assets = opts.assets ?? new AssetResolver();
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
    this.imageLayer.position.set(WIDTH / 2, 210);
    this.character = new Character();
    this.character.view.position.set(WIDTH / 2, 312);

    this.titleText = new Text({
      text: '',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 20, fontWeight: '600', fill: 0xd8b4fe },
    });
    this.titleText.anchor.set(0.5, 0);
    this.titleText.position.set(WIDTH / 2, 18);

    this.lifeMeter = new LifeMeter({ width: 220 });
    this.lifeMeter.view.position.set(24, 58);

    this.textBox = new TextBox({ width: WIDTH - 80, height: 170 });
    this.textBox.view.position.set(40, HEIGHT - 190);

    this.statusText = new Text({
      text: '',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 12, fill: 0x6b6480 },
    });
    this.statusText.anchor.set(1, 0);
    this.statusText.position.set(WIDTH - 16, 18);

    scene.addChild(this.imageLayer, this.room.view, this.character.view);
    scene.addChild(this.titleText, this.lifeMeter.view, this.textBox.view, this.statusText);
    app.stage.addChild(scene);

    // shared ticker drives the typewriter + character animation
    app.ticker.add((ticker) => {
      this.character.update(ticker.deltaMS);
      this.textBox.update(ticker.deltaMS);
    });

    // click / key to advance (skip typing, then release the active wait)
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
      background: 0x15121c,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    return new PixiHost(app, root, opts);
  }

  private advance(): void {
    if (this.textBox.isTyping) {
      this.textBox.skip();
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
    this.textBox.showIndicator(false);
    this.character.setState('talk');
    await this.textBox.print(text, ctx.cps);
    this.relaxToIdle();
  }

  clearText(): void {
    this.textBox.clear();
  }

  lineBreak(): void {
    this.textBox.lineBreak();
  }

  // --- NMLHost: pacing ---

  waitClick(): Promise<void> {
    this.relaxToIdle();
    this.textBox.showIndicator(true);
    return new Promise((resolve) => {
      this.waiter = () => {
        this.textBox.showIndicator(false);
        resolve();
      };
    });
  }

  waitBlank(frames: number): Promise<void> {
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
    this.relaxToIdle();
    this.textBox.showIndicator(false);
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
    this.relaxToIdle();
    this.textBox.showIndicator(false);
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
    this.textBox.showIndicator(false);
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

  /** Release any pending click/blank wait and finish current typing, so a new
   *  NML run can take over (used when the player posts another blog entry). */
  cancelWait(): void {
    this.textBox.skip();
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      this.textBox.showIndicator(false);
      w();
    }
  }

  /** Place a labelled item token on the isometric room grid. */
  async addRoomItem(name: string, col: number, row: number): Promise<void> {
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
    this.room.placeItem(token, col, row);
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
  const style = document.createElement('style');
  style.textContent = `
    .nml-controls {
      position: absolute; left: 40px; right: 40px; bottom: 26px;
      display: flex; flex-wrap: wrap; gap: 10px; pointer-events: auto;
    }
    .nml-controls .nml-input { flex: 1 1 200px; padding: 10px 12px; font-size: 16px; border-radius: 8px;
      border: 1px solid #4a4366; background: #0d0a14; color: #e8e2f2; }
    .nml-controls .nml-submit, .nml-controls .nml-choice {
      padding: 10px 16px; font-size: 15px; cursor: pointer; border-radius: 8px;
      border: 1px solid #5b4b86; background: #2a2140; color: #e8e2f2; }
    .nml-controls .nml-submit:hover, .nml-controls .nml-choice:hover { background: #3a2f56; }
  `;
  document.head.appendChild(style);
}
