import { describe, it, expect } from 'vitest';
import { Typewriter } from './Typewriter';
import { speedToCps, parseLifeValue } from './tags/TagSpec';

describe('Typewriter', () => {
  it('reveals characters progressively at the given cps', () => {
    const tw = new Typewriter({ cps: 10 }); // 10 chars/sec => 1 char / 100ms
    tw.start('あいうえお');
    expect(tw.visibleText).toBe('');
    expect(tw.tick(100)).toBe('あ');
    expect(tw.tick(100)).toBe('あい');
    expect(tw.tick(300)).toBe('あいうえお');
    expect(tw.isDone).toBe(true);
  });

  it('skip() reveals everything immediately', () => {
    const tw = new Typewriter({ cps: 1 });
    tw.start('ながいテキスト');
    tw.tick(100);
    tw.skip();
    expect(tw.visibleText).toBe('ながいテキスト');
    expect(tw.isDone).toBe(true);
  });

  it('cps Infinity reveals instantly on start', () => {
    const tw = new Typewriter({ cps: Infinity });
    tw.start('いっしゅん');
    expect(tw.isDone).toBe(true);
    expect(tw.tick(0)).toBe('いっしゅん');
  });

  it('an empty string is immediately done', () => {
    const tw = new Typewriter({ cps: 5 });
    tw.start('');
    expect(tw.isDone).toBe(true);
  });
});

describe('speedToCps', () => {
  it('fpc dialect: 0 or negative speed reveals instantly, positive is slower as it grows', () => {
    expect(speedToCps(0, { mode: 'fpc' })).toBe(Infinity);
    expect(speedToCps(-2, { mode: 'fpc' })).toBe(Infinity);
    expect(speedToCps(1, { mode: 'fpc', fps: 15 })).toBe(15); // 15fps / 1
    expect(speedToCps(3, { mode: 'fpc', fps: 15 })).toBe(5); // 15fps / 3
  });

  it('cpf dialect: speed is characters-per-frame', () => {
    expect(speedToCps(2, { mode: 'cpf', fps: 15 })).toBe(30);
  });
});

describe('parseLifeValue', () => {
  it('classifies absolute / relative / range', () => {
    expect(parseLifeValue('5')).toEqual({ kind: 'absolute', value: 5 });
    expect(parseLifeValue('+1')).toEqual({ kind: 'relative', delta: 1 });
    expect(parseLifeValue('-3')).toEqual({ kind: 'relative', delta: -3 });
    expect(parseLifeValue('0,10,-5')).toEqual({ kind: 'range', min: 0, max: 10, delta: -5 });
  });
});
