/**
 * ASSET_BASE - Path prefix for runtime-loaded assets (character GIFs, room art).
 *
 * It mirrors Vite's `base`, so runtime asset URLs resolve correctly whether the
 * game is served at the site root locally ('/') or under a subpath on the
 * portal ('/games/yuugure/game/'). Always ends with a trailing slash.
 */
export const ASSET_BASE = import.meta.env.BASE_URL;
