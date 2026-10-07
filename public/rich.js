// Rich rendering for model output: a Markdown subset plus LaTeX-style math
// (\( \) and \[ \], with $ / $$ fallbacks) turned into HTML. All model text is
// HTML-escaped before any tags are added, so answers cannot inject markup.
(function(){
  'use strict';
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  var SYMBOLS={times:'×',div:'÷',cdot:'·',pm:'±',mp:'∓',le:'≤',leq:'≤',leqslant:'≤',ge:'≥',geq:'≥',geqslant:'≥',ne:'≠',neq:'≠',approx:'≈',equiv:'≡',infty:'∞',pi:'π',alpha:'α',beta:'β',theta:'θ',circ:'°',degree:'°',perp:'⊥',parallel:'∥',angle:'∠',triangle:'△',because:'∵',therefore:'∴',cup:'∪',cap:'∩',in:'∈',subset:'⊂',emptyset:'∅',ldots:'…',cdots:'⋯',vdots:'⋮',prime:'′',quad:' ',qquad:'  ','%':'%',',':' ',';':' ',':':' ','!':'',' ':''};
  var DROP={left:1,right:1,big:1,Big:1,bigg:1,Bigg:1,displaystyle:1,textstyle:1,limits:1};
  function readGroup(src,i){
    while(i<src.length&&src[i]===' ')i++;
    if(i>=src.length)return null;
    if(src[i]==='{'){
      var depth=0,j=i;
      for(;j<src.length;j++){if(src[j]==='{')depth++;else if(src[j]==='}'){depth--;if(!depth)break;}}
      if(j>=src.length)return [src.slice(i+1),src.length];
      return [src.slice(i+1,j),j+1];
    }
    var m=src.slice(i).match(/^\\[a-zA-Z]+/);
    if(m)return [m[0],i+m[0].length];
    return [src[i],i+1];
  }
  function renderMath(src){
    var out='',i=0;
    while(i<src.length){
      var ch=src[i];
      if(ch==='\\'){
        var m=src.slice(i).match(/^\\([a-zA-Z]+|.)/);
        if(!m){out+=ch;i++;continue;}
        var cmd=m[1];i+=m[0].length;
        if(cmd==='frac'||cmd==='dfrac'||cmd==='tfrac'){
          var num=readGroup(src,i),den=num&&readGroup(src,num[1]);
          if(den){out+='<span class="mfrac"><span>'+renderMath(num[0])+'</span><span>'+renderMath(den[0])+'</span></span>';i=den[1];}
          continue;
        }
        if(cmd==='sqrt'){
          var g=readGroup(src,i);
          if(g){out+='<span class="msqrt">√<span class="mroot">'+renderMath(g[0])+'</span></span>';i=g[1];}
          continue;
        }
        if(cmd==='text'||cmd==='mathrm'||cmd==='mathbf'||cmd==='boldsymbol'){
          var t=readGroup(src,i);
          if(t){out+=(cmd==='mathbf'||cmd==='boldsymbol')?'<b>'+t[0]+'</b>':t[0];i=t[1];}
          continue;
        }
        if(Object.prototype.hasOwnProperty.call(SYMBOLS,cmd)){out+=SYMBOLS[cmd];continue;}
        if(DROP[cmd])continue;
        out+=cmd;
        continue;
      }
      if(ch==='^'||ch==='_'){
        var gr=readGroup(src,i+1);
        if(gr){out+=ch==='^'?'<sup>'+renderMath(gr[0])+'</sup>':'<sub>'+renderMath(gr[0])+'</sub>';i=gr[1];continue;}
      }
      out+=ch;i++;
    }
    return out;
  }
  function inlineMd(s){
    s=s.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>');
    s=s.replace(/(^|[^\w*])\*([^*\s][^*]*?)\*/g,function(_,pre,inner){return pre+'<i>'+inner+'</i>';});
    s=s.replace(/~~([^~]+)~~/g,'<s>$1</s>');
    s=s.replace(/`([^`\n]+)`/g,'<code>$1</code>');
    return s;
  }
  function extractMath(text){
    var store=[];
    function stash(html){store.push(html);return '\u0001'+(store.length-1)+'\u0001';}
    var out=escapeHtml(text);
    out=out.replace(/```[ \t]*([^\n`]*)\n([\s\S]*?)```/g,function(_,lang,code){return stash('<pre><code>'+code.replace(/\n$/,'')+'</code></pre>');});
    out=out.replace(/\\\[([\s\S]+?)\\\]/g,function(_,m){return stash('<span class="math-block">'+renderMath(m)+'</span>');});
    out=out.replace(/\$\$([\s\S]+?)\$\$/g,function(_,m){return stash('<span class="math-block">'+renderMath(m)+'</span>');});
    out=out.replace(/\\\(([\s\S]+?)\\\)/g,function(_,m){return stash('<span class="math-inline">'+renderMath(m)+'</span>');});
    out=out.replace(/(^|[^\w$])\$([^$\n]+?)\$(?!\w)/g,function(_,pre,m){return pre+stash('<span class="math-inline">'+renderMath(m)+'</span>');});
    return {text:out,store:store};
  }
  function renderInline(text){
    var m=extractMath(text);
    return inlineMd(m.text).replace(/\u0001(\d+)\u0001/g,function(_,i){return m.store[+i];});
  }
  function olMatch(s){
    var dot=s.match(/^(\d+)[.．]\s+(.*)$/);
    if(dot)return dot[2];
    var mark=s.match(/^(\d+)[、)]\s*(.*)$/);
    if(mark)return mark[2];
    return null;
  }
  function renderRich(text){
    var m=extractMath(text);
    var lines=m.text.split(/\r?\n/);
    var html=[],para=[],i=0;
    function flush(){if(para.length){html.push('<p>'+para.map(inlineMd).join('<br>')+'</p>');para=[];}}
    while(i<lines.length){
      var raw=lines[i],t=raw.trim();
      if(!t){flush();i++;continue;}
      var h=t.match(/^(#{1,6})\s+(.+)$/);
      if(h){flush();var level=Math.min(h[1].length+2,6);html.push('<h'+level+'>'+inlineMd(h[2])+'</h'+level+'>');i++;continue;}
      var q=t.match(/^&gt;\s?(.*)$/);
      if(q){flush();var qs=[];while(i<lines.length){var qm=lines[i].trim().match(/^&gt;\s?(.*)$/);if(qm){qs.push(qm[1]);i++;}else break;}html.push('<blockquote>'+qs.map(inlineMd).join('<br>')+'</blockquote>');continue;}
      var ulm=t.match(/^[-*•]\s+(.*)$/);
      if(ulm){flush();var items=[];while(i<lines.length){var lt=lines[i],ltt=lt.trim();var lm=ltt.match(/^[-*•]\s+(.*)$/);if(lm){items.push(lm[1]);i++;}else if(ltt&&items.length&&!/^(?:\d+[.、)]|[-*•]|#|>)/.test(ltt)&&/^\s{2,}/.test(lt)){items[items.length-1]+='<br>'+ltt;i++;}else break;}html.push('<ul>'+items.map(function(x){return '<li>'+inlineMd(x)+'</li>';}).join('')+'</ul>');continue;}
      var olItem=olMatch(t);
      if(olItem!==null){flush();var oitems=[olItem];i++;while(i<lines.length){var ot=lines[i],ott=ot.trim();var om=olMatch(ott);if(om!==null){oitems.push(om);i++;}else if(ott&&oitems.length&&!/^(?:\d+[.、)]|[-*•]|#|>)/.test(ott)&&/^\s{2,}/.test(ot)){oitems[oitems.length-1]+='<br>'+ott;i++;}else break;}html.push('<ol>'+oitems.map(function(x){return '<li>'+inlineMd(x)+'</li>';}).join('')+'</ol>');continue;}
      if(t.indexOf('|')>-1&&i+1<lines.length&&lines[i+1].includes('-')&&/^\|?[\s:|-]*-[\s:|-]*\|?$/.test(lines[i+1].trim())){
        flush();
        var rows=[];
        while(i<lines.length&&lines[i].includes('|')){rows.push(lines[i].trim());i++;}
        var cells=rows.map(function(r){return r.replace(/^\|/,'').replace(/\|$/,'').split('|').map(function(c){return c.trim();});});
        cells=cells.filter(function(row){return row.length>1&&!row.every(function(c){return c===''||/^:?-{3,}:?$/.test(c);});});
        if(cells.length){
          var head=cells.shift();
          html.push('<table><thead><tr>'+head.map(function(c){return '<th>'+inlineMd(c)+'</th>';}).join('')+'</tr></thead><tbody>'+cells.map(function(r){return '<tr>'+r.map(function(c){return '<td>'+inlineMd(c)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>');
          continue;
        }
        para.push(t);
        continue;
      }
      para.push(t);i++;
    }
    flush();
    return html.join('').replace(/\u0001(\d+)\u0001/g,function(_,i){return m.store[+i];});
  }
  var root=typeof window!=='undefined'?window:globalThis;
  root.renderRich=renderRich;
  root.renderInline=renderInline;
})();
