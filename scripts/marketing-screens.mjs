#!/usr/bin/env node
import { readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const raw = "/tmp/marketing/raw";
const site = "/tmp/marketing/site";
const desktop = ["overview", "overview-dark", "profit", "wallets", "comparison", "cost-basis",
  "history", "rebalance", "goals", "assistant", "settings"];
const phone = ["overview", "history", "analytics", "assistant", "goals", "wallets", "sources"];
const tablet = [
  ["pro-landscape-overview-light", "pro-landscape-overview-light"],
  ["pro-landscape-overview-dark", "pro-landscape-overview-dark"],
  ["pro-landscape-assistant-light", "pro-landscape-assistant"],
  ["pro-landscape-assistant-dark", "pro-landscape-assistant-dark"],
  ["pro-landscape-history-detail-light", "pro-landscape-history-detail"],
  ["pro-landscape-history-detail-dark", "pro-landscape-history-detail-dark"],
  ["pro-landscape-settings-light", "pro-landscape-settings"],
  ["pro-landscape-settings-dark", "pro-landscape-settings-dark"],
];
const browser = await chromium.launch();
const page = await browser.newPage();
const log = [];

async function image(path) {
  const bytes = await readFile(path);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

async function encode(input, output, width, height, format, quality = 0.85) {
  const uri = await image(input);
  const result = await page.evaluate(async ({ uri, width, height, format, quality }) => {
    const source = new Image();
    source.src = uri;
    await source.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, width, height);
    return { width: source.width, height: source.height, data: canvas.toDataURL(`image/${format}`, quality).split(",")[1] };
  }, { uri, width, height, format, quality });
  const sourceSize = input.includes("/desktop/") ? [1600, 1000]
    : input.includes("/readme/") ? [3024, 2024]
      : input.includes("/ipad/") ? [1376, 1032] : [780, 1688];
  if (result.width !== sourceSize[0] || result.height !== sourceSize[1])
    throw new Error(`Unexpected source dimensions: ${input} is ${result.width}x${result.height}`);
  const encoded = Buffer.from(result.data, "base64");
  const bytes = format === "png" && (await readFile(input)).length < encoded.length
    ? await readFile(input) : encoded;
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes);
  log.push({ output: output.replace(`${repo}/`, ""), width, height,
    before: (await stat(input)).size, after: bytes.length });
}

try {
  await rm(site, { recursive: true, force: true });
  for (const name of desktop) {
    await encode(join(raw, "desktop", `${name}.png`), join(site, "desktop", `${name}.webp`),
      1600, 1000, "webp");
  }
  for (let index = 1; index <= 7; index++) {
    const input = join(raw, "readme", `sc${index}.png`);
    const output = join(repo, "images/demo", `sc${index}.jpg`);
    await encode(input, output, 3024, 2024, "jpeg", 0.82);
    if ((await stat(output)).size >= 600_000) throw new Error(`${output} exceeds 600 KB`);
  }
  for (const name of phone) for (const theme of ["dark", "light"]) {
    const basename = `${name}-${theme}`;
    const input = join(raw, "ios", `${basename}.png`);
    await encode(input, join(repo, "docs/ios/screens", `${basename}.png`), 780, 1688, "png");
    await encode(input, join(site, "ios", `${basename}.webp`), 600, 1298, "webp");
  }
  for (const [source, name] of tablet) {
    await encode(join(raw, "ipad", `${source}.png`), join(site, "ios", `${name}.webp`),
      1100, 825, "webp");
  }

  const windowUri = await image(join(raw, "desktop/overview-dark.png"));
  const phoneUri = await image(join(raw, "ios/overview-dark.png"));
  const font = (await readFile(join(repo, "src/components/fidelity-public-sans.woff2"))).toString("base64");
  const social = await page.evaluate(async ({ windowUri, phoneUri, font }) => {
    const face = new FontFace("Marketing Public Sans", `url(data:font/woff2;base64,${font})`, { weight: "100 900" });
    await face.load();
    document.fonts.add(face);
    const load = async (uri) => { const image = new Image(); image.src = uri; await image.decode(); return image; };
    const [windowImage, phoneImage] = await Promise.all([load(windowUri), load(phoneUri)]);
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#0d0d0e";
    ctx.fillRect(0, 0, 1200, 630);
    ctx.fillStyle = "#5fc39c";
    ctx.fillRect(50, 51, 5, 68);
    ctx.fillStyle = "#ffffff";
    ctx.font = '600 48px "Marketing Public Sans"';
    ctx.fillText("Track3", 74, 91);
    ctx.fillStyle = "#b4b6bc";
    ctx.font = '400 21px "Marketing Public Sans"';
    ctx.fillText("Crypto & Stock Portfolio Tracker for Desktop (iOS Coming Soon)", 74, 121);
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = "#19191c";
    ctx.beginPath();
    ctx.roundRect(45, 159, 833, 534, 15);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(49, 163, 825, 516, 9);
    ctx.clip();
    ctx.drawImage(windowImage, 49, 163, 825, 516);
    ctx.restore();
    ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#252529";
    ctx.beginPath();
    ctx.roundRect(810, 130, 220, 462, 31);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(816, 136, 208, 450, 25);
    ctx.clip();
    ctx.drawImage(phoneImage, 816, 136, 208, 450);
    ctx.restore();
    return canvas.toDataURL("image/jpeg", 0.88).split(",")[1];
  }, { windowUri, phoneUri, font });
  await mkdir(site, { recursive: true });
  const socialFile = join(site, "social-overview.jpg");
  const socialBytes = Buffer.from(social, "base64");
  await writeFile(socialFile, socialBytes);
  log.push({ output: socialFile, width: 1200, height: 630, before: 0, after: socialBytes.length });
  await writeFile(join("/tmp/marketing", "sizes.json"), JSON.stringify(log, null, 2));
  for (const row of log) console.log(`${row.output} ${row.width}x${row.height} ${Math.round(row.before / 1024)} → ${Math.round(row.after / 1024)} KiB`);
} finally {
  await browser.close();
}
