/**
 * residents - Dummy "青空アパート" residents (other users' rooms).
 *
 * The original game is an apartment of outcasts (のけもの): you wander the
 * floors, open a door, and the resident creature greets you. Until the backend
 * has real users, these stand in — each maps to a salvaged creature and speaks
 * a short greeting when you enter. Room decoration items optional.
 *
 * Pure data (no PixiJS/React), so it is unit-testable.
 */

export interface Resident {
  /** room number, e.g. 'A501' */
  roomNo: string;
  /** floor (the 'A5xx' → 5) */
  floor: number;
  /** display name */
  name: string;
  /** creature living here (a salvaged character id) */
  characterId: string;
  /** the room/blog title shown on the door */
  title: string;
  /** lines the resident speaks when you enter */
  lines: string[];
  /** furniture placed in the room (roomItem ids) */
  items?: string[];
}

export const RESIDENTS: readonly Resident[] = [
  // --- 5F ---
  { roomNo: 'A501', floor: 5, name: 'いとう しろう', characterId: 'iwakurage', title: 'うみの おと', lines: ['ぼちぼち　でんなあ', 'また　きてや'], items: ['shelf', 'clock'] },
  { roomNo: 'A502', floor: 5, name: 'キダ タロー', characterId: 'daifuku', title: 'NMLの こばこ', lines: ['ようこそ', 'ゆっくり　していってや'], items: ['tv', 'stereo'] },
  { roomNo: 'A503', floor: 5, name: 'のがみ', characterId: 'nasu', title: 'よるの にっき', lines: ['…', 'しずかな　よるだね'], items: ['light'] },
  { roomNo: 'A504', floor: 5, name: 'すずな', characterId: 'warabi', title: 'はなの ひ', lines: ['きょうは　いい　てんき', 'はなが　さいたよ'], items: ['plant', 'chair'] },
  { roomNo: 'A505', floor: 5, name: 'とおる', characterId: 'toudai', title: 'みなとの ひ', lines: ['とおくを　みている', 'ふねが　とおる'], items: ['camera'] },
  { roomNo: 'A506', floor: 5, name: 'なまえなし', characterId: 'uragawa', title: '？？？', lines: ['…', '……', 'だれ'] },
  // --- 4F ---
  { roomNo: 'A401', floor: 4, name: 'もり', characterId: 'fusen', title: 'そらの きろく', lines: ['ふわふわ', 'とんで　いきたいな'], items: ['plushie'] },
  { roomNo: 'A402', floor: 4, name: 'しの', characterId: 'semi', title: 'なつの おと', lines: ['みんみん', 'なつは　まだ？'] },
  { roomNo: 'A403', floor: 4, name: 'くるみ', characterId: 'tofu', title: 'やわらかい ひ', lines: ['ふるふる', 'くずれちゃいそう'], items: ['microwave'] },
  { roomNo: 'A404', floor: 4, name: 'はやし', characterId: 'tsurigane', title: 'ゴーンと いちにち', lines: ['ごーん', 'じかんだよ'], items: ['clock'] },
  { roomNo: 'A405', floor: 4, name: 'あおい', characterId: 'yotsude', title: 'よっつの て', lines: ['いそがしい', 'てが　たりない'], items: ['record', 'tv'] },
  { roomNo: 'A406', floor: 4, name: 'ふどうさん', characterId: 'fudousan', title: 'あおぞら不動産', lines: ['いい へや　ありますよ', 'どうですか？'], items: ['shelf'] },
];

/** Floors present, highest first (matches the 上の階/下の階 navigation). */
export const RESIDENT_FLOORS: readonly number[] = [...new Set(RESIDENTS.map((r) => r.floor))].sort((a, b) => b - a);

export function residentsOnFloor(floor: number): Resident[] {
  return RESIDENTS.filter((r) => r.floor === floor);
}

export function getResident(roomNo: string): Resident | undefined {
  return RESIDENTS.find((r) => r.roomNo === roomNo);
}
