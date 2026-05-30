/**
 * NMLParser - Parses NML (Nokemonogatari Markup Language) scripts
 *
 * NML is an XML-like scripting language used in the original Flash game
 * to control character dialogue, game state, and user interaction.
 *
 * Format: <nml>...</nml> with XML-like tags and plain text between them.
 * Encoding: Originally Shift-JIS, converted to UTF-8 for HTML5.
 *
 * Supported tags: title, speed, blank, voice, anim, life, lifetext,
 *   click, clear, end, set, get, if/else, goto, label, input/key,
 *   image, preload, geturl, makeuser, login, item, mail
 */

export interface NMLNode {
  type: 'tag' | 'text' | 'comment';
  name?: string;
  attributes?: Record<string, string>;
  children?: NMLNode[];
  content?: string;
}

export interface NMLScript {
  nodes: NMLNode[];
  variables: Record<string, string>;
}

export class NMLParser {
  parse(nmlSource: string): NMLScript {
    // TODO: Phase 1 implementation
    // Use fast-xml-parser for XML nodes, handle plain text between tags
    return { nodes: [], variables: {} };
  }
}
