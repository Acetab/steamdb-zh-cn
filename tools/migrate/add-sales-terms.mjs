// 一次性补词：根据 /sales/ 页面采集清单，把固定 UI 词条加入词库。
// 跳过：游戏名、价格动态行（all-time low: ¥...）、完整日期时间（UTC/GMT+8 双时间）。
// 用法：node tools/migrate/add-sales-terms.mjs

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const globalPath = path.join(root, "dictionary/global.json");
const regexPath = path.join(root, "dictionary/regex.json");

const globalDict = JSON.parse(await readFile(globalPath, "utf8"));
const regexDict = JSON.parse(await readFile(regexPath, "utf8"));

// ---- global 新增（固定 UI 词条，不覆盖已有） ----
const newGlobal = {
  "Account": "账户",
  "ACCOUNT": "账户",
  "Ends": "结束",
  "Ends: Activate to sort": "结束：点击排序",
  "Started: Activate to sort": "开始：点击排序",
  "#: Activate to remove sorting": "#：点击取消排序",
  "pagination": "分页",
  "entries per page": "每页条目",
  "Open link": "打开链接",
  "Support us": "支持我们",
  "FAQ & help": "常见问题与帮助",
  "Steam Status": "Steam 状态",
  "Steam Group": "Steam 群组",
  "SteamDB Blog": "SteamDB 博客",
  "SteamDB Rating": "SteamDB 评分",
  "Blog": "博客",
  "Calculator": "计算器",
  "Calendar": "日历",
  "Developers": "开发者",
  "Publishers": "发行商",
  "Discord Bot": "Discord 机器人",
  "Change history": "变更历史",
  "Your Games": "我的游戏",
  "Your Profile": "我的个人资料",
  "Your Wishlist": "我的愿望单",
  "Hide owned": "隐藏已拥有",
  "Show only owned": "仅显示已拥有",
  "Hide in family": "隐藏家庭共享",
  "Show only in family": "仅显示家庭共享",
  "Deal Rank": "优惠排名",
  "Discount percentage": "折扣百分比",
  "Apply new filters": "应用新筛选",
  "tomorrow": "明天",
  "Fair use disclaimer": "合理使用声明",
  "Blue discount — Product has not been this cheap before": "蓝色折扣 — 价格从未如此之低",
  "Green discount — Product is priced on par with lowest recorded price": "绿色折扣 — 价格与历史最低价持平",
  "Purple discount — Product is priced on par with lowest recorded price in last two years": "紫色折扣 — 价格与近两年最低价持平",
  "Lighter blue highlight: Previous low was 1.5+ years ago OR 50%+ price drop": "浅蓝高亮：上次最低价在 1.5 年前，或降价超 50%",
  "When this discount will expire": "该折扣何时到期",
  "When was this product discounted": "该产品何时有过折扣",
  "By default multiple inclusion filters use AND logic. Check this to use OR logic instead.": "默认多个包含筛选采用与逻辑，勾选后改用或逻辑。",
  "Requires our browser extension to enable all filters (including showing all your DLC)": "需安装浏览器扩展才能启用全部筛选（含显示你的全部 DLC）",
  "Only numbers (with or without fractions)": "仅数字（可含小数）",
  "Any profile link containing id/ or profiles/": "任意包含 id/ 或 profiles/ 的个人资料链接",
  "Any text containing app/ or sub/ or bundle/ or depot/": "任意包含 app/、sub/、bundle/ 或 depot/ 的文本",
  "Enter a steamid (7656…) to be redirected to calculator": "输入 steamid（7656…）以跳转到计算器",
  "Use keywords to find matches. \"Quotes\" for exact phrases. Exclude terms with ! symbol, e.g. \"!demo\"": "用关键词查找匹配。\"引号\"为精确短语，! 排除词条，如 \"!demo\"",
  "Steam data for everyone since 2012 Support us by donating or becoming a sponsor": "自 2012 年为所有人提供 Steam 数据，欢迎捐赠或成为赞助者支持我们",
};

// ---- regex 新增（相对时间、筛选提示、四位年份月份） ----
const newRegex = [
  { source: "^in (\\d+) hours?$", target: "$1 小时后" },
  { source: "^in (\\d+) days?$", target: "$1 天后" },
  { source: "^in (\\d+) weeks?$", target: "$1 周后" },
  { source: "^in (\\d+) minutes?$", target: "$1 分钟后" },
  { source: "^Remove '(.*)' filter$", target: "移除'$1'筛选" },
  { source: "^Rating: ≥(\\d+)%$", target: "评级：≥$1%" },
  { source: "^Last (\\d+) months?$", target: "最近 $1 个月" },
  { source: "^Last (\\d+) days?$", target: "最近 $1 天" },
  { source: "^Jan (\\d{4})$", target: "$1 年 1 月" },
  { source: "^Feb (\\d{4})$", target: "$1 年 2 月" },
  { source: "^Mar (\\d{4})$", target: "$1 年 3 月" },
  { source: "^Apr (\\d{4})$", target: "$1 年 4 月" },
  { source: "^May (\\d{4})$", target: "$1 年 5 月" },
  { source: "^Jun (\\d{4})$", target: "$1 年 6 月" },
  { source: "^Jul (\\d{4})$", target: "$1 年 7 月" },
  { source: "^Aug (\\d{4})$", target: "$1 年 8 月" },
  { source: "^Sep (\\d{4})$", target: "$1 年 9 月" },
  { source: "^Oct (\\d{4})$", target: "$1 年 10 月" },
  { source: "^Nov (\\d{4})$", target: "$1 年 11 月" },
  { source: "^Dec (\\d{4})$", target: "$1 年 12 月" },
];

let globalAdded = 0;
for (const [key, value] of Object.entries(newGlobal)) {
  if (!(key in globalDict)) {
    globalDict[key] = value;
    globalAdded++;
  }
}

const existingSources = new Set(regexDict.map((r) => r.source));
let regexAdded = 0;
for (const rule of newRegex) {
  if (!existingSources.has(rule.source)) {
    regexDict.push(rule);
    regexAdded++;
  }
}

await writeFile(globalPath, `${JSON.stringify(globalDict, null, 2)}\n`, "utf8");
await writeFile(regexPath, `${JSON.stringify(regexDict, null, 2)}\n`, "utf8");
console.log(`global 新增 ${globalAdded} 条（现有 ${Object.keys(globalDict).length}）`);
console.log(`regex 新增 ${regexAdded} 条（现有 ${regexDict.length}）`);
