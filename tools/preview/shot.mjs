#!/usr/bin/env node
// Headless screenshots of the game and the material gallery with the preinstalled Playwright Chromium
// (software GL, so slow but deterministic enough to eyeball).
//
// Usage: node tools/preview/shot.mjs [--page materials|normal|bind|game|street] [--out shots] [--ids a,b] [--full]
//        [--tier high|medium|low] [--base /textures] [--cam <page specific>] [--size 1600x900] [--url http://host:port] [--strict]
//   materials  /materials.html gallery       normal  /materials.html?test=normal (normal-map self-test)
//   bind       /materials.html?test=bind (MaterialLibrary binding + chunk unload checks)
//   game       /  (use --cam x,y,z,yaw,pitch)
//   street     /street.html night street vignette: --shot down|road|facade|sign|aerial|billboard, --q "tm=aces&neon=2&ssr=0" extra query, --tag name
// Exit code is 1 on uncaught page errors, a failed self-test, or (with --strict) console errors.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const page = opt("page", "materials");
const outDir = join(root, opt("out", "shots"));
const [width, height] = opt("size", "1600x900").split("x").map(Number);
const port = 5199;
const base = opt("url", `http://127.0.0.1:${port}`);
const timeoutMs = Number(opt("timeout", "180")) * 1000;

const query = new URLSearchParams();
let path = "/";
if (page === "materials" || page === "normal" || page === "bind") {
  path = "/materials.html";
  if (page !== "materials") query.set("test", page);
  if (opt("base")) query.set("base", opt("base"));
  if (opt("ids")) query.set("ids", opt("ids"));
  if (flag("full")) query.set("full", "1");
  if (opt("tier")) query.set("tier", opt("tier"));
  if (opt("cam")) query.set("cam", opt("cam"));
} else if (page === "street") {
  path = "/street.html";
  if (opt("shot")) query.set("shot", opt("shot"));
  if (opt("tier")) query.set("tier", opt("tier"));
  if (opt("cam")) query.set("cam", opt("cam"));
  for (const [k, v] of new URLSearchParams(opt("q", ""))) query.set(k, v);
} else if (page === "game") {
  if (opt("cam")) query.set("cam", opt("cam"));
} else {
  console.error(`unknown --page ${page}`);
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startVite() {
  if (opt("url")) return null;
  const child = spawn("npx", ["vite", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(base)).ok) return child;
    } catch {
      /* not up yet */
    }
    if (child.exitCode !== null) break;
    await sleep(300);
  }
  console.error(log);
  throw new Error("vite did not start");
}

const stopVite = (child) => {
  if (child?.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
};

const vite = await startVite();
let failed = false;
try {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const ctx = await browser.newContext({ viewport: { width, height } });
  const tab = await ctx.newPage();

  const problems = [];
  tab.on("pageerror", (e) => {
    failed = true;
    console.error(`[pageerror] ${e.message}`);
  });
  tab.on("console", (m) => {
    const type = m.type();
    if (type === "error" || type === "warning") {
      problems.push(`[${type}] ${m.text()}`);
      console.log(`[console.${type}] ${m.text()}`);
    }
  });
  tab.on("requestfailed", (r) => console.log(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`));

  const url = `${base}${path}${query.size ? `?${query}` : ""}`;
  console.log(`open ${url}`);
  await tab.goto(url, { waitUntil: "domcontentloaded" });
  await tab.waitForFunction(() => window.__previewReady === true, null, { timeout: timeoutMs });
  await sleep(500); // let the labels and a couple more frames settle

  const info = await tab.evaluate(() => window.__previewInfo ?? null);
  if (info) console.log(`info ${JSON.stringify(info)}`);
  if ((info?.normalTest && !info.normalTest.ok) || (info?.bindTest && !info.bindTest.ok)) failed = true;

  mkdirSync(outDir, { recursive: true });
  const name = [page, opt("ids")?.split(",").slice(0, 3).join("+"), opt("shot"), opt("tag"), flag("full") ? "full" : null, opt("tier")].filter(Boolean).join("-");
  const file = join(outDir, `${name}.png`);
  await tab.screenshot({ path: file });
  console.log(`saved ${file}`);

  if (flag("strict") && problems.some((p) => p.startsWith("[error]"))) failed = true;
  await browser.close();
} catch (err) {
  failed = true;
  console.error(err);
} finally {
  stopVite(vite);
}
process.exit(failed ? 1 : 0);
