// 运行时冒烟测试：mock 浏览器 + GM 环境，执行构建产物确认启动不崩溃
import { readFile } from "node:fs/promises";

const code = await readFile(new URL("../dist/steamdb-zh-cn.user.js", import.meta.url), "utf8");
const js = code.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\n\n/, "");

const makeEl = () => ({
  style: {},
  textContent: "",
  innerHTML: "",
  className: "",
  appendChild() {},
  addEventListener() {},
  setAttribute() {},
  closest: () => null,
  querySelectorAll: () => [],
  remove() {},
});

globalThis.document = {
  documentElement: { lang: "", isConnected: true, appendChild() {}, append() {} },
  body: {
    isConnected: true,
    querySelectorAll: () => [],
    appendChild() {},
    addEventListener() {},
    append() {},
  },
  createElement: () => makeEl(),
  createTreeWalker: () => ({ nextNode: () => null }),
  addEventListener() {},
};
globalThis.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3, FILTER_ACCEPT: 1, FILTER_REJECT: 2, SHOW_TEXT: 4 };
globalThis.location = { pathname: "/sales/", reload() {} };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.MutationObserver = class { constructor() {} observe() {} };
globalThis.fetch = () => Promise.reject(new Error("no fetch in mock"));
globalThis.GM_getResourceText = () =>
  JSON.stringify({ global: { Test: "测试" }, pages: [], attrs: [], regex: [] });
globalThis.GM_xmlhttpRequest = () => {};
globalThis.GM_getValue = () => "";
globalThis.GM_setValue = () => {};

try {
  // 用间接 eval 避免当前模块作用域污染
  (0, eval)(js);
  // 等异步词库加载完成后确认
  await new Promise((r) => setTimeout(r, 300));
  console.log("PASS: 脚本启动无崩溃，异步流程执行完毕");
} catch (e) {
  console.log("FAIL: " + e.message);
  process.exit(1);
}
