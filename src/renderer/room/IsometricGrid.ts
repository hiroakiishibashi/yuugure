/**
 * IsometricGrid - Pure 2:1 isometric coordinate math (no PixiJS imports, so it
 * is unit-testable in Node). Used by RoomRenderer/ItemSprite to place tiles and
 * items, and to depth-sort them.
 *
 *   grid (col, row) ──toScreen──▶ screen (x, y)
 *   screen (x, y)   ──toGrid───▶ grid (col, row)   (inverse)
 *
 * Standard diamond projection:
 *   x = originX + (col - row) * (tileW / 2)
 *   y = originY + (col + row) * (tileH / 2)
 */

export interface Point {
  x: number;
  y: number;
}

export interface Cell {
  col: number;
  row: number;
}

export class IsometricGrid {
  constructor(
    readonly tileW: number,
    readonly tileH: number,
    readonly originX = 0,
    readonly originY = 0,
  ) {}

  /** Grid cell → screen position of the tile's center. */
  toScreen(col: number, row: number): Point {
    return {
      x: this.originX + (col - row) * (this.tileW / 2),
      y: this.originY + (col + row) * (this.tileH / 2),
    };
  }

  /** Screen position → fractional grid cell (inverse of toScreen). */
  toGrid(x: number, y: number): { col: number; row: number } {
    const dx = (x - this.originX) / (this.tileW / 2);
    const dy = (y - this.originY) / (this.tileH / 2);
    return {
      col: (dx + dy) / 2,
      row: (dy - dx) / 2,
    };
  }

  /** Screen position → nearest integer grid cell. */
  toCell(x: number, y: number): Cell {
    const g = this.toGrid(x, y);
    return { col: Math.round(g.col), row: Math.round(g.row) };
  }

  /** Painter's-order depth: farther tiles (smaller col+row) draw first. */
  depth(col: number, row: number): number {
    return col + row;
  }

  /** The four corner points of a tile's diamond, for drawing the floor. */
  tilePolygon(col: number, row: number): Point[] {
    const c = this.toScreen(col, row);
    const hw = this.tileW / 2;
    const hh = this.tileH / 2;
    return [
      { x: c.x, y: c.y - hh }, // top
      { x: c.x + hw, y: c.y }, // right
      { x: c.x, y: c.y + hh }, // bottom
      { x: c.x - hw, y: c.y }, // left
    ];
  }
}
