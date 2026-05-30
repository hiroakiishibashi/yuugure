/**
 * NML engine public surface (Phase 1).
 *
 * Typical usage:
 *   const program = parseNML(utf8Source);          // parse
 *   const issues  = validateNML(program);          // (optional) static checks
 *   const host    = new MyHost();                   // implement NMLHost
 *   const result  = await new NMLExecutor(host).run(program);
 */

export * from './NMLTypes';
export { NMLParser, parseNML } from './NMLParser';
export { NMLValidator, validateNML, type ValidationResult } from './NMLValidator';
export {
  NMLExecutor,
  compileNML,
  type NMLHost,
  type RunOptions,
  type RunResult,
  type TextContext,
  type ImageCommand,
  type LifeUpdate,
} from './NMLExecutor';
export { Typewriter, type TypewriterOptions } from './Typewriter';
export { RecordingHost, type HostEvent, type RecordingHostOptions } from './hosts/RecordingHost';
export {
  TAG_SPECS,
  getTagSpec,
  isBlockTag,
  isKnownTag,
  parseBool,
  parseNumber,
  parseLifeValue,
  speedToCps,
  type TagSpec,
  type TagKind,
  type SpeedMode,
  type SpeedOptions,
} from './tags/TagSpec';
