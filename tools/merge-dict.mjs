// 词库合并：把 dictionary/ 分文件合并为发布文件 translations.zh-CN.json。
// 构建前执行（npm run build 已串联）：node tools/merge-dict.mjs && node tools/build.mjs

import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const dictDir = path.join(root, "dictionary");
const pagesDir = path.join(dictDir, "pages");

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

const global = await readJson(path.join(dictDir, "global.json"));
const attrs = await readJson(path.join(dictDir, "attrs.json"));
const regex = await readJson(path.join(dictDir, "regex.json"));

const pageFiles = (await readdir(pagesDir)).filter((f) => f.endsWith(".json")).sort();
const pages = [];
for (const file of pageFiles) {
  const page = await readJson(path.join(pagesDir, file));
  if (!page || typeof page.path !== "string" || !page.terms) {
    throw new Error(`dictionary/pages/${file} 结构异常（需 { path, terms }）`);
  }
  pages.push(page);
}
// 路径长的排前面，与运行时匹配策略一致
pages.sort((a, b) => b.path.length - a.path.length);

const output = {
  meta: {
    version: pkg.version,
    updatedAt: new Date().toISOString().slice(0, 10),
    note: "独立词库：Steam 官方简体中文术语优先；源文件按页面拆分维护于 dictionary/。",
  },
  global,
  pages,
  attrs,
  regex,
};

await writeFile(path.join(root, "translations.zh-CN.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");

const pageCount = pages.reduce((s, p) => s + Object.keys(p.terms).length, 0);
console.log(`已合并 translations.zh-CN.json：global ${Object.keys(global).length} / pages ${pages.length} 组 ${pageCount} 条 / attrs ${Object.keys(attrs).length} / regex ${regex.length}`);
