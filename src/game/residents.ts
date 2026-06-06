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
  { roomNo: 'A501', floor: 5, name: 'いとう しろう', characterId: 'iwakurage', title: 'うみの おと', lines: ['ぼちぼち　でんなあ', 'また　きてや'], items: ['item_014_tana', 'item_013_tokei', 'item_019_zasshi'] },
  { roomNo: 'A502', floor: 5, name: 'キダ タロー', characterId: 'daifuku', title: 'NMLの こばこ', lines: ['ようこそ', 'ゆっくり　していってや'], items: ['item_014_TV', 'item_014_stereo', 'item_014_video'] },
  { roomNo: 'A503', floor: 5, name: 'のがみ', characterId: 'nasu', title: 'よるの にっき', lines: ['…', 'しずかな　よるだね'], items: ['item_015_light', 'item_010_denwa'] },
  { roomNo: 'A504', floor: 5, name: 'すずな', characterId: 'warabi', title: 'はなの ひ', lines: ['きょうは　いい　てんき', 'はなが　さいたよ'], items: ['item_004_kanyoshokubutu', 'item_000_isu', 'item_003_fuusha'] },
  { roomNo: 'A505', floor: 5, name: 'とおる', characterId: 'toudai', title: 'みなとの ひ', lines: ['とおくを　みている', 'ふねが　とおる'], items: ['item_015_camera', 'item_009_shasin'] },
  { roomNo: 'A506', floor: 5, name: 'なまえなし', characterId: 'uragawa', title: '？？？', lines: ['…', '……', 'だれ'], items: ['item_019_gomibako', 'item_002_akikan'] },
  // --- 4F ---
  { roomNo: 'A401', floor: 4, name: 'もり', characterId: 'fusen', title: 'そらの きろく', lines: ['ふわふわ', 'とんで　いきたいな'], items: ['item_002_nuigurumi', 'item_008_orange'] },
  { roomNo: 'A402', floor: 4, name: 'しの', characterId: 'semi', title: 'なつの おと', lines: ['みんみん', 'なつは　まだ？'], items: ['item_006_taoru'] },
  { roomNo: 'A403', floor: 4, name: 'くるみ', characterId: 'tofu', title: 'やわらかい ひ', lines: ['ふるふる', 'くずれちゃいそう'], items: ['item_001_denshirenji', 'item_013_chawan'] },
  { roomNo: 'A404', floor: 4, name: 'はやし', characterId: 'tsurigane', title: 'ゴーンと いちにち', lines: ['ごーん', 'じかんだよ'], items: ['item_008_tokei', 'item_012_chousinki'] },
  { roomNo: 'A405', floor: 4, name: 'あおい', characterId: 'yotsude', title: 'よっつの て', lines: ['いそがしい', 'てが　たりない'], items: ['item_004_record', 'item_014_TV', 'item_004_DJ'] },
  { roomNo: 'A406', floor: 4, name: 'ふどうさん', characterId: 'fudousan', title: 'あおぞら不動産', lines: ['いい へや　ありますよ', 'どうですか？'], items: ['item_000_tana', 'item_000_karute'] },
  // --- 1F (mirrors the old room screenshot's A105 live-room feel) ---
  { roomNo: 'A101', floor: 1, name: 'かどた', characterId: 'ashinaga', title: 'ながい かげ', lines: ['ここは　すずしいよ', 'かげが　のびてる'], items: ['item_009_closet', 'item_009_hanger', 'item_009_skirf'] },
  { roomNo: 'A102', floor: 1, name: 'みずの', characterId: 'nuronuro', title: 'ぬるい 水', lines: ['ぬるぬる　してる', 'さわる？'], items: ['item_006_senmenki', 'item_006_shanpu', 'item_006_rinsu'] },
  { roomNo: 'A103', floor: 1, name: 'みやた', characterId: 'okekamuri', title: 'からっぽ', lines: ['なかは　からっぽ', 'でも　あたたかい'], items: ['item_010_hako', 'item_019_magazinebox'] },
  { roomNo: 'A104', floor: 1, name: 'ふるや', characterId: 'ganbunsan', title: '目の きろく', lines: ['みえてるよ', 'たぶんね'], items: ['item_007_megane', 'item_007_megusuri', 'item_010_kagami'] },
  { roomNo: 'A105', floor: 1, name: '伊東四郎', characterId: 'binzume', title: 'ひきよせ現象', lines: ['ぼそぼそ　きこえた？', 'わはははは'], items: ['item_000_tana', 'item_011_hondana', 'item_014_aircon'] },
  { roomNo: 'A106', floor: 1, name: 'まどか', characterId: 'bonbori', title: 'あかりの へや', lines: ['あかりを　けさないで', 'よるが　くるから'], items: ['item_008_lamp', 'item_015_light', 'item_005_kinkakuji'] },
];

/** Floors present, highest first (matches the 上の階/下の階 navigation). */
export const RESIDENT_FLOORS: readonly number[] = [...new Set(RESIDENTS.map((r) => r.floor))].sort((a, b) => b - a);

export function residentsOnFloor(floor: number): Resident[] {
  return RESIDENTS.filter((r) => r.floor === floor);
}

export function getResident(roomNo: string): Resident | undefined {
  return RESIDENTS.find((r) => r.roomNo === roomNo);
}
