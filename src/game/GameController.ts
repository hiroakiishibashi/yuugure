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
import { SaveService, type SaveData } from './SaveService';

const START_LIFE = 50;

export interface BlogPost {
  id: number;
  text: string;
  /** keyword the character reacted to, or null for a neutral reaction */
  matched: string | null;
}

export type PostsListener = (posts: BlogPost[]) => void;

export class GameController {
  private readonly executor: NMLExecutor;
  private readonly saveService = new SaveService();
  private current: Promise<unknown> = Promise.resolve();
  private posts: BlogPost[] = [];
  private nextId = 1;
  private booted = false;
  private readonly postListeners = new Set<PostsListener>();

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
      `<nml><image src="room/include/rouka.jpg" level="1" state="in" time="12">` +
        `<anim idle>ようこそ　…　この　へやへ\nブログを　かくと　ぼくが　こたえるよ<click><end></nml>`,
    );
  }

  /** Place an inventory item on the room grid using its real pixel-art sprite. */
  placeItem(id: string, col: number, row: number): Promise<void> {
    const def = getRoomItem(id);
    return this.host.addRoomItem(def?.name ?? id, col, row, def?.art);
  }

  /** Swap the on-screen creature (entering a different room). */
  setCharacter(id: string): void {
    this.host.setCharacter(id);
    this.persist();
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
    this.host.setCharacter(s.character || HOME_CHARACTER_ID);
  }

  /** Snapshot + queue a save (debounced). No-op until boot has restored state. */
  private persist(): void {
    if (!this.booted) return;
    const data: SaveData = {
      v: 1,
      life: this.executor.life,
      character: this.host.characterId,
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
