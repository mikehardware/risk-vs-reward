/* app.js – UI/state, storage, import/export, rendering */

// ✅ Correct: import the whole module namespace
import * as Calc from './calc.js';
import { weightChart, weeklyPointsChart } from './charts.js';



function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

// State
const DB = {
  settings: {
    units: 'english',
    gender: 'male',
    weekStart: 0,
    homeElevationMeters: 179,
    height: 175, // cm if metric, inches if english (converted)
    graphStartWeight: null,
    graphStart2y: null,
    elevationGamma: 0.40,
    genderFactor: { male:1.00, female:1.25 },
    coeff: { A:1.55, B:0.65, C:0.05 }, // base points coefficients
    inclineTable: []
  },
  daily: [],  // {date, dateStr, weight, notes}
  walks: []   // {date, dateStr, dist, minutes, seconds, incline, elev, notes, calc}
};

// Local Storage helpers
const KEY = 'eddie-points-app-v1';
function save(){ localStorage.setItem(KEY, JSON.stringify(DB)); }
function load(){
  const raw = localStorage.getItem(KEY);
  if (!raw) return;
  try{
    const parsed = JSON.parse(raw);
    Object.assign(DB, parsed);
  }catch(e){}
}

// UI tabs
$all('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    $all('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    $all('.tab').forEach(el=>el.classList.remove('active'));
    $('#tab-'+tab).classList.add('active');
    if (tab==='daily') renderDaily();
    if (tab==='points') renderWalks();
  });
});

// Load config.json (incline table defaults)
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

// SETTINGS
function initSettings(){
  $('#units').value = DB.settings.units;
  $('#gender').value = DB.settings.gender;
  $('#week-start').value = String(DB.settings.weekStart);
  $('#home-elevation').value = DB.settings.homeElevationMeters;
  $('#height').value = DB.settings.height;
  $('#graph-start-weight').value = DB.settings.graphStartWeight || '';
  $('#graph-start-2y').value = DB.settings.graphStart2y || '';
  $('#elev-gamma').value = DB.settings.elevationGamma;

  $('#settings-form').addEventListener('change', ()=>{
    DB.settings.units = $('#units').value;
    DB.settings.gender = $('#gender').value;
    DB.settings.weekStart = Number($('#week-start').value);
    DB.settings.homeElevationMeters = Number($('#home-elevation').value);
    DB.settings.height = Number($('#height').value);
    DB.settings.graphStartWeight = $('#graph-start-weight').value || null;
    DB.settings.graphStart2y = $('#graph-start-2y').value || null;
    DB.settings.elevationGamma = Number($('#elev-gamma').value);
    save();
    renderDaily();
    renderWalks();
  });
}

// DAILY
let weightChartRef = null;
function renderDaily(){
  const tbody = $('#daily-table tbody');
  tbody.innerHTML = '';
  DB.daily.sort((a,b)=> (a.date>b.date?1:-1));
  const weights = [];
  DB.daily.forEach(row=>{
    const w = row.weight;
    weights.push(w);
    const bmiVal = Calc.U.bmi(w, DB.settings.height, DB.settings.units).toFixed(1);
    const ma7 = Calc.movingAverage(weights, 7).slice(-1)[0];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.dateStr}</td>
      <td>${fmtWeight(w)}</td>
      <td>${bmiVal}</td>
      <td>${ma7? ma7.toFixed(1):''}</td>
      <td>${weights.length>1 ? (w - weights[weights.length-2]).toFixed(1) : ''}</td>
      <td>${weeklyAvgForDate(row.date)?.toFixed(1) ?? ''}</td>
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

function weeklyAvgForDate(date){
  // average of weights within the week of 'date'
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
  if (!d || !w) return;
  const date = new Date(d+'T00:00:00');
  DB.daily.push({ date, dateStr: d, weight: w, notes:n });
  save();
  e.target.reset();
  renderDaily();
});

// WALKS
let pointsChartRef = null;
function renderWalks(){
  const tbody = $('#points-table tbody');
  tbody.innerHTML = '';
  DB.walks.sort((a,b)=> (a.date>b.date?1:-1));

  const showDetails = $('#points-details').checked;
  $all('.detail-col').forEach(th=> th.classList.toggle('hidden', !showDetails));

  DB.walks.forEach(row=>{
    const { mph, base, inc, elev, g, final } = row.calc;
    const tr = document.createElement('tr');
    tr.title = hoverText(row, mph);
    tr.innerHTML = `
      <td>${row.dateStr}</td>
      <td>${fmtDistance(row.dist)}</td>
      <td>${fmtTime(row.minutes,row.seconds)}</td>
      <td>${mph.toFixed(2)}</td>
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

  // weekly chart
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

  const mph = Calc.U.mph(dist, mm, ss);
  const calc = Calc.finalPoints({
    distanceMiles: dist, minutes:mm, seconds:ss,
    inclinePct: incline, elevationMeters:elev,
    gender: DB.settings.gender,
    genderFactor: DB.settings.genderFactor,
    inclineTable: DB.settings.inclineTable,
    gamma: DB.settings.elevationGamma,
    coeff: DB.settings.coeff
  });

  const date = new Date(d+'T00:00:00');
  DB.walks.push({ date, dateStr:d, dist, minutes:mm, seconds:ss, incline, elev, notes, calc });
  save();
  e.target.reset();
  renderWalks();
});

$('#points-details').addEventListener('change', renderWalks);

// IMPORT
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

// EXPORT
$('#export-daily').addEventListener('click', ()=>{
  const csv = toCSV([['Date','Weight','Notes']].concat(DB.daily.map(r=>[r.dateStr, r.weight, r.notes||''])));
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

// Helpers
function weekStart(date, startDow){
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day - startDow + 7) % 7;
  d.setDate(d.getDate()-diff);
  d.setHours(0,0,0,0);
  return d;
}
function weeklyTotals(){
  // group DB.walks by week
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
  return txt.split(/\r?\n/).filter(Boolean).map(line=>{
    // simple CSV (no embedded commas/quotes for now)
    return line.split(',').map(x=>x.trim());
  });
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
    // expecting header: Date, Weight, Notes (or similar)
    rows.slice(1).forEach(r=>{
      const d = new Date(r[0]+'T00:00:00');
      if (isNaN(d)) return;
      const weight = Number(r[1]); if (!weight) return;
      DB.daily.push({ date:d, dateStr:r[0], weight, notes:r[2]||'' });
    });
  } else if (type==='walks'){
    // expected columns: Date, Distance, Minutes, Seconds, (Incline), (Elevation), (Notes)
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
function fmtWeight(w){ return DB.settings.units==='metric' ? `${(w).toFixed(1)} kg` : `${w.toFixed(1)} lb`; }
function fmtDistance(d){ return DB.settings.units==='metric' ? `${(d*1.609344).toFixed(2)} km` : `${d.toFixed(2)} mi`; }
function esc(s){ return s.replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function hoverText(row, mph){
  const pace = Calc.U.paceMinPerMile(row.dist, row.minutes, row.seconds);
  const paceStr = `${Math.floor(pace)}:${String(Math.round((pace%1)*60)).padStart(2,'0')}/mi`;
  return `mph: ${mph.toFixed(2)}\npace: ${paceStr}\nelev(m): ${row.elev}\nincline: ${row.incline.toFixed(1)}%`;
}

// INIT
(async function start(){
  load();
  await loadConfig();
  initSettings();

  renderDaily();
  renderWalks();
})();