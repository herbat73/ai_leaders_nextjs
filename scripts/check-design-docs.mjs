// Keeps the design-system manual honest: every `ui` component has a story and a docs page with the required sections,
// and no raw palette colours sneak into `ui` or `app` (use the semantic tokens in `packages/ui/src/styles.css`).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const uiSrc = join(root, "packages/ui/src");
const docsDir = join(uiSrc, "storybook");

const REQUIRED_SECTIONS = ["Kiedy użyć", "Kiedy nie użyć", "Jak złożyć", "Tokeny", "Stany", "Dostępność", "Rób i nie rób", "API"];
const NOT_COMPONENTS = new Set(["index.ts", "api/api-call.ts", "lib/utils.ts", "index.ts"]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const problems = [];

const componentFiles = [
  ...walk(join(uiSrc, "admin")),
  ...walk(join(uiSrc, "public")),
  join(uiSrc, "theme-toggle.tsx"),
]
  .map((file) => relative(uiSrc, file))
  .filter((rel) => rel.endsWith(".tsx") && !NOT_COMPONENTS.has(rel));

for (const rel of componentFiles) {
  const base = rel.replace(/\.tsx$/, "");
  const stories = join(docsDir, `${base}.stories.tsx`);
  const page = join(docsDir, `${base}.mdx`);
  if (!existsSync(stories)) problems.push(`${rel}: missing story ${relative(root, stories)}`);
  if (!existsSync(page)) {
    problems.push(`${rel}: missing docs page ${relative(root, page)}`);
    continue;
  }
  const text = readFileSync(page, "utf8");
  if (!/<Meta\s+of=\{/.test(text)) problems.push(`${relative(root, page)}: must attach to its stories with <Meta of={...} />`);
  for (const section of REQUIRED_SECTIONS) {
    if (!new RegExp(`^## ${section}\\s*$`, "m").test(text)) problems.push(`${relative(root, page)}: missing section "## ${section}"`);
  }
}

const REQUIRED_PAGES = [
  "intro/zacznij-tutaj.mdx",
  "foundations/kolory-i-tokeny.mdx",
  "foundations/typografia.mdx",
  "foundations/odstepy-promienie-cienie.mdx",
  "foundations/tryb-ciemny.mdx",
  "foundations/dostepnosc.mdx",
  "foundations/tresci.mdx",
  "patterns/wzorce.mdx",
  "agent/dla-agenta-ai.mdx",
  "designer/dla-designera.mdx",
];
for (const page of REQUIRED_PAGES) {
  if (!existsSync(join(docsDir, page))) problems.push(`missing docs page storybook/${page}`);
}

const RAW_COLOR =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline|decoration|accent|caret|shadow)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b|\btext-(?:white|black)\b|\bbg-white\b/;
const scanned = [...walk(uiSrc), ...walk(join(root, "packages/app/src"))].filter((file) => /\.tsx?$/.test(file));
for (const file of scanned) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (RAW_COLOR.test(line) && !line.includes("raw-color-ok")) {
        problems.push(`${relative(root, file)}:${index + 1}: raw palette colour; use a semantic token (${line.trim().slice(0, 80)})`);
      }
    });
}

if (problems.length > 0) {
  console.error(`docs:check found ${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`docs:check ok: ${componentFiles.length} components documented, ${REQUIRED_PAGES.length} guide pages present, no raw colours.`);
