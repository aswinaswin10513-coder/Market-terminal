// X V MMII - data layer v4
var XV_VERSION='v4';
var XV_HIST={};

// ---------- storage ----------
function sGet(k,d){try{var v=localStorage.getItem(k);return v!=null?JSON.parse(v):d}catch(e){return d}}
function sSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}

// ---------- utils ----------
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function fmtN(n,dec){if(n==null||isNaN(n))return '\u2014';return Number(n).toLocaleString('en-IN',{maximumFractionDigits:(dec==null?2:dec)})}
function pctCalc(a,b){if(a==null||b==null||b===0)return null;return (a-b)/b*100}
function isOnline(){return navigator.onLine!==false}
function ago(ts){if(!ts)return 'never';var s=(Date.now()-ts)/1000;
 if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+'m ago';
 if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'}

// ---------- defaults ----------
var DEF_FUNDS=[
 {id:'f1',name:'UTI Nifty 50 Index Fund - Growth Option - Direct',code:'120716',th:2,nav:null,prev:null,spark:[]},
 {id:'f2',name:'Nippon India Gold Savings Fund - Direct Plan - Growth',code:'118663',th:2,nav:null,prev:null,spark:[]},
 {id:'f3',name:'ICICI Prudential Savings Fund - Direct Plan - Growth',code:'120398',th:2,nav:null,prev:null,spark:[]}
];
var DEF_FX=[{id:'x1',name:'USD / INR',from:'USD',to:'INR',th:1,price:null,prev:null,spark:[]}];
var DEF_GLOBAL=[
 {id:'g1',kind:'crypto',cg:'bitcoin',name:'Bitcoin',sym:'BTC',price:null,chg:null,th:5},
 {id:'g2',kind:'gold',name:'Gold (USD/oz)',price:null,prev:null,th:2}
];
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

// ---------- event -> asset map (butterfly logic) ----------
var MAP=[
 {k:['crude','opec','brent','oil price','petrol price'],a:['Diesel','USD / INR','FMCG costs'],
  why:'India imports about 85% of its crude. Costlier crude means costlier diesel and a weaker rupee, so your transport and packing costs rise.'},
 {k:['palm','indonesia','malaysia'],a:['Palm oil','Edible oil'],
  why:'Most of India\u2019s palm oil comes from Indonesia and Malaysia. Their prices and export rules set your landed cost.'},
 {k:['fed','us rate','treasury','dollar index','powell'],a:['USD / INR','Gold (USD/oz)','Nifty'],
  why:'Higher US rates pull money out of India: the rupee weakens, gold reacts, and foreign investors sell Indian shares.'},
 {k:['rbi','repo rate'],a:['Nifty','Loan cost'],
  why:'The RBI repo rate is the price of loans. Hikes cool demand and markets; cuts do the opposite.'},
 {k:['monsoon','rainfall','imd','el nino','la nina'],a:['Rice','Sugar','Maida (wheat flour)'],
  why:'Rain decides crop output and rural income \u2014 it moves food prices and village demand for FMCG goods.'},
 {k:['inflation','cpi'],a:['RBI policy','FMCG demand'],
  why:'High inflation keeps the RBI tight (costlier credit) and squeezes what customers can spend.'},
 {k:['gold','bullion'],a:['Gold (USD/oz)','Nippon Gold fund'],
  why:'Global gold moves your Nippon gold fund NAV directly, plus the rupee effect on top.'},
 {k:['export ban','export duty','wheat export','rice export'],a:['Rice','Maida (wheat flour)'],
  why:'Export rules change how much grain stays in India \u2014 local supply and price shift fast.'},
 {k:['rupee','inr weak','inr fall','inr slips'],a:['Edible oil','Diesel','Nippon Gold fund'],
  why:'A weaker rupee makes every imported input costlier and lifts the gold price in INR.'}
];
function tagHeadline(title){
 var t=String(title||'').toLowerCase();var assets=[];var why=null;var i,j;
 for(i=0;i<MAP.length;i++){var hit=false;
  for(j=0;j<MAP[i].k.length;j++){if(t.indexOf(MAP[i].k[j])>-1){hit=true;break}}
  if(hit){if(!why)why=MAP[i].why;
   for(j=0;j<MAP[i].a.length;j++){if(assets.indexOf(MAP[i].a[j])<0)assets.push(MAP[i].a[j])}}}
 return {assets:assets.slice(0,4),why:why};
}

// ---------- fuzzy search scoring ----------
function fuzzyScore(q,s){
 q=String(q||'').toLowerCase();s=String(s||'').toLowerCase();
 if(!q)return 0;
 var idx=s.indexOf(q);
 if(idx===0)return 100;
 if(idx>0)return 80-Math.min(idx,30);
 var qi=0,score=40,gap=0,i;
 for(i=0;i<s.length&&qi<q.length;i++){
  if(s[i]===q[qi]){qi++;if(gap>2)score-=2;gap=0}else{gap++}}
 return qi===q.length?score:-1;
}

// ---------- recent searches ----------
function getRecents(){return sGet('xv_recents',[])}
function pushRecent(q){if(!q)return;var r=getRecents().filter(function(x){return x!==q});
 r.unshift(q);sSet('xv_recents',r.slice(0,8))}

// ---------- fetchers ----------
function fetchFund(f){
 return fetch('https://api.mfapi.in/mf/'+f.code)
 .then(function(r){return r.json()})
 .then(function(j){var d=j.data||[];if(!d.length)return;
  f.nav=parseFloat(d[0].nav);
  f.prev=d.length>1?parseFloat(d[1].nav):null;
  var sp=[],i;
  for(i=Math.min(29,d.length-1);i>=0;i--){sp.push(parseFloat(d[i].nav))}
  f.spark=sp;
  var hist=[],n=Math.min(d.length,400);
  for(i=n-1;i>=0;i--){hist.push(parseFloat(d[i].nav))}
  XV_HIST['fund:'+f.code]=hist;})
 .catch(function(e){})
}
function parseFx(j,x){var rates=j.rates||{};var days=Object.keys(rates).sort();
 var vals=[],i;for(i=0;i<days.length;i++){var v=rates[days[i]][x.to];if(v!=null)vals.push(v)}
 if(vals.length){x.price=vals[vals.length-1];x.prev=vals.length>1?vals[vals.length-2]:null;
  x.spark=vals.slice(-30);XV_HIST['fx:'+x.id]=vals;return true}
 return false}
function fetchFx(x){
 var start=new Date(Date.now()-45*86400000).toISOString().slice(0,10);
 return fetch('https://api.frankfurter.app/'+start+'..?from='+x.from+'&to='+x.to)
 .then(function(r){return r.json()}).then(function(j){if(!parseFx(j,x))throw 0})
 .catch(function(){
  return fetch('https://api.frankfurter.dev/v1/'+start+'..?base='+x.from+'&symbols='+x.to)
  .then(function(r){return r.json()}).then(function(j){if(!parseFx(j,x))throw 0})})
 .catch(function(){
  return fetch('https://open.er-api.com/v6/latest/'+x.from)
  .then(function(r){return r.json()})
  .then(function(j){var v=j&&j.rates&&j.rates[x.to];
   if(v!=null){if(x.price!=null)x.prev=x.price;x.price=v}})})
 .catch(function(e){})
}
function fetchGlobal(g){
 if(g.kind==='crypto'){
  return fetch('https://api.coingecko.com/api/v3/simple/price?ids='+g.cg+'&vs_currencies=inr&include_24hr_change=true')
  .then(function(r){return r.json()})
  .then(function(j){var d=j[g.cg];if(d){g.price=d.inr;g.chg=d.inr_24h_change}})
  .catch(function(e){})}
 if(g.kind==='gold'){
  return fetch('https://api.gold-api.com/price/XAU')
  .then(function(r){return r.json()})
  .then(function(j){if(j&&j.price!=null){if(g.price!=null)g.prev=g.price;g.price=j.price}})
  .catch(function(e){})}
 return Promise.resolve()
}
function mfSearch(q){
 return fetch('https://api.mfapi.in/mf/search?q='+encodeURIComponent(q))
 .then(function(r){return r.json()})
 .then(function(list){return (list||[]).slice(0,8)})
 .catch(function(e){return []})
}
function cgSearch(q){
 return fetch('https://api.coingecko.com/api/v3/search?query='+encodeURIComponent(q))
 .then(function(r){return r.json()})
 .then(function(j){return (j.coins||[]).slice(0,6)})
 .catch(function(e){return []})
}
function gdeltFetch(t){
 var url='https://api.gdeltproject.org/api/v2/doc/doc?query='+encodeURIComponent(t.q)
  +'&mode=ArtList&format=json&maxrecords=12&timespan=4d&sort=DateDesc';
 return fetch(url).then(function(res){return res.text()}).then(function(txt){
  var d;try{d=JSON.parse(txt)}catch(e){return []}
  if(!d.articles)return [];
  return d.articles.map(function(a){return {title:a.title,url:a.url,
   domain:String(a.domain||'news').replace(/^www\./,''),ts:gdParse(a.seendate),topic:t.label}})})
 .catch(function(e){return []})
}
function gdParse(s){if(!s)return Date.now();
 var m=s.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
 if(!m)return Date.now();
 return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+m[6])}
/* END data.js v4 */
   
