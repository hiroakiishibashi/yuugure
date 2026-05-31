/**
 * SaveService - Persistence for YUUGURE.
 *
 * Persists the whole game state (life/精神力, NML variables, blog posts,
 * inventory, current creature) so it survives reloads and follows the player
 * across devices when signed in.
 *
 * Two tiers, mirroring the portal's storage policy:
 *   - signed in  → Supabase `scores` row (game_id='yuugure', score=life,
 *     metadata=JSON save), upserted (debounced). The game runs same-origin under
 *     hiroakiishibashi.com/games/yuugure/, so it reads the site's existing auth
 *     session from localStorage automatically.
 *   - signed out → localStorage only (a gentle login prompt encourages syncing).
 *
 * Saves are always written to localStorage immediately and to Supabase on a
 * short debounce (fire-and-forget).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, GAME_ID } from './supabaseConfig';
import type { BlogPost } from './GameController';

export interface SaveData {
  v: 1;
  life: number;
  character: string;
  vars: Record<string, string>;
  posts: BlogPost[];
  inventory: Record<string, number>;
}

const LOCAL_KEY = 'yuugure_save_v1';
const DEBOUNCE_MS = 1500;

export class SaveService {
  private readonly supabase: SupabaseClient;
  private userId: string | null = null;
  private ready = false;
  private pending: SaveData | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true, // share the site's session storage
        autoRefreshToken: false, // the site's own client owns refreshing
      },
    });
  }

  /** Resolve the current signed-in user (from the shared session), if any. */
  async init(): Promise<void> {
    try {
      const { data } = await this.supabase.auth.getSession();
      this.userId = data.session?.user?.id ?? null;
    } catch {
      this.userId = null;
    }
    this.ready = true;
  }

  get signedIn(): boolean {
    return this.userId !== null;
  }

  /** Load the saved state: Supabase when signed in, else localStorage. */
  async load(): Promise<SaveData | null> {
    if (!this.ready) await this.init();
    if (this.userId) {
      try {
        const { data, error } = await this.supabase
          .from('scores')
          .select('metadata')
          .eq('user_id', this.userId)
          .eq('game_id', GAME_ID)
          .maybeSingle();
        if (!error && data?.metadata && (data.metadata as SaveData).v === 1) {
          return data.metadata as SaveData;
        }
      } catch {
        /* fall through to local */
      }
    }
    return readLocal();
  }

  /** Queue a save (debounced). localStorage is written immediately. */
  save(data: SaveData): void {
    writeLocal(data);
    this.pending = data;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
  }

  /** Push the pending save to Supabase now (no-op when signed out). */
  async flush(): Promise<void> {
    this.timer = null;
    const data = this.pending;
    this.pending = null;
    if (!data || !this.userId) return;
    try {
      await this.supabase
        .from('scores')
        .upsert({ user_id: this.userId, game_id: GAME_ID, score: data.life, metadata: data }, { onConflict: 'user_id,game_id' });
    } catch {
      /* localStorage already holds the latest; ignore network errors */
    }
  }
}

function readLocal(): SaveData | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveData;
    return parsed.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(data: SaveData): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    /* storage full / unavailable — ignore */
  }
}
