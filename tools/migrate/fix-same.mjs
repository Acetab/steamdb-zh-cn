// 原创性修复：把新词库中与 Chr_ 译文完全相同、且长度 >20 字符的长句，
// 全部替换为独立措辞的原创翻译。短词条（事实性译法）与 Steam 官方标准术语保留。
// 用法：node tools/migrate/fix-same.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dictPath = path.join(root, "translations.zh-CN.json");
const dict = JSON.parse(await readFile(dictPath, "utf8"));

// 64 条重新措辞的原创翻译（与 Chr_ 表达不同的同义译法）
const REWRITE = {
  "SteamDB is a hobby project and is not affiliated with Valve or Steam.": "SteamDB 是一个业余爱好项目，与 Valve 或 Steam 不存在任何关联。",
  "All times on the site are UTC.": "网站上显示的时间均为 UTC。",
  "Recent package events": "近期的 SUB 动态",
  "View more app history entries…": "展开更多应用历史条目…",
  "View more package history entries…": "展开更多 SUB 历史条目…",
  "Original Release Date": "首次发行日期",
  "Store Asset Modification Time": "商店资产修改时间",
  "Packages that include this app": "收录此应用的 SUB",
  "Bundles that include this app": "收录此应用的捆绑包",
  "Other apps that reference this app": "关联到此应用的其他应用",
  "Depots in this package": "此 SUB 包含的 Depot",
  "Your watch list is public, you can share it with this link:": "你的关注列表属于公开内容，可用此链接分享：",
  "button on app pages to add apps to this list.": "点击按钮即可把应用加入此列表。",
  "Get SteamDB extension for your browser": "为你的浏览器安装 SteamDB 扩展",
  "Get disappointed in your life™": "见证你人生中的失望™",
  "Get disappointed in your life": "见证你人生中的失望",
  "Cross-Platform Multiplayer": "跨平台多人联机",
  "Remote Play on Tablet": "平板远程游玩",
  "Native Steam Controller": "原生 Steam 控制器支持",
  "Lowest Recorded Price": "有记录以来的最低价",
  "Click on a currency name to load price history for that particular currency.": "点按任一货币名称，即可查看该货币的价格走势。",
  "Valve suggested prices are shown on package pages.": "SUB 页面会展示 Valve 的建议定价。",
  "Additional Information": "补充信息",
  "First seen on SteamDB": "SteamDB 首次收录时间",
  "Submit to view all results.": "提交后即可查看所有结果。",
  "Engines & technologies": "游戏引擎与所用技术",
  "Game releases by year": "各年份的游戏发行情况",
  "Most wishlisted games": "被加入愿望单最多的游戏",
  "When is the next Steam Sale?": "Steam 的下一次促销在何时？",
  "Show only historical lows": "只显示历史最低价",
  "Show only matching lows": "只显示持平历史最低价",
  "Show only 2-year lows": "只显示近两年内的最低价",
  "DLCs for owned games (sale)": "已购游戏的 DLC（促销）",
  "DLCs for owned games (all)": "已购游戏的全部 DLC",
  "Browse and filter all current deals": "浏览并筛选当前所有优惠活动",
  "Reload the page with your filters": "按当前筛选条件刷新页面",
  "Filter by feature or OS": "按特性或系统筛选",
  "Filter by type (No DLC)": "按类型筛选（排除 DLC）",
  "Packages only (unfiltered)": "只看 SUB（不做筛选）",
  "- Filter by category -": "— 按分类筛选 —",
  "Includes level editor": "内置关卡编辑器",
  "Steam Turn Notifications": "Steam 回合提醒",
  "Profile Features Limited": "个人资料部分功能受限",
  "High-resolution Steam charts with concurrent player counts for all Steam games, including historic data.": "高清 Steam 图表，涵盖所有 Steam 游戏的在线人数与历史数据。",
  "Concurrent Steam Users": "Steam 在线用户数",
  "Any SteamID format is accepted, enter anything you want and we will convert it on the fly for you.": "接受任意格式的 SteamID，输入后我们会立刻为你完成换算。",
  "Achievement Languages": "成就支持的语言",
  "Design & Illustration": "设计及插画",
  "Install Configuration": "安装参数配置",
  "Procedural Generation": "程序化生成",
  "Follow SteamDB curator": "关注 SteamDB 的鉴赏家账号",
  "Artificial Intelligence": "AI（人工智能）",
  "Character Customization": "角色外观自定义",
  "0. Unnamed launch option": "0. 未命名的启动参数",
  "1. Unnamed launch option": "1. 未命名的启动参数",
  "2. Unnamed launch option": "2. 未命名的启动参数",
  "Asynchronous Multiplayer": "异步联机",
  "Mini profile backgrounds": "迷你资料页背景",
  "Steam Deck Compatibility": "Steam Deck 支持情况",
  "SteamDB rating algorithm": "SteamDB 的评分机制",
  "we are not Valve or Steam": "我们并非 Valve 或 Steam",
  "Discount color explanation": "折扣颜色含义说明",
  "High-resolution Steam charts": "高清 Steam 图表",
  "Steam Profile Badges Leaderboard": "Steam 资料徽章排行榜",
};

let applied = 0;
for (const [key, value] of Object.entries(REWRITE)) {
  if (dict.global[key] !== undefined) {
    dict.global[key] = value;
    applied++;
  }
  for (const page of dict.pages) {
    if (page.terms[key] !== undefined) {
      page.terms[key] = value;
      applied++;
    }
  }
}

await writeFile(dictPath, `${JSON.stringify(dict, null, 2)}\n`, "utf8");
console.log(`已重译 ${Object.keys(REWRITE).length} 条长句，应用 ${applied} 处（global + pages 计两处）。`);
