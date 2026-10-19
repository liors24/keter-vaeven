/* כתר ואבן — משחק בניית טירות ימי־ביניימי בתלת־ממד, רץ בדפדפן */
(function () {
'use strict';
const T = window.THREE;
if (!T) {
  document.body.innerHTML = '<p style="color:#f2e6c9;background:#15110c;padding:24px;font:16px sans-serif;direction:rtl">לא הצלחנו לטעון את המנוע התלת־ממדי. בדקו את החיבור לאינטרנט ורעננו את הדף.</p>';
  return;
}

// ============================================================ קבועים וכלים
const WORLD = 256, MAXY = 64, CX = 128, CZ = 128;
const SAVE_KEY = 'keter-va-even-save-v1';
const IS_TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(x, z, s) { let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, z, s) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s), c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, z, s, oct = 4) { let sum = 0, amp = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, z * f, s + i * 17); n += amp; amp *= 0.5; f *= 2; } return sum / n; }
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(h, a) { const c = hexRgb(h); const f = v => clamp(Math.round(a < 0 ? v * (1 + a) : v + (255 - v) * a), 0, 255); return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`; }
function turnTo(cur, target, k) { let d = target - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return cur + d * Math.min(1, k); }
function pref(k, v) { try { if (v === undefined) return localStorage.getItem('kve-' + k); localStorage.setItem('kve-' + k, v); } catch (e) { return null; } }
const fmt = n => Math.floor(n).toLocaleString('he-IL');

// ============================================================ סגנון וממשק
const CSS = `
:root{--night:#15110c;--panel:rgba(27,21,14,.93);--panel-2:#30251a;--edge:#6e5536;--parch:#f2e6c9;--parch-2:#dccaa0;--ink:#2e2114;--ink-2:#6b5434;--gold:#e3b04b;--gold-deep:#a87a26;--blood:#c0463a;--ok:#86c064;--display:"Frank Ruhl Libre","David Libre",Georgia,serif;--body:"Assistant","Segoe UI",Arial,sans-serif;--topH:52px;--dockH:130px;color-scheme:dark}
html,body{height:100%;margin:0;background:var(--night);overflow:hidden;overscroll-behavior:none}
#cs-root{position:fixed;inset:0;overflow:hidden;font-family:var(--body);color:var(--parch);direction:rtl;-webkit-user-select:none;user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;background:var(--night);font-size:14px}
#cs-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none}
#cs-root button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
#cs-root button:focus-visible,#cs-root input:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
#cs-root input{-webkit-user-select:text;user-select:text}
.btn{background:linear-gradient(#3d2f20,#251b12);border:1px solid var(--edge);border-radius:8px;padding:9px 16px;color:var(--parch);box-shadow:inset 0 1px 0 rgba(255,230,180,.09),0 2px 5px rgba(0,0,0,.35);font-weight:600}
.btn:active{transform:translateY(1px)}
.btn.primary{background:linear-gradient(#d9a548,#93661f);border-color:#f3cd78;color:#1f150a;font-weight:700}
#cs-root .btn{color:var(--parch)}
#cs-root .btn.primary{color:#1f150a}
.btn.danger{background:linear-gradient(#8f3027,#5e1d17);border-color:#c45a4c}
.btn.big{font-size:18px;padding:13px 26px;font-family:var(--display)}
.btn[disabled]{opacity:.45;cursor:not-allowed}
.hidden-ui{display:none!important}
#hud{position:absolute;inset:0;pointer-events:none}
#hud > *{pointer-events:auto}
#topbar{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 6px) max(10px,env(safe-area-inset-right,0px)) 8px max(10px,env(safe-area-inset-left,0px));background:linear-gradient(rgba(12,9,6,.78),rgba(12,9,6,0));pointer-events:none}
#topbar > *{pointer-events:auto}
.realm{display:flex;align-items:center;gap:8px;min-width:0;flex:0 1 auto}
.realm canvas{width:27px;height:38px;flex:none;filter:drop-shadow(0 2px 2px rgba(0,0,0,.6))}
.realm .nm{font-family:var(--display);font-weight:700;font-size:17px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:30vw;text-shadow:0 1px 3px #000}
.realm .sub{font-size:11.5px;color:var(--parch-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:30vw}
.stats{display:flex;gap:5px;margin-inline-start:auto;flex-wrap:wrap;justify-content:flex-end;min-width:0}
.chip{display:flex;align-items:center;gap:5px;background:var(--panel);border:1px solid var(--edge);border-radius:999px;padding:3px 10px;font-variant-numeric:tabular-nums;font-size:14px;white-space:nowrap}
.chip b{font-weight:700}
.chip.gold b{color:var(--gold)}
.chip small{font-size:11px;color:var(--ok);font-weight:600}
.chip svg{width:15px;height:15px;flex:none}
.sys{display:flex;gap:5px;flex:none}
.sq{width:38px;height:38px;display:grid;place-items:center;background:var(--panel);border:1px solid var(--edge);border-radius:8px;padding:0}
.sq svg{width:20px;height:20px}
.sq.off{opacity:.5}
#quest{position:absolute;top:calc(var(--topH) + 4px);right:max(10px,env(safe-area-inset-right,0px));max-width:min(330px,56vw);background:linear-gradient(#f4e8cb,#e3d0a3);color:var(--ink);border-radius:4px 4px 10px 10px;padding:6px 11px 7px;box-shadow:0 3px 10px rgba(0,0,0,.45);font-size:13px;line-height:1.35;border:1px solid #b8995e}
#quest .qh{font-family:var(--display);font-weight:700;font-size:12px;color:var(--ink-2);letter-spacing:.02em}
#quest .qb{height:4px;border-radius:2px;background:rgba(80,55,20,.2);margin-top:4px;overflow:hidden}
#quest .qb i{display:block;height:100%;background:var(--gold-deep);width:0}
#mmwrap{position:absolute;top:calc(var(--topH) + 4px);left:max(10px,env(safe-area-inset-left,0px));width:136px;height:136px;border-radius:50%;padding:3px;background:conic-gradient(from 0deg,#b88b35,#f0cb72,#9a6f28,#e7bd62,#b88b35);box-shadow:0 3px 12px rgba(0,0,0,.55)}
#minimap{width:100%;height:100%;border-radius:50%;display:block;background:#203a4f;image-rendering:pixelated}
#mmwrap .n{position:absolute;top:-2px;left:50%;transform:translateX(-50%);font:700 11px var(--display);color:#2a1c0c;background:var(--gold);border-radius:50%;width:17px;height:17px;display:grid;place-items:center}
#toasts{position:absolute;top:calc(var(--topH) + 70px);left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;width:min(92vw,460px)}
.toast{background:var(--panel);border:1px solid var(--gold-deep);border-radius:8px;padding:7px 14px;font-size:14px;text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.5);animation:tIn .25s ease-out}
.toast.big{font-family:var(--display);font-size:19px;font-weight:700;color:var(--gold);padding:10px 18px;border-width:2px}
.toast.warn{border-color:var(--blood);color:#ffd9d2}
.toast.out{opacity:0;transition:opacity .4s}
@keyframes tIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
#hud .pop{position:absolute;font:800 16px var(--body);color:var(--gold);text-shadow:0 1px 2px #000,0 0 6px rgba(0,0,0,.6);pointer-events:none;animation:popUp 1.1s ease-out forwards;white-space:nowrap;transform:translate(-50%,-50%)}
#hud .pop.neg{color:#ff8c7c}
@keyframes popUp{from{opacity:1;margin-top:0}to{opacity:0;margin-top:-46px}}
#dock{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(rgba(30,23,15,.96),rgba(20,15,10,.98));border-top:2px solid var(--gold-deep);padding:0 max(8px,env(safe-area-inset-right,0px)) env(safe-area-inset-bottom,0px) max(8px,env(safe-area-inset-left,0px));box-shadow:0 -4px 16px rgba(0,0,0,.4)}
#modes{display:flex;gap:4px;justify-content:center;transform:translateY(-50%);margin-bottom:-12px}
#modes button{background:var(--panel-2);border:1px solid var(--edge);border-radius:999px;padding:5px 15px;font:700 14px var(--display);color:var(--parch-2);display:flex;gap:6px;align-items:center}
#modes button svg{width:16px;height:16px}
#modes button.on{background:linear-gradient(#e0ae4f,#9c6e22);color:#1f150a;border-color:#f3cd78}
.row{display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;padding:5px 2px 7px;touch-action:pan-x;scrollbar-width:thin;scrollbar-color:var(--edge) transparent;-webkit-overflow-scrolling:touch}
.row::-webkit-scrollbar{height:4px}.row::-webkit-scrollbar-thumb{background:var(--edge);border-radius:2px}
.tool{flex:0 0 auto;width:58px;height:54px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:linear-gradient(#35291c,#221910);border:1px solid #4d3b26;border-radius:8px;font-size:11px;font-weight:600;padding:0;color:var(--parch-2)}
.tool svg{width:22px;height:22px}
.tool.on{border-color:var(--gold);color:var(--gold);background:linear-gradient(#45341f,#2a1f12);box-shadow:inset 0 0 10px rgba(227,176,75,.25)}
.tool.act{color:var(--parch)}
.sep{flex:0 0 1px;background:#4d3b26;margin:4px 2px}
.mat{flex:0 0 auto;width:60px;height:66px;white-space:nowrap;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;padding:4px 0 0;background:#211810;border:1px solid #4d3b26;border-radius:8px;font-size:10.5px;color:var(--parch-2);line-height:1.1}
.mat img{width:30px;height:30px;image-rendering:pixelated;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.6)}
.mat .c{color:var(--gold);font-variant-numeric:tabular-nums;font-size:10px}
.mat.on{border-color:var(--gold);background:#3a2b19;color:var(--parch)}
.bcard{flex:0 0 auto;width:132px;min-height:60px;text-align:right;padding:6px 8px;background:#211810;border:1px solid #4d3b26;border-radius:8px;display:flex;flex-direction:column;gap:2px}
.bcard b{font-family:var(--display);font-size:14px;color:var(--parch)}
.bcard .c{color:var(--gold);font-size:12px;font-weight:700}
.bcard small{font-size:11px;color:var(--parch-2);line-height:1.25}
.bcard.on{border-color:var(--gold);background:#3a2b19}
.bcard.lock{opacity:.5}
.info{align-self:center;font-size:13px;color:var(--parch-2);padding:0 8px;white-space:nowrap}
#joy{position:absolute;left:calc(max(14px,env(safe-area-inset-left,0px)) + 6px);bottom:calc(var(--dockH) + 22px);width:124px;height:124px;border-radius:50%;background:radial-gradient(rgba(40,30,20,.35),rgba(20,15,10,.55));border:2px solid rgba(227,176,75,.55);touch-action:none}
#joy-knob{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#f3d38a,#a87a26);box-shadow:0 2px 8px rgba(0,0,0,.6)}
#acts{position:absolute;right:calc(max(14px,env(safe-area-inset-right,0px)) + 6px);bottom:calc(var(--dockH) + 22px);display:flex;align-items:flex-end;gap:12px;flex-direction:row-reverse}
#acts button{border-radius:50%;display:grid;place-items:center;border:2px solid #f3cd78;color:#1f150a;box-shadow:0 3px 10px rgba(0,0,0,.6);padding:0;position:relative;overflow:hidden}
#b-attack{width:78px;height:78px;background:radial-gradient(circle at 40% 35%,#f0c869,#9c6e22)}
#b-attack svg{width:34px;height:34px}
#b-cleave{width:56px;height:56px;background:radial-gradient(circle at 40% 35%,#e98a6e,#8a2e22);color:#fff3e0!important}
#b-cleave svg{width:26px;height:26px}
#b-cleave i{position:absolute;inset:0;background:conic-gradient(rgba(0,0,0,.65) var(--p,0%),transparent 0)}
#herobar{position:absolute;bottom:calc(var(--dockH) + 24px);left:50%;transform:translateX(-50%);width:min(240px,46vw);display:flex;flex-direction:column;align-items:center;gap:3px;pointer-events:none}
#herobar .hb{width:100%;height:9px;border-radius:5px;background:rgba(0,0,0,.6);border:1px solid #6e5536;overflow:hidden}
#herobar .hb i{display:block;height:100%;background:linear-gradient(#9fdc6c,#4f9a2e);width:100%}
#herobar span{font-size:11.5px;color:var(--parch-2);text-shadow:0 1px 2px #000}
#confirm{position:absolute;bottom:calc(var(--dockH) + 14px);left:50%;transform:translateX(-50%);display:flex;gap:8px;background:var(--panel);border:1px solid var(--gold-deep);border-radius:12px;padding:7px;box-shadow:0 4px 14px rgba(0,0,0,.55)}
#confirm .btn{padding:9px 14px}
#tip{position:absolute;pointer-events:none;background:var(--panel);border:1px solid var(--edge);border-radius:6px;padding:4px 9px;font-size:12.5px;white-space:nowrap;transform:translate(-50%,-140%)}
#tip.bad{border-color:var(--blood);color:#ffcfc6}
#raidbar{position:absolute;top:calc(var(--topH) + 44px);left:50%;transform:translateX(-50%);background:rgba(120,28,20,.92);border:1px solid #ff8f7c;border-radius:999px;padding:4px 14px;font-weight:700;font-size:13px;white-space:nowrap;animation:pulse 1.2s infinite alternate}
@keyframes pulse{from{box-shadow:0 0 0 rgba(255,80,60,.0)}to{box-shadow:0 0 16px rgba(255,80,60,.7)}}
.screen{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:calc(env(safe-area-inset-top,0px) + 12px) max(16px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 12px) max(16px,env(safe-area-inset-left,0px))}
#scr-title{background:radial-gradient(ellipse at center,rgba(10,8,5,.15),rgba(10,8,5,.72) 75%)}
.title-card{text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;max-width:560px}
.title-card canvas{width:92px;height:130px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.6));animation:sway 5s ease-in-out infinite alternate}
@keyframes sway{from{transform:rotate(-2deg)}to{transform:rotate(2deg)}}
.title-card h1{font-family:var(--display);font-weight:900;font-size:clamp(46px,11vw,88px);line-height:.95;margin:4px 0 0;color:#f6d98f;text-shadow:0 2px 0 #7a5418,0 4px 0 #4a3210,0 10px 24px rgba(0,0,0,.7);letter-spacing:.01em}
.title-card .tag{font-size:clamp(15px,3.8vw,19px);margin:0;color:var(--parch);text-shadow:0 1px 4px #000;text-wrap:balance}
.tbtns{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:10px}
.title-card .foot{font-size:13px;color:var(--parch-2);margin-top:8px;text-shadow:0 1px 3px #000}
.linkb{background:none;border:0;color:var(--gold)!important;text-decoration:underline;padding:0}
.sheet{background:linear-gradient(#f5ead0,#e6d4a9);color:var(--ink);border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.6),inset 0 0 0 1px #c4a46a,inset 0 0 40px rgba(140,100,40,.18);max-height:100%;overflow-y:auto;touch-action:pan-y;-webkit-overflow-scrolling:touch;width:min(940px,100%);padding:18px 22px 20px}
.sheet h2{font-family:var(--display);font-size:clamp(24px,5vw,32px);margin:0 0 10px;color:#3a2610;text-wrap:balance}
.sheet h3{font-family:var(--display);font-size:18px;margin:14px 0 4px;color:#4a3212}
.sheet p,.sheet li{line-height:1.55;font-size:14.5px}
.sheet ul{padding-inline-start:20px;margin:4px 0}
.sheet kbd{background:#fff7e2;border:1px solid #b89c66;border-bottom-width:2px;border-radius:4px;padding:0 5px;font:600 12px var(--body)}
.sheet .btn{color:var(--parch)}
.sheet .btn.primary{color:#1f150a}
.cgrid{display:grid;grid-template-columns:minmax(0,250px) minmax(0,1fr);gap:22px;align-items:start}
.cprev{display:flex;flex-direction:column;align-items:center;gap:12px;position:sticky;top:0}
.cprev #cv-banner{width:170px;height:240px;filter:drop-shadow(0 6px 8px rgba(60,40,10,.45))}
.cprev #cv-flag{width:180px;height:120px;border-radius:2px;box-shadow:0 3px 8px rgba(60,40,10,.4)}
.cform{display:flex;flex-direction:column;gap:12px;min-width:0}
.cform label{display:flex;flex-direction:column;gap:4px;font-weight:700;font-size:13.5px;color:#4a3212}
.cform input{font:600 16px var(--body);padding:9px 11px;border-radius:7px;border:1px solid #b89c66;background:#fffaf0;color:var(--ink);direction:rtl}
.fld > span{display:block;font-weight:700;font-size:13.5px;color:#4a3212;margin-bottom:5px}
.sw{display:flex;flex-wrap:wrap;gap:6px}
.sw button{width:32px;height:32px;border-radius:50%;border:2px solid rgba(0,0,0,.25);padding:0;box-shadow:inset 0 -3px 5px rgba(0,0,0,.2)}
.sw button.on{border:3px solid #2e2114;box-shadow:0 0 0 2px #f5ead0,0 0 0 4px #a87a26}
.opts{display:flex;flex-wrap:wrap;gap:6px}
.opts button{padding:3px;border-radius:7px;border:2px solid transparent;background:rgba(255,255,255,.35);display:flex;flex-direction:column;align-items:center;gap:1px;font-size:10.5px;color:#4a3212!important;font-weight:600;width:56px}
.opts button canvas{width:40px;height:54px}
.opts button.on{border-color:#a87a26;background:#fff7e2}
.cact{display:flex;justify-content:space-between;gap:10px;margin-top:16px;flex-wrap:wrap}
.menu-list{display:flex;flex-direction:column;gap:8px;max-width:420px;margin:0 auto}
.menu-list .btn{text-align:right;display:flex;justify-content:space-between;align-items:center}
.menu-list .btn small{opacity:.75;font-weight:400}
.mhead{display:flex;justify-content:space-between;align-items:center;gap:10px}
.xbtn{background:none;border:0;font-size:26px;line-height:1;color:#5a3f1c!important;padding:4px 8px}
.help-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:4px 26px}
@media (max-width:640px){
  .cgrid{grid-template-columns:minmax(0,1fr)}
  .cprev{position:static;flex-direction:row;justify-content:center;flex-wrap:wrap}
  .cprev #cv-banner{width:110px;height:155px}
  .cprev #cv-flag{width:130px;height:87px}
  .realm .sub{display:none}
  .realm .nm{font-size:15px;max-width:26vw}
  .chip{font-size:13px;padding:2px 8px}
  #mmwrap{width:104px;height:104px}
  #quest{font-size:12px;max-width:52vw}
  .sheet{padding:14px 15px 16px}
  #herobar{bottom:calc(var(--dockH) + 160px)}
}
@media (max-width:480px){.realm > div{display:none}}
@media (prefers-reduced-motion:reduce){.title-card canvas,#raidbar{animation:none}.toast{animation:none}}
`;

const IC = {
  cube: 'M12 2.8l8.5 4.7v9L12 21.2l-8.5-4.7v-9z M12 12.2l8.5-4.7 M12 12.2v9 M12 12.2L3.5 7.5',
  pick: 'M3.5 8.5C8 4 15 3.5 20.5 7 M12 5.6L6 20.5 M14.3 6.2l-1.1 2.6',
  brush: 'M14.5 3.5l6 6-7.5 7.5-6-6z M7 11l-3.5 3.5c-1 1-1 3 0 4l2.5-1 1 2.5c1 1 3 1 4 0L13 16.5',
  wall: 'M2.5 20.5V9.5h3v2.5h3V9.5h3v2.5h3V9.5h3v2.5h3V9.5h1.5v11z M2.5 15h19',
  floor: 'M3 9l9-5 9 5-9 5z M3 9v5l9 5 9-5V9 M7.5 6.5l9 5 M16.5 6.5l-9 5',
  pillar: 'M7 21h10 M8 21V6 M16 21V6 M6 6h12 M7 3h10v3H7z M12 6v15',
  tower: 'M7 21V9H5V3.5h3v2h2v-2h4v2h2v-2h3V9h-2v12z M10 21v-4a2 2 0 014 0v4 M11 11h2',
  keep: 'M2.5 21V10H5V7h2v3h2.5V4.5h5V10H17V7h2v3h2.5v11z M10 21v-4.5a2 2 0 014 0V21',
  gate: 'M3 21V5h4v2h2V5h6v2h2V5h4v16 M7.5 21v-7a4.5 4.5 0 019 0v7 M10 13v8 M14 13v8 M7.5 16.5h9',
  stairs: 'M3 21h18 M3 21v-4h4.5v-4.5H12V8h4.5V3.5H21V21',
  flag: 'M5 21.5V2.5 M5 3.5h13l-3 4.5 3 4.5H5',
  house: 'M3 11.5L12 4l9 7.5 M5.5 9.5V20.5h13V9.5 M10 20.5v-6h4v6',
  rotate: 'M20 12a8 8 0 11-2.6-5.9 M20.5 3.5v5h-5',
  undo: 'M9 5L4 10l5 5 M4 10h10a6 6 0 010 12h-3',
  sword: 'M14.5 3.5h6v6L9 21l-2-2 M5 13l6 6 M3.5 17.5l3 3',
  bow: 'M6 3c8 3 12 9 9 17 M6 3l9 17 M3 12h14 M14 9l3 3-3 3',
  spear: 'M19 5L5 19 M19 5l-1.5 5-3.5-3.5z M8 14l2 2',
  knight: 'M7 21h10 M8 21c0-4 1-6 3-8L7 11l2-6 4-2 5 4 1 5-2 2-2-1 1 8',
  follow: 'M12 4v4 M5 20l7-7 7 7 M9 11h6',
  charge: 'M4 12h14 M13 6l6 6-6 6 M4 7l5 5-5 5',
  hold: 'M5 4v17 M5 4h11l-2 3.5 2 3.5H5 M10 21h-9',
  home: 'M3 11.5L12 4l9 7.5 M5.5 9.5V20.5h13V9.5',
  travel: 'M12 2.5v4 M12 17.5v4 M2.5 12h4 M17.5 12h4 M12 8a4 4 0 110 8 4 4 0 010-8z',
  menu: 'M4 6.5h16 M4 12h16 M4 17.5h16',
  full: 'M3.5 9V3.5H9 M15 3.5h5.5V9 M20.5 15v5.5H15 M9 20.5H3.5V15',
  sound: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z M15.5 9a4 4 0 010 6 M18 6.5a8 8 0 010 11',
  coin: 'M12 3.5a8.5 8.5 0 110 17 8.5 8.5 0 010-17z M12 7.5v9 M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z',
  land: 'M5 21V3.5 M5 4.5h11l-2.5 4 2.5 4H5',
  build: 'M3 21h18 M5 21V11l7-6 7 6v10 M9 21v-5h6v5',
  crown: 'M3.5 18.5L2.5 7l5.5 5 4-7 4 7 5.5-5-1 11.5z M3.5 21h17',
  cleave: 'M12 2.5l2.2 6.5 6.8.2-5.4 4.1 2 6.6-5.6-3.9-5.6 3.9 2-6.6-5.4-4.1 6.8-.2z',
};
function icon(n) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${IC[n]}"/></svg>`; }

const HTML = `
<canvas id="cs-canvas" tabindex="0" aria-label="עולם המשחק"></canvas>
<div id="hud" class="hidden-ui">
  <div id="topbar">
    <div class="realm"><canvas id="hud-flag" width="54" height="76"></canvas><div style="min-width:0"><div class="nm" id="hud-name"></div><div class="sub" id="hud-ruler"></div></div></div>
    <div class="stats">
      <div class="chip gold" title="זהב">${icon('coin')}<b id="st-gold">0</b><small id="st-inc"></small></div>
      <div class="chip" title="צבא">${icon('shield')}<b id="st-army">0/5</b></div>
      <div class="chip" title="שטחים שנכבשו">${icon('land')}<b id="st-land">0</b></div>
    </div>
    <div class="sys">
      <button class="sq" id="b-sound" aria-label="צליל">${icon('sound')}</button>
      <button class="sq" id="b-full" aria-label="מסך מלא">${icon('full')}</button>
      <button class="sq" id="b-menu" aria-label="תפריט">${icon('menu')}</button>
    </div>
  </div>
  <div id="quest"></div>
  <div id="mmwrap"><canvas id="minimap" width="256" height="256" aria-label="מפה"></canvas><span class="n">צ</span></div>
  <div id="raidbar" class="hidden-ui"></div>
  <div id="toasts"></div>
  <div id="joy" class="hidden-ui"><div id="joy-knob"></div></div>
  <div id="acts" class="hidden-ui"><button id="b-attack" aria-label="תקיפה">${icon('sword')}</button><button id="b-cleave" aria-label="מכת סערה">${icon('cleave')}<i></i></button></div>
  <div id="herobar" class="hidden-ui"><div class="hb"><i id="hero-hp"></i></div><span id="hero-txt"></span></div>
  <div id="confirm" class="hidden-ui"><button class="btn primary" id="cf-ok">בנה</button><button class="btn" id="cf-rot" aria-label="סיבוב">${icon('rotate')}</button><button class="btn" id="cf-no">ביטול</button></div>
  <div id="tip" class="hidden-ui"></div>
  <div id="dock">
    <div id="modes"><button data-mode="build">${icon('build')}בנייה</button><button data-mode="hero">${icon('crown')}גיבור וצבא</button></div>
    <div id="pn-build"><div class="row" id="row-tools"></div><div class="row" id="row-sub"></div></div>
    <div id="pn-hero" class="hidden-ui"><div class="row" id="row-army"></div><div class="row" id="row-orders"></div></div>
  </div>
</div>
<div id="scr-title" class="screen">
  <div class="title-card">
    <canvas id="cv-crest" width="180" height="254"></canvas>
    <h1>כתר ואבן</h1>
    <p class="tag">בנו טירות מכל חומר, הקימו צבא, כבשו מבצרים והרחיבו את הממלכה שלכם</p>
    <div class="tbtns"><button class="btn primary big" id="b-new">ממלכה חדשה</button><button class="btn big hidden-ui" id="b-cont">המשך משחק</button></div>
    <p class="foot">חינמי בדפדפן · מחשב, אייפון ואנדרואיד · <button class="linkb" id="b-tfull">מסך מלא</button></p>
  </div>
</div>
<div id="scr-create" class="screen hidden-ui">
  <div class="sheet">
    <h2 id="cr-title">הקמת ממלכה</h2>
    <div class="cgrid">
      <div class="cprev"><canvas id="cv-banner" width="240" height="340"></canvas><canvas id="cv-flag" width="270" height="180"></canvas><button class="btn" id="b-rand">הגרלת דגל</button></div>
      <div class="cform">
        <label>שם הממלכה<input id="in-name" maxlength="26" autocomplete="off"></label>
        <label>שם השליט או השליטה<input id="in-ruler" maxlength="26" autocomplete="off"></label>
        <div class="fld"><span>צבע השדה</span><div class="sw" id="sw-c1"></div></div>
        <div class="fld"><span>חלוקה ודוגמה</span><div class="opts" id="op-pat"></div></div>
        <div class="fld"><span>צבע הדוגמה</span><div class="sw" id="sw-c2"></div></div>
        <div class="fld"><span>סמל</span><div class="opts" id="op-emb"></div></div>
        <div class="fld"><span>צבע הסמל</span><div class="sw" id="sw-ec"></div></div>
      </div>
    </div>
    <div class="cact"><button class="btn" id="b-cback">חזרה</button><button class="btn primary big" id="b-found">הקימו את הממלכה</button></div>
  </div>
</div>
<div id="modal" class="screen hidden-ui" style="background:rgba(8,6,4,.55)"><div class="sheet" id="modal-body" style="width:min(720px,100%)"></div></div>
`;

const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&family=Frank+Ruhl+Libre:wght@500;700;900&display=swap';
document.head.appendChild(fontLink);
const styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl);
document.documentElement.lang = 'he'; document.documentElement.dir = 'rtl';
const root = document.createElement('div'); root.id = 'cs-root'; root.innerHTML = HTML; document.body.appendChild(root);
const $ = id => document.getElementById(id);
const show = (el, v) => (typeof el === 'string' ? $(el) : el).classList.toggle('hidden-ui', !v);

// ============================================================ חומרים
const MATS = [
  { id: 'stone', name: 'אבן גזית', cost: 3, tex: 'brick', c1: '#928e87', c2: '#7a766f', mortar: '#57534d' },
  { id: 'cobble', name: 'אבן שדה', cost: 2, tex: 'cobble', c1: '#83807a', c2: '#69665f', mortar: '#46443f' },
  { id: 'dark', name: 'בזלת', cost: 4, tex: 'brick', c1: '#4d4d54', c2: '#3d3d44', mortar: '#25252a' },
  { id: 'sand', name: 'אבן חול', cost: 3, tex: 'brick', c1: '#d8c08b', c2: '#c6aa72', mortar: '#9a8255', big: true },
  { id: 'marble', name: 'שיש', cost: 8, tex: 'marble', c1: '#ece8e0', c2: '#cbc5bb' },
  { id: 'brick', name: 'לבנים', cost: 3, tex: 'brick', c1: '#a04c33', c2: '#86392a', mortar: '#cbbba2', small: true },
  { id: 'moss', name: 'אבן טחובה', cost: 2, tex: 'cobble', c1: '#6f7c5b', c2: '#586645', mortar: '#3e4734' },
  { id: 'wood', name: 'קורות עץ', cost: 1, tex: 'planks', c1: '#9c6c40', c2: '#7f5731' },
  { id: 'log', name: 'בולי עץ', cost: 1, tex: 'log', c1: '#71502e', c2: '#53381c' },
  { id: 'timber', name: 'עץ וטיח', cost: 2, tex: 'timber', c1: '#ebdfc4', c2: '#4b3321' },
  { id: 'thatch', name: 'קש', cost: 1, tex: 'thatch', c1: '#c9a957', c2: '#a68a3e' },
  { id: 'roof', name: 'רעפים', cost: 2, tex: 'tiles', c1: '#a8472f', c2: '#823423' },
  { id: 'slate', name: 'צפחה', cost: 3, tex: 'tiles', c1: '#525b69', c2: '#3d4552' },
  { id: 'iron', name: 'ברזל', cost: 6, tex: 'metal', c1: '#6d7177', c2: '#4e5258' },
  { id: 'gate', name: 'סורג שער', cost: 5, tex: 'gate', c1: '#5a3d22', c2: '#2c2c2e', passable: true },
  { id: 'glass', name: 'ויטראז׳', cost: 6, tex: 'glass', c1: '#2c5d9e', c2: '#9e2c3c', transparent: true },
  { id: 'gold', name: 'זהב', cost: 25, tex: 'gold', c1: '#e4b53e', c2: '#b8862a' },
  { id: 'hay', name: 'חציר', cost: 1, tex: 'thatch', c1: '#dcc46c', c2: '#bba24e' },
  { id: 'dirt', name: 'אדמה', cost: 1, tex: 'noise', c1: '#7c5c3b', c2: '#654a31' },
  { id: 'grass', name: 'דשא', cost: 1, tex: 'noise', c1: '#61903b', c2: '#4f7c2f' },
];
const MI = {}; MATS.forEach((m, i) => (MI[m.id] = i));

function paintMat(m) {
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'); const r = mulberry(hashStr(m.id));
  const speck = (n, a, sz = 1) => { for (let i = 0; i < n; i++) { g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.7})`; g.fillRect((r() * S) | 0, (r() * S) | 0, sz, sz); } };
  switch (m.tex) {
    case 'brick': {
      g.fillStyle = m.mortar; g.fillRect(0, 0, S, S);
      const rows = m.small ? 8 : m.big ? 2 : 4, per = m.small ? 4 : 2, h = S / rows, w = S / per;
      for (let i = 0; i < rows; i++) {
        const off = (i % 2) * w / 2;
        for (let j = -1; j <= per; j++) {
          const x = j * w + off, y = i * h;
          g.fillStyle = shade(r() < 0.5 ? m.c1 : m.c2, (r() - 0.5) * 0.2); g.fillRect(x + 1, y + 1, w - 2, h - 2);
          g.fillStyle = 'rgba(255,255,255,.13)'; g.fillRect(x + 1, y + 1, w - 2, 1);
          g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x + 1, y + h - 2, w - 2, 1);
        }
      }
      speck(420, 0.12); break;
    }
    case 'cobble': {
      g.fillStyle = m.mortar; g.fillRect(0, 0, S, S);
      for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
        const cx = gx * 16 + 8 + (r() - 0.5) * 4, cy = gy * 16 + 8 + (r() - 0.5) * 4;
        g.fillStyle = shade(r() < 0.5 ? m.c1 : m.c2, (r() - 0.5) * 0.25);
        g.beginPath(); g.ellipse(cx, cy, 6.5 + r() * 1.5, 5.5 + r() * 1.8, r() * 3, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.ellipse(cx - 1.5, cy - 2, 3.5, 2, 0, 0, Math.PI * 2); g.fill();
      }
      speck(300, 0.12); break;
    }
    case 'marble': {
      g.fillStyle = m.c1; g.fillRect(0, 0, S, S); speck(300, 0.05);
      g.lineWidth = 1;
      for (let i = 0; i < 5; i++) { g.strokeStyle = `rgba(130,124,112,${0.25 + r() * 0.3})`; g.beginPath(); g.moveTo(r() * S, 0); g.bezierCurveTo(r() * S, r() * S, r() * S, r() * S, r() * S, S); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 31, S, 1); g.fillRect(31, 0, 1, S); break;
    }
    case 'planks': {
      for (let i = 0; i < 4; i++) {
        const y = i * 16; g.fillStyle = shade(r() < 0.5 ? m.c1 : m.c2, (r() - 0.5) * 0.18); g.fillRect(0, y, S, 16);
        for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(0,0,0,.13)'; g.fillRect((r() * 40) | 0, y + 2 + ((r() * 12) | 0), 10 + ((r() * 30) | 0), 1); }
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, y + 15, S, 1);
        const jx = (r() * 60) | 0; g.fillRect(jx, y, 1, 15);
        g.fillStyle = '#2a2018'; g.fillRect(jx + 3, y + 3, 2, 2); g.fillRect(jx + 3, y + 10, 2, 2);
      }
      break;
    }
    case 'log': {
      for (let i = 0; i < 4; i++) {
        const x = i * 16, gr = g.createLinearGradient(x, 0, x + 16, 0);
        gr.addColorStop(0, shade(m.c2, -0.35)); gr.addColorStop(0.5, shade(m.c1, (r() - 0.5) * 0.2)); gr.addColorStop(1, shade(m.c2, -0.35));
        g.fillStyle = gr; g.fillRect(x, 0, 16, S);
        for (let k = 0; k < 7; k++) { g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x + 2 + ((r() * 12) | 0), (r() * S) | 0, 1, 6 + ((r() * 14) | 0)); }
      }
      break;
    }
    case 'timber': {
      g.fillStyle = m.c1; g.fillRect(0, 0, S, S); speck(400, 0.07);
      g.fillStyle = m.c2; g.fillRect(0, 0, S, 6); g.fillRect(0, S - 6, S, 6); g.fillRect(0, 0, 6, S); g.fillRect(S - 6, 0, 6, S);
      g.strokeStyle = m.c2; g.lineWidth = 6; g.beginPath(); g.moveTo(6, S - 6); g.lineTo(S - 6, 6); g.stroke();
      break;
    }
    case 'thatch': {
      g.fillStyle = m.c1; g.fillRect(0, 0, S, S);
      g.lineWidth = 1;
      for (let i = 0; i < 280; i++) { const x = r() * S, y = r() * S, l = 6 + r() * 9; g.strokeStyle = r() < 0.5 ? m.c2 : shade(m.c1, 0.18); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + l); g.stroke(); }
      g.fillStyle = 'rgba(60,40,10,.28)'; for (let y = 15; y < S; y += 16) g.fillRect(0, y, S, 2);
      break;
    }
    case 'tiles': {
      g.fillStyle = shade(m.c2, -0.35); g.fillRect(0, 0, S, S);
      for (let i = 0; i < 4; i++) for (let j = -1; j < 5; j++) {
        const x = j * 16 + (i % 2) * 8, y = i * 16;
        g.fillStyle = shade(r() < 0.5 ? m.c1 : m.c2, (r() - 0.5) * 0.2);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 16, y); g.lineTo(x + 16, y + 9); g.quadraticCurveTo(x + 8, y + 19, x, y + 9); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 2, y + 1, 12, 2);
      }
      break;
    }
    case 'metal': {
      const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, shade(m.c1, 0.1)); gr.addColorStop(1, m.c2); g.fillStyle = gr; g.fillRect(0, 0, S, S);
      speck(300, 0.08);
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(31, 0, 2, S); g.fillRect(0, 31, S, 2);
      for (const [x, y] of [[5, 5], [26, 5], [37, 5], [58, 5], [5, 26], [26, 26], [37, 26], [58, 26], [5, 37], [26, 37], [37, 37], [58, 37], [5, 58], [26, 58], [37, 58], [58, 58]]) { g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(x + 0.6, y + 0.8, 2, 0, 7); g.fill(); g.fillStyle = shade(m.c1, 0.35); g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); }
      break;
    }
    case 'gate': {
      g.clearRect(0, 0, S, S); g.fillStyle = m.c2;
      for (const x of [3, 19, 35, 51]) { g.fillRect(x, 0, 7, S); }
      for (const y of [6, 29, 52]) g.fillRect(0, y, S, 6);
      g.fillStyle = 'rgba(255,255,255,.18)'; for (const x of [3, 19, 35, 51]) g.fillRect(x + 1, 0, 1, S);
      break;
    }
    case 'glass': {
      g.fillStyle = '#1d1a18'; g.fillRect(0, 0, S, S);
      const pal = ['#2c5d9e', '#9e2c3c', '#d6a93a', '#2f7d4c', '#6a3d8f', '#3a7fb8'];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = pal[(r() * pal.length) | 0]; g.fillRect(i * 16 + 2, j * 16 + 2, 12, 12); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(i * 16 + 3, j * 16 + 3, 4, 2); }
      break;
    }
    case 'gold': {
      g.fillStyle = m.c1; g.fillRect(0, 0, S, S);
      const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, 'rgba(255,255,230,.45)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(120,70,0,.3)'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
      speck(200, 0.1); break;
    }
    default: {
      g.fillStyle = m.c1; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 700; i++) { g.fillStyle = r() < 0.55 ? m.c2 : shade(m.c1, 0.14); g.fillRect((r() * S) | 0, (r() * S) | 0, 2, 2); }
    }
  }
  if (m.tex !== 'gate') {
    g.strokeStyle = 'rgba(0,0,0,.32)'; g.lineWidth = 2; g.strokeRect(0, 0, S, S);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(1, 1, S - 2, 1); g.fillRect(1, 1, 1, S - 2);
  }
  return cv;
}

// ============================================================ הרלדיקה: דגלים וסמלים
const TINCTURES = [
  ['#b3232b', 'אדום'], ['#1f4f9e', 'כחול'], ['#1f7a3d', 'ירוק'], ['#6b2d7c', 'סגול'], ['#1d1b1b', 'שחור'], ['#e1b23b', 'זהב'],
  ['#efede6', 'כסף'], ['#c66c1e', 'כתום'], ['#6e1f22', 'ארגמן'], ['#6aa7d8', 'תכלת'], ['#8c2b4c', 'בורדו'], ['#6b4a2b', 'חום'],
];
const PATTERNS = [['plain', 'חלק'], ['fess', 'פס רוחב'], ['pale', 'פס אורך'], ['perpale', 'חצוי'], ['perfess', 'חלוק'], ['cross', 'צלב'], ['saltire', 'איקס'], ['chevron', 'שברון'], ['quarterly', 'רבעים'], ['bend', 'אלכסון'], ['paly', 'פסים'], ['chequy', 'משבצות'], ['bordure', 'מסגרת']];
const EMBLEMS = [['none', 'ללא'], ['crown', 'כתר'], ['star', 'כוכב'], ['sword', 'חרב'], ['swords', 'חרבות'], ['tower', 'מגדל'], ['eagle', 'נשר'], ['fleur', 'שושן'], ['moon', 'סהר'], ['sun', 'שמש'], ['tree', 'עץ'], ['key', 'מפתח'], ['cross', 'צלב'], ['skull', 'גולגולת']];
const ENEMY_BANNER = { c1: '#1b1717', c2: '#7d1414', pattern: 'saltire', emblem: 'skull', ec: '#e8e0cc' };

function drawEmblemShape(g, type) {
  const poly = pts => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); };
  const circ = (x, y, rr) => { g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill(); };
  const cut = fn => { g.save(); g.globalCompositeOperation = 'destination-out'; fn(); g.restore(); };
  switch (type) {
    case 'star': { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 19 : 47; p.push([Math.cos(a) * rr, Math.sin(a) * rr + 3]); } poly(p); break; }
    case 'crown': poly([[-40, 26], [-45, -20], [-22, 4], [0, -32], [22, 4], [45, -20], [40, 26]]); g.fillRect(-42, 29, 84, 12); circ(-45, -25, 6); circ(0, -37, 6); circ(45, -25, 6); cut(() => { circ(-20, 35, 3.5); circ(0, 35, 3.5); circ(20, 35, 3.5); }); break;
    case 'sword': poly([[0, -50], [7, -40], [7, 16], [-7, 16], [-7, -40]]); g.fillRect(-25, 16, 50, 8); g.fillRect(-4, 24, 8, 17); circ(0, 45, 6.5); break;
    case 'swords': for (const a of [0.68, -0.68]) { g.save(); g.rotate(a); g.scale(0.9, 0.9); drawEmblemShape(g, 'sword'); g.restore(); } break;
    case 'tower':
      poly([[-28, 46], [-25, -18], [-34, -18], [-34, -44], [-22, -44], [-22, -34], [-8, -34], [-8, -44], [8, -44], [8, -34], [22, -34], [22, -44], [34, -44], [34, -18], [25, -18], [28, 46]]);
      cut(() => { g.beginPath(); g.moveTo(-10, 46); g.lineTo(-10, 26); g.arc(0, 26, 10, Math.PI, 0); g.lineTo(10, 46); g.fill(); g.fillRect(-4, -8, 8, 16); });
      break;
    case 'moon': circ(0, 0, 42); cut(() => circ(17, -9, 36)); break;
    case 'cross': for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2); poly([[-8, -8], [-21, -46], [21, -46], [8, -8]]); g.restore(); } g.fillRect(-9, -9, 18, 18); break;
    case 'fleur':
      g.beginPath(); g.moveTo(0, -49); g.bezierCurveTo(15, -30, 15, -9, 5, 7); g.lineTo(-5, 7); g.bezierCurveTo(-15, -9, -15, -30, 0, -49); g.fill();
      for (const sx of [1, -1]) { g.save(); g.scale(sx, 1); g.beginPath(); g.moveTo(5, 5); g.bezierCurveTo(19, -19, 47, -15, 41, 7); g.bezierCurveTo(37, 19, 22, 15, 27, 4); g.bezierCurveTo(17, 11, 12, 15, 6, 15); g.closePath(); g.fill(); g.restore(); }
      g.fillRect(-20, 11, 40, 8);
      poly([[-5, 19], [5, 19], [12, 42], [0, 33], [-12, 42]]);
      break;
    case 'sun': circ(0, 0, 22); for (let i = 0; i < 12; i++) { g.save(); g.rotate(i * Math.PI / 6); poly([[-6, -27], [0, -48], [6, -27]]); g.restore(); } break;
    case 'tree': g.fillRect(-6, 8, 12, 38); g.fillRect(-20, 42, 40, 5); circ(0, -16, 26); circ(-21, -1, 18); circ(21, -1, 18); circ(0, 2, 18); break;
    case 'key': g.lineWidth = 9; g.strokeStyle = g.fillStyle; g.beginPath(); g.arc(0, -30, 15, 0, Math.PI * 2); g.stroke(); g.fillRect(-4, -15, 8, 61); g.fillRect(4, 28, 15, 7); g.fillRect(4, 39, 11, 7); break;
    case 'eagle': {
      const R = [[0, -16], [10, -14], [22, -28], [47, -40], [42, -27], [50, -22], [40, -13], [48, -6], [36, 0], [42, 8], [15, 5], [10, 22], [18, 44], [6, 36], [0, 44]];
      const L = R.slice(1, -1).reverse().map(([x, y]) => [-x, y]); poly(R.concat(L));
      circ(0, -27, 10); poly([[7, -31], [17, -26], [7, -22]]); cut(() => circ(3, -29, 2.4)); break;
    }
    case 'skull': circ(0, -9, 31); g.fillRect(-17, 10, 34, 20); cut(() => { circ(-12, -9, 8.5); circ(12, -9, 8.5); poly([[0, 2], [-5, 11], [5, 11]]); g.fillRect(-10, 21, 3, 9); g.fillRect(-1.5, 21, 3, 9); g.fillRect(7, 21, 3, 9); }); break;
  }
}
const emblemCache = new Map();
function emblemCanvas(type, color, size) {
  const k = type + color + size; if (emblemCache.has(k)) return emblemCache.get(k);
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
  g.scale(size / 100, size / 100); g.translate(50, 50); g.fillStyle = color; drawEmblemShape(g, type);
  emblemCache.set(k, cv); return cv;
}
function drawBanner(g, w, h, b, shape) {
  g.clearRect(0, 0, w, h); g.save();
  const path = new Path2D();
  if (shape === 'banner') { path.moveTo(0, 0); path.lineTo(w, 0); path.lineTo(w, h * 0.8); path.lineTo(w / 2, h); path.lineTo(0, h * 0.8); path.closePath(); } else path.rect(0, 0, w, h);
  g.clip(path);
  g.fillStyle = b.c1; g.fillRect(0, 0, w, h);
  const cy = shape === 'banner' ? h * 0.42 : h / 2, s = Math.min(w, h);
  g.fillStyle = b.c2; g.strokeStyle = b.c2;
  switch (b.pattern) {
    case 'fess': g.fillRect(0, cy - h * 0.13, w, h * 0.26); break;
    case 'pale': g.fillRect(w * 0.36, 0, w * 0.28, h); break;
    case 'perpale': g.fillRect(w / 2, 0, w / 2, h); break;
    case 'perfess': g.fillRect(0, cy, w, h); break;
    case 'cross': g.fillRect(w / 2 - s * 0.09, 0, s * 0.18, h); g.fillRect(0, cy - s * 0.09, w, s * 0.18); break;
    case 'saltire': g.lineWidth = s * 0.17; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); break;
    case 'chevron': g.beginPath(); g.moveTo(0, cy + h * 0.2); g.lineTo(w / 2, cy - h * 0.12); g.lineTo(w, cy + h * 0.2); g.lineTo(w, cy + h * 0.4); g.lineTo(w / 2, cy + h * 0.08); g.lineTo(0, cy + h * 0.4); g.closePath(); g.fill(); break;
    case 'quarterly': g.fillRect(w / 2, 0, w / 2, cy); g.fillRect(0, cy, w / 2, h); break;
    case 'bend': g.lineWidth = s * 0.22; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.stroke(); break;
    case 'paly': for (let i = 1; i < 6; i += 2) g.fillRect(i * w / 6, 0, w / 6, h); break;
    case 'chequy': { const n = 6, cw = w / n, ch = cw; for (let i = 0; i < n; i++) for (let j = 0; j * ch < h; j++) if ((i + j) % 2) g.fillRect(i * cw, j * ch, cw, ch); break; }
    case 'bordure': g.lineWidth = s * 0.2; g.stroke(path); break;
  }
  if (b.emblem && b.emblem !== 'none') {
    const es = s * (shape === 'banner' ? 0.66 : 0.62);
    const sh = emblemCanvas(b.emblem, 'rgba(0,0,0,.35)', 256), ec = emblemCanvas(b.emblem, b.ec, 256);
    g.drawImage(sh, w / 2 - es / 2 + s * 0.012, cy - es / 2 + s * 0.016, es, es);
    g.drawImage(ec, w / 2 - es / 2, cy - es / 2, es, es);
  }
  const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,.2)'); gr.addColorStop(0.45, 'rgba(255,255,255,.07)'); gr.addColorStop(1, 'rgba(0,0,0,.2)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.restore();
  if (shape === 'banner') { g.save(); g.lineWidth = w * 0.05; g.strokeStyle = '#c99a3a'; g.stroke(path); g.restore(); }
}
function randomBanner(r = Math.random) {
  const pick = a => a[(r() * a.length) | 0];
  const c1 = pick(TINCTURES)[0]; let c2 = pick(TINCTURES)[0]; while (c2 === c1) c2 = pick(TINCTURES)[0];
  const metals = ['#e1b23b', '#efede6']; let ec = pick(metals); if (ec === c1) ec = metals[0] === c1 ? metals[1] : metals[0];
  return { c1, c2, pattern: pick(PATTERNS.slice(0, 12))[0], emblem: pick(EMBLEMS.slice(1, 13))[0], ec };
}

// ============================================================ מנוע תלת־ממד
const canvas = $('cs-canvas');
let quality = pref('quality') || (IS_TOUCH ? 'low' : 'high');
const renderer = new T.WebGLRenderer({ canvas, antialias: !IS_TOUCH, powerPreference: 'high-performance' });
renderer.localClippingEnabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene();
const FOG = new T.Color('#cfe1ea');
scene.fog = new T.Fog(FOG, 110, 300);
scene.background = FOG;
const camera = new T.PerspectiveCamera(50, 1, 0.3, 700);
const hemi = new T.HemisphereLight(0xe9f1ff, 0x6e5c3a, 0.78); scene.add(hemi);
scene.add(new T.AmbientLight(0xffffff, 0.12));
const sun = new T.DirectionalLight(0xfff0d2, 0.92);
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 260 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);

const sky = (() => {
  const geo = new T.SphereGeometry(500, 24, 14); const pos = geo.attributes.position; const col = [];
  const top = new T.Color('#4a82c0'), hor = new T.Color('#d3e5ee'), c = new T.Color();
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 500; c.copy(hor).lerp(top, clamp(y * 1.7, 0, 1)); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  const m = new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10; scene.add(m); return m;
})();

const world = new T.Group(); scene.add(world);
const clipPlane = new T.Plane(new T.Vector3(0, -1, 0), 1e6);
let shadowsOn = false;

function resize() {
  const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  measureUI();
}
function applyQuality() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.25));
  shadowsOn = quality === 'high';
  renderer.shadowMap.enabled = shadowsOn; sun.castShadow = shadowsOn;
  scene.traverse(o => { if (o.isMesh && o.userData.caster) o.castShadow = shadowsOn; if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => (m.needsUpdate = true)); });
  resize();
}

// shared geometry helpers
const BOXN = new T.BoxGeometry(1, 1, 1).toNonIndexed();
const CYLN = new T.CylinderGeometry(0.5, 0.5, 1, 8).toNonIndexed();
const CONEN = new T.ConeGeometry(0.5, 1, 8).toNonIndexed();
function mergeParts(parts) {
  const pos = [], nor = [], col = []; const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3(), nm = new T.Matrix3(), c = new T.Color();
  for (const p of parts) {
    const g = p.g || BOXN; e.set(p.r ? p.r[0] : 0, p.r ? p.r[1] : 0, p.r ? p.r[2] : 0); q.setFromEuler(e);
    m.compose(v.set(p.p[0], p.p[1], p.p[2]), q, sc.set(p.s[0], p.s[1], p.s[2])); nm.getNormalMatrix(m); c.set(p.c);
    const pa = g.attributes.position, na = g.attributes.normal;
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere(); geo.userData.shared = true; return geo;
}
const vcMat = new T.MeshLambertMaterial({ vertexColors: true });

// ============================================================ נתוני העולם
const H = new Uint8Array(WORLD * WORLD);
const WATER = new Uint8Array(WORLD * WORLD);
const blocks = new Map();
const matKeys = MATS.map(() => new Set());
const dirtyMats = new Set();
const owner = new Map();
let blockMeshes = [];
const blockGeo = new T.BoxGeometry(1, 1, 1); blockGeo.userData.shared = true;
const matTex = [], matSwatch = [], blockMats = [];
MATS.forEach((m, i) => {
  const cv = paintMat(m); matSwatch[i] = cv.toDataURL();
  const tex = new T.CanvasTexture(cv); tex.magFilter = T.NearestFilter; tex.anisotropy = 4; matTex[i] = tex;
  const opts = { map: tex, clippingPlanes: [clipPlane] };
  let mat;
  if (m.id === 'gold' || m.id === 'iron' || m.id === 'marble') mat = new T.MeshPhongMaterial(Object.assign(opts, { shininess: m.id === 'marble' ? 30 : 80, specular: m.id === 'gold' ? 0x886a2a : 0x444444 }));
  else mat = new T.MeshLambertMaterial(opts);
  if (m.transparent) { mat.transparent = true; mat.opacity = 0.82; }
  if (m.tex === 'gate') { mat.alphaTest = 0.5; mat.side = T.DoubleSide; }
  blockMats[i] = mat;
});
const key = (x, y, z) => (y * WORLD + z) * WORLD + x;
function unkey(k) { const x = k % WORLD, t = (k - x) / WORLD, z = t % WORLD, y = (t - z) / WORLD; return [x, y, z]; }
const inWorld = (x, y, z) => x >= 0 && z >= 0 && x < WORLD && z < WORLD && y >= 0 && y < MAXY;
const tH = (x, z) => H[z * WORLD + x];

function setBlock(x, y, z, m) {
  if (!inWorld(x, y, z)) return;
  const k = key(x, y, z), old = blocks.get(k);
  if (old !== undefined) { matKeys[old].delete(k); dirtyMats.add(old); }
  if (m == null || m < 0) blocks.delete(k); else { blocks.set(k, m); matKeys[m].add(k); dirtyMats.add(m); }
  mmDirtyCols.add(z * WORLD + x);
}
const _m4 = new T.Matrix4();
function flushBlocks() {
  for (const m of dirtyMats) {
    const set = matKeys[m]; let mesh = blockMeshes[m]; const need = set.size;
    if (!mesh || mesh.userData.cap < need) {
      const cap = Math.max(64, Math.ceil(need * 1.5));
      if (mesh) { world.remove(mesh); if (mesh.dispose) mesh.dispose(); }
      mesh = new T.InstancedMesh(blockGeo, blockMats[m], cap); mesh.userData.cap = cap; mesh.userData.caster = true;
      mesh.castShadow = shadowsOn; mesh.receiveShadow = true; mesh.frustumCulled = false; world.add(mesh); blockMeshes[m] = mesh;
    }
    let i = 0; for (const k of set) { const [x, y, z] = unkey(k); _m4.makeTranslation(x + 0.5, y + 0.5, z + 0.5); mesh.setMatrixAt(i++, _m4); }
    mesh.count = need; mesh.instanceMatrix.needsUpdate = true;
  }
  dirtyMats.clear();
}

// ============================================================ יצירת עולם
function genTerrain(seed) {
  for (let z = 0; z < WORLD; z++) for (let x = 0; x < WORLD; x++) {
    const e = fbm(x / 72, z / 72, seed, 5), m = fbm(x / 22 + 100, z / 22, seed + 5, 3);
    let h = (e - 0.38) * 25 + (m - 0.5) * 3;
    const rv = Math.abs(fbm(x / 95 + 50, z / 95 + 50, seed + 9, 3) - 0.5);
    if (rv < 0.016) h = Math.min(h, -1); else if (rv < 0.028) h = Math.min(h, 1.2);
    const d = Math.hypot(x - CX, z - CZ);
    if (d < 30) { const t = clamp((d - 19) / 11, 0, 1); h = lerp(2.4, h, t * t); }
    const edge = Math.min(x, z, WORLD - 1 - x, WORLD - 1 - z);
    if (edge < 10) h = Math.min(h, lerp(-3, h, edge / 10));
    let hi = Math.floor(h); const i = z * WORLD + x;
    if (hi <= 0) { H[i] = 0; WATER[i] = 1; } else { H[i] = Math.min(hi, 14); WATER[i] = 0; }
  }
}
function nearWater(x, z, r) { for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx >= WORLD || nz >= WORLD || WATER[nz * WORLD + nx]) return true; } return false; }
const tileCol = new Float32Array(WORLD * WORLD * 3);
function computeTileColors(seed) {
  const c = new T.Color(), a = new T.Color('#5a8d37'), b = new T.Color('#7ea748'), sand = new T.Color('#cdb985'), rock = new T.Color('#8a8981'), snow = new T.Color('#eef2f4'), wet = new T.Color('#8c8360'), dry = new T.Color('#9a9a52');
  for (let z = 0; z < WORLD; z++) for (let x = 0; x < WORLD; x++) {
    const i = z * WORLD + x, h = H[i]; const n = (hash2(x, z, 7) - 0.5) * 0.07;
    if (WATER[i]) c.copy(wet);
    else if (h <= 1 && nearWater(x, z, 1)) c.copy(sand);
    else if (h >= 11) c.copy(snow);
    else if (h >= 8) c.copy(rock).lerp(a, h === 8 ? 0.3 : 0);
    else { c.copy(a).lerp(b, clamp(fbm(x / 14, z / 14, seed + 3, 2) * 1.6 - 0.4, 0, 1)); if (fbm(x / 40 + 9, z / 40, seed + 11, 2) > 0.66) c.lerp(dry, 0.45); }
    tileCol[i * 3] = clamp(c.r + n, 0, 1); tileCol[i * 3 + 1] = clamp(c.g + n, 0, 1); tileCol[i * 3 + 2] = clamp(c.b + n * 0.6, 0, 1);
  }
}
function buildTerrain() {
  const CH = 64;
  for (let cz = 0; cz < WORLD; cz += CH) for (let cx = 0; cx < WORLD; cx += CH) {
    const pos = [], nor = [], col = [], idx = [];
    const quad = (p, n, r, g, b) => {
      const i = pos.length / 3; for (const q of p) pos.push(q[0], q[1], q[2]);
      for (let k = 0; k < 4; k++) { nor.push(n[0], n[1], n[2]); col.push(r, g, b); }
      const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2], vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
      const crx = uy * vz - uz * vy, cry = uz * vx - ux * vz, crz = ux * vy - uy * vx;
      if (crx * n[0] + cry * n[1] + crz * n[2] >= 0) idx.push(i, i + 1, i + 2, i, i + 2, i + 3); else idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
    };
    for (let z = cz; z < cz + CH; z++) for (let x = cx; x < cx + CH; x++) {
      const i = z * WORLD + x, h = H[i], r = tileCol[i * 3], g = tileCol[i * 3 + 1], b = tileCol[i * 3 + 2];
      quad([[x, h, z], [x, h, z + 1], [x + 1, h, z + 1], [x + 1, h, z]], [0, 1, 0], r, g, b);
      const grassy = g > r;
      const sr = grassy ? 0.46 : r * 0.78, sg = grassy ? 0.35 : g * 0.78, sb = grassy ? 0.23 : b * 0.78;
      const nb = (nx, nz) => (nx < 0 || nz < 0 || nx >= WORLD || nz >= WORLD ? -3 : H[nz * WORLD + nx]);
      let nh;
      if ((nh = nb(x + 1, z)) < h) quad([[x + 1, nh, z], [x + 1, h, z], [x + 1, h, z + 1], [x + 1, nh, z + 1]], [1, 0, 0], sr * 0.95, sg * 0.95, sb * 0.95);
      if ((nh = nb(x - 1, z)) < h) quad([[x, nh, z + 1], [x, h, z + 1], [x, h, z], [x, nh, z]], [-1, 0, 0], sr * 0.85, sg * 0.85, sb * 0.85);
      if ((nh = nb(x, z + 1)) < h) quad([[x + 1, nh, z + 1], [x + 1, h, z + 1], [x, h, z + 1], [x, nh, z + 1]], [0, 0, 1], sr, sg, sb);
      if ((nh = nb(x, z - 1)) < h) quad([[x, nh, z], [x, h, z], [x + 1, h, z], [x + 1, nh, z]], [0, 0, -1], sr * 0.8, sg * 0.8, sb * 0.8);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeBoundingSphere();
    const mesh = new T.Mesh(geo, vcMat); mesh.receiveShadow = true; world.add(mesh);
  }
  const wgeo = new T.PlaneGeometry(WORLD + 400, WORLD + 400); wgeo.rotateX(-Math.PI / 2);
  const water = new T.Mesh(wgeo, new T.MeshPhongMaterial({ color: 0x3d7aa6, transparent: true, opacity: 0.8, shininess: 90, specular: 0x88aacc }));
  water.position.set(WORLD / 2, 0.72, WORLD / 2); water.receiveShadow = true; world.add(water);
}

// עצים וסלעים
let props = [], propAt = new Int32Array(WORLD * WORLD).fill(-1), propMeshes = {};
function genProps(seed) {
  const r = mulberry(seed ^ 0x9e3779b9);
  const trees = [], rocks = [];
  for (let z = 2; z < WORLD - 2; z++) for (let x = 2; x < WORLD - 2; x++) {
    const i = z * WORLD + x, h = H[i]; if (WATER[i] || h < 1) continue;
    if (dist2(x, z, CX, CZ) < 24 * 24) continue;
    if (camps.some(c => dist2(x, z, c.x, c.z) < (CAMPS[c.kind].clear) ** 2)) continue;
    const forest = fbm(x / 30 + 300, z / 30, seed + 77, 3);
    let p = forest > 0.57 ? 0.24 : 0.01; if (h >= 8) p *= 0.3; if (h >= 11) p = 0;
    const v = r();
    if (v < p) trees.push({ x: x + 0.5 + (r() - 0.5) * 0.4, z: z + 0.5 + (r() - 0.5) * 0.4, h, s: 0.75 + r() * 0.6, pine: h >= 6 || r() < 0.45, tile: i, ry: r() * 6.3, tint: r() });
    else if ((h >= 6 && v > 0.965) || v > 0.996) rocks.push({ x: x + 0.5, z: z + 0.5, h, s: 0.5 + r() * 0.8, tile: i, ry: r() * 6.3, tint: r() });
  }
  const trunkG = new T.CylinderGeometry(0.15, 0.22, 1.6, 6); trunkG.translate(0, 0.8, 0);
  const pineG = mergeParts([{ g: CONEN, c: '#ffffff', p: [0, 1.9, 0], s: [2.3, 1.9, 2.3] }, { g: CONEN, c: '#ffffff', p: [0, 2.8, 0], s: [1.7, 1.6, 1.7] }, { g: CONEN, c: '#ffffff', p: [0, 3.55, 0], s: [1.1, 1.3, 1.1] }]);
  pineG.deleteAttribute('color');
  const oakG = new T.IcosahedronGeometry(1.25, 0); oakG.translate(0, 2.4, 0);
  const rockG = new T.DodecahedronGeometry(0.6, 0); rockG.translate(0, 0.25, 0);
  const trunkM = new T.InstancedMesh(trunkG, new T.MeshLambertMaterial({ color: 0x6a4527 }), Math.max(1, trees.length));
  const pines = trees.filter(t => t.pine), oaks = trees.filter(t => !t.pine);
  const pineM = new T.InstancedMesh(pineG, new T.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, pines.length));
  const oakM = new T.InstancedMesh(oakG, new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), Math.max(1, oaks.length));
  const rockM = new T.InstancedMesh(rockG, new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), Math.max(1, rocks.length));
  const q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), p = new T.Vector3(), s = new T.Vector3(), c = new T.Color();
  let ti = 0, pi = 0, oi = 0, ri = 0;
  props = [];
  for (const t of trees) {
    q.setFromAxisAngle(up, t.ry); p.set(t.x, t.h, t.z); s.setScalar(t.s); _m4.compose(p, q, s);
    trunkM.setMatrixAt(ti, _m4); const rec = { tile: t.tile, kind: 'tree', items: [[trunkM, ti++]] };
    if (t.pine) { pineM.setMatrixAt(pi, _m4); c.setHSL(0.3 + t.tint * 0.05, 0.45, 0.22 + t.tint * 0.07); pineM.setColorAt(pi, c); rec.items.push([pineM, pi++]); }
    else { oakM.setMatrixAt(oi, _m4); c.setHSL(0.24 + t.tint * 0.06, 0.48, 0.3 + t.tint * 0.08); oakM.setColorAt(oi, c); rec.items.push([oakM, oi++]); }
    propAt[t.tile] = props.length; props.push(rec);
  }
  for (const k of rocks) {
    q.setFromAxisAngle(up, k.ry); p.set(k.x, k.h, k.z); s.set(k.s, k.s * 0.75, k.s); _m4.compose(p, q, s);
    rockM.setMatrixAt(ri, _m4); c.setHSL(0.08, 0.05, 0.42 + k.tint * 0.15); rockM.setColorAt(ri, c);
    propAt[k.tile] = props.length; props.push({ tile: k.tile, kind: 'rock', items: [[rockM, ri++]] });
  }
  for (const m of [trunkM, pineM, oakM, rockM]) { m.castShadow = shadowsOn; m.userData.caster = true; m.receiveShadow = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; world.add(m); }
  trunkM.count = ti; pineM.count = pi; oakM.count = oi; rockM.count = ri;
  propMeshes = { trunkM, pineM, oakM, rockM };
}
const ZERO = new T.Matrix4().makeScale(0, 0, 0);
function removeProp(tile) {
  const pi = propAt[tile]; if (pi < 0) return null; const rec = props[pi];
  for (const [mesh, i] of rec.items) { mesh.setMatrixAt(i, ZERO); mesh.instanceMatrix.needsUpdate = true; }
  propAt[tile] = -1; if (state) state.chopped.push(tile); return rec;
}

const clouds = new T.Group(); scene.add(clouds);
(function makeClouds() {
  const r = mulberry(42); const mat = new T.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, fog: false, emissive: 0x6a7b88 });
  for (let i = 0; i < 26; i++) {
    const parts = []; const n = 3 + ((r() * 4) | 0);
    for (let j = 0; j < n; j++) parts.push({ c: '#ffffff', p: [(r() - 0.5) * 16, (r() - 0.5) * 2, (r() - 0.5) * 8], s: [6 + r() * 10, 2 + r() * 2.5, 5 + r() * 7] });
    const m = new T.Mesh(mergeParts(parts), mat); m.position.set(r() * 600 - 170, 78 + r() * 18, r() * 600 - 170); m.userData.v = 0.6 + r() * 0.8; clouds.add(m);
  }
})();

// ============================================================ שרטוטי מבנים
class BP {
  constructor() { this.c = new Map(); this.decor = []; }
  set(x, y, z, m) { this.c.set(x + '|' + y + '|' + z, [x, y, z, m]); return this; }
  del(x, y, z) { this.c.delete(x + '|' + y + '|' + z); return this; }
  box(x0, y0, z0, x1, y1, z1, m) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, m); return this; }
  ring(x0, z0, x1, z1, y0, y1, m) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (x === x0 || x === x1 || z === z0 || z === z1) this.set(x, y, z, m); return this; }
  crenel(x0, z0, x1, z1, y, m) { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if ((x === x0 || x === x1 || z === z0 || z === z1) && ((x + z) & 1) === 0) this.set(x, y, z, m); return this; }
  gable(axis, a0, a1, c0, c1, y, m, endM) {
    const S = (a, c, yy, mm) => (axis === 'x' ? this.set(a, yy, c, mm) : this.set(c, yy, a, mm));
    for (let l = 0; ; l++) {
      const cA = c0 - 1 + l, cB = c1 + 1 - l; if (cA > cB) break; const yy = y + l;
      for (let a = a0 - 1; a <= a1 + 1; a++) { S(a, cA, yy, m); S(a, cB, yy, m); }
      if (endM != null) for (let c = cA + 1; c <= cB - 1; c++) { S(a0, c, yy, endM); S(a1, c, yy, endM); }
      if (cA === cB) break;
    }
    return this;
  }
  hip(x0, z0, x1, z1, y, m) {
    for (let l = 0; ; l++) {
      const xa = x0 - 1 + l, xb = x1 + 1 - l, za = z0 - 1 + l, zb = z1 + 1 - l; if (xa > xb || za > zb) break;
      this.ring(xa, za, xb, zb, y + l, y + l, m); if (xa === xb || za === zb) break;
    }
    return this;
  }
  list() { return [...this.c.values()]; }
}
const ROT = (dx, dz, r) => { for (let i = 0; i < r; i++) { const t = dx; dx = dz; dz = -t; } return [dx, dz]; };

const PREFAB_BP = {
  tower(m) {
    const b = new BP(), top = 9;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const rr = Math.hypot(dx, dz); if (rr > 3.25) continue; const ring = rr >= 2.3;
      if (ring) for (let y = 0; y < top; y++) b.set(dx, y, dz, m);
      b.set(dx, top - 1, dz, m);
      if (ring && ((dx + dz) & 1) === 0) b.set(dx, top, dz, m);
    }
    b.del(0, 0, 3).del(0, 1, 3);
    for (const [sx, sz] of [[3, 0], [-3, 0], [0, -3]]) b.del(sx, 4, sz).del(sx, 5, sz);
    for (let y = 0; y < top; y++) b.set(0, y, 0, m);
    const ring8 = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
    for (let i = 0; i < 8; i++) b.set(ring8[i][0], i, ring8[i][1], m);
    b.del(ring8[6][0], top - 1, ring8[6][1]).del(ring8[7][0], top - 1, ring8[7][1]);
    b.decor.push({ k: 'flag', x: 0, y: top, z: 0 });
    return b;
  },
  keep(m) {
    const b = new BP(), R = 4, F1 = 5, TOP = 10;
    b.ring(-R, -R, R, R, 0, TOP, m).box(-3, F1, -3, 3, F1, 3, m).box(-3, TOP, -3, 3, TOP, 3, m).crenel(-R, -R, R, R, TOP + 1, m);
    for (const [cx, cz] of [[R, R], [R, -R], [-R, R], [-R, -R]]) b.set(cx, TOP + 1, cz, m).set(cx, TOP + 2, cz, m);
    b.del(0, 0, R).del(0, 1, R);
    for (const y of [2, 3, 7, 8]) { for (const s of [-2, 2]) { b.set(R, y, s, MI.glass).set(-R, y, s, MI.glass).set(s, y, -R, MI.glass); } }
    for (let k = 0; k <= 4; k++) for (let y = 0; y <= k; y++) b.set(-3, y, 3 - k, m);
    b.del(-3, F1, 0).del(-3, F1, -1);
    for (let j = 1; j <= 4; j++) for (let y = F1 + 1; y <= F1 + j; y++) b.set(3, y, -3 + j, m);
    b.del(3, TOP, 0).del(3, TOP, 1);
    b.decor.push({ k: 'flag', x: 0, y: TOP + 1, z: 0, big: true });
    return b;
  },
  gatehouse(m) {
    const b = new BP();
    b.box(-3, 0, -1, 3, 6, 1, m);
    for (let x = -1; x <= 1; x++) for (let y = 0; y <= 3; y++) for (let z = -1; z <= 1; z++) b.del(x, y, z);
    for (let x = -1; x <= 1; x++) for (let y = 0; y <= 3; y++) b.set(x, y, 0, MI.gate);
    for (let x = -3; x <= 3; x++) if ((x & 1) === 1 || x === -3 || x === 3) { b.set(x, 7, -1, m).set(x, 7, 1, m); }
    for (const x of [-3, 3]) for (let z = -1; z <= 1; z++) b.set(x, 7, z, m).set(x, 8, z, m);
    return b;
  },
  stairs(m) { const b = new BP(); for (let k = 0; k <= 4; k++) for (let y = 0; y <= k; y++) b.set(0, y, -k, m); return b; },
};

const BUILDINGS = {
  house: { name: 'בית מגורים', cost: 120, desc: '+4 מקומות בצבא, +3 מס', cap: 4, income: 3 },
  farm: { name: 'חווה', cost: 150, desc: '+8 זהב בכל סבב מסים', income: 8 },
  market: { name: 'שוק', cost: 320, desc: '+18 זהב בכל סבב מסים', income: 18 },
  barracks: { name: 'קסרקטין', cost: 250, desc: 'גיוס לוחמי חרב, קשתים ונושאי רומח. +3 צבא', cap: 3 },
  stable: { name: 'אורווה', cost: 420, desc: 'גיוס אבירים רכובים. +2 צבא', cap: 2 },
  smith: { name: 'נפחייה', cost: 380, desc: '+25% נזק לכל הצבא', income: 2 },
  tower: { name: 'מגדל קשתים', cost: 300, desc: 'יורה חיצים באויבים שמתקרבים' },
  church: { name: 'קתדרלה', cost: 900, desc: '+40 זהב בכל סבב מסים', income: 40 },
};
const BUILDING_BP = {
  house() {
    const b = new BP(), W = MI.timber;
    b.ring(-2, -2, 2, 2, 0, 2, W);
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) for (let y = 0; y <= 2; y++) b.set(x, y, z, MI.log);
    b.del(0, 0, 2).del(0, 1, 2); b.set(-2, 1, 0, MI.glass).set(2, 1, 0, MI.glass).set(1, 1, 2, MI.glass);
    b.gable('x', -2, 2, -2, 2, 3, MI.roof, W);
    for (let y = 4; y <= 7; y++) b.set(1, y, -1, MI.brick);
    return b;
  },
  farm() {
    const b = new BP();
    b.ring(-4, -4, 4, 4, 0, 0, MI.log); b.del(0, 0, 4);
    b.set(-3, 0, -3, MI.hay).set(-2, 0, -3, MI.hay).set(-3, 1, -3, MI.hay).set(-3, 0, -2, MI.hay);
    b.decor.push({ k: 'field', x: 0.5, y: 0, z: 0.8, w: 6, d: 5 });
    return b;
  },
  market() {
    const b = new BP();
    b.box(-4, 0, -4, 4, 0, 4, MI.cobble);
    b.ring(-1, -1, 1, 1, 1, 1, MI.stone).del(0, 1, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.set(x, 2, z, MI.wood).set(x, 3, z, MI.wood);
    b.box(-1, 4, -1, 1, 4, 1, MI.roof);
    b.decor.push({ k: 'stall', x: -3, y: 1, z: -3, c: '#b3232b' }, { k: 'stall', x: 3, y: 1, z: -3, c: '#1f4f9e' }, { k: 'stall', x: -3, y: 1, z: 3, c: '#1f7a3d' }, { k: 'stall', x: 3, y: 1, z: 3, c: '#e1b23b' });
    return b;
  },
  barracks() {
    const b = new BP(), S = MI.stone;
    b.ring(-3, -2, 3, 2, 0, 3, S).box(-3, 4, -2, 3, 4, 2, S).crenel(-3, -2, 3, 2, 5, S);
    b.del(0, 0, 2).del(0, 1, 2);
    for (const [x, z] of [[3, 0], [-3, 0], [-2, -2], [2, -2], [2, 2], [-2, 2]]) b.del(x, 2, z);
    b.decor.push({ k: 'flag', x: 0, y: 5, z: 0 });
    return b;
  },
  stable() {
    const b = new BP();
    b.ring(-3, -2, 3, 2, 0, 2, MI.wood);
    for (let x = -1; x <= 1; x++) for (let y = 0; y <= 1; y++) b.del(x, y, 2);
    b.gable('x', -3, 3, -2, 2, 3, MI.thatch, MI.wood);
    b.set(-2, 0, -1, MI.hay).set(2, 0, -1, MI.hay).set(2, 1, -1, MI.hay);
    return b;
  },
  smith() {
    const b = new BP();
    b.ring(-2, -2, 2, 2, 0, 2, MI.cobble).del(0, 0, 2).del(0, 1, 2);
    b.hip(-2, -2, 2, 2, 3, MI.slate);
    for (let y = 3; y <= 6; y++) b.set(2, y, -2, MI.brick);
    b.decor.push({ k: 'anvil', x: 0, y: 0, z: 3.4 });
    return b;
  },
  tower() {
    const b = new BP(), S = MI.stone;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const rr = Math.hypot(dx, dz); if (rr > 2.3) continue;
      if (rr >= 1.5) for (let y = 0; y < 6; y++) b.set(dx, y, dz, S);
      b.set(dx, 6, dz, S); if (rr >= 1.5 && ((dx + dz) & 1) === 0) b.set(dx, 7, dz, S);
    }
    b.del(0, 0, 2).del(0, 1, 2);
    b.decor.push({ k: 'archer', x: 0, y: 7, z: 0 });
    return b;
  },
  church() {
    const b = new BP(), M = MI.marble;
    b.ring(-4, -7, 4, 5, 0, 6, M);
    for (const z of [-5, -3, -1, 1, 3]) for (let y = 2; y <= 4; y++) b.set(4, y, z, MI.glass).set(-4, y, z, MI.glass);
    for (let y = 3; y <= 5; y++) b.set(0, y, -7, MI.glass); b.set(-1, 4, -7, MI.glass).set(1, 4, -7, MI.glass);
    b.gable('z', -7, 5, -4, 4, 7, MI.slate, M);
    b.ring(-1, 5, 1, 7, 0, 12, M);
    for (let y = 0; y <= 12; y++) b.del(0, y, 6);
    for (let y = 0; y <= 2; y++) b.del(0, y, 7).del(0, y, 5);
    b.del(0, 10, 7).del(1, 10, 6).del(-1, 10, 6);
    b.ring(-1, 5, 1, 7, 13, 13, MI.slate).set(0, 13, 6, MI.slate).set(0, 14, 6, MI.slate);
    for (let y = 15; y <= 17; y++) b.set(0, y, 6, MI.gold); b.set(-1, 16, 6, MI.gold).set(1, 16, 6, MI.gold);
    return b;
  },
};

// ============================================================ קישוטים (דגלים, אוהלים...)
let cloths = [];
const flagTexCache = {};
function bannerTexture(b, idKey) {
  let rec = flagTexCache[idKey];
  if (!rec) { const cv = document.createElement('canvas'); cv.width = 192; cv.height = 128; const tex = new T.CanvasTexture(cv); tex.anisotropy = 4; rec = flagTexCache[idKey] = { cv, tex }; }
  drawBanner(rec.cv.getContext('2d'), 192, 128, b, 'flag'); rec.tex.needsUpdate = true; return rec.tex;
}
const flagMats = {};
function flagMat(team) {
  const k = team === 0 ? 'p' : 'e';
  if (!flagMats[k]) flagMats[k] = new T.MeshLambertMaterial({ map: team === 0 ? bannerTexture(state ? state.kingdom.banner : randomBanner(), 'p') : bannerTexture(ENEMY_BANNER, 'e'), side: T.DoubleSide });
  return flagMats[k];
}
const poleMat = new T.MeshLambertMaterial({ color: 0x5b3e24 }), goldMat = new T.MeshPhongMaterial({ color: 0xe0b040, shininess: 80 });
function makeFlag(team, height = 4, big = false) {
  const g = new T.Group();
  const pole = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, height, 6), poleMat); pole.position.y = height / 2; pole.castShadow = shadowsOn; pole.userData.caster = true; g.add(pole);
  const fin = new T.Mesh(new T.SphereGeometry(0.13, 8, 6), goldMat); fin.position.y = height + 0.05; g.add(fin);
  const fw = big ? 2.6 : 1.8, fh = big ? 1.7 : 1.2;
  const geo = new T.PlaneGeometry(fw, fh, 12, 6); geo.translate(fw / 2, 0, 0);
  const cloth = new T.Mesh(geo, flagMat(team)); cloth.position.set(0.05, height - fh / 2 - 0.1, 0); cloth.castShadow = shadowsOn; cloth.userData.caster = true; g.add(cloth);
  cloth.userData.base = Float32Array.from(geo.attributes.position.array); cloth.userData.phase = Math.random() * 6; cloth.userData.w = fw;
  cloths.push(cloth); g.userData.cloth = cloth; return g;
}
function setFlagTeam(g, team) { g.userData.cloth.material = flagMat(team); }
function waveCloths(t) {
  for (const c of cloths) {
    if (!c.parent) continue;
    const pa = c.geometry.attributes.position, b = c.userData.base, w = c.userData.w, ph = c.userData.phase;
    for (let i = 0; i < pa.count; i++) { const x = b[i * 3]; pa.array[i * 3 + 2] = Math.sin(x * 2.6 - t * 5 + ph) * 0.14 * (x / w + 0.08); }
    pa.needsUpdate = true;
  }
}
function makeTent(color) {
  const g = new T.Group();
  const m = new T.Mesh(new T.ConeGeometry(1.5, 2.1, 4), new T.MeshLambertMaterial({ color, flatShading: true })); m.rotation.y = Math.PI / 4; m.position.y = 1.05; m.castShadow = shadowsOn; m.userData.caster = true; g.add(m);
  const door = new T.Mesh(new T.PlaneGeometry(0.6, 1.0), new T.MeshBasicMaterial({ color: 0x1a120a })); door.position.set(0, 0.5, 0.78); door.rotation.x = -0.33; g.add(door);
  return g;
}
let fires = [];
function makeFire() {
  const g = new T.Group();
  g.add(new T.Mesh(mergeParts([{ c: '#4b3220', p: [0, 0.1, 0], s: [1.1, 0.16, 0.18], r: [0, 0.4, 0] }, { c: '#4b3220', p: [0, 0.1, 0], s: [1.1, 0.16, 0.18], r: [0, -0.8, 0] }, { c: '#6b6b6b', p: [0, 0.05, 0], s: [1.4, 0.1, 1.4] }]), vcMat));
  const fl = new T.Mesh(new T.ConeGeometry(0.35, 0.9, 6), new T.MeshBasicMaterial({ color: 0xff8a2a })); fl.position.y = 0.55; fl.userData.ph = Math.random() * 6; g.add(fl); fires.push(fl);
  return g;
}
function makeField(w, d) {
  const g = new T.Group();
  const soil = new T.Mesh(new T.BoxGeometry(w, 0.1, d), new T.MeshLambertMaterial({ color: 0x6b4a2c })); soil.position.y = 0.05; soil.receiveShadow = true; g.add(soil);
  const n = Math.floor(w * d * 3); const stalk = new T.BoxGeometry(0.08, 0.7, 0.08); stalk.translate(0, 0.35, 0);
  const im = new T.InstancedMesh(stalk, new T.MeshLambertMaterial({ color: 0xd7b84f }), n); const r = mulberry(n * 7 + w);
  for (let i = 0; i < n; i++) { const x = (Math.floor(i / (d * 3)) / (w - 0.01)) * w * 0.98 - w / 2 + 0.2, z = (r() - 0.5) * (d - 0.3); _m4.makeRotationZ((r() - 0.5) * 0.3); _m4.setPosition(x + (r() - 0.5) * 0.15, 0.1, z); im.setMatrixAt(i, _m4); }
  g.add(im); return g;
}
function makeStall(color) {
  const stripe = document.createElement('canvas'); stripe.width = 64; stripe.height = 8; const sg = stripe.getContext('2d');
  for (let i = 0; i < 8; i++) { sg.fillStyle = i % 2 ? '#f0e8d4' : color; sg.fillRect(i * 8, 0, 8, 8); }
  const g = new T.Group();
  g.add(new T.Mesh(mergeParts([{ c: '#7b5532', p: [0, 0.45, 0], s: [1.8, 0.1, 1.0] }, { c: '#5a3d22', p: [0.82, 0.9, 0.42], s: [0.08, 1.8, 0.08] }, { c: '#5a3d22', p: [-0.82, 0.9, 0.42], s: [0.08, 1.8, 0.08] }, { c: '#5a3d22', p: [0.82, 0.9, -0.42], s: [0.08, 1.8, 0.08] }, { c: '#5a3d22', p: [-0.82, 0.9, -0.42], s: [0.08, 1.8, 0.08] }, { c: '#c9883a', p: [-0.4, 0.62, 0], s: [0.4, 0.25, 0.4] }, { c: '#3b7a2e', p: [0.35, 0.6, 0.1], s: [0.35, 0.2, 0.35] }]), vcMat));
  const can = new T.Mesh(new T.BoxGeometry(2.1, 0.14, 1.3), new T.MeshLambertMaterial({ map: new T.CanvasTexture(stripe) })); can.position.y = 1.85; can.rotation.x = 0.12; can.castShadow = shadowsOn; can.userData.caster = true; g.add(can);
  return g;
}
function makeAnvil() { return new T.Mesh(mergeParts([{ c: '#3a3d42', p: [0, 0.55, 0], s: [0.8, 0.22, 0.4] }, { c: '#3a3d42', p: [0, 0.3, 0], s: [0.3, 0.4, 0.3] }, { c: '#5a3d22', p: [0, 0.08, 0], s: [0.6, 0.16, 0.6] }, { c: '#3a3d42', p: [0.5, 0.58, 0], s: [0.3, 0.12, 0.2] }]), vcMat); }
function makeDecor(it, ox, oy, oz, rot, team = 0) {
  const [rx, rz] = ROT(it.x, it.z, rot);
  let o;
  switch (it.k) {
    case 'flag': o = makeFlag(team, it.h || (it.big ? 5 : 3.6), it.big); break;
    case 'tent': o = makeTent(it.c); break;
    case 'fire': o = makeFire(); break;
    case 'field': o = makeField(it.w, it.d); break;
    case 'stall': o = makeStall(it.c); break;
    case 'anvil': o = makeAnvil(); break;
    case 'archer': { const md = getModel('archer', 0); o = new T.Group(); o.add(new T.Mesh(md.body, vcMat)); const wp = new T.Mesh(md.weapon, vcMat); wp.position.set(...md.pivot); o.add(wp); break; }
    default: o = new T.Group();
  }
  o.position.set(ox + 0.5 + rx, oy + (it.y || 0), oz + 0.5 + rz); o.rotation.y = rot * Math.PI / 2 + (it.ry || 0);
  world.add(o); return o;
}
function removeObj(o) { if (!o) return; world.remove(o); if (o.userData.cloth) cloths = cloths.filter(c => c !== o.userData.cloth); o.traverse(c => { if (fires.includes(c)) fires = fires.filter(f => f !== c); }); }

// ============================================================ יעדים (מחנות אויב)
const CAMPS = {
  bandit: { name: 'מאהל שודדים', reward: 150, income: 6, territory: 15, clear: 10, flat: 7, garrison: [['bandit', 4], ['banditArcher', 2]] },
  fort: { name: 'מבצר', reward: 450, income: 14, territory: 21, clear: 13, flat: 10, garrison: [['soldier', 6], ['banditArcher', 3], ['eknight', 1]] },
  castle: { name: 'טירת אויב', reward: 1500, income: 35, territory: 28, clear: 17, flat: 14, garrison: [['soldier', 10], ['banditArcher', 6], ['eknight', 4], ['warlord', 1]] },
};
const CAMP_NAMES = {
  bandit: ['מאהל הזאבים', 'מחנה העורבים', 'מאורת הנחש', 'מאהל השועלים', 'מחנה היער השחור', 'מאהל הגולגולת', 'מחנה הצלב השבור', 'מאהל הנוכלים'],
  fort: ['מבצר הברזל', 'מבצר אבן־הדם', 'מבצר הערפל', 'מבצר המצוק', 'מבצר העקרב', 'מבצר הסלע האדום'],
  castle: ['טירת הצל', 'טירת הדרקון השחור', 'טירת הקרח', 'טירת העורב'],
};
let camps = [];
function genCamps(seed) {
  const r = mulberry(seed ^ 0x51ed27); camps = [];
  const plan = [['bandit', 7, 36, 92], ['fort', 5, 60, 110], ['castle', 3, 84, 112]];
  for (const [kind, count, dmin, dmax] of plan) for (let n = 0; n < count; n++) {
    for (let t = 0; t < 900; t++) {
      const a = r() * Math.PI * 2, d = dmin + r() * (dmax - dmin), x = Math.round(CX + Math.cos(a) * d), z = Math.round(CZ + Math.sin(a) * d);
      if (x < 18 || z < 18 || x > WORLD - 18 || z > WORLD - 18) continue;
      const i = z * WORLD + x, h = H[i]; if (WATER[i] || h < 1 || h > 8) continue;
      const sep = kind === 'castle' ? 40 : 30; if (camps.some(c => dist2(c.x, c.z, x, z) < sep * sep)) continue;
      if (nearWater(x, z, CAMPS[kind].flat - 2)) continue;
      camps.push({ id: camps.length, kind, name: CAMP_NAMES[kind][n % CAMP_NAMES[kind].length], x, z, y: h, owner: 1, decor: [], flag: null });
      flatten(x, z, CAMPS[kind].flat, h); break;
    }
  }
}
function flatten(x0, z0, r0, h) {
  for (let dz = -r0 - 5; dz <= r0 + 5; dz++) for (let dx = -r0 - 5; dx <= r0 + 5; dx++) {
    const x = x0 + dx, z = z0 + dz; if (x < 0 || z < 0 || x >= WORLD || z >= WORLD) continue;
    const d = Math.hypot(dx, dz), i = z * WORLD + x;
    if (d <= r0) { H[i] = h; WATER[i] = 0; }
    else if (d < r0 + 5 && !WATER[i]) { const t = (d - r0) / 5; H[i] = Math.max(1, Math.round(lerp(h, H[i], t))); }
  }
}
function campBP(kind) {
  const b = new BP();
  if (kind === 'bandit') {
    b.set(3, 0, -4, MI.wood).set(4, 0, -4, MI.wood).set(3, 1, -4, MI.wood).set(-4, 0, 3, MI.log);
    b.decor.push({ k: 'tent', x: -3, z: -3, c: 0x7a5f3e }, { k: 'tent', x: 3, z: 2, c: 0x6b5236, ry: 0.6 }, { k: 'tent', x: -2, z: 4, c: 0x5e4a33, ry: 1.2 }, { k: 'fire', x: 0, z: 0 }, { k: 'flag', x: 0, z: -4, h: 4 });
  } else if (kind === 'fort') {
    b.ring(-7, -7, 7, 7, 0, 2, MI.log);
    for (let x = -1; x <= 1; x++) for (let y = 0; y <= 2; y++) b.del(x, y, 7);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { b.box(sx > 0 ? 6 : -7, 0, sz > 0 ? 6 : -7, sx > 0 ? 7 : -6, 4, sz > 0 ? 7 : -6, MI.log); }
    b.decor.push({ k: 'tent', x: -3, z: -3, c: 0x4a4a4a }, { k: 'tent', x: 3, z: -3, c: 0x4a4a4a, ry: 0.5 }, { k: 'fire', x: 0, z: 1 }, { k: 'flag', x: 0, z: -5, h: 5 });
  } else {
    const D = MI.dark;
    b.ring(-11, -11, 11, 11, 0, 4, D).crenel(-11, -11, 11, 11, 5, D);
    for (let x = -1; x <= 1; x++) for (let y = 0; y <= 2; y++) b.del(x, y, 11);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const x0 = sx > 0 ? 9 : -11, z0 = sz > 0 ? 9 : -11; b.box(x0, 0, z0, x0 + 2, 7, z0 + 2, D).crenel(x0, z0, x0 + 2, z0 + 2, 8, D); }
    b.ring(-3, -3, 3, 3, 0, 8, D).box(-2, 8, -2, 2, 8, 2, D).del(0, 0, 3).del(0, 1, 3);
    b.hip(-3, -3, 3, 3, 9, MI.slate);
    b.decor.push({ k: 'tent', x: -6, z: -6, c: 0x3a3030 }, { k: 'tent', x: 6, z: -6, c: 0x3a3030 }, { k: 'fire', x: 0, z: 7 }, { k: 'flag', x: 0, y: 13, z: 0, h: 4.5, big: true });
  }
  return b;
}
function campRot(c) { const a = Math.atan2(CX - c.x, CZ - c.z); return ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4; }
function buildCamp(c, placeBlocks) {
  const b = campBP(c.kind), rot = campRot(c); c.rot = rot;
  if (placeBlocks) for (const [dx, dy, dz, m] of b.list()) { const [rx, rz] = ROT(dx, dz, rot); setBlock(c.x + rx, c.y + dy, c.z + rz, m); }
  for (const it of b.decor) { const o = makeDecor(it, c.x, c.y, c.z, rot, c.owner); c.decor.push(o); if (it.k === 'flag') c.flag = o; }
}

// ============================================================ דמויות
const UNIT = {
  hero: { name: 'הגיבור', hp: 420, atk: 28, range: 1.8, cd: 0.65, speed: 5.4, model: 'hero' },
  sword: { name: 'לוחם חרב', cost: 50, hp: 110, atk: 12, range: 1.5, cd: 1.0, speed: 3.8, model: 'sword', req: 'barracks' },
  spear: { name: 'נושא רומח', cost: 65, hp: 140, atk: 11, range: 2.0, cd: 1.1, speed: 3.6, model: 'spear', req: 'barracks' },
  archer: { name: 'קשת', cost: 70, hp: 70, atk: 10, range: 12, cd: 1.5, speed: 3.8, model: 'archer', ranged: true, req: 'barracks' },
  knight: { name: 'אביר', cost: 160, hp: 250, atk: 22, range: 1.9, cd: 1.1, speed: 6.2, model: 'knight', req: 'stable', mounted: true },
  bandit: { hp: 70, atk: 7, range: 1.5, cd: 1.1, speed: 3.5, model: 'bandit', bounty: 8 },
  banditArcher: { hp: 50, atk: 7, range: 11, cd: 1.7, speed: 3.5, model: 'banditArcher', ranged: true, bounty: 10 },
  soldier: { hp: 115, atk: 11, range: 1.5, cd: 1.0, speed: 3.6, model: 'soldierE', bounty: 14 },
  eknight: { hp: 230, atk: 18, range: 1.9, cd: 1.1, speed: 5.6, model: 'knightE', bounty: 30, mounted: true },
  warlord: { hp: 950, atk: 32, range: 2.1, cd: 1.0, speed: 4.2, model: 'warlord', bounty: 220, scale: 1.35 },
};
const modelCache = {};
function modelOpts(kind, team) {
  const b = state ? state.kingdom.banner : { c1: '#1f4f9e', c2: '#e1b23b' };
  const main = b.c1, trim = b.c2 === b.c1 ? '#e8e0c8' : b.c2;
  switch (kind) {
    case 'hero': return { main, trim, arm: '#a3abb4', helm: 'crown', shield: true, cape: true, weapon: 'sword' };
    case 'sword': return { main, trim, arm: '#8e979f', helm: 'kettle', shield: true, weapon: 'sword' };
    case 'spear': return { main, trim, arm: main, helm: 'kettle', shield: true, weapon: 'spear' };
    case 'archer': return { main, trim, arm: '#6b4a2e', helm: 'hood', hood: shade(main, -0.3), weapon: 'bow', quiver: true };
    case 'knight': return { main, trim, arm: '#a9b1b9', helm: 'great', shield: true, horse: '#6e4729', weapon: 'lance' };
    case 'bandit': return { main: '#5e4128', trim: '#3a2616', arm: '#5e4128', helm: 'hood', hood: '#3a2a1c', weapon: 'club' };
    case 'banditArcher': return { main: '#4d5a2e', trim: '#2e3a1a', arm: '#4d5a2e', helm: 'hood', hood: '#2e3a1a', weapon: 'bow', quiver: true };
    case 'soldierE': return { main: '#2a2a2e', trim: '#9b1c1c', arm: '#6d7379', helm: 'kettle', shield: true, weapon: 'sword' };
    case 'knightE': return { main: '#1f1f22', trim: '#a01d1d', arm: '#555b61', helm: 'great', shield: true, horse: '#2a1e16', weapon: 'lance' };
    case 'warlord': return { main: '#141414', trim: '#b51f1f', arm: '#3c4045', helm: 'horned', cape: true, weapon: 'axe' };
  }
  return { main, trim, arm: '#888', helm: 'kettle', weapon: 'sword' };
}
function getModel(kind, team) {
  const k = kind + '_' + team; if (modelCache[k]) return modelCache[k];
  const o = modelOpts(kind, team); const P = [], W = [];
  const A = (arr, c, x, y, z, sx, sy, sz, r) => arr.push({ c, p: [x, y, z], s: [sx, sy, sz], r });
  const skin = '#e0b48c', metal = '#9aa2aa', leather = '#4a321e', pants = '#3a2f26';
  let y0 = 0;
  if (o.horse) {
    const hc = o.horse;
    A(P, hc, 0, 1.0, 0, 0.56, 0.56, 1.32); A(P, o.main, 0, 0.92, 0, 0.62, 0.42, 1.36); A(P, o.trim, 0, 0.72, 0, 0.63, 0.06, 1.37);
    for (const [x, z] of [[0.18, 0.48], [-0.18, 0.48], [0.18, -0.48], [-0.18, -0.48]]) { A(P, hc, x, 0.4, z, 0.14, 0.8, 0.16); A(P, '#1e1712', x, 0.04, z, 0.16, 0.08, 0.18); }
    A(P, hc, 0, 1.42, 0.62, 0.26, 0.62, 0.3, [-0.5, 0, 0]); A(P, hc, 0, 1.7, 0.88, 0.22, 0.24, 0.5, [0.35, 0, 0]);
    A(P, '#24180f', 0, 1.56, 0.52, 0.06, 0.52, 0.2, [-0.5, 0, 0]); A(P, '#24180f', 0, 1.05, -0.74, 0.08, 0.5, 0.08, [0.5, 0, 0]);
    y0 = 0.62; A(P, pants, 0.3, y0 + 0.62, 0.06, 0.14, 0.42, 0.2); A(P, pants, -0.3, y0 + 0.62, 0.06, 0.14, 0.42, 0.2);
  } else {
    A(P, pants, -0.11, 0.36, 0, 0.17, 0.72, 0.2); A(P, pants, 0.11, 0.36, 0, 0.17, 0.72, 0.2);
    A(P, '#2a1f17', -0.11, 0.06, 0.02, 0.19, 0.12, 0.25); A(P, '#2a1f17', 0.11, 0.06, 0.02, 0.19, 0.12, 0.25);
  }
  A(P, o.main, 0, y0 + 1.02, 0, 0.5, 0.62, 0.3); A(P, o.main, 0, y0 + 0.68, 0, 0.46, 0.16, 0.28);
  A(P, o.trim, 0, y0 + 0.98, 0.152, 0.14, 0.62, 0.02); A(P, leather, 0, y0 + 0.75, 0, 0.52, 0.07, 0.32);
  A(P, o.arm, 0.33, y0 + 1.0, 0, 0.15, 0.56, 0.17); A(P, o.arm, -0.33, y0 + 1.0, 0, 0.15, 0.56, 0.17);
  A(P, skin, 0.33, y0 + 0.68, 0, 0.13, 0.12, 0.14); A(P, skin, -0.33, y0 + 0.68, 0, 0.13, 0.12, 0.14);
  A(P, skin, 0, y0 + 1.5, 0, 0.3, 0.3, 0.3); A(P, '#1b1410', 0.07, y0 + 1.53, 0.152, 0.05, 0.05, 0.01); A(P, '#1b1410', -0.07, y0 + 1.53, 0.152, 0.05, 0.05, 0.01);
  switch (o.helm) {
    case 'kettle': A(P, metal, 0, y0 + 1.69, 0, 0.34, 0.12, 0.34); A(P, metal, 0, y0 + 1.63, 0, 0.48, 0.03, 0.48); break;
    case 'hood': { const hc = o.hood; A(P, hc, 0, y0 + 1.7, -0.01, 0.36, 0.08, 0.36); A(P, hc, 0, y0 + 1.5, -0.17, 0.36, 0.36, 0.04); A(P, hc, 0.17, y0 + 1.52, 0, 0.04, 0.34, 0.34); A(P, hc, -0.17, y0 + 1.52, 0, 0.04, 0.34, 0.34); A(P, hc, 0, y0 + 1.31, 0, 0.42, 0.08, 0.36); break; }
    case 'great': A(P, metal, 0, y0 + 1.53, 0, 0.36, 0.4, 0.36); A(P, '#111111', 0, y0 + 1.55, 0.181, 0.24, 0.035, 0.01); A(P, o.trim, 0, y0 + 1.78, -0.02, 0.06, 0.16, 0.26); break;
    case 'crown': A(P, '#5a3a1e', 0, y0 + 1.66, -0.01, 0.32, 0.06, 0.32); A(P, '#e5b73f', 0, y0 + 1.72, 0, 0.35, 0.07, 0.35); for (const [x, z] of [[0.15, 0.15], [-0.15, 0.15], [0.15, -0.15], [-0.15, -0.15], [0, 0.16]]) A(P, '#e5b73f', x, y0 + 1.8, z, 0.06, 0.1, 0.06); break;
    case 'horned': A(P, '#2a2c30', 0, y0 + 1.53, 0, 0.36, 0.4, 0.36); A(P, '#d01e1e', 0, y0 + 1.55, 0.181, 0.24, 0.04, 0.01); A(P, '#ece4cf', 0.24, y0 + 1.74, 0, 0.07, 0.3, 0.07, [0, 0, -0.6]); A(P, '#ece4cf', -0.24, y0 + 1.74, 0, 0.07, 0.3, 0.07, [0, 0, 0.6]); break;
  }
  if (o.shield) { A(P, o.main, -0.44, y0 + 0.98, 0.05, 0.06, 0.56, 0.44); A(P, o.trim, -0.475, y0 + 0.98, 0.05, 0.012, 0.5, 0.11); A(P, o.trim, -0.475, y0 + 1.05, 0.05, 0.012, 0.11, 0.4); A(P, metal, -0.485, y0 + 1.05, 0.05, 0.02, 0.07, 0.07); }
  if (o.cape) { A(P, o.main, 0, y0 + 0.98, -0.19, 0.52, 0.92, 0.04, [0.08, 0, 0]); A(P, o.trim, 0, y0 + 0.54, -0.22, 0.52, 0.05, 0.045, [0.08, 0, 0]); }
  if (o.quiver) A(P, leather, 0.1, y0 + 1.1, -0.19, 0.1, 0.42, 0.1, [0, 0, 0.35]);
  let rest = 0.35;
  switch (o.weapon) {
    case 'sword': A(W, '#d1d6dc', 0, 0.43, 0, 0.05, 0.7, 0.025); A(W, '#8a6a2a', 0, 0.07, 0, 0.22, 0.05, 0.06); A(W, '#3a2614', 0, -0.03, 0, 0.05, 0.14, 0.05); A(W, '#c9a03a', 0, -0.12, 0, 0.07, 0.06, 0.07); break;
    case 'spear': A(W, '#7a5532', 0, 0.5, 0, 0.045, 1.9, 0.045); A(W, metal, 0, 1.52, 0, 0.07, 0.22, 0.03); rest = 0.12; break;
    case 'lance': A(W, '#c9b48a', 0, 0.9, 0, 0.07, 2.4, 0.07); A(W, metal, 0, 0, 0, 0.2, 0.12, 0.2); A(W, o.trim, 0, 0.5, 0, 0.09, 0.4, 0.09); rest = 1.45; break;
    case 'bow': A(W, '#5a3b1e', 0, 0.1, 0.05, 0.05, 0.22, 0.05); A(W, '#6b4a26', 0, 0.42, -0.01, 0.04, 0.5, 0.04, [0.35, 0, 0]); A(W, '#6b4a26', 0, -0.22, -0.01, 0.04, 0.5, 0.04, [-0.35, 0, 0]); A(W, '#dddddd', 0, 0.1, -0.1, 0.01, 1.0, 0.01); rest = 0.05; break;
    case 'axe': A(W, '#4a3220', 0, 0.45, 0, 0.07, 1.2, 0.07); A(W, '#5c636b', 0, 0.92, 0.14, 0.05, 0.36, 0.3); break;
    case 'club': A(W, '#5c3d22', 0, 0.35, 0, 0.09, 0.62, 0.09); A(W, '#4a311c', 0, 0.62, 0, 0.14, 0.18, 0.14); break;
  }
  const md = { body: mergeParts(P), weapon: mergeParts(W), pivot: [0.33, y0 + 0.68, 0.04], rest, lance: o.weapon === 'lance', height: y0 + 1.9 };
  modelCache[k] = md; return md;
}
const arrowGeo = mergeParts([{ c: '#7a5532', p: [0, 0, 0], s: [0.035, 0.035, 0.75] }, { c: '#9aa2aa', p: [0, 0, 0.4], s: [0.07, 0.07, 0.1] }, { c: '#eeeeee', p: [0, 0, -0.32], s: [0.12, 0.01, 0.13] }]);
const hpBgMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false });
const hpMats = [new T.MeshBasicMaterial({ color: 0x7fd34e }), new T.MeshBasicMaterial({ color: 0xe0433a })];
const hpGeo = new T.PlaneGeometry(1, 0.11); const hpFgGeo = new T.PlaneGeometry(1, 0.11); hpFgGeo.translate(0.5, 0, 0);
const ringGeo = new T.RingGeometry(0.5, 0.64, 28); ringGeo.rotateX(-Math.PI / 2);
const ringMat = new T.MeshBasicMaterial({ color: 0xf0c050, transparent: true, opacity: 0.85, depthWrite: false });

let units = [], arrows = [], effects = [], hero = null, uidN = 1;
function solidWalk(x, y, z, team) {
  if (x < 0 || z < 0 || x >= WORLD || z >= WORLD) return true;
  if (y < 0) return true; if (y < H[z * WORLD + x]) return true; if (y >= MAXY) return false;
  const m = blocks.get(key(x, y, z)); if (m === undefined) return false;
  return !(MATS[m].passable && team === 0);
}
function floorAt(px, pz, py, team) {
  const x = Math.floor(px), z = Math.floor(pz); let cy = Math.min(MAXY - 1, Math.floor(py + 1.05));
  for (; cy >= -1; cy--) if (solidWalk(x, cy, z, team)) return cy + 1;
  return 0;
}
function canStand(px, pz, fy, team) {
  const x = Math.floor(px), z = Math.floor(pz);
  if (x < 0 || z < 0 || x >= WORLD || z >= WORLD) return false;
  if (fy <= 0 && WATER[z * WORLD + x]) return false;
  return !solidWalk(x, fy, z, team) && !solidWalk(x, fy + 1, z, team);
}
function tryStep(u, dx, dz) {
  const len = Math.hypot(dx, dz); if (len < 1e-6) return true;
  const px = u.x + dx + (dx / len) * 0.28, pz = u.z + dz + (dz / len) * 0.28;
  const f = floorAt(px, pz, u.y, u.team);
  if (f - u.y > 1.05 || !canStand(px, pz, f, u.team)) return false;
  const f2 = floorAt(u.x + dx, u.z + dz, u.y, u.team);
  if (f2 - u.y > 1.05 || !canStand(u.x + dx, u.z + dz, f2, u.team)) return false;
  u.x += dx; u.z += dz; return true;
}
function moveDir(u, dx, dz) { if (tryStep(u, dx, dz)) return true; if (Math.abs(dx) > 1e-5 && tryStep(u, dx, 0)) return true; if (Math.abs(dz) > 1e-5 && tryStep(u, 0, dz)) return true; return false; }
function steer(u, tx, tz, dt, mul = 1) {
  const dx = tx - u.x, dz = tz - u.z, d = Math.hypot(dx, dz); if (d < 0.05) return false;
  const step = Math.min(u.def.speed * mul * dt, d), base = Math.atan2(dx, dz);
  const tries = [0, 0.5, -0.5, 1.1, -1.1, 1.7, -1.7, 2.4];
  for (const a0 of tries) {
    const a = base + a0 * u.side;
    if (tryStep(u, Math.sin(a) * step, Math.cos(a) * step)) {
      u.rot = turnTo(u.rot, a, dt * 10);
      if (a0 !== 0) { u.stuck += dt; if (u.stuck > 2.5) { u.side *= -1; u.stuck = 0; } } else u.stuck = Math.max(0, u.stuck - dt);
      return true;
    }
  }
  u.side *= -1; return false;
}
function findFree(x, z, team) {
  for (let rr = 0; rr < 14; rr++) {
    const n = Math.max(1, rr * 6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rr; const cx = Math.floor(x + Math.cos(a) * rr), cz = Math.floor(z + Math.sin(a) * rr);
      if (cx < 1 || cz < 1 || cx >= WORLD - 1 || cz >= WORLD - 1) continue;
      const i2 = cz * WORLD + cx; if (WATER[i2]) continue; const h = H[i2];
      if (!solidWalk(cx, h, cz, team) && !solidWalk(cx, h + 1, cz, team)) return { x: cx + 0.5, z: cz + 0.5, y: h };
    }
  }
  return { x, z, y: H[Math.floor(z) * WORLD + Math.floor(x)] };
}
function spawnUnit(type, team, x, z, opts = {}) {
  const def = UNIT[type]; const p = findFree(x, z, team);
  const u = { id: uidN++, type, def, team, hp: def.hp, maxHp: def.hp, x: p.x, z: p.z, y: p.y, rot: opts.rot || 0, cd: Math.random(), target: null, think: Math.random() * 0.4, anim: Math.random() * 6, dead: false, deadT: 0, atkT: 0, hitT: 0, side: Math.random() < 0.5 ? 1 : -1, goal: null, campId: opts.campId ?? -1, raid: !!opts.raid, homeX: p.x, homeZ: p.z, holdX: p.x, holdZ: p.z, stuck: 0, slot: 0, hpbar: null, lootT: 0 };
  buildUnitMesh(u); units.push(u); return u;
}
function buildUnitMesh(u) {
  if (u.mesh) world.remove(u.mesh);
  const md = getModel(u.def.model, u.team); const g = new T.Group();
  const body = new T.Mesh(md.body, vcMat); body.castShadow = shadowsOn; body.userData.caster = true; g.add(body);
  const piv = new T.Group(); piv.position.set(...md.pivot); piv.rotation.x = md.rest;
  const w = new T.Mesh(md.weapon, vcMat); w.castShadow = shadowsOn; w.userData.caster = true; piv.add(w); g.add(piv);
  if (u.type === 'hero') { const ring = new T.Mesh(ringGeo, ringMat); ring.position.y = 0.04; g.add(ring); }
  g.scale.setScalar(u.def.scale || 1);
  g.position.set(u.x, u.y, u.z); g.rotation.y = u.rot; world.add(g);
  u.mesh = g; u.body = body; u.piv = piv; u.md = md;
}
function ensureHpBar(u) {
  if (u.hpbar) return u.hpbar;
  const g = new T.Group(); const bg = new T.Mesh(hpGeo, hpBgMat); bg.scale.x = 1.04; bg.scale.y = 1.5; g.add(bg);
  const fg = new T.Mesh(hpFgGeo, hpMats[u.team]); fg.position.set(-0.5, 0, 0.001); g.add(fg); g.userData.fg = fg; g.renderOrder = 5;
  world.add(g); u.hpbar = g; return g;
}
function removeUnit(u) { world.remove(u.mesh); if (u.hpbar) world.remove(u.hpbar); const i = units.indexOf(u); if (i >= 0) units.splice(i, 1); }
function nearestFoe(u, radius, cx = u.x, cz = u.z) {
  let best = null, bd = radius * radius;
  for (const o of units) { if (o.dead || o.team === u.team) continue; const d = dist2(cx, cz, o.x, o.z); if (d < bd) { bd = d; best = o; } }
  return best;
}
const army = { order: 'follow' };
function allyGoal(u) {
  const ord = army.order;
  if (ord === 'hold') return { x: u.holdX, z: u.holdZ };
  const row = Math.floor(u.slot / 5), col = (u.slot % 5) - 2;
  let bx, bz, yaw;
  if (ord === 'home') { bx = CX + 0.5; bz = CZ + 6; yaw = 0; } else { bx = hero.x; bz = hero.z; yaw = hero.rot; }
  const back = -(2 + row * 1.4), side = col * 1.4;
  return { x: bx + Math.sin(yaw) * back + Math.cos(yaw) * side, z: bz + Math.cos(yaw) * back - Math.sin(yaw) * side };
}
function think(u) {
  if (u === hero) return;
  let cx, cz, leash, eng;
  if (u.team === 0) {
    const o = army.order;
    if (o === 'follow') { cx = hero.x; cz = hero.z; leash = 16; eng = 9; }
    else if (o === 'charge') { cx = hero.x; cz = hero.z; leash = 42; eng = 34; }
    else if (o === 'hold') { cx = u.holdX; cz = u.holdZ; leash = 14; eng = 11; }
    else { cx = CX; cz = CZ; leash = 32; eng = 15; }
    if (u.def.ranged) eng = Math.max(eng, 12);
  } else if (u.raid) { cx = u.x; cz = u.z; leash = 1e4; eng = 11; }
  else { const c = camps[u.campId]; cx = c.x; cz = c.z; leash = c.kind === 'castle' ? 30 : 24; eng = 13; }
  let t = u.target;
  if (t && (t.dead || dist2(t.x, t.z, cx, cz) > leash * leash)) t = null;
  if (!t) { t = nearestFoe(u, eng); if (t && dist2(t.x, t.z, cx, cz) > leash * leash) t = null; }
  u.target = t;
  if (!t) {
    if (u.team === 0) u.goal = allyGoal(u);
    else if (u.raid) u.goal = { x: CX + 0.5 + ((u.id % 7) - 3) * 1.2, z: CZ + 0.5 + ((u.id % 5) - 2) * 1.2 };
    else u.goal = { x: u.homeX, z: u.homeZ };
  }
}
function face(u, t) { u.rot = turnTo(u.rot, Math.atan2(t.x - u.x, t.z - u.z), 0.5); }
function attack(u, t) {
  u.cd = u.def.cd * (0.9 + Math.random() * 0.2); u.atkT = 0.3;
  let dmg = u.def.atk * (0.85 + Math.random() * 0.3);
  if (u.team === 0 && u !== hero && countB('smith') > 0) dmg *= 1.25;
  if (u.def.ranged) shootArrow(u.x, u.y + (u.md.height - 0.5) * (u.def.scale || 1), u.z, t, dmg, u);
  else { damage(t, dmg, u); sfx('hit'); }
}
function shootArrow(sx, sy, sz, t, dmg, src) {
  const m = new T.Mesh(arrowGeo, vcMat); world.add(m);
  const d = Math.hypot(t.x - sx, t.z - sz);
  arrows.push({ m, sx, sy, sz, tx: t.x, ty: t.y + 1.1, tz: t.z, t: 0, dur: Math.max(0.25, d / 24), dmg, tgt: t, src, arc: d * 0.12 });
  sfx('bow');
}
function damage(t, dmg, src) {
  if (t.dead) return; t.hp -= dmg; t.hitT = 0.15;
  if (src && src.def && !src.dead && t !== hero && (!t.target || Math.random() < 0.3)) t.target = src;
  if (t.hp <= 0) kill(t);
}
function kill(t) {
  t.dead = true; t.deadT = 0; t.target = null; if (t.hpbar) t.hpbar.visible = false;
  if (t.team === 1) {
    addGold(t.def.bounty || 5, t); state.stats.kills++;
    if (t.campId >= 0) checkConquest(camps[t.campId]);
  } else if (t === hero) {
    const loss = Math.floor(state.gold * 0.1); state.gold -= loss;
    toast(`הגיבור נפל בקרב! ${loss > 0 ? `איבדתם ${fmt(loss)} זהב. ` : ''}חוזרים לבירה בעוד רגע…`, 'warn'); sfx('horn');
  }
}
function respawnHero() {
  hero.dead = false; hero.hp = hero.maxHp; hero.target = null; hero.moveTarget = null;
  const p = findFree(CX + 0.5, CZ + 3.5, 0); hero.x = p.x; hero.z = p.z; hero.y = p.y; hero.mesh.rotation.z = 0;
  if (hero.hpbar) hero.hpbar.visible = false;
}
function checkConquest(c) {
  if (!c || c.owner === 0) return;
  if (units.some(u => !u.dead && u.campId === c.id)) return;
  c.owner = 0; if (c.flag) setFlagTeam(c.flag, 0);
  state.stats.conq[c.kind]++; const rw = CAMPS[c.kind].reward; addGold(rw);
  toast(`כבשתם את ${c.name}! +${fmt(rw)} זהב`, 'big'); sfx('fanfare');
  rebuildTerritory(); saveGame(false);
}

// ============================================================ מצב המשחק
let state = null, buildings = [], flagObjs = [];
let undoStack = [], terr = [], terrLines = null;
function newState(kingdom, seed) {
  return {
    v: 1, seed, kingdom, gold: 1000, time: 0, creative: false, chopped: [], flags: [], quest: 0, nextBid: 1,
    stats: { placed: 0, built: 0, recruited: 0, kills: 0, chops: 0, conq: { bandit: 0, fort: 0, castle: 0 }, grants: 0 },
    raid: { next: 420, level: 0 },
  };
}
const countB = t => buildings.reduce((n, b) => n + (b.type === t ? 1 : 0), 0);
const allyCount = () => units.reduce((n, u) => n + (u.team === 0 && u !== hero && !u.dead ? 1 : 0), 0);
function armyCap() { let c = 5; for (const b of buildings) c += BUILDINGS[b.type].cap || 0; for (const k of camps) if (k.owner === 0) c += 2; return c; }
function incomeRate() { let inc = 5; for (const b of buildings) inc += BUILDINGS[b.type].income || 0; for (const c of camps) if (c.owner === 0) inc += CAMPS[c.kind].income; inc += Math.floor(Math.max(0, state.stats.built) / 40); return inc; }
function rebuildTerritory() {
  terr = [{ x: CX + 0.5, z: CZ + 0.5, r: 34 }];
  for (const c of camps) if (c.owner === 0) terr.push({ x: c.x + 0.5, z: c.z + 0.5, r: CAMPS[c.kind].territory });
  if (terrLines) { world.remove(terrLines); terrLines.traverse(o => o.geometry && o.geometry.dispose()); }
  terrLines = new T.Group(); const mat = new T.LineBasicMaterial({ color: new T.Color(state.kingdom.banner.c1).lerp(new T.Color('#ffffff'), 0.25), transparent: true, opacity: 0.85 });
  for (const t of terr) {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2, x = t.x + Math.cos(a) * t.r, z = t.z + Math.sin(a) * t.r;
      if (terr.some(o => o !== t && dist2(x, z, o.x, o.z) < o.r * o.r - 1)) { if (pts.length > 1) terrLines.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), mat)); pts.length = 0; continue; }
      const gx = clamp(Math.floor(x), 0, WORLD - 1), gz = clamp(Math.floor(z), 0, WORLD - 1);
      pts.push(new T.Vector3(x, Math.max(0.8, H[gz * WORLD + gx]) + 0.15, z));
    }
    if (pts.length > 1) terrLines.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), mat));
  }
  terrLines.visible = mode === 'build'; world.add(terrLines);
}
function inTerritory(x, z) { if (state.creative) return true; for (const t of terr) if (dist2(x + 0.5, z + 0.5, t.x, t.z) <= t.r * t.r) return true; return false; }
function addGold(n, at) { if (!n) return; state.gold += n; popGold((n > 0 ? '+' : '') + fmt(n), at); if (n > 0) sfx('coin'); }
function spend(n) {
  if (state.creative || n <= 0) return true;
  if (state.gold < n) { toast(`חסר זהב: צריך ${fmt(n)}, יש ${fmt(state.gold)}`, 'warn'); sfx('error'); return false; }
  state.gold -= n; return true;
}

// ============================================================ בנייה
let mode = 'build';
const sel = { tool: 'place', mat: MI.stone, bld: 'house', rot: 0, a: null };
const TOOLS = [
  { id: 'place', name: 'בלוק', icon: 'cube' }, { id: 'erase', name: 'הריסה', icon: 'pick' }, { id: 'paint', name: 'צביעה', icon: 'brush' },
  { id: 'wall', name: 'חומה', icon: 'wall', two: true }, { id: 'floor', name: 'רצפה', icon: 'floor', two: true }, { id: 'pillar', name: 'עמוד', icon: 'pillar' },
  { id: 'tower', name: 'מגדל', icon: 'tower', prefab: true }, { id: 'keep', name: 'מצודה', icon: 'keep', prefab: true }, { id: 'gatehouse', name: 'שער', icon: 'gate', prefab: true },
  { id: 'stairs', name: 'מדרגות', icon: 'stairs', prefab: true }, { id: 'flag', name: 'דגל', icon: 'flag' }, { id: 'building', name: 'מבנים', icon: 'house' },
];
const toolDef = id => TOOLS.find(t => t.id === id);
function autoRot() { const r = Math.round(cam.yaw / (Math.PI / 2)); return (((r + sel.rot) % 4) + 4) % 4; }
function rayToBlock(hit) { return hit && hit.kind === 1; }
function cellAbove(h) { return { x: h.x + h.nx, y: h.y + h.ny, z: h.z + h.nz }; }
function blueprintFor(tool) {
  if (tool === 'building') return BUILDING_BP[sel.bld]();
  return PREFAB_BP[tool](sel.mat);
}
function planCells(bp, o, rot) { return bp.list().map(([dx, dy, dz, m]) => { const [rx, rz] = ROT(dx, dz, rot); return [o.x + rx, o.y + dy, o.z + rz, m]; }); }
function validatePlan(cells, kind) {
  for (const [x, y, z] of cells) {
    if (!inWorld(x, y, z)) return 'מחוץ לגבולות העולם';
    if (blocks.has(key(x, y, z))) return 'המקום תפוס';
    if (!inTerritory(x, z)) return 'מחוץ לשטח הממלכה';
  }
  if (kind === 'building') { const o = cells[0]; if (o && WATER[o[2] * WORLD + o[0]] && o[1] <= 0) return 'אי אפשר לבנות על המים'; }
  return null;
}
function foundation(cells, ch, mat) {
  const cols = new Map();
  for (const [x, y, z] of cells) { const k = z * WORLD + x; if (!cols.has(k) || cols.get(k)[1] > y) cols.set(k, [x, y, z]); }
  let n = 0;
  for (const [x, y, z] of cols.values()) for (let yy = y - 1, d = 0; yy >= 0 && d < 12; yy--, d++) {
    if (yy < H[z * WORLD + x] || blocks.has(key(x, yy, z))) break; recSet(ch, x, yy, z, mat); n++;
  }
  return n;
}
function recSet(ch, x, y, z, m) { if (!inWorld(x, y, z)) return; const k = key(x, y, z); const old = blocks.get(k); if (old === m) return; ch.push([k, old, m]); setBlock(x, y, z, m); }
function commit(ch, gold, extra = {}) {
  let added = 0, removed = 0;
  for (const [k, o, n] of ch) { if (o === undefined && n !== undefined && n >= 0) added++; else if (o !== undefined && (n === undefined || n < 0)) removed++; }
  for (const [k] of ch) { const [x, y, z] = unkey(k); const i = z * WORLD + x; if (y <= H[i] + 3 && propAt[i] >= 0 && props[propAt[i]].kind !== 'none') { if (blocks.has(k)) removeProp(i); } }
  flushBlocks();
  if (!extra.noStats) { state.stats.placed += added; state.stats.built += added - removed; }
  undoStack.push(Object.assign({ ch, gold, added: extra.noStats ? 0 : added, removed: extra.noStats ? 0 : removed }, extra));
  if (undoStack.length > 60) undoStack.shift();
  const g = Math.floor(state.stats.placed / 50); if (g > state.stats.grants) { const n = g - state.stats.grants; state.stats.grants = g; setTimeout(() => { addGold(30 * n); toast('מענק המלך על הבנייה: +' + 30 * n + ' זהב'); }, 250); }
  if (added) sfx('place'); else if (removed) sfx('erase');
}
function undo() {
  const u = undoStack.pop(); if (!u) { toast('אין פעולה לבטל'); return; }
  for (let i = u.ch.length - 1; i >= 0; i--) { const [k, o] = u.ch[i]; const [x, y, z] = unkey(k); setBlock(x, y, z, o === undefined ? -1 : o); }
  state.gold -= u.gold;
  if (u.bid) removeBuildingRecord(u.bid, false);
  if (u.restoreB) restoreBuildingRecord(u.restoreB);
  if (u.flag) removeFlagRec(u.flag);
  state.stats.placed -= u.added; state.stats.built -= u.added - u.removed;
  flushBlocks(); sfx('erase'); toast('הפעולה בוטלה');
}
function placeAt(hit, pointer) {
  if (!hit) return;
  const tool = sel.tool, td = toolDef(tool);
  if (tool === 'erase') return doErase(hit);
  if (tool === 'paint') return doPaint(hit);
  const c = cellAbove(hit);
  if (tool === 'place') {
    if (!inWorld(c.x, c.y, c.z)) return toast('מחוץ לגבולות העולם');
    if (!inTerritory(c.x, c.z)) return toastTerritory();
    if (blocks.has(key(c.x, c.y, c.z))) return;
    if (!spend(MATS[sel.mat].cost)) return;
    const ch = []; recSet(ch, c.x, c.y, c.z, sel.mat); commit(ch, -cost(MATS[sel.mat].cost)); return;
  }
  if (tool === 'pillar') {
    const ch = []; let n = 0;
    for (let y = c.y; y < c.y + 4 && y < MAXY; y++) { if (blocks.has(key(c.x, y, c.z))) break; n++; }
    if (!n) return; if (!inTerritory(c.x, c.z)) return toastTerritory();
    const price = n * MATS[sel.mat].cost; if (!spend(price)) return;
    for (let y = c.y; y < c.y + n; y++) recSet(ch, c.x, y, c.z, sel.mat);
    commit(ch, -cost(price)); return;
  }
  if (tool === 'flag') {
    if (!inTerritory(c.x, c.z)) return toastTerritory();
    if (!spend(20)) return;
    const f = { x: c.x, y: c.y, z: c.z }; addFlagRec(f); undoStack.push({ ch: [], gold: -cost(20), added: 0, removed: 0, flag: f }); sfx('place'); return;
  }
  if (td.two) {
    if (!sel.a) { sel.a = c; toast(tool === 'wall' ? 'בחרו את נקודת הסיום של החומה' : 'בחרו את הפינה הנגדית של הרצפה'); updateConfirm(); return; }
    const a = sel.a; sel.a = null; updateConfirm();
    const cells = tool === 'wall' ? wallCells(a, c) : floorCells(a, c);
    if (!cells.length) return toast('אין מקום פנוי לבנייה כאן');
    for (const [x, , z] of cells) if (!inTerritory(x, z)) return toastTerritory();
    const price = cells.reduce((s, q) => s + MATS[q[3]].cost, 0); if (!spend(price)) return;
    const ch = []; for (const [x, y, z, m] of cells) recSet(ch, x, y, z, m); commit(ch, -cost(price)); return;
  }
  if (td.prefab || tool === 'building') {
    const rot = autoRot(); const bp = blueprintFor(tool); const cells = planCells(bp, c, rot);
    const err = validatePlan(cells, tool); if (err) { toast(err === 'מחוץ לשטח הממלכה' ? 'אפשר לבנות רק בתוך שטח הממלכה. כבשו יעדים כדי להתרחב.' : err, 'warn'); sfx('error'); return; }
    if (pointer === 'touch' && !pending) { pending = { hit, tool }; updateConfirm(); updateGhostFromHit(hit); return; }
    if (tool === 'building') return doBuilding(sel.bld, c, rot, bp, cells);
    const price = cells.reduce((s, q) => s + MATS[q[3]].cost, 0); if (!spend(price)) return;
    const ch = []; foundation(cells, ch, sel.mat); for (const [x, y, z, m] of cells) recSet(ch, x, y, z, m);
    const extra = {};
    if (bp.decor.length) { for (const it of bp.decor) if (it.k === 'flag') { const [rx, rz] = ROT(it.x, it.z, rot); const f = { x: c.x + rx, y: c.y + it.y, z: c.z + rz, big: !!it.big }; addFlagRec(f); extra.flag = f; } }
    commit(ch, -cost(price), extra);
    toast(`${td.name} נבנה · ${fmt(price)} זהב`);
  }
}
const cost = n => (state.creative ? 0 : n);
function toastTerritory() { toast('אפשר לבנות רק בתוך שטח הממלכה (הקו הצבעוני). כבשו יעדים כדי להתרחב.', 'warn'); sfx('error'); }
function wallCells(a, b) {
  const out = []; let x0 = a.x, z0 = a.z; const x1 = b.x, z1 = b.z; const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0), sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1; let err = dx - dz, i = 0;
  const top = a.y + 3;
  while (i < 80) {
    for (let y = top; y >= 0; y--) { if (y < H[z0 * WORLD + x0] || blocks.has(key(x0, y, z0))) break; out.push([x0, y, z0, sel.mat]); }
    if (i % 2 === 0 && inWorld(x0, top + 1, z0) && !blocks.has(key(x0, top + 1, z0))) out.push([x0, top + 1, z0, sel.mat]);
    if (x0 === x1 && z0 === z1) break; const e2 = 2 * err; if (e2 > -dz) { err -= dz; x0 += sx; } if (e2 < dx) { err += dx; z0 += sz; } i++;
  }
  return out.filter(([x, y, z]) => inWorld(x, y, z));
}
function floorCells(a, b) {
  const out = []; const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
  if (x1 - x0 > 48 || z1 - z0 > 48) { toast('הרצפה גדולה מדי (עד 48 על 48)'); return []; }
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (inWorld(x, a.y, z) && !blocks.has(key(x, a.y, z)) && a.y >= H[z * WORLD + x]) out.push([x, a.y, z, sel.mat]);
  return out;
}
function doErase(hit) {
  if (!rayToBlock(hit)) { toast('בחרו בלוק כדי להרוס אותו'); return; }
  if (!inTerritory(hit.x, hit.z)) return toastTerritory();
  const k = key(hit.x, hit.y, hit.z); const bid = owner.get(k);
  if (bid) { const b = buildings.find(q => q.id === bid); if (b) return demolishBuilding(b); }
  const m = blocks.get(k); const ref = Math.floor(MATS[m].cost / 2);
  const ch = []; recSet(ch, hit.x, hit.y, hit.z, -1); if (ref && !state.creative) state.gold += ref; commit(ch, cost(ref));
}
function doPaint(hit) {
  if (!rayToBlock(hit)) return toast('בחרו בלוק כדי לצבוע אותו');
  if (!inTerritory(hit.x, hit.z)) return toastTerritory();
  const k = key(hit.x, hit.y, hit.z); if (blocks.get(k) === sel.mat) return;
  if (!spend(MATS[sel.mat].cost)) return; const ch = []; recSet(ch, hit.x, hit.y, hit.z, sel.mat); commit(ch, -cost(MATS[sel.mat].cost), { noStats: true }); sfx('place');
}
function doBuilding(type, c, rot, bp, cells) {
  const B = BUILDINGS[type]; if (!spend(B.cost)) return;
  const ch = []; foundation(cells, ch, type === 'farm' ? MI.dirt : MI.cobble);
  for (const [x, y, z, m] of cells) recSet(ch, x, y, z, m);
  for (const [x, , z] of cells) removeProp(z * WORLD + x);
  const rec = { id: state.nextBid++, type, x: c.x, y: c.y, z: c.z, rot };
  registerBuilding(rec);
  commit(ch, -cost(B.cost), { bid: rec.id });
  toast(`${B.name} נבנה · ${fmt(B.cost)} זהב`); refreshBuildUI(); refreshArmyUI();
}
function registerBuilding(rec) {
  const bp = BUILDING_BP[rec.type](); rec.cells = []; rec.decor = [];
  for (const [x, y, z] of planCells(bp, rec, rec.rot)) { const k = key(x, y, z); owner.set(k, rec.id); rec.cells.push(k); }
  for (const it of bp.decor) rec.decor.push(makeDecor(it, rec.x, rec.y, rec.z, rec.rot, 0));
  rec.cd = 0; rec.wx = rec.x + 0.5; rec.wz = rec.z + 0.5;
  buildings.push(rec);
}
function removeBuildingRecord(id, refund) {
  const i = buildings.findIndex(b => b.id === id); if (i < 0) return; const b = buildings[i];
  for (const k of b.cells) if (owner.get(k) === id) owner.delete(k);
  b.decor.forEach(removeObj); buildings.splice(i, 1); refreshBuildUI(); refreshArmyUI();
}
function restoreBuildingRecord(r) { registerBuilding({ id: r.id, type: r.type, x: r.x, y: r.y, z: r.z, rot: r.rot }); refreshBuildUI(); refreshArmyUI(); }
function demolishBuilding(b) {
  const ch = []; for (const k of b.cells) { if (blocks.has(k)) { const [x, y, z] = unkey(k); recSet(ch, x, y, z, -1); } }
  const ref = Math.floor(BUILDINGS[b.type].cost / 2); if (!state.creative) state.gold += ref;
  const r = { id: b.id, type: b.type, x: b.x, y: b.y, z: b.z, rot: b.rot };
  removeBuildingRecord(b.id, true); commit(ch, cost(ref), { restoreB: r });
  toast(`${BUILDINGS[b.type].name} נהרס · הוחזרו ${fmt(ref)} זהב`);
}
function addFlagRec(f) { state.flags.push(f); const o = makeDecor({ k: 'flag', x: 0, y: 0, z: 0, big: f.big }, f.x, f.y, f.z, 0, 0); f.obj = o; flagObjs.push(o); }
function removeFlagRec(f) { state.flags = state.flags.filter(q => q !== f); removeObj(f.obj); }

// ============================================================ קרן בחירה (DDA)
function rayCell(x, y, z) {
  if (x < 0 || z < 0 || x >= WORLD || z >= WORLD || y >= MAXY) return 0;
  if (y < 0) return 2; if (y < H[z * WORLD + x]) return 2;
  return blocks.has(key(x, y, z)) ? 1 : 0;
}
function voxelRay(o, d, maxT = 700) {
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = d.x > 0 ? 1 : -1, sy = d.y > 0 ? 1 : -1, sz = d.z > 0 ? 1 : -1;
  const tdx = d.x !== 0 ? Math.abs(1 / d.x) : Infinity, tdy = d.y !== 0 ? Math.abs(1 / d.y) : Infinity, tdz = d.z !== 0 ? Math.abs(1 / d.z) : Infinity;
  let tmx = d.x !== 0 ? (d.x > 0 ? x + 1 - o.x : o.x - x) * tdx : Infinity, tmy = d.y !== 0 ? (d.y > 0 ? y + 1 - o.y : o.y - y) * tdy : Infinity, tmz = d.z !== 0 ? (d.z > 0 ? z + 1 - o.z : o.z - z) * tdz : Infinity;
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < 1500; i++) {
    const c = rayCell(x, y, z); if (c) return { x, y, z, nx, ny, nz, kind: c };
    if (tmx < tmy && tmx < tmz) { if (tmx > maxT) break; x += sx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
    else if (tmy < tmz) { if (tmy > maxT) break; y += sy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
    else { if (tmz > maxT) break; z += sz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
    if (y < -2) break;
  }
  return null;
}
const raycaster = new T.Raycaster(), ndc = new T.Vector2();
function pick(sx, sy) {
  const r = canvas.getBoundingClientRect(); ndc.set(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera); return voxelRay(raycaster.ray.origin, raycaster.ray.direction);
}

// רוח רפאים לתצוגה מקדימה
const ghost = new T.Group();
const ghostFill = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0x7ee08a, transparent: true, opacity: 0.28, depthWrite: false }));
const ghostEdge = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1)), new T.LineBasicMaterial({ color: 0x7ee08a }));
ghost.add(ghostFill, ghostEdge); ghost.visible = false; scene.add(ghost);
const markA = new T.Mesh(new T.BoxGeometry(1.04, 1.04, 1.04), new T.MeshBasicMaterial({ color: 0xf0c050, transparent: true, opacity: 0.45, depthWrite: false })); markA.visible = false; scene.add(markA);
let pending = null, lastHover = null;
function setGhost(x0, y0, z0, x1, y1, z1, ok, col) {
  const c = col || (ok ? 0x7ee08a : 0xff6b5a); ghostFill.material.color.setHex(c); ghostEdge.material.color.setHex(c);
  ghost.position.set((x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2, (z0 + z1 + 1) / 2); ghost.scale.set(x1 - x0 + 1.02, y1 - y0 + 1.02, z1 - z0 + 1.02); ghost.visible = true;
}
function bbox(cells) { let a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (const q of cells) for (let i = 0; i < 3; i++) { a[i] = Math.min(a[i], q[i]); b[i] = Math.max(b[i], q[i]); } return [a, b]; }
function updateGhostFromHit(hit, sx, sy) {
  const tip = $('tip');
  if (mode !== 'build' || !hit || !state) { ghost.visible = false; show(tip, false); return; }
  const tool = sel.tool, td = toolDef(tool); let label = '', ok = true;
  if (tool === 'erase' || tool === 'paint') {
    if (hit.kind !== 1) { ghost.visible = false; show(tip, false); return; }
    const bid = owner.get(key(hit.x, hit.y, hit.z));
    if (bid && tool === 'erase') { const b = buildings.find(q => q.id === bid); if (b) { const [a, c] = bbox(b.cells.map(unkey)); setGhost(a[0], a[1], a[2], c[0], c[1], c[2], false, 0xff9a3c); label = `הריסת ${BUILDINGS[b.type].name} (+${fmt(BUILDINGS[b.type].cost / 2)})`; } }
    else { setGhost(hit.x, hit.y, hit.z, hit.x, hit.y, hit.z, true, tool === 'erase' ? 0xff9a3c : 0x7ec8ff); label = tool === 'erase' ? 'הריסה' : `צביעה ב${MATS[sel.mat].name}`; }
  } else {
    const c = cellAbove(hit);
    if (td.prefab || tool === 'building') {
      const cells = planCells(blueprintFor(tool), c, autoRot()); const err = validatePlan(cells, tool); ok = !err;
      const [a, b] = bbox(cells); setGhost(a[0], a[1], a[2], b[0], b[1], b[2], ok);
      const price = tool === 'building' ? BUILDINGS[sel.bld].cost : cells.reduce((s, q) => s + MATS[q[3]].cost, 0);
      label = err || `${tool === 'building' ? BUILDINGS[sel.bld].name : td.name} · ${fmt(price)} זהב`;
    } else if (td.two && sel.a) {
      const cells = tool === 'wall' ? wallCells(sel.a, c) : floorCells(sel.a, c);
      if (cells.length) { const [a, b] = bbox(cells); ok = cells.every(q => inTerritory(q[0], q[2])); setGhost(a[0], a[1], a[2], b[0], b[1], b[2], ok); label = `${td.name} · ${cells.length} בלוקים · ${fmt(cells.length * MATS[sel.mat].cost)} זהב`; }
    } else {
      ok = inWorld(c.x, c.y, c.z) && inTerritory(c.x, c.z);
      const hgt = tool === 'pillar' ? 3 : 0; setGhost(c.x, c.y, c.z, c.x, c.y + hgt, c.z, ok);
      label = ok ? `${MATS[sel.mat].name} · ${MATS[sel.mat].cost * (hgt + 1)}` : 'מחוץ לשטח הממלכה';
      if (tool === 'flag') label = ok ? 'דגל הממלכה · 20' : label;
    }
  }
  if (sx != null && !IS_TOUCH && label) { tip.textContent = label; tip.style.left = sx + 'px'; tip.style.top = sy + 'px'; tip.classList.toggle('bad', !ok); show(tip, true); } else show(tip, false);
}

// ============================================================ מצלמה וקלט
const cam = { tx: CX, ty: 3, tz: CZ, yaw: 0.7, pitch: 0.95, dist: 46 };
const keys = new Set();
const joy = { x: 0, y: 0, id: null };
const pointers = new Map(); let gesture = null;
function camVectors() { return { fx: -Math.sin(cam.yaw), fz: -Math.cos(cam.yaw), rx: Math.cos(cam.yaw), rz: -Math.sin(cam.yaw) }; }
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  ensureAudio(); canvas.focus({ preventScroll: true });
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
  if (pointers.size === 1) gesture = { type: 'pending', button: e.button, ptype: e.pointerType, shift: e.shiftKey };
  else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), a0: Math.atan2(b.y - a.y, b.x - a.x), dist0: cam.dist, yaw0: cam.yaw, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }
});
canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p) { if (e.pointerType === 'mouse' && gameActive && mode === 'build' && !pending) { lastHover = [e.clientX, e.clientY]; } return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (!gesture) return;
  if (gesture.type === 'pending' && Math.hypot(p.x - p.sx, p.y - p.sy) > (e.pointerType === 'mouse' ? 5 : 10)) {
    gesture.type = gesture.button === 2 || gesture.button === 1 || gesture.shift || mode === 'hero' || !gameActive ? 'rotate' : 'pan';
  }
  if (gesture.type === 'rotate') { cam.yaw -= dx * 0.0065; cam.pitch = clamp(cam.pitch + dy * 0.005, 0.25, 1.45); }
  else if (gesture.type === 'pan') { const v = camVectors(), k = cam.dist * 0.0021; cam.tx -= (v.rx * dx - v.fx * dy) * k; cam.tz -= (v.rz * dx - v.fz * dy) * k; }
  else if (gesture.type === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    cam.dist = clamp(gesture.dist0 * (gesture.d0 / Math.max(20, d)), mode === 'hero' ? 5 : 8, 150);
    cam.yaw = gesture.yaw0 + (ang - gesture.a0);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mdx = mx - gesture.mx, mdy = my - gesture.my; gesture.mx = mx; gesture.my = my;
    if (mode === 'build') { const v = camVectors(), k = cam.dist * 0.0021; cam.tx -= (v.rx * mdx - v.fx * mdy) * k; cam.tz -= (v.rz * mdx - v.fz * mdy) * k; }
    else cam.pitch = clamp(cam.pitch + mdy * 0.004, 0.25, 1.45);
  }
});
function endPointer(e) {
  const p = pointers.get(e.pointerId); if (!p) return;
  if (gesture && gesture.type === 'pending' && pointers.size === 1 && gameActive) tap(e.clientX, e.clientY, gesture.button, gesture.ptype, gesture.shift);
  pointers.delete(e.pointerId);
  if (pointers.size === 0) gesture = null; else if (gesture && gesture.type === 'pinch') gesture = { type: 'none' };
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); if (!pointers.size) gesture = null; });
canvas.addEventListener('pointerleave', () => { if (!pointers.size) { lastHover = null; ghost.visible = false; show('tip', false); } });
canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), mode === 'hero' ? 5 : 8, 150); }, { passive: false });
function tap(sx, sy, button, ptype, shift) {
  if (mode === 'build') {
    if (pending) { pending = null; updateConfirm(); }
    const hit = pick(sx, sy);
    if (button === 2 && sel.tool !== 'erase') { const t = sel.tool; sel.tool = 'erase'; doErase(hit); sel.tool = t; return; }
    placeAt(hit, ptype);
    if (ptype === 'mouse') updateGhostFromHit(pick(sx, sy), sx, sy);
  } else if (hero && !hero.dead) {
    let best = null, bd = 44 * 44; const v = new T.Vector3(), r = canvas.getBoundingClientRect();
    for (const u of units) { if (u.dead || u.team !== 1) continue; v.set(u.x, u.y + 1, u.z).project(camera); if (v.z > 1) continue; const px = (v.x + 1) / 2 * r.width + r.left, py = (1 - v.y) / 2 * r.height + r.top; const d = (px - sx) ** 2 + (py - sy) ** 2; if (d < bd) { bd = d; best = u; } }
    if (best) { hero.target = best; hero.moveTarget = null; return; }
    const hit = pick(sx, sy); if (hit) { const c = cellAbove(hit); hero.moveTarget = { x: c.x + 0.5, z: c.z + 0.5 }; hero.target = null; spawnMarker(c.x + 0.5, c.y, c.z + 0.5); }
  }
}
function spawnMarker(x, y, z) {
  const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xf0c050, transparent: true, opacity: 0.9, depthWrite: false })); m.position.set(x, y + 0.05, z); world.add(m);
  effects.push({ m, t: 0, dur: 0.6, kind: 'ring' });
}
const isTyping = () => document.activeElement && document.activeElement.tagName === 'INPUT';
window.addEventListener('keydown', e => {
  if (isTyping()) return; ensureAudio();
  const k = e.key.toLowerCase(); keys.add(e.code);
  if (!gameActive) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); undo(); return; }
  if (modalOpen) { if (e.code === 'Escape') closeModal(); return; }
  if (e.code === 'KeyB') setMode('build');
  else if (e.code === 'KeyH') setMode('hero');
  else if (e.code === 'Escape') { sel.a = null; pending = null; updateConfirm(); }
  else if (e.code === 'KeyR') { sel.rot = (sel.rot + 1) % 4; if (lastHover) updateGhostFromHit(pick(...lastHover), ...lastHover); }
  else if (e.code === 'KeyZ' && mode === 'build') undo();
  else if (mode === 'hero' && (e.code === 'Space' || e.code === 'KeyF')) heroStrike();
  else if (mode === 'hero' && e.code === 'KeyG') heroCleave();
  else if (mode === 'build' && /^Digit[1-9]$/.test(e.code)) { const t = TOOLS[+e.code.slice(5) - 1]; if (t) selectTool(t.id); }
  else if (e.code === 'KeyM') { $('mmwrap').classList.toggle('hidden-ui'); }
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const joyEl = $('joy'), knob = $('joy-knob');
joyEl.addEventListener('pointerdown', e => { e.stopPropagation(); joy.id = e.pointerId; try { joyEl.setPointerCapture(e.pointerId); } catch (_) {} joyMove(e); ensureAudio(); });
joyEl.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyMove(e); });
const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
function joyMove(e) {
  const r = joyEl.getBoundingClientRect(), R = r.width / 2; let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const d = Math.hypot(dx, dy), max = R - 14;
  if (d > max) { dx *= max / d; dy *= max / d; } joy.x = dx / max; joy.y = dy / max; knob.style.transform = `translate(${dx}px,${dy}px)`;
}

function updateCamera(dt) {
  const v = camVectors();
  if (gameActive && mode === 'hero' && hero) {
    const k = 1 - Math.exp(-dt * 8); cam.tx = lerp(cam.tx, hero.x, k); cam.tz = lerp(cam.tz, hero.z, k); cam.ty = lerp(cam.ty, hero.y + 1, k);
    if (keys.has('KeyQ')) cam.yaw += dt * 1.8; if (keys.has('KeyE')) cam.yaw -= dt * 1.8;
  } else if (gameActive) {
    const sp = cam.dist * 0.9 * dt * (keys.has('ShiftLeft') ? 2 : 1); let mx = 0, mz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1; if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    cam.tx += (v.fx * mz + v.rx * mx) * sp; cam.tz += (v.fz * mz + v.rz * mx) * sp;
    if (keys.has('KeyQ')) cam.yaw += dt * 1.6; if (keys.has('KeyE')) cam.yaw -= dt * 1.6;
    if (keys.has('Equal') || keys.has('NumpadAdd')) cam.dist = Math.max(8, cam.dist * (1 - dt)); if (keys.has('Minus') || keys.has('NumpadSubtract')) cam.dist = Math.min(150, cam.dist * (1 + dt));
    const gx = clamp(Math.floor(cam.tx), 0, WORLD - 1), gz = clamp(Math.floor(cam.tz), 0, WORLD - 1);
    cam.ty = lerp(cam.ty, Math.max(1, H[gz * WORLD + gx]), 1 - Math.exp(-dt * 4));
  } else { cam.yaw += dt * 0.05; }
  cam.tx = clamp(cam.tx, 0, WORLD); cam.tz = clamp(cam.tz, 0, WORLD);
  const cp = Math.cos(cam.pitch);
  camera.position.set(cam.tx + Math.sin(cam.yaw) * cp * cam.dist, cam.ty + Math.sin(cam.pitch) * cam.dist, cam.tz + Math.cos(cam.yaw) * cp * cam.dist);
  const gx = clamp(Math.floor(camera.position.x), 0, WORLD - 1), gz = clamp(Math.floor(camera.position.z), 0, WORLD - 1);
  camera.position.y = Math.max(camera.position.y, H[gz * WORLD + gx] + 1.6);
  camera.lookAt(cam.tx, cam.ty + (mode === 'hero' && gameActive ? 1 : 0), cam.tz);
  sun.position.set(cam.tx + 45, cam.ty + 80, cam.tz + 30); sun.target.position.set(cam.tx, cam.ty, cam.tz);
  sky.position.copy(camera.position);
  // חיתוך גגות כשהגיבור בפנים
  let clip = 1e6;
  if (gameActive && mode === 'hero' && hero && !hero.dead) {
    const x = Math.floor(hero.x), z = Math.floor(hero.z), fy = Math.round(hero.y);
    for (let y = fy + 2; y < Math.min(MAXY, fy + 14); y++) if (blocks.has(key(x, y, z))) { clip = fy + 2.4; break; }
  }
  clipPlane.constant = clip;
}

// ============================================================ גיבור
let cleaveCd = 0;
function heroControl(u, dt) {
  let ix = 0, iz = 0, moving = false;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1; if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  ix += joy.x; iz -= joy.y;
  const len = Math.hypot(ix, iz);
  if (len > 0.12) {
    u.moveTarget = null; if (u.target && dist2(u.x, u.z, u.target.x, u.target.z) > 9) u.target = null;
    const v = camVectors(), n = Math.min(1, len);
    const dx = (v.fx * iz + v.rx * ix) / len, dz = (v.fz * iz + v.rz * ix) / len;
    const sp = u.def.speed * n * (keys.has('ShiftLeft') ? 1.35 : 1) * dt;
    u.rot = turnTo(u.rot, Math.atan2(dx, dz), dt * 14); moving = moveDir(u, dx * sp, dz * sp);
  } else if (u.target && !u.target.dead) {
    const t = u.target, d = Math.sqrt(dist2(u.x, u.z, t.x, t.z));
    if (d > u.def.range) moving = steer(u, t.x, t.z, dt); else { face(u, t); if (u.cd <= 0) attack(u, t); }
    return moving;
  } else if (u.moveTarget) {
    if (dist2(u.x, u.z, u.moveTarget.x, u.moveTarget.z) < 0.25) u.moveTarget = null; else moving = steer(u, u.moveTarget.x, u.moveTarget.z, dt);
  }
  if (u.target && u.target.dead) u.target = null;
  if (u.cd <= 0) { const f = nearestFoe(u, u.def.range + 0.2); if (f) { face(u, f); attack(u, f); } }
  return moving;
}
function heroStrike() {
  if (!hero || hero.dead) return;
  const f = nearestFoe(hero, 7); if (f) { hero.target = f; hero.moveTarget = null; return; }
  const x = Math.floor(hero.x), z = Math.floor(hero.z); let best = -1, bd = 1e9;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const t = (z + dz) * WORLD + x + dx; if (t < 0 || t >= WORLD * WORLD) continue; const pi = propAt[t]; if (pi >= 0 && props[pi].kind === 'tree') { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = t; } } }
  hero.atkT = 0.3;
  if (best >= 0) { const tx = (best % WORLD) + 0.5, tz = Math.floor(best / WORLD) + 0.5; face(hero, { x: tx, z: tz }); removeProp(best); state.stats.chops++; sfx('chop'); addGold(4, { x: tx, y: H[best] + 1.5, z: tz }); }
  else sfx('bow');
}
function heroCleave() {
  if (!hero || hero.dead || cleaveCd > 0) return; cleaveCd = 8; hero.atkT = 0.3;
  let n = 0; for (const o of units) if (!o.dead && o.team === 1 && dist2(o.x, o.z, hero.x, hero.z) < 3.4 * 3.4) { damage(o, hero.def.atk * 2.4, hero); n++; }
  const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.9, depthWrite: false })); m.position.set(hero.x, hero.y + 0.1, hero.z); world.add(m);
  effects.push({ m, t: 0, dur: 0.45, kind: 'wave' }); sfx('hit'); sfx('horn');
}

// ============================================================ עדכון דמויות
function updateUnits(dt) {
  const allies = units.filter(u => u.team === 0 && u !== hero && !u.dead); allies.forEach((u, i) => (u.slot = i));
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i]; if (!u) continue;
    if (u.dead) {
      u.deadT += dt; u.mesh.rotation.z = Math.min(1.5, u.deadT * 4) * u.side; u.mesh.position.y = u.y - Math.min(0.3, u.deadT * 0.3);
      if (u === hero) { if (u.deadT > 5) respawnHero(); } else if (u.deadT > 2.2) removeUnit(u);
      continue;
    }
    u.cd -= dt; u.think -= dt; if (u.think <= 0) { u.think = 0.3 + Math.random() * 0.2; think(u); }
    let moving = false;
    if (u === hero) moving = heroControl(u, dt);
    else if (u.target && !u.target.dead) {
      const t = u.target, d = Math.sqrt(dist2(u.x, u.z, t.x, t.z)), rng = u.def.range + (t.def.mounted ? 0.3 : 0);
      if (d > rng) moving = steer(u, t.x, t.z, dt); else { face(u, t); if (u.cd <= 0) attack(u, t); }
    } else if (u.goal) {
      const d2 = dist2(u.x, u.z, u.goal.x, u.goal.z);
      if (d2 > (u.team === 0 ? 0.6 : 1.5)) moving = steer(u, u.goal.x, u.goal.z, dt, d2 > 36 ? (u.team === 0 ? 1.25 : 1) : Math.min(1, Math.sqrt(d2) / 2 + 0.4));
      else if (u.team === 0 && hero && army.order !== 'hold') u.rot = turnTo(u.rot, hero.rot, dt * 3);
      if (u.team === 0 && army.order === 'follow' && d2 > 60 * 60 && hero && !hero.dead) { const p = findFree(hero.x, hero.z, 0); u.x = p.x; u.z = p.z; u.y = p.y; }
    }
    if (u.raid && !u.target && dist2(u.x, u.z, CX, CZ) < 12 * 12) { u.lootT += dt; if (u.lootT > 1) { u.lootT = 0; if (state.gold > 0) { state.gold = Math.max(0, state.gold - 4); raidLooting = 1.5; } } }
    // התנגשות בין דמויות
    for (let j = 0; j < units.length; j++) {
      const o = units[j]; if (o === u || o.dead) continue; const dx = u.x - o.x, dz = u.z - o.z, d2 = dx * dx + dz * dz; const rr = (u.def.mounted || o.def.mounted) ? 1.0 : 0.62;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), push = (rr - d) * 0.5; moveDir(u, (dx / d) * push, (dz / d) * push); }
    }
    const f = floorAt(u.x, u.z, u.y, u.team);
    if (f > u.y) u.y = Math.min(f, u.y + dt * 9); else if (f < u.y) u.y = Math.max(f, u.y - dt * 14);
    // הנפשה
    u.anim += dt * (moving ? u.def.speed * 2.4 : 0);
    const bob = moving ? Math.abs(Math.sin(u.anim)) * (u.def.mounted ? 0.12 : 0.07) : 0;
    u.mesh.position.set(u.x, u.y + bob, u.z); u.mesh.rotation.y = u.rot; u.mesh.rotation.z = moving ? Math.sin(u.anim) * 0.04 : 0;
    if (u.atkT > 0) { u.atkT -= dt; const s = Math.sin((1 - Math.max(0, u.atkT) / 0.3) * Math.PI); if (u.md.lance) u.piv.position.z = u.md.pivot[2] + s * 0.6; else u.piv.rotation.x = u.md.rest + s * 1.3; }
    else { u.piv.rotation.x = u.md.rest; u.piv.position.z = u.md.pivot[2]; }
    if (u.hitT > 0) { u.hitT -= dt; u.mesh.scale.setScalar((u.def.scale || 1) * (1 + u.hitT * 0.6)); } else u.mesh.scale.setScalar(u.def.scale || 1);
    if (u.hp < u.maxHp) {
      const hb = ensureHpBar(u); hb.visible = true; hb.position.set(u.x, u.y + u.md.height * (u.def.scale || 1) + 0.35, u.z); hb.quaternion.copy(camera.quaternion);
      hb.userData.fg.scale.x = Math.max(0, u.hp / u.maxHp);
      if (u.team === 0 && u.hp < u.maxHp && !u.target) u.hp = Math.min(u.maxHp, u.hp + dt * 2);
    } else if (u.hpbar) u.hpbar.visible = false;
  }
}
function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i]; a.t += dt; const k = Math.min(1, a.t / a.dur);
    const p = (q) => [lerp(a.sx, a.tx, q), lerp(a.sy, a.ty, q) + Math.sin(q * Math.PI) * a.arc, lerp(a.sz, a.tz, q)];
    const [x, y, z] = p(k), [x2, y2, z2] = p(Math.min(1.02, k + 0.03)); a.m.position.set(x, y, z); a.m.lookAt(x2, y2, z2);
    if (k >= 1) {
      if (a.tgt && !a.tgt.dead && dist2(a.tgt.x, a.tgt.z, a.tx, a.tz) < 4) damage(a.tgt, a.dmg, a.src);
      world.remove(a.m); arrows.splice(i, 1);
    }
  }
}
function updateEffects(dt, t) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i]; e.t += dt; const k = e.t / e.dur;
    if (e.kind === 'wave') e.m.scale.setScalar(1 + k * 5); else e.m.scale.setScalar(1 + k * 0.8);
    e.m.material.opacity = 0.9 * (1 - k);
    if (k >= 1) { world.remove(e.m); e.m.material.dispose(); effects.splice(i, 1); }
  }
  for (const f of fires) { const ph = f.userData.ph; f.scale.set(1 + Math.sin(t * 13 + ph) * 0.12, 1 + Math.sin(t * 9 + ph) * 0.2, 1 + Math.cos(t * 11 + ph) * 0.12); }
  for (const c of clouds.children) { c.position.x += c.userData.v * dt; if (c.position.x > 430) c.position.x = -170; }
}
function updateTowers(dt) {
  for (const b of buildings) {
    if (b.type !== 'tower') continue; b.cd -= dt; if (b.cd > 0) continue;
    const pseudo = { x: b.wx, z: b.wz, team: 0 }; const f = nearestFoe(pseudo, 16);
    if (f) { b.cd = 1.4; shootArrow(b.wx, b.y + 8.4, b.wz, f, 13, null); } else b.cd = 0.4;
  }
}

// ============================================================ פשיטות, מסים ומשימות
let raidLooting = 0, incomeT = 0, questT = 0, saveT = 0;
function updateRaids(dt) {
  raidLooting = Math.max(0, raidLooting - dt);
  const raiders = units.filter(u => u.raid && !u.dead).length;
  const rb = $('raidbar');
  if (raiders) { rb.textContent = raidLooting > 0 ? `פושטים בוזזים את הבירה! (${raiders})` : `פשיטת אויב בדרך לבירה · ${raiders} לוחמים`; show(rb, true); } else show(rb, false);
  if (state.time < state.raid.next) return;
  if (state.stats.built < 60 && buildings.length < 2) { state.raid.next = state.time + 60; return; }
  const lvl = state.raid.level, size = Math.min(22, 4 + lvl * 2);
  let sx = CX, sz = CZ;
  for (let t = 0; t < 200; t++) { const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 25, x = Math.floor(CX + Math.cos(a) * d), z = Math.floor(CZ + Math.sin(a) * d); if (x < 12 || z < 12 || x > WORLD - 12 || z > WORLD - 12) continue; const i = z * WORLD + x; if (WATER[i] || H[i] > 9) continue; sx = x; sz = z; break; }
  for (let i = 0; i < size; i++) {
    const r = Math.random(); const type = lvl >= 3 && r < 0.15 ? 'eknight' : lvl >= 1 && r < 0.5 ? 'soldier' : r < 0.75 ? 'bandit' : 'banditArcher';
    spawnUnit(type, 1, sx + (Math.random() - 0.5) * 6, sz + (Math.random() - 0.5) * 6, { raid: true });
  }
  state.raid.level++; state.raid.next = state.time + Math.max(200, 330 - lvl * 15);
  toast(`פשיטה! ${size} לוחמי אויב צועדים לעבר הבירה. הגנו עליה!`, 'warn'); sfx('horn');
}
const QUESTS = [
  { t: 'בנו 20 בלוקים בבירה', v: () => state.stats.placed, n: 20, reward: 100 },
  { t: 'בנו קסרקטין (כלי "מבנים")', v: () => countB('barracks'), n: 1, reward: 150 },
  { t: 'גייסו 3 חיילים (מצב גיבור וצבא)', v: () => state.stats.recruited, n: 3, reward: 120 },
  { t: 'כבשו מאהל שודדים', v: () => state.stats.conq.bandit, n: 1, reward: 200 },
  { t: 'בנו חווה ושוק', v: () => Math.min(1, countB('farm')) + Math.min(1, countB('market')), n: 2, reward: 200 },
  { t: 'הקימו טירה: 400 בלוקים', v: () => state.stats.placed, n: 400, reward: 400 },
  { t: 'כבשו מבצר', v: () => state.stats.conq.fort, n: 1, reward: 500 },
  { t: 'צבא של 15 לוחמים', v: () => allyCount(), n: 15, reward: 400 },
  { t: 'כבשו טירת אויב', v: () => state.stats.conq.castle, n: 1, reward: 1200 },
  { t: 'כבשו את כל היעדים בארץ', v: () => camps.filter(c => c.owner === 0).length, n: () => camps.length, reward: 5000 },
];
function updateQuest() {
  const q = QUESTS[state.quest], el = $('quest');
  if (!q) { el.innerHTML = '<div class="qh">כל המשימות הושלמו</div>הארץ כולה שלכם. המשיכו לבנות את הממלכה.'; return; }
  const n = typeof q.n === 'function' ? q.n() : q.n, v = Math.min(n, q.v());
  if (v >= n) { state.quest++; addGold(q.reward); toast(`משימה הושלמה: ${q.t} · +${fmt(q.reward)} זהב`, 'big'); sfx('fanfare'); return updateQuest(); }
  el.innerHTML = `<div class="qh">משימה ${state.quest + 1} מתוך ${QUESTS.length} · פרס ${fmt(q.reward)}</div>${q.t} <b>(${fmt(v)}/${fmt(n)})</b><div class="qb"><i style="width:${(v / n) * 100}%"></i></div>`;
}

// ============================================================ שמירה וטעינה
function serialize() {
  const arr = new Array(blocks.size * 2); let i = 0; for (const [k, m] of blocks) { arr[i++] = k; arr[i++] = m; }
  return {
    v: 1, seed: state.seed, kingdom: state.kingdom, gold: Math.floor(state.gold), time: Math.floor(state.time), creative: state.creative, stats: state.stats, quest: state.quest, raid: state.raid, order: army.order, nextBid: state.nextBid,
    blocks: arr, buildings: buildings.map(b => [b.id, b.type, b.x, b.y, b.z, b.rot]), flags: state.flags.map(f => [f.x, f.y, f.z, f.big ? 1 : 0]), camps: camps.map(c => c.owner), chopped: state.chopped,
    allies: units.filter(u => !u.dead && u.team === 0 && u !== hero).map(u => [u.type, Math.round(u.x * 10) / 10, Math.round(u.z * 10) / 10]), hero: hero ? [hero.x, hero.z] : null,
  };
}
function saveGame(manual) {
  if (!state || !gameActive) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); if (manual) toast('המשחק נשמר בדפדפן הזה'); }
  catch (e) { if (manual) toast('לא ניתן לשמור בדפדפן הזה (ייתכן שזה מצב פרטי)', 'warn'); }
}
function readSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

// ============================================================ בניית העולם / איפוס
let worldSeed = null, worldPristine = false, worldBare = false;
let mmBase = null, mmDirtyCols = new Set();
function resetWorld() {
  for (const u of units) { world.remove(u.mesh); if (u.hpbar) world.remove(u.hpbar); }
  world.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  world.clear(); units = []; arrows = []; effects = []; hero = null; cloths = []; fires = []; buildings = []; flagObjs = []; undoStack = []; camps = []; terrLines = null;
  blocks.clear(); owner.clear(); matKeys.forEach(s => s.clear()); dirtyMats.clear(); blockMeshes = [];
  propAt.fill(-1); props = []; mmDirtyCols.clear();
  for (const k in flagMats) delete flagMats[k];
}
function genWorld(seed, placeCampBlocks) {
  resetWorld(); worldSeed = seed;
  genTerrain(seed); genCamps(seed); computeTileColors(seed); buildTerrain(); genProps(seed);
  for (const c of camps) buildCamp(c, placeCampBlocks);
  flushBlocks(); buildMinimapBase();
}
function buildMinimapBase() {
  mmBase = document.createElement('canvas'); mmBase.width = mmBase.height = WORLD; const g = mmBase.getContext('2d'); const img = g.createImageData(WORLD, WORLD);
  for (let i = 0; i < WORLD * WORLD; i++) {
    const w = WATER[i], f = 1 + (H[i] - 3) * 0.035;
    img.data[i * 4] = w ? 54 : clamp(tileCol[i * 3] * 255 * f, 0, 255); img.data[i * 4 + 1] = w ? 102 : clamp(tileCol[i * 3 + 1] * 255 * f, 0, 255); img.data[i * 4 + 2] = w ? 140 : clamp(tileCol[i * 3 + 2] * 255 * f, 0, 255); img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (const k of blocks.keys()) { const [x, , z] = unkey(k); mmDirtyCols.add(z * WORLD + x); }
  flushMinimapCols();
}
function flushMinimapCols() {
  if (!mmBase || !mmDirtyCols.size) return; const g = mmBase.getContext('2d');
  for (const i of mmDirtyCols) {
    const x = i % WORLD, z = (i - x) / WORLD; let top = -1;
    for (let y = MAXY - 1; y >= 0; y--) { const m = blocks.get(key(x, y, z)); if (m !== undefined) { top = m; break; } }
    if (top >= 0) g.fillStyle = MATS[top].c1; else { const w = WATER[i]; g.fillStyle = w ? 'rgb(54,102,140)' : `rgb(${tileCol[i * 3] * 255 | 0},${tileCol[i * 3 + 1] * 255 | 0},${tileCol[i * 3 + 2] * 255 | 0})`; }
    g.fillRect(x, z, 1, 1);
  }
  mmDirtyCols.clear();
}
function spawnGarrison(c) {
  const r = mulberry(c.id * 977 + worldSeed);
  for (const [type, n] of CAMPS[c.kind].garrison) for (let i = 0; i < n; i++) {
    let x, z;
    if (c.kind === 'castle') { do { x = (r() - 0.5) * 18; z = (r() - 0.5) * 18; } while (Math.max(Math.abs(x), Math.abs(z)) < 5); }
    else { x = (r() - 0.5) * 9; z = (r() - 0.5) * 9; }
    spawnUnit(type, 1, c.x + 0.5 + x, c.z + 0.5 + z, { campId: c.id });
  }
}
function startGame(st, save) {
  const reuse = save ? worldBare && worldSeed === st.seed : worldPristine && worldSeed === st.seed;
  if (!reuse) genWorld(st.seed, !save);
  worldPristine = false; worldBare = false;
  state = st; for (const k in flagMats) delete flagMats[k];
  for (const k of Object.keys(modelCache)) if (k.endsWith('_0')) delete modelCache[k];
  for (const c of camps) if (c.flag) setFlagTeam(c.flag, c.owner);
  if (save) {
    for (let i = 0; i < save.blocks.length; i += 2) { const [x, y, z] = unkey(save.blocks[i]); setBlock(x, y, z, save.blocks[i + 1]); }
    flushBlocks();
    for (const [id, type, x, y, z, rot] of save.buildings || []) if (BUILDINGS[type]) registerBuilding({ id, type, x, y, z, rot });
    const fl = save.flags || []; state.flags = []; for (const [x, y, z, big] of fl) addFlagRec({ x, y, z, big: !!big });
    (save.camps || []).forEach((o, i) => { if (camps[i]) { camps[i].owner = o; if (camps[i].flag) setFlagTeam(camps[i].flag, o); } });
    const ch = state.chopped; state.chopped = []; for (const t of ch) removeProp(t);
    army.order = save.order || 'follow';
    for (const k of blocks.keys()) { const [x, , z] = unkey(k); mmDirtyCols.add(z * WORLD + x); }
  } else {
    addFlagRec({ x: CX, y: H[CZ * WORLD + CX], z: CZ, big: true }); army.order = 'follow';
  }
  for (const c of camps) if (c.owner === 1) spawnGarrison(c);
  const hp = save && save.hero ? save.hero : [CX + 0.5, CZ + 3.5];
  hero = spawnUnit('hero', 0, hp[0], hp[1], { rot: Math.PI });
  if (save) for (const [type, x, z] of save.allies || []) { if (UNIT[type]) spawnUnit(type, 0, x, z); }
  else { spawnUnit('sword', 0, CX - 1, CZ + 6); spawnUnit('sword', 0, CX + 2, CZ + 6); spawnUnit('archer', 0, CX + 0.5, CZ + 7.5); }
  rebuildTerritory(); refreshHudBanner(); flushMinimapCols();
  cam.tx = hero.x; cam.tz = hero.z; cam.ty = hero.y; cam.dist = 42; cam.pitch = 0.95; cam.yaw = 0.6;
  gameActive = true; show('hud', true); show('scr-title', false); show('scr-create', false);
  setMode('build'); refreshBuildUI(); refreshArmyUI(); updateQuest(); updateHud(true);
  if (!save) setTimeout(() => openHelp(true), 400);
  else toast(`ברוכים השבים ל${state.kingdom.name}`, 'big');
}

// ============================================================ צלילים
let actx = null, muted = pref('muted') === '1'; const sfxLast = {};
function ensureAudio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} }
function tone(f, d, type = 'sine', v = 0.12, f2) {
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + d); o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
}
let noiseBuf = null;
function noise(d, v, freq) {
  if (!noiseBuf) { noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.5, actx.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
  const t = actx.currentTime, s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain(); s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + d); s.connect(f).connect(g).connect(actx.destination); s.start(t); s.stop(t + d + 0.02);
}
const SFX = {
  place() { noise(0.08, 0.3, 700); tone(130, 0.09, 'triangle', 0.12, 80); }, erase() { noise(0.14, 0.25, 1800); },
  coin() { tone(988, 0.07, 'square', 0.035); setTimeout(() => actx && tone(1319, 0.12, 'square', 0.035), 60); },
  hit() { noise(0.06, 0.18, 3200); tone(300, 0.05, 'sawtooth', 0.035, 160); }, bow() { tone(520, 0.1, 'triangle', 0.05, 180); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => actx && tone(f, 0.24, 'square', 0.05), i * 130)); },
  error() { tone(180, 0.15, 'square', 0.05, 120); }, recruit() { tone(392, 0.1, 'triangle', 0.08); setTimeout(() => actx && tone(523, 0.15, 'triangle', 0.08), 90); },
  horn() { tone(196, 0.7, 'sawtooth', 0.06, 185); }, chop() { noise(0.05, 0.35, 1100); tone(220, 0.07, 'triangle', 0.1, 150); },
};
function sfx(n) { if (muted || !actx) return; const now = performance.now(); if (sfxLast[n] && now - sfxLast[n] < 45) return; sfxLast[n] = now; try { SFX[n](); } catch (e) {} }

// ============================================================ ממשק
let gameActive = false, modalOpen = false;
function toast(msg, kind) {
  const box = $('toasts'); const el = document.createElement('div'); el.className = 'toast' + (kind ? ' ' + kind : ''); el.textContent = msg; box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 420); }, kind === 'big' ? 3800 : 2800);
}
const _pv = new T.Vector3();
function popGold(txt, at) {
  let x, y;
  if (at && at.x != null) { _pv.set(at.x, (at.y || 0) + 2, at.z).project(camera); const r = canvas.getBoundingClientRect(); x = (_pv.x + 1) / 2 * r.width; y = (1 - _pv.y) / 2 * r.height; if (_pv.z > 1) return; }
  else { const g = $('st-gold').getBoundingClientRect(); x = g.left + g.width / 2; y = g.bottom + 14; }
  const el = document.createElement('div'); el.className = 'pop' + (txt[0] === '-' ? ' neg' : ''); el.textContent = txt; el.style.left = x + 'px'; el.style.top = y + 'px'; $('hud').appendChild(el);
  setTimeout(() => el.remove(), 1150);
}
function measureUI() {
  const tb = $('topbar'), dk = $('dock'); if (tb) root.style.setProperty('--topH', tb.offsetHeight + 'px'); if (dk) root.style.setProperty('--dockH', dk.offsetHeight + 'px');
}
function setMode(m) {
  mode = m; sel.a = null; pending = null; updateConfirm(); ghost.visible = false; show('tip', false);
  document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  show('pn-build', m === 'build'); show('pn-hero', m === 'hero');
  show('joy', m === 'hero' && IS_TOUCH); show('acts', m === 'hero'); show('herobar', m === 'hero');
  if (terrLines) terrLines.visible = m === 'build';
  if (m === 'hero') { cam.dist = 15; cam.pitch = 0.62; if (hero) cam.yaw = hero.rot + Math.PI; }
  else { cam.dist = Math.max(cam.dist, 34); cam.pitch = 0.95; }
  requestAnimationFrame(measureUI);
}
document.querySelectorAll('#modes button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
function selectTool(id) {
  sel.tool = id; sel.a = null; pending = null; updateConfirm(); refreshBuildUI();
  const hints = { wall: 'לחצו על נקודת התחלה ואז על נקודת סיום', floor: 'לחצו על שתי פינות נגדיות', erase: 'לחצו על בלוק או מבנה כדי להרוס (מחזיר חצי מהמחיר)', building: 'בחרו מבנה ולחצו על הקרקע כדי להציב' };
  if (hints[id]) toast(hints[id]);
}
function refreshBuildUI() {
  const tr = $('row-tools'), keepT = tr.scrollLeft, keepS = $('row-sub').scrollLeft, sameSub = refreshBuildUI.last === sel.tool; refreshBuildUI.last = sel.tool; tr.innerHTML = '';
  for (const t of TOOLS) { const b = document.createElement('button'); b.className = 'tool' + (sel.tool === t.id ? ' on' : ''); b.innerHTML = icon(t.icon) + t.name; b.onclick = () => selectTool(t.id); tr.appendChild(b); }
  const sp = document.createElement('div'); sp.className = 'sep'; tr.appendChild(sp);
  const rb = document.createElement('button'); rb.className = 'tool act'; rb.innerHTML = icon('rotate') + 'סיבוב'; rb.onclick = () => { sel.rot = (sel.rot + 1) % 4; if (pending) updateGhostFromHit(pending.hit); toast('המבנה סובב ב־90°'); }; tr.appendChild(rb);
  const ub = document.createElement('button'); ub.className = 'tool act'; ub.innerHTML = icon('undo') + 'ביטול'; ub.onclick = undo; tr.appendChild(ub);
  const sr = $('row-sub'); sr.innerHTML = '';
  if (sel.tool === 'building') {
    for (const [id, B] of Object.entries(BUILDINGS)) { const b = document.createElement('button'); b.className = 'bcard' + (sel.bld === id ? ' on' : ''); const have = countB(id); b.innerHTML = `<b>${B.name}${have ? ` · ${have}` : ''}</b><span class="c">${fmt(B.cost)} זהב</span><small>${B.desc}</small>`; b.onclick = () => { sel.bld = id; refreshBuildUI(); }; sr.appendChild(b); }
  } else if (sel.tool === 'erase') { sr.innerHTML = '<div class="info">הריסת בלוק מחזירה חצי מהמחיר. במחשב: קליק ימני הורס בכל כלי.</div>'; }
  else if (sel.tool === 'flag') { sr.innerHTML = '<div class="info">הציבו את דגל הממלכה שלכם בכל מקום בשטח שלכם · 20 זהב</div>'; }
  else {
    MATS.forEach((m, i) => { const b = document.createElement('button'); b.className = 'mat' + (sel.mat === i ? ' on' : ''); b.innerHTML = `<img src="${matSwatch[i]}" alt="">${m.name}<span class="c">${m.cost}</span>`; b.onclick = () => { sel.mat = i; refreshBuildUI(); }; sr.appendChild(b); });
  }
  tr.scrollLeft = keepT; if (sameSub) sr.scrollLeft = keepS;
  requestAnimationFrame(measureUI);
}
function refreshArmyUI() {
  const ar = $('row-army'); if (!ar) return; ar.innerHTML = '';
  const rec = [['sword', 'sword'], ['spear', 'spear'], ['archer', 'bow'], ['knight', 'knight']];
  for (const [type, ic] of rec) {
    const d = UNIT[type], ok = countB(d.req) > 0; const b = document.createElement('button'); b.className = 'bcard' + (ok ? '' : ' lock'); b.style.width = '118px';
    b.innerHTML = `<b>${d.name}</b><span class="c">${d.cost} זהב</span><small>${ok ? `חיים ${d.hp} · נזק ${d.atk}` : `דרוש ${BUILDINGS[d.req].name}`}</small>`; b.onclick = () => recruit(type); ar.appendChild(b);
  }
  const or = $('row-orders'); or.innerHTML = '';
  const orders = [['follow', 'follow', 'אחריי'], ['charge', 'charge', 'הסתערות'], ['hold', 'hold', 'עמדו כאן'], ['home', 'home', 'הגנה על הבירה']];
  for (const [id, ic, name] of orders) { const b = document.createElement('button'); b.className = 'tool' + (army.order === id ? ' on' : ''); b.style.width = '76px'; b.innerHTML = icon(ic) + name; b.onclick = () => setOrder(id); or.appendChild(b); }
  const sp = document.createElement('div'); sp.className = 'sep'; or.appendChild(sp);
  const tb = document.createElement('button'); tb.className = 'tool act'; tb.style.width = '76px'; tb.innerHTML = icon('travel') + 'לבירה'; tb.onclick = travelHome; or.appendChild(tb);
}
function setOrder(o) {
  army.order = o; for (const u of units) if (u.team === 0 && u !== hero) { u.target = null; u.think = 0; if (o === 'hold') { u.holdX = u.x; u.holdZ = u.z; } }
  const msg = { follow: 'הצבא עוקב אחרי הגיבור', charge: 'הסתערות! הצבא תוקף כל אויב בסביבה', hold: 'הצבא מחזיק את העמדה', home: 'הצבא חוזר להגן על הבירה' }; toast(msg[o]); refreshArmyUI(); sfx('recruit');
}
function travelHome() {
  if (!hero || hero.dead) return;
  if (nearestFoe(hero, 14)) return toast('אי אפשר לסגת באמצע קרב', 'warn');
  const p = findFree(CX + 0.5, CZ + 3.5, 0); hero.x = p.x; hero.z = p.z; hero.y = p.y; hero.moveTarget = null; hero.target = null;
  if (army.order === 'follow') for (const u of units) if (u.team === 0 && u !== hero && !u.dead) { const q = findFree(CX + 0.5 + (Math.random() - 0.5) * 6, CZ + 6, 0); u.x = q.x; u.z = q.z; u.y = q.y; }
  cam.tx = hero.x; cam.tz = hero.z; toast('חזרתם לבירה');
}
function recruit(type) {
  const d = UNIT[type];
  if (!countB(d.req)) { toast(`כדי לגייס ${d.name} צריך לבנות ${BUILDINGS[d.req].name} (בנייה ← מבנים)`, 'warn'); sfx('error'); return; }
  if (allyCount() >= armyCap()) { toast('הגעתם למגבלת הצבא. בנו בתי מגורים או כבשו יעדים כדי להגדיל אותה.', 'warn'); sfx('error'); return; }
  if (!spend(d.cost)) return;
  const b = buildings.filter(q => q.type === d.req).sort((a, c) => dist2(a.wx, a.wz, hero.x, hero.z) - dist2(c.wx, c.wz, hero.x, hero.z))[0];
  const [ox, oz] = ROT(0, 5, b.rot); const u = spawnUnit(type, 0, b.x + 0.5 + ox, b.z + 0.5 + oz); u.holdX = u.x; u.holdZ = u.z;
  state.stats.recruited++; sfx('recruit'); toast(`${d.name} הצטרף לצבא (${allyCount()}/${armyCap()})`); updateHud(true);
}
function updateConfirm() {
  const cf = $('confirm');
  if (pending && mode === 'build') {
    const tool = pending.tool, c = cellAbove(pending.hit), cells = planCells(blueprintFor(tool), c, autoRot());
    const price = tool === 'building' ? BUILDINGS[sel.bld].cost : cells.reduce((s, q) => s + MATS[q[3]].cost, 0);
    $('cf-ok').textContent = `בנו · ${fmt(price)}`; show(cf, true); $('cf-rot').hidden = false;
  } else if (sel.a && mode === 'build') { $('cf-ok').textContent = 'בחרו נקודה שנייה'; show(cf, true); $('cf-rot').hidden = true; }
  else show(cf, false);
  markA.visible = !!sel.a; if (sel.a) markA.position.set(sel.a.x + 0.5, sel.a.y + 0.5, sel.a.z + 0.5);
}
$('cf-ok').onclick = () => { if (!pending) return; const p = pending; pending = null; placeAt(p.hit, 'confirm'); ghost.visible = false; updateConfirm(); };
$('cf-rot').onclick = () => { sel.rot = (sel.rot + 1) % 4; if (pending) updateGhostFromHit(pending.hit); updateConfirm(); };
$('cf-no').onclick = () => { pending = null; sel.a = null; ghost.visible = false; updateConfirm(); };
$('b-attack').addEventListener('click', () => { ensureAudio(); heroStrike(); });
$('b-cleave').addEventListener('click', () => { ensureAudio(); heroCleave(); });
$('b-sound').classList.toggle('off', muted);
$('b-sound').onclick = () => { muted = !muted; pref('muted', muted ? '1' : '0'); $('b-sound').classList.toggle('off', muted); ensureAudio(); if (!muted) sfx('coin'); };
$('b-full').onclick = toggleFullscreen; $('b-tfull').onclick = toggleFullscreen;
$('b-menu').onclick = openMenu;
$('minimap').addEventListener('pointerdown', e => {
  e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * WORLD, z = ((e.clientY - r.top) / r.height) * WORLD;
  if (mode === 'build') { cam.tx = x; cam.tz = z; } else if (hero) { hero.moveTarget = { x, z }; hero.target = null; toast('הגיבור יוצא לדרך'); }
});
function refreshHudBanner() {
  const k = state.kingdom; $('hud-name').textContent = k.name; $('hud-ruler').textContent = 'בהנהגת ' + k.ruler;
  const cv = $('hud-flag'); drawBanner(cv.getContext('2d'), cv.width, cv.height, k.banner, 'banner');
}
let hudT = 0, mmT = 0;
function updateHud(force) {
  if (!state) return;
  $('st-gold').textContent = state.creative ? '∞' : fmt(state.gold);
  $('st-inc').textContent = `+${incomeRate()}`;
  $('st-army').textContent = `${allyCount()}/${armyCap()}`;
  $('st-land').textContent = `${camps.filter(c => c.owner === 0).length}/${camps.length}`;
  if (hero) { $('hero-hp').style.width = Math.max(0, (hero.hp / hero.maxHp) * 100) + '%'; $('hero-txt').textContent = hero.dead ? 'הגיבור חוזר לבירה…' : `${state.kingdom.ruler} · ${Math.ceil(Math.max(0, hero.hp))}/${hero.maxHp}`; }
  $('b-cleave').querySelector('i').style.setProperty('--p', (cleaveCd / 8) * 100 + '%');
}
function drawMinimap() {
  const cv = $('minimap'), g = cv.getContext('2d'), S = cv.width, k = S / WORLD; flushMinimapCols();
  g.clearRect(0, 0, S, S); g.imageSmoothingEnabled = false; g.drawImage(mmBase, 0, 0, S, S);
  const c1 = state.kingdom.banner.c1;
  g.save(); g.globalAlpha = 0.22; g.fillStyle = c1; for (const t of terr) { g.beginPath(); g.arc(t.x * k, t.z * k, t.r * k, 0, 7); g.fill(); } g.restore();
  g.lineWidth = 1.5; g.strokeStyle = c1; for (const t of terr) { g.beginPath(); g.arc(t.x * k, t.z * k, t.r * k, 0, 7); g.stroke(); }
  for (const c of camps) {
    const rr = c.kind === 'castle' ? 7 : c.kind === 'fort' ? 5.5 : 4; g.fillStyle = c.owner === 0 ? c1 : '#b3201b'; g.strokeStyle = c.owner === 0 ? '#fff' : '#1a0a08'; g.lineWidth = 1.5;
    g.beginPath(); if (c.kind === 'bandit') g.arc(c.x * k, c.z * k, rr, 0, 7); else g.rect(c.x * k - rr, c.z * k - rr, rr * 2, rr * 2); g.fill(); g.stroke();
  }
  for (const u of units) { if (u.dead || u === hero) continue; g.fillStyle = u.team === 0 ? '#ffffff' : (u.raid ? '#ff5a3a' : '#e0302a'); g.fillRect(u.x * k - 1.5, u.z * k - 1.5, 3, 3); }
  if (hero) { g.save(); g.translate(hero.x * k, hero.z * k); g.rotate(-hero.rot); g.fillStyle = '#f3c650'; g.strokeStyle = '#2a1c0c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 7); g.lineTo(5, -5); g.lineTo(-5, -5); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cam.tx * k, cam.tz * k, 6, 0, 7); g.stroke();
}

// מסך פתיחה + יצירת ממלכה
let draft = null, createMode = 'new';
function drawCrest() { const cv = $('cv-crest'); drawBanner(cv.getContext('2d'), cv.width, cv.height, draft ? draft.banner : { c1: '#1f4f9e', c2: '#e1b23b', pattern: 'bordure', emblem: 'crown', ec: '#e1b23b' }, 'banner'); }
function openCreate(m) {
  createMode = m;
  const base = m === 'edit' ? state.kingdom : { name: 'ממלכת ' + ['האלון', 'העמק', 'הנשר', 'הסלע', 'האור', 'הגבעות'][(Math.random() * 6) | 0], ruler: 'המלך ' + ['אריאל', 'יהונתן', 'אביר', 'דוד', 'עמרי'][(Math.random() * 5) | 0], banner: randomBanner() };
  draft = JSON.parse(JSON.stringify(base));
  $('in-name').value = draft.name; $('in-ruler').value = draft.ruler; $('cr-title').textContent = m === 'edit' ? 'עריכת הממלכה והדגל' : 'הקמת ממלכה';
  $('b-found').textContent = m === 'edit' ? 'שמירת השינויים' : 'הקימו את הממלכה';
  renderCreate(); show('scr-title', false); show('scr-create', true); if (m === 'edit') { show('modal', false); modalOpen = true; }
}
function swatchRow(el, keyName) {
  el.innerHTML = '';
  for (const [c, n] of TINCTURES) { const b = document.createElement('button'); b.style.background = c; b.title = n; b.setAttribute('aria-label', n); b.className = draft.banner[keyName] === c ? 'on' : ''; b.onclick = () => { draft.banner[keyName] = c; renderCreate(); }; el.appendChild(b); }
}
function renderCreate() {
  const b = draft.banner;
  drawBanner($('cv-banner').getContext('2d'), 240, 340, b, 'banner'); drawBanner($('cv-flag').getContext('2d'), 270, 180, b, 'flag');
  swatchRow($('sw-c1'), 'c1'); swatchRow($('sw-c2'), 'c2'); swatchRow($('sw-ec'), 'ec');
  const op = $('op-pat'); op.innerHTML = '';
  for (const [id, n] of PATTERNS) { const bt = document.createElement('button'); bt.className = b.pattern === id ? 'on' : ''; const cv = document.createElement('canvas'); cv.width = 80; cv.height = 108; drawBanner(cv.getContext('2d'), 80, 108, Object.assign({}, b, { pattern: id, emblem: 'none' }), 'banner'); bt.appendChild(cv); bt.appendChild(document.createTextNode(n)); bt.onclick = () => { b.pattern = id; renderCreate(); }; op.appendChild(bt); }
  const oe = $('op-emb'); oe.innerHTML = '';
  for (const [id, n] of EMBLEMS) { const bt = document.createElement('button'); bt.className = b.emblem === id ? 'on' : ''; const cv = document.createElement('canvas'); cv.width = 80; cv.height = 108; drawBanner(cv.getContext('2d'), 80, 108, Object.assign({}, b, { pattern: 'plain', emblem: id }), 'banner'); bt.appendChild(cv); bt.appendChild(document.createTextNode(n)); bt.onclick = () => { b.emblem = id; renderCreate(); }; oe.appendChild(bt); }
}
$('b-rand').onclick = () => { draft.banner = randomBanner(); renderCreate(); };
$('b-cback').onclick = () => { show('scr-create', false); if (createMode === 'edit') { modalOpen = false; } else { show('scr-title', true); drawCrest(); } };
$('b-found').onclick = () => {
  draft.name = ($('in-name').value || '').trim() || 'הממלכה שלי'; draft.ruler = ($('in-ruler').value || '').trim() || 'השליט';
  if (createMode === 'edit') {
    state.kingdom = draft; bannerTexture(draft.banner, 'p'); for (const k of Object.keys(modelCache)) if (k.endsWith('_0')) delete modelCache[k];
    for (const u of units) if (u.team === 0) buildUnitMesh(u); refreshHudBanner(); rebuildTerritory(); show('scr-create', false); modalOpen = false; toast('הדגל והממלכה עודכנו'); saveGame(false); return;
  }
  ensureAudio(); const seed = (Math.random() * 1e9) | 0;
  const st = newState(draft, worldPristine ? worldSeed : seed);
  startGame(st, null); saveGame(false); sfx('fanfare');
};
$('b-new').onclick = () => {
  ensureAudio();
  if (readSave()) { openModal(`<div class="mhead"><h2>להתחיל ממלכה חדשה?</h2></div><p>יש לכם משחק שמור. ממלכה חדשה תחליף אותו לצמיתות.</p><div class="cact"><button class="btn" id="m-no">ביטול</button><button class="btn danger" id="m-yes">כן, ממלכה חדשה</button></div>`); $('m-no').onclick = closeModal; $('m-yes').onclick = () => { closeModal(); openCreate('new'); }; return; }
  openCreate('new');
};
$('b-cont').onclick = () => { ensureAudio(); const s = readSave(); if (!s) return; const st = Object.assign(newState(s.kingdom, s.seed), { gold: s.gold, time: s.time, creative: !!s.creative, stats: Object.assign(newState().stats, s.stats), quest: s.quest || 0, raid: s.raid || { next: 420, level: 0 }, nextBid: s.nextBid || 1, chopped: s.chopped || [] }); startGame(st, s); };

function openModal(html) { $('modal-body').innerHTML = html; show('modal', true); modalOpen = true; }
function closeModal() { show('modal', false); modalOpen = false; }
$('modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') closeModal(); });
function openMenu() {
  openModal(`<div class="mhead"><h2>${state.kingdom.name}</h2><button class="xbtn" id="m-x" aria-label="סגירה">×</button></div>
  <div class="menu-list">
    <button class="btn" id="m-save">שמירת המשחק <small>נשמר גם אוטומטית</small></button>
    <button class="btn" id="m-edit">עריכת הדגל והממלכה</button>
    <button class="btn" id="m-help">עזרה ומקשים</button>
    <button class="btn" id="m-q">איכות גרפיקה: ${quality === 'high' ? 'גבוהה' : 'חסכונית'} <small>החלפה</small></button>
    <button class="btn" id="m-cr">מצב יצירה: ${state.creative ? 'פעיל' : 'כבוי'} <small>זהב ללא הגבלה ובנייה בכל מקום</small></button>
    <button class="btn" id="m-full">מסך מלא</button>
    <button class="btn danger" id="m-new">ממלכה חדשה</button>
  </div>
  <p style="text-align:center;font-size:13px;color:#6b5434;margin-top:14px">זמן משחק ${Math.floor(state.time / 60)} דקות · ${fmt(state.stats.placed)} בלוקים · ${fmt(state.stats.kills)} אויבים הובסו</p>`);
  $('m-x').onclick = closeModal; $('m-save').onclick = () => { saveGame(true); closeModal(); };
  $('m-edit').onclick = () => { closeModal(); openCreate('edit'); }; $('m-help').onclick = () => openHelp(false);
  $('m-q').onclick = () => { quality = quality === 'high' ? 'low' : 'high'; pref('quality', quality); applyQuality(); openMenu(); };
  $('m-cr').onclick = () => { state.creative = !state.creative; toast(state.creative ? 'מצב יצירה פעיל: בנו בחופשיות' : 'מצב יצירה כבוי'); updateHud(true); rebuildTerritory(); openMenu(); };
  $('m-full').onclick = () => { closeModal(); toggleFullscreen(); };
  $('m-new').onclick = () => { openModal(`<h2>להתחיל ממלכה חדשה?</h2><p>הממלכה הנוכחית, ${state.kingdom.name}, תימחק.</p><div class="cact"><button class="btn" id="m-no">ביטול</button><button class="btn danger" id="m-yes">כן, ממלכה חדשה</button></div>`); $('m-no').onclick = openMenu; $('m-yes').onclick = () => { closeModal(); try { localStorage.removeItem(SAVE_KEY); } catch (e) {} gameActive = false; show('hud', false); openCreate('new'); }; };
}
function openHelp(first) {
  openModal(`<div class="mhead"><h2>${first ? `ברוכים הבאים, ${state.kingdom.ruler}` : 'איך משחקים'}</h2><button class="xbtn" id="m-x" aria-label="סגירה">×</button></div>
  <p>${first ? `${state.kingdom.name} קמה. יש לכם 1,000 זהב, גיבור ושלושה חיילים. ` : ''}הבירה שלכם במרכז המפה. בנו טירה מכל חומר, הקימו מבנים שמכניסים מסים, גייסו צבא וכבשו את מחנות האויב המסומנים באדום במפה. כל כיבוש מרחיב את שטח הממלכה ומוסיף הכנסה.</p>
  <div class="help-cols">
   <div><h3>בנייה</h3><ul><li>בחרו כלי וחומר בתחתית המסך, ולחצו על הקרקע או על בלוק קיים.</li><li>מגדל ומצודה כוללים מדרגות פנימיות: אפשר לטפס לגג עם הגיבור.</li><li><b>מבנים</b> כמו חווה, שוק וקסרקטין מכניסים זהב או מאפשרים גיוס.</li><li>בונים רק בשטח הממלכה (הקו הצבעוני).</li></ul></div>
   <div><h3>גיבור וצבא</h3><ul><li>במצב <b>גיבור וצבא</b> אתם שולטים בגיבור: הולכים, נכנסים לטירה ונלחמים.</li><li>הקישו על אויב כדי לתקוף אותו, או על הקרקע כדי ללכת לשם.</li><li>כפתור החרב תוקף או כורת עץ (+4 זהב). הכוכב הוא מכת סערה.</li><li>פקודות: אחריי, הסתערות, עמדו כאן, הגנה על הבירה.</li></ul></div>
   <div><h3>זהב</h3><ul><li>מסים כל 10 שניות לפי המבנים, השטחים וגודל הטירה.</li><li>זהב על כל אויב שמובס, על כל כיבוש ועל כל משימה.</li><li>מענק מלכותי על כל 50 בלוקים שבניתם.</li><li>פשיטות אויב מגיעות לבירה מדי פעם. מגדלי קשתים וצבא בבית עוצרים אותן.</li></ul></div>
   <div><h3>מקשים במחשב</h3><ul><li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> תנועה · <kbd>Q</kbd><kbd>E</kbd> סיבוב מצלמה · גלגלת זום</li><li>גרירה: הזזת מפה · קליק ימני וגרירה: סיבוב · קליק ימני: הריסה</li><li><kbd>B</kbd> בנייה · <kbd>H</kbd> גיבור · <kbd>R</kbd> סיבוב מבנה · <kbd>Ctrl</kbd>+<kbd>Z</kbd> ביטול</li><li><kbd>רווח</kbd> תקיפה · <kbd>G</kbd> מכת סערה · <kbd>1</kbd>–<kbd>9</kbd> כלים</li></ul></div>
   <div><h3>בטלפון</h3><ul><li>אצבע אחת: הזזת המפה (או סיבוב מצלמה במצב גיבור).</li><li>שתי אצבעות: זום וסיבוב.</li><li>ג׳ויסטיק משמאל להליכה, כפתור חרב מימין.</li><li>באייפון, למסך מלא: שיתוף ← "הוספה למסך הבית".</li></ul></div>
  </div>
  <div class="cact" style="justify-content:center"><button class="btn primary big" id="m-go">${first ? 'יוצאים לדרך' : 'חזרה למשחק'}</button></div>`);
  $('m-x').onclick = closeModal; $('m-go').onclick = closeModal;
}
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  const hint = () => { if (gameActive || !$('scr-title').classList.contains('hidden-ui')) { const wasActive = gameActive; openModal(`<h2>מסך מלא</h2><p>הדפדפן הזה לא מאפשר מסך מלא מתוך הדף.</p><p><b>באייפון ובאייפד:</b> לחצו על כפתור השיתוף בספארי ובחרו "הוספה למסך הבית". המשחק ייפתח מהאייקון במסך מלא, כמו אפליקציה.</p><p><b>באנדרואיד:</b> בתפריט של כרום בחרו "הוספה למסך הבית" או "התקנת אפליקציה".</p><div class="cact" style="justify-content:center"><button class="btn primary" id="m-ok">הבנתי</button></div>`); $('m-ok').onclick = () => { closeModal(); if (!wasActive) modalOpen = false; }; } };
  if (!req) return hint();
  try { const p = req.call(el, { navigationUI: 'hide' }); if (p && p.catch) p.catch(hint); } catch (e) { hint(); }
}
document.addEventListener('fullscreenchange', () => setTimeout(resize, 100));
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));
document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(false); });
window.addEventListener('pagehide', () => saveGame(false));

// ============================================================ לולאה ראשית
let lastT = performance.now(), clock = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; clock += dt;
  if (gameActive && !modalOpen && state) {
    state.time += dt; cleaveCd = Math.max(0, cleaveCd - dt);
    updateUnits(dt); updateArrows(dt); updateTowers(dt); updateRaids(dt);
    incomeT += dt; if (incomeT >= 10) { incomeT = 0; addGold(incomeRate()); }
    questT += dt; if (questT >= 0.7) { questT = 0; updateQuest(); }
    saveT += dt; if (saveT >= 40) { saveT = 0; saveGame(false); }
    if (mode === 'build' && lastHover && !pointers.size && !pending) updateGhostFromHit(pick(...lastHover), ...lastHover);
  }
  updateEffects(dt, clock); waveCloths(clock); updateCamera(dt);
  hudT += dt; if (hudT > 0.25 && gameActive) { hudT = 0; updateHud(); }
  mmT += dt; if (mmT > 0.3 && gameActive && mmBase) { mmT = 0; drawMinimap(); }
  renderer.render(scene, camera);
}

// ============================================================ אתחול
function boot() {
  applyQuality();
  const s = readSave();
  if (s && s.seed != null) { genWorld(s.seed, false); show('b-cont', true); worldPristine = false; worldBare = true; for (const c of camps) if (c.flag) setFlagTeam(c.flag, 1); }
  else { const seed = (Math.random() * 1e9) | 0; genWorld(seed, true); worldPristine = true; }
  cam.tx = CX; cam.tz = CZ; cam.dist = 80; cam.pitch = 0.55; cam.ty = 4;
  drawCrest(); resize(); requestAnimationFrame(frame);
  window.__keter = { sim(sec) { for (let t = 0; t < sec; t += 0.05) { state.time += 0.05; updateUnits(0.05); updateArrows(0.05); updateTowers(0.05); updateRaids(0.05); } }, get state() { return state; }, units: () => units, camps: () => camps, blocks, setMode, placeAt, pick, hero: () => hero };
}
boot();
})();
