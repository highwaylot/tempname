// Creator page: the real game, played by hand, dressed for short videos.
// Pick two sides (any flag, or a team you made), play with both thumbs, and
// the page shows each side's coins, who's ahead, the clock and the result,
// then a "who's next?" card. Cups run a saved bracket. Nothing here ships in
// the app; it boots src/main.js exactly as the game does and reads its state.
import './creator.css';
import '../src/main.js';
import { game, cursors, quitToTitle, setOneHand, PHASE_RUN } from '../src/game.js';
import { state } from '../src/state.js';
import { view, clearImageCache, clearHaloCache } from '../src/render.js';
import { world } from '../src/world.js';
import { ent } from '../src/native.js';
import { FLAGS } from './flags.gen.js';

// ---------- saved data ----------
var KEY = "bt.creator.v1";
var store = { teams: [], match: null, cup: null, day: 1 };
try{ var raw = localStorage.getItem(KEY); if(raw) store = Object.assign(store, JSON.parse(raw)); }catch(e){}
var saveWarn = "";
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(store)); saveWarn = ""; }
  catch(e){ saveWarn = "This browser didn't keep the last change (storage full or blocked). Remove a team image to free space."; }
}
if(!store.match) store.match = { left: { f: "br" }, right: { f: "ar" }, type: "crash", secs: 20, hook: "", tag: "" };

// ---------- sides ----------
// A side is { f: "<flag code>" } or { t: "<team id>" }.
function teamOf(side){ return side && side.t ? store.teams.find(function(x){ return x.id === side.t; }) : null; }
function sideKey(side){ return side ? (side.f ? "f:" + side.f : "t:" + side.t) : ""; }
function sideName(side){
  if(!side) return "TBD";
  if(side.f) return FLAGS[side.f] ? FLAGS[side.f].n : side.f.toUpperCase();
  var t = teamOf(side); return t ? t.name : "Deleted team";
}
var svgUrlCache = {};
function flagUrl(code){
  if(!svgUrlCache[code] && FLAGS[code]) svgUrlCache[code] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(FLAGS[code].s);
  return svgUrlCache[code] || "";
}
function initials(name){
  var w = String(name).trim().split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w.slice(0, 3).map(function(x){ return x[0]; }).join("") : String(name).slice(0, 3)).toUpperCase();
}
function inkOn(hex){
  var n = parseInt(String(hex).slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  return (0.299*r + 0.587*g + 0.114*b) > 150 ? "#101216" : "#ffffff";
}
function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]; }); }
function badge(side, cls){
  cls = "cr-badge" + (cls ? " " + cls : "");
  if(!side) return '<span class="' + cls + ' tbd"></span>';
  if(side.f) return '<span class="' + cls + '" style="background-image:url(&quot;' + flagUrl(side.f) + '&quot;)"></span>';
  var t = teamOf(side);
  if(!t) return '<span class="' + cls + ' tbd"></span>';
  if(t.img) return '<span class="' + cls + '" style="background-image:url(&quot;' + t.img + '&quot;)"></span>';
  return '<span class="' + cls + '" style="background:linear-gradient(135deg,' + t.c1 + ' 50%,' + t.c2 + ' 50%);color:' + inkOn(t.c1) + '">' + esc(initials(t.name)) + '</span>';
}
function loadImage(src){
  return new Promise(function(res, rej){ var i = new Image(); i.onload = function(){ res(i); }; i.onerror = rej; i.src = src; });
}
// The orb: a 256 px square the game clips to its shape. Flags and uploads
// are rasterized once so the game never re-renders an SVG per frame.
function orbFor(side){
  var t = teamOf(side);
  var c = document.createElement("canvas"); c.width = c.height = 256;
  var x = c.getContext("2d");
  if(t && !t.img){
    x.fillStyle = t.c1; x.fillRect(0, 0, 256, 256);
    x.fillStyle = t.c2; x.beginPath(); x.moveTo(0, 150); x.lineTo(150, 0); x.lineTo(256, 0); x.lineTo(256, 30); x.lineTo(30, 256); x.lineTo(0, 256); x.closePath(); x.fill();
    return Promise.resolve({ url: c.toDataURL("image/png"), color: t.c1 });
  }
  var src = t ? t.img : flagUrl(side.f);
  return loadImage(src).then(function(img){
    x.drawImage(img, 0, 0, 256, 256);
    var color = t ? t.c1 : avgColor(x);
    try{ return { url: c.toDataURL("image/png"), color: color }; }
    catch(e){ return { url: src, color: color }; }
  }).catch(function(){ return { url: "", color: "#f2c14e" }; });
}
// The glow and trail colour: the most colourful part of the flag.
function avgColor(x){
  var d; try{ d = x.getImageData(0, 0, 256, 256).data; }catch(e){ return "#f2c14e"; }
  var r = 0, g = 0, b = 0, w = 0;
  for(var i = 0; i < d.length; i += 64){
    var R = d[i], G = d[i+1], B = d[i+2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    var s = mx ? (mx - mn) / mx : 0, k = 0.05 + s * s * (mx / 255);
    r += R*k; g += G*k; b += B*k; w += k;
  }
  r /= w; g /= w; b /= w;
  var m = Math.max(r, g, b) || 1, f = Math.max(1, 200 / m);
  return "#" + [r, g, b].map(function(v){ return Math.min(255, Math.round(v * f)).toString(16).padStart(2, "0"); }).join("");
}

// ---------- the game, set up for recording ----------
var allowRun = false;
ent.canRun = function(){
  if(!allowRun) return false;
  // A match starts on both thumbs down: hold the world for a 3-2-1 first.
  allowRun = false;
  queueMicrotask(function(){ if(game.phase === PHASE_RUN){ game.grace = 3; game.countdown = 0; } });
  return true;
};
function loserSide(){
  // The game marks every crash with a ripple of strength 1.6 and life 2.2 at
  // the hit point (game.js die()); its x says which lane crashed.
  for(var i = world.ripples.length - 1; i >= 0; i--){
    var r = world.ripples[i];
    if(r.strength === 1.6 && r.life === 2.2) return r.x < view.W / 2 ? 0 : 1;
  }
  return -1;
}

// ---------- match layer ----------
var hud, el = {};
function buildHud(){
  hud = document.createElement("div");
  hud.className = "cr-hud";
  hud.innerHTML =
    '<div class="cr-dim"></div>' +
    '<div class="cr-top">' +
      '<div class="cr-tag" id="crTag"></div>' +
      '<div class="cr-vs"><div class="cr-side l" id="crSideL"></div><span class="cr-x">VS</span><div class="cr-side r" id="crSideR"></div></div>' +
      '<div class="cr-scores"><div class="cr-score"><i></i><b id="crScoreL">0</b></div><div class="cr-clock" id="crClock"></div><div class="cr-score r"><b id="crScoreR">0</b><i></i></div></div>' +
      '<div class="cr-lead"><span class="l" id="crLeadL"></span><span class="r" id="crLeadR"></span></div>' +
      '<div class="cr-hook" id="crHook"></div>' +
    '</div>' +
    '<div class="cr-banner" id="crBanner"></div>' +
    '<div class="cr-prompt" id="crPrompt">both thumbs down</div>' +
    '<div class="cr-win"><div id="crWinBadge"></div><div class="cr-win-name" id="crWinName"></div><div class="cr-win-sub" id="crWinSub"></div><div class="cr-win-score" id="crWinScore"></div></div>' +
    '<div class="cr-next"><div class="cr-next-big">WHO\'S<br>NEXT?</div><div class="cr-next-sub" id="crNextSub">comment the next matchup ↓</div></div>' +
    '<div class="cr-actions" id="crActions"></div>' +
    '<button type="button" class="cr-btn ghost small cr-quit" id="crQuit" aria-label="Back to menu">✕ menu</button>';
  view.wrap.appendChild(hud);
  hud.querySelectorAll("[id]").forEach(function(n){ el[n.id] = n; });
  el.crQuit.addEventListener("click", function(){ toMenu(); });
}
function bannerFlash(text, cls){
  var b = el.crBanner;
  b.className = "cr-banner"; void b.offsetWidth;
  b.textContent = text;
  b.className = "cr-banner " + (cls || "show");
}
function pop(n){ n.classList.remove("pop"); void n.offsetWidth; n.classList.add("pop"); }

// ---------- match flow ----------
// menu → intro (both thumbs down) → count (3-2-1, world held) → live → over
var mode = "menu", M = null, colors = ["#f2c14e", "#7dd3c0"], shown = [0, 0], deathSeen = false, frozen = false;
var suddenDeath = false, overAt = 0, lastCount = 0, hookHidden = false, result = null;
function defaultHook(m){
  if(m.cup) return m.type === "coins" ? "Most coins in " + m.secs + "s goes through" : "First to hit the wall is out";
  return m.type === "coins" ? "Most coins in " + m.secs + "s wins" : "Who hits the wall first?";
}
function clockText(){
  if(!M) return "";
  if(M.type === "coins"){
    var left = Math.max(0, M.secs - (mode === "live" || mode === "over" ? game.runTime : 0));
    if(suddenDeath) return "SUDDEN DEATH";
    var s = Math.ceil(left);
    return "0:" + String(s).padStart(2, "0");
  }
  return (mode === "live" || mode === "over" ? game.runTime : 0).toFixed(1) + "s";
}
function setupRound(m){
  M = m;
  resetGame();
  closeMenu();
  var sides = [m.left, m.right];
  hud.hidden = false;
  el.crSideL.innerHTML = badge(sides[0]) + '<span class="cr-name">' + esc(sideName(sides[0])) + '</span>';
  el.crSideR.innerHTML = badge(sides[1]) + '<span class="cr-name">' + esc(sideName(sides[1])) + '</span>';
  fitNames();
  el.crTag.textContent = m.tag || "";
  el.crHook.textContent = m.hook || defaultHook(m);
  el.crHook.style.opacity = "1"; hookHidden = false;
  el.crScoreL.textContent = "0"; el.crScoreR.textContent = "0"; shown = [0, 0];
  el.crClock.classList.remove("hot");
  el.crBanner.className = "cr-banner";
  hud.className = "cr-hud";
  el.crPrompt.hidden = false; el.crQuit.hidden = false;
  suddenDeath = false; deathSeen = false; frozen = false; result = null;
  Promise.all(sides.map(orbFor)).then(function(o){
    [0, 1].forEach(function(s){
      state.slots[s].mode = o[s].url ? "image" : "color";
      state.slots[s].image = o[s].url || null;
      state.slots[s].color = o[s].color;
      colors[s] = o[s].color;
    });
    clearImageCache(); clearHaloCache();
    el.crLeadL.style.background = colors[0]; el.crLeadR.style.background = colors[1];
    paintLead();
  });
  mode = "intro";
  allowRun = true;
  el.crClock.textContent = clockText();
}
// Long names shrink to fit their half of the banner instead of clipping.
function fitNames(){
  hud.querySelectorAll(".cr-name").forEach(function(n){
    n.style.fontSize = "";
    var px = parseFloat(getComputedStyle(n).fontSize);
    while(n.scrollWidth > n.clientWidth + 1 && px > 10){ px -= 1; n.style.fontSize = px + "px"; }
  });
}
function paintLead(){
  var a = game.coinsBy[0] + 1, b = game.coinsBy[1] + 1, p = a / (a + b) * 100;
  el.crLeadL.style.width = p.toFixed(1) + "%";
  el.crLeadR.style.width = (100 - p).toFixed(1) + "%";
}
function freeze(){ frozen = true; game.paused = true; game.pausedBy = "creator"; }
function resetGame(){
  allowRun = false; frozen = false;
  game.paused = false; game.pausedBy = "";
  quitToTitle();
}
function endMatch(w, how){
  mode = "over"; overAt = performance.now();
  var sides = [M.left, M.right], sc = [game.coinsBy[0], game.coinsBy[1]];
  result = { w: w, sc: sc, how: how };
  el.crWinBadge.innerHTML = badge(sides[w]);
  el.crWinName.textContent = sideName(sides[w]) + (M.cup && M.cup.final ? " wins the cup" : (M.cup ? " goes through" : " wins"));
  el.crWinSub.textContent = how === "wall" ? sideName(sides[1 - w]) + " hit the wall" : (how === "sd" ? "sudden death" : "most coins");
  el.crWinSub.style.color = how === "wall" ? "" : "var(--accent)";
  el.crWinScore.textContent = sc[0] + " – " + sc[1];
  el.crNextSub.textContent = M.cup ? (M.cup.final ? "comment the next cup ↓" : "comment who wins the next one ↓") : "comment the next matchup ↓";
  el.crPrompt.hidden = true;
  if(M.cup) recordCupResult(M.cup.r, M.cup.i, w, sc);
  var acts = '<button type="button" class="cr-btn" data-a="again">Rematch</button>';
  if(M.cup){
    acts = (nextMatch() ? '<button type="button" class="cr-btn go" data-a="next">Next match</button>' : "") + '<button type="button" class="cr-btn" data-a="bracket">Bracket</button>';
  }
  el.crActions.innerHTML = acts + '<button type="button" class="cr-btn ghost" data-a="menu">Menu</button>';
}
function onAction(a){
  if(a === "again") setupRound(M);
  else if(a === "next"){ var n = nextMatch(); if(n) setupRound(cupMatchSetup(n)); }
  else if(a === "bracket"){ resetGame(); showBracket(); }
  else toMenu();
}

function tick(){
  requestAnimationFrame(tick);
  if(!M || mode === "menu") return;
  // Counters: a pop on every coin, per side.
  [0, 1].forEach(function(s){
    var v = game.coinsBy[s];
    if(v !== shown[s]){ shown[s] = v; var n = s ? el.crScoreR : el.crScoreL; n.textContent = v; if(v) pop(n); }
  });
  paintLead();
  el.crClock.textContent = clockText();
  if(mode === "intro" && game.phase === PHASE_RUN){ mode = "count"; lastCount = 0; el.crPrompt.hidden = true; el.crQuit.hidden = true; }
  if(mode === "count"){
    var n = Math.ceil(game.grace);
    if(game.grace <= 0){ mode = "live"; bannerFlash("GO"); }
    else if(n !== lastCount && n >= 1 && n <= 3){ lastCount = n; bannerFlash(String(n)); }
  }
  if(mode === "live"){
    if(!hookHidden && game.runTime > 2.2){ hookHidden = true; el.crHook.style.opacity = "0"; }
    if(M.type === "coins"){
      var left = M.secs - game.runTime;
      el.crClock.classList.toggle("hot", left <= 5 || suddenDeath);
      var a = game.coinsBy[0], b = game.coinsBy[1];
      if(!suddenDeath && left <= 0 && game.dying === 0){
        if(a === b){ suddenDeath = true; bannerFlash("SUDDEN DEATH\nNEXT COIN WINS", "stay sd"); }
        else { freeze(); bannerFlash("TIME"); endMatch(a > b ? 0 : 1, "coins"); }
      } else if(suddenDeath && a !== b && game.dying === 0){
        freeze(); el.crBanner.className = "cr-banner"; endMatch(a > b ? 0 : 1, "sd");
      }
    }
    if(mode === "live" && game.dying > 0 && !deathSeen){
      deathSeen = true;
      var lose = loserSide();
      if(lose < 0) lose = Math.abs(cursors[0].x - view.W / 4) > Math.abs(cursors[1].x - view.W * 3 / 4) ? 0 : 1;
      el.crBanner.className = "cr-banner";
      endMatch(1 - lose, "wall");
    }
  }
  if(mode === "over"){
    // A tab return must not wake a finished coin race.
    if(frozen && !game.paused){ game.paused = true; game.pausedBy = "creator"; }
    var k = (performance.now() - overAt) / 1000, lag = result.how === "wall" ? 0.7 : 0.5;
    hud.classList.toggle("over", k > lag);
    hud.classList.toggle("end", k > lag + 2.3);
    hud.classList.toggle("acts", k > lag + 3.1);
  }
}

// ---------- cups ----------
var POPULAR = ["br","ar","fr","de","es","pt","gb-eng","it","nl","be","hr","ma","mx","us","ca","jp","kr","au","sa","sn","ng","gh","eg","tr","pl","uy","co","cl","ec","ch","dk","se","no","rs","ua","ie","gb-sct","gb-wls","cm","ci","dz","tn","ir","qa","cr","pe","py","nz","in","pk","ph","cn","gr","at","cz","hu","ro","jm"];
function roundName(cup, r){
  var m = cup.rounds[r].length;
  return m === 1 ? "Final" : m === 2 ? "Semifinal" : m === 4 ? "Quarterfinal" : "Round of " + (m * 2);
}
function newCup(opts){
  var rounds = [], n = opts.entrants.length / 2;
  var first = [];
  for(var i = 0; i < n; i++) first.push({ a: opts.entrants[2*i], b: opts.entrants[2*i + 1], w: null, sc: null });
  rounds.push(first);
  for(var m = n / 2; m >= 1; m /= 2){ var row = []; for(var j = 0; j < m; j++) row.push({ a: null, b: null, w: null, sc: null }); rounds.push(row); }
  return { name: opts.name, size: opts.entrants.length, type: opts.type, secs: opts.secs, day: opts.day, part: 1, entrants: opts.entrants, rounds: rounds };
}
function nextMatch(){
  var cup = store.cup; if(!cup) return null;
  for(var r = 0; r < cup.rounds.length; r++) for(var i = 0; i < cup.rounds[r].length; i++){
    var x = cup.rounds[r][i]; if(x.a && x.b && x.w == null) return { r: r, i: i };
  }
  return null;
}
function champion(){ var cup = store.cup; if(!cup) return null; var f = cup.rounds[cup.rounds.length - 1][0]; return f.w == null ? null : (f.w ? f.b : f.a); }
function cupMatchSetup(n){
  var cup = store.cup, x = cup.rounds[n.r][n.i];
  var tag = "Day " + cup.day + " · Part " + cup.part + " · " + roundName(cup, n.r);
  return { left: x.a, right: x.b, type: cup.type, secs: cup.secs, hook: "", tag: tag, cup: { r: n.r, i: n.i, final: n.r === cup.rounds.length - 1 } };
}
function recordCupResult(r, i, w, sc){
  var cup = store.cup; if(!cup) return;
  var x = cup.rounds[r][i]; if(!x || x.w != null) return;
  x.w = w; x.sc = sc;
  if(r + 1 < cup.rounds.length){ var nx = cup.rounds[r + 1][i >> 1]; nx[i % 2 ? "b" : "a"] = w ? x.b : x.a; }
  cup.part++;
  save();
}
// Two-sided bracket: the left half of every round on the left, the right
// half on the right, the final and the champion in the middle.
function bracketHtml(cup){
  var R = cup.rounds.length, nx = nextMatch(), cols = [];
  function matchHtml(x, r, i){
    var isNext = nx && nx.r === r && nx.i === i;
    function b(side, lost){ return badge(side, lost ? "out" : ""); }
    return '<div class="cr-bm' + (isNext ? " next" : "") + '">' + b(x.a, x.w === 1) + b(x.b, x.w === 0) + '</div>';
  }
  function col(r, half){
    var row = cup.rounds[r], h = row.length / 2, from = half ? h : 0;
    return '<div class="cr-bcol">' + row.slice(from, from + h).map(function(x, k){ return matchHtml(x, r, from + k); }).join("") + '</div>';
  }
  for(var r = 0; r < R - 1; r++) cols.push(col(r, 0));
  var f = cup.rounds[R - 1][0], ch = champion();
  cols.push('<div class="cr-bcenter"><span class="cr-trophy">' + (ch ? "Champion" : "Final") + '</span>' +
    (ch ? '<div class="cr-champ">' + badge(ch) + '</div>' : "") + matchHtml(f, R - 1, 0) + '</div>');
  for(var r2 = R - 2; r2 >= 0; r2--) cols.push(col(r2, 1));
  return '<div class="cr-bracket" style="grid-template-columns:repeat(' + cols.length + ',1fr);height:' + (cup.size > 8 ? 58 : 46) + 'vh">' + cols.join("") + '</div>';
}
function showBracket(){
  closeMenu();
  var cup = store.cup, nx = nextMatch(), ch = champion();
  var d = document.createElement("div");
  d.className = "cr-show";
  var line = ch ? '<div class="cr-show-next">Champion: <b>' + esc(sideName(ch)) + '</b></div>'
    : (nx ? '<div class="cr-show-next">Next: <b>' + esc(sideName(cup.rounds[nx.r][nx.i].a)) + '</b> vs <b>' + esc(sideName(cup.rounds[nx.r][nx.i].b)) + '</b></div>' : "");
  d.innerHTML = '<div class="cr-tag">Day ' + cup.day + (nx ? " · " + roundName(cup, nx.r) : "") + '</div>' +
    '<div class="cr-show-title">' + esc(cup.name) + '</div>' + bracketHtml(cup) + line +
    '<div class="cr-show-cta">' + (ch ? "comment the next cup ↓" : "comment who goes through ↓") + '</div>' +
    '<div class="cr-show-hint">tap to close</div>';
  document.body.appendChild(d);
  var at = performance.now();
  setTimeout(function(){ var h = d.querySelector(".cr-show-hint"); if(h) h.style.opacity = "0"; }, 1500);
  d.addEventListener("click", function(){ if(performance.now() - at > 700){ d.remove(); openMenu("cup"); } });
}

// ---------- menu ----------
var menu, tab = "match", cupDraft = { name: "Bell Theory Cup", size: 8, type: "crash", secs: 20, entrants: [] }, editTeam = null, armed = {};
function openMenu(which){
  if(which) tab = which;
  mode = "menu";
  resetGame();
  if(!menu){ menu = document.createElement("div"); menu.className = "cr-menu"; document.body.appendChild(menu); menu.addEventListener("click", onMenuClick); menu.addEventListener("input", onMenuInput); menu.addEventListener("change", onMenuChange); }
  menu.hidden = false;
  if(hud){ hud.className = "cr-hud"; hud.hidden = true; }
  renderMenu();
}
function closeMenu(){ if(menu) menu.hidden = true; }
function toMenu(){ openMenu(); }
function seg(name, items, cur){
  return '<div class="cr-seg" role="group">' + items.map(function(it){
    return '<button type="button" data-seg="' + name + '" data-v="' + it[0] + '" aria-pressed="' + (String(cur) === String(it[0])) + '">' + it[1] + '</button>';
  }).join("") + '</div>';
}
function renderMenu(){
  var h = '<div class="cr-menu-in"><div class="cr-head"><div class="cr-mark">Bell Theory <em>Creator</em></div></div>' +
    '<div class="cr-tabs">' + seg("tab", [["match", "Match"], ["cup", "Cup"], ["teams", "Teams"]], tab) + '</div>';
  if(tab === "match") h += matchPane();
  else if(tab === "cup") h += cupPane();
  else h += teamsPane();
  if(saveWarn) h += '<p class="cr-note" style="color:var(--danger)">' + esc(saveWarn) + '</p>';
  menu.innerHTML = h + '</div>';
}
function matchPane(){
  var m = store.match;
  return '<div class="cr-pane">' +
    '<div class="cr-matchup">' +
      '<button type="button" class="cr-slot" data-pick="left">' + badge(m.left) + '<span>' + esc(sideName(m.left)) + '</span></button>' +
      '<button type="button" class="cr-btn ghost small cr-swap" data-act="swap" aria-label="Swap sides">⇄</button>' +
      '<button type="button" class="cr-slot" data-pick="right">' + badge(m.right) + '<span>' + esc(sideName(m.right)) + '</span></button>' +
    '</div>' +
    '<div class="cr-field"><span class="cr-label">Round</span>' + seg("mtype", [["crash", "First crash loses"], ["coins", "Coin race"]], m.type) + '</div>' +
    (m.type === "coins" ? '<div class="cr-field"><span class="cr-label">Time</span>' + seg("msecs", [[15, "15 s"], [20, "20 s"], [30, "30 s"]], m.secs) + '</div>' : "") +
    '<div class="cr-field"><label class="cr-label" for="crHookIn">Hook line</label><input class="cr-input" id="crHookIn" data-in="hook" maxlength="60" value="' + esc(m.hook) + '" placeholder="' + esc(defaultHook(m)) + '"></div>' +
    '<div class="cr-field"><label class="cr-label" for="crTagIn">Top tag (optional)</label><input class="cr-input" id="crTagIn" data-in="tag" maxlength="40" value="' + esc(m.tag) + '" placeholder="e.g. Day 3 · Part 5"></div>' +
    '<button type="button" class="cr-btn go" data-act="play">Set up round</button>' +
    '<p class="cr-note">Start your screen recording, then put both thumbs down. The world holds for 3-2-1, then it\'s live. ' +
    (m.type === "coins" ? "Most coins when the clock runs out wins; a crash loses on the spot; a tie goes to sudden death (next coin wins)." : "The side that hits a wall loses. Keep it past 8 seconds for the algorithm.") + '</p>' +
  '</div>';
}
function cupPane(){
  var cup = store.cup;
  if(!cup){
    var d = cupDraft, full = d.entrants.length === d.size;
    return '<div class="cr-pane">' +
      '<div class="cr-field"><label class="cr-label" for="crCupName">Cup name</label><input class="cr-input" id="crCupName" data-in="cupname" maxlength="40" value="' + esc(d.name) + '"></div>' +
      '<div class="cr-two"><div class="cr-field"><span class="cr-label">Size</span>' + seg("csize", [[8, "8"], [16, "16"]], d.size) + '</div>' +
      '<div class="cr-field"><label class="cr-label" for="crDay">Day</label><input class="cr-input" id="crDay" data-in="day" type="number" min="1" max="999" value="' + store.day + '"></div></div>' +
      '<div class="cr-field"><span class="cr-label">Round</span>' + seg("ctype", [["crash", "First crash loses"], ["coins", "Coin race"]], d.type) + '</div>' +
      (d.type === "coins" ? '<div class="cr-field"><span class="cr-label">Time</span>' + seg("csecs", [[15, "15 s"], [20, "20 s"], [30, "30 s"]], d.secs) + '</div>' : "") +
      '<div class="cr-field"><span class="cr-label">Entrants ' + d.entrants.length + ' / ' + d.size + ' · bracket order</span>' +
        '<div class="cr-chips">' + (d.entrants.length ? d.entrants.map(function(s){ return '<span class="cr-chip">' + badge(s) + '<span>' + esc(sideName(s)) + '</span></span>'; }).join("") : '<span class="cr-note">None yet. Pairs go 1 v 2, 3 v 4, and so on.</span>') + '</div></div>' +
      '<div class="cr-chips"><button type="button" class="cr-btn small" data-act="cuppick">Choose</button><button type="button" class="cr-btn small" data-act="cupfill">Fill randomly</button><button type="button" class="cr-btn small" data-act="cupshuffle">Shuffle</button><button type="button" class="cr-btn small ghost" data-act="cupclear">Clear</button></div>' +
      '<button type="button" class="cr-btn go" data-act="cupstart"' + (full ? "" : " disabled") + '>Start cup</button>' +
    '</div>';
  }
  var nx = nextMatch(), ch = champion();
  return '<div class="cr-pane">' +
    '<div class="cr-head"><div><div class="cr-mark" style="font-size:18px">' + esc(cup.name) + '</div><div class="cr-note">' + (ch ? "Finished · champion " + esc(sideName(ch)) : roundName(cup, nx.r) + " · next up Part " + cup.part) + ' · ' + (cup.type === "coins" ? "coin race " + cup.secs + " s" : "first crash loses") + '</div></div></div>' +
    '<div class="cr-field"><span class="cr-label">Day ' + cup.day + ' · Part ' + cup.part + '</span><div class="cr-chips"><button type="button" class="cr-btn small" data-act="daydown" aria-label="Previous day">− day</button><button type="button" class="cr-btn small" data-act="dayup" aria-label="Next day">+ day</button><span class="cr-note" style="align-self:center">A new day starts at Part 1.</span></div></div>' +
    bracketHtml(cup) +
    (nx ? '<button type="button" class="cr-btn go" data-act="cupnext">Play ' + esc(sideName(cup.rounds[nx.r][nx.i].a)) + ' vs ' + esc(sideName(cup.rounds[nx.r][nx.i].b)) + '</button>' : "") +
    '<div class="cr-two"><button type="button" class="cr-btn" data-act="cupshow">Show bracket</button><button type="button" class="cr-btn danger" data-act="cupreset">' + (armed.cupreset ? "Tap again to end cup" : "End cup") + '</button></div>' +
    '<p class="cr-note">Show bracket opens a clean screen to record between matches. Results save on this phone.</p>' +
  '</div>';
}
function teamsPane(){
  var t = editTeam || { name: "", c1: "#e63946", c2: "#f1faee", img: null };
  return '<div class="cr-pane">' +
    '<div class="cr-field"><label class="cr-label" for="crTeamName">' + (t.id ? "Edit team" : "New team") + '</label><input class="cr-input" id="crTeamName" data-in="tname" maxlength="28" value="' + esc(t.name) + '" placeholder="Name, e.g. Lakers"></div>' +
    '<div class="cr-colors"><label class="cr-label" for="crC1">Main</label><input type="color" id="crC1" data-in="c1" value="' + t.c1 + '"><label class="cr-label" for="crC2">Second</label><input type="color" id="crC2" data-in="c2" value="' + t.c2 + '"><span id="crTeamPrev">' + teamBadge(t) + '</span></div>' +
    '<div class="cr-field"><label class="cr-label" for="crTeamImg">Image (optional, replaces the colours on the orb)</label><input class="cr-input" id="crTeamImg" type="file" accept="image/*">' + (t.img ? '<button type="button" class="cr-btn small ghost" data-act="noimg">Remove image</button>' : "") + '</div>' +
    '<div class="cr-two"><button type="button" class="cr-btn go" data-act="tsave">' + (t.id ? "Save changes" : "Save team") + '</button>' + (t.id ? '<button type="button" class="cr-btn ghost" data-act="tcancel">Cancel</button>' : "") + '</div>' +
    '<p class="cr-note">Logos you upload are your call. For paid ads, stick to flags or names and colours: team logos are trademarks.</p>' +
    '<div>' + (store.teams.length ? store.teams.map(function(x){
      return '<div class="cr-team">' + badge({ t: x.id }) + '<span>' + esc(x.name) + '</span><button type="button" class="cr-btn small" data-act="tedit" data-id="' + x.id + '">Edit</button><button type="button" class="cr-btn small danger" data-act="tdel" data-id="' + x.id + '">' + (armed["tdel" + x.id] ? "Sure?" : "Delete") + '</button></div>';
    }).join("") : '<p class="cr-note">No teams yet. Countries are always available in the picker.</p>') + '</div>' +
  '</div>';
}
function teamBadge(t){
  if(t.img) return '<span class="cr-badge cr-preview" style="background-image:url(&quot;' + t.img + '&quot;)"></span>';
  return '<span class="cr-badge cr-preview" style="background:linear-gradient(135deg,' + t.c1 + ' 50%,' + t.c2 + ' 50%);color:' + inkOn(t.c1) + '">' + esc(initials(t.name || "?")) + '</span>';
}
function arm(key){ armed[key] = true; setTimeout(function(){ if(armed[key]){ delete armed[key]; if(!menu.hidden) renderMenu(); } }, 3000); }
function onMenuClick(e){
  var b = e.target.closest("button"); if(!b) return;
  var m = store.match;
  if(b.dataset.seg){
    var v = b.dataset.v;
    if(b.dataset.seg === "tab") tab = v;
    else if(b.dataset.seg === "mtype") m.type = v;
    else if(b.dataset.seg === "msecs") m.secs = +v;
    else if(b.dataset.seg === "csize"){ cupDraft.size = +v; cupDraft.entrants = cupDraft.entrants.slice(0, +v); }
    else if(b.dataset.seg === "ctype") cupDraft.type = v;
    else if(b.dataset.seg === "csecs") cupDraft.secs = +v;
    save(); renderMenu(); return;
  }
  if(b.dataset.pick){ var which = b.dataset.pick; openPicker({ multi: false, pick: function(s){ m[which] = s; save(); renderMenu(); } }); return; }
  var a = b.dataset.act;
  if(a === "swap"){ var t = m.left; m.left = m.right; m.right = t; save(); renderMenu(); }
  else if(a === "play"){ save(); setupRound({ left: m.left, right: m.right, type: m.type, secs: m.secs, hook: m.hook, tag: m.tag, cup: null }); }
  else if(a === "cuppick") openPicker({ multi: true, limit: cupDraft.size, sel: cupDraft.entrants.slice(), done: function(list){ cupDraft.entrants = list; renderMenu(); } });
  else if(a === "cupfill"){
    var have = {}; cupDraft.entrants.forEach(function(s){ have[sideKey(s)] = 1; });
    var pool = POPULAR.filter(function(c){ return FLAGS[c] && !have["f:" + c]; });
    while(cupDraft.entrants.length < cupDraft.size && pool.length) cupDraft.entrants.push({ f: pool.splice(Math.floor(Math.random() * pool.length), 1)[0] });
    renderMenu();
  }
  else if(a === "cupshuffle"){ var L = cupDraft.entrants; for(var i = L.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var tmp = L[i]; L[i] = L[j]; L[j] = tmp; } renderMenu(); }
  else if(a === "cupclear"){ cupDraft.entrants = []; renderMenu(); }
  else if(a === "cupstart"){ if(cupDraft.entrants.length !== cupDraft.size) return; store.cup = newCup({ name: cupDraft.name || "Bell Theory Cup", type: cupDraft.type, secs: cupDraft.secs, day: store.day, entrants: cupDraft.entrants.slice() }); save(); renderMenu(); }
  else if(a === "cupnext"){ var n = nextMatch(); if(n) setupRound(cupMatchSetup(n)); }
  else if(a === "cupshow") showBracket();
  else if(a === "dayup" || a === "daydown"){ var cup = store.cup; cup.day = Math.max(1, cup.day + (a === "dayup" ? 1 : -1)); cup.part = 1; store.day = cup.day; save(); renderMenu(); }
  else if(a === "cupreset"){ if(!armed.cupreset){ arm("cupreset"); renderMenu(); return; } delete armed.cupreset; store.cup = null; save(); renderMenu(); }
  else if(a === "noimg"){ editTeam = Object.assign(currentTeamDraft(), { img: null }); renderMenu(); }
  else if(a === "tsave"){
    var d = currentTeamDraft(); if(!d.name.trim()){ var ni = document.getElementById("crTeamName"); if(ni){ ni.focus(); ni.placeholder = "Give the team a name first"; } return; }
    if(d.id){ var k = store.teams.findIndex(function(x){ return x.id === d.id; }); if(k >= 0) store.teams[k] = d; }
    else { d.id = "t" + Date.now().toString(36); store.teams.push(d); }
    editTeam = null; save(); renderMenu();
  }
  else if(a === "tcancel"){ editTeam = null; renderMenu(); }
  else if(a === "tedit"){ var tm = store.teams.find(function(x){ return x.id === b.dataset.id; }); if(tm){ editTeam = Object.assign({}, tm); renderMenu(); } }
  else if(a === "tdel"){ var key = "tdel" + b.dataset.id; if(!armed[key]){ arm(key); renderMenu(); return; } delete armed[key]; store.teams = store.teams.filter(function(x){ return x.id !== b.dataset.id; }); save(); renderMenu(); }
}
function currentTeamDraft(){
  var d = Object.assign({ name: "", c1: "#e63946", c2: "#f1faee", img: null }, editTeam || {});
  var n = document.getElementById("crTeamName"), c1 = document.getElementById("crC1"), c2 = document.getElementById("crC2");
  if(n) d.name = n.value; if(c1) d.c1 = c1.value; if(c2) d.c2 = c2.value;
  return d;
}
function onMenuInput(e){
  var k = e.target.dataset.in; if(!k) return;
  if(k === "hook"){ store.match.hook = e.target.value; save(); }
  else if(k === "tag"){ store.match.tag = e.target.value; save(); }
  else if(k === "cupname") cupDraft.name = e.target.value;
  else if(k === "day"){ store.day = Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1)); save(); }
  else if(k === "tname" || k === "c1" || k === "c2"){ editTeam = currentTeamDraft(); var p = document.getElementById("crTeamPrev"); if(p) p.innerHTML = teamBadge(editTeam); }
}
function onMenuChange(e){
  if(e.target.id !== "crTeamImg" || !e.target.files || !e.target.files[0]) return;
  var fr = new FileReader();
  fr.onload = function(){
    loadImage(fr.result).then(function(img){
      // Centre square, 256 px: small enough to keep a few dozen teams saved.
      var c = document.createElement("canvas"); c.width = c.height = 256;
      var s = Math.min(img.width, img.height);
      c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
      editTeam = Object.assign(currentTeamDraft(), { img: c.toDataURL("image/png") });
      renderMenu();
    }).catch(function(){ saveWarn = "That file didn't open as an image. Try a PNG or JPG."; renderMenu(); });
  };
  fr.readAsDataURL(e.target.files[0]);
}

// ---------- picker ----------
function openPicker(opt){
  var sel = opt.sel || [];
  var p = document.createElement("div");
  p.className = "cr-pick";
  p.innerHTML = '<div class="cr-pick-head"><input class="cr-input" id="crSearch" type="search" placeholder="Search countries and teams" autocomplete="off">' +
    (opt.multi ? '<button type="button" class="cr-btn go small" data-act="done">Done</button>' : '<button type="button" class="cr-btn ghost small" data-act="close">Close</button>') + '</div><div class="cr-pick-list"></div>';
  document.body.appendChild(p);
  var list = p.querySelector(".cr-pick-list"), q = p.querySelector("#crSearch");
  var countries = Object.keys(FLAGS).map(function(c){ return { f: c }; }).sort(function(a, b){ return sideName(a).localeCompare(sideName(b)); });
  function isSel(s){ return sel.some(function(x){ return sideKey(x) === sideKey(s); }); }
  function row(s){
    var on = isSel(s);
    return '<button type="button" class="cr-row" data-k="' + esc(sideKey(s)) + '"' + (opt.multi ? ' aria-pressed="' + on + '"' : "") + '>' + badge(s) + '<span>' + esc(sideName(s)) + '</span>' +
      (opt.multi ? '<small>' + (on ? "#" + (sel.findIndex(function(x){ return sideKey(x) === sideKey(s); }) + 1) : "") + '</small>' : '<small>' + (s.f ? s.f : "team") + '</small>') + '</button>';
  }
  function render(){
    var term = q.value.trim().toLowerCase();
    var match = function(s){ return !term || sideName(s).toLowerCase().indexOf(term) >= 0 || (s.f && s.f === term); };
    var teams = store.teams.map(function(t){ return { t: t.id }; }).filter(match), cs = countries.filter(match);
    list.innerHTML = (opt.multi ? '<div class="cr-group">' + sel.length + ' / ' + opt.limit + ' picked · tap order is bracket order</div>' : "") +
      (teams.length ? '<div class="cr-group">Your teams</div>' + teams.map(row).join("") : "") +
      '<div class="cr-group">Countries</div>' + (cs.length ? cs.map(row).join("") : '<p class="cr-note">No match for "' + esc(q.value) + '".</p>');
  }
  q.addEventListener("input", render);
  p.addEventListener("click", function(e){
    var b = e.target.closest("button"); if(!b) return;
    if(b.dataset.act === "close"){ p.remove(); return; }
    if(b.dataset.act === "done"){ p.remove(); opt.done(sel); return; }
    var k = b.dataset.k; if(!k) return;
    var s = k[0] === "f" ? { f: k.slice(2) } : { t: k.slice(2) };
    if(!opt.multi){ p.remove(); opt.pick(s); return; }
    if(isSel(s)) sel = sel.filter(function(x){ return sideKey(x) !== k; });
    else if(sel.length < opt.limit) sel.push(s);
    var top = list.scrollTop; render(); list.scrollTop = top;
  });
  render();
}

// ---------- boot ----------
// main.js boots asynchronously; its bridge object appears once every module
// has initialised.
(function wait(){
  if(!(window.BellTheory && window.BellTheory.phase) || !view.wrap){ setTimeout(wait, 50); return; }
  if(state.oneHand) setOneHand(false);
  state.autoPause = false;     // lifting both thumbs mid-take must not pause
  state.taughtPump = true;     // no "pump to charge" hint in the footage
  state.soundOn = true;        // the dings are the point
  buildHud();
  el.crActions.addEventListener("click", function(e){ var b = e.target.closest("button"); if(b && b.dataset.a) onAction(b.dataset.a); });
  try{ if(navigator.wakeLock) navigator.wakeLock.request("screen").catch(function(){}); }catch(e){}
  // Test hook for the Playwright checks (creator/test.mjs); inert otherwise.
  if(/[?&]test=1(&|$)/.test(location.search)) window.__cr = { game: game, store: store, nextMatch: nextMatch };
  openMenu("match");
  requestAnimationFrame(tick);
})();
