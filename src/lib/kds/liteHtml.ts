// HTML/CSS/JS de la "KDS liviana" para WebView viejas (Android 4/5).
// Sin React, sin CSS grid/flex modernos (usa inline-block/float), sin mask,
// sin backdrop-filter, sin dvh, sin Intl en el cliente. JS en ES5 + XMLHttpRequest.
import type { KdsOrderLite } from "./liteServer";

export function escapeHtml(s: string): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Mismo lenguaje visual (alto contraste), pero con layout compatible con WebView antiguas.
const CSS = `
  *{ box-sizing:border-box; -webkit-box-sizing:border-box; }
  html,body{ margin:0; padding:0; background:#fff; color:#000; font-family:system-ui,-apple-system,Arial,sans-serif; -webkit-text-size-adjust:100%; }
  .topbar{ background:#fff; border-bottom:2px solid #8a97ad; padding:10px 14px; position:fixed; top:0; left:0; right:0; z-index:20; }
  .topbar .t{ font-size:18px; font-weight:800; color:#000; display:inline-block; }
  .topbar .r{ float:right; }
  .topbar .r .btn{ display:inline-block; vertical-align:middle; margin-left:8px; padding:8px 12px; border-radius:9px; border:1px solid #8a97ad; background:#eceff5; color:#000; font-weight:700; font-size:13px; cursor:pointer; text-decoration:none; }
  .topbar .r .btn.on{ background:#16a34a; color:#fff; border-color:#16a34a; }
  .cf:after{ content:""; display:block; clear:both; }
  .wrap{ padding:76px 12px 24px; }
  .sect-title{ font-size:14px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#000; margin:0 0 10px; }
  .sect-title .count{ display:inline-block; margin-left:8px; background:#eceff5; border:1px solid #8a97ad; color:#000; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:800; }
  .hard-sep{ height:2px; background:#8a97ad; margin:16px 0; }

  .grid{ font-size:0; }  /* elimina el espacio entre inline-block */
  .card{ display:inline-block; vertical-align:top; width:320px; margin:0 10px 10px 0; background:#fff; border:1px solid #8a97ad;
    border-left-width:9px; border-left-color:#64748b; border-radius:14px; padding:12px 14px; font-size:14px; }
  .card.a-gray{ border-left-color:#475569; }
  .card.a-yellow{ border-left-color:#f59e0b; }
  .card.a-red{ border-left-color:#f97316; }
  .card.a-redx{ border-left-color:#ef4444; }
  .card.a-green{ border-left-color:#22c55e; }
  .card.done{ background:#eceff5; }

  .card .head{ margin-bottom:8px; }
  .card .type{ display:inline-block; vertical-align:middle; font-size:12px; font-weight:800; padding:3px 10px; border-radius:999px; text-transform:uppercase; letter-spacing:.04em; background:#eceff5; color:#000; }
  .card .type.t-delivery{ background:#bfdbfe; color:#0b2a6b; }
  .card .type.t-mesa{ background:#ddd6fe; color:#2e1065; }
  .card .type.t-retiro{ background:#a7f3d0; color:#064e3b; }
  .card .timer{ float:right; font-size:22px; font-weight:800; background:#64748b; color:#000; border-radius:9px; padding:2px 10px; }
  .card.a-gray .timer{ background:#475569; color:#fff; }
  .card.a-yellow .timer{ background:#f59e0b; color:#000; }
  .card.a-red .timer{ background:#f97316; color:#000; }
  .card.a-redx .timer{ background:#ef4444; color:#fff; }
  .card.a-green .timer{ background:#22c55e; color:#000; }
  .card.done .timer{ background:#9fb0c6; color:#000; }

  .card .cust{ font-size:21px; font-weight:800; color:#000; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .card .done-t{ font-size:12px; font-weight:700; color:#1b2534; margin-top:1px; }
  .card .items{ list-style:none; margin:8px 0 0; padding:9px 0 0; border-top:1px dashed #8a97ad; }
  .card .items li{ color:#000; font-size:14px; font-weight:700; line-height:1.3; margin:0 0 5px; padding-left:16px; position:relative; }
  .card .items li:before{ content:""; position:absolute; left:0; top:7px; width:7px; height:7px; background:#475569; }
  .card .ready{ display:block; width:100%; margin-top:8px; padding:10px; border:0; border-radius:10px; background:#16a34a; color:#fff; font-weight:800; font-size:15px; cursor:pointer; text-align:center; }
  .empty{ color:#1b2534; font-size:14px; padding:6px 0; }
`;

// Script ES5 (var, XMLHttpRequest, concatenación). Debe funcionar en WebView viejas.
const JS = `
(function(){
  var DATA = window.__KDS_DATA || {pend:[],comp:[],now:0};
  var OFFSET = (DATA.now||0) - Math.floor(new Date().getTime()/1000);
  function esc(s){ s=(s==null?'':''+s); return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function pad(n){ return (n<10?'0':'')+n; }
  function fmt(sec){ if(sec<0)sec=0; var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60; return pad(h)+':'+pad(m)+':'+pad(s); }
  function ageClass(sec, done){ if(done){ if(sec<600)return'a-green'; if(sec<1200)return'a-yellow'; if(sec<2400)return'a-red'; return'a-redx'; } if(sec<600)return'a-gray'; if(sec<1200)return'a-yellow'; if(sec<2400)return'a-red'; return'a-redx'; }
  function nowSec(){ return Math.floor(new Date().getTime()/1000) + OFFSET; }
  function completeOn(){ try{ return localStorage.getItem('kdsComplete')==='1'; }catch(e){ return false; } }

  function cardHtml(o){
    var completed = !!o.completed;
    var sec = completed ? Math.max(0,(o.done||0)-(o.created||0)) : Math.max(0, nowSec()-(o.created||0));
    var cls = ageClass(sec, completed);
    var items = '';
    if(o.lines && o.lines.length){
      items = '<ul class="items">';
      for(var i=0;i<o.lines.length;i++){ items += '<li>'+esc(o.lines[i])+'</li>'; }
      items += '</ul>';
    }
    var doneT = (completed && o.doneHM) ? '<div class="done-t">Completado '+esc(o.doneHM)+'</div>' : '';
    var readyBtn = (!completed && completeOn()) ? '<button class="ready" data-id="'+esc(o.id)+'">\\u2713 Marcar listo</button>' : '';
    return '<div class="card '+cls+(completed?' done':'')+'" data-id="'+esc(o.id)+'" data-created="'+(o.created||0)+'" data-done="'+(o.done||0)+'" data-completed="'+(completed?1:0)+'">'
      + '<div class="head cf"><span class="timer">'+fmt(sec)+'</span><span class="type '+esc(o.typeCls)+'">'+esc(o.typeText)+'</span></div>'
      + '<div class="cust">'+esc(o.customer)+'</div>'
      + doneT + items + readyBtn
      + '</div>';
  }
  function listHtml(arr){
    if(!arr || !arr.length) return '<div class="empty">Sin pedidos.</div>';
    var h=''; for(var i=0;i<arr.length;i++){ h+=cardHtml(arr[i]); } return h;
  }
  function render(){
    document.getElementById('gridPend').innerHTML = listHtml(DATA.pend);
    document.getElementById('gridComp').innerHTML = listHtml(DATA.comp);
    document.getElementById('cntPend').innerHTML = (DATA.pend?DATA.pend.length:0);
    document.getElementById('cntComp').innerHTML = (DATA.comp?DATA.comp.length:0);
    bindReady();
  }
  function tick(){
    var n = nowSec();
    var cards = document.getElementsByClassName('card');
    for(var i=0;i<cards.length;i++){
      var c = cards[i];
      if(c.getAttribute('data-completed')==='1') continue;
      var created = parseInt(c.getAttribute('data-created')||'0',10)||0;
      var sec = Math.max(0, n-created);
      var t = c.getElementsByClassName('timer')[0];
      if(t) t.innerHTML = fmt(sec);
      var want = ageClass(sec,false);
      c.className = 'card '+want;
    }
  }
  function bindReady(){
    var btns = document.getElementsByClassName('ready');
    for(var i=0;i<btns.length;i++){
      btns[i].onclick = function(){
        var id = this.getAttribute('data-id');
        this.disabled = true; this.innerHTML = '...';
        var x = new XMLHttpRequest();
        x.open('POST','/api/kds/ready',true);
        x.setRequestHeader('Content-Type','application/json');
        x.onreadystatechange = function(){ if(x.readyState===4){ poll(); } };
        x.send(JSON.stringify({id:id}));
      };
    }
  }
  function poll(){
    var x = new XMLHttpRequest();
    x.open('GET','/api/kds/data?t='+new Date().getTime(),true);
    x.onreadystatechange = function(){
      if(x.readyState===4 && x.status===200){
        try{ var d = JSON.parse(x.responseText); if(d && d.ok){ DATA = d; OFFSET = (d.now||0)-Math.floor(new Date().getTime()/1000); render(); } }catch(e){}
      }
    };
    x.send();
  }
  var tg = document.getElementById('tgComplete');
  if(tg){
    if(completeOn()) tg.className = 'btn on';
    tg.onclick = function(){ var on=!completeOn(); try{ localStorage.setItem('kdsComplete', on?'1':'0'); }catch(e){} tg.className = on?'btn on':'btn'; render(); };
  }
  var rf = document.getElementById('btnRefresh'); if(rf){ rf.onclick = function(){ poll(); }; }

  render(); tick();
  setInterval(tick, 1000);
  setInterval(poll, 4000);
  setInterval(function(){ location.reload(); }, 15*60*1000); // limpieza en equipos débiles
})();
`;

export function kdsPage(data: { pend: KdsOrderLite[]; comp: KdsOrderLite[]; now: number }, storeName: string): string {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KDS Cocina</title><style>${CSS}</style></head>
<body>
  <div class="topbar cf">
    <span class="t">KDS Cocina</span>
    <span class="r">
      <span class="btn" id="tgComplete">✓ Completar</span>
      <span class="btn" id="btnRefresh">↻ Actualizar</span>
    </span>
  </div>
  <div class="wrap">
    <h2 class="sect-title">📌 Pendientes <span class="count" id="cntPend">0</span></h2>
    <div class="grid" id="gridPend"></div>
    <div class="hard-sep"></div>
    <h2 class="sect-title">✅ Completados <span class="count" id="cntComp">0</span></h2>
    <div class="grid" id="gridComp"></div>
  </div>
  <script>window.__KDS_DATA = ${json};</script>
  <script>${JS}</script>
</body></html>`;
}

export function pairPage(error?: string): string {
  const err = error ? `<p class="err">${escapeHtml(error)}</p>` : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Vincular KDS</title>
<style>
  *{ box-sizing:border-box; } html,body{ margin:0; height:100%; background:#0d1526; color:#fff; font-family:system-ui,-apple-system,Arial,sans-serif; }
  .box{ max-width:360px; margin:12% auto 0; background:#fff; color:#000; border-radius:16px; padding:26px 22px; text-align:center; }
  .box h1{ font-size:20px; margin:0 0 6px; }
  .box p{ color:#1b2534; font-size:14px; margin:0 0 16px; }
  .box input{ width:100%; font-size:28px; letter-spacing:4px; text-align:center; text-transform:uppercase; padding:12px; border:2px solid #8a97ad; border-radius:12px; margin-bottom:12px; }
  .box button{ width:100%; padding:14px; border:0; border-radius:12px; background:#16a34a; color:#fff; font-size:17px; font-weight:800; cursor:pointer; }
  .err{ color:#b91c1c; font-weight:700; }
</style></head>
<body>
  <form class="box" method="post" action="/api/kds/pair">
    <h1>Vincular esta pantalla</h1>
    <p>Escribe el código que aparece en el panel (Centro de pedidos → Vincular tablet).</p>
    ${err}
    <input name="code" autofocus autocomplete="off" placeholder="CÓDIGO" maxlength="12">
    <button type="submit">Vincular</button>
  </form>
</body></html>`;
}
