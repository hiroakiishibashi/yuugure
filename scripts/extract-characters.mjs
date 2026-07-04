/**
 * Salvage per-action character animations from the original Flash SWFs.
 *
 * For each nokemono_fla/*.swf:
 *   1. ffdec -dumpSWF  -> parse FrameLabel -> sprite-chid map
 *   2. ffdec -export sprite -> per-sprite 200x200 transparent PNG sequences
 *   3. ffmpeg -> one transparent 15fps GIF per wanted action
 *      -> public/characters/{id}_{action}.gif
 * Emits src/game/characterManifest.ts describing which actions each id has.
 *
 * Run: node .tools/extract-characters.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync, cpSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const ROOT = resolve('/Volumes/PINK/Development/YUUGURE');
const JAVA = '/opt/homebrew/opt/openjdk/bin/java';
const FFDEC = `${ROOT}/.tools/ffdec/ffdec-cli.jar`;
const SWF_DIR = `${ROOT}/original/method/nokemono_fla`;
const OUT = `${ROOT}/public/characters`;
const TMP = `${ROOT}/.tools/_work`;
const FPS = 15;

// action -> ordered list of acceptable frame-label names (first match wins)
const ACTIONS = {
  idle: ['idoling1', 'idoling', 'idling', 'idol'],
  talk: ['talk1', 'talk', 'paku'],
  joy: ['joy', 'glad', 'warai', 'ureshii', 'smile'],
  sad: ['sad', 'naki', 'kanashii'],
  angry: ['angry', 'ikari', 'okoru'],
  jump: ['jump', 'jump2'],
};

// Frame labels that are ActionScript/logic markers, not animations.
const EXCLUDE = new Set(['true', 'false']);
// Friendlier filenames for salvaged "extra" animations beyond the 6 canonical.
const EXTRA_RENAME = { idoling2: 'idle2', idoling3: 'idle3', kaiten: 'spin', kaiten2: 'spin' };
const normExtra = (l) => EXTRA_RENAME[l] ?? l;

mkdirSync(OUT, { recursive: true });
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

function ffdec(args) {
  return execFileSync(JAVA, ['-jar', FFDEC, ...args], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 });
}

/** parse a dumpSWF text -> { labelToChid: {label: chid}, spriteChids:Set } */
function parseDump(text) {
  const lines = text.split('\n');
  const spriteChids = new Set();
  for (const ln of lines) {
    const m = ln.match(/DefineSprite \(chid: (\d+)\)/);
    if (m) spriteChids.add(+m[1]);
  }
  const labelLines = [];
  lines.forEach((ln, i) => {
    const m = ln.match(/FrameLabel \(name: "([^"]+)"\)/);
    if (m) labelLines.push({ name: m[1].toLowerCase(), line: i });
  });
  labelLines.push({ name: '__end__', line: lines.length });
  const labelToChid = {};
  for (let k = 0; k < labelLines.length - 1; k++) {
    const seg = lines.slice(labelLines[k].line, labelLines[k + 1].line);
    for (const ln of seg) {
      const p = ln.match(/PlaceObject2 \(chid: (\d+)/);
      if (p && spriteChids.has(+p[1])) {
        labelToChid[labelLines[k].name] = +p[1];
        break;
      }
    }
  }
  return { labelToChid, spriteChids };
}

function buildGif(framesDir, outFile) {
  const pngs = readdirSync(framesDir).filter((f) => f.endsWith('.png'));
  if (pngs.length === 0) return false;
  execFileSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error', '-framerate', String(FPS),
      '-i', `${framesDir}/%d.png`,
      '-vf', 'split[a][b];[a]palettegen=reserve_transparent=1:stats_mode=full[p];[b][p]paletteuse=alpha_threshold=128',
      '-loop', '0', outFile,
    ],
    { stdio: 'ignore' },
  );
  return existsSync(outFile);
}

const manifest = {};
const extrasManifest = {};
const swfs = readdirSync(SWF_DIR).filter((f) => f.endsWith('.swf')).sort();
console.log(`Processing ${swfs.length} SWFs...`);

for (const swf of swfs) {
  const id = basename(swf, '.swf');
  const swfPath = `${SWF_DIR}/${swf}`;
  try {
    const dump = ffdec(['-dumpSWF', swfPath]).toString('utf8');
    const { labelToChid } = parseDump(dump);
    const labels = Object.keys(labelToChid);

    const spriteDir = `${TMP}/${id}`;
    rmSync(spriteDir, { recursive: true, force: true });
    ffdec(['-format', 'sprite:png', '-export', 'sprite', spriteDir, swfPath]);

    const got = [];
    const consumed = new Set();
    for (const [action, names] of Object.entries(ACTIONS)) {
      const label = names.find((n) => labels.includes(n));
      if (!label) continue;
      consumed.add(label);
      const chid = labelToChid[label];
      const framesDir = `${spriteDir}/DefineSprite_${chid}`;
      if (!existsSync(framesDir)) continue;
      if (buildGif(framesDir, `${OUT}/${id}_${action}.gif`)) got.push(action);
    }
    // Salvage every remaining animation label as an "extra" GIF so nothing from
    // the original SWFs is left behind (alternate idles/talks, creature quirks).
    const extras = [];
    for (const label of labels) {
      if (consumed.has(label) || EXCLUDE.has(label)) continue;
      const chid = labelToChid[label];
      const framesDir = `${spriteDir}/DefineSprite_${chid}`;
      if (!existsSync(framesDir)) continue;
      const name = normExtra(label);
      if (extras.includes(name)) continue; // avoid dup (e.g. kaiten/kaiten2 -> spin)
      if (buildGif(framesDir, `${OUT}/${id}_${name}.gif`)) extras.push(name);
    }
    manifest[id] = got;
    extrasManifest[id] = extras;
    rmSync(spriteDir, { recursive: true, force: true });
    console.log(`${id}: [${got.join(', ')}]  +extra[${extras.join(', ')}]`);
  } catch (e) {
    console.log(`${id}: ERROR ${String(e).slice(0, 120)}`);
    manifest[id] = [];
  }
}

// Emit a TS manifest the registry can import.
const ts = `/** AUTO-GENERATED by scripts/extract-characters.mjs — per-character actions
 * salvaged from the original Flash SWFs. Do not edit by hand. */
export type CharAction = 'idle' | 'talk' | 'joy' | 'sad' | 'angry' | 'jump';
export const CHARACTER_ACTIONS: Record<string, CharAction[]> = ${JSON.stringify(manifest, null, 2)};

/** Extra per-character animations also salvaged from the SWFs — alternate
 * idles/lip-talks (idle2/talk2/idle3/talk3) and creature-specific flourishes
 * (berori, chonmage, furiko, spin, memo, …). Each has a GIF at
 * public/characters/{id}_{extra}.gif. Not yet wired into gameplay states;
 * available for future use (e.g. idle variety, reactions). */
export const CHARACTER_EXTRA_ACTIONS: Record<string, string[]> = ${JSON.stringify(extrasManifest, null, 2)};
`;
writeFileSync(`${ROOT}/src/game/characterManifest.ts`, ts);
rmSync(TMP, { recursive: true, force: true });

const withTalk = Object.values(manifest).filter((a) => a.includes('talk')).length;
const withJoy = Object.values(manifest).filter((a) => a.includes('joy')).length;
const withSad = Object.values(manifest).filter((a) => a.includes('sad')).length;
console.log(`\nDONE. ids=${Object.keys(manifest).length}  talk=${withTalk} joy=${withJoy} sad=${withSad}`);
console.log(`Manifest -> src/game/characterManifest.ts`);
