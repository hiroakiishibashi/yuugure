/**
 * blogReactions - The "write a blog → the character speaks" core loop.
 *
 * The player's blog text is scanned for emotional keywords (the same idea as
 * NML's <input><key> routing); the first matching rule decides how the
 * character reacts. The reaction is rendered to a small NML snippet that the
 * existing engine + PixiHost play back, so the character literally speaks the
 * response. Pure (no PixiJS/React), so it is unit-testable.
 */

export type ReactionAnim = 'idle' | 'talk' | 'glad' | 'sad';

export interface BlogReaction {
  anim: ReactionAnim;
  lines: string[];
  /** 精神力 (mental power) delta */
  lifeDelta: number;
  /** the keyword that matched, or null for the default reaction */
  matched: string | null;
}

interface ReactionRule {
  keywords: string[];
  anim: ReactionAnim;
  lifeDelta: number;
  lines: string[];
}

/** Ordered rules: the first whose keyword appears in the text wins. */
const RULES: ReactionRule[] = [
  {
    keywords: ['ありがとう', 'うれしい', 'たのしい', 'しあわせ', 'すき', 'わら', 'だいすき'],
    anim: 'glad',
    lifeDelta: 10,
    lines: ['そう…　よかった', 'きみが　わらうと　ぼくも　うれしい'],
  },
  {
    keywords: ['かなしい', 'さみしい', 'つらい', 'くるしい', 'なきたい', 'さびしい'],
    anim: 'sad',
    lifeDelta: -5,
    lines: ['むりを　しないで　いいよ', 'ぼくは　ここに　いるから'],
  },
  {
    keywords: ['こわい', 'ふあん', 'しんぱい', 'ねむれない'],
    anim: 'sad',
    lifeDelta: -3,
    lines: ['だいじょうぶ', 'よるは　いつか　あけるよ'],
  },
  {
    keywords: ['おはよう', 'こんにちは', 'こんばんは', 'やあ', 'ただいま'],
    anim: 'glad',
    lifeDelta: 2,
    lines: ['…　きて　くれたんだ', 'まって　いたよ'],
  },
];

const DEFAULT_REACTION: Omit<BlogReaction, 'matched'> = {
  anim: 'idle',
  lifeDelta: 1,
  lines: ['…', 'きみの　はなし　もっと　きかせて'],
};

/** Decide how the character reacts to a blog entry. */
export function reactToBlog(text: string): BlogReaction {
  const haystack = text.toLowerCase();
  for (const rule of RULES) {
    const matched = rule.keywords.find((k) => haystack.includes(k.toLowerCase()));
    if (matched) {
      return { anim: rule.anim, lines: rule.lines, lifeDelta: rule.lifeDelta, matched };
    }
  }
  return { ...DEFAULT_REACTION, matched: null };
}

const LIFETEXT = '<lifetext prefix="「心」が" up="あたたかくなった" down="しずんだ" set="きまった">';

/**
 * Render a reaction as an NML snippet the engine can play. The body is spoken
 * (auto lip-sync), then the reaction pose is held, life adjusts, and the scene
 * ends without a blocking <click> so the UI stays responsive.
 */
export function blogToNML(text: string): string {
  const r = reactToBlog(text);
  const body = r.lines.join('\n');
  const life = r.lifeDelta !== 0 ? `<life value="${r.lifeDelta > 0 ? '+' : ''}${r.lifeDelta}">\n` : '';
  return `<nml>
${LIFETEXT}
<clear>
${body}
<anim ${r.anim}>
${life}<end>
</nml>`;
}
