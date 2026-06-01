/**
 * RoomRenderer - The isometric room floor + depth-sorted, draggable furniture.
 *
 * The player can place items (placeItem) and then drag them around the floor;
 * on drop the item snaps to the nearest grid cell and the scene re-sorts by
 * depth. Depth sorting is manual (re-append in depth order) for predictability.
 */

import { Container, Graphics, type FederatedPointerEvent } from 'pixi.js';
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
  private stage: Container | null = null;
  private dragging: ItemSprite | null = null;

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
          .fill({ color: checker ? 0x274a6e : 0x21405f, alpha: 0.5 })
          .stroke({ width: 1, color: 0x5a86b8, alpha: 0.25 });
      }
    }
  }

  /** Provide the stage so dragged items can track the pointer globally. */
  attachDrag(stage: Container): void {
    this.stage = stage;
  }

  /** Place a display object at a grid cell; it becomes draggable. */
  placeItem(display: Container, col: number, row: number): ItemSprite {
    const item = new ItemSprite(col, row, display);
    const p = this.grid.toScreen(col, row);
    item.view.position.set(p.x, p.y);
    item.view.eventMode = 'static';
    item.view.cursor = 'grab';
    item.view.on('pointerdown', (e: FederatedPointerEvent) => this.startDrag(item, e));
    this.items.push(item);
    this.resort();
    return item;
  }

  private startDrag(item: ItemSprite, _e: FederatedPointerEvent): void {
    if (!this.stage || this.dragging) return;
    this.dragging = item;
    item.view.cursor = 'grabbing';
    item.view.alpha = 0.75;

    const onMove = (ev: FederatedPointerEvent): void => {
      const local = this.view.toLocal(ev.global);
      item.view.position.set(local.x, local.y);
    };
    const onEnd = (): void => {
      this.stage?.off('pointermove', onMove);
      this.stage?.off('pointerup', onEnd);
      this.stage?.off('pointerupoutside', onEnd);
      const cell = this.grid.toCell(item.view.x, item.view.y);
      item.col = clamp(cell.col, 0, this.cols - 1);
      item.row = clamp(cell.row, 0, this.rows - 1);
      const snap = this.grid.toScreen(item.col, item.row);
      item.view.position.set(snap.x, snap.y);
      item.view.cursor = 'grab';
      item.view.alpha = 1;
      this.dragging = null;
      this.resort();
    };

    this.stage.on('pointermove', onMove);
    this.stage.on('pointerup', onEnd);
    this.stage.on('pointerupoutside', onEnd);
  }

  /** Remove all placed items (e.g. when switching rooms). */
  clearItems(): void {
    this.itemsLayer.removeChildren();
    this.items.length = 0;
    this.dragging = null;
  }

  /** Re-append item views in ascending depth so nearer items draw last (on top). */
  private resort(): void {
    this.itemsLayer.removeChildren();
    for (const item of [...this.items].sort((a, b) => a.depth - b.depth)) {
      this.itemsLayer.addChild(item.view);
    }
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
