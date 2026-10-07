const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cleanMarkers=value=>String(value||'').replace(/\[materialid\]\d+\[\/materialid\]/g,'（请对照下方给定资料）');
const LETTERS='ABCDEFGH';

// Database markup is untrusted: copy only supported content nodes and safe image URLs.
export function safeQuestionHtml(value){
  const raw=cleanMarkers(value).replace(/\\"/g,'"');
  if(!/<[a-z][\s\S]*>/i.test(raw))return escapeText(raw).replace(/\n/g,'<br>');
  const source=new DOMParser().parseFromString(raw,'text/html');
  const out=document.createElement('div');
  const allowed=new Set(['P','BR','B','STRONG','EM','I','U','SPAN','SUP','SUB','TABLE','THEAD','TBODY','TR','TH','TD','UL','OL','LI']);
  const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','SVG','MATH']);
  function copy(node,parent){
    if(node.nodeType===3){parent.append(document.createTextNode(node.textContent));return}
    if(node.nodeType!==1||blocked.has(node.tagName))return;
    if(node.tagName==='IMG'){
      let url=node.getAttribute('src')||'';if(url.startsWith('//'))url='https:'+url;
      if(!/^https:\/\//i.test(url)){parent.append(document.createTextNode('〔图片地址不可用〕'));return}
      const image=document.createElement('img');image.src=url;image.alt='题目或解析中的图片';image.loading='lazy';image.referrerPolicy='no-referrer';parent.append(image);return;
    }
    const target=allowed.has(node.tagName)?document.createElement(node.tagName.toLowerCase()):parent;
    if(target!==parent)parent.append(target);
    if(['TD','TH'].includes(node.tagName))for(const attr of ['colspan','rowspan']){const n=Number(node.getAttribute(attr));if(n>=1&&n<=20)target.setAttribute(attr,String(n));}
    for(const child of node.childNodes)copy(child,target);
  }
  for(const child of source.body.childNodes)copy(child,out);
  return out.innerHTML;
}
function plain(value){const doc=new DOMParser().parseFromString(cleanMarkers(value),'text/html');doc.querySelectorAll('img').forEach(img=>img.replaceWith(document.createTextNode('〔图片，需结合原图〕')));return doc.body.textContent.trim();}
function id(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());}

export function createBankUI(hooks){
  const root=document.getElementById('bank-root'),status=document.getElementById('bank-status');
  const subject=document.getElementById('bank-subject'),category=document.getElementById('bank-category'),sub=document.getElementById('bank-topic'),next=document.getElementById('bank-new');
  const entries=new Map(),recent=new Map();
  let summary=null,summaryPromise=null,requestId=0,current=null;
  const local=['127.0.0.1','localhost'].includes(location.hostname);
  function filters(){return {subject:subject.value,category:category.value,sub:sub.value}}
  function key(){return JSON.stringify(filters())}
  async function get(url){const response=await fetch('http://127.0.0.1:8788'+url,{cache:'no-store',signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok)throw new Error(data.error||data.message||'题库连接失败');return data;}
  function options(select,items){select.replaceChildren();for(const [value,label] of items){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}}
  function fillCategories(){
    const categories=summary.subjects[subject.value].categories;
    const order=['政治理论','常识判断','言语理解与表达','数量关系','判断推理','资料分析'];
    const names=Object.keys(categories).sort((a,b)=>(order.includes(a)?order.indexOf(a):99)-(order.includes(b)?order.indexOf(b):99)||a.localeCompare(b,'zh'));
    options(category,[['all','全部科目 / 题型'],...names.map(name=>[name,`${name}（${categories[name].count}）`])]);fillSubcategories();
  }
  function fillSubcategories(){
    const entry=summary.subjects[subject.value].categories[category.value];
    options(sub,[['all','全部细分题型'],...Object.entries(entry?.subcategories||{}).map(([name,count])=>[name,`${name}（${count}）`])]);
    sub.disabled=!entry;
  }
  function notice(message,error=false){status.textContent=message;status.classList.toggle('error',error)}
  async function initialize(){
    if(summary)return;
    if(!summaryPromise)summaryPromise=get('/api/bank/status').then(data=>{if(!data.available||!data.subjects)throw new Error(data.message||'请更新并重新启动 npm run local');summary=data;fillCategories();}).catch(error=>{summaryPromise=null;throw error});
    await summaryPromise;
  }
  async function load(force=false,specificId){
    const token=++requestId;
    if(!local){notice('本机题库需要在电脑上运行 npm run local。',true);return}
    next.disabled=true;
    try{
      await initialize();if(token!==requestId)return;
      const filter=filters(),filterKey=key();
      if(!force&&!specificId&&current&&current.filterKey===filterKey){render(current);return}
      notice('正在从本机题库抽题…');root.replaceChildren();
      const query=new URLSearchParams({...filter,exclude:(recent.get(filterKey)||[]).join(',')});if(specificId)query.set('id',String(specificId));
      const q=await get('/api/bank/question?'+query);if(token!==requestId)return;
      const entryKey=`${q.subject}:${q.id}`;
      let entry=entries.get(entryKey);
      if(!entry){let draft='';if(q.subject==='shenlun')try{draft=localStorage.getItem('bank-essay-v1:'+q.id)||'';}catch{}
        entry={q,choices:[],revealed:false,submitted:false,draft};entries.set(entryKey,entry);}
      entry.q=q;entry.filterKey=filterKey;current=entry;
      recent.set(filterKey,[...(recent.get(filterKey)||[]).slice(-19),q.id]);render(entry);
    }catch(error){if(token===requestId){notice(error.name==='TimeoutError'?'本机题库连接超时，请确认 npm run local 正在运行。':error.message,true);root.innerHTML='<button class="outline-btn" data-fullbank-retry>重新连接 →</button>';root.querySelector('button').onclick=()=>load(true);}}
    finally{if(token===requestId)next.disabled=false;}
  }
  function render(entry){
    const q=entry.q,essay=q.kind==='essay';
    notice(`${summary.subjects[q.subject].name}共 ${summary.subjects[q.subject].total.toLocaleString()} 题；当前筛选 ${q.topicCount.toLocaleString()} 题 · ${q.category} / ${q.sub}`);
    root.innerHTML=`<article class="real-card full-bank-card"><div class="real-card-top"><span class="real-badge">${essay?'申论主观题':q.kind==='multiple'?'多选题':q.kind==='judgment'?'判断题':'单选题'}</span><span>${escapeText(q.paper)}</span><span>${escapeText(q.category)} · ${escapeText(q.sub)}</span></div><div class="bank-materials">${q.materialNotice?`<p class="bank-material-notice">${escapeText(q.materialNotice)}</p>`:''}${q.materials.map(m=>`<details ${essay?'open':''}><summary>${escapeText(m.title)}</summary><div class="bank-rich">${safeQuestionHtml(m.html||m.text)}</div></details>`).join('')}${essay&&!q.materials.length?'<p class="bank-material-notice">本题材料暂未收录。可阅读作答要求；完整作答和 AI 点评需要先补齐原卷材料。</p>':''}</div><h4>${essay?'作答要求':'请独立作答'}</h4><div class="bank-rich bank-stem">${safeQuestionHtml(q.stemHtml||q.stem)}</div>${essay?essayForm():`<div class="real-options">${q.options.map((option,index)=>`<button type="button" data-fullbank-option="${index}" class="${entry.revealed?(q.answerIndices.includes(index)?'correct':entry.choices.includes(index)?'wrong':''):entry.choices.includes(index)?'selected':''}" ${entry.revealed?'disabled':''} aria-pressed="${entry.choices.includes(index)}"><b>${LETTERS[index]}</b><span class="bank-rich">${safeQuestionHtml(option)}</span></button>`).join('')}</div>`}<div class="real-actions">${!essay?`<button class="outline-btn" data-fullbank-submit ${entry.revealed?'hidden':''}>${q.kind==='multiple'?'提交所选答案':'提交答案'}</button>`:''}<button class="text-btn" data-fullbank-reveal>${entry.revealed?'收起参考解析':'查看参考解析 →'}</button><button class="text-btn" data-fullbank-draft>打开草稿纸 ✎</button><button class="text-btn" data-fullbank-ask>${essay?'让 AI 点评作答':'让 AI 分步讲解'} ↗</button><button class="text-btn" data-fullbank-next>下一题 →</button></div><div class="real-detail" aria-live="polite"></div><div class="real-source"><span>个人学习副本 · 题号 ${q.id}</span><span>图片从题库原地址加载，图片无法显示时请换题或核对原卷。</span></div></article>`;
    function essayForm(){return '<div class="essay-editor"><label for="essay-answer">我的作答</label><textarea id="essay-answer" rows="12" maxlength="12000" placeholder="先阅读材料，写下你的答案。输入内容会自动保存在此浏览器。"></textarea><div class="essay-editor-footer"><span id="essay-count"></span><span id="essay-save-status" role="status"></span></div><div class="real-actions"><button class="outline-btn" data-essay-save>保存作答记录</button><button class="text-btn" data-essay-export>导出作答 TXT ↓</button><button class="text-btn" data-essay-review>加入复盘</button></div></div>';}
    root.querySelectorAll('img').forEach(image=>image.addEventListener('error',()=>{const warning=document.createElement('span');warning.className='bank-image-missing';warning.textContent='〔图片暂时无法加载，请核对原卷〕';image.replaceWith(warning);}));
    if(essay){
      const input=root.querySelector('#essay-answer');input.value=entry.draft;
      const count=()=>{root.querySelector('#essay-count').textContent=`${entry.draft.replace(/\s/g,'').length} 字（不含空白）`;};count();
      input.oninput=()=>{entry.draft=input.value;count();try{localStorage.setItem('bank-essay-v1:'+q.id,entry.draft);root.querySelector('#essay-save-status').textContent='已自动保存到此浏览器';}catch{root.querySelector('#essay-save-status').textContent='自动保存失败，请导出作答';}};
      root.querySelector('[data-essay-save]').onclick=()=>{if(!entry.draft.trim()){root.querySelector('#essay-save-status').textContent='请先写下作答';return}if(entry.savedDraft!==entry.draft){hooks.record({id:id(),kind:'shenlun',topic:`bank:shenlun:${q.id}`,number:q.id,correct:null,date:new Date().toISOString()});entry.savedDraft=entry.draft;}root.querySelector('#essay-save-status').textContent='作答已记录，主观题不计入客观题正确率';};
      root.querySelector('[data-essay-export]').onclick=()=>{const text=`${q.paper}\n${plain(q.stem)}\n\n我的作答：\n${entry.draft}`;const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`申论作答-${q.id}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
      root.querySelector('[data-essay-review]').onclick=()=>{if(!entry.draft.trim()){root.querySelector('#essay-save-status').textContent='请先写下作答';return}hooks.review({kind:'shenlun',topic:`bank:shenlun:${q.id}`,title:`${q.paper} · ${q.category}`,question:plain(q.stem),chosen:entry.draft,answer:'主观题，请对照材料和参考解析自评',explain:plain(q.analysis)||'题库未提供参考解析，可补齐材料后请 AI 点评。'});root.querySelector('#essay-save-status').textContent='已加入复盘';};
    }else{
      root.querySelectorAll('[data-fullbank-option]').forEach(button=>button.onclick=()=>{if(entry.revealed)return;const index=Number(button.dataset.fullbankOption);entry.choices=q.kind==='multiple'?(entry.choices.includes(index)?entry.choices.filter(n=>n!==index):[...entry.choices,index]):[index];render(entry);});
      root.querySelector('[data-fullbank-submit]').onclick=()=>{if(!entry.choices.length){notice('请先选择答案。',true);return}const correct=entry.choices.length===q.answerIndices.length&&entry.choices.every(index=>q.answerIndices.includes(index));if(!entry.submitted){hooks.record({id:id(),kind:'full-bank',topic:`bank:xingce:${q.id}`,number:q.id,correct,date:new Date().toISOString()});if(!correct)hooks.review({kind:'full-bank',topic:`bank:xingce:${q.id}`,title:`${q.paper} · ${q.category}`,question:plain(q.stem),chosen:entry.choices.map(n=>LETTERS[n]+' '+plain(q.options[n])).join('；'),answer:q.answerIndices.map(n=>LETTERS[n]+' '+plain(q.options[n])).join('；'),explain:plain(q.analysis)||'题库未收录参考解析。'});entry.submitted=true;entry.correct=correct;}entry.revealed=true;render(entry);};
    }
    root.querySelector('[data-fullbank-reveal]').onclick=()=>{entry.revealed=!entry.revealed;render(entry);};
    root.querySelector('[data-fullbank-draft]').onclick=hooks.draft;
    root.querySelector('[data-fullbank-next]').onclick=()=>load(true);
    root.querySelector('[data-fullbank-ask]').onclick=()=>{
      if(essay&&!q.materials.length){notice('本题缺少材料，请先补齐原卷材料再进行 AI 点评。',true);return}
      const mode=essay?'shenlun':({'数量关系':'quantity','判断推理':q.sub==='图形推理'?'spatial':'logic','言语理解与表达':'verbal','资料分析':'data','政治理论':'knowledge','常识判断':'knowledge'}[q.category]||'logic');
      const text=`${essay?'请按材料要点点评我的申论作答，列出遗漏、改进建议和参考思路。评分只能作为建议，依据题干满分，缺少评分细则时不要虚构固定扣分。':'请分步骤讲解本题，解释考点、方法理由、正确项和其他选项。'}\n来源：${q.paper}\n题型：${q.category} / ${q.sub}\n题目：${plain(q.stem)}\n${q.options.map((v,n)=>LETTERS[n]+'. '+plain(v)).join('\n')}\n${q.materials.map(m=>m.title+'：\n'+plain(m.html||m.text)).join('\n\n')}\n${q.materialNotice}\n${essay?'我的作答：\n'+entry.draft:'题库参考答案：'+q.answerIndices.map(n=>LETTERS[n]).join('、')}\n${/<img/i.test((q.stemHtml||'')+q.options.join('')+q.materials.map(m=>m.html).join(''))?'本题含图片，文字可能不完整。请先说明需要上传哪些原图，不能凭图片占位符猜测内容。':''}`;
      if(text.length>60000){notice('题目、材料与作答超过 60000 字，请选取对应材料后在 AI 答疑页提问。',true);return}hooks.ask(mode,text);
    };
    if(entry.revealed){const detail=root.querySelector('.real-detail');if(!essay){const feedback=document.createElement('p');feedback.className='generated-feedback '+(entry.correct?'good':'');feedback.textContent=(entry.submitted?(entry.correct?'答对了。':'本题已加入错题复盘。'):'')+'参考答案：'+q.answerIndices.map(n=>LETTERS[n]).join('、');detail.append(feedback);}const analysis=document.createElement('div');analysis.className='bank-rich personal-bank-analysis';analysis.innerHTML=safeQuestionHtml(q.analysisHtml||q.analysis||'题库未提供参考解析，可结合材料自行复盘或请 AI 讲解。');detail.append(analysis);}
    if(entry.submitted){root.querySelectorAll('[data-fullbank-option]').forEach(button=>button.disabled=true);root.querySelector('[data-fullbank-submit]').hidden=true;}
  }
  subject.onchange=()=>{if(summary)fillCategories();current=null;load(true);};category.onchange=()=>{fillSubcategories();current=null;load(true);};sub.onchange=()=>{current=null;load(true);};next.onclick=()=>load(true);
  return {open:()=>load(),openQuestion:async(subjectName,questionId)=>{subject.value=subjectName;await initialize();fillCategories();current=null;return load(true,questionId);}};
}
