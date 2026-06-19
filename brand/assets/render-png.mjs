// Render PNG fallbacks from the authoritative SVGs.
//   npm i sharp && node render-png.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const out = (n) => join(here, n);

const jobs = [
  ["favicon.svg", "favicon-16.png", 16],
  ["favicon.svg", "favicon-32.png", 32],
  ["favicon.svg", "favicon-64.png", 64],
  ["app-icon-1024.svg", "app-icon-1024.png", 1024],
  ["social-avatar-512.svg", "social-avatar-512.png", 512],
];

for (const [src, dst, size] of jobs) {
  const svg = readFileSync(out(src));
  const buf = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
  writeFileSync(out(dst), buf);
  console.log(`✓ ${dst} (${size}px)`);
}

// banner keeps aspect ratio
{
  const svg = readFileSync(out("x-banner-1500x500.svg"));
  const buf = await sharp(svg, { density: 200 }).resize(1500, 500).png().toBuffer();
  writeFileSync(out("x-banner-1500x500.png"), buf);
  console.log("✓ x-banner-1500x500.png");
}
console.log("done.");
