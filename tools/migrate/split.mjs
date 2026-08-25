// 一次性：把单一 translations.zh-CN.json 拆分为 dictionary/ 分文件结构。
// 之后维护改 dictionary/ 下的文件，构建时由 tools/merge-dict.mjs 合并回发布文件。
// 用法：node tools/migrate/split.mjs

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dict = JSON.parse(await readFile(path.join(root, "translations.zh-CN.json"), "utf8"));
const dictDir = path.join(root, "dictionary");
const pagesDir = path.join(dictDir, "pages");

await mkdir(pagesDir, { recursive: true });

await writeFile(path.join(dictDir, "global.json"), `${JSON.stringify(dict.global || {}, null, 2)}\n`, "utf8");
await writeFile(path.join(dictDir, "attrs.json"), `${JSON.stringify(dict.attrs || {}, null, 2)}\n`, "utf8");
await writeFile(path.join(dictDir, "regex.json"), `${JSON.stringify(dict.regex || [], null, 2)}\n`, "utf8");

const nameOf = (p) => (p === "/" ? "home" : p.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root");
for (const page of dict.pages || []) {
  await writeFile(path.join(pagesDir, `${nameOf(page.path)}.json`), `${JSON.stringify(page, null, 2)}\n`, "utf8");
}

console.log(`已拆分 dictionary/：global ${Object.keys(dict.global).length} 条 / attrs ${Object.keys(dict.attrs).length} 条 / regex ${dict.regex.length} 条 / pages ${dict.pages.length} 个文件`);
