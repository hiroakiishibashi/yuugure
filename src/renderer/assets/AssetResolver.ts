/**
 * AssetResolver - Turns an NML asset `src` into a PixiJS display object.
 *
 * The original art/audio (SWF, JPG) has not been converted yet, so by default
 * this resolver runs in PLACEHOLDER mode: it never hits the network (keeping the
 * console clean) and returns a labelled placeholder showing the asset's name.
 * When the asset pipeline lands, construct it with `{ tryLoad: true, baseUrl }`
 * and real images will be loaded via Assets.load, with the placeholder as a
 * graceful fallback on failure.
 */

import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { baseName, needsConversion, resolveAssetUrl, type AssetPathOptions } from './assetPaths';

export interface AssetResolverOptions extends AssetPathOptions {
  /** attempt real network loads (default false until assets are converted) */
  tryLoad?: boolean;
  /** placeholder box size */
  width?: number;
  height?: number;
}

export class AssetResolver {
  constructor(private readonly opts: AssetResolverOptions = {}) {}

  /** Resolve `src` to a display object centred on its own origin (0,0). */
  async load(src: string): Promise<Container> {
    if (this.opts.tryLoad && !needsConversion(src)) {
      try {
        const texture = await Assets.load(resolveAssetUrl(src, this.opts));
        const sprite = new Sprite(texture);
        sprite.anchor.set(0.5);
        return sprite;
      } catch {
        /* fall through to placeholder */
      }
    }
    return this.placeholder(src);
  }

  /** A labelled placeholder graphic standing in for a not-yet-converted asset. */
  placeholder(src: string): Container {
    const w = this.opts.width ?? 320;
    const h = this.opts.height ?? 200;
    const box = new Container();

    const bg = new Graphics();
    bg.roundRect(-w / 2, -h / 2, w, h, 14)
      .fill({ color: 0x1b1726, alpha: 0.92 })
      .stroke({ width: 1.5, color: 0x5b4b86, alpha: 0.9 });
    // a faint diagonal to read clearly as a placeholder
    bg.moveTo(-w / 2, -h / 2)
      .lineTo(w / 2, h / 2)
      .stroke({ width: 1, color: 0x3a3350, alpha: 0.5 });
    box.addChild(bg);

    const label = new Text({
      text: `🖼 ${baseName(src)}`,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 15, fill: 0x9a8fb8, align: 'center' },
    });
    label.anchor.set(0.5);
    box.addChild(label);

    return box;
  }
}
