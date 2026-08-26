# AGENTS.md — SteamDB 中文汉化（非官方）

## 定位

把 SteamDB（steamdb.info）界面文本改写为简体中文的浏览器扩展 + 油猴脚本双产物。非官方、MIT、词库与引擎全部原创（无 Chr_ 脚本衍生负担）。

## 怎么跑

```bash
npm run build    # 合并词库 → 审计 → 语法检查 → 打包（build/、dist/）
npm run check    # 语法 + 运行时冒烟测试（tools/test-run.mjs）
npm run audit    # 仅词库审计
```

发布：`git tag v1.0.x && git push --tags` → GitHub Actions 自动构建并发布 Release。

## 技术栈

- MV3 扩展（content script）+ 油猴脚本双产物，同一份引擎 `src/content.js` 构建生成。
- 零依赖 Node 构建（`tools/build.mjs`），词库 JSON 外置（油猴 @resource + 启动时多源拉取：主 GitHub raw → 备 jsDelivr → 本地缓存兜底）。

## 目录与约定

| 路径 | 说明 |
|---|---|
| `src/content.js` | 引擎（词库加载/匹配/改写）。**改动引擎后用户必须重装脚本** |
| `dictionary/` | 词库源（global/attrs/regex + pages/），补词改这里 |
| `translations.zh-CN.json` | 发布词库（构建合并生成，必须提交） |
| `dist/steamdb-zh-cn.user.js` | 油猴安装链接指向的固定路径副本（必须提交） |
| `build/` `keys/` `html-dump/` | gitignored：构建产物、签名密钥、用户保存的页面快照 |
| `tools/` | 构建/审计/冒烟/HTML 扫描（extract-untracked.mjs） |

- 引擎能力：弯直引号归一化、内联标签（`<b>`/`<span>`）拆分文本自动拼接翻译、MutationObserver 动态监听、漏译采集。
- 术语口径：Steam 官方译法优先；`SUB`/`Depot`/`AppID` 保留原名；FPS/RPG 等缩写保留英文；不翻译游戏名/用户名/动态数据。

## 当前状态（2026-08-26）

- 最新发布 v1.0.5；词库 global 1570 / pages 684 / attrs 43 / regex 66。
- 补词工作流：用户保存页面 HTML 到 `html-dump/` → `node tools/extract-untracked.mjs` 提取未收录英文 → 人工筛选 → 补 `dictionary/` → build → push（用户刷新页面即生效）。
- 下一步：继续按需补词；如需上商店（CWS/Edge）用 build/ zip 打包。
