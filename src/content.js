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
    dictCache: "sdbcn2_dict_cache",
    sourceMode: "sdbcn2_source_mode",
  };
  const MAX_TEXT = 500; // 超过该长度的文本不处理（长段内容多为介绍/描述）
  const SKIP_SELECTOR = [
    "script", "style", "noscript", "pre", "code", "kbd", "svg", "canvas",
    "video", "textarea", '[contenteditable="true"]', '[translate="no"]', ".notranslate",
    '[contenteditable=""]', '[contenteditable="plaintext-only"]',
    'a[href^="/app/"]', 'a[href^="/sub/"]', 'a[href^="/depot/"]', 'a[href^="/bundle/"]',
    'a[href*="steamdb.info/app/"]', 'a[href*="steamcommunity.com/profiles/"]',
    '.app-name', '.username', '.user-content', '[data-user-content]',
  ].join(",");
  // 通用词条仅应用于界面控件；普通段落、数据单元格和主标题需明确上下文规则。
  const UI_TEXT_SCOPE = 'button,label,legend,summary,option,th,dt,h2,h3,h4,nav,footer,'+
    '[role="button"],[role="tab"],[role="menuitem"],[role="navigation"],'+
    '.dropdown-menu,.panel-heading,.tabnav,.nav';
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
  let activeDictionary = null;
  const translatedTexts = new WeakMap();
  const translatedAttributes = new WeakMap();

  // 词库来源：油猴构建版会在脚本顶部注入 EMBEDDED_DICTIONARY（内嵌词库，自包含）；
  // 扩展版从扩展资源加载。两者共用同一套索引逻辑。
  function resourceUrl(name) {
    return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
      ? chrome.runtime.getURL(name)
      : name;
  }

  function validateDictionary(raw, remote = false) {
    const record=v=>v && typeof v==='object' && !Array.isArray(v);
    const terms=v=>record(v) && Object.entries(v).every(([k,t])=>k.trim() && typeof t==='string' && t.trim());
    if(!record(raw)||!terms(raw.global)||!terms(raw.attrs)||!Array.isArray(raw.pages)||!Array.isArray(raw.regex))throw Error('词库结构不完整');
    if(remote && !/^\d+\.\d+\.\d+$/.test(raw.meta?.version||''))throw Error('远程词库缺少有效版本');
    for(const page of raw.pages)if(!record(page)||typeof page.path!=='string'||!page.path.startsWith('/')||!terms(page.terms))throw Error('页面词库无效');
    for(const rule of raw.regex){
      if(!record(rule)||typeof rule.source!=='string'||typeof rule.target!=='string')throw Error('正则词库无效');
      new RegExp(rule.source);
    }
    if(raw.contexts!==undefined){
      if(!Array.isArray(raw.contexts))throw Error('上下文词库无效');
      for(const r of raw.contexts)if(!record(r)||typeof r.selector!=='string'||!r.selector.trim()||!terms(r.terms)||
        (r.path!==undefined&&(typeof r.path!=='string'||!r.path.startsWith('/')))||
        (r.attribute!==undefined&&!['title','placeholder','aria-label'].includes(r.attribute)))throw Error('上下文规则无效');
    }
    return raw;
  }
  function isOlderDictionary(candidate,current){
    const parse=v=>/^\d+\.\d+\.\d+$/.test(v||'')?v.split('.').map(Number):null;
    const a=parse(candidate?.meta?.version),b=parse(current?.meta?.version);
    if(!a || !b)return false;
    for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]<b[i];
    const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?v:null;
    const ad=date(candidate.meta.updatedAt),bd=date(current.meta.updatedAt);
    return Boolean(ad&&bd&&ad<bd);
  }
  function applyDictionary(raw) {
    validateDictionary(raw);
    // key 统一存归一化形式（折叠空白 + 弯直引号统一），与页面文本比较时同空间
    const normMap = (obj) =>
      new Map(Object.entries(obj || {}).map(([k, v]) => [normalize(k), v]));
    const global = normMap(raw.global);
    const attrs = normMap(raw.attrs);
    const candidates = (raw.pages || [])
      .filter((p) => typeof p.path === "string")
      .map((p) => ({ path: p.path, terms: normMap(p.terms) }))
      .sort((a, b) => b.path.length - a.path.length);
    const page = candidates.find((p) => location.pathname.startsWith(p.path));
    const regex = (raw.regex || [])
      .filter((r) => r && typeof r.source === "string" && typeof r.target === "string")
      .map((r) => [new RegExp(r.source), r.target]);
    const contextSource = Array.isArray(raw.contexts) ? raw.contexts :
      (typeof DEFAULT_CONTEXTS !== 'undefined' ? DEFAULT_CONTEXTS : []);
    const contexts = contextSource.filter(r => r && typeof r.selector === 'string' &&
      (!r.path || location.pathname.startsWith(r.path))).map(r => ({...r, terms:normMap(r.terms)}));
    index = { global, page: page ? page.terms : null, attrs, regex, contexts, pathname:location.pathname };
    activeDictionary = raw;
  }

  // 油猴远程词库源列表（由构建脚本注入顶层 `const REMOTE_DICT_URLS = [...]`；扩展版无此变量，
  // 主源 GitHub raw（push 即最新），备用源 jsDelivr（国内快，接受短暂缓存滞后）。
  // 此处用不同变量名避免与注入的 const 触发暂时性死区）
  const remoteDictUrls =
    typeof REMOTE_DICT_URLS !== "undefined" && Array.isArray(REMOTE_DICT_URLS)
      ? REMOTE_DICT_URLS
      : [];
  const sourceModes={auto:'自动（GitHub → jsDelivr）',github:'仅 GitHub',jsdelivr:'仅 jsDelivr',local:'仅本地词库'};
  function readSourceMode(){
    try {
      const mode=typeof GM_getValue==='function'?GM_getValue(STORAGE.sourceMode,'auto'):localStorage.getItem(STORAGE.sourceMode);
      return Object.hasOwn(sourceModes,mode)?mode:'auto';
    } catch {return 'auto';}
  }
  function selectedSources(mode){
    if(mode==='local')return [];
    if(mode==='github')return remoteDictUrls.filter(url=>new URL(url).hostname==='raw.githubusercontent.com');
    if(mode==='jsdelivr')return remoteDictUrls.filter(url=>new URL(url).hostname==='cdn.jsdelivr.net');
    return remoteDictUrls;
  }
  function setSourceMode(mode){
    if(typeof GM_setValue==='function')GM_setValue(STORAGE.sourceMode,mode);
    else localStorage.setItem(STORAGE.sourceMode,mode);
    location.reload();
  }
  function registerSourceSettings(){
    if(!remoteDictUrls.length || typeof GM_registerMenuCommand!=='function')return;
    for(const [mode,label] of Object.entries(sourceModes)){
      GM_registerMenuCommand(`${readSourceMode()===mode?'✓ ':''}词库来源：${label}`,()=>setSourceMode(mode));
    }
  }

  // 油猴本地词库缓存（GM 存储，跨页面共享）
  function loadCachedDict() {
    if (typeof GM_getValue !== "function") return null;
    try {
      const raw = GM_getValue(STORAGE.dictCache, "");
      return raw ? validateDictionary(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  function saveCachedDict(raw) {
    if (typeof GM_setValue !== "function") return;
    try {
      GM_setValue(STORAGE.dictCache, JSON.stringify(raw));
    } catch (err) {
      console.warn("[SteamDB CN] 词库缓存写入失败。", err);
    }
  }

  // 油猴：按源列表依次拉取最新词库，成功后应用并重译当前页（全部失败静默回退本地缓存）
  function refreshRemoteDict() {
    const sources=selectedSources(readSourceMode());
    if (!sources.length || typeof GM_xmlhttpRequest !== "function") return;
    let idx = 0;
    const tryNext = () => {
      if (idx >= sources.length) return; // 当前模式的源全部失败，继续用本地缓存
      const url = sources[idx++];
      GM_xmlhttpRequest({
        method: "GET",
        url,
        timeout: 10000,
        onload(res) {
          if (res.status < 200 || res.status >= 300) {
            console.warn(`[SteamDB CN] 词库源 ${url} 失败 HTTP ${res.status}，尝试下一个。`);
            tryNext();
            return;
          }
          try {
            const raw = validateDictionary(JSON.parse(res.responseText),true);
            if(isOlderDictionary(raw,activeDictionary)){
              console.warn('[SteamDB CN] 忽略旧版本词库，保留当前词库。');tryNext();return;
            }
            applyDictionary(raw);
            saveCachedDict(raw);
            console.info("[SteamDB CN] 词库已远程更新，重新翻译页面。");
            scan(document.body || document.documentElement);
          } catch (err) {
            console.warn("[SteamDB CN] 远程词库解析失败，尝试下一个源。", err);
            tryNext();
          }
        },
        onerror() {
          console.warn(`[SteamDB CN] 词库源 ${url} 请求失败，尝试下一个。`);
          tryNext();
        },
        ontimeout() {
          console.warn(`[SteamDB CN] 词库源 ${url} 超时，尝试下一个。`);
          tryNext();
        },
      });
    };
    tryNext();
  }

  function loadDictionary() {
    // 1) 内嵌词库：扩展版构建时注入
    const embedded = typeof EMBEDDED_DICTIONARY !== "undefined" ? EMBEDDED_DICTIONARY : null;
    if (embedded) {
      applyDictionary(embedded);
      return Promise.resolve();
    }
    // 2) 油猴：本地词库立即生效（GM 缓存 → @resource），随后异步拉取最新
    if (typeof GM_xmlhttpRequest === "function") {
      const cached = loadCachedDict();
      if (cached) {
        applyDictionary(cached);
      }
      if (typeof GM_getResourceText === "function") {
        try {
          const text = GM_getResourceText("dictTranslations");
          if (text) {
            const snapshot=validateDictionary(JSON.parse(text));
            if(!activeDictionary || !isOlderDictionary(snapshot,activeDictionary))applyDictionary(snapshot);
          }
        } catch (err) {
          console.warn("[SteamDB CN] @resource 词库解析失败。", err);
        }
      }
      if (!index) applyDictionary({global:{},attrs:{},pages:[],regex:[]});
      refreshRemoteDict();
      return Promise.resolve();
    }
    // 3) 无 GM_xmlhttpRequest 的油猴环境：@resource
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
    // 4) 远程 fetch 兜底
    return fetch(resourceUrl("translations.zh-CN.json"))
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(applyDictionary)
      .catch((err) => {
        console.warn("[SteamDB CN] 词库加载失败，本页保持英文。", err);
        applyDictionary({global:{},attrs:{},pages:[],regex:[]});
      });
  }

  // ================= 通用工具 =================

  // 归一化：空白折叠 + 弯直引号统一（页面常使用弯引号 ' ' " "，词库 key 用直引号）
  const normalize = (text) =>
    text
      .replace(/\s+/g, " ")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .trim();
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

  function lookupContext(text, element, attribute = null) {
    if (!element) return null;
    for (const rule of index.contexts || []) {
      if ((rule.attribute || null) !== attribute) continue;
      try {
        if (element.closest(rule.selector)) {
          const result=pickTerm(text,rule.terms);
          if(result !== null)return result;
        }
      } catch { /* 单条无效选择器不能中断其他翻译。 */ }
    }
    return null;
  }
  function lookup(text, element = null) {
    const contextual=lookupContext(text,element);
    if(contextual !== null)return contextual;
    if(element && !element.closest(UI_TEXT_SCOPE))return null;
    const direct = pickTerm(text, index.page) || pickTerm(text, index.global);
    if (direct) return direct;
    for (const [pattern, target] of index.regex) {
      if (pattern.test(text)) return text.replace(pattern, target);
    }
    return null;
  }

  // ================= 页面改写 =================

  // 内联标签（包裹单词/短语会拆分文本节点，需要拼接匹配）
  const INLINE_TAGS = new Set(["b", "strong", "em", "i", "span", "u", "small", "mark", "s"]);

  // 递归收集元素内的叶子文本节点（仅文本 + 内联标签；遇到 <a> 或块级元素返回 false）
  function collectInlineLeaves(el, out) {
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.nodeValue.trim()) out.push(child);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (tag === "a" || !INLINE_TAGS.has(tag)) return false;
        if (!collectInlineLeaves(child, out)) return false;
      } else {
        return false;
      }
    }
    return true;
  }

  // 从节点向左右扩展相邻内联文本（遇 <a>/块级/含中文的已翻译文本即停止），用于拼接匹配
  function expandInlineLeaves(node, out) {
    let cur = node.previousSibling;
    while (cur) {
      if (cur.nodeType === Node.TEXT_NODE) {
        if (!cur.nodeValue.trim()) { cur = cur.previousSibling; continue; }
        if (hasCjk(cur.nodeValue)) break; // 已翻译的中文，不再跨过
        out.unshift(cur);
      } else if (cur.nodeType === Node.ELEMENT_NODE) {
        const tag = cur.tagName.toLowerCase();
        if (tag === "a" || !INLINE_TAGS.has(tag)) break;
        const inner = [];
        if (!collectInlineLeaves(cur, inner)) break;
        if (inner.some((n) => hasCjk(n.nodeValue))) break;
        for (const n of inner.reverse()) out.unshift(n);
      } else break;
      cur = cur.previousSibling;
    }
    cur = node.nextSibling;
    while (cur) {
      if (cur.nodeType === Node.TEXT_NODE) {
        if (!cur.nodeValue.trim()) { cur = cur.nextSibling; continue; }
        if (hasCjk(cur.nodeValue)) break;
        out.push(cur);
      } else if (cur.nodeType === Node.ELEMENT_NODE) {
        const tag = cur.tagName.toLowerCase();
        if (tag === "a" || !INLINE_TAGS.has(tag)) break;
        const inner = [];
        if (!collectInlineLeaves(cur, inner)) break;
        if (inner.some((n) => hasCjk(n.nodeValue))) break;
        out.push(...inner);
      } else break;
      cur = cur.nextSibling;
    }
  }

  // 拼接匹配：内联标签拆分的多个文本节点，拼成完整文本查词库，命中后按原文比例回填
  function tryInlineTranslate(node) {
    const leaves = [node];
    expandInlineLeaves(node, leaves);
    if (leaves.length < 2) return false;
    const full = leaves.map((n) => n.nodeValue).join("");
    const bare = normalize(full);
    if (bare.length <= 1 || bare.length > MAX_TEXT) return false;
    const translated = lookup(bare, node.parentElement);
    if (!translated || translated === bare) return false;
    const total = full.length;
    let idx = 0;
    leaves.forEach((n, i) => {
      const take = Math.round((translated.length * n.nodeValue.length) / total);
      n.nodeValue = translated.slice(idx, idx + take);
      idx += take;
      if (i === leaves.length - 1) n.nodeValue += translated.slice(idx);
    });
    return true;
  }

  function translateText(node) {
    const current = node.nodeValue;
    const previous = translatedTexts.get(node);
    const raw = previous && current === previous.output ? previous.original : current;
    if (!raw || raw.length > MAX_TEXT || isSkipped(node)) return;
    const translated = lookup(raw, node.parentElement);
    if (translated && translated !== raw) {
      if(current !== translated)node.nodeValue = translated;
      translatedTexts.set(node,{original:raw,output:translated});
      dropCollected(raw);
      return;
    }
    // 单节点未命中：尝试内联拼接匹配（处理 <b>/<span> 等标签拆分的文本）
    if(previous && current === previous.output){node.nodeValue=raw;translatedTexts.delete(node);}
    tryInlineTranslate(node);
  }

  function translateAttribute(el, name) {
    const current = el.getAttribute(name);
    const records = translatedAttributes.get(el);
    const previous = records && records.get(name);
    const raw = previous && current === previous.output ? previous.original : current;
    if (!raw) return;
    const translated = lookupContext(raw,el,name) || pickTerm(raw, index.attrs) || lookup(raw);
    if (translated && translated !== raw) {
      if(current !== translated)el.setAttribute(name, translated);
      const next=records || new Map();next.set(name,{original:raw,output:translated});translatedAttributes.set(el,next);
    } else if(previous && current === previous.output){
      if(current !== raw)el.setAttribute(name,raw);
      records.delete(name);
    }
  }

  // 扫描一个根节点：先文本节点，再常见属性
  function scan(root) {
    if (activeDictionary && index.pathname !== location.pathname) applyDictionary(activeDictionary);
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
    // querySelectorAll 仅返回后代；动态属性变化的根控件也必须检查。
    if (root.nodeType === Node.ELEMENT_NODE) {
      translateAttribute(root, "placeholder");
      translateAttribute(root, "aria-label");
      translateAttribute(root, "title");
    }
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

  registerSourceSettings();
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
  window.addEventListener('popstate',()=>scan(document.body || document.documentElement));
  window.addEventListener('pageshow',()=>scan(document.body || document.documentElement));
  console.info(`[SteamDB CN ${VERSION}] 就绪：全局 ${index.global.size} 条，当前页 ${index.page ? index.page.size : 0} 条，属性 ${index.attrs.size} 条。`);
})();
