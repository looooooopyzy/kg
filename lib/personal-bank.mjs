import { existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { loadFullBank } from './full-bank.mjs';

export const PERSONAL_BANK_SOURCE = 'https://github.com/ERRRC/kaogong-shuati';
export const PERSONAL_BANK_COMMIT = '12cf8e73be8fd18f615782e7a5748b0ca7f39ce2';
export const BANK_PATH = path.resolve('.local-data', 'kaogong-shuati', 'tiku.db');

const TOPIC_RULES = {
  basics: /总共|一共|共计|总数|总量|数量|人数|比例|百分之/,
  equation: /原来|现在|剩余|多了|少了|几倍|若|假设/,
  work: /工程|工作|合作|完成|效率|加工|修建|修路/,
  motion: /速度|行驶|相遇|相向|追及|路程|火车|步行/,
  profit: /利润|折扣|成本|售价|定价|销售|打折/,
  sets: /至少|至多|两种|三种|都参加|既.*又|同时参加/,
  mixture: /浓度|盐水|溶液|酒精|混合|加水/,
  counting: /排列|组合|选出|选取|安排|抽取|分配|共有多少种/,
};

function textOnly(value) {
  return typeof value === 'string' && value.length <= 8000 && !/<[^>]*>|\uFFFD/.test(value);
}

function usable(row) {
  if (!textOnly(row.content) || !textOnly(row.analysis)) return false;
  if (row.content.trim().length < 25 || row.analysis.trim().length < 25) return false;
  let options;
  try { options = JSON.parse(row.options); } catch { return false; }
  return Array.isArray(options) && options.length === 4 && options.every(option => textOnly(option) && option.trim().length > 0 && option.length < 1000);
}

export function loadPersonalBank(dbPath = BANK_PATH) {
  if (!existsSync(dbPath)) return null;
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const total = db.prepare('SELECT COUNT(*) AS count FROM questions').get().count;
    const rows = db.prepare(`
      SELECT q.questionId, q.chapter, q.content, q.options, q.answerIndex,
             q.analysis, p.name AS paper, p.category
      FROM questions q JOIN papers p ON p.id = q.paperId
      WHERE p.subjectName = ? AND q.chapter LIKE ?
        AND q.answerIndex BETWEEN 0 AND 3
        AND q.contentHtml NOT LIKE '%<img%'
        AND q.analysisHtml NOT LIKE '%<img%'
        AND q.options NOT LIKE '%<img%'
      ORDER BY p.id DESC
    `).all('公务员·行测', '数量%');
    const unique = new Map();
    for (const row of rows) if (!unique.has(row.questionId) && usable(row)) {
      unique.set(row.questionId, {
        id: row.questionId,
        chapter: row.chapter,
        stem: row.content.trim(),
        options: JSON.parse(row.options),
        answerIndex: row.answerIndex,
        analysis: row.analysis.trim(),
        paper: row.paper,
        category: row.category,
      });
    }
    const questions = [...unique.values()];
    const topics = Object.fromEntries(Object.entries(TOPIC_RULES).map(([topic, rule]) => [topic, questions.filter(question => rule.test(question.stem))]));
    return { total, eligible: questions.length, topics, full: loadFullBank(dbPath) };
  } finally {
    db.close();
  }
}

export function pickPersonalQuestion(bank, topic, excluded = []) {
  if (!bank || !Object.hasOwn(TOPIC_RULES, topic)) return null;
  const pool = bank.topics[topic] || [];
  if (!pool.length) return null;
  const skip = new Set(excluded.map(Number));
  const available = pool.filter(question => !skip.has(question.id));
  const choices = available.length ? available : pool;
  return { ...choices[Math.floor(Math.random() * choices.length)], topic, topicCount: pool.length };
}

export function personalBankSummary(bank) {
  return bank ? {
    available: true,
    total: bank.total,
    eligible: bank.eligible,
    subjects: bank.full.subjects,
    topics: Object.fromEntries(Object.entries(bank.topics).map(([name, questions]) => [name, questions.length])),
    source: PERSONAL_BANK_SOURCE,
    commit: PERSONAL_BANK_COMMIT,
  } : { available: false, message: '本机尚未下载个人学习题库。运行 node scripts/fetch-personal-bank.mjs。' };
}
