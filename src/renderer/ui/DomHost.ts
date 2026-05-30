/**
 * DomHost - A lightweight DOM implementation of NMLHost for Phase 1.
 *
 * It renders the NML script to plain DOM with a real typewriter effect (driven
 * by the Typewriter timing model), click-to-advance, timed <blank> waits, a
 * free-text <input> field and <option> buttons. No PixiJS / assets yet — that
 * is Phase 2, which will provide a richer NMLHost in its place.
 *
 * Interaction model (matches the 2003 のけものがたり dialect):
 *   - text reveals progressively; clicking while it types skips to full.
 *   - <click> waits for a click (does NOT auto-clear); <clear> clears.
 *   - clicking during a <blank> wait skips the remaining time.
 */

import { Typewriter } from '../../engine/nml/Typewriter';
import type {
  ImageCommand,
  LifeUpdate,
  NMLHost,
  TextContext,
} from '../../engine/nml/NMLExecutor';
import type { ResolvedChoice } from '../../engine/nml/NMLTypes';

const FPS = 15;

export class DomHost implements NMLHost {
  private readonly titleEl: HTMLElement;
  private readonly textEl: HTMLElement;
  private readonly indicatorEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly interactionEl: HTMLElement;

  private committed = '';
  private activeTw: Typewriter | null = null;
  private waiter: (() => void) | null = null;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="nml-stage">
        <h1 class="nml-title"></h1>
        <div class="nml-status"></div>
        <div class="nml-textbox"><span class="nml-text"></span><span class="nml-indicator">▼</span></div>
        <div class="nml-interaction"></div>
      </div>`;
    this.titleEl = root.querySelector('.nml-title')!;
    this.textEl = root.querySelector('.nml-text')!;
    this.indicatorEl = root.querySelector('.nml-indicator')!;
    this.statusEl = root.querySelector('.nml-status')!;
    this.interactionEl = root.querySelector('.nml-interaction')!;
    this.indicatorEl.style.visibility = 'hidden';
    injectStyles();

    const onAdvance = () => this.advance();
    this.textEl.parentElement!.addEventListener('click', onAdvance);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') onAdvance();
    });
  }

  /** A click/tap/Enter: skip typing if mid-reveal, else release the current wait. */
  private advance(): void {
    if (this.activeTw && !this.activeTw.isDone) {
      this.activeTw.skip();
      return;
    }
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w();
    }
  }

  printText(text: string, ctx: TextContext): Promise<void> {
    const tw = new Typewriter({ cps: ctx.cps });
    tw.start(text);
    this.activeTw = tw;
    const render = () => {
      this.textEl.textContent = this.committed + tw.visibleText;
    };
    return this.animate(tw, render).then(() => {
      this.committed += text;
      this.activeTw = null;
    });
  }

  private animate(tw: Typewriter, render: () => void): Promise<void> {
    return new Promise((resolve) => {
      if (tw.isDone) {
        render();
        resolve();
        return;
      }
      let last = performance.now();
      const step = (now: number) => {
        const dt = now - last;
        last = now;
        tw.tick(dt);
        render();
        if (tw.isDone) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  clearText(): void {
    this.committed = '';
    this.textEl.textContent = '';
  }

  lineBreak(): void {
    this.committed += '\n';
    this.textEl.textContent = this.committed;
  }

  waitClick(): Promise<void> {
    this.indicatorEl.style.visibility = 'visible';
    return new Promise((resolve) => {
      this.waiter = () => {
        this.indicatorEl.style.visibility = 'hidden';
        resolve();
      };
    });
  }

  waitBlank(frames: number): Promise<void> {
    const ms = (Math.max(0, frames) / FPS) * 1000;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        resolve();
      }, ms);
      // allow a click to skip the remaining wait
      this.waiter = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  setTitle(title: string): void {
    this.titleEl.textContent = title;
  }

  playAnim(name: string): void {
    this.status(`anim: ${name}`);
  }

  setVoice(level: number): void {
    this.status(`voice: ${level}`);
  }

  changeLife(update: LifeUpdate): void {
    const sign = update.delta > 0 ? '+' : '';
    this.status(`life: ${update.value} (${sign}${update.delta})`);
  }

  image(cmd: ImageCommand): void {
    this.status(`image[${cmd.level}] ${cmd.state} ${cmd.src ?? ''}`);
  }

  preload(src: string): boolean {
    this.status(`preload: ${src}`);
    return true;
  }

  geturl(url: string): void {
    this.status(`geturl: ${url}`);
  }

  requestInput(variable: string): Promise<string> {
    this.indicatorEl.style.visibility = 'hidden';
    return new Promise((resolve) => {
      this.interactionEl.innerHTML = `
        <input class="nml-input" type="text" autofocus placeholder="…" aria-label="${variable}" />
        <button class="nml-submit" type="button">けってい</button>`;
      const input = this.interactionEl.querySelector<HTMLInputElement>('.nml-input')!;
      const button = this.interactionEl.querySelector<HTMLButtonElement>('.nml-submit')!;
      const submit = () => {
        const value = input.value;
        this.interactionEl.innerHTML = '';
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
    this.indicatorEl.style.visibility = 'hidden';
    return new Promise((resolve) => {
      this.interactionEl.innerHTML = '';
      choices.forEach((choice, i) => {
        const button = document.createElement('button');
        button.className = 'nml-choice';
        button.type = 'button';
        button.textContent = choice.text;
        button.addEventListener('click', () => {
          this.interactionEl.innerHTML = '';
          resolve(i);
        });
        this.interactionEl.appendChild(button);
      });
    });
  }

  item(type: string, action: string): void {
    this.status(`item: ${type} (${action})`);
  }

  mail(address: string): void {
    this.status(`mail: ${address}`);
  }

  onEnd(evaluate: boolean): void {
    this.indicatorEl.style.visibility = 'hidden';
    this.status(`— おわり — (evaluate=${evaluate})`);
  }

  private status(message: string): void {
    this.statusEl.textContent = message;
  }
}

let stylesInjected = false;
function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .nml-stage { display: flex; flex-direction: column; gap: 14px; }
    .nml-title { font-size: 20px; font-weight: 600; letter-spacing: .08em; color: #d8b4fe; margin: 0; min-height: 1.2em; }
    .nml-status { font-size: 12px; color: #6b6480; min-height: 1.2em; font-variant-numeric: tabular-nums; }
    .nml-textbox {
      position: relative; min-height: 9em; padding: 20px 22px; cursor: pointer;
      background: rgba(10, 8, 16, .72); border: 1px solid #3a3350; border-radius: 12px;
      line-height: 1.9; font-size: 17px; white-space: pre-wrap; word-break: break-word;
    }
    .nml-indicator { position: absolute; right: 14px; bottom: 10px; color: #d8b4fe; animation: nml-blink 1s steps(2) infinite; }
    @keyframes nml-blink { 50% { opacity: 0; } }
    .nml-interaction { display: flex; flex-wrap: wrap; gap: 10px; }
    .nml-input { flex: 1 1 200px; padding: 10px 12px; font-size: 16px; border-radius: 8px;
      border: 1px solid #4a4366; background: #0d0a14; color: #e8e2f2; }
    .nml-submit, .nml-choice { padding: 10px 16px; font-size: 15px; cursor: pointer; border-radius: 8px;
      border: 1px solid #5b4b86; background: #2a2140; color: #e8e2f2; }
    .nml-submit:hover, .nml-choice:hover { background: #3a2f56; }
  `;
  document.head.appendChild(style);
}
