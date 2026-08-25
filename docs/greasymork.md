# SteamDB 中文汉化

**GitHub**: https://github.com/Acetab/steamdb-zh-cn

## 短描述（脚本元数据 @description）

SteamDB 网页简体中文汉化。词库通过 @resource 加载，脚本本体小而清晰，2,000+ 词条。

## Greasy Fork 详细描述（Additional Info，Markdown）

---

# SteamDB 中文汉化

将 SteamDB（steamdb.info）网页界面翻译为简体中文的用户脚本。**非官方项目**，与 SteamDB 网站及其官方扩展无任何关联。

## 功能特性

- **覆盖 SteamDB 主要固定界面文本**：导航栏、数据表格、筛选器、货币/语言名称、FAQ、页面说明等，词库 2,000+ 条
- **动态内容监听**：搜索建议、切换标签、异步加载的内容也会自动翻译
- **完全本地运行**：词库通过 `@resource` 引用（不内嵌大块数据，符合 Greasy Fork 规则），安装后由油猴在本地缓存，不发起额外网络请求
- **页面内浮动菜单**（右下角「译」按钮）：暂停/启用汉化、采集未翻译文本（辅助补词）

## 安装

1. 浏览器安装 Tampermonkey 或 Violentmonkey 扩展
2. 点击本页右上角「安装此脚本」
3. 打开或刷新 <https://steamdb.info/>，页面右下角出现「译」按钮即生效

## 词库与更新

词库作为独立 JSON 通过 `@resource` 引用，托管在 jsDelivr CDN（指向 GitHub 仓库的 `translations.zh-CN.json`，按版本精确引用）。油猴在脚本安装时下载并缓存到本地，运行期不联网。词库更新只需等下一次脚本更新即可获取。

> 词库外置 + CDN 托管的方案思路参考了 Chr_ 的 SteamDB_CN 用户脚本；词库内容与翻译引擎均为本项目原创。

## 术语口径

优先采用 Steam 官方简体中文译法（如 商店、库、愿望单、免费开玩、完全支持控制器）；`SUB`、`Depot`、`AppID` 等技术标识保留社区惯用名；游戏类型缩写（FPS、RPG 等）按惯例保留英文。

## 与官方 SteamDB 扩展的区别

- 本脚本只做**界面汉化**，不提供史低价格、在线人数等附加功能
- 词库自包含（通过 @resource 引用），安装后离线可用
- 开源（MIT License），GitHub 仓库：<https://github.com/Acetab/steamdb-zh-cn>

## 免责声明

SteamDB 网站与 Valve / Steam 无关。本脚本为社区爱好者作品，与 SteamDB 官方及其扩展无任何关联，不提供任何下载或交易功能。

## 反馈

- GitHub Issues: <https://github.com/Acetab/steamdb-zh-cn/issues>
- 遇到未翻译的界面文本，可打开「译」菜单 →「采集当前页未翻译文本」后提交
