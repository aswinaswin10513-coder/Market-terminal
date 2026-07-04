// X V MMII - app layer v4

// ---------- state ----------
var funds=sGet('xv_funds',DEF_FUNDS);
var fxs=sGet('xv_fx',DEF_FX);
var globals=sGet('xv_global',DEF_GLOBAL);
var watch=sGet('xv_watch',DEF_WATCH);
var topics=sGet('xv_topics',DEF_TOPICS);
var defTh=sGet('xv_defth',4);
var lastUpd=sGet('xv_lastupd',null);
var activeTopic='all';
var activeView='markets';
var NEWS_TAGS=[];
var CHART={vals:[],title:'',range:'6M'};

// ---------- tiny ui utils ----------
var toastT;
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');
 clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show')},2200)}
function go(v){activeView=v;
 var i,vs=document.querySelectorAll('.view');
 for(i=0;i<vs.length;i++){vs[i].classList.remove('active')}
 document.getElementById('v-'+v).classList.add('active');
 var bs=document.querySelectorAll('nav button');
 for(i=0;i<bs.length;i++){bs[i].classList.toggle('on',bs[i].getAttribute('data-nav')===v)}
 window.scrollTo(0,0)}
function updHeader(busy){var el=document.getElementById('upd');
 if(busy){el.innerHTML='<span class="g"><span class="spin">&#8635;</span> updating</span>';return}
 var head=isOnline()?'Updated':'<span style="color:var(--down)">OFFLINE</span> \u00b7 saved';
 el.innerHTML=head+'<br><span class="g">'+(lastUpd?ago(lastUpd):'\u2014')+'</span>'}
function dotHtml(pc,th){var t=(th==null?defTh:th),c='x';
 if(pc!=null){var a=Math.abs(pc);c=a>=t?'r':(a>=t/2?'a':'g')}
 return '<span class="dot '+c+'"></span>'}
function chgHtml(pc){if(pc==null)return '<div class="c flat">no data</div>';
 var cls=pc>0.001?'up':(pc<-0.001?'down':'flat');var s=pc>0?'+':'';
 return '<div class="c '+cls+'">'+s+pc.toFixed(1)+'%</div>'}
function flagIf(pc,th){var t=(th==null?defTh:th);
 return (pc!=null&&Math.abs(pc)>=t)?'<span class="flag">&#9873;</span>':''}

// ---------- svg charts ----------
function sparkSvg(vals){
 if(!vals||vals.length<2)return '';
 var w=72,h=26,mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals);
 var rg=(mx-mn)||1,pts=[],i;
 for(i=0;i<vals.length;i++){
  pts.push((i/(vals.length-1)*w).toFixed(1)+','+(h-2-((vals[i]-mn)/rg)*(h-4)).toFixed(1))}
 var cls=vals[vals.length-1]>=vals[0]?'up':'down';
 return '<span class="spkwrap '+cls+'"><svg class="spk" viewBox="0 0 '+w+' '+h
  +'" preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" stroke-width="2" points="'
  +pts.join(' ')+'"/></svg></span>'}
function chartSvg(vals){
 if(!vals||vals.length<2)return '<div class="empty">Open after first online refresh.</div>';
 var w=320,h=160,mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals);
 var rg=(mx-mn)||1,line=[],i,x,y;
 for(i=0;i<vals.length;i++){
  x=(i/(vals.length-1)*w).toFixed(1);
  y=(h-8-((vals[i]-mn)/rg)*(h-24)).toFixed(1);
  line.push(x+','+y)}
 var up=vals[vals.length-1]>=vals[0];
 var col=up?'#3fae6b':'#e05656';
 return '<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;height:auto;display:block">'
  +'<polygon fill="'+col+'22" points="0,'+h+' '+line.join(' ')+' '+w+','+h+'"/>'
  +'<polyline fill="none" stroke="'+col+'" stroke-width="2.5" points="'+line.join(' ')+'"/>'
  +'<text x="4" y="12" font-size="10" fill="#8b95a6">'+fmtN(mx)+'</text>'
  +'<text x="4" y="'+(h-4)+'" font-size="10" fill="#8b95a6">'+fmtN(mn)+'</text></svg>'}

// ---------- bottom sheet ----------
function openSheet(html){document.getElementById('sheetBody').innerHTML=html;
 document.getElementById('sheetWrap').classList.add('open')}
function closeSheet(){document.getElementById('sheetWrap').classList.remove('open')}
function sheetTap(ev){if(ev.target&&ev.target.id==='sheetWrap')closeSheet()}

// ---------- markets render ----------
function renderFunds(){var el=document.getElementById('fundList');
 if(!funds.length){el.innerHTML='<div class="empty">No funds yet. Use Search to add.</div>';return}
 el.innerHTML=funds.map(function(f){var pc=pctCalc(f.nav,f.prev);
  return '<div class="row" onclick="openFundChart(\''+f.id+'\')">'
   +dotHtml(pc,f.th)
   +'<div class="lbl"><div class="n">'+esc(f.name)+flagIf(pc,f.th)+'</div>'
   +'<div class="m">fund \u00b7 alert \u00b1'+(f.th==null?defTh:f.th)+'%</div></div>'
   +sparkSvg(f.spark)
   +'<div class="val"><div class="p mono">'+fmtN(f.nav)+'</div>'+chgHtml(pc)+'</div>'
   +'<button class="del" onclick="event.stopPropagation();delFund(\''+f.id+'\')">\u00d7</button></div>'}).join('')}
function renderFx(){var el=document.getElementById('fxList');
 el.innerHTML=fxs.map(function(x){var pc=pctCalc(x.price,x.prev);
  return '<div class="row" onclick="openFxChart(\''+x.id+'\')">'
   +dotHtml(pc,x.th)
   +'<div class="lbl"><div class="n">'+esc(x.name)+flagIf(pc,x.th)+'</div>'
   +'<div class="m">currency \u00b7 alert \u00b1'+(x.th==null?defTh:x.th)+'%</div></div>'
   +sparkSvg(x.spark)
   +'<div class="val"><div class="p mono">'+fmtN(x.price)+'</div>'+chgHtml(pc)+'</div></div>'}).join('')}
function renderGlobal(){var el=document.getElementById('globalList');
 if(!globals.length){el.innerHTML='<div class="empty">Nothing global. Use Search to add crypto.</div>';return}
 el.innerHTML=globals.map(function(g){
  var pc=(g.kind==='crypto')?(g.chg==null?null:g.chg):pctCalc(g.price,g.prev);
  return '<div class="row">'+dotHtml(pc,g.th)
   +'<div class="lbl"><div class="n">'+esc(g.name)+flagIf(pc,g.th)+'</div>'
   +'<div class="m">'+(g.kind==='crypto'?'crypto \u00b7 \u20b9 price':'global spot')+' \u00b7 alert \u00b1'+(g.th==null?defTh:g.th)+'%</div></div>'
   +'<div class="val"><div class="p mono">'+fmtN(g.price)+'</div>'+chgHtml(pc)+'</div>'
   +'<button class="del" onclick="delGlobal(\''+g.id+'\')">\u00d7</button></div>'}).join('')}
function renderWatch(){var el=document.getElementById('watchList');
 if(!watch.length){el.innerHTML='<div class="empty">Nothing here. Tap "+ Add watch item".</div>';return}
 el.innerHTML=watch.map(function(w){
  var has=(w.price!=null&&w.prev!=null&&w.prev!==0);
  var pc=has?pctCalc(w.price,w.prev):null;
  var chg=has?chgHtml(pc):(w.price!=null?'<div class="c flat">base set</div>':'<div class="c flat">no data</div>');
  return '<div class="row">'+dotHtml(pc,w.th)
   +'<div class="lbl"><div class="n">'+esc(w.name)+flagIf(pc,w.th)+'</div>'
   +'<div class="m">'+esc(w.unit||'')+' \u00b7 alert \u00b1'+(w.th==null?defTh:w.th)+'%</div></div>'
   +'<div class="val"><div class="p mono">'+fmtN(w.price)+'</div>'+chg+'</div>'
   +'<button class="btn sm" onclick="setPrice(\''+w.id+'\')">Set</button>'
   +'<button class="del" onclick="delWatch(\''+w.id+'\')">\u00d7</button></div>'}).join('')}
function renderAll(){renderFunds();renderFx();renderGlobal();renderWatch();updHeader(false)}

// ---------- refresh ----------
function refreshAll(){
 if(!isOnline()){toast('Offline \u2014 showing last saved');renderAll();return}
 updHeader(true);
 var jobs=funds.map(fetchFund).concat(fxs.map(fetchFx)).concat(globals.map(fetchGlobal));
 Promise.allSettled(jobs).then(function(){
  lastUpd=Date.now();
  sSet('xv_lastupd',lastUpd);sSet('xv_funds',funds);sSet('xv_fx',fxs);sSet('xv_global',globals);
  renderAll()})}

// ---------- charts ----------
function findBy(arr,id){var i;for(i=0;i<arr.length;i++){if(arr[i].id===id)return arr[i]}return null}
function openFundChart(id){var f=findBy(funds,id);if(!f)return;
 CHART.vals=XV_HIST['fund:'+f.code]||f.spark||[];CHART.title=f.name;CHART.range='6M';
 drawChartSheet()}
function openFxChart(id){var x=findBy(fxs,id);if(!x)return;
 CHART.vals=XV_HIST['fx:'+x.id]||x.spark||[];CHART.title=x.name;CHART.range='All';
 drawChartSheet()}
function setRange(r){CHART.range=r;drawChartSheet()}
function drawChartSheet(){
 var map={'1M':22,'6M':130,'1Y':250,'All':CHART.vals.length};
 var n=map[CHART.range]||CHART.vals.length;
 var vals=CHART.vals.slice(-n);
 var pc=vals.length>1?pctCalc(vals[vals.length-1],vals[0]):null;
 var rb=['1M','6M','1Y','All'].map(function(r){
  return '<button class="'+(CHART.range===r?'on':'')+'" onclick="setRange(\''+r+'\')">'+r+'</button>'}).join('');
 openSheet('<div class="grab"></div>'
  +'<div style="font-weight:600;font-size:14px;margin-bottom:4px">'+esc(CHART.title)+'</div>'
  +'<div class="bigp mono">'+fmtN(vals.length?vals[vals.length-1]:null)
  +' <span style="font-size:14px" class="'+(pc!=null&&pc>=0?'up':'down')+'">'
  +(pc==null?'':((pc>=0?'+':'')+pc.toFixed(1)+'%'))+'</span></div>'
  +'<div class="range">'+rb+'</div>'
  +chartSvg(vals)
  +'<div style="font-size:11px;color:var(--ink-faint);margin-top:8px">Change shown is over the selected period. Track only \u2014 never trades.</div>')}

// ---------- delete / add ----------
function delFund(id){var f=findBy(funds,id);
 if(!confirm('Remove "'+(f?f.name:'')+'"?'))return;
 funds=funds.filter(function(x){return x.id!==id});sSet('xv_funds',funds);renderFunds();toast('Removed')}
function delGlobal(id){var g=findBy(globals,id);
 if(!confirm('Remove "'+(g?g.name:'')+'"?'))return;
 globals=globals.filter(function(x){return x.id!==id});sSet('xv_global',globals);renderGlobal();toast('Removed')}
function delWatch(id){var w=findBy(watch,id);
 if(!confirm('Remove "'+(w?w.name:'')+'"?'))return;
 watch=watch.filter(function(x){return x.id!==id});sSet('xv_watch',watch);renderWatch();toast('Removed')}
function setPrice(id){var w=findBy(watch,id);if(!w)return;
 var v=prompt('New price for '+w.name+'\n('+(w.unit||'')+')',w.price!=null?w.price:'');
 if(v===null)return;
 var num=parseFloat(String(v).replace(/[^0-9.]/g,''));
 if(isNaN(num)){toast('Enter a number');return}
 w.prev=(w.price!=null?w.price:num);w.price=num;
 sSet('xv_watch',watch);renderWatch();toast('Price updated')}
function toggleWatchForm(){var f=document.getElementById('watchForm');
 if(f.classList.contains('open')){f.classList.remove('open');f.innerHTML='';return}
 f.classList.add('open');
 f.innerHTML='<div class="fld-wrap"><label class="fld">Name</label><input id="wn" placeholder="e.g. Coconut oil"></div>'
  +'<div class="grid2"><div class="fld-wrap"><label class="fld">Unit</label><input id="wu" placeholder="per litre"></div>'
  +'<div class="fld-wrap"><label class="fld">Alert %</label><input id="wt" type="number" inputmode="decimal" value="'+defTh+'"></div></div>'
  +'<div class="grid2"><button class="btn ghost" onclick="toggleWatchForm()">Cancel</button>'
  +'<button class="btn gold" onclick="addWatch()">Add</button></div>';
 document.getElementById('wn').focus()}
function addWatch(){
 var n=document.getElementById('wn').value.trim();
 if(!n){toast('Enter a name');return}
 var u=document.getElementById('wu').value.trim();
 var t=parseFloat(document.getElementById('wt').value)||defTh;
 watch.push({id:'w'+Date.now(),name:n,unit:u,price:null,prev:null,th:t});
 sSet('xv_watch',watch);toggleWatchForm();renderWatch();toast('Added \u2014 tap Set to enter a price')}
function addFundFromSearch(code,name){
 var i;for(i=0;i<funds.length;i++){if(funds[i].code===String(code)){toast('Already added');return}}
 var f={id:'f'+Date.now(),name:name,code:String(code),th:2,nav:null,prev:null,spark:[]};
 funds.push(f);sSet('xv_funds',funds);pushRecent(name);renderRecents();
 toast('Added \u2014 getting price\u2026');
 fetchFund(f).then(function(){sSet('xv_funds',funds);renderFunds()})}
function addCrypto(cg,name,sym){
 var i;for(i=0;i<globals.length;i++){if(globals[i].cg===cg){toast('Already added');return}}
 var g={id:'g'+Date.now(),kind:'crypto',cg:cg,name:name,sym:sym,price:null,chg:null,th:5};
 globals.push(g);sSet('xv_global',globals);pushRecent(name);renderRecents();
 toast('Added \u2014 getting price\u2026');
 fetchGlobal(g).then(function(){sSet('xv_global',globals);renderGlobal()})}

// ---------- smart search ----------
var searchTimer=null;
function localPool(){
 var pool=[],i;
 for(i=0;i<watch.length;i++){pool.push({s:watch[i].name,m:'your watch item',act:'goMarkets'})}
 for(i=0;i<funds.length;i++){pool.push({s:funds[i].name,m:'your fund',act:'goMarkets'})}
 for(i=0;i<topics.length;i++){pool.push({s:topics[i].label,m:'news topic',act:'goNews'})}
 pool.push({s:'USD / INR',m:'currency',act:'goMarkets'});
 pool.push({s:'Bitcoin',m:'crypto',act:'goMarkets'});
 pool.push({s:'Gold (USD/oz)',m:'global spot',act:'goMarkets'});
 return pool}
function onSearchInput(){
 var q=document.getElementById('searchInput').value.trim();
 clearTimeout(searchTimer);
 if(q.length<2){renderRecents();document.getElementById('searchResults').innerHTML='';return}
 document.getElementById('searchResults').innerHTML='<div class="empty"><span class="spin">&#8635;</span> Searching\u2026</div>';
 searchTimer=setTimeout(function(){runSearch(q)},250)}
function runSearch(q){
 var out=document.getElementById('searchResults');
 var local=localPool().map(function(p){p.sc=fuzzyScore(q,p.s);return p})
  .filter(function(p){return p.sc>0}).sort(function(a,b){return b.sc-a.sc}).slice(0,5);
 var html='';
 if(local.length){html+='<div class="rgrp">Your items</div>'
  +local.map(function(p){return '<div class="result" onclick="'+p.act+'(\''+esc(p.s).replace(/'/g,'')+'\')">'
   +'<div style="flex:1">'+esc(p.s)+'<div style="font-size:10.5px;color:var(--ink-faint)">'+p.m+'</div></div>'
   +'<div class="code">\u2192</div></div>'}).join('')}
 if(!isOnline()){out.innerHTML=html+'<div class="empty">Offline \u2014 fund &amp; crypto search needs internet.</div>';return}
 out.innerHTML=html+'<div class="empty"><span class="spin">&#8635;</span> Searching funds &amp; crypto\u2026</div>';
 Promise.allSettled([mfSearch(q),cgSearch(q)]).then(function(res){
  var mf=res[0].status==='fulfilled'?res[0].value:[];
  var cg=res[1].status==='fulfilled'?res[1].value:[];
  var h2='';
  if(mf.length){h2+='<div class="rgrp">Mutual funds \u00b7 tap to add</div>'
   +mf.map(function(x){return '<div class="result" onclick="addFundFromSearch(\''+x.schemeCode+'\',this.getAttribute(\'data-n\'))" data-n="'+esc(x.schemeName)+'">'
    +'<div style="flex:1">'+esc(x.schemeName)+'</div><div class="code">+ Add</div></div>'}).join('')}
  if(cg.length){h2+='<div class="rgrp">Crypto \u00b7 tap to add</div>'
   +cg.map(function(x){return '<div class="result" onclick="addCrypto(\''+esc(x.id)+'\',this.getAttribute(\'data-n\'),\''+esc(x.symbol||'')+'\')" data-n="'+esc(x.name)+'">'
    +'<div style="flex:1">'+esc(x.name)+' <span style="color:var(--ink-faint)">'+esc((x.symbol||'').toUpperCase())+'</span></div><div class="code">+ Add</div></div>'}).join('')}
  if(!h2&&!html)h2='<div class="empty">No match. Try fewer letters.</div>';
  out.innerHTML=html+h2})}
function goMarkets(){go('markets')}
function goNews(){go('news')}
function renderRecents(){
 var r=getRecents();var el=document.getElementById('recentsBar');
 if(!r.length){el.innerHTML='';return}
 el.innerHTML='<div class="rgrp">Recent</div><div class="topic-bar">'
  +r.map(function(q){return '<div class="chip" onclick="useRecent(this.getAttribute(\'data-q\'))" data-q="'+esc(q)+'">'+esc(q)+'</div>'}).join('')+'</div>'}
function useRecent(q){document.getElementById('searchInput').value=q;runSearch(q)}

// ---------- news ----------
function renderTopics(){var bar=document.getElementById('topicBar');
 var on=topics.filter(function(t){return t.on});
 bar.innerHTML='<div class="chip '+(activeTopic==='all'?'on':'')+'" onclick="setTopic(\'all\')">All</div>'
  +on.map(function(t){return '<div class="chip '+(activeTopic===t.id?'on':'')+'" onclick="setTopic(\''+t.id+'\')">'+esc(t.label)+'</div>'}).join('')}
function setTopic(id){activeTopic=id;renderTopics();loadNews()}
function tAgo(ts){var s=(Date.now()-ts)/1000;if(s<3600)return Math.max(1,Math.floor(s/60))+'m ago';
 if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'}
function newsItemHtml(a,idx){
 var tag=NEWS_TAGS[idx]||{assets:[],why:null};
 var chips='';
 if(tag.assets.length){chips='<div class="chips">'
  +tag.assets.map(function(as){return '<span class="chipA" onclick="event.preventDefault();event.stopPropagation();openWhy('+idx+')">'+esc(as)+'</span>'}).join('')+'</div>'}
 return '<a class="news-item" href="'+encodeURI(a.url)+'" target="_blank" rel="noopener">'
  +'<div class="tl">'+esc(a.title)+'</div>'
  +'<div class="me"><span class="topic-pill">'+esc(a.topic)+'</span>'
  +'<span class="src">'+esc(a.domain)+'</span><span>\u00b7</span><span>'+tAgo(a.ts)+'</span></div>'
  +chips+'</a>'}
function renderNewsList(items){
 NEWS_TAGS=items.map(function(a){return tagHeadline(a.title)});
 document.getElementById('newsList').innerHTML=items.map(newsItemHtml).join('')}
function openWhy(idx){var tag=NEWS_TAGS[idx];if(!tag)return;
 openSheet('<div class="grab"></div>'
  +'<div style="font-weight:600;font-size:14px;margin-bottom:8px">How this connects to you</div>'
  +'<div class="chips" style="margin:0 0 10px">'+tag.assets.map(function(a){return '<span class="chipA">'+esc(a)+'</span>'}).join('')+'</div>'
  +'<div style="font-size:13.5px;line-height:1.6;color:var(--ink)">'+esc(tag.why||'')+'</div>'
  +'<button class="btn gold wide" style="margin-top:14px" onclick="closeSheet();go(\'markets\')">Open Markets</button>')}
function showCachedNews(reason){
 var cached=sGet('xv_news',null);
 var list=document.getElementById('newsList');
 var status=document.getElementById('newsStatus');
 if(cached&&cached.items&&cached.items.length){renderNewsList(cached.items);
  status.textContent=reason+' \u00b7 saved '+ago(cached.ts)}
 else{list.innerHTML='<div class="empty">No saved headlines yet. Connect to internet once.</div>';
  status.textContent=reason}}
function loadNews(){
 var status=document.getElementById('newsStatus');
 var btn=document.getElementById('newsRefresh');
 var list=document.getElementById('newsList');
 var act=topics.filter(function(t){return t.on&&(activeTopic==='all'||t.id===activeTopic)});
 if(!act.length){list.innerHTML='<div class="empty">No topics on. Turn topics on in Setup.</div>';
  status.textContent='No topics';return}
 if(!isOnline()){showCachedNews('OFFLINE');return}
 btn.innerHTML='<span class="spin">&#8635;</span> Loading';
 status.textContent='Fetching\u2026';
 list.innerHTML='<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
 Promise.allSettled(act.map(gdeltFetch)).then(function(settled){
  var all=[],i;
  for(i=0;i<settled.length;i++){if(settled[i].status==='fulfilled')all=all.concat(settled[i].value)}
  var seen={};all=all.filter(function(a){if(seen[a.url])return false;seen[a.url]=1;return true});
  all.sort(function(a,b){return b.ts-a.ts});all=all.slice(0,40);
  btn.innerHTML='&#8635; Refresh';
  if(!all.length){showCachedNews('Nothing new found');return}
  renderNewsList(all);
  sSet('xv_news',{ts:Date.now(),items:all});
  status.textContent=all.length+' headlines'})}

// ---------- setup ----------
function renderTopicManage(){var box=document.getElementById('topicManage');
 box.innerHTML=topics.map(function(t){
  return '<div class="row" style="padding-left:0;padding-right:0">'
   +'<div class="lbl"><div class="n">'+esc(t.label)+'</div><div class="m">'+esc(t.q)+'</div></div>'
   +'<button class="btn sm '+(t.on?'gold':'')+'" onclick="togTopic(\''+t.id+'\')">'+(t.on?'On':'Off')+'</button>'
   +'<button class="del" onclick="delTopic(\''+t.id+'\')">\u00d7</button></div>'}).join('')}
function togTopic(id){var i;for(i=0;i<topics.length;i++){if(topics[i].id===id)topics[i].on=!topics[i].on}
 sSet('xv_topics',topics);renderTopicManage();renderTopics()}
function delTopic(id){var t=findBy(topics,id);
 if(!confirm('Remove topic "'+(t?t.label:'')+'"?'))return;
 topics=topics.filter(function(x){return x.id!==id});sSet('xv_topics',topics);
 renderTopicManage();renderTopics();toast('Topic removed')}
function addTopic(){
 var l=document.getElementById('ntLabel').value.trim();
 var q=document.getElementById('ntQuery').value.trim();
 if(!l||!q){toast('Fill both boxes');return}
 topics.push({id:'t'+Date.now(),label:l,q:q,on:true});sSet('xv_topics',topics);
 document.getElementById('ntLabel').value='';document.getElementById('ntQuery').value='';
 renderTopicManage();renderTopics();toast('Topic added')}
function saveDef(){defTh=parseFloat(document.getElementById('defTh').value)||4;
 s
