import { describe, it, expect } from 'vitest';
import { AnimationSystem, mapAnimName } from './AnimationSystem';

describe('mapAnimName', () => {
  it('maps 2010 spec keywords and numeric kinds', () => {
    expect(mapAnimName('idle')).toBe('idle');
    expect(mapAnimName('paku')).toBe('talk');
    expect(mapAnimName('glad')).toBe('glad');
    expect(mapAnimName('sad')).toBe('sad');
    expect(mapAnimName('2')).toBe('talk');
  });

  it('maps 2003 game values and falls back to idle for unknowns', () => {
    expect(mapAnimName('smile')).toBe('glad');
    expect(mapAnimName('false')).toBe('idle');
    expect(mapAnimName('memo')).toBe('idle');
    expect(mapAnimName('???')).toBe('idle');
  });
});

describe('AnimationSystem', () => {
  it('starts idle', () => {
    expect(new AnimationSystem().current).toBe('idle');
  });

  it('changing state resets the local clock; same state does not', () => {
    const anim = new AnimationSystem();
    anim.update(500);
    anim.setState('idle'); // unchanged
    // talk-frame at elapsed 0 has mouthOpen ~0.5 (sin(0)+1)/2
    anim.setState('talk');
    const f = anim.frameFor('talk', 0);
    expect(f.mouthOpen).toBeCloseTo(0.5, 6);
  });

  it('talk animation opens and closes the mouth over time', () => {
    const anim = new AnimationSystem();
    const opens = [0, 40, 80, 120].map((ms) => anim.frameFor('talk', ms).mouthOpen);
    expect(Math.max(...opens) - Math.min(...opens)).toBeGreaterThan(0.3);
  });

  it('glad hops upward (negative bob) and sad leans/desaturates', () => {
    const anim = new AnimationSystem();
    expect(anim.frameFor('glad', 200).bobY).toBeLessThanOrEqual(0);
    expect(anim.frameFor('glad', 200).tint).not.toBe(0xffffff);
    expect(anim.frameFor('sad', 200).tint).not.toBe(0xffffff);
  });

  it('idle keeps the mouth closed', () => {
    const anim = new AnimationSystem();
    expect(anim.frameFor('idle', 123).mouthOpen).toBe(0);
  });
});
