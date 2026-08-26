# SteamDB 中文汉化（非官方）

在 SteamDB（steamdb.info）网页上把常见界面文本改写为简体中文的浏览器扩展。**非官方项目**，与 SteamDB 网站及其官方扩展无任何关联。


## 特性

- 扩展版纯本地运行（词库打包在扩展内，不联网）；油猴版启动时自动拉取最新词库（主 GitHub raw → 备 jsDelivr），不上传任何数据
- 动态内容监听：搜索建议、切换标签、异步加载的内容自动翻译
- 页面内浮动按钮「译」：暂停/启用汉化、采集未翻译文本
- 词库 2,300+ 条（global 1,570 / pages 684 / attrs 43 / regex 66），覆盖 SteamDB 主要固定界面文本
- 只改写界面文本：自动跳过代码块、可编辑区、超长文本，不翻译游戏名和商店介绍

## 术语口径

- 优先采用 Steam 官方简体中文译法（商店、库、愿望单、免费开玩、完全支持控制器）
- `SUB`、`Depot`、`AppID` 等技术标识保留社区惯用名
- `FPS`、`RPG`、`PvP` 等类型缩写按社区惯例保留英文

## 词条来源说明

词库全部为原创译文，无外来版权负担：

- 短词条（`Monday`→星期一、`Yes`→是）属事实性译法，翻译空间极小，任何译者产出相同，不构成版权问题
- Steam 官方标准术语（完全支持控制器、部分支持控制器）按 Valve 官方译法采用
- 长句与短语均为独立措辞的原创翻译，已通过自动化审计排除与既有汉化脚本雷同
- 代码字段名、品牌/游戏名、句子片段不收入词库
- 词库外置 + CDN 托管的技术方案思路参考了 Chr_ 的 SteamDB_CN 用户脚本；词库内容与翻译引擎均为本项目原创

## 安装

**油猴脚本版**（Tampermonkey / Violentmonkey）：

- 直接安装：<https://raw.githubusercontent.com/Acetab/steamdb-zh-cn/main/dist/steamdb-zh-cn.user.js>

安装后打开 `steamdb.info`，右下角出现「译」按钮即生效。油猴版启动时**自动拉取最新词库**（本地缓存兜底，无需手动重装即可获得词库更新），不上传任何数据。

**扩展版**（Chrome / Edge / Steam 客户端内置浏览器）：

- 本地构建产物：`npm run build` 后取 `build/` 目录（「加载已解压的扩展程序」）或 `build/steamdb-zh-cn-<版本>.zip` / `.crx`
- 打开 `chrome://extensions` → 开启开发者模式 → 「加载已解压的扩展程序」选择 `build/` 目录，或直接拖入 `.crx`

## 构建

```bash
npm run build
```

依次执行：合并词库（`dictionary/` → `translations.zh-CN.json`）→ 词库审计 → 语法检查 → 打包。产物均在 `build/` 目录：

| 文件 | 说明 |
|---|---|
| `steamdb-zh-cn-<版本>.user.js` | 油猴脚本版（词库 @resource 外置） |
| `steamdb-zh-cn-<版本>.zip` / `.crx` | 扩展分发包 |
| `content.js` / `manifest.json` | 未打包扩展目录，供「加载已解压」 |

## 词库维护

词库源文件按页面拆分在 `dictionary/` 目录：

```
dictionary/
├── global.json     # 全局通用词条
├── attrs.json      # placeholder/aria-label/title 属性词条
├── regex.json      # 带数字/日期的锚定文本
└── pages/          # 按路径前缀分组，如 app.json、charts.json
```

补词流程：采集未翻译文本（「译」菜单）或保存页面 HTML 到 `html-dump/` 后用 `node tools/extract-untracked.mjs` 扫描 → 筛选后加入对应文件 → `npm run build` → 提交（`translations.zh-CN.json` 为发布文件，需一并提交，供油猴加载）。

油猴版词库加载机制：启动时先用本地缓存（GM 存储，首次安装为 `@resource` 快照）立即翻译，同时按**源列表依次拉取**最新词库——主源 GitHub raw（push 即最新、无缓存延迟），失败自动切备用源 jsDelivr（国内快，接受短暂缓存滞后），全部失败回退本地缓存。成功后应用并自动重译当前页——**改词库后无需重装脚本，刷新页面即生效**。

## 自动发布（可选）

推送 `v*` 标签触发 GitHub Actions 构建并发布 Release（zip / crx / user.js 三件套），仅在有分发需求时使用：

```bash
git tag v1.0.x && git push --tags
```

## 协议

MIT License。本项目为全新开发，翻译引擎与词库均为本项目原创。
