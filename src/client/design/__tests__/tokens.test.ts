// U5 Step 12: the design tokens (BR10.1, BR10.2, BR10.5, BR10.6).
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const MOCKUPS = 'aidlc/spaces/default/intents/261107-table-order-v2/inception/refined-mockups/mockups';
const tokens = fs.readFileSync('src/client/design/tokens.css', 'utf8');
const mockupCss = fs.readFileSync(path.join(MOCKUPS, 'design-system.css'), 'utf8');

/** The text between the braces of the block that starts at `header` (nested blocks are kept). */
function blockAfter(css: string, header: string): string {
  const start = css.indexOf(header);
  if (start === -1) throw new Error(`block not found: ${header}`);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(css.indexOf('{', start) + 1, i);
  }
  throw new Error(`block not closed: ${header}`);
}

function declarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const dark = declarations(blockAfter(tokens, ':root, :root[data-theme="dark"]'));
const light = declarations(blockAfter(tokens, ':root[data-theme="light"]'));
const deviceLight = declarations(blockAfter(blockAfter(tokens, '@media (prefers-color-scheme: light)'), ':root:not([data-theme])'));
const shared = declarations(blockAfter(tokens, ':root {'));
const aliases = declarations(blockAfter(tokens, ':root {\n  --bg-primary'));
/** Light values that differ from the mockups on purpose, each for a contrast reason named in tokens.css. */
const LIGHT_OVERRIDES: Record<string, string> = { '--warn-amber': '#9A5B00' };

const THEME_TOKENS = Object.keys(declarations(blockAfter(mockupCss, ':root, :root[data-theme="dark"]')));

// ---- contrast ----
function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** An rgba tint laid over an opaque hex colour, as hex. */
function over(rgba: string, base: string): string {
  const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(rgba);
  if (!m) throw new Error(`not an rgba colour: ${rgba}`);
  const alpha = parseFloat(m[4]);
  const b = base.replace('#', '');
  const out = [0, 1, 2].map((i) => {
    const under = parseInt(b.slice(i * 2, i * 2 + 2), 16);
    return Math.round(parseInt(m[i + 1], 10) * alpha + under * (1 - alpha));
  });
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('');
}

describe('design tokens', () => {
  it('regression: the light theme\'s amber timer text is readable (the mockup\'s #B86E00 was 3.99 to 1 on white)', () => {
    expect(contrast(light['--warn-amber'], light['--bg-raised'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#B86E00', light['--bg-raised'])).toBeLessThan(4.5); // the value the fix replaced
  });

  it('every token of the mockups\' design system is defined in both themes', () => {
    expect(THEME_TOKENS.length).toBeGreaterThan(30);
    for (const name of THEME_TOKENS) {
      expect(dark, `dark ${name}`).toHaveProperty(name);
      expect(light, `light ${name}`).toHaveProperty(name);
    }
  });

  it('the dark theme holds exactly the mockups\' (v1\'s) values, and the light theme the mockups\' light values', () => {
    const mockDark = declarations(blockAfter(mockupCss, ':root, :root[data-theme="dark"]'));
    const mockLight = declarations(blockAfter(mockupCss, ':root[data-theme="light"]'));
    for (const name of THEME_TOKENS) {
      expect(dark[name], `dark ${name}`).toBe(mockDark[name]);
      expect(light[name], `light ${name}`).toBe(LIGHT_OVERRIDES[name] ?? mockLight[name]);
    }
  });

  it('the scales (type, spacing, radius, motion) match the mockups', () => {
    const mockShared = declarations(blockAfter(mockupCss, ':root {'));
    expect(Object.keys(mockShared).length).toBeGreaterThan(25);
    for (const [name, value] of Object.entries(mockShared)) expect(shared[name], name).toBe(value);
  });

  it('with no saved choice the device\'s light setting gets the same values as the Light theme', () => {
    for (const name of THEME_TOKENS) expect(deviceLight[name], name).toBe(light[name]);
  });

  it('every token a mockup page uses exists in both themes or the shared scales', () => {
    const used = new Set<string>();
    for (const file of fs.readdirSync(MOCKUPS)) {
      if (!file.endsWith('.html') && !file.endsWith('.css')) continue;
      const text = fs.readFileSync(path.join(MOCKUPS, file), 'utf8');
      for (const m of text.matchAll(/var\((--[a-z0-9-]+)/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(20);
    for (const name of used) {
      const known = name in shared || (name in dark && name in light);
      expect(known, `${name} is used by a mockup but is not defined`).toBe(true);
    }
  });

  it('v1\'s token names stay as aliases of the new names', () => {
    for (const alias of ['--bg-primary', '--bg-secondary', '--bg-tab-bar', '--text-primary', '--text-secondary', '--status-pending', '--status-completed', '--shadow-tab-bar', '--radius-card']) {
      expect(aliases[alias], alias).toMatch(/^var\(--[a-z0-9-]+\)$/);
    }
    expect(aliases['--bg-primary']).toBe('var(--bg)');
    expect(aliases['--text-primary']).toBe('var(--text)');
    expect(aliases['--status-completed']).toBe('var(--completed)');
  });

  it('the theme switch is the data-theme attribute on the page root', () => {
    expect(tokens).toContain(':root[data-theme="light"]');
    expect(tokens).toContain(':root[data-theme="dark"]');
    expect(tokens).toContain(':root:not([data-theme])');
  });

  describe.each([
    ['dark', dark],
    ['light', light],
  ])('text is readable in the %s theme (4.5 to 1)', (_name, theme) => {
    it.each(['--text', '--text-2', '--text-muted'])('%s on every surface', (fg) => {
      for (const bg of ['--bg', '--bg-raised', '--bg-card']) {
        expect(contrast(theme[fg], theme[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('button and accent text', () => {
      expect(contrast(theme['--accent-fg'], theme['--accent']), 'accent-fg on accent').toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme['--accent-fg'], theme['--accent-hover']), 'accent-fg on accent-hover').toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme['--accent-text'], theme['--bg-raised']), 'accent-text on bg-raised').toBeGreaterThanOrEqual(4.5);
    });

    it('status words and danger text on the card surface', () => {
      for (const status of ['--pending', '--preparing', '--completed', '--cancelled', '--danger', '--warn-amber', '--warn-red']) {
        expect(contrast(theme[status], theme['--bg-raised']), `${status} on bg-raised`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('badge and timer text on their tinted backgrounds (the tint laid over the card surface)', () => {
      const pairs: Array<[string, string]> = [
        ['--pending', '--pending-soft'],
        ['--preparing', '--preparing-soft'],
        ['--completed', '--completed-soft'],
        ['--cancelled', '--cancelled-soft'],
        ['--danger', '--danger-soft'],
        ['--accent-text', '--accent-soft'],
        ['--warn-amber', '--pending-soft'],
        ['--warn-red', '--danger-soft'],
      ];
      for (const [fg, soft] of pairs) {
        const bg = over(theme[soft], theme['--bg-raised']);
        expect(contrast(theme[fg], bg), `${fg} on ${soft}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  it('the contrast helper itself is right: black on white is 21 to 1, equal colours 1 to 1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('all motion stops when the device asks for reduced motion (BR10.6)', () => {
    const reduced = blockAfter(tokens, '@media (prefers-reduced-motion: reduce)');
    expect(reduced).toMatch(/animation:\s*none\s*!important/);
    expect(reduced).toMatch(/transition:\s*none\s*!important/);
    expect(reduced).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });
});
