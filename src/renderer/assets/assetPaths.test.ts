import { describe, it, expect } from 'vitest';
import { assetKey, resolveAssetUrl, baseName, extension, needsConversion } from './assetPaths';

describe('assetPaths', () => {
  it('normalises keys (strips leading slashes, fixes backslashes)', () => {
    expect(assetKey('/room/include/haikyo.jpg')).toBe('room/include/haikyo.jpg');
    expect(assetKey('room\\include\\rouka.jpg')).toBe('room/include/rouka.jpg');
  });

  it('resolves URLs under a base, or bare without one', () => {
    expect(resolveAssetUrl('room/include/haikyo.jpg')).toBe('room/include/haikyo.jpg');
    expect(resolveAssetUrl('room/include/haikyo.jpg', { baseUrl: '/assets/' })).toBe(
      '/assets/room/include/haikyo.jpg',
    );
  });

  it('extracts basename and extension', () => {
    expect(baseName('room/include/haikyo.jpg')).toBe('haikyo.jpg');
    expect(extension('room/include/haikyo.JPG')).toBe('jpg');
    expect(extension('noext')).toBe('');
  });

  it('flags SWF assets as needing conversion', () => {
    expect(needsConversion('room/include/dark_bgm.swf')).toBe(true);
    expect(needsConversion('room/include/haikyo.jpg')).toBe(false);
  });
});
