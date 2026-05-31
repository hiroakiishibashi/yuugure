/**
 * roomItems - Catalogue of room-decoration furniture, using the original
 * pixel-art item sprites salvaged from the full gdrive archive
 * (visual/room/item_*.png), served from public/assets/room-items/{id}.png.
 *
 * Pure data (no PixiJS/React), so it is unit-testable.
 */

export interface RoomItemDef {
  id: string;
  /** display name (hiragana/katakana) */
  name: string;
  /** served path to the pixel-art sprite */
  art: string;
}

const ITEMS: Array<[string, string]> = [
  ['tv', 'テレビ'],
  ['stereo', 'ステレオ'],
  ['video', 'ビデオ'],
  ['aircon', 'エアコン'],
  ['shelf', 'たな'],
  ['clock', 'とけい'],
  ['light', 'ライト'],
  ['camera', 'カメラ'],
  ['chair', 'いす'],
  ['record', 'レコード'],
  ['plant', 'しょくぶつ'],
  ['plushie', 'ぬいぐるみ'],
  ['birdcage', 'とりかご'],
  ['towel', 'タオル'],
  ['charm', 'おまもり'],
  ['microwave', 'でんしレンジ'],
];

export const ROOM_ITEMS: readonly RoomItemDef[] = ITEMS.map(([id, name]) => ({
  id,
  name,
  art: `/assets/room-items/${id}.png`,
}));

export const ROOM_ITEM_IDS: readonly string[] = ROOM_ITEMS.map((i) => i.id);

const BY_ID = new Map(ROOM_ITEMS.map((i) => [i.id, i]));

export function getRoomItem(id: string): RoomItemDef | undefined {
  return BY_ID.get(id);
}

/** A few belongings the player starts with, so the room can be decorated. */
export const STARTER_ITEM_IDS: readonly string[] = ['chair', 'clock', 'plushie', 'plant', 'light'];
