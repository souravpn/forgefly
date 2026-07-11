// Fixed on-brand SVG templates for promotion graphics — no AI diffusion image
// model this phase (see index.ts TODO). Plain SVG string-building keeps this
// self-contained (no satori/flexbox layout engine needed for a couple of
// fixed, hand-tuned layouts) and predictable to rasterize with resvg.

export interface TemplateInput {
  businessName: string;
  headline: string;
  stat: string | null;
  footerText: string;
}

const WIDTH = 1080;
const HEIGHT = 1080;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Greedy word-wrap by approximate character width — good enough for a fixed-width card. */
function wrapLines(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;
  return lines;
}

/** Keeps a long stat string (e.g. "40% faster response times") from overflowing the
 * fixed-width card — the AI prompt asks for something short, but scales down as a
 * defensive fallback instead of clipping. */
function statFontSize(stat: string): number {
  const maxWidth = WIDTH - 144; // 72px margin each side
  const approxCharWidth = 0.62; // bold Inter at font-size 1
  const fitSize = maxWidth / (stat.length * approxCharWidth);
  return Math.round(Math.min(220, Math.max(72, fitSize)));
}

function tspans(lines: string[], x: number, startY: number, lineHeight: number): string {
  return lines
    .map((line, i) => `<tspan x="${x}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join('');
}

/** Stat-forward card: hero number + headline + footer — modeled on a before/after style promo. */
export function statCardTemplate(input: TemplateInput): string {
  const headlineLines = wrapLines(input.headline, 24, 3);
  const headlineLineHeight = 56;
  const headlineStartY = 780;

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f2e28"/>
        <stop offset="100%" stop-color="#0a1f1c"/>
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

    <text x="72" y="120" font-family="Inter" font-weight="700" font-size="34" fill="#eafff5">${escapeXml(input.businessName)}</text>
    <line x1="72" y1="160" x2="${WIDTH - 72}" y2="160" stroke="#ffffff22" stroke-width="2"/>

    ${input.stat ? `<text x="72" y="480" font-family="Inter" font-weight="800" font-size="${statFontSize(input.stat)}" fill="#eafff5">${escapeXml(input.stat)}</text>` : ''}

    <text font-family="Inter" font-weight="700" font-size="${headlineLineHeight - 8}" fill="#ffffff">
      ${tspans(headlineLines, 72, headlineStartY, headlineLineHeight)}
    </text>

    <line x1="72" y1="960" x2="${WIDTH - 72}" y2="960" stroke="#ffffff22" stroke-width="2"/>
    <text x="72" y="1010" font-family="Inter" font-weight="400" font-size="26" fill="#9fd8c8">${escapeXml(input.footerText)}</text>
  </svg>`;
}

/** Announcement card: headline-forward, for promos without a standalone stat. */
export function announcementTemplate(input: TemplateInput): string {
  const headlineLines = wrapLines(input.headline, 18, 4);
  const headlineLineHeight = 84;
  const headlineStartY = 480;

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#2a1a3d"/>
        <stop offset="100%" stop-color="#150b22"/>
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

    <text x="72" y="120" font-family="Inter" font-weight="700" font-size="34" fill="#f5eaff">${escapeXml(input.businessName)}</text>
    <line x1="72" y1="160" x2="${WIDTH - 72}" y2="160" stroke="#ffffff22" stroke-width="2"/>

    <text font-family="Inter" font-weight="800" font-size="${headlineLineHeight - 12}" fill="#ffffff">
      ${tspans(headlineLines, 72, headlineStartY, headlineLineHeight)}
    </text>

    <line x1="72" y1="960" x2="${WIDTH - 72}" y2="960" stroke="#ffffff22" stroke-width="2"/>
    <text x="72" y="1010" font-family="Inter" font-weight="400" font-size="26" fill="#d3b8f5">${escapeXml(input.footerText)}</text>
  </svg>`;
}

export const TEMPLATES: Record<string, (input: TemplateInput) => string> = {
  stat_card: statCardTemplate,
  announcement: announcementTemplate,
};
