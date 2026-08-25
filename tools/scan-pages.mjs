// 页面扫描工具：抓取 SteamDB 主要页面，提取词库未收录的英文 UI 文本候选
// 用法：node tools/scan-pages.mjs [--json]
import { readFile } from "node:fs/promises";

// 扫描的页面（选择静态 UI 文本密集、动态噪音少的页面）
const PAGES = [
  { path: "/", name: "home" },
  { path: "/sales/", name: "sales" },
  { path: "/calculator/", name: "calculator" },
  { path: "/charts/", name: "charts" },
  { path: "/tags/", name: "tags" },
  { path: "/donate/", name: "donate" },
  { path: "/badge/13/", name: "badge" },
  { path: "/app/570/", name: "app" },
  { path: "/sub/47807/", name: "sub" },
  { path: "/api/", name: "api" },
];

// 与引擎一致的过滤规则（参考 content.js 的 isCollectable + 界面词特征）
const BRAND = new Set([
  "Steam", "SteamDB", "SteamDB.info", "Steam Web API", "Discord", "Bluesky",
  "Mastodon", "macOS", "Linux", "Windows", "iOS", "Android", "Nintendo",
  "PlayStation", "Xbox", "Epic", "GOG", "Game Pass", "Twitch", "YouTube",
]);
const MAX = 120; // 最长候选长度（超过多为段落/长句，另行处理）

function isNoise(text) {
  if (!/[A-Za-z]/.test(text) || /[\u4e00-\u9fff]/.test(text)) return true; // 无英文或已含中文
  if (text.length < 3 || text.length > MAX) return true;
  if (/^https?:|^www\./i.test(text)) return true; // URL
  if (/^\d[\d\W]*$/.test(text)) return true; // 纯数字/符号
  if (/^[\W_]+$/.test(text)) return true; // 纯符号
  if (/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/.test(text) && /\d/.test(text)) return true; // 日期
  if (/^\d+%|\d+\.\d+|\$\s?\d|¥\s?\d|€\s?\d/.test(text)) return true; // 价格/百分比
  if (BRAND.has(text.trim())) return true;
  return false;
}

// 提取 HTML 中可见文本（去掉脚本/样式/标签）
function extractTexts(html) {
  const texts = [];
  // 移除 script/style/noscript 块
  const cleaned = html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ");
  // 提取文本节点内容（按标签边界切分）
  const chunks = cleaned.replace(/<[^>]+>/g, "\n").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&ndash;/g, "–").replace(/&mdash;/g, "—");
  for (const line of chunks.split(/\n+/)) {
    const t = line.replace(/\s+/g, " ").trim();
    if (t && !isNoise(t)) texts.push(t);
  }
  return texts;
}

const dict = JSON.parse(await readFile(new URL("../translations.zh-CN.json", import.meta.url), "utf8"));
const norm = (t) => t.replace(/\s+/g, " ").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').trim();
const dictKeys = new Set([
  ...Object.keys(dict.global || {}).map(norm),
  ...(dict.pages || []).flatMap((p) => Object.keys(p.terms || {}).map(norm)),
  ...Object.keys(dict.attrs || {}).map(norm),
]);

const results = {};
for (const { path, name } of PAGES) {
  try {
    const res = await fetch("https://steamdb.info" + path);
    if (!res.ok) { console.log(`[跳过] ${name} HTTP ${res.status}`); continue; }
    const html = await res.text();
    const found = new Set();
    for (const t of extractTexts(html)) {
      const bare = norm(t);
      if (dictKeys.has(bare)) continue; // 已收录
      found.add(t);
    }
    results[name] = [...found];
    console.log(`${name}: ${found.size} 个候选`);
  } catch (e) {
    console.log(`[失败] ${name}: ${e.message}`);
  }
}

const jsonFlag = process.argv.includes("--json");
if (jsonFlag) {
  console.log("\n=== JSON 输出 ===");
  console.log(JSON.stringify(results, null, 1));
} else {
  console.log("\n=== 候选清单（未收录的英文文本） ===");
  for (const [name, texts] of Object.entries(results)) {
    console.log(`\n--- ${name} ---`);
    for (const t of texts.slice(0, 80)) console.log("  " + t);
    if (texts.length > 80) console.log(`  ...(共 ${texts.length} 条)`);
  }
}
