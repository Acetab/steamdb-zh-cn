// ==UserScript==
// @name          SteamDB 中文汉化
// @namespace     steamdb-zh-cn.local
// @version        1.0.0
// @description   SteamDB 网页简体中文汉化（非官方，MIT）
// @author        steamdb-zh-cn contributors
// @match         https://steamdb.info/*
// @run-at        document-idle
// @grant         GM_getResourceText
// @resource      dictTranslations https://cdn.jsdelivr.net/gh/Acetab/steamdb-zh-cn@5942d20b9e61d0380a0ebee838ea890e84251b23/translations.zh-CN.json
// @connect       cdn.jsdelivr.net
// @license       MIT
// ==/UserScript==

/*!
 * SteamDB 简体中文界面汉化 —— 非官方扩展
 *
 * 在 SteamDB 网页上把常见界面文本改写为简体中文。
 * 词库随扩展分发（translations.zh-CN.json），运行时在页面本地完成改写，
 * 不发起任何网络请求，不上传任何数据。启用状态与采集数据仅存于本机 localStorage。
 *
 * MIT License，本项目与 steamdb.info 官方及其扩展无任何关联。
 */

(async () => {
  "use strict";

  // ================= 配置 =================

  const VERSION = "1.0.0";
  const STORAGE = {
    off: "sdbcn2_off",
    collect: "sdbcn2_collect_enabled",
    data: "sdbcn2_collected_data",
  };
  const MAX_TEXT = 500; // 超过该长度的文本不处理（长段内容多为介绍/描述）
  const SKIP_SELECTOR = [
    "script", "style", "noscript", "pre", "code", "kbd", "svg", "canvas",
    "video", "textarea", '[contenteditable="true"]', '[translate="no"]', ".notranslate",
  ].join(",");
  // 采集未翻译文本时，只关心这些常见界面控件
  const COLLECT_SCOPE = [
    "button", "a", "p", "li", "td", "th", "dt", "dd", "h1", "h2", "h3", "h4",
    "label", "legend", "summary", "option",
    "[role=tab]", "[role=menuitem]", "[aria-label]", "[placeholder]", "[title]",
  ].join(",");
  const BRAND_TERMS = new Set([
    "Steam", "SteamDB", "SteamDB.info", "Steam Web API", "Discord", "Bluesky",
    "Mastodon", "macOS", "Linux", "Windows", "iOS", "Android", "Nintendo",
    "PlayStation", "Xbox", "Epic", "GOG", "Game Pass", "Twitch", "YouTube",
  ]);
  const EMOJI_PREFIX = /^((?:\p{Extended_Pictographic}|\uFE0F|\u200D|\u20E3|\s)+)(.+)$/u;

  // ================= 词库 =================

  let index = null; // { global: Map, page: Map|null, attrs: Map }

  // 词库来源：油猴构建版会在脚本顶部注入 EMBEDDED_DICTIONARY（内嵌词库，自包含）；
  // 扩展版从扩展资源加载。两者共用同一套索引逻辑。
  function resourceUrl(name) {
    return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
      ? chrome.runtime.getURL(name)
      : name;
  }

  function applyDictionary(raw) {
    const global = new Map(Object.entries(raw.global || {}));
    const attrs = new Map(Object.entries(raw.attrs || {}));
    const candidates = (raw.pages || [])
      .filter((p) => typeof p.path === "string")
      .map((p) => ({ path: p.path, terms: new Map(Object.entries(p.terms || {})) }))
      .sort((a, b) => b.path.length - a.path.length);
    const page = candidates.find((p) => location.pathname.startsWith(p.path));
    const regex = (raw.regex || [])
      .filter((r) => r && typeof r.source === "string" && typeof r.target === "string")
      .map((r) => [new RegExp(r.source), r.target]);
    index = { global, page: page ? page.terms : null, attrs, regex };
  }

  function loadDictionary() {
    // 1) 内嵌词库：扩展版构建时注入
    const embedded = typeof EMBEDDED_DICTIONARY !== "undefined" ? EMBEDDED_DICTIONARY : null;
    if (embedded) {
      applyDictionary(embedded);
      return Promise.resolve();
    }
    // 2) 油猴 @resource：避免脚本内嵌大块数据触发 Greasy Fork 的压缩代码规则
    if (typeof GM_getResourceText === "function") {
      try {
        const text = GM_getResourceText("dictTranslations");
        if (text) {
          applyDictionary(JSON.parse(text));
          return Promise.resolve();
        }
      } catch (err) {
        console.warn("[SteamDB CN] @resource 词库解析失败。", err);
      }
    }
    // 3) 远程 fetch 兜底
    return fetch(resourceUrl("translations.zh-CN.json"))
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(applyDictionary)
      .catch((err) => {
        console.warn("[SteamDB CN] 词库加载失败，本页保持英文。", err);
        applyDictionary({});
      });
  }

  // ================= 通用工具 =================

  const normalize = (text) => text.replace(/\s+/g, " ").trim();
  const isSkipped = (node) => {
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return !el || (node.nodeType === Node.TEXT_NODE && el.closest("textarea"))
      || Boolean(el.closest(SKIP_SELECTOR));
  };
  const hasLatin = (text) => /[A-Za-z]/.test(text);
  const hasCjk = (text) => /[\u3400-\u9fff]/.test(text);

  function pickTerm(text, map) {
    if (!map) return null;
    const key = map.get(text);
    if (key !== undefined) return key;
    const bare = normalize(text);
    if (bare !== text && map.has(bare)) return map.get(bare);
    // SteamDB 新版筛选器会在标签名前加装饰性 emoji，词条仍以原始名称保存
    const decorated = bare.match(EMOJI_PREFIX);
    if (decorated && map.has(decorated[2])) return decorated[1] + map.get(decorated[2]);
    return null;
  }

  function lookup(text) {
    const direct = pickTerm(text, index.page) || pickTerm(text, index.global);
    if (direct) return direct;
    for (const [pattern, target] of index.regex) {
      if (pattern.test(text)) return text.replace(pattern, target);
    }
    return null;
  }

  // ================= 页面改写 =================

  function translateText(node) {
    const raw = node.nodeValue;
    if (!raw || raw.length > MAX_TEXT || isSkipped(node)) return;
    const translated = lookup(raw);
    if (translated && translated !== raw) {
      node.nodeValue = translated;
      dropCollected(raw);
    }
  }

  function translateAttribute(el, name) {
    const raw = el.getAttribute(name);
    if (!raw) return;
    const translated = pickTerm(raw, index.attrs) || lookup(raw);
    if (translated && translated !== raw) el.setAttribute(name, translated);
  }

  // 扫描一个根节点：先文本节点，再常见属性
  function scan(root) {
    if (!root || !root.isConnected || isSkipped(root)) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateText(root);
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (isSkipped(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let node;
    while ((node = walker.nextNode())) translateText(node);
    for (const el of root.querySelectorAll("input[placeholder],textarea[placeholder],[aria-label],[title]")) {
      if (isSkipped(el)) continue;
      translateAttribute(el, "placeholder");
      translateAttribute(el, "aria-label");
      translateAttribute(el, "title");
    }
  }

  // ================= 动态内容监听 =================

  const pending = new Set();
  let flushQueued = false;

  function enqueue(root) {
    const el = root.nodeType === Node.TEXT_NODE ? root.parentElement : root;
    if (!el || !el.isConnected || isSkipped(el)) return;
    for (const item of pending) {
      if (item === el || item.contains(el)) return;
      if (el.contains(item)) pending.delete(item);
    }
    pending.add(el);
    if (flushQueued) return;
    flushQueued = true;
    queueMicrotask(() => {
      flushQueued = false;
      for (const item of pending) scan(item);
      pending.clear();
    });
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") enqueue(record.target);
      else if (record.type === "attributes") enqueue(record.target);
      else for (const added of record.addedNodes) enqueue(added);
    }
  });

  // ================= 未翻译文本采集 =================

  let collected = null;
  let saveTimer = null;

  function readCollected() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE.data) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function isCollectable(text) {
    const bare = normalize(text);
    if (!hasLatin(bare) || bare.length < 3 || bare.length > 100) return false;
    if (hasCjk(bare) || BRAND_TERMS.has(bare)) return false;
    if (/^(?:https?:|[\d\W_]+$)/i.test(bare)) return false;
    if (/^[a-f\d]{16,}$/i.test(bare)) return false;
    return true;
  }

  function scheduleSave() {
    if (saveTimer !== null) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      localStorage.setItem(STORAGE.data, JSON.stringify(collected));
    }, 250);
  }

  function collectOnPage() {
    if (!collected) collected = readCollected();
    const path = location.pathname;
    if (!collected[path]) collected[path] = {};
    const bag = collected[path];
    for (const el of document.querySelectorAll(COLLECT_SCOPE)) {
      const values = [
        el.innerText,
        el.getAttribute("aria-label"),
        el.getAttribute("placeholder"),
        el.getAttribute("title"),
      ];
      for (const value of values) {
        const text = normalize(value || "");
        if (text && isCollectable(text)) bag[text] = "";
      }
    }
    scheduleSave();
    return Object.keys(bag).length;
  }

  function dropCollected(raw) {
    if (!collected) return;
    const bag = collected[location.pathname];
    if (!bag) return;
    const text = normalize(raw);
    if (Object.hasOwn(bag, text)) {
      delete bag[text];
      scheduleSave();
    }
  }

  function exportCollected(scope) {
    if (!collected) collected = readCollected();
    const pages = scope === "all"
      ? collected
      : { [location.pathname]: collected[location.pathname] || {} };
    const count = Object.values(pages)
      .reduce((sum, bag) => sum + Object.keys(bag).length, 0);
    copyToClipboard(JSON.stringify({
      version: VERSION,
      exportedAt: new Date().toISOString(),
      pages,
    }, null, 2));
    toast(`已复制 ${count} 条未翻译候选`);
  }

  function clearCollected() {
    if (!collected) collected = readCollected();
    if (!collected[location.pathname]) return;
    if (!confirm("清除当前页面路径下采集的未翻译候选？")) return;
    delete collected[location.pathname];
    localStorage.setItem(STORAGE.data, JSON.stringify(collected));
    toast("已清除当前路径的采集结果");
  }

  // ================= 页面内 UI（菜单 / 提示 / 剪贴板） =================

  function toast(message) {
    let el = document.getElementById("sdbcn2-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sdbcn2-toast";
      el.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1b2838;color:#fff;padding:8px 16px;border-radius:6px;font:13px/1.5 sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.35);opacity:0;transition:opacity .25s;pointer-events:none";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = "0"; }, 2500);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    } else {
      legacyCopy(text);
    }
  }

  function legacyCopy(text) {
    const box = document.createElement("textarea");
    box.value = text;
    box.setAttribute("readonly", "");
    box.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(box);
    box.select();
    try { document.execCommand("copy"); } catch (err) { console.warn("[SteamDB CN] 复制失败。", err); }
    box.remove();
  }

  function mountMenu(items) {
    const fab = document.createElement("button");
    fab.type = "button";
    fab.title = "SteamDB 简体中文";
    fab.textContent = "译";
    fab.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483646;width:44px;height:44px;border-radius:50%;border:0;background:#66c0f4;color:#1b2838;font:700 18px/1 sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4)";
    const panel = document.createElement("div");
    panel.style.cssText = "position:fixed;right:16px;bottom:70px;z-index:2147483647;display:none;min-width:200px;background:#fff;border:1px solid #c7d5e0;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.25);overflow:hidden;font:13px/1.5 sans-serif";
    for (const item of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = item.label;
      btn.style.cssText = "display:block;width:100%;padding:9px 14px;border:0;background:transparent;color:#1b2838;text-align:left;cursor:pointer;font:inherit";
      btn.addEventListener("mouseenter", () => { btn.style.background = "#e8f4fd"; });
      btn.addEventListener("mouseleave", () => { btn.style.background = "transparent"; });
      btn.addEventListener("click", () => { panel.style.display = "none"; item.run(); });
      panel.appendChild(btn);
    }
    fab.addEventListener("click", () => {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });
    document.addEventListener("click", (event) => {
      if (!panel.contains(event.target) && event.target !== fab) panel.style.display = "none";
    });
    (document.body || document.documentElement).append(fab, panel);
  }

  // ================= 启动 =================

  const off = localStorage.getItem(STORAGE.off) === "1";
  const collecting = localStorage.getItem(STORAGE.collect) === "1";
  collected = collecting ? readCollected() : null;

  mountMenu([
    {
      label: off ? "启用汉化" : "暂停汉化",
      run() {
        localStorage.setItem(STORAGE.off, off ? "0" : "1");
        location.reload();
      },
    },
    {
      label: "采集当前页未翻译文本",
      run() {
        const count = collectOnPage();
        copyToClipboard(JSON.stringify({
          page: location.href,
          collectedAt: new Date().toISOString(),
          texts: Object.keys(collected[location.pathname] || {}).sort((a, b) => a.localeCompare(b, "en")),
        }, null, 2));
        toast(`已复制当前页 ${count} 条未翻译候选`);
      },
    },
    {
      label: collecting ? "停止自动采集" : "开启自动采集",
      run() {
        localStorage.setItem(STORAGE.collect, collecting ? "0" : "1");
        location.reload();
      },
    },
    ...(collecting ? [
      {
        label: "复制当前路径采集结果",
        run: () => exportCollected("current"),
      },
      {
        label: "复制全部采集结果",
        run: () => exportCollected("all"),
      },
      { label: "清除当前路径采集结果", run: clearCollected },
    ] : []),
    { label: "刷新页面", run: () => location.reload() },
  ]);

  if (off) {
    console.info(`[SteamDB CN ${VERSION}] 已暂停（本地开关）。`);
    return;
  }

  await loadDictionary();

  document.documentElement.lang = "zh-CN";
  scan(document.body || document.documentElement);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["placeholder", "aria-label", "title"],
  });
  console.info(`[SteamDB CN ${VERSION}] 就绪：全局 ${index.global.size} 条，当前页 ${index.page ? index.page.size : 0} 条，属性 ${index.attrs.size} 条。`);
})();
