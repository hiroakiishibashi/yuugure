/**
 * GlobalState - Server-persisted NML variables (`<set ... global="true">`).
 *
 * The original game stored some variables (login state, item flags, evaluation
 * counters) on the server. Here that is abstracted behind GlobalStateBackend so
 * Phase 1 can run fully in-memory and Phase 4 can drop in a Supabase-backed
 * implementation without touching the engine.
 *
 * A small synchronous cache lets <if>/<get> read global values that were
 * preloaded at script start, while writes go through to the backend.
 */

export interface GlobalStateBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** Default backend for development and tests. */
export class InMemoryGlobalBackend implements GlobalStateBackend {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  /** Inspection helper for tests. */
  dump(): Record<string, string> {
    return Object.fromEntries(this.store);
  }
}

export class GlobalState {
  private readonly cache = new Map<string, string>();

  constructor(private readonly backend: GlobalStateBackend = new InMemoryGlobalBackend()) {}

  /** Warm the cache so <if>/<get> can read these synchronously during a run. */
  async preload(keys: string[]): Promise<Record<string, string>> {
    await Promise.all(
      keys.map(async (k) => {
        const v = await this.backend.get(k);
        if (v !== null) this.cache.set(k, v);
      }),
    );
    return Object.fromEntries(this.cache);
  }

  getCached(key: string): string | undefined {
    return this.cache.get(key);
  }

  async get(key: string): Promise<string | null> {
    if (this.cache.has(key)) return this.cache.get(key)!;
    const v = await this.backend.get(key);
    if (v !== null) this.cache.set(key, v);
    return v;
  }

  async set(key: string, value: string): Promise<void> {
    this.cache.set(key, value);
    await this.backend.set(key, value);
  }
}
