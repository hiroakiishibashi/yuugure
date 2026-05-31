/**
 * Supabase connection for the portal (hiroakiishibashi.com).
 *
 * The game is served same-origin under /games/yuugure/, so it shares the
 * site's Supabase auth session (same localStorage storage key). The anon key
 * is a public client key (already shipped in the site's JS). Values can be
 * overridden at build time via VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
 */
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://ddfhngfymavzsyktiuua.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkZmhuZ2Z5bWF2enN5a3RpdXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNDkwNjcsImV4cCI6MjA5NTcyNTA2N30.RpFVDxrHdsyZC2fe8RhbAPAzxLVd3au9G38csFE8sMg';

/** matches the portal's scores.game_id for this game */
export const GAME_ID = 'yuugure';
