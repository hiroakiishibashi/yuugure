import { describe, it, expect } from 'vitest';
import { parseNML } from './NMLParser';
import { NMLExecutor } from './NMLExecutor';
import { RecordingHost } from './hosts/RecordingHost';
import { GlobalState, InMemoryGlobalBackend } from '../state/GlobalState';

// Mirrors the control flow of original/samples/kagi_test.nml (UTF-8).
const KAGI = `
<nml>
<title value="タイトル">
<if name="user_login" value="true">
<goto "kagi_judge">
<else>
<goto "login_ng">
</if>
<label "kagi_judge">
<if name="_kagi" value="true">
<goto "login_ok_kagi">
<else>
<goto "login_ok">
</if>
<label "login_ng">
ログインしてからまたおいで
<end evaluate="false">
<label "login_ok">
カギあげまっせ
<item type="kagi" action="get">
<end>
<label "login_ok_kagi">
もうカギあげたでしょ
<end evaluate="false">
</nml>`;

describe('NMLExecutor — if / goto / label flow (kagi_test)', () => {
  it('logged-in without the key reaches login_ok and grants the item', async () => {
    const host = new RecordingHost();
    const result = await new NMLExecutor(host).run(parseNML(KAGI), {
      initialVars: { user_login: 'true' },
    });
    expect(host.transcript).toContain('カギあげまっせ');
    expect(host.transcript).not.toContain('ログインしてからまたおいで');
    expect(host.events).toContainEqual({ type: 'item', itemType: 'kagi', action: 'get' });
    expect(result.ended).toBe(true);
    expect(result.evaluate).toBe(true);
  });

  it('not logged in reaches login_ng and ends without evaluation', async () => {
    const host = new RecordingHost();
    const result = await new NMLExecutor(host).run(parseNML(KAGI), {
      initialVars: { user_login: 'false' },
    });
    expect(host.transcript).toContain('ログインしてからまたおいで');
    expect(host.transcript).not.toContain('カギあげまっせ');
    expect(result.evaluate).toBe(false);
  });

  it('logged-in with the key already taken reaches login_ok_kagi', async () => {
    const host = new RecordingHost();
    await new NMLExecutor(host).run(parseNML(KAGI), {
      initialVars: { user_login: 'true', _kagi: 'true' },
    });
    expect(host.transcript).toContain('もうカギあげたでしょ');
  });
});

describe('NMLExecutor — input / keyword routing', () => {
  const COLORS = `
    <nml>
    すきないろは
    <input value="iro">
    <key label="aka" value="あか">
    <key label="ao" value="あお">
    </input>
    <goto "owari">
    <label "aka">あかをえらんだ<goto "owari">
    <label "ao">あおをえらんだ<goto "owari">
    <label "owari"><end>
    </nml>`;

  it('routes to the label whose keyword matches the input', async () => {
    const host = new RecordingHost({ inputs: ['あお'] });
    await new NMLExecutor(host).run(parseNML(COLORS));
    expect(host.transcript).toContain('あおをえらんだ');
    expect(host.transcript).not.toContain('あかをえらんだ');
  });

  it('falls through when no keyword matches', async () => {
    const host = new RecordingHost({ inputs: ['みどり'] });
    await new NMLExecutor(host).run(parseNML(COLORS));
    expect(host.transcript).not.toContain('をえらんだ');
  });

  it('stores the typed value and interpolates it via <get>', async () => {
    const host = new RecordingHost({ inputs: ['アキ'] });
    const src = '<nml><input value="namae"></input><get "namae">　また　あおう<end></nml>';
    const result = await new NMLExecutor(host).run(parseNML(src));
    expect(result.vars.namae).toBe('アキ');
    expect(host.transcript).toContain('アキ');
    expect(host.transcript).toContain('また　あおう');
  });
});

describe('NMLExecutor — state & life', () => {
  it('writes global variables through to the backend', async () => {
    const backend = new InMemoryGlobalBackend();
    const host = new RecordingHost();
    const src = '<nml><set name="user_login" value="true" global="true"><end></nml>';
    const result = await new NMLExecutor(host, new GlobalState(backend)).run(parseNML(src));
    expect(result.vars.user_login).toBe('true');
    expect(backend.dump().user_login).toBe('true');
  });

  it('applies absolute, relative and range life changes', async () => {
    const host = new RecordingHost();
    const src = '<nml><life value="10"><life value="-3"><life value="0,5,+100"></nml>';
    const result = await new NMLExecutor(host).run(parseNML(src), { startLife: 0 });
    // 0 -> set 10 -> +(-3)=7 -> range clamp(7+100, 0..5)=5
    expect(result.life).toBe(5);
    const lifeEvents = host.events.filter((e) => e.type === 'life');
    expect(lifeEvents).toHaveLength(3);
  });

  it('a successful <login> marks user_login and persists it globally', async () => {
    const backend = new InMemoryGlobalBackend();
    const host = new RecordingHost({ loginOk: true });
    const src = '<nml><login name="u" passwd="p" autologin="true"><end></nml>';
    const result = await new NMLExecutor(host, new GlobalState(backend)).run(parseNML(src));
    expect(result.vars.user_login).toBe('true');
    expect(backend.dump().user_login).toBe('true');
  });
});

describe('NMLExecutor — option choices', () => {
  const OPT = `
    <nml>
    <option>
    すすむ>>tsugi>>-10;
    にげる>>nigeru>>0;
    </option>
    <label "tsugi">すすんだ<end>
    <label "nigeru">にげた<end>
    </nml>`;

  it('applies the power change and jumps to the chosen anchor', async () => {
    const host = new RecordingHost({ choices: [0] });
    const result = await new NMLExecutor(host).run(parseNML(OPT), { startLife: 50 });
    expect(host.transcript).toContain('すすんだ');
    expect(result.life).toBe(40);
  });

  it('can take the second choice', async () => {
    const host = new RecordingHost({ choices: [1] });
    const result = await new NMLExecutor(host).run(parseNML(OPT), { startLife: 50 });
    expect(host.transcript).toContain('にげた');
    expect(result.life).toBe(50);
  });
});

describe('NMLExecutor — pacing & ordering', () => {
  it('emits text/click/clear in source order', async () => {
    const host = new RecordingHost();
    await new NMLExecutor(host).run(parseNML('<nml>A<click><clear>B<end></nml>'));
    expect(host.eventTypes()).toEqual(['text', 'click', 'clear', 'text', 'end']);
  });
});
