// Basic, fast fixes that keep your MD valid and predictable for screen readers.
export function normalizeHeadings(md = "") {
  const lines = String(md || "").split(/\r?\n/);
  let lastLevel = 1; // pretend H1 exists at top (your page title bar)
  const fixed = lines.map((line) => {
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (!m) return line;
    let level = m[1].length;

    // Never start at H3/H4 without an H2 first; demote gaps > 1 level.
    if (level > lastLevel + 1) level = lastLevel + 1;
    if (level < 2) level = 2; // never output H1 in the body
    lastLevel = level;

    return `${"#".repeat(level)} ${m[2].trim()}`;
  });
  return fixed.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function coerceGFM(md = "") {
  // Normalize bullets, numbers, tables spacing—keep it lightweight.
  return normalizeHeadings(
    md
      .replace(/^\s*[\*\+]\s/gm, "- ")         // bullets → "-"
      .replace(/^\s*(\d+)\)\s/gm, "$1. ")      // "1)" → "1."
      .replace(/[ \t]+$/gm, "")                // trim eol spaces
  );
}
