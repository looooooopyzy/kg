#!/usr/bin/env node
// Downloads a personal-study copy of ERRRC/kaogong-shuati's question bank.
// Its authors say the question data may be used for personal study, but not
// commercially or redistributed. Keep the output in the ignored local folder.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST = path.join(ROOT, '.local-data', 'kaogong-shuati');
const COMMIT = '12cf8e73be8fd18f615782e7a5748b0ca7f39ce2';
const BASE = `https://raw.githubusercontent.com/ERRRC/kaogong-shuati/${COMMIT}/`;
const FILES = [
  ['tiku-index.db', 15790080, '37deba994f4a7049f9d1c252406ea2eda297400b'],
  ['materials.db', 27873280, '26eff71f987986c6327ef4199d1cbd7593089f13'],
  ['tiku.db.part-00', 94371840, '8f39b3688dff5d02c862834811e524c8a8b771f5'],
  ['tiku.db.part-01', 94371840, '230bfd3fc4d6766684ed7df5a1019f16deea7f3c'],
  ['tiku.db.part-02', 94371840, 'afb64e88364ad94a835ce48496c2670d4ada6098'],
  ['tiku.db.part-03', 35622912, 'c8609df7dc9f850cbc54e46b59b07f656839ee76'],
];
const FINAL_MD5 = 'efaa2274fc6aa9c385bc30842556b215';

async function hashFile(file, algorithm, prefix = '') {
  const hash = createHash(algorithm).update(prefix);
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function validBlob(file, size, sha) {
  if (!existsSync(file) || (await stat(file)).size !== size) return false;
  return (await hashFile(file, 'sha1', `blob ${size}\0`)) === sha;
}

async function fetchBlob([name, size, sha]) {
  const target = path.join(DEST, name);
  if (await validBlob(target, size, sha)) {
    console.log(`已校验 ${name}`);
    return;
  }
  const temporary = `${target}.download`;
  await rm(temporary, { force: true });
  const response = await fetch(BASE + name, { headers: { 'User-Agent': 'kaogong-personal-study' } });
  if (!response.ok || !response.body) throw new Error(`${name}: 下载失败 (HTTP ${response.status})`);
  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    if (!(await validBlob(temporary, size, sha))) throw new Error(`${name}: 文件校验失败`);
    await rm(target, { force: true });
    await rename(temporary, target);
    console.log(`已下载并校验 ${name}`);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function assemble() {
  const target = path.join(DEST, 'tiku.db');
  if (existsSync(target) && (await hashFile(target, 'md5')) === FINAL_MD5) {
    console.log('主库 MD5 已校验');
    return;
  }
  const temporary = `${target}.assembling`;
  await rm(temporary, { force: true });
  const output = createWriteStream(temporary);
  try {
    for (let n = 0; n < 4; n++) {
      const part = path.join(DEST, `tiku.db.part-0${n}`);
      for await (const chunk of createReadStream(part)) {
        if (!output.write(chunk)) await new Promise(resolve => output.once('drain', resolve));
      }
    }
    await new Promise((resolve, reject) => output.end(error => error ? reject(error) : resolve()));
    if ((await hashFile(temporary, 'md5')) !== FINAL_MD5) throw new Error('主库 MD5 校验失败');
    await rm(target, { force: true });
    await rename(temporary, target);
    console.log('主库重组完成，MD5 校验通过');
  } catch (error) {
    output.destroy();
    await rm(temporary, { force: true });
    throw error;
  }
}

await mkdir(DEST, { recursive: true });
console.log(`个人学习题库：${DEST}`);
for (const file of FILES) await fetchBlob(file);
await assemble();
console.log('完成。题库文件仅供个人学习，请勿提交、发布或二次分发。');
