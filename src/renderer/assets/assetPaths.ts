/**
 * assetPaths - Pure NML-asset path helpers (no PixiJS, so node-testable).
 *
 * NML references assets by a relative path rooted at the game folder, e.g.
 * `room/include/haikyo.jpg` or `room/include/dark_bgm.swf`. The future asset
 * pipeline (SWF → PNG/WebP, audio → MP3/OGG) will convert these and host them
 * under a base URL; these helpers compute the resolved URL and display key.
 */

export interface AssetPathOptions {
  /** base URL/path the converted assets are served from (default: none) */
  baseUrl?: string;
}

/** Normalise an NML src into a clean key (no leading slashes, no backslashes). */
export function assetKey(src: string): string {
  return src.trim().replace(/\\/g, '/').replace(/^\/+/, '');
}

/** Resolve an NML src to a loadable URL under the configured base. */
export function resolveAssetUrl(src: string, opts: AssetPathOptions = {}): string {
  const key = assetKey(src);
  const base = opts.baseUrl?.replace(/\/+$/, '');
  return base ? `${base}/${key}` : key;
}

/** Filename portion of an asset path (used to label placeholders). */
export function baseName(src: string): string {
  const key = assetKey(src);
  const i = key.lastIndexOf('/');
  return i >= 0 ? key.slice(i + 1) : key;
}

/** Lowercased file extension without the dot, or '' if none. */
export function extension(src: string): string {
  const name = baseName(src);
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

/** True for formats the original used that the web cannot show directly. */
export function needsConversion(src: string): boolean {
  return extension(src) === 'swf';
}
