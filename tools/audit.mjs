// 词库审计：构建前校验词库质量，错误阻断构建，警告仅提示。
// 用法：node tools/audit.mjs          （CLI：直接审计 translations.zh-CN.json）
// 也可被 build.mjs import 复用。

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function auditDictionary(raw) {
  const errors = [];
  const warnings = [];

  for (const [key, value] of Object.entries(raw.global || {})) {
    if (!key.trim()) errors.push("global 存在空 key");
    if (typeof value !== "string" || !value.trim()) errors.push(`global "${key}" 译文为空`);
    else if (value === key) warnings.push(`global "${key}" 译文与原文相同（可能未翻译）`);
  }

  for (const page of raw.pages || []) {
    if (!page.path || typeof page.path !== "string") {
      errors.push("pages 存在缺少 path 的条目");
      continue;
    }
    for (const [key, value] of Object.entries(page.terms || {})) {
      if (!key.trim()) errors.push(`pages[${page.path}] 存在空 key`);
      if (typeof value !== "string" || !value.trim()) errors.push(`pages[${page.path}] "${key}" 译文为空`);
      else if (value === key) warnings.push(`pages[${page.path}] "${key}" 译文与原文相同`);
    }
  }

  const paths = (raw.pages || []).map((p) => p.path);
  for (let i = 0; i < paths.length; i++) {
    for (let j = 0; j < paths.length; j++) {
      // "/" 是兜底组（匹配所有路径），与其他路径前缀重叠属正常设计，不警告
      if (i !== j && paths[i] !== paths[j] && paths[j] !== "/" && paths[i].startsWith(paths[j])) {
        warnings.push(`pages 路径 "${paths[i]}" 与 "${paths[j]}" 前缀重叠（构建时取最长路径优先）`);
      }
    }
  }

  for (const page of raw.pages || []) {
    for (const [key, value] of Object.entries(page.terms || {})) {
      if (raw.global[key] && raw.global[key] !== value) {
        warnings.push(`pages[${page.path}] "${key}" 与 global 译文不一致（global: ${raw.global[key]} / page: ${value}）`);
      }
    }
  }

  for (const rule of raw.regex || []) {
    if (!rule || typeof rule.source !== "string" || typeof rule.target !== "string") {
      errors.push("regex 条目结构异常（需 { source, target }）");
      continue;
    }
    try {
      new RegExp(rule.source);
    } catch (err) {
      errors.push(`regex 无法编译: ${rule.source}（${err.message}）`);
    }
  }

  for (const [key, value] of Object.entries(raw.attrs || {})) {
    if (!key.trim()) errors.push("attrs 存在空 key");
    if (typeof value !== "string" || !value.trim()) errors.push(`attrs "${key}" 译文为空`);
    else if (value === key) warnings.push(`attrs "${key}" 译文与原文相同`);
  }

  return { errors, warnings };
}

// CLI 模式
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dict = JSON.parse(await readFile(path.join(root, "translations.zh-CN.json"), "utf8"));
  const { errors, warnings } = auditDictionary(dict);
  if (warnings.length) {
    console.log(`⚠️  ${warnings.length} 条警告：`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  if (errors.length) {
    console.error(`❌ ${errors.length} 条错误：`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✅ 词库审计通过（global ${Object.keys(dict.global).length} / pages ${dict.pages.length} 组 / attrs ${Object.keys(dict.attrs).length} / regex ${dict.regex.length}）`);
}
