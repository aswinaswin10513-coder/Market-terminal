// INVICTA-REIGN Terminal - app engine v3
// Track & alert only. Never trades.

// ---------- storage ----------
function sGet(k,d){try{var v=localStorage.getItem(k);return v!=null?JSON.parse(v):d}catch(e){return d}}
function sSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}

// ---------- defaults (fund codes verified from robot log) ----------
var DEF_FUNDS=[
 {id:'f1',name:'UTI Nifty 50 Index Fund - Growth Option - Direct',code:'120716',th:2,nav:null,prev:null},
 {id:'f2',name:'Nippon India Gold Savings Fund - Direct Plan - Growth',code:'118663',th:2,nav:null,prev:null},
 {id:'f3',name:'ICICI Prudential Savings Fund - Direct Plan - Growth',code:'120398',th:2,nav:null,prev:null}
];
var DEF_FX=[{id:'x1',name:'USD / INR',from:'USD',to:'INR',th:1,price:null,prev:null}];
var DEF_WATCH=[
 {id:'w1',name:'Palm oil',unit:'per 10kg',price:null,prev:null,th:4},
 {id:'w2',name:'Rice',unit:'per quintal',price:null,prev:null,th:3},
 {id:'w3',name:'Maida (wheat flour)',unit:'per 50kg',price:null,prev:null,th:3},
 {id:'w4',name:'Sugar',unit:'per quintal',price:null,prev:null,th:3},
 {id:'w5',name:'Diesel',unit:'per litre',price:null,prev:null,th:2}
];
var DEF_TOPICS=[
 {id:'t1',label:'Palm oil',q:'palm oil India',on:true},
 {id:'t2',label:'Edible oil',q:'edible oil price India',on:true},
 {id:'t3',label:'Fuel',q:'fuel price India',on:false},
 {id:'t4',label:'Monsoon',q:'monsoon Kerala rainfall',on:false},
 {id:'t5',label:'Rice / wheat',q:'rice price India',on:false}
];

var funds=sGet('ir_funds',DEF_FUNDS);
var fxs=sGet('ir_fx',DEF_FX);
var watch=sGet('ir_watch',DEF_WATCH);
var topics=sGet('ir_topics',DEF_TOPICS);
var defTh=sGet('ir_defth',4);
var lastUpd=sGet('ir_lastupd',null);
var activeTopic='all';

// ---------- utils ----------
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function fmt(n){return n==null?'\u2014':Number(n).toLocaleString('en-IN',{maximumFractionDigits:2})}
function pctCalc(a,b){if(a==null||b==null||b===0)return null;return (a-b)/b*100}
function isOnline(){return navigator.onLine!==false}
function ago(ts){if(!ts)return 'never';var s=(Date.now()-ts)/1000;
 if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+'m ago';
 if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'}
var toastT;
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.classList.add('show');
 clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('show')},2200)}
function go(v){var i;var vs=document.querySelectorAll('.view');for(i=0;i<vs.length;i++){vs[i].classList.remove('active')}
 document.getElementById('v-'+v).classList.add('active');
 var bs=document.querySelectorAll('nav button');for(i=0;i<bs.length;i++){bs[i].classList.toggle('on',bs[i].getAttribute('data-nav')===v)}
 window.scrollTo(0,0)}
function updHeader(busy){var el=document.getElementById('upd');
 if(busy){el.innerHTML='<span class="g"><span class="spin">&#8635;</span> updating</span>';return}
 var head=isOnline()?'Updated':'<span style="color:var(--down)">OFFLINE</span> \u00b7 saved';
 el.innerHTML=head+'<br><span class="g">'+(lastUpd?ago(lastUpd):'\u2014')+'</span>'}
function chgHtml(pc){if(pc==null)return '<div class="c flat">no data</div>';
 var cls=pc>0.001?'up':(pc<-0.001?'down':'flat');var s=pc>0?'+':'';
 return '<div class="c '+cls+'">'+s+pc.toFixed(1)+'%</div>'}
function flagIf(pc,th){var t=(th==null?defTh:th);
 return (pc!=null&&Math.abs(pc)>=t)?'<span class="flag">&#9873; ALERT</span>':''}

// ---------- render ----------
function renderFunds(){var el=document.getElementById('fundList');
 if(!funds.length){el.innerHTML='<div class="empty">No funds yet. Tap "+ Add fund".</div>';return}
 el.innerHTML=funds.map(function(f){var pc=pctCalc(f.nav,f.prev);
  return '<div class="row"><div class="lbl"><div class="n">'+esc(f.name)+flagIf(pc,f.th)+'</div>'
   +'<div class="m">code '+esc(f.code)+' \u00b7 alert \u00b1'+(f.th==null?defTh:f.th)+'%</div></div>'
   +'<div class="val"><div class="p mono">'+fmt(f.nav)+'</div>'+chgHtml(pc)+'</div>'
   +'<button class="del" onclick="delFund(\''+f.id+'\')">\u00d7</button></div>'}).join('')}
function renderFx(){var el=document.getElementById('fxList');
 if(!fxs.length){el.innerHTML='<div class="empty">No currency rows.</div>';return}
 el.innerHTML=fxs.map(function(x){var pc=pctCalc(x.price,x.prev);
  return '<div class="row"><div class="lbl"><div class="n">'+esc(x.name)+flagIf(pc,x.th)+'</div>'
   +'<div class="m">alert \u00b1'+(x.th==null?defTh:x.th)+'%</div></div>'
   +'<div class="val"><div class="p mono">'+fmt(x.price)+'</div>'+chgHtml(pc)+'</div></div>'}).join('')}
function renderWatch(){var el=document.getElementById('watchList');
 if(!watch.length){el.innerHTML='<div class="empty">Nothing here. Tap "+ Add watch item".</div>';return}
 el.innerHTML=watch.map(function(w){
  var has=(w.price!=null&&w.prev!=null&&w.prev!==0);
  var pc=has?pctCalc(w.price,w.prev):null;
  var chg=has?chgHtml(pc):(w.price!=null?'<div class="c flat">base set</div>':'<div class="c flat">no data</div>');
  return '<div class="row"><div class="lbl"><div class="n">'+esc(w.name)+flagIf(pc,w.th)+'</div>'
   +'<div class="m">'+esc(w.unit||'')+' \u00b7 alert \u00b1'+(w.th==null?defTh:w.th)+'%</div></div>'
   +'<div class="val"><div class="p mono">'+fmt(w.price)+'</div>'+chg+'</div>'
   +'<button class="btn sm" onclick="setPrice(\''+w.id+'\')">Set</button>'
   +'<button class="del" onclick="delWatch(\''+w.id+'\')">\u00d7</button></div>'}).join('')}
function renderAll(){renderFunds();renderFx();renderWatch();updHeader(false)}

// ---------- live prices ----------
function fetchNav(f){return fetch('https://api.mfapi.in/mf/'+f.code)
 .then(function(r){return r.json()})
 .then(function(j){var d=j.data||[];if(d.length){f.nav=parseFloat(d[0].nav);
  f.prev=d.length>1?parseFloat(d[1].nav):null}})
 .catch(function(e){})}
function fetchFxOne(x){var start=new Date(Date.now()-10*86400000).toISOString().slice(0,10);
 return fetch('https://api.frankfurter.app/'+start+'..?from='+x.from+'&to='+x.to)
 .then(function(r){return r.json()})
 .then(function(j){var rates=j.rates||{};var days=Object.keys(rates).sort();
  var vals=[];var i;for(i=0;i<days.length;i++){var v=rates[days[i]][x.to];if(v!=null)vals.push(v)}
  if(vals.length){x.price=vals[vals.length-1];x.prev=vals.length>1?vals[vals.length-2]:null}})
 .catch(function(e){})}
function refreshAll(){
 if(!isOnline()){toast('Offline \u2014 showing last saved');renderAll();return}
 updHeader(true);
 var jobs=funds.map(fetchNav).concat(fxs.map(fetchFxOne));
 Promise.allSettled(jobs).then(function(){
  lastUpd=Date.now();sSet('ir_lastupd',lastUpd);sSet('ir_funds',funds);sSet('ir_fx',fxs);renderAll()})}

// ---------- add fund (search by name) ----------
function toggleFundForm(){var f=document.getElementById('fundForm');
 if(f.classList.contains('open')){f.classList.remove('open');f.innerHTML='';return}
 f.classList.add('open');
 f.innerHTML='<div class="fld-wrap"><label class="fld">Fund name (as shown in Groww)</label>'
  +'<input id="fq" placeholder="e.g. Parag Parikh Flexi Cap Direct Growth"></div>'
  +'<button class="btn gold wide" onclick="searchFund()">Search</button><div id="fres"></div>';
 document.getElementById('fq').focus()}
function searchFund(){
 var q=document.getElementById('fq').value.trim();
 var out=document.getElementById('fres');
 if(!q){toast('Type a fund name');return}
 if(!isOnline()){out.innerHTML='<div class="empty">You are offline. Search needs internet.</div>';return}
 out.innerHTML='<div class="empty"><span class="spin">&#8635;</span> Searching\u2026</div>';
 fetch('https://api.mfapi.in/mf/search?q='+encodeURIComponent(q))
 .then(function(r){return r.json()})
 .then(function(list){
  if(!list.length){out.innerHTML='<div class="empty">No match. Try fewer words.</div>';return}
  out.innerHTML='<div style="font-size:11px;color:var(--ink-faint);margin-top:10px">Tap the one matching Groww:</div>'
   +list.slice(0,8).map(function(x){
    return '<div class="result" onclick="pickFund(\''+x.schemeCode+'\',this)" data-name="'+esc(x.schemeName)+'">'
     +'<div style="flex:1">'+esc(x.schemeName)+'</div><div class="code">'+x.schemeCode+'</div></div>'}).join('')})
 .catch(function(e){out.innerHTML='<div class="empty">Search failed. Check internet and try again.</div>'})}
function pickFund(code,el){
 var name=el.getAttribute('data-name');
 var i;for(i=0;i<funds.length;i++){if(funds[i].code===String(code)){toast('Already added');return}}
 var f={id:'f'+Date.now(),name:name,code:String(code),th:2,nav:null,prev:null};
 funds.push(f);sSet('ir_funds',funds);
 var form=document.getElementById('fundForm');form.classList.remove('open');form.innerHTML='';
 renderFunds();toast('Added \u2014 getting price\u2026');
 fetchNav(f).then(function(){sSet('ir_funds',funds);renderFunds()})}
function delFund(id){
 var f=null;var i;for(i=0;i<funds.length;i++){if(funds[i].id===id)f=funds[i]}
 if(!confirm('Remove "'+(f?f.name:'')+'"?'))return;
 funds=funds.filter(function(x){return x.id!==id});sSet('ir_funds',funds);renderFunds();toast('Removed')}

// ---------- watch items ----------
function toggleWatchForm(){var f=document.getElementById('watchForm');
 if(f.classList.contains('open')){f.classList.remove('open');f.innerHTML='';return}
 f.classList.add('open');
 f.innerHTML='<div class="fld-wrap"><label class="fld">Name</label><input id="wn" placeholder="e.g. Coconut oil"></div>'
  +'<div class="grid2"><div class="fld-wrap"><label class="fld">Unit</label><input id="wu" placeholder="per litre"></div>'
  +'<div class="fld-wrap"><label class="fld">Alert %</label><input id="wt" type="number" inputmode="decimal" value="'+defTh+'"></div></div>'
  +'<div class="grid2"><button class="btn ghost" onclick="closeWatch()">Cancel</button>'
  +'<button class="btn gold" onclick="addWatch()">Add</button></div>';
 document.getElementById('wn').focus()}
function closeWatch(){var f=document.getElementById('watchForm');f.classList.remove('open');f.innerHTML=''}
function addWatch(){
 var n=document.getElementById('wn').value.trim();
 if(!n){toast('Enter a name');return}
 var u=document.getElementById('wu').value.trim();
 var t=parseFloat(document.getElementById('wt').value)||defTh;
 watch.push({id:'w'+Date.now(),name:n,unit:u,price:null,prev:null,th:t});
 sSet('ir_watch',watch);closeWatch();renderWatch();toast('Added \u2014 tap Set to enter a price')}
function setPrice(id){
 var w=null;var i;for(i=0;i<watch.length;i++){if(watch[i].id===id)w=watch[i]}
 if(!w)return;
 var v=prompt('New price for '+w.name+'\n('+(w.unit||'')+')',w.price!=null?w.price:'');
 if(v===null)return;
 var num=parseFloat(String(v).replace(/[^0-9.]/g,''));
 if(isNaN(num)){toast('Enter a number');return}
 w.prev=(w.price!=null?w.price:num);w.price=num;
 sSet('ir_watch',watch);renderWatch();toast('Price updated')}
function delWatch(id){
 var w=null;var i;for(i=0;i<watch.length;i++){if(watch[i].id===id)w=watch[i]}
 if(!confirm('Remove "'+(w?w.name:'')+'"?'))return;
 watch=watch.filter(function(x){return x.id!==id});sSet('ir_watch',watch);renderWatch();toast('Removed')}

// ---------- news ----------
function renderTopics(){var bar=document.getElementById('topicBar');
 var on=topics.filter(function(t){return t.on});
 bar.innerHTML='<div class="chip '+(activeTopic==='all'?'on':'')+'" onclick="setTopic(\'all\')">All</div>'
  +on.map(function(t){return '<div class="chip '+(activeTopic===t.id?'on':'')+'" onclick="setTopic(\''+t.id+'\')">'+esc(t.label)+'</div>'}).join('')}
function setTopic(id){activeTopic=id;renderTopics();loadNews()}
function parseG(s){if(!s)return Date.now();var m=s.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
 if(!m)return Date.now();return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6])}
function tAgo(ts){var s=(Date.now()-ts)/1000;if(s<3600)return Math.max(1,Math.floor(s/60))+'m ago';
 if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'}
function newsItemHtml(a){return '<a class="news-item" href="'+encodeURI(a.url)+'" target="_blank" rel="noopener">'
 +'<div class="tl">'+esc(a.title)+'</div><div class="me"><span class="topic-pill">'+esc(a.topic)+'</span>'
 +'<span class="src">'+esc(a.domain)+'</span><span>\u00b7</span><span>'+tAgo(a.ts)+'</span></div></a>'}
function renderNewsList(items){document.getElementById('newsList').innerHTML=items.map(newsItemHtml).join('')}
function showCachedNews(reason){
 var cached=sGet('ir_news',null);
 var list=document.getElementById('newsList');
 var status=document.getElementById('newsStatus');
 if(cached&&cached.items&&cached.items.length){
  renderNewsList(cached.items);
  status.textContent=reason+' \u00b7 saved '+ago(cached.ts)}
 else{list.innerHTML='<div class="empty">No saved headlines yet. Connect to internet once.</div>';
  status.textContent=reason}}
function fetchGdelt(t){
 var url='https://api.gdeltproject.org/api/v2/doc/doc?query='+encodeURIComponent(t.q)
  +'&mode=ArtList&format=json&maxrecords=12&timespan=4d&sort=DateDesc';
 return fetch(url).then(function(res){return res.text()}).then(function(txt){
  var d;try{d=JSON.parse(txt)}catch(e){return []}
  if(!d.articles)return [];
  return d.articles.map(function(a){return {title:a.title,url:a.url,
   domain:String(a.domain||'news').replace(/^www\./,''),ts:parseG(a.seendate),topic:t.label}})})}
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
 list.innerHTML='<div class="empty"><span class="spin">&#8635;</span> Scanning news\u2026</div>';
 Promise.allSettled(act.map(fetchGdelt)).then(function(settled){
  var all=[];var i;
  for(i=0;i<settled.length;i++){if(settled[i].status==='fulfilled')all=all.concat(settled[i].value)}
  var seen={};all=all.filter(function(a){if(seen[a.url])return false;seen[a.url]=1;return true});
  all.sort(function(a,b){return b.ts-a.ts});all=all.slice(0,40);
  btn.innerHTML='&#8635; Refresh';
  if(!all.length){showCachedNews('Nothing new found');return}
  renderNewsList(all);
  sSet('ir_news',{ts:Date.now(),items:all});
  status.textContent=all.length+' headlines'})}

// ---------- setup ----------
function renderTopicManage(){var box=document.getElementById('topicManage');
 box.innerHTML=topics.map(function(t){
  return '<div class="row" style="padding-left:0;padding-right:0">'
   +'<div class="lbl"><div class="n">'+esc(t.label)+'</div><div class="m">'+esc(t.q)+'</div></div>'
   +'<button class="btn sm '+(t.on?'gold':'')+'" onclick="togTopic(\''+t.id+'\')">'+(t.on?'On':'Off')+'</button>'
   +'<button class="del" onclick="delTopic(\''+t.id+'\')">\u00d7</button></div>'}).join('')}
function togTopic(id){var i;for(i=0;i<topics.length;i++){if(topics[i].id===id)topics[i].on=!topics[i].on}
 sSet('ir_topics',topics);renderTopicManage();renderTopics()}
function delTopic(id){
 var t=null;var i;for(i=0;i<topics.length;i++){if(topics[i].id===id)t=topics[i]}
 if(!confirm('Remove topic "'+(t?t.label:'')+'"?'))return;
 topics=topics.filter(function(x){return x.id!==id});sSet('ir_topics',topics);
 renderTopicManage();renderTopics();toast('Topic removed')}
function addTopic(){
 var l=document.getElementById('ntLabel').value.trim();
 var q=document.getElementById('ntQuery').value.trim();
 if(!l||!q){toast('Fill both boxes');return}
 topics.push({id:'t'+Date.now(),label:l,q:q,on:true});sSet('ir_topics',topics);
 document.getElementById('ntLabel').value='';document.getElementById('ntQuery').value='';
 renderTopicManage();renderTopics();toast('Topic added')}
function saveDef(){defTh=parseFloat(document.getElementById('defTh').value)||4;
 sSet('ir_defth',defTh);renderAll();toast('Limit saved')}
function resetAll(){
 if(!confirm('Reset everything to default? This cannot be undone.'))return;
 funds=JSON.parse(JSON.stringify(DEF_FUNDS));fxs=JSON.parse(JSON.stringify(DEF_FX));
 watch=JSON.parse(JSON.stringify(DEF_WATCH));topics=JSON.parse(JSON.stringify(DEF_TOPICS));defTh=4;
 sSet('ir_funds',funds);sSet('ir_fx',fxs);sSet('ir_watch',watch);sSet('ir_topics',topics);sSet('ir_defth',4);
 document.getElementById('defTh').value=4;
 renderAll();renderTopicManage();renderTopics();refreshAll();toast('Reset done')}

// ---------- online / offline ----------
window.addEventListener('online',function(){toast('Back online \u2014 updating');refreshAll();loadNews()});
window.addEventListener('offline',function(){updHeader(false);toast('Offline \u2014 showing last saved')});

// ---------- init ----------
document.getElementById('defTh').value=defTh;
document.getElementById('refreshBtn').onclick=function(){refreshAll();toast('Updating prices\u2026')};
document.getElementById('addFundBtn').onclick=toggleFundForm;
document.getElementById('addWatchBtn').onclick=toggleWatchForm;
document.getElementById('newsRefresh').onclick=loadNews;
renderAll();renderTopicManage();renderTopics();
refreshAll();loadNews();
/* END app.js v3 */
