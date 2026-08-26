// 从本地保存的 SteamDB HTML 页面提取"词库未收录"的英文 UI 文本候选
// 用法：node tools/extract-untracked.mjs [HTML目录] [--json]
// 用户操作：浏览器打开 SteamDB 各页面 → Ctrl+S 另存为（网页，仅 HTML）→ 放到同一目录（默认 ./html-dump/）
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const dir = process.argv.slice(2).find((a) => !a.startsWith("--")) || "html-dump";

// ---- 过滤规则（与引擎采集逻辑一致 + 页面噪音过滤） ----
const BRAND = new Set([
  "Steam", "SteamDB", "SteamDB.info", "Steam Web API", "Discord", "Bluesky",
  "Mastodon", "macOS", "Linux", "Windows", "iOS", "Android", "Nintendo",
  "PlayStation", "Xbox", "Epic", "GOG", "Game Pass", "Twitch", "YouTube",
]);
const MAX = 160;
const norm = (t) => t.replace(/\s+/g, " ").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').trim();

function isNoise(text) {
  if (!/[A-Za-z]/.test(text) || /[\u4e00-\u9fff]/.test(text)) return true;
  if (text.length < 3 || text.length > MAX) return true;
  if (/^https?:|^www\./i.test(text)) return true;
  if (/^\d[\d\W]*$/.test(text)) return true;
  if (/^[\W_]+$/.test(text)) return true;
  if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(text) && /\d{4}/.test(text)) return true; // 日期
  if (/^\d+%|[\d,]+\.?\d*(?:%|元|¥|\$|€|£|₽)|¥ ?[\d,.]/.test(text)) return true; // 价格/百分比
  if (BRAND.has(text.trim())) return true;
  if (/^[\x20-\x7e]{1,2}$/.test(text)) return true; // 1-2 字符（缩写/符号）
  return false;
}

// 提取 HTML 中的文本（保留标签结构，便于看上下文）
function extractTexts(html) {
  const texts = [];
  const cleaned = html
    .replace(/<(script|style|noscript|svg|canvas)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|td|th|h[1-6]|tr|dt|dd|section|option|summary)>/gi, "\n")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&ndash;/g, "–").replace(/&mdash;/g, "—");
  // 提取元素文本 + 属性文本
  const chunks = cleaned.replace(/<[^>]+>/g, "\n").split(/\n+/);
  for (const line of chunks) {
    const t = norm(line);
    if (t && !isNoise(t)) texts.push(t);
  }
  // 属性（placeholder/title/aria-label）
  for (const m of cleaned.matchAll(/(?:placeholder|title|aria-label)\s*=\s*"([^"]+)"/gi)) {
    const t = norm(m[1]);
    if (t && /[A-Za-z]/.test(t) && !isNoise(t)) texts.push("[attr] " + t);
  }
  return texts;
}

// 读取词库
const dict = JSON.parse(await readFile(new URL("../translations.zh-CN.json", import.meta.url), "utf8"));
const dictKeys = new Set([
  ...Object.keys(dict.global || {}).map(norm),
  ...(dict.pages || []).flatMap((p) => Object.keys(p.terms || {}).map(norm)),
  ...Object.keys(dict.attrs || {}).map(norm),
]);

let files;
try { files = await readdir(dir); } catch { console.error(`目录不存在: ${dir}`); process.exit(1); }
const htmlFiles = files.filter((f) => /\.html?$/i.test(f));
if (!htmlFiles.length) { console.error(`目录中没有 HTML 文件: ${dir}`); process.exit(1); }

const results = {};
for (const f of htmlFiles) {
  const html = await readFile(path.join(dir, f), "utf8");
  const found = new Set();
  for (const t of extractTexts(html)) {
    const key = t.startsWith("[attr] ") ? t.slice(7) : t;
    if (dictKeys.has(norm(key))) continue;
    found.add(t);
  }
  results[f] = [...found];
  console.error(`${f}: ${found.size} 个候选`);
}

const jsonFlag = process.argv.includes("--json");
if (jsonFlag) {
  console.error("\n=== JSON ===");
  console.log(JSON.stringify(results, null, 1));
} else {
  console.error("\n=== 未收录候选（按文件） ===");
  for (const [f, texts] of Object.entries(results)) {
    console.error(`\n--- ${f} (${texts.length}) ---`);
    for (const t of texts.slice(0, 120)) console.error("  " + t);
    if (texts.length > 120) console.error(`  ...共 ${texts.length} 条`);
  }
}
