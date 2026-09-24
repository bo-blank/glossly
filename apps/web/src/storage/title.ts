export const TITLE_MAX = 60;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

function blockText(inner: string): string {
  return inner
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/\s+/g, ' ')
    .trim();
}

/** First heading, else first non-empty block, trimmed to 60 characters; "Untitled" if there is no text. */
export function deriveTitle(html: string): string {
  const blocks = [...html.matchAll(/<(h[1-6]|p|li|blockquote|pre)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => ({
    heading: m[1].startsWith('h'),
    text: blockText(m[2])
  }));
  const pick = blocks.find((b) => b.heading && b.text) ?? blocks.find((b) => b.text);
  if (!pick) return 'Untitled';
  return pick.text.length > TITLE_MAX ? `${pick.text.slice(0, TITLE_MAX - 1).trimEnd()}…` : pick.text;
}
