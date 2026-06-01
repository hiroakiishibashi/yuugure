/**
 * GameController - The glue between the React UI and the engine/renderer.
 *
 * It owns the PixiHost (scene), a single NMLExecutor (so life/variables persist
 * across runs), and the ItemManager (inventory, fed by the NML <item> tag). It
 * exposes high-level actions the UI calls: play an NML scene, react to a blog
 * entry (the core "write → the character speaks" loop), place a room item, and
 * tear everything down on unmount.
 */

import { parseNML } from '../engine/nml/NMLParser';
import { NMLExecutor, type RunOptions } from '../engine/nml/NMLExecutor';
import { ItemManager } from '../engine/items/ItemManager';
import { PixiHost } from '../renderer/PixiHost';
import { blogToNML, reactToBlog } from './blogReactions';
import { ROOM_ITEMS, STARTER_ITEM_IDS, getRoomItem } from './roomItems';
import { HOME_CHARACTER_ID } from './characters';
import type { Resident } from './residents';
import { SaveService, type SaveData } from './SaveService';

const START_LIFE = 50;

export interface BlogPost {
  id: number;
  text: string;
  /** keyword the character reacted to, or null for a neutral reaction */
  matched: string | null;
}

export type PostsListener = (posts: BlogPost[]) => void;

/** Which "space" the top scene shows: standing outside among the doors, or
 *  inside a room (own or a visited one). The React shell cross-fades between
 *  the two with a sliding-door transition. */
export type SceneMode = 'inside' | 'outside';
export type ModeListener = (mode: SceneMode) => void;
export type EditListener = (editing: boolean) => void;

export class GameController {
  private readonly executor: NMLExecutor;
  private readonly saveService = new SaveService();
  private current: Promise<unknown> = Promise.resolve();
  private posts: BlogPost[] = [];
  private nextId = 1;
  private booted = false;
  /** the player's own creature (persisted) — distinct from whoever's room is on
   *  screen while visiting, so visiting never overwrites the player's save */
  private homeCharacterId = HOME_CHARACTER_ID;
  private readonly postListeners = new Set<PostsListener>();

  /** scene = inside a room vs. outside at the doors; edit = furniture rearrange */
  private mode: SceneMode = 'inside';
  private visiting = false; // inside someone else's room (no editing)
  private editMode = false;
  private readonly modeListeners = new Set<ModeListener>();
  private readonly editListeners = new Set<EditListener>();

  private constructor(
    readonly host: PixiHost,
    readonly items: ItemManager,
  ) {
    this.executor = new NMLExecutor(host);
    this.executor.life = START_LIFE;
    // seed the on-screen meter so it shows the starting value immediately
    host.changeLife({ value: START_LIFE, delta: 0, change: { kind: 'absolute', value: START_LIFE }, text: {} });
    // a few starter belongings so the room can be decorated right away
    for (const id of STARTER_ITEM_IDS) items.add(id);
    host.setRoomTitle('じぶんの　へや');
  }

  static async create(root: HTMLElement): Promise<GameController> {
    // Inventory catalogue = salvaged furniture (with art) + the NML "kagi" item.
    const catalogue: Record<string, { id: string; name: string; art?: string }> = {
      kagi: { id: 'kagi', name: 'カギ' },
    };
    for (const item of ROOM_ITEMS) catalogue[item.id] = { id: item.id, name: item.name, art: item.art };
    const items = new ItemManager(catalogue);
    const host = await PixiHost.create(root, { onItem: (type, action) => items.apply(type, action) });
    const controller = new GameController(host, items);
    await controller.boot();
    return controller;
  }

  /** Load the saved game (Supabase when signed in, else localStorage) and apply
   *  it over the seeded defaults; then start auto-persisting on change. */
  private async boot(): Promise<void> {
    const saved = await this.saveService.load();
    if (saved) this.applySave(saved);
    this.booted = true;
    // persist whenever the inventory changes (fires once now with current state)
    this.items.subscribe(() => this.persist());
  }

  get life(): number {
    return this.executor.life;
  }

  /** Whether saves sync to the account (vs. localStorage only). */
  get signedIn(): boolean {
    return this.saveService.signedIn;
  }

  // --- scene mode (inside a room ⇄ outside at the doors) ---

  get sceneMode(): SceneMode {
    return this.mode;
  }

  /** True while the room on screen is the player's own (furniture is editable). */
  get isOwnRoom(): boolean {
    return !this.visiting;
  }

  /** Whether furniture rearrange ("もようがえ") is currently on. */
  get editing(): boolean {
    return this.editMode;
  }

  subscribeMode(fn: ModeListener): () => void {
    this.modeListeners.add(fn);
    fn(this.mode);
    return () => {
      this.modeListeners.delete(fn);
    };
  }

  subscribeEdit(fn: EditListener): () => void {
    this.editListeners.add(fn);
    fn(this.editMode);
    return () => {
      this.editListeners.delete(fn);
    };
  }

  private setMode(mode: SceneMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    for (const fn of this.modeListeners) fn(mode);
  }

  /** Toggle furniture rearrange (only meaningful in the player's own room). */
  setEditMode(on: boolean): void {
    if (this.editMode === on) return;
    this.editMode = on;
    this.host.setRoomEditable(on);
    for (const fn of this.editListeners) fn(on);
  }

  /** Step out of the room, back to the apartment doors (with a transition). */
  goOutside(): void {
    this.setEditMode(false);
    this.setMode('outside');
  }

  /** Play an NML scene. Any in-progress scene is interrupted first. */
  async runNML(src: string, opts: RunOptions = {}): Promise<void> {
    this.host.cancelWait(); // interrupt + short-circuit any wait the old scene hits
    this.executor.stop();
    await this.current.catch(() => undefined);
    this.host.beginRun(); // re-enable real waits for the new scene
    this.current = this.executor.run(parseNML(src), { initialSpeed: 2, ...opts });
    await this.current;
  }

  /** The core loop: record the post and have the character speak its reaction. */
  async speakBlog(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    const reaction = reactToBlog(trimmed);
    this.addPost({ id: this.nextId++, text: trimmed, matched: reaction.matched });
    await this.runNML(blogToNML(trimmed));
    this.persist(); // capture the new post + any life change
  }

  /** A short greeting played when the room first opens (with a real backdrop). */
  async intro(): Promise<void> {
    await this.runNML(
      `<nml><anim idle>ようこそ　…　この　へやへ\nブログを　かくと　ぼくが　こたえるよ<click><end></nml>`,
    );
  }

  /** Place an inventory item on the room grid using its real pixel-art sprite. */
  placeItem(id: string, col: number, row: number): Promise<void> {
    const def = getRoomItem(id);
    return this.host.addRoomItem(def?.name ?? id, col, row, def?.art);
  }

  /** Enter another resident's room: switch to the inside scene, their creature
   *  appears, decorates with their furniture, and greets you. Transient — does
   *  NOT change the player's save, and furniture is read-only (no editing). */
  async enterRoom(resident: Resident): Promise<void> {
    this.visiting = true;
    this.setEditMode(false);
    this.setMode('inside');
    this.host.clearRoomItems();
    this.host.setCharacter(resident.characterId);
    this.host.setRoomTitle(`${resident.roomNo}号室　${resident.name}さんの へや`);
    this.host.setLive(true);
    (resident.items ?? []).forEach((id, i) => {
      const def = getRoomItem(id);
      void this.host.addRoomItem(def?.name ?? id, i % 5, Math.floor(i / 5) % 5, def?.art);
    });
    const body = resident.lines.join('\n');
    await this.runNML(`<nml><clear>${body}\n<anim idle><end></nml>`);
  }

  /** Return to the player's own room (inside scene). */
  goHome(): void {
    this.visiting = false;
    this.setMode('inside');
    this.host.cancelWait(); // stop any visited-room scene still typing
    this.host.clearRoomItems();
    this.host.clearText(); // drop the visited resident's leftover speech bubbles
    this.host.setCharacter(this.homeCharacterId);
    this.host.setRoomTitle('じぶんの　へや');
    this.host.setLive(false);
  }

  // --- blog feed ---

  getPosts(): BlogPost[] {
    return [...this.posts];
  }

  subscribePosts(fn: PostsListener): () => void {
    this.postListeners.add(fn);
    fn(this.getPosts());
    return () => {
      this.postListeners.delete(fn);
    };
  }

  private addPost(post: BlogPost): void {
    this.posts = [post, ...this.posts];
    this.notifyPosts();
  }

  private notifyPosts(): void {
    for (const fn of this.postListeners) fn(this.getPosts());
  }

  // --- persistence ---

  /** Apply a loaded save over the seeded defaults. */
  private applySave(s: SaveData): void {
    this.executor.life = s.life;
    this.host.changeLife({ value: s.life, delta: 0, change: { kind: 'absolute', value: s.life }, text: {} });
    this.executor.local.load(s.vars ?? {});
    this.items.loadCounts(s.inventory ?? {});
    this.posts = [...(s.posts ?? [])];
    this.nextId = this.posts.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    this.notifyPosts();
    this.homeCharacterId = s.character || HOME_CHARACTER_ID;
    this.host.setCharacter(this.homeCharacterId);
    this.host.setRoomTitle('じぶんの　へや');
    this.host.setLive(false);
  }

  /** Snapshot + queue a save (debounced). No-op until boot has restored state. */
  private persist(): void {
    if (!this.booted) return;
    const data: SaveData = {
      v: 1,
      life: this.executor.life,
      character: this.homeCharacterId, // the player's own creature, not a visited room's
      vars: this.executor.local.snapshot(),
      posts: this.posts,
      inventory: this.items.snapshot(),
    };
    this.saveService.save(data);
  }

  destroy(): void {
    void this.saveService.flush(); // push any pending save before tearing down
    this.executor.stop();
    this.host.cancelWait();
    this.host.destroy();
  }
}
