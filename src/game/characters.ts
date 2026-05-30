/**
 * characters - Registry of the original pixel-art "のけもの" creatures.
 *
 * Each entry maps to an animated GIF copied from the original game art
 * (original/method/夕暮れの部屋キャラクター, 200×200, transparent, pixel-art),
 * now served from public/characters/{id}.gif. Only idle animations survived as
 * GIFs (talk/glad/sad were in the Flash sources), so a character has one GIF;
 * mood is conveyed by a CSS filter in PixelCharacter rather than a separate clip.
 *
 * Pure data (no PixiJS/React), so it is unit-testable.
 */

export interface CharacterDef {
  id: string;
  /** display name (hiragana, matching the game's text style) */
  name: string;
  /** served path to the animated pixel-art GIF */
  gif: string;
}

/** name readings for the creature ids (cosmetic, hiragana). */
const NAMES: Record<string, string> = {
  anaboushi: 'あなぼうし',
  ashinaga: 'あしなが',
  binzume: 'びんづめ',
  bonbori: 'ぼんぼり',
  bou: 'ぼう',
  chazutsu: 'ちゃづつ',
  daifuku: 'だいふく',
  enbou: 'えんぼう',
  fusen: 'ふうせん',
  ganbunsan: 'がんぶんさん',
  hana: 'はな',
  hanedama: 'はねだま',
  inanaki: 'いななき',
  iwakurage: 'いわくらげ',
  momotsu: 'ももつ',
  muda: 'むだ',
  nageki: 'なげき',
  nagi: 'なぎ',
  nasu: 'なす',
  nuronuro: 'ぬろぬろ',
  okekamuri: 'おけかむり',
  semi: 'せみ',
  teme: 'てめ',
  tofu: 'とうふ',
  tokazuki: 'とかづき',
  tokkuri: 'とっくり',
  toudai: 'とうだい',
  tsurigane: 'つりがね',
  tsuruhashi: 'つるはし',
  uragawa: 'うらがわ',
  warabi: 'わらび',
  yotsude: 'よつで',
  yuragi: 'ゆらぎ',
};

/** Ids that have a GIF under public/characters/ (kept in sync with the asset copy). */
export const CHARACTER_IDS: readonly string[] = Object.keys(NAMES);

export const CHARACTERS: readonly CharacterDef[] = CHARACTER_IDS.map((id) => ({
  id,
  name: NAMES[id] ?? id,
  gif: `/characters/${id}.gif`,
}));

const BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

export function getCharacter(id: string): CharacterDef | undefined {
  return BY_ID.get(id);
}

/** The creature that greets the player in their own room. */
export const HOME_CHARACTER_ID = 'hana';

/**
 * Doors shown in the gallery — each is a different creature's room, realising
 * "部屋ごとにキャラが入れ替わる". A curated, varied subset.
 */
export const GALLERY_ROOM_IDS: readonly string[] = [
  'daifuku',
  'iwakurage',
  'nasu',
  'fusen',
  'tofu',
  'semi',
  'toudai',
  'tsurigane',
];
