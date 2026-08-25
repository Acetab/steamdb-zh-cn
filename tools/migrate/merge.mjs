// 一次性迁移工具：把旧项目词库中的“用户原创部分”迁入独立项目词库，
// 并合并 tools/migrate/translations-new.json 的原创翻译。
// 用法：node tools/migrate/merge.mjs
// 只迁移 EXACT / PAGES / ATTRIBUTES / REGEX（原词库没有的字段，用户自创）；
// CONTEXT / INPUT / LABEL（来自 Chr_ 原词库）不迁移。

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const oldDict = JSON.parse(await readFile(path.resolve(root, "../steamdb-zh-cn/translations.zh-CN.json"), "utf8"));
const newTranslations = JSON.parse(await readFile(path.join(root, "tools/migrate/translations-new.json"), "utf8"));
const current = JSON.parse(await readFile(path.join(root, "translations.zh-CN.json"), "utf8"));

// ---- 1. global：当前词库 + 用户原创 EXACT（优先）+ 新翻译（不覆盖已有） ----
const global = new Map(Object.entries(current.global || {}));
for (const [key, value] of Object.entries(oldDict.EXACT || {})) global.set(key, value);
for (const [key, value] of Object.entries(newTranslations.translated || {})) {
  if (!global.has(key)) global.set(key, value);
}

// ---- 2. pages：当前词库 + 用户原创 PAGES（按路径合并，同 key 用户版优先） ----
const pageMap = new Map((current.pages || []).map((p) => [p.path, new Map(Object.entries(p.terms || {}))]));
for (const [pathName, terms] of Object.entries(oldDict.PAGES || {})) {
  if (!pageMap.has(pathName)) pageMap.set(pathName, new Map());
  for (const [key, value] of Object.entries(terms)) pageMap.get(pathName).set(key, value);
}
const pages = [...pageMap.entries()]
  .map(([pathName, terms]) => ({ path: pathName, terms: Object.fromEntries(terms) }))
  .sort((a, b) => b.path.length - a.path.length);

// ---- 3. attrs：当前词库 + 用户原创 ATTRIBUTES ----
const attrs = new Map(Object.entries(current.attrs || {}));
for (const [key, value] of Object.entries(oldDict.ATTRIBUTES || {})) attrs.set(key, value);

// ---- 4. regex：用户原创 REGEX ----
const regex = [...(oldDict.REGEX || [])];

// ---- 写出 ----
const output = {
  meta: {
    version: current.meta?.version || "1.0.0",
    updatedAt: new Date().toISOString().slice(0, 10),
    note: "独立词库：Steam 官方简体中文术语优先；已并入用户原创词条与原创翻译。",
  },
  global: Object.fromEntries(global),
  pages,
  attrs: Object.fromEntries(attrs),
  regex,
};

await writeFile(path.join(root, "translations.zh-CN.json"), `${JSON.stringify(output, null, 2)}\n`, "utf8");

const globalCount = Object.keys(output.global).length;
const pageCount = output.pages.reduce((s, p) => s + Object.keys(p.terms).length, 0);
const skippedCount = Object.keys(newTranslations.skipped || {}).length;
const bytes = Buffer.byteLength(JSON.stringify(output), "utf8");
console.log(`合并完成：global ${globalCount} / pages ${output.pages.length} 组 ${pageCount} 条 / attrs ${Object.keys(output.attrs).length} / regex ${output.regex.length}`);
console.log(`词库体积：${(bytes / 1024).toFixed(1)} KB`);
console.log(`本次新翻译 ${Object.keys(newTranslations.translated).length} 条，跳过（技术标识/品牌/句子片段）${skippedCount} 条`);
