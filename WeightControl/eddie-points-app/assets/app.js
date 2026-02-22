/* app.js – navigation, storage, charts, import/export, login stub */
import * as Calc from './calc.js';
import { weightChart, weeklyPointsChart } from './charts.js';

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

/* ------------------------ State & Storage ------------------------ */
const DB = {
  settings: {
    units: 'english',
    gender: 'male',
    weekStart: 0,
    homeElevationMeters: 179,
    height: 175, // cm if metric; inches if english (converted in bmi)
    graphStartWeight: null,
    graphStart2y: null,
    elevationGamma: 0.40,
    genderFactor: { male:1.00, female:1.25 },
    coeff: { A:1.55, B:0.65, C:0.05 }, // base points coefficients (tunable)
    inclineTable: [],
    // NEW for % Change / Goal projections:
    startWeight: null,
    goalShort: null,
    goalLong: null,
    goalMode: 'short' // 'short' | 'long'
  },
  daily: [],  // {date, dateStr, weight, notes}
  walks: []   // {date, dateStr, dist, minutes, seconds, incline, elev, notes, calc}
};
const KEY = 'eddie-points-app-v1';
function save(){ localStorage.setItem(KEY, JSON.stringify(DB)); }
function load(){
  const raw = localStorage.getItem(KEY);
  if (!raw) return;
  try{ Object.assign(DB, JSON.parse(raw)); }catch(e){}
}

// Load incline table defaults
async function loadConfig(){
  try{
    const res = await fetch('assets/config.json');
    const cfg = await res.json();
    if (!DB.settings.inclineTable?.length) DB.settings.inclineTable = cfg.inclineTable;
    if (!DB.settings.homeElevationMeters) DB.settings.homeElevationMeters = cfg.homeElevationMeters ?? 179;
    if (!DB.settings.elevationGamma) DB.settings.elevationGamma = cfg.elevationGamma ?? 0.40;
    save();
  }catch(e){}
}

/* ------------------------ Settings UI ------------------------ */
function initSettings(){
  $('#units').value = DB.settings.units;
  $('#gender').value = DB.settings.gender;
  $('#week-start').value = String(DB.settings.weekStart);
  $('#home-elevation').value = DB.settings.homeElevationMeters;
  $('#height').value = DB.settings.height;
  $('#graph-start-weight').value = DB.settings.graphStartWeight || '';
  $('#graph-start-2y').value = DB.settings.graphStart2y || '';
  $('#elev-gamma').value = DB.settings.elevationGamma;
  // NEW fields:
  $('#start-weight').value = DB.settings.startWeight ?? '';
  $('#goal-short').value  = DB.settings.goalShort ?? '';
  $('#goal-long').value   = DB.settings.goalLong ?? '';
  $('#goal-mode').value   = DB.settings.goalMode ?? 'short';

  $('#settings-form').addEventListener('change', ()=>{
    DB.settings.units = $('#units').value;
    DB.settings.gender = $('#gender').value;
    DB.settings.weekStart = Number($('#week-start').value);
    DB.settings.homeElevationMeters = Number($('#home-elevation').value);
    DB.settings.height = Number($('#height').value);
    DB.settings.graphStartWeight = $('#graph-start-weight').value || null;
    DB.settings.graphStart2y = $('#graph-start-2y').value || null;
    DB.settings.elevationGamma = Number($('#elev-gamma').value);
    // NEW:
    DB.settings.startWeight = toNumberOrNull($('#start-weight').value);
    DB.settings.goalShort   = toNumberOrNull($('#goal-short').value);
    DB.settings.goalLong    = toNumberOrNull($('#goal-long').value);
    DB.settings.goalMode    = $('#goal-mode').value;
    save();
    renderDaily();
    renderWalks();
  });
}
function toNumberOrNull(v){ const n = Number(v); return (isFinite(n) ? n : null); }

/* ------------------------ Daily Tab ------------------------ */
let weightChartRef = null;

function renderDaily(){
  const tbody = $('#daily-table tbody'); tbody.innerHTML = '';
  DB.daily.sort((a,b)=> (a.date>b.date?1:-1));

  const weights = [];
  const ma20 = [];           // 20-day moving average (expanding until 20)
  const weeklyAvgMap = new Map();

  // Build 20-day MA progressively
  DB.daily.forEach((row, i)=>{
    weights.push(row.weight);
    const window = Math.min(20, i+1);
    const slice = weights.slice(weights.length - window);
    const avg = slice.reduce((a,b)=>a+b,0)/slice.length;
    ma20.push(avg);
  });

  // Precompute weekly averages per week (by week start)
  DB.daily.forEach(r=>{
    const ws = weekStart(r.date, DB.settings.weekStart);
    const key = ws.toISOString().slice(0,10);
    const arr = weeklyAvgMap.get(key) || [];
    arr.push(r.weight);
    weeklyAvgMap.set(key, arr);
  });

  DB.daily.forEach((row, i)=>{
    const w = row.weight;
    const dateStrLong = formatLongDate(row.date); // Sunday February 22, 2026
    const ma = ma20[i];

    // Lbs. (+/-) from previous day (if any)
    const delta = (i>0) ? (w - DB.daily[i-1].weight) : null;

    // Lbs./Week: MA change vs 7 days ago (provisional)
    const lbsWeek = (i>=7) ? (ma20[i] - ma20[i-7]) : null;

    // Calories per Day (deficit positive if losing): (lbs/week * 3500) / 7
    const calsPerDay = (lbsWeek!=null) ? (lbsWeek * 3500 / 7) : null;

    // BMI (3 decimals)
    const bmiVal = Calc.U.bmi(w, DB.settings.height, DB.settings.units);
    const bmiFmt = isFinite(bmiVal) ? bmiVal.toFixed(3) : '';

    // % Change from Starting Weight (if provided)
    const pctChange = (DB.settings.startWeight!=null)
      ? ((w - DB.settings.startWeight) / DB.settings.startWeight * 100)
      : null;

    // % to Goal + Goal Date (provisional)
    const goalWeight = (DB.settings.goalMode==='short') ? DB.settings.goalShort : DB.settings.goalLong;
    let pctToGoal = null, goalDateStr = '';
    if (DB.settings.startWeight!=null && goalWeight!=null){
      const start = DB.settings.startWeight;
      const goal  = goalWeight;
      const span  = (start - goal); // negative if gaining desired
      const progressed = (start - w); // positive if moving toward lower goal
      if (span !== 0){
        pctToGoal = (progressed / span) * 100;
      }
      // Goal date using lbs/week projection
      if (lbsWeek && Math.abs(lbsWeek) > 1e-6){
        const remaining = Math.abs(w - goal);
        const weeks = remaining / Math.abs(lbsWeek);
        const target = new Date(row.date);
        target.setDate(target.getDate() + Math.round(weeks * 7));
        goalDateStr = formatLongDate(target);
      }
    }

    // Weekly Avg. Weight only on last day of week
    const ws = weekStart(row.date, DB.settings.weekStart);
    const we = new Date(ws); we.setDate(ws.getDate()+6);
    const isEndOfWeek = sameYMD(row.date, we);
    let weeklyAvg = '';
    if (isEndOfWeek){
      const key = ws.toISOString().slice(0,10);
      const arr = weeklyAvgMap.get(key) || [];
      weeklyAvg = arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : '';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dateStrLong}</td>
      <td>${fmtWeight(w)}</td>
      <td>${fmtNumber(ma,1)}</td>
      <td>${fmtNumber(calsPerDay,0)}</td>
      <td>${fmtNumber(lbsWeek,2)}</td>
      <td>${fmtSigned(delta,1)}</td>
      <td>${bmiFmt}</td>
      <td>${fmtNumber(pctChange,2,' %')}</td>
      <td>${fmtNumber(pctToGoal,2,' %')}</td>
      <td>${goalDateStr}</td>
      <td>${weeklyAvg ? fmtWeightRaw(weeklyAvg) : ''}</td>
      <td>${esc(row.notes||'')}</td>
    `;
    tbody.appendChild(tr);
  });

  // chart
  if (weightChartRef) { weightChartRef.destroy(); weightChartRef=null; }
  if ($('#daily-chart')) {
    weightChartRef = weightChart($('#daily-chart'), DB.daily);
  }
}

function formatLongDate(d){
  try{
    return new Intl.DateTimeFormat('en-US', {
      weekday:'long', month:'long', day:'numeric', year:'numeric'
    }).format(d);
  }catch{ return d.toISOString().slice(0,10); }
}
function sameYMD(a,b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

function weeklyAvgForDate(date){
  const ws = weekStart(date, DB.settings.weekStart);
  const we = new Date(ws); we.setDate(ws.getDate()+6);
  const vals = DB.daily.filter(r=> r.date>=ws && r.date<=we).map(r=>r.weight);
  return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
}

$('#daily-form').addEventListener('submit',(e)=>{
  e.preventDefault();
  const d = $('#daily-date').value;
  const w = Number($('#daily-weight').value);
  const n = $('#daily-notes').value;
  if (!d || !isFinite(w)) return;
  const date = new Date(d+'T00:00:00');
  DB.daily.push({ date, dateStr: d, weight: w, notes:n });
  save();
  e.target.reset();
  renderDaily();
});

/* ------------------------ Points Tab ------------------------ */
let pointsChartRef = null;

function renderWalks(){
  const tbody = $('#points-table tbody'); tbody.innerHTML = '';
  DB.walks.sort((a,b)=> (a.date>b.date?1:-1));

  const showDetails = $('#points-details').checked;
  $all('.detail-col').forEach(th=> th.classList.toggle('hidden', !showDetails));

  DB.walks.forEach(row=>{
    const { mph, base, inc, elev, g, final } = row.calc;
    const pace = Calc.U.paceMinPerMile(row.dist, row.minutes, row.seconds);
    const paceStr = (()=>{
      if (!pace || !isFinite(pace)) return '';
      const mm = Math.floor(pace);
      const ss = Math.round((pace - mm) * 60);
      return `${mm}:${String(ss).padStart(2,'0')}`;
    })();

    const tr = document.createElement('tr');
    tr.title = hoverText(row, mph);
    tr.innerHTML = `
      <td>${row.dateStr}</td>
      <td>${fmtDistance(row.dist)}</td>
      <td>${fmtTime(row.minutes,row.seconds)}</td>
      <td>${mph.toFixed(2)}</td>
      <td>${paceStr}</td>
      <td class="detail-col ${showDetails?'':'hidden'}">${base.toFixed(2)}</td>
      <td>${(row.incline||0).toFixed(1)}</td>
      <td class="detail-col ${showDetails?'':'hidden'}">${inc.toFixed(3)}</td>
      <td>${(row.elev ?? DB.settings.homeElevationMeters)}</td>
      <td class="detail-col ${showDetails?'':'hidden'}">${elev.toFixed(3)}</td>
      <td>${DB.settings.gender}</td>
      <td class="detail-col ${showDetails?'':'hidden'}">${g.toFixed(2)}</td>
      <td><strong>${final.toFixed(2)}</strong></td>
      <td>${esc(row.notes||'')}</td>
    `;
    tbody.appendChild(tr);
  });

  const {labels, values} = weeklyTotals();
  if (pointsChartRef){ pointsChartRef.destroy(); pointsChartRef=null; }
  if ($('#points-chart')) {
    pointsChartRef = weeklyPointsChart($('#points-chart'), labels, values);
  }
}

$('#points-form').addEventListener('submit',(e)=>{
  e.preventDefault();
  const d = $('#walk-date').value;
  const dist = Number($('#walk-distance').value);
  const [mm, ss] = parseMmSs($('#walk-time').value);
  const incline = Number($('#walk-incline').value || 0);
  const elev = $('#walk-elevation').value ? Number($('#walk-elevation').value) : DB.settings.homeElevationMeters;
  const notes = $('#walk-notes').value;

  const calc = Calc.finalPoints({
    distanceMiles: dist, minutes:mm, seconds:ss,
    inclinePct: incline, elevationMeters: elev,
    gender: DB.settings.gender, genderFactor: DB.settings.genderFactor,
    inclineTable: DB.settings.inclineTable, gamma: DB.settings.elevationGamma,
    coeff: DB.settings.coeff
  });

  const date = new Date(d+'T00:00:00');
  DB.walks.push({ date, dateStr:d, dist, minutes:mm, seconds:ss, incline, elev, notes, calc });
  save();
  e.target.reset();
  renderWalks();
});

$('#points-details').addEventListener('change', renderWalks);

/* ------------------------ Import/Export ------------------------ */
$('#import-parse').addEventListener('click', ()=>{
  const txt = $('#import-text').value.trim();
  const preview = $('#import-preview');
  if (!txt){ preview.textContent = 'Paste CSV first.'; return; }
  const rows = parseCSV(txt);
  const classification = classifyCSV(rows);
  preview.innerHTML = `<p>Detected: <strong>${classification}</strong></p>
<pre>${esc(rows.slice(0,10).map(r=>r.join(',')).join('\n'))}${rows.length>10?'\n...':''}</pre>`;
  $('#import-commit').disabled = false;
  $('#import-commit').onclick = ()=>{
    importRows(rows, classification);
    $('#import-commit').disabled = true;
    $('#import-text').value = '';
    renderDaily(); renderWalks(); save();
    preview.innerHTML += `<p><strong>Imported.</strong></p>`;
  };
});

$('#export-daily').addEventListener('click', ()=>{
  const header = ['Date','Weight','Moving Average','Calories per Day','Lbs./Week','Lbs (+/-)','BMI','% Change','% to Goal','Goal Date','Weekly Avg. Weight','Notes'];
  const csvRows = [header];
  // Rebuild same computed fields for export
  const tmp = [...DB.daily].sort((a,b)=> (a.date>b.date?1:-1));
  const weights = [];
  const ma20 = [];
  tmp.forEach((r,i)=>{
    weights.push(r.weight);
    const window = Math.min(20, i+1);
    const slice = weights.slice(weights.length - window);
    ma20.push(slice.reduce((a,b)=>a+b,0)/slice.length);
  });

  tmp.forEach((row,i)=>{
    const dLong = formatLongDate(row.date);
    const w = row.weight;
    const ma = ma20[i];
    const lbsWeek = (i>=7) ? (ma20[i]-ma20[i-7]) : null;
    const calsPerDay = (lbsWeek!=null)? (lbsWeek*3500/7) : null;
    const bmi = Calc.U.bmi(w, DB.settings.height, DB.settings.units);
    const pctChange = (DB.settings.startWeight!=null)? ((w-DB.settings.startWeight)/DB.settings.startWeight*100) : null;
    const goalWeight = (DB.settings.goalMode==='short') ? DB.settings.goalShort : DB.settings.goalLong;
    let pctToGoal = null, goalDateStr = '';
    if (DB.settings.startWeight!=null && goalWeight!=null){
      const start = DB.settings.startWeight;
      const goal  = goalWeight;
      const span  = (start - goal);
      const progressed = (start - w);
      if (span !== 0){ pctToGoal = (progressed/span)*100; }
      if (lbsWeek && Math.abs(lbsWeek)>1e-6){
        const remaining = Math.abs(w - goal);
        const weeks = remaining / Math.abs(lbsWeek);
        const target = new Date(row.date);
        target.setDate(target.getDate() + Math.round(weeks*7));
        goalDateStr = formatLongDate(target);
      }
    }
    const weekly = weeklyAvgForDate(row.date);
    csvRows.push([
      dLong,
      w.toFixed(1),
      fmtNumber(ma,1,false,true),
      fmtNumber(calsPerDay,0,false,true),
      fmtNumber(lbsWeek,2,false,true),
      fmtSigned(i>0?(w-tmp[i-1].weight):null,1,false,true),
      isFinite(bmi)? bmi.toFixed(3):'',
      fmtNumber(pctChange,2,' %',true),
      fmtNumber(pctToGoal,2,' %',true),
      goalDateStr,
      weekly!=null? weekly.toFixed(1):'',
      row.notes||''
    ]);
  });
  const csv = toCSV(csvRows);
  downloadFile('daily.csv', csv, 'text/csv');
});
$('#export-walks').addEventListener('click', ()=>{
  const rows = [['Date','Distance (mi)','Minutes','Seconds','Incline %','Elevation m','Final Points','Notes']];
  DB.walks.forEach(w=>{
    rows.push([w.dateStr, w.dist, w.minutes, w.seconds, w.incline, w.elev, w.calc.final.toFixed(2), w.notes||'']);
  });
  downloadFile('walks.csv', toCSV(rows), 'text/csv');
});
$('#export-backup').addEventListener('click', ()=>{
  downloadFile('backup.json', JSON.stringify(DB, null, 2), 'application/json');
});

/* ------------------------ Navigation: smooth scroll + hash ------------------------ */
$all('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const targetSel = btn.dataset.target;
    const section = document.querySelector(targetSel);
    if (!section) return;
    history.pushState(null, '', targetSel); // hash route
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveTab(targetSel);
  });
});
function setActiveTab(targetSel){
  $all('.tab-btn').forEach(b=>{
    b.classList.toggle('active', b.dataset.target === targetSel);
  });
}
const observer = new IntersectionObserver((entries)=>{
  let winner = null, maxRatio = 0;
  for (const entry of entries){
    if (entry.isIntersecting && entry.intersectionRatio > maxRatio){
      winner = entry; maxRatio = entry.intersectionRatio;
    }
  }
  if (winner){ setActiveTab('#'+winner.target.id); }
}, { root: null, rootMargin: '-50% 0px -50% 0px', threshold: [0,0.25,0.5,0.75,1] });
$all('.tab-section').forEach(sec=> observer.observe(sec));
window.addEventListener('DOMContentLoaded', ()=>{
  const hash = location.hash || '#section-daily';
  const section = document.querySelector(hash);
  if (section){ setActiveTab(hash); setTimeout(()=> section.scrollIntoView({ behavior:'instant', block:'start'}), 0); }
});
window.addEventListener('popstate', ()=>{
  const hash = location.hash || '#section-daily';
  setActiveTab(hash);
  document.querySelector(hash)?.scrollIntoView({ behavior:'smooth', block:'start' });
});

/* ------------------------ Login (placeholder) ------------------------ */
const KEY_USER = 'eddie-points-user';
const loginBtn = $('#login-btn');
const logoutBtn = $('#logout-btn');
const displayUser = $('#display-user');
const loginModal = $('#login-modal');
const loginNameInput = $('#login-name');
const loginSaveBtn = $('#login-save');

function loadUser(){ try{ return JSON.parse(localStorage.getItem(KEY_USER)) || null; }catch{return null;} }
function saveUser(u){ localStorage.setItem(KEY_USER, JSON.stringify(u)); }
function setUserUI(u){
  if (u && u.name){
    displayUser.textContent = `Signed in as ${u.name}`;
    loginBtn.style.display = 'none'; logoutBtn.style.display = 'inline-block';
  } else {
    displayUser.textContent = '';
    loginBtn.style.display = 'inline-block'; logoutBtn.style.display = 'none';
  }
}
loginBtn?.addEventListener('click', ()=>{
  loginNameInput.value = (loadUser()?.name || '');
  loginModal.showModal();
});
logoutBtn?.addEventListener('click', ()=>{
  localStorage.removeItem(KEY_USER);
  setUserUI(null);
});
loginSaveBtn?.addEventListener('click', (e)=>{
  e.preventDefault();
  const name = loginNameInput.value.trim();
  if (!name) { loginModal.close(); return; }
  saveUser({ name }); setUserUI({ name }); loginModal.close();
});
window.addEventListener('DOMContentLoaded', ()=> setUserUI(loadUser()) );

/* ------------------------ Helpers ------------------------ */
function weekStart(date, startDow){
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day - startDow + 7) % 7;
  d.setDate(d.getDate()-diff);
  d.setHours(0,0,0,0);
  return d;
}
function weeklyTotals(){
  const map = new Map();
  DB.walks.forEach(w=>{
    const ws = weekStart(w.date, DB.settings.weekStart);
    const key = ws.toISOString().slice(0,10);
    map.set(key, (map.get(key)||0) + w.calc.final);
  });
  const entries = Array.from(map.entries()).sort((a,b)=> a[0]>b[0]?1:-1);
  return { labels: entries.map(e=>e[0]), values: entries.map(e=> Number(e[1].toFixed(2))) };
}
function parseMmSs(s){
  const m = s.match(/^(\d{1,3}):(\d{2})$/);
  if (!m) return [0,0];
  return [Number(m[1]), Number(m[2])];
}
function parseCSV(txt){
  return txt.split(/\r?\n/).filter(Boolean).map(line=> line.split(',').map(x=>x.trim()));
}
function toCSV(rows){ return rows.map(r=>r.map(c=>String(c)).join(',')).join('\n'); }
function classifyCSV(rows){
  const header = rows[0].map(h=>h.toLowerCase());
  if (header.includes('distance') || header.includes('treadmill incline') || header.includes('incline')) return 'walks';
  if (header.includes('weight')) return 'daily';
  return 'unknown';
}
function importRows(rows, type){
  if (type==='daily'){
    rows.slice(1).forEach(r=>{
      const d = new Date(r[0]+'T00:00:00'); if (isNaN(d)) return;
      const weight = Number(r[1]); if (!isFinite(weight)) return;
      DB.daily.push({ date:d, dateStr:r[0], weight, notes:r[2]||'' });
    });
  } else if (type==='walks'){
    rows.slice(1).forEach(r=>{
      const d = new Date(r[0]+'T00:00:00'); if (isNaN(d)) return;
      const dist = Number(r[1]); const mm = Number(r[2]); const ss = Number(r[3]||0);
      const incline = Number(r[4]||0); const elev = r[5]? Number(r[5]) : DB.settings.homeElevationMeters;
      const notes = r[6]||'';
      const calc = Calc.finalPoints({
        distanceMiles: dist, minutes:mm, seconds:ss, inclinePct:incline,
        elevationMeters:elev, gender:DB.settings.gender, genderFactor:DB.settings.genderFactor,
        inclineTable:DB.settings.inclineTable, gamma:DB.settings.elevationGamma, coeff:DB.settings.coeff
      });
      DB.walks.push({ date:d, dateStr:r[0], dist, minutes:mm, seconds:ss, incline, elev, notes, calc });
    });
  }
}
function fmtTime(m,s){ return `${String(m)}:${String(s).padStart(2,'0')}`; }
function fmtWeight(w){
  return DB.settings.units==='metric'
    ? `${(w).toFixed(1)} kg`
    : `${w.toFixed(1)} lb`;
}
function fmtWeightRaw(w){
  const n = Number(w);
  return DB.settings.units==='metric'
    ? `${(n).toFixed(1)} kg`
    : `${n.toFixed(1)} lb`;
}
function fmtDistance(d){
  return DB.settings.units==='metric'
    ? `${(d*1.609344).toFixed(2)} km`
    : `${d.toFixed(2)} mi`;
}
function fmtSigned(v,dec=1, suffix='', raw=false){
  if (v==null || !isFinite(v)) return raw?'':'';
  const s = (v>=0?'+':'');
  return raw ? `${s}${v.toFixed(dec)}${suffix}` : `${s}${v.toFixed(dec)}${suffix}`;
}
function fmtNumber(v, dec=1, suffix='', raw=false){
  if (v==null || !isFinite(v)) return raw?'':'';
  return raw ? `${v.toFixed(dec)}${suffix}` : `${v.toFixed(dec)}${suffix}`;
}
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function hoverText(row, mph){
  const pace = Calc.U.paceMinPerMile(row.dist, row.minutes, row.seconds);
  const paceStr = `${Math.floor(pace||0)}:${String(Math.round(((pace||0)%1)*60)).padStart(2,'0')}/mi`;
  return `mph: ${mph.toFixed(2)}\npace: ${paceStr}\nelev(m): ${row.elev}\nincline: ${row.incline.toFixed(1)}%`;
}

/* ------------------------ Start ------------------------ */
(async function start(){
  load();
  await loadConfig();
  initSettings();
  renderDaily();
  renderWalks();
})();