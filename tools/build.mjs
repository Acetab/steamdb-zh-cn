// 构建 SteamDB 简体中文界面汉化扩展（MV3），输出 ZIP 与 CRX3。
// 用法：npm run build
// 产物：
//   build/                                 可直接以“加载已解压的扩展程序”加载
//   build/steamdb-zh-cn-<v>.zip
//   build/steamdb-zh-cn-<v>.crx 带 RSA 签名的 CRX3（首次运行生成 keys/extension.pem）

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { auditDictionary } from "./audit.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const contentJs = await readFile(path.join(root, "src", "content.js"), "utf8");
const rawDict = JSON.parse(await readFile(path.join(root, "translations.zh-CN.json"), "utf8"));
const buildDir = path.join(root, "build");
const keysDir = path.join(root, "keys");
const keyPath = path.join(keysDir, "extension.pem");

// 词库 CDN：jsDelivr 托管 GitHub 文件。用当前 commit 精确定位，
// 避免 @main 分支的 CDN 缓存延迟导致用户拿到旧词库。
// （词库外置 + CDN 托管的方案思路参考了 Chr_ 的 SteamDB_CN 用户脚本；词库内容为本项目原创。）
let dictResourceUrl;
try {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  dictResourceUrl = `https://cdn.jsdelivr.net/gh/Acetab/steamdb-zh-cn@${commit}/translations.zh-CN.json`;
} catch {
  dictResourceUrl = "https://cdn.jsdelivr.net/gh/Acetab/steamdb-zh-cn@main/translations.zh-CN.json";
}

// ---------- 校验 ----------

function assert(condition, message) {
  if (!condition) throw new Error(`build: ${message}`);
}

assert(manifest.manifest_version === 3, "manifest 必须是 MV3");
assert(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length > 0, "manifest 缺少 content_scripts");
assert(typeof rawDict.global === "object" && rawDict.global !== null, "词库缺少 global");
assert(Array.isArray(rawDict.pages), "词库缺少 pages 数组");
assert(typeof rawDict.attrs === "object" && rawDict.attrs !== null, "词库缺少 attrs");
for (const entry of rawDict.pages) {
  assert(typeof entry.path === "string" && entry.path.startsWith("/"), `pages 条目缺少有效 path：${JSON.stringify(entry)}`);
  assert(typeof entry.terms === "object" && entry.terms !== null, `pages 条目 ${entry.path} 缺少 terms`);
}
for (const [source, target] of Object.entries(rawDict.global)) {
  assert(source.trim().length > 0, "global 存在空词条");
  assert(typeof target === "string" && target.trim().length > 0, `global 词条 "${source}" 的译文为空`);
}
for (const entry of rawDict.pages) {
  for (const [source, target] of Object.entries(entry.terms)) {
    assert(typeof target === "string" && target.trim().length > 0, `pages[${entry.path}] 词条 "${source}" 的译文为空`);
  }
}

// 深度词库审计：错误阻断构建，警告仅提示
const { errors: auditErrors, warnings: auditWarnings } = auditDictionary(rawDict);
if (auditWarnings.length) {
  console.log(`⚠️ 词库审计 ${auditWarnings.length} 条警告：`);
  for (const warning of auditWarnings) console.log(`  - ${warning}`);
}
if (auditErrors.length) {
  throw new Error(`词库审计失败（${auditErrors.length} 条）：\n  ${auditErrors.join("\n  ")}`);
}

// ---------- 最小 ZIP 写入器（STORE，零依赖） ----------

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    local.push(localHeader, nameBuf, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(0, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBuf.length, 28);
    entry.writeUInt16LE(0, 30);
    entry.writeUInt16LE(0, 32);
    entry.writeUInt16LE(0, 34);
    entry.writeUInt16LE(0, 36);
    entry.writeUInt32LE(0, 38);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const centralStart = offset;
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...local, centralBuf, eocd]);
}

// ---------- CRX3 打包 ----------

function pbVarint(value) {
  const bytes = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value = Math.floor(value / 128);
  }
  bytes.push(value);
  return Buffer.from(bytes);
}

function pbFieldBytes(field, data) {
  const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return Buffer.concat([pbVarint((field << 3) | 2), pbVarint(dataBuf.length), dataBuf]);
}

function buildCrx3(zipBuffer, privateKeyPem) {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const publicKeyDer = crypto.createPublicKey(privateKey).export({ type: "spki", format: "der" });
  const crxId = crypto.createHash("sha256").update(publicKeyDer).digest().subarray(0, 16);
  const zipHash = crypto.createHash("sha256").update(zipBuffer).digest();
  const signedData = Buffer.concat([
    Buffer.from("CRX3", "ascii"),
    pbFieldBytes(1, crxId),
    pbFieldBytes(2, zipHash),
  ]);
  const signature = crypto.sign("sha256", signedData, privateKey);
  const proof = Buffer.concat([pbFieldBytes(1, publicKeyDer), pbFieldBytes(2, signature)]);
  const header = Buffer.concat([pbFieldBytes(2, proof), pbFieldBytes(10000, signedData)]);
  const head = Buffer.alloc(12);
  head.write("Cr24", 0, "ascii");
  head.writeUInt32LE(3, 4);
  head.writeUInt32LE(header.length, 8);
  return { crxId: crxId.toString("hex"), buffer: Buffer.concat([head, header, zipBuffer]) };
}

// ---------- 主流程 ----------

// 覆盖写即可：build/ 是 gitignored 的生成目录，产物文件名固定
await mkdir(buildDir, { recursive: true });

const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
const translationsText = `${JSON.stringify(rawDict, null, 2)}\n`;
await writeFile(path.join(buildDir, "manifest.json"), manifestText, "utf8");
await writeFile(path.join(buildDir, "content.js"), contentJs, "utf8");
await writeFile(path.join(buildDir, "translations.zh-CN.json"), translationsText, "utf8");

// 语法检查
execFileSync(process.execPath, ["--check", path.join(buildDir, "content.js")], { stdio: "inherit" });

// ---------- 油猴版（词库外置以避开 Greasy Fork 的压缩代码规则：@resource 指向 GitHub raw） ----------

const userscriptHeader = [
  "// ==UserScript==",
  "// @name          SteamDB 中文汉化",
  "// @namespace     steamdb-zh-cn.local",
  `// @version        ${pkg.version}`,
  "// @description   SteamDB 网页简体中文汉化（非官方，MIT）",
  "// @author        steamdb-zh-cn contributors",
  "// @match         https://steamdb.info/*",
  "// @run-at        document-idle",
  "// @grant         GM_getResourceText",
  `// @resource      dictTranslations ${dictResourceUrl}`,
  "// @connect       cdn.jsdelivr.net",
  "// @license       MIT",
  "// ==/UserScript==",
  "",
].join("\n");

// 油猴版不再内嵌词库字面量：脚本本体保持小而清晰，词库通过 @resource 由油猴加载并通过 GM_getResourceText 读取。
const userscript = [
  userscriptHeader,
  contentJs,
].join("\n");

const userscriptName = `steamdb-zh-cn-${pkg.version}.user.js`;
await writeFile(path.join(buildDir, userscriptName), userscript, "utf8");
execFileSync(process.execPath, ["--check", path.join(buildDir, userscriptName)], { stdio: "inherit" });

// 固定路径副本：供 Greasy Fork 脚本同步（Sync）引用，随仓库提交
await mkdir(path.join(root, "dist"), { recursive: true });
await writeFile(path.join(root, "dist", "steamdb-zh-cn.user.js"), userscript, "utf8");

const zipBuffer = buildZip([
  { name: "manifest.json", data: Buffer.from(manifestText, "utf8") },
  { name: "content.js", data: Buffer.from(contentJs, "utf8") },
  { name: "translations.zh-CN.json", data: Buffer.from(translationsText, "utf8") },
]);

if (!existsSync(keyPath)) {
  await mkdir(keysDir, { recursive: true });
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  await writeFile(keyPath, privateKey.export({ type: "pkcs8", format: "pem" }), "utf8");
  console.log(`已生成扩展签名密钥：${keyPath}（请妥善保管，勿提交到仓库）`);
}
const keyPem = await readFile(keyPath, "utf8");
const { crxId, buffer: crxBuffer } = buildCrx3(zipBuffer, keyPem);

const baseName = `steamdb-zh-cn-${pkg.version}`;
await writeFile(path.join(buildDir, `${baseName}.zip`), zipBuffer);
await writeFile(path.join(buildDir, `${baseName}.crx`), crxBuffer);

console.log(`已生成 build/（${manifest.name} v${pkg.version}）`);
console.log(`词库：global ${Object.keys(rawDict.global).length} 条 / pages ${rawDict.pages.length} 组 / attrs ${Object.keys(rawDict.attrs).length} 条`);
console.log(`已打包 ${baseName}.zip（${zipBuffer.length} 字节）`);
console.log(`已打包 ${baseName}.crx（${crxBuffer.length} 字节，扩展 ID ${crxId}）`);
console.log(`已生成油猴版 ${userscriptName}（${Buffer.byteLength(userscript, "utf8")} 字节，词库通过 @resource 外置）`);
