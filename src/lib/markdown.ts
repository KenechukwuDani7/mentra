/**
 * Minimal block parser for model output.
 *
 * Models reach for report formatting — pipe tables, `---` rules, `###`
 * headings — even when the prompt asks them not to. Every one of those has to
 * become real UI, because a literal `**` or `###` on screen reads as a bug.
 */

export type MessageBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'bullet'; text: string; depth: number }
  | { kind: 'ordered'; marker: string; text: string }
  | { kind: 'rule' }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'space' }
  | { kind: 'paragraph'; text: string };

export function parseMessageBlocks(value: string): MessageBlock[] {
  const lines = value.replace(/\r/g, '').split('\n');
  const blocks: MessageBlock[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const line = raw.trim();

    if (!line) {
      if (blocks[blocks.length - 1]?.kind !== 'space') blocks.push({ kind: 'space' });
      continue;
    }

    // A horizontal rule: ---, ***, ___ (three or more of one character).
    if (/^([-*_])\1{2,}$/.test(line)) {
      blocks.push({ kind: 'rule' });
      continue;
    }

    if (line.startsWith('|') && line.includes('|', 1)) {
      const rows: string[][] = [];
      let cursor = index;
      while (cursor < lines.length) {
        const candidate = (lines[cursor] ?? '').trim();
        if (!candidate.startsWith('|')) break;
        const cells = candidate.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
        // The |---|---| separator row carries no content.
        if (!cells.every((cell) => /^:?-{2,}:?$/.test(cell))) rows.push(cells);
        cursor += 1;
      }
      if (rows.length) {
        blocks.push({ kind: 'table', rows });
        index = cursor - 1;
        continue;
      }
    }

    const heading = line.match(/^(#{1,6})\s*(.+)$/);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]!.replace(/\s*#+$/, '') });
      continue;
    }

    const bullet = raw.match(/^(\s*)[-*•+]\s+(.+)$/);
    if (bullet) {
      blocks.push({ kind: 'bullet', text: bullet[2]!, depth: Math.min(2, Math.floor(bullet[1]!.length / 2)) });
      continue;
    }

    const ordered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (ordered) {
      blocks.push({ kind: 'ordered', marker: ordered[1]!, text: ordered[2]! });
      continue;
    }

    blocks.push({ kind: 'paragraph', text: line });
  }

  while (blocks[blocks.length - 1]?.kind === 'space') blocks.pop();
  return blocks;
}

/** Splits a line into inline runs: bold, italic, code, and plain text. */
export function splitInline(value: string) {
  return value.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|(?<![*\w])\*[^*\n]+\*(?!\*))/g).filter(Boolean);
}

/** Strips any markdown marker left over after inline parsing. */
export function stripMarkers(value: string) {
  return value.replace(/\*+/g, '').replace(/`/g, '').replace(/__/g, '');
}
