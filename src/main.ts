/**
 * Phase 1 demo entry — runs an embedded NML script end-to-end in the browser
 * using the engine (parser → validator → executor) and the DOM host.
 *
 * The original .nml scripts live under original/ (Shift-JIS, gitignored), so
 * this demo embeds a small UTF-8 script that exercises the core tags:
 * title/speed/text/click/clear, set, if/else, life, free <input>, <input>+<key>
 * keyword routing, and goto/label/end.
 */

import { parseNML, validateNML, NMLExecutor } from './engine/nml';
import { DomHost } from './renderer/ui/DomHost';

const DEMO_NML = `
<nml>
<title value="世界の終わり病棟">
<speed value="2">

ここは　せかいの　おわりの　びょうとう
だれもいない　しずかな　へや
<click>
<clear>

あなたの　なまえを　おしえて
<input value="namae"></input>

<get "namae">　…　いい　なまえだね
<click>
<clear>

<set name="flag_first" value="true">
<if name="flag_first" value="true">
はじめて　あった　きが　する
<else>
また　あえたね
</if>
<life value="+1">
<click>
<clear>

すきな　いろは　なに？
<input value="iro">
<key label="aka" value="あか">
<key label="ao" value="あお">
</input>
<goto "owari">

<label "aka">
あか　…　じょうねつの　いろだね
<goto "owari">

<label "ao">
あお　…　しずかで　きれいな　いろ
<goto "owari">

<label "owari">
<life value="+5">
<get "namae">　また　あおう
<click>
<end>
</nml>
`;

function main(): void {
  const app = document.getElementById('app');
  if (!app) throw new Error('#app not found');

  const program = parseNML(DEMO_NML);
  const result = validateNML(program);
  if (result.diagnostics.length > 0) {
    console.group('[NML] diagnostics');
    for (const d of [...program.diagnostics, ...result.diagnostics]) {
      console[d.severity === 'error' ? 'error' : 'warn'](
        `${d.severity}: ${d.message}` + (d.pos ? ` (line ${d.pos.line})` : ''),
      );
    }
    console.groupEnd();
  }

  const host = new DomHost(app);
  const executor = new NMLExecutor(host);
  executor
    .run(program, { initialSpeed: 2 })
    .then((r) => console.log('[NML] run finished', r))
    .catch((err) => console.error('[NML] run failed', err));
}

main();
