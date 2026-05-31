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
  private current: Promise<unknown> = Promise.resolve();
  private posts: BlogPost[] = [];
  private nextId = 1;
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
    return new GameController(host, items);
  }

  get life(): number {
    return this.executor.life;
  }

  /** Play an NML scene. Any in-progress scene is interrupted first. */
  async runNML(src: string, opts: RunOptions = {}): Promise<void> {
    this.host.cancelWait();
    this.executor.stop();
    await this.current.catch(() => undefined);
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
    for (const fn of this.postListeners) fn(this.getPosts());
  }

  destroy(): void {
    this.executor.stop();
    this.host.cancelWait();
    this.host.destroy();
  }
}
