import { describe, it, expect } from 'vitest';
import { IsometricGrid } from './IsometricGrid';

describe('IsometricGrid', () => {
  const grid = new IsometricGrid(64, 32, 400, 100);

  it('projects the origin cell to the origin point', () => {
    expect(grid.toScreen(0, 0)).toEqual({ x: 400, y: 100 });
  });

  it('moves +col to the lower-right and +row to the lower-left', () => {
    expect(grid.toScreen(1, 0)).toEqual({ x: 432, y: 116 }); // right + down
    expect(grid.toScreen(0, 1)).toEqual({ x: 368, y: 116 }); // left + down
  });

  it('toGrid is the inverse of toScreen', () => {
    for (const [col, row] of [
      [0, 0],
      [3, 5],
      [7, 2],
      [10, 10],
    ] as const) {
      const p = grid.toScreen(col, row);
      const g = grid.toGrid(p.x, p.y);
      expect(g.col).toBeCloseTo(col, 6);
      expect(g.row).toBeCloseTo(row, 6);
    }
  });

  it('snaps a screen point to the nearest cell', () => {
    const p = grid.toScreen(4, 6);
    expect(grid.toCell(p.x + 3, p.y - 2)).toEqual({ col: 4, row: 6 });
  });

  it('orders depth by col+row', () => {
    expect(grid.depth(0, 0)).toBeLessThan(grid.depth(1, 0));
    expect(grid.depth(2, 3)).toBe(grid.depth(3, 2));
  });

  it('produces a 4-corner diamond for a tile', () => {
    const poly = grid.tilePolygon(0, 0);
    expect(poly).toEqual([
      { x: 400, y: 84 },
      { x: 432, y: 100 },
      { x: 400, y: 116 },
      { x: 368, y: 100 },
    ]);
  });
});
