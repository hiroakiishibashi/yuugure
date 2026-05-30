/**
 * NMLValidator - Static checks over a parsed NML program.
 *
 * Runs after NMLParser. Surfaces problems an author would want to know about
 * without executing the script:
 *   - unknown tags / unknown or missing attributes (from the TagSpec registry)
 *   - <goto>, <key> and <option> jumps whose target label/anchor is undefined
 *   - empty/insufficient block constructs
 *
 * Severity guidance: things that will break execution are `error`; things that
 * are merely suspicious are `warning`. The validator never throws.
 */

import { getTagSpec, isKnownTag } from './tags/TagSpec';
import type { NMLDiagnostic, NMLNode, NMLProgram } from './NMLTypes';

export interface ValidationResult {
  diagnostics: NMLDiagnostic[];
  errors: NMLDiagnostic[];
  warnings: NMLDiagnostic[];
  ok: boolean; // true when there are no error-severity diagnostics
}

export class NMLValidator {
  validate(program: NMLProgram): ValidationResult {
    const diagnostics: NMLDiagnostic[] = [];

    // Pass 1: collect every declared label / numeric anchor.
    const labels = new Set<string>();
    walk(program.nodes, (node) => {
      if (node.kind === 'tag' && (node.name === 'label' || node.name === 'a')) {
        const v = node.attrs.value ?? node.positional;
        if (v) labels.add(v);
      }
    });

    // Pass 2: per-node validation.
    walk(program.nodes, (node) => {
      switch (node.kind) {
        case 'tag':
          this.checkTag(node, labels, diagnostics);
          break;
        case 'if':
          if (!node.name) {
            diagnostics.push({ severity: 'error', message: '<if> requires a name attribute', pos: node.pos });
          }
          break;
        case 'input':
          if (!node.variable) {
            diagnostics.push({ severity: 'error', message: '<input> requires a variable (value=)', pos: node.pos });
          }
          for (const key of node.keys) {
            if (!key.value) {
              diagnostics.push({ severity: 'warning', message: '<key> has an empty keyword', pos: key.pos });
            }
            if (key.label && !labels.has(key.label)) {
              diagnostics.push({
                severity: 'warning',
                message: `<key> routes to undefined label "${key.label}"`,
                pos: key.pos,
              });
            }
          }
          break;
        case 'option':
          if (node.choices.length === 0) {
            diagnostics.push({ severity: 'warning', message: '<option> has no choices', pos: node.pos });
          }
          for (const choice of node.choices) {
            if (choice.action.type === 'anchor' && !labels.has(choice.action.target)) {
              diagnostics.push({
                severity: 'warning',
                message: `option choice jumps to undefined anchor "${choice.action.target}"`,
                pos: choice.pos,
              });
            }
          }
          break;
        case 'text':
          break;
      }
    });

    const errors = diagnostics.filter((d) => d.severity === 'error');
    const warnings = diagnostics.filter((d) => d.severity === 'warning');
    return { diagnostics, errors, warnings, ok: errors.length === 0 };
  }

  private checkTag(
    node: Extract<NMLNode, { kind: 'tag' }>,
    labels: Set<string>,
    diagnostics: NMLDiagnostic[],
  ): void {
    const spec = getTagSpec(node.name);
    if (!isKnownTag(node.name)) {
      diagnostics.push({ severity: 'warning', message: `Unknown tag <${node.name}>`, pos: node.pos });
      return;
    }
    if (!spec) return;

    // required attributes
    for (const req of spec.required ?? []) {
      if (node.attrs[req] === undefined || node.attrs[req] === '') {
        diagnostics.push({
          severity: 'error',
          message: `<${node.name}> requires attribute "${req}"`,
          pos: node.pos,
        });
      }
    }

    // unknown attributes
    if (spec.attrs) {
      for (const key of Object.keys(node.attrs)) {
        if (!spec.attrs.includes(key)) {
          diagnostics.push({
            severity: 'warning',
            message: `<${node.name}> has unknown attribute "${key}"`,
            pos: node.pos,
          });
        }
      }
    }

    // goto target resolution
    if (node.name === 'goto') {
      const target = node.attrs.value ?? node.positional;
      if (target && !labels.has(target)) {
        diagnostics.push({
          severity: 'warning',
          message: `<goto> targets undefined label "${target}"`,
          pos: node.pos,
        });
      }
    }
  }
}

/** Depth-first walk over the AST, visiting every node (including block children). */
function walk(nodes: NMLNode[], visit: (node: NMLNode) => void): void {
  for (const node of nodes) {
    visit(node);
    if (node.kind === 'if') {
      walk(node.then, visit);
      if (node.otherwise) walk(node.otherwise, visit);
    }
    // input children are flattened into keys; option children into choices —
    // nothing further to recurse into for those.
  }
}

export function validateNML(program: NMLProgram): ValidationResult {
  return new NMLValidator().validate(program);
}
