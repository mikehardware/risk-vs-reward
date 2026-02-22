/* charts.js – lightweight Chart.js helpers */
import { movingAverage } from './calc.js';

export function weightChart(ctx, rows){
  const labels = rows.map(r=>r.dateStr);
  const weights = rows.map(r=>r.weight);
  const ma7 = movingAverage(weights, 7);
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {label:'Weight', data:weights, borderColor:'#2b6cb0', backgroundColor:'transparent', tension:0.2},
        {label:'7‑day MA', data:ma7, borderColor:'#94a3b8', backgroundColor:'transparent', borderDash:[6,4], tension:0.2}
      ]
    },
    options: {
      responsive:true,
      scales:{
        x:{ grid:{ color:'rgba(148,163,184,0.2)'} },
        y:{ grid:{ color:'rgba(148,163,184,0.2)'} }
      },
      plugins:{ legend:{ display:true } }
    }
  });
}

export function weeklyPointsChart(ctx, weekLabels, weekValues){
  // Build a goal line dataset aligned with the bars
  const goal = weekLabels.map(()=>100);

  return new Chart(ctx, {
    type:'bar',
    data:{
      labels:weekLabels,
      datasets:[
        { label:'Points', data:weekValues, backgroundColor:'#2b6cb0' },
        { label:'Goal 100', type:'line', data:goal, borderColor:'#16a34a', backgroundColor:'transparent', borderWidth:2, pointRadius:0 }
      ]
    },
    options:{
      responsive:true,
      scales:{
        x:{ grid:{ color:'rgba(148,163,184,0.2)'} },
        y:{ grid:{ color:'rgba(148,163,184,0.2)'}, suggestedMax:150 }
      },
      plugins:{ legend:{ display:true } }
    }
  });
}