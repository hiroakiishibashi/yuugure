import { describe, it, expect } from 'vitest';
import { parseNML } from './NMLParser';
import { validateNML } from './NMLValidator';

describe('NMLValidator', () => {
  it('accepts a well-formed script with resolved jumps', () => {
    const program = parseNML(`<nml>
      <if name="x" value="1"><goto "done"></if>
      <label "done"><end>
    </nml>`);
    const result = validateNML(program);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('flags a <goto> to an undefined label as a warning', () => {
    const result = validateNML(parseNML('<nml><goto "nowhere"><end></nml>'));
    expect(result.warnings.some((w) => /undefined label "nowhere"/.test(w.message))).toBe(true);
  });

  it('errors when a required attribute is missing', () => {
    const result = validateNML(parseNML('<nml><set value="x"></nml>'));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /<set> requires attribute "name"/.test(e.message))).toBe(true);
  });

  it('warns about unknown tags and attributes', () => {
    const result = validateNML(parseNML('<nml><wobble><title color="red"></nml>'));
    expect(result.warnings.some((w) => /Unknown tag <wobble>/.test(w.message))).toBe(true);
    expect(result.warnings.some((w) => /unknown attribute "color"/.test(w.message))).toBe(true);
  });

  it('warns when an <input> <key> routes to an undefined label', () => {
    const result = validateNML(
      parseNML('<nml><input value="v"><key label="ghost" value="k"></input><end></nml>'),
    );
    expect(result.warnings.some((w) => /undefined label "ghost"/.test(w.message))).toBe(true);
  });
});
