/**
 * Phase 2 demo entry — runs an embedded NML script through the engine and the
 * PixiJS host (PixiHost), exercising title/speed/typewriter, layered <image>,
 * character <anim> (idle/glad/sad), <life>/<lifetext>, free <input> + <get>
 * interpolation, an <option> menu, and goto/label/end.
 *
 * Real art/audio is not converted yet, so <image> shows a labelled placeholder
 * and the character is procedural (see renderer/assets + renderer/character).
 */

import { parseNML, validateNML, NMLExecutor } from './engine/nml';
import { PixiHost } from './renderer/PixiHost';

const DEMO_NML = `
<nml>
<title value="世界の終わり病棟">
<speed value="2">
<lifetext prefix="「心」が" up="あかるくなった" down="くらくなった" set="きまった">
<image src="room/include/haikyo.jpg" level="1" state="in" time="8">

<anim idle>
ここは　せかいの　おわりの　びょうとう
だれもいない　しずかな　へや
<click>
<clear>

あなたの　なまえを　おしえて
<input value="namae"></input>

<anim glad>
<get "namae">　…　いい　なまえだね
<life value="+20">
<click>
<clear>

きみは　どうして　ここに　きたの？
<option>
さがしものが　ある>>sagasu>>+10;
ただ　まよいこんだ>>mayou>>-10;
</option>

<label "sagasu">
<anim glad>
さがしもの　…　きっと　みつかるよ
<goto "owari">

<label "mayou">
<anim sad>
まよいこんだ　…　よくある　ことだね
<goto "owari">

<label "owari">
<life value="+15">
<anim idle>
<get "namae">　また　あおう
<click>
<end>
</nml>
`;

async function main(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app not found');

  const program = parseNML(DEMO_NML);
  const validation = validateNML(program);
  const issues = [...program.diagnostics, ...validation.diagnostics];
  if (issues.length > 0) {
    console.group('[NML] diagnostics');
    for (const d of issues) {
      console[d.severity === 'error' ? 'error' : 'warn'](
        `${d.severity}: ${d.message}` + (d.pos ? ` (line ${d.pos.line})` : ''),
      );
    }
    console.groupEnd();
  }

  const host = await PixiHost.create(app);
  const executor = new NMLExecutor(host);
  const result = await executor.run(program, { initialSpeed: 2, startLife: 40 });
  console.log('[NML] run finished', result);
}

main().catch((err) => console.error('[NML] fatal', err));
