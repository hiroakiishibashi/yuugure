/**
 * characters - Registry of the original pixel-art "のけもの" creatures, now
 * driven by the per-action animations salvaged from the Flash SWFs.
 *
 * Each creature has one animated GIF per available action under
 * public/characters/{id}_{action}.gif (idle, talk, and — for some — joy, sad,
 * angry, jump). Every creature has at least idle + talk (lip-sync). The set of
 * available actions per id comes from the auto-generated manifest.
 *
 * Pure data (no PixiJS/React), so it is unit-testable.
 */

import { CHARACTER_ACTIONS, type CharAction } from './characterManifest';
import { ASSET_BASE } from '../assetBase';

export interface CharacterDef {
  id: string;
  /** display name (hiragana, matching the game's text style) */
  name: string;
  /** actions that have a salvaged GIF (always includes 'idle' and 'talk') */
  actions: CharAction[];
}

/** Hiragana readings for the creature ids. */
const NAMES: Record<string, string> = {
  anaboushi: 'あなぼうし',
  ashinaga: 'あしなが',
  binzume: 'びんづめ',
  bonbori: 'ぼんぼり',
  bousan: 'ぼうさん',
  chazutsu: 'ちゃづつ',
  daifuku: 'だいふく',
  enbou: 'えんぼう',
  fudousan: 'ふどうさん',
  fusen: 'ふうせん',
  fuurinn: 'ふうりん',
  ganbunsan: 'がんぶんさん',
  hanedama: 'はねだま',
  inanaki: 'いななき',
  iwakurage: 'いわくらげ',
  muda: 'むだ',
  nageki: 'なげき',
  nagi: 'なぎ',
  nasu: 'なす',
  nuronuro: 'ぬろぬろ',
  okekamuri: 'おけかむり',
  semi: 'せみ',
  sinatora: 'しなとら',
  teme: 'てめ',
  tofu: 'とうふ',
  tokkuri: 'とっくり',
  toudai: 'とうだい',
  toukaduki: 'とうかづき',
  tsurigane: 'つりがね',
  uragawa: 'うらがわ',
  warabi: 'わらび',
  yotsude: 'よつで',
  yuragi: 'ゆらぎ',
};

export const CHARACTER_IDS: readonly string[] = Object.keys(CHARACTER_ACTIONS);

export const CHARACTERS: readonly CharacterDef[] = CHARACTER_IDS.map((id) => ({
  id,
  name: NAMES[id] ?? id,
  actions: CHARACTER_ACTIONS[id] ?? [],
}));

const BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

export function getCharacter(id: string): CharacterDef | undefined {
  return BY_ID.get(id);
}

export function hasAction(id: string, action: CharAction): boolean {
  return (CHARACTER_ACTIONS[id] ?? []).includes(action);
}

/** Served GIF for a creature's action, falling back to idle when absent. */
export function characterGif(id: string, action: CharAction = 'idle'): string {
  const use = hasAction(id, action) ? action : 'idle';
  return `${ASSET_BASE}characters/${id}_${use}.gif`;
}

/** The creature that greets the player in their own room (richest animation set). */
export const HOME_CHARACTER_ID = 'daifuku';

/**
 * Doors shown in the gallery — each is a different creature's room
 * ("部屋ごとにキャラが入れ替わる"). Favours creatures with expressive actions,
 * plus variety.
 */
export const GALLERY_ROOM_IDS: readonly string[] = [
  'daifuku',
  'enbou',
  'ashinaga',
  'nasu',
  'fudousan',
  'ganbunsan',
  'iwakurage',
  'tofu',
  'semi',
  'toudai',
  'tsurigane',
  'yotsude',
];
