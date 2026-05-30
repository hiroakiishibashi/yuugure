/**
 * RoomRenderer - Draws the isometric room floor and holds depth-sorted items.
 * The foundation for the room-decoration gameplay (placing items is Phase 3 UI);
 * here it renders the grid and exposes placeItem() with correct draw order.
 *
 * Depth sorting is done manually (re-appending children in depth order) rather
 * than via zIndex/sortableChildren, to keep behaviour explicit and predictable.
 */

import { Container, Graphics } from 'pixi.js';
import { IsometricGrid } from './IsometricGrid';
import { ItemSprite } from './ItemSprite';

export interface RoomOptions {
  cols?: number;
  rows?: number;
  tileW?: number;
  tileH?: number;
  originX?: number;
  originY?: number;
}

export class RoomRenderer {
  readonly view = new Container();
  readonly grid: IsometricGrid;

  private readonly floor = new Graphics();
  private readonly itemsLayer = new Container();
  private readonly items: ItemSprite[] = [];
  private readonly cols: number;
  private readonly rows: number;

  constructor(opts: RoomOptions = {}) {
    this.cols = opts.cols ?? 8;
    this.rows = opts.rows ?? 8;
    this.grid = new IsometricGrid(opts.tileW ?? 64, opts.tileH ?? 32, opts.originX ?? 0, opts.originY ?? 0);
    this.view.addChild(this.floor, this.itemsLayer);
    this.drawFloor();
  }

  private drawFloor(): void {
    this.floor.clear();
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const poly = this.grid.tilePolygon(col, row).flatMap((p) => [p.x, p.y]);
        const checker = (col + row) % 2 === 0;
        this.floor
          .poly(poly)
          .fill({ color: checker ? 0x241f33 : 0x1d1929, alpha: 1 })
          .stroke({ width: 1, color: 0x3a3350, alpha: 0.6 });
      }
    }
  }

  /** Place a display object at a grid cell and keep draw order correct. */
  placeItem(display: Container, col: number, row: number): ItemSprite {
    const item = new ItemSprite(col, row, display);
    const p = this.grid.toScreen(col, row);
    item.view.position.set(p.x, p.y);
    this.items.push(item);
    this.resort();
    return item;
  }

  /** Re-append item views in ascending depth so nearer items draw last (on top). */
  private resort(): void {
    this.itemsLayer.removeChildren();
    for (const item of [...this.items].sort((a, b) => a.depth - b.depth)) {
      this.itemsLayer.addChild(item.view);
    }
  }
}
