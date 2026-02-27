/* app.js – CRUD for Daily & Walking, feet→meters elevation, straight-line charts */
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
    coeff: { A:1.55, B:0.65, C:0.05 },
    inclineTable: [],
    startWeight: null,
    goalShort: null,
    goalLong: null,
    goalMode: 'short'
  },
  daily: [],  // {id, date, dateStr, weight, notes}
  walks: []   // {id, date, dateStr, dist, minutes, seconds, incline, elev(m), notes, calc}
};
const KEY = 'eddie-points-app-v1';
function save(){ localStorage.setItem(KEY, JSON.stringify(DB)); }
function load(){
  const raw = localStorage.getItem(KEY);
  if (!raw) return;
  try{ Object.assign(DB, JSON.parse(raw)); }catch(e){}
}

/* Migrate any legacy data (string dates, missing ids) */
function migrate(){
  const ensureId = () => 'id_' + Math.random().toString(36).slice(2,10);
  (DB.daily||[]).forEach(r=>{
    if (!r.id) r.id = ensureId();
    if (!(r.date instanceof Date)){
      if (typeof r.date === 'string'){ r.date = new Date(r.date); }
      else if (r.dateStr){ r.date = new Date(r.dateStr+'T00:00:00'); }
      else { r.date = new Date(); }
    }
    if (!r.dateStr) r.dateStr = r.date.toISOString().slice(0,10);
  });
  (DB.walks||[]).forEach(r=>{
    if (!r.id) r.id = ensureId();
    if (!(r.date instanceof Date)){
      if (typeof r.date === 'string'){ r.date = new Date(r.date); }
      else if (r.dateStr){ r.date = new Date(r.dateStr+'T00:00:00'); }
      else { r.date = new Date(); }
    }
    if (!r.dateStr) r.dateStr = r.date.toISOString().slice(0,10);
  });
}

function weekRangeFor(date, startDow){
  const ws = weekStart(date, startDow);
  const we = new Date(ws); we.setDate(we.getDate() + 6); we.setHours(23,59,59,999);
  return [ws, we];
}
function currentWeekPoints(){
  const [ws, we] = weekRangeFor(new Date(), DB.settings.weekStart);
  const total = DB.walks
    .filter(w => w.date >= ws && w.date <= we)
    .reduce((a,b)=> a + (b.calc?.final || 0), 0);
  return total;
}
function weeklyStatus(total){
  let label = 'Shaping Up', cls = 'status-shaping';
  if (total >= 33.3334 && total <= 66.6666){ label = 'Improving'; cls = 'status-improving'; }
  else if (total >= 66.6667 && total <= 99.9999){ label = 'Halfway Decent'; cls = 'status-halfway'; }
  else if (total >= 100.0000 && total <= 165.9999){ label = 'Good'; cls = 'status-good'; }
  else if (total >= 166.0000){ label = 'Athletic'; cls = 'status-athletic'; }
  return { label, cls };
}
function setWeekStatus(){
  const el = document.getElementById('week-status');
  if (!el) return;
  const total = currentWeekPoints();
  const {label, cls} = weeklyStatus(total);
  el.className = 'status-pill ' + cls;
  el.textContent = `This week: ${total.toFixed(2)} pts — ${label}`;
}

/* ------------------------ Config load ------------------------ */
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
  $('#start-weight').value = DB.settings.startWeight ?? '';
  $('#goal-short').value  = DB.settings.goalShort ?? '';
  $('#goal-long').value   = DB.settings.goalLong ?? '';
  $('#goal-mode').value   = DB.settings.goalMode ?? 'short';

  updateUnitLabels();

  $('#settings-form').addEventListener('change', ()=>{
    DB.settings.units = $('#units').value;
    DB.settings.gender = $('#gender').value;
    DB.settings.weekStart = Number($('#week-start').value);
    DB.settings.homeElevationMeters = Number($('#home-elevation').value);
    DB.settings.height = Number($('#height').value);
    DB.settings.graphStartWeight = $('#graph-start-weight').value || null;
    DB.settings.graphStart2y = $('#graph-start-2y').value || null;
    DB.settings.elevationGamma = Number($('#elev-gamma').value);
    DB.settings.startWeight = toNumberOrNull($('#start-weight').value);
    DB.settings.goalShort   = toNumberOrNull($('#goal-short').value);
    DB.settings.goalLong    = toNumberOrNull($('#goal-long').value);
    DB.settings.goalMode    = $('#goal-mode').value;
    save();
    updateUnitLabels();
    renderDaily();
    renderWalks();
    setWeekStatus();
  });
}
function updateUnitLabels(){
  const isEng = DB.settings.units === 'english';
  const unitLabel = $('#elev-unit-label');
  const help = $('#elev-help');
  if (unitLabel) unitLabel.textContent = isEng ? 'ft' : 'm';
  if (help) help.textContent = isEng
    ? 'Enter elevation in feet (defaults to Home Elevation)'
    : 'Enter elevation in meters (defaults to Home Elevation)';
}
function toNumberOrNull(v){ const n = Number(v); return (isFinite(n) ? n : null); }

/* ------------------------ Daily Tab (CRUD + calculations) ------------------------ */
let weightChartRef = null;
let editingDailyId = null;

function renderDaily(){
  const tbody = $('#daily-table tbody');
  tbody.innerHTML = '';

  // Always sort by date ascending
  DB.daily.sort((a,b)=> a.date - b.date);

  const weights = [];
  const ma20 = [];
  const weeklyAvgMap = new Map();

  // Build 20-day MA progressively (expanding until 20)
  DB.daily.forEach((row, i)=>{
    weights.push(row.weight);
    const window = Math.min(20, i+1);
    const slice = weights.slice(weights.length - window);
    const avg = slice.reduce((a,b)=>a+b,0)/slice.length;
    ma20.push(avg);
  });

  // Weekly averages per week (group by week start)
  DB.daily.forEach(r=>{
    const ws = weekStart(r.date, DB.settings.weekStart);
    const key = ws.toISOString().slice(0,10);
    const arr = weeklyAvgMap.get(key) || [];
    arr.push(r.weight);
    weeklyAvgMap.set(key, arr);
  });

  // Running max of MA for Lbs.(+/-) (use O(n) streaming update)
  let runMax = -Infinity;

  DB.daily.forEach((row, i)=>{
    const w = row.weight;
    const dateStrLong = formatLongDate(row.date);
    const ma = ma20[i];

    // ---- MA-based stats ----
    const maPrev = (i>0) ? ma20[i-1] : null;

    // Lbs./Week (neg when losing): MA change over 7 days
    const lbsWeek = (i>=7) ? (ma20[i] - ma20[i-7]) : null;

    // Internal Calories/day (unchanged): positive when losing (old convention)
    const calsPerDay = (maPrev!=null) ? (-(ma - maPrev) * 3500) : 0;
    // Display Calories/day: negative when losing, positive when gaining
    const calsDisplay = -calsPerDay;

    // --- Excel-like milestones ---

    // MA crosses down any new 0.5 step (in current weight units)
    const hlMA = (maPrev!=null) && (Math.floor(maPrev * 2) > Math.floor(ma * 2));

    // Previous max MA (use running max; no slice/Math.max(...))
    const prevRunMax = (i > 0) ? runMax : ma;
    const currRunMax = Math.max(prevRunMax, ma);

    // Loss magnitude vs max MA so far
    const prevLossMag = (maPrev!=null) ? Math.max(0, prevRunMax - maPrev) : 0;
    const currLossMag = Math.max(0, currRunMax - ma);
    // Crossed a new 0.5 step in loss magnitude?
    const hlLbsPM = Math.floor(currLossMag * 2) > Math.floor(prevLossMag * 2);

    // BMI (3 dp): highlight on every 0.1 downward
    const bmiVal  = Calc.U.bmi(w, DB.settings.height, DB.settings.units);
    const bmiPrev = (i>0) ? Calc.U.bmi(DB.daily[i-1].weight, DB.settings.height, DB.settings.units) : null;
    const hlBMI   = (bmiPrev!=null) && (Math.floor(bmiPrev * 10) > Math.floor(bmiVal * 10));

    // % Change (from start): highlight on each additional 0.5% (by magnitude)
    const pctChange = (DB.settings.startWeight!=null)
      ? ((w - DB.settings.startWeight) / DB.settings.startWeight * 100)
      : null;
    const prevPctChange = (i>0 && DB.settings.startWeight!=null)
      ? ((DB.daily[i-1].weight - DB.settings.startWeight) / DB.settings.startWeight * 100)
      : null;
    const hlPctChange = (prevPctChange!=null) &&
      (Math.floor(Math.abs(prevPctChange) * 2) < Math.floor(Math.abs(pctChange) * 2));

    // % to Goal (current mode) & Goal Date (via MA-based Lbs./Week)
    const goalWeight = (DB.settings.goalMode==='short') ? DB.settings.goalShort : DB.settings.goalLong;
    let pctToGoal = null;
    let goalDateStr = '';     // <-- ensure defined before template

    if (DB.settings.startWeight!=null && goalWeight!=null){
      const start = DB.settings.startWeight;
      const span  = (start - goalWeight);
      const progressed = (start - w);
      if (span !== 0){ pctToGoal = (progressed / span) * 100; }

      // Goal Date: weeks = |current - goal| / |Lbs./Week|
      if (lbsWeek != null && Math.abs(lbsWeek) > 1e-6){
        const remaining = Math.abs(w - goalWeight);
        const weeks = remaining / Math.abs(lbsWeek);
        const target = new Date(row.date);
        target.setDate(target.getDate() + Math.round(weeks * 7));
        goalDateStr = formatLongDate(target);
      }
    }

    // Highlight +1% steps toward goal
    const prevPctToGoal = (i>0 && DB.settings.startWeight!=null && goalWeight!=null) ? (()=>{
      const start = DB.settings.startWeight; const span = (start - goalWeight);
      const progressedPrev = (start - DB.daily[i-1].weight);
      return (span!==0) ? (progressedPrev / span) * 100 : null;
    })() : null;
    const hlPctToGoal = (prevPctToGoal!=null && pctToGoal!=null) &&
      (Math.floor(prevPctToGoal) < Math.floor(pctToGoal));

    // Healthy day highlights:
    // Calories/day (display): -1000 .. -500 (healthy deficit)
    const hlCals = (calsDisplay <= -500 && calsDisplay >= -1000);
    // Lbs./Week: loss magnitude between 1.0 and 2.0
    const hlLbsWeek = (lbsWeek!=null) && ((-lbsWeek) >= 1.0) && ((-lbsWeek) <= 2.0);

    // Update running max (for next iteration)
    runMax = currRunMax;

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

    // Row HTML
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dateStrLong}</td>
      <td>${fmtWeight(w)}</td>
      <td class="${hlMA ? 'hl-yellow' : ''}">${fmtNumber(ma,2)}</td>
      <td class="${hlCals ? 'hl-yellow' : ''}">${fmtNumber(calsDisplay,0)}</td>
      <td class="${hlLbsWeek ? 'hl-yellow' : ''}">${fmtNumber(lbsWeek,2)}</td>
      <td class="${hlLbsPM ? 'hl-yellow' : ''}">${fmtSigned(ma - runMax,2)}</td>
      <td class="${hlBMI ? 'hl-yellow' : ''}">${isFinite(bmiVal)? bmiVal.toFixed(3):''}</td>
      <td class="${hlPctChange ? 'hl-yellow' : ''}">${fmtNumber(pctChange,2,' %')}</td>
      <td class="${hlPctToGoal ? 'hl-yellow' : ''}">${fmtNumber(pctToGoal,2,' %')}</td>
      <td>${goalDateStr}</td>
      <td>${weeklyAvg ? fmtWeightRaw(weeklyAvg) : ''}</td>
      <td>${esc(row.notes||'')}</td>
      <td>
        <button class="icon-btn edit" data-id="${row.id}">✏️</button>
        <button class="icon-btn danger delete" data-id="${row.id}">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Table action handlers (delegated)
  tbody.onclick = (e)=>{
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('edit')) onEditDaily(id);
    if (btn.classList.contains('delete')) onDeleteDaily(id);
  };

  // Keep newest (bottom) in view
  const dailyScroll = document.querySelector('#section-daily .table-scroll');
  if (dailyScroll) dailyScroll.scrollTop = dailyScroll.scrollHeight;

  // Chart (straight lines configured in charts.js)
  if (weightChartRef) { weightChartRef.destroy(); weightChartRef = null; }
  if ($('#daily-chart')) {
    weightChartRef = weightChart($('#daily-chart'), DB.daily);
  }
}

function onEditDaily(id){
  const row = DB.daily.find(r=>r.id===id);
  if (!row) return;
  editingDailyId = id;
  $('#daily-date').value = row.date.toISOString().slice(0,10);
  $('#daily-weight').value = row.weight;
  $('#daily-notes').value = row.notes || '';
  $('#daily-submit').textContent = 'Save';
  $('#daily-cancel-edit').style.display = 'inline-block';
}
$('#daily-cancel-edit').onclick = ()=>{
  editingDailyId = null;
  $('#daily-form').reset();
  $('#daily-submit').textContent = 'Add Entry';
  $('#daily-cancel-edit').style.display = 'none';
};
function onDeleteDaily(id){
  if (!confirm('Delete this daily entry?')) return;
  const idx = DB.daily.findIndex(r=>r.id===id);
  if (idx>=0){ DB.daily.splice(idx,1); save(); renderDaily(); }
}

$('#daily-form').addEventListener('submit',(e)=>{
  e.preventDefault();
  const d = $('#daily-date').value;
  const w = Number($('#daily-weight').value);
  const n = $('#daily-notes').value;
  if (!d || !isFinite(w)) return;
  const date = new Date(d+'T00:00:00');

  if (editingDailyId){
    const row = DB.daily.find(r=>r.id===editingDailyId);
    if (row){
      row.date = date;
      row.dateStr = d;
      row.weight = w;
      row.notes = n;
    }
    editingDailyId = null;
    $('#daily-submit').textContent = 'Add Entry';
    $('#daily-cancel-edit').style.display = 'none';
    $('#daily-form').reset();
  } else {
    DB.daily.push({ id:uid(), date, dateStr:d, weight:w, notes:n });
    $('#daily-form').reset();
  }
  save();
  renderDaily();
});

/* ------------------------ Walking Tab (CRUD + calc) ------------------------ */
let pointsChartRef = null;
let editingWalkId = null;

function renderWalks(){
  const tbody = $('#points-table tbody'); tbody.innerHTML = '';

  // Always sort by date ascending
  DB.walks.sort((a,b)=> a.date - b.date);

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
      <td>${fmtElevation(row.elev)}</td>
      <td class="detail-col ${showDetails?'':'hidden'}">${elev.toFixed(3)}</td>
      <td>${DB.settings.gender}</td>
      <td class="detail-col ${showDetails?'':'hidden'}">${g.toFixed(2)}</td>
      <td><strong>${final.toFixed(4)}</strong></td>
      <td>${esc(row.notes||'')}</td>
      <td>
        <button class="icon-btn edit" data-id="${row.id}">✏️</button>
        <button class="icon-btn danger delete" data-id="${row.id}">🗑</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // actions (delegated)
  tbody.onclick = (e)=>{
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('edit')) onEditWalk(id);
    if (btn.classList.contains('delete')) onDeleteWalk(id);
  };

  const walksScroll = document.querySelector('#section-points .table-scroll');
  if (walksScroll) walksScroll.scrollTop = walksScroll.scrollHeight;

  const {labels, values} = weeklyTotals();
  if (pointsChartRef){ pointsChartRef.destroy(); pointsChartRef=null; }
  if ($('#points-chart')) {
    pointsChartRef = weeklyPointsChart($('#points-chart'), labels, values);
    setWeekStatus();
  }
}

function onEditWalk(id){
  const row = DB.walks.find(r=>r.id===id);
  if (!row) return;
  editingWalkId = id;

  $('#walk-date').value = row.dateStr;
  $('#walk-distance').value = row.dist;
  $('#walk-time').value = `${row.minutes}:${String(row.seconds).padStart(2,'0')}`;
  $('#walk-incline').value = row.incline;

  // Elevation input in current UI units
  const elevForInput = (DB.settings.units==='english') ? Math.round(row.elev/0.3048) : Math.round(row.elev);
  $('#walk-elevation').value = elevForInput;

  $('#walk-notes').value = row.notes || '';
  $('#walk-submit').textContent = 'Save';
  $('#walk-cancel-edit').style.display = 'inline-block';
}
$('#walk-cancel-edit').onclick = ()=>{
  editingWalkId = null;
  $('#points-form').reset();
  $('#walk-submit').textContent = 'Add Walk';
  $('#walk-cancel-edit').style.display = 'none';
};
function onDeleteWalk(id){
  if (!confirm('Delete this walk?')) return;
  const idx = DB.walks.findIndex(r=>r.id===id);
  if (idx>=0){ DB.walks.splice(idx,1); save(); renderWalks(); }
}

$('#points-form').addEventListener('submit',(e)=>{
  e.preventDefault();
  const d = $('#walk-date').value;
  const dist = Number($('#walk-distance').value);
  const [mm, ss] = parseMmSs($('#walk-time').value);
  const incline = Number($('#walk-incline').value || 0);
  const elevRaw = $('#walk-elevation').value ? Number($('#walk-elevation').value) : null;
  const notes = $('#walk-notes').value;

  // Elevation: English (ft) -> meters; Metric remains meters
  let elevMeters = DB.settings.homeElevationMeters;
  if (elevRaw!=null && isFinite(elevRaw)){
    elevMeters = (DB.settings.units === 'english') ? (elevRaw * 0.3048) : elevRaw;
  }

  // Compute points
  const calc = Calc.finalPoints({
    distanceMiles: dist, minutes:mm, seconds:ss,
    inclinePct: incline, elevationMeters: elevMeters,
    gender: DB.settings.gender, genderFactor: DB.settings.genderFactor,
    inclineTable: DB.settings.inclineTable, gamma: DB.settings.elevationGamma,
    coeff: DB.settings.coeff
  });

  const date = new Date(d+'T00:00:00');

  if (editingWalkId){
    const row = DB.walks.find(r=>r.id===editingWalkId);
    if (row){
      row.date = date;
      row.dateStr = d;
      row.dist = dist;
      row.minutes = mm;
      row.seconds = ss;
      row.incline = incline;
      row.elev = elevMeters;
      row.notes = notes;
      row.calc = calc;
    }
    editingWalkId = null;
    $('#walk-submit').textContent = 'Add Walk';
    $('#walk-cancel-edit').style.display = 'none';
    $('#points-form').reset();
  } else {
    DB.walks.push({ id:uid(), date, dateStr:d, dist, minutes:mm, seconds:ss, incline, elev:elevMeters, notes, calc });
    $('#points-form').reset();
  }
  save();
  renderWalks();
});

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
  const tmp = [...DB.daily].sort((a,b)=> a.date - b.date);
  const weights = [];
  const ma20 = [];
  tmp.forEach((r,i)=>{
    weights.push(r.weight);
    const window = Math.min(20, i+1);
    const slice = weights.slice(weights.length - window);
    ma20.push(slice.reduce((a,b)=>a+b,0)/slice.length);
  });

  const firstEntry = tmp[0];
  const startDate = firstEntry?.date ?? null;
  const startWeightForCalc = DB.settings.startWeight ?? firstEntry?.weight ?? null;
  let runMax = -Infinity;

  tmp.forEach((row,i)=>{
    const dLong = formatLongDate(row.date);
    const w = row.weight;
    const ma = ma20[i];

    const maPrev = (i>0) ? ma20[i-1] : null;
const lbsWeek = (i>=7) ? (ma20[i] - ma20[i-7]) : null;
const calsPerDay = (maPrev!=null) ? (-(ma - maPrev) * 3500) : 0;
const calsDisplay = -calsPerDay;

// running max for MA
runMax = Math.max(runMax, ma);
const lbsPlusMinus = ma - runMax;

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
      fmtNumber(ma,2,false,true),
      fmtNumber(calsDisplay,0,false,true),   // Calories/day (display sign)
      fmtNumber(lbsWeek,2,false,true),
      fmtSigned(lbsPlusMinus,2,false,true),
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
    rows.push([w.dateStr, w.dist, w.minutes, Number(w.seconds).toFixed(2), w.incline, w.elev, w.calc.final.toFixed(4), w.notes||'']);
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
  load();
  migrate();             // ensure old data shows correctly
  loadConfig().then(()=>{
    initSettings();
    renderDaily();
    renderWalks();
  });
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
function uid(){ return 'id_' + Math.random().toString(36).slice(2,10); }
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
  // Supports mm:ss or mm:ss.hh (hundredths)
  const m = s.match(/^(\d{1,3}):(\d{2})(?:\.(\d{1,2}))?$/);
  if (!m) return [0,0];
  const mm = Number(m[1]);
  const ss = Number(m[2]);
  const hh = m[3] ? Number(m[3]) : 0; // hundredths
  const seconds = ss + (hh / 100);
  return [mm, seconds];
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
      DB.daily.push({ id:uid(), date:d, dateStr:r[0], weight, notes:r[2]||'' });
    });
  } else if (type==='walks'){
    rows.slice(1).forEach(r=>{
      const d = new Date(r[0]+'T00:00:00'); if (isNaN(d)) return;
      const dist = Number(r[1]); const mm = Number(r[2]); const ss = Number(r[3]||0);
      const incline = Number(r[4]||0); const elevRaw = r[5]? Number(r[5]) : null;
      let elevMeters = DB.settings.homeElevationMeters;
      if (elevRaw!=null && isFinite(elevRaw)){
        elevMeters = (DB.settings.units === 'english') ? (elevRaw * 0.3048) : elevRaw;
      }
      const notes = r[6]||'';
      const calc = Calc.finalPoints({
        distanceMiles: dist, minutes:mm, seconds:ss, inclinePct:incline,
        elevationMeters:elevMeters, gender:DB.settings.gender, genderFactor:DB.settings.genderFactor,
        inclineTable:DB.settings.inclineTable, gamma:DB.settings.elevationGamma, coeff:DB.settings.coeff
      });
      DB.walks.push({ id:uid(), date:d, dateStr:r[0], dist, minutes:mm, seconds:ss, incline, elev:elevMeters, notes, calc });
    });
  }
}
function fmtTime(m,s){
  // Render as mm:ss.hh (always show 2 hundredths)
  const sec = Number(s||0);
  const whole = Math.floor(sec);
  const hund = Math.round((sec - whole) * 100);
  return `${String(m)}:${String(whole).padStart(2,'0')}.${String(hund).padStart(2,'0')}`;
}
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
function fmtElevation(meters){
  if (DB.settings.units==='metric') return `${Math.round(meters)} m`;
  const ft = Math.round(meters / 0.3048);
  return `${ft} ft`;
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
  return `mph: ${mph.toFixed(2)}\npace: ${paceStr}\nelev(${DB.settings.units==='english'?'ft':'m'}): ${fmtElevation(row.elev)}\nincline: ${row.incline.toFixed(1)}%`;
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