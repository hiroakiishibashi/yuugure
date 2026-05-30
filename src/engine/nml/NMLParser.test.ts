import { describe, it, expect } from 'vitest';
import { parseNML } from './NMLParser';
import type { IfNode, InputNode, OptionNode, TagNode, TextNode } from './NMLTypes';

describe('NMLParser — structure', () => {
  it('unwraps the <nml> body and drops the wrapper', () => {
    const { nodes } = parseNML('<nml>\n<title value="x">\nhello\n</nml>');
    expect(nodes.some((n) => n.kind === 'tag' && (n as TagNode).name === 'nml')).toBe(false);
    expect(nodes[0]).toMatchObject({ kind: 'tag', name: 'title' });
  });

  it('ignores comments, even ones full of dashes or tag-like text', () => {
    const src = `
      <!------------ タイトル ------------>
      <!-- <title value="ignored"> not a real tag -->
      <nml><title value="real"></nml>`;
    const { nodes } = parseNML(src);
    const titles = nodes.filter((n): n is TagNode => n.kind === 'tag' && n.name === 'title');
    expect(titles).toHaveLength(1);
    expect(titles[0]!.attrs.value).toBe('real');
  });

  it('parses multiple tags on one line', () => {
    const { nodes } = parseNML('<nml><blank "5"><clear></nml>');
    expect(nodes.map((n) => (n as TagNode).name)).toEqual(['blank', 'clear']);
  });

  it('handles self-closing tags', () => {
    const { nodes } = parseNML('<nml><preload src="a.swf" flag="ok" /></nml>');
    const preload = nodes[0] as TagNode;
    expect(preload).toMatchObject({ name: 'preload', selfClosing: true });
    expect(preload.attrs).toMatchObject({ src: 'a.swf', flag: 'ok' });
  });
});

describe('NMLParser — attribute forms', () => {
  it('maps a quoted positional argument to its canonical attribute', () => {
    const { nodes } = parseNML('<nml><goto "load_ok"><label "load_ok"></nml>');
    expect((nodes[0] as TagNode).attrs.value).toBe('load_ok');
    expect((nodes[0] as TagNode).positional).toBe('load_ok');
  });

  it('maps a bareword positional argument (2010 dialect)', () => {
    const { nodes } = parseNML('<nml><a 1><anim idle><blank 30><speed 2></nml>');
    const [a, anim, blank, speed] = nodes as TagNode[];
    expect(a!.attrs.value).toBe('1');
    expect(anim!.attrs.value).toBe('idle');
    expect(blank!.attrs.value).toBe('30');
    expect(speed!.attrs.value).toBe('2');
  });

  it('parses standard key="value" attributes including a value with spaces', () => {
    const { nodes } = parseNML('<nml><lifetext prefix="「時」が" up="すすんだ" down="まきもどった"></nml>');
    expect((nodes[0] as TagNode).attrs).toMatchObject({
      prefix: '「時」が',
      up: 'すすんだ',
      down: 'まきもどった',
    });
  });
});

describe('NMLParser — text handling', () => {
  it('trims surrounding ASCII whitespace but preserves full-width spaces and internal newlines', () => {
    const { nodes } = parseNML('<nml>\n  おれは　すべてを\nみていた\n<click></nml>');
    const text = nodes[0] as TextNode;
    expect(text.kind).toBe('text');
    expect(text.text).toBe('おれは　すべてを\nみていた');
  });

  it('drops whitespace-only text runs between tags', () => {
    const { nodes } = parseNML('<nml><clear>\n\n   \n<clear></nml>');
    expect(nodes.every((n) => n.kind === 'tag')).toBe(true);
    expect(nodes).toHaveLength(2);
  });
});

describe('NMLParser — blocks', () => {
  it('parses <if>/<else>/</if> into a structured node', () => {
    const { nodes } = parseNML(`<nml>
      <if name="sound_ok" value="true">うえ<else>した</if>
    </nml>`);
    const ifNode = nodes[0] as IfNode;
    expect(ifNode.kind).toBe('if');
    expect(ifNode.name).toBe('sound_ok');
    expect(ifNode.value).toBe('true');
    expect((ifNode.then[0] as TextNode).text).toBe('うえ');
    expect((ifNode.otherwise?.[0] as TextNode).text).toBe('した');
  });

  it('parses <if> without <else> (otherwise = null)', () => {
    const { nodes } = parseNML('<nml><if name="x" value="1">yes</if></nml>');
    expect((nodes[0] as IfNode).otherwise).toBeNull();
  });

  it('parses <input> with <key> routes', () => {
    const { nodes } = parseNML(`<nml>
      <input value="iro">
      <key label="aka" value="あか">
      <key label="ao" value="あお">
      </input></nml>`);
    const input = nodes[0] as InputNode;
    expect(input.kind).toBe('input');
    expect(input.variable).toBe('iro');
    expect(input.keys).toHaveLength(2);
    expect(input.keys[0]).toMatchObject({ label: 'aka', value: 'あか' });
  });

  it('parses the <option> line-based sub-grammar', () => {
    const { nodes } = parseNML(`<nml><option>
      もちろんです！>>2>>-10;
      ない>>http://example.com>>0;
      いきたくない>>clear>>0;
      びょうき>>sick_3>>-5;
      </option></nml>`);
    const opt = nodes[0] as OptionNode;
    expect(opt.kind).toBe('option');
    expect(opt.choices).toHaveLength(4);
    expect(opt.choices[0]).toMatchObject({ text: 'もちろんです！', powerChange: -10 });
    expect(opt.choices[0]!.action).toEqual({ type: 'anchor', target: '2' });
    expect(opt.choices[1]!.action).toEqual({ type: 'url', url: 'http://example.com' });
    expect(opt.choices[2]!.action).toEqual({ type: 'clear' });
    expect(opt.choices[3]!.action).toEqual({ type: 'sick', id: '3' });
  });

  it('is lenient: reports a diagnostic for an unclosed <if> instead of throwing', () => {
    const { diagnostics } = parseNML('<nml><if name="x" value="1">oops</nml>');
    expect(diagnostics.some((d) => /Unclosed <if>/.test(d.message))).toBe(true);
  });
});
