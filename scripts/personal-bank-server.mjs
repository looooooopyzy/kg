#!/usr/bin/env node
// Local-only API for a personal-study copy of the third-party database.
import http from 'node:http';
import { loadPersonalBank, pickPersonalQuestion, personalBankSummary } from '../lib/personal-bank.mjs';

const port = 8788;
let bank;
try { bank = loadPersonalBank(); }
catch (error) { console.error('题库读取失败：', error.message); bank = null; }

const allowedOrigins = new Set(['http://127.0.0.1:8787', 'http://localhost:8787']);
const allowedHosts = new Set(['127.0.0.1:8788', 'localhost:8788']);
const server = http.createServer((request, response) => {
  const origin = request.headers.origin;
  if (!allowedHosts.has(request.headers.host) || (origin && !allowedOrigins.has(origin))) {
    response.writeHead(403).end();
    return;
  }
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  }
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }
  if (request.method !== 'GET') {
    response.writeHead(405).end(JSON.stringify({ error: '仅支持 GET' }));
    return;
  }
  const url = new URL(request.url, 'http://127.0.0.1:8788');
  if (url.pathname === '/api/bank/status') {
    response.writeHead(200).end(JSON.stringify(personalBankSummary(bank)));
    return;
  }
  if (url.pathname === '/api/bank/question') {
    if (!bank) {
      response.writeHead(503).end(JSON.stringify(personalBankSummary(bank)));
      return;
    }
    const topic = url.searchParams.get('topic') || '';
    const excluded = (url.searchParams.get('exclude') || '').split(',').slice(0, 20);
    const question = pickPersonalQuestion(bank, topic, excluded);
    if (!question) {
      response.writeHead(404).end(JSON.stringify({ error: '该知识点暂无文字完整的本地题目。' }));
      return;
    }
    response.writeHead(200).end(JSON.stringify(question));
    return;
  }
  response.writeHead(404).end(JSON.stringify({ error: '接口不存在' }));
});

server.listen(port, '127.0.0.1', () => {
  const summary = personalBankSummary(bank);
  console.log(`个人题库服务：http://127.0.0.1:${port} · ${summary.available ? `${summary.eligible} 道可完整显示的数量关系题` : summary.message}`);
});
