/**
 * SpeechBubbles - The creature speaks in stacked speech bubbles above its head,
 * matching the original room view (LIVE! A1xx号室 …) rather than a bottom text
 * box. DOM-based, layered over the PixiJS canvas.
 *
 * Drop-in for the methods PixiHost called on the old TextBox (print/clear/skip/
 * showIndicator/isTyping/update) so the NML executor wiring is unchanged. Lines
 * appear whole (the original bubbles are not typed); the executor's pacing comes
 * from the following <click>/<blank>.
 */
export class SpeechBubbles {
  private readonly layer: HTMLElement;
  private readonly hint: HTMLElement;
  private static readonly MAX = 5;

  constructor(overlay: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'nml-bubbles';
    overlay.appendChild(this.layer);

    this.hint = document.createElement('div');
    this.hint.className = 'nml-bubble-hint';
    this.hint.textContent = '▼ クリック';
    this.hint.style.display = 'none';
    overlay.appendChild(this.hint);
  }

  /** Show each line of `text` as its own bubble (instant). */
  print(text: string, _cps: number): Promise<void> {
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (line) this.addBubble(line);
    }
    return Promise.resolve();
  }

  private addBubble(text: string): void {
    const bubble = document.createElement('div');
    bubble.className = 'nml-bubble';
    bubble.textContent = text;
    this.layer.appendChild(bubble);
    while (this.layer.childElementCount > SpeechBubbles.MAX) {
      this.layer.firstElementChild?.remove();
    }
  }

  clear(): void {
    this.layer.replaceChildren();
  }

  lineBreak(): void {
    /* lines already split into separate bubbles in print() */
  }

  skip(): void {
    /* bubbles appear whole — nothing to skip */
  }

  get isTyping(): boolean {
    return false;
  }

  showIndicator(show: boolean): void {
    this.hint.style.display = show ? 'block' : 'none';
  }

  update(_dtMs: number): void {
    /* no per-frame work; bubbles are static DOM */
  }
}
