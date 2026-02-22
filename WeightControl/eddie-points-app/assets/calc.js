/* ----- calc.js -----
Core computations for BMI, moving averages, walking points.
The elevation model follows the barometric pressure drop with altitude and
applies a gentle exponent gamma to award more points at higher elevations.
- Sea level baseline multiplier = 1.00.
References:
- Standard atmosphere / barometric formula (pressure vs altitude) commonly used in engineering: p = 101.325*(1 - 2.25577e-5*h)^5.25588 (kPa) (EngineeringToolbox) 
- Oxygen fraction ~20.9% is constant; partial pressure drops with altitude, making aerobic work harder.
*/

// Unit helpers
export const U = {
  mph(distanceMiles, minutes, seconds) {
    const tHr = (minutes + seconds/60) / 60;
    if (tHr <= 0) return 0;
    return distanceMiles / tHr;
  },
  paceMinPerMile(distanceMiles, minutes, seconds) {
    const totalMin = minutes + seconds/60;
    if (distanceMiles <= 0) return 0;
    return totalMin / distanceMiles;
  },
  toCm(height, units) {
    return units === 'metric' ? height : height * 2.54;
  },
  toKg(weight, units) {
    return units === 'metric' ? weight : weight * 0.45359237;
  },
  bmi(weight, height, units) {
    const kg = U.toKg(weight, units);
    const cm = U.toCm(height, units);
    const m = cm / 100;
    if (m <= 0) return 0;
    return kg / (m*m);
  }
};

// Moving average (centered simple MA over last 7 entries)
export function movingAverage(values, window = 7) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - (window - 1));
    const slice = values.slice(start, i + 1).filter(v => typeof v === 'number' && !isNaN(v));
    out.push(slice.length ? (slice.reduce((a,b)=>a+b,0)/slice.length) : null);
  }
  return out;
}

// Standard-atmosphere pressure (kPa) vs altitude (m) – troposphere form
export function pressureKPa(hMeters) {
  const h = Math.max(0, hMeters); // clamp below sea level to 0 for simplicity
  return 101.325 * Math.pow(1 - 2.25577e-5 * h, 5.25588);
}

// Elevation multiplier: sea-level baseline = 1.00
export function elevationMultiplier(hMeters, gamma = 0.40) {
  const pSea = pressureKPa(0);
  const p = pressureKPa(hMeters);
  return Math.pow(pSea / p, gamma);
}

// Incline multiplier with linear interpolation over half-percent steps
export function inclineMultiplier(pct, table) {
  const t = table.slice().sort((a,b)=>a.pct-b.pct);
  if (pct <= t[0].pct) return t[0].mult;
  if (pct >= t[t.length-1].pct) return t[t.length-1].mult;
  let i = 1;
  while (i < t.length && pct > t[i].pct) i++;
  const lo = t[i-1], hi = t[i];
  const f = (pct - lo.pct) / (hi.pct - lo.pct);
  return lo.mult + f * (hi.mult - lo.mult);
}

/* Base points function
   We preserve Eddie’s “smooth, continuous” behavior by using a calibrated
   function of (distance, mph). You can refine coefficients in config if desired.
   To match your examples closely, we use:

   base = distanceMiles * (A + B*mph + C*mph^2)

   The default coefficients here are tuned to approximate your provided cases.
   If you want me to drop in the exact coefficients from your workbook later,
   just send the latest file and I’ll swap them in; the rest of the pipeline stays intact.
*/
export function basePoints(distanceMiles, mph, coeff={A:1.55, B:0.65, C:0.05}) {
  return distanceMiles * Math.max(0, (coeff.A + coeff.B * mph + coeff.C * mph * mph));
}

/* Final points:
   Points = Base * Incline * Elevation * Gender
*/
export function finalPoints({
  distanceMiles, minutes, seconds, inclinePct, elevationMeters,
  gender='male', genderFactor={male:1.00, female:1.25},
  inclineTable=[], gamma=0.40, coeff
}) {
  const mph = U.mph(distanceMiles, minutes, seconds);
  const base = basePoints(distanceMiles, mph, coeff);
  const inc = inclineMultiplier(inclinePct || 0, inclineTable);
  const elev = elevationMultiplier(elevationMeters || 0, gamma);
  const g = (genderFactor[gender] ?? 1.0);
  return {
    mph, base, inc, elev, g,
    final: base * inc * elev * g
  };
}