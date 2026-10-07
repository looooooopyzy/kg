import { existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function categoryFor(chapter, indexed) {
  if (indexed) return indexed;
  if (/政治/.test(chapter)) return '政治理论';
  if (/常识|公共基础|法律|综合知识|科学素养|综合基础/.test(chapter)) return '常识判断';
  if (/言语|填空|阅读|语句/.test(chapter)) return '言语理解与表达';
  if (/资料/.test(chapter)) return '资料分析';
  if (/数量|数学|数字|数理/.test(chapter)) return '数量关系';
  if (/判断|推理|思维/.test(chapter)) return '判断推理';
  return '其他行测';
}

export function answerIndices(row, options) {
  if (!options.length && ['0', '1'].includes(String(row.answer))) return [Number(row.answer) === 1 ? 0 : 1];
  if (row.type === 2) {
    try {
      const values = String(row.answer).startsWith('[') ? JSON.parse(row.answer) : String(row.answer).split(',').map(Number);
      if (Array.isArray(values) && values.length && values.every(n => Number.isInteger(n) && n >= 0 && n < options.length)) return [...new Set(values)].sort((a,b) => a-b);
    } catch {}
    return [];
  }
  return Number.isInteger(row.answerIndex) && row.answerIndex >= 0 && row.answerIndex < options.length ? [row.answerIndex] : [];
}

export function loadFullBank(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const dir = path.dirname(dbPath);
  const indexPath = path.join(dir, 'tiku-index.db');
  const materialPath = path.join(dir, 'materials.db');
  const hasIndex = existsSync(indexPath), hasMaterials = existsSync(materialPath);
  try {
    if (hasIndex) db.prepare('ATTACH DATABASE ? AS taxonomy').run(indexPath);
    if (hasMaterials) db.prepare('ATTACH DATABASE ? AS essay').run(materialPath);
    const rows = db.prepare(`SELECT q.id rowId,q.questionId,q.paperId,q.type,q.answer,q.answerIndex,q.options,q.chapter,
      p.subjectName,${hasIndex ? 'c.category,c.sub' : "NULL category,NULL sub"}
      FROM questions q JOIN papers p ON p.id=q.paperId
      ${hasIndex ? 'LEFT JOIN taxonomy.question_categories c ON c.question_id=q.questionId AND c.subject=p.subjectName' : ''}
      WHERE p.subjectName IN ('公务员·行测','公务员·申论') AND length(q.content)>4 ORDER BY p.id DESC`).all();
    const unique = new Map();
    for (const row of rows) {
      const subject = row.subjectName === '公务员·申论' ? 'shenlun' : 'xingce';
      const key = `${subject}:${row.questionId}`;
      if (unique.has(key)) continue;
      if (subject === 'xingce') {
        let options; try { options=JSON.parse(row.options || '[]'); } catch { continue; }
        if (!Array.isArray(options) || options.length > 8 || !answerIndices(row,options).length) continue;
      }
      unique.set(key,{rowId:row.rowId,id:row.questionId,paperId:row.paperId,subject,
        category:subject==='shenlun' ? (row.category || '其他申论题') : categoryFor(row.chapter || '',row.category),
        sub:row.sub || '未细分'});
    }
    const records=[...unique.values()];
    const subjects={xingce:{name:'行测',total:0,categories:{}},shenlun:{name:'申论',total:0,categories:{}}};
    for(const q of records){const s=subjects[q.subject];s.total++;s.categories[q.category] ||= {count:0,subcategories:{}};const c=s.categories[q.category];c.count++;c.subcategories[q.sub]=(c.subcategories[q.sub]||0)+1;}
    return {db,records,subjects,hasIndex,hasMaterials,close:()=>db.close()};
  } catch(error) {db.close();throw error;}
}

export function pickFullQuestion(bank, filter={}, excluded=[]) {
  if(!bank || !['xingce','shenlun'].includes(filter.subject)) return null;
  const pool=bank.records.filter(q=>q.subject===filter.subject&&(!filter.category||filter.category==='all'||q.category===filter.category)&&(!filter.sub||filter.sub==='all'||q.sub===filter.sub));
  const skip=new Set(excluded.map(Number));
  const available=pool.filter(q=>!skip.has(q.id));
  const choices=available.length?available:pool;
  const selected=filter.id ? pool.find(q=>q.id===Number(filter.id)) : choices[Math.floor(Math.random()*choices.length)];
  if(!selected)return null;
  const row=bank.db.prepare('SELECT q.*,p.name paper,p.category region FROM questions q JOIN papers p ON p.id=q.paperId WHERE q.id=?').get(selected.rowId);
  let options=[];try{options=JSON.parse(row.options||'[]');}catch{}
  const answers=selected.subject==='xingce'?answerIndices(row,options):[];
  if(selected.subject==='xingce'&&!options.length)options=['正确','错误'];
  const materials=[];
  if(selected.subject==='shenlun'&&bank.hasMaterials){
    const blocks=bank.db.prepare('SELECT title,text FROM essay.materials WHERE paperId=? ORDER BY idx').all(row.paperId);
    materials.push(...blocks.map(b=>({title:b.title,text:b.text,html:''})));
  }
  if(!materials.length&&bank.hasIndex){
    const block=bank.db.prepare(`SELECT m.content FROM taxonomy.q_material_map qm JOIN taxonomy.q_materials m ON m.material_id=qm.material_id AND m.subject=qm.subject WHERE qm.question_id=? AND qm.subject=?`).get(row.questionId,selected.subject==='shenlun'?'公务员·申论':'公务员·行测');
    if(block?.content)materials.push({title:'给定资料',text:block.content,html:block.content});
  }
  if(!materials.length&&row.material?.trim())materials.push({title:'给定资料',text:row.material,html:row.material});
  return {...selected,stem:row.content,stemHtml:row.contentHtml||'',options,answerIndices:answers,answerIndex:answers[0]??-1,
    kind:selected.subject==='shenlun'?'essay':answers.length>1?'multiple':options.length===2&&['正确','错误'].includes(options[0])?'judgment':'single',
    analysis:row.analysis||'',analysisHtml:row.analysisHtml||'',paper:row.paper,region:row.region,materials,
    materialNotice:selected.subject==='shenlun'?'下方为已收录的同卷资料，可能存在缺段，请按题目要求核对。':!materials.length&&/\[materialid\]|根据.*资料|根据.*材料/.test(row.content)?'该题的关联材料暂未收录，信息不足时请换题。':'',
    topicCount:pool.length};
}
