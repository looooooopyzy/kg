import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const icon = await readFile(new URL('../public/favicon.svg', import.meta.url));
for (const size of [180, 192, 512]) {
  await sharp(icon, { density: 900 }).resize(size, size).png().toFile(new URL(`../public/icon-${size}.png`, import.meta.url).pathname.slice(1));
}
