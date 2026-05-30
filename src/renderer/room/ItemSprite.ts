/**
 * ItemSprite - A single decoration item placed on the isometric room grid.
 * Wraps an arbitrary display object (a loaded sprite or an AssetResolver
 * placeholder) and remembers its grid cell for depth sorting.
 */

import { Container } from 'pixi.js';

export class ItemSprite {
  readonly view = new Container();

  constructor(
    public col: number,
    public row: number,
    display: Container,
  ) {
    this.view.addChild(display);
  }

  /** Painter's-order depth: larger draws on top (closer to the viewer). */
  get depth(): number {
    return this.col + this.row;
  }
}
