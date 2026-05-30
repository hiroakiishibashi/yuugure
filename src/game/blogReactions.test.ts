import { describe, it, expect } from 'vitest';
import { reactToBlog, blogToNML } from './blogReactions';
import { parseNML } from '../engine/nml/NMLParser';
import { NMLExecutor } from '../engine/nml/NMLExecutor';
import { RecordingHost } from '../engine/nml/hosts/RecordingHost';

describe('reactToBlog', () => {
  it('reacts gladly to positive keywords', () => {
    const r = reactToBlog('きょうは　とても　たのしい　いちにちだった');
    expect(r.anim).toBe('glad');
    expect(r.lifeDelta).toBeGreaterThan(0);
    expect(r.matched).toBe('たのしい');
  });

  it('reacts sadly to negative keywords', () => {
    const r = reactToBlog('なんだか　さみしい　よる');
    expect(r.anim).toBe('sad');
    expect(r.lifeDelta).toBeLessThan(0);
  });

  it('falls back to a neutral reaction', () => {
    const r = reactToBlog('ふつうの　いちにち');
    expect(r.matched).toBeNull();
    expect(r.anim).toBe('idle');
  });
});

describe('blogToNML', () => {
  it('produces a snippet the engine can play, and the character speaks it', async () => {
    const host = new RecordingHost();
    const nml = blogToNML('ありがとう、きみのおかげだよ');
    const result = await new NMLExecutor(host).run(parseNML(nml), { startLife: 50 });

    // the character spoke the glad response and gained life
    expect(host.transcript).toContain('きみが　わらうと');
    expect(host.events.some((e) => e.type === 'anim' && e.name === 'glad')).toBe(true);
    expect(result.life).toBe(60); // 50 + 10
    expect(result.ended).toBe(true);
  });

  it('omits a <life> change when the delta would be zero is not triggered for known rules', async () => {
    // sanity: negative reaction lowers life
    const host = new RecordingHost();
    const nml = blogToNML('つらい');
    const result = await new NMLExecutor(host).run(parseNML(nml), { startLife: 20 });
    expect(result.life).toBe(15); // 20 - 5
  });
});
