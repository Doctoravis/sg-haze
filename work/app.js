(function () {
'use strict';
const H = window.HAZE;
const NOTES_ALL = window.HAZE_NOTES;
// data.js is rebuilt on a schedule. The refresh button fetches the hours since that build straight from
// NEA in the visitor's browser and keeps them for this tab as an overlay, applied here before anything
// is computed. An overlay older than the current build is ignored.
const BUILT_LAST = H.air.t[H.air.t.length - 1], BUILT_RAIN_LAST = H.rain.t[H.rain.t.length - 1];
let LIVE_AT = '';
(function applyLive() {
  let o = null;
  try { o = JSON.parse(sessionStorage.getItem('hazeLive') || 'null'); } catch (e) { o = null; }
  if (!o || !(o.at > H.built)) return;
  const REGS = ['north', 'south', 'east', 'west', 'central'];
  const dates = Object.keys(o.days);
  const keep = (t) => !dates.some((d) => t.startsWith(d));
  let rows = H.air.t.map((t, i) => [t, REGS.map((g) => H.air.psi[g][i]), REGS.map((g) => H.air.pm1[g][i]), REGS.map((g) => H.air.pm24[g][i])]).filter((r) => keep(r[0]));
  let rain = H.rain.t.map((t, i) => [t, H.rain.mm[i], H.rain.wet[i]]);
  if (o.rain) rain = rain.filter((r) => r[0] < o.rain.from).concat(o.rain.rows);
  dates.forEach((d) => { rows = rows.concat(o.days[d].air); });
  rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  H.air.t = rows.map((r) => r[0]);
  REGS.forEach((g, k) => { H.air.psi[g] = rows.map((r) => r[1][k]); H.air.pm1[g] = rows.map((r) => r[2][k]); H.air.pm24[g] = rows.map((r) => r[3][k]); });
  H.rain = { t: rain.map((r) => r[0]), mm: rain.map((r) => r[1]), wet: rain.map((r) => r[2]) };
  if (o.wx && o.wx.time && o.wx.time.length) {
    const h = H.wx.hourly, cut = h.time.findIndex((t) => t >= o.wx.time[0]), n = cut < 0 ? h.time.length : cut;
    H.wx.hourly = { time: h.time.slice(0, n).concat(o.wx.time), wind_speed_10m: h.wind_speed_10m.slice(0, n).concat(o.wx.wind_speed_10m), wind_direction_10m: h.wind_direction_10m.slice(0, n).concat(o.wx.wind_direction_10m) };
  }
  LIVE_AT = o.at;
})();
const $ = (s) => document.querySelector(s);
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const REG = ['north', 'south', 'east', 'west', 'central'];
const REGZH = { north: '北区', south: '南区', east: '东区', west: '西区', central: '中区' };
const HOUR = 3600e3, DAY = 24 * HOUR;
// All times are Singapore wall-clock, stored as "fake UTC" ms so the page reads the same in any viewer timezone.
const ms = (s) => Date.parse(s.slice(0, 16) + ':00Z');
const pad = (n) => String(n).padStart(2, '0');
const dOf = (m) => new Date(m);
const fmtDT = (m) => { const d = dOf(m); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${pad(d.getUTCHours())}:00`; };
const fmtMD = (m) => { const d = dOf(m); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
const fmtCN = (m) => { const d = dOf(m); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`; };
const isoD = (m) => dOf(m).toISOString().slice(0, 10);
const mean = (a) => { const v = a.filter((x) => x != null && !isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const median = (a) => { const v = a.filter((x) => x != null).slice().sort((x, y) => x - y); if (!v.length) return null; const k = (v.length - 1) / 2; return (v[Math.floor(k)] + v[Math.ceil(k)]) / 2; };
const quant = (a, q) => { const v = a.slice().sort((x, y) => x - y); const k = (v.length - 1) * q, f = Math.floor(k); return v[f] + (v[Math.min(f + 1, v.length - 1)] - v[f]) * (k - f); };
const r0 = (x) => (x == null ? '—' : Math.round(x));
const r1 = (x) => (x == null ? '—' : (Math.round(x * 10) / 10).toFixed(1));
const COMPASS = ['北', '东北偏北', '东北', '东北偏东', '东', '东南偏东', '东南', '东南偏南', '南', '西南偏南', '西南', '西南偏西', '西', '西北偏西', '西北', '西北偏北'];
const compass = (deg) => COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
const southerly = (deg) => deg >= 100 && deg <= 260;

// ---------- bands ----------
const PSI_B = [[50, '良好', '--good'], [100, '中等', '--mod'], [200, '不健康', '--unh'], [300, '非常不健康', '--vunh'], [1e9, '危险', '--haz']];
const PM_B = [[55, '第 I 级 正常', '--good'], [150, '第 II 级 升高', '--unh'], [250, '第 III 级 高', '--vunh'], [1e9, '第 IV 级 非常高', '--haz']];
const band = (v, B) => B.find((b) => v <= b[0]);
const onBandInk = (tok) => (tok === '--mod' || tok === '--haz' || tok === '--good' ? '#fff' : '#111');

// ---------- air data ----------
const T = H.air.t.map(ms);
const IDX = new Map(T.map((t, i) => [t, i]));
const N = T.length;
const T0 = Date.parse('2026-09-01T00:00:00Z'), TEND = T[N - 1];
function stat(metric, i) {
  const v = REG.map((g) => H.air[metric][g][i]).filter((x) => x != null);
  if (!v.length) return null;
  return { min: Math.min(...v), max: Math.max(...v), mean: v.reduce((s, x) => s + x, 0) / v.length, argmax: REG.find((g) => H.air[metric][g][i] === Math.max(...v)) };
}
const pmMean = T.map((_, i) => { const s = stat('pm1', i); return s ? s.mean : null; });
const psiMax = T.map((_, i) => { const s = stat('psi', i); return s ? s.max : null; });

// rain: API hour "2026-09-15T23" covers 23:00-23:55, i.e. the hour ending 24:00 -> align to NEA hour-ending stamps
const RAIN = new Map();
H.rain.t.forEach((k, i) => RAIN.set(ms(k + ':00') + HOUR, { mm: H.rain.mm[i], wet: H.rain.wet[i] }));
const rainAt = (t) => RAIN.get(t) || { mm: 0, wet: 0 };

// wind (Open-Meteo, SGT)
const WX = H.wx.hourly;
const WT = WX.time.map(ms);
const WIDX = new Map(WT.map((t, i) => [t, i]));

// days
const DAYS = [];
for (let t = T0; t <= TEND; t += DAY) DAYS.push(t);
const daily = DAYS.map((d) => {
  let maxPsi = null, maxPm = null, rain = 0, arg = null, u = 0, v = 0, n = 0;
  for (let h = 0; h < 24; h++) {
    const t = d + h * HOUR, i = IDX.get(t);
    if (i != null) {
      const s = stat('psi', i); if (s && (maxPsi == null || s.max > maxPsi)) { maxPsi = s.max; arg = { g: s.argmax, t }; }
      const p = stat('pm1', i); if (p && (maxPm == null || p.max > maxPm)) maxPm = p.max;
    }
    rain += rainAt(t + HOUR).mm;
    const w = WIDX.get(t);
    if (w != null && WX.wind_speed_10m[w] != null) {
      const rad = WX.wind_direction_10m[w] * Math.PI / 180, sp = WX.wind_speed_10m[w];
      u += -sp * Math.sin(rad); v += -sp * Math.cos(rad); n++;
    }
  }
  const dir = n ? ((Math.atan2(-u / n, -v / n) * 180 / Math.PI) + 360) % 360 : null;
  return { d, maxPsi, maxPm, rain, arg, wdir: dir, wspd: n ? Math.hypot(u / n, v / n) : null };
});

// ---------- rain events ----------
function findEvents() {
  const hrs = [...RAIN.keys()].sort((a, b) => a - b);
  const ev = [];
  let cur = null;
  for (const t of hrs) {
    const r = RAIN.get(t);
    const wet = r.mm >= 0.1 || r.wet >= 0.15;
    if (!wet) continue;
    if (cur && t - cur.end <= 3 * HOUR) { cur.end = t; cur.mm += r.mm; cur.maxWet = Math.max(cur.maxWet, r.wet); }
    else { if (cur) ev.push(cur); cur = { start: t - HOUR, end: t, mm: r.mm, maxWet: r.wet }; }
  }
  if (cur) ev.push(cur);
  const out = [];
  for (const e of ev) {
    if (e.mm < 0.3 && e.maxWet < 0.25) continue;
    const pre = mean([0, 1, 2].map((k) => { const i = IDX.get(e.start - k * HOUR); return i == null ? null : pmMean[i]; }));
    if (pre == null || pre < 20) continue;
    let mn = Infinity, tmin = null;
    for (let t = e.start + HOUR; t <= e.end + 3 * HOUR; t += HOUR) { const i = IDX.get(t); if (i != null && pmMean[i] != null && pmMean[i] < mn) { mn = pmMean[i]; tmin = t; } }
    if (tmin == null) continue;
    let rec = null, open = false;
    for (let t = tmin + HOUR; ; t += HOUR) {
      if (t > TEND) { open = true; break; }
      const i = IDX.get(t);
      if (i != null && pmMean[i] != null && pmMean[i] >= 0.9 * pre) { rec = Math.max(0, (t - e.end) / HOUR); break; }
    }
    const i0 = IDX.get(e.start), i1 = IDX.get(e.start + DAY);
    out.push({ ...e, pre, min: mn, drop: (pre - mn) / pre, rec, open, dPsi: i0 != null && i1 != null ? psiMax[i1] - psiMax[i0] : null });
  }
  return out;
}
const EVENTS = findEvents();

// ---------- theme ----------
function C() {
  return {
    ink: css('--ink'), ink2: css('--ink2'), muted: css('--muted'), line: css('--line'), line2: css('--line2'), panel: css('--panel'),
    accent: css('--accent'), accentWash: css('--accent-wash'), rain: css('--rain'), rainWash: css('--rain-wash'),
    good: css('--good'), mod: css('--mod'), unh: css('--unh'), vunh: css('--vunh'), haz: css('--haz'),
    s: [css('--s1'), css('--s2'), css('--s3'), css('--s4'), css('--s5')],
    seq: [css('--seq0'), css('--seq1'), css('--seq2'), css('--seq3'), css('--seq4')],
  };
}
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const BODY = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
function tipBase(c) {
  return { backgroundColor: c.panel, borderColor: c.line, textStyle: { color: c.ink, fontFamily: BODY, fontSize: 12 }, extraCssText: 'box-shadow:0 4px 16px rgba(0,0,0,.15);border-radius:8px;' };
}
function axisBase(c) {
  return { axisLine: { lineStyle: { color: c.line } }, axisTick: { lineStyle: { color: c.line } }, axisLabel: { color: c.muted, fontFamily: MONO, fontSize: 11 }, splitLine: { lineStyle: { color: c.line2 } } };
}
const charts = {};
function mk(id) { if (!charts[id]) charts[id] = echarts.init(document.getElementById(id), null, { renderer: 'canvas' }); return charts[id]; }
window.addEventListener('resize', () => { Object.values(charts).forEach((c) => c.resize()); sizeMapText(); });

// ---------- header ----------
function renderHeader() {
  const c = C();
  $('#asof').textContent = '2026 年 ' + fmtCN(TEND) + ' ' + pad(dOf(TEND).getUTCHours()) + ':00';
  const last = N - 1, sp = stat('psi', last), s1 = stat('pm1', last);
  const peak = { v: -1 };
  T.forEach((t, i) => REG.forEach((g) => { const v = H.air.psi[g][i]; if (v != null && v > peak.v) Object.assign(peak, { v, g, t }); }));
  const unhDays = daily.filter((d) => d.maxPsi > 100).length;
  const unhHours = psiMax.filter((v) => v > 100).length;
  const rainTot = daily.reduce((s, d) => s + d.rain, 0);
  const bp = band(sp.max, PSI_B), bm = band(s1.max, PM_B);
  $('#kpis').innerHTML = [
    [`${sp.min}–${sp.max}`, `最新 24 小时 PSI（${fmtDT(TEND)}）· ${bp[1]}`, bp[2]],
    [`${s1.min}–${s1.max}<small> µg/m³</small>`, `最新 1 小时 PM2.5 · ${bm[1]}`, bm[2]],
    [`${peak.v}`, `9 月以来最高 24 小时 PSI · ${REGZH[peak.g]} ${fmtDT(peak.t)}`, band(peak.v, PSI_B)[2]],
    [`${unhDays}<small> / ${DAYS.length} 天</small>`, `出现过不健康（PSI>100）的天数 · 共 ${unhHours} 小时`, '--unh'],
    [`${Math.round(rainTot)}<small> mm</small>`, '9 月 1 日以来全岛平均累计雨量（NEA 雨量站）', '--rain'],
    [`${FT.pct > 0 ? '+' : ''}${FT.pct}<small>%</small>`, `卫星火点指数：近 7 天比前 7 天（截至 ${FT.last.slice(5).replace('-', '/')}）`, '--accent'],
  ].map(([v, l, tok]) => `<div class="kpi"><div class="v" style="border-left:3px solid var(${tok});padding-left:8px">${v}</div><div class="l">${l}</div></div>`).join('');
  const risk7 = mean(risk.slice(0, 7));
  const pills = [
    [risk7 >= 0.45 ? '--vunh' : risk7 >= 0.25 ? '--unh' : '--good', `未来 7 天烟霾输送风险：${risk7 >= 0.45 ? '高' : risk7 >= 0.25 ? '中' : '低'}`],
    [SRC.ratio >= 0.9 ? '--good' : SRC.ratio >= 0.6 ? '--unh' : '--haz', `源区未来 16 天雨量约为常年的 ${Math.round(SRC.ratio * 100)}%`],
    [FT.pct <= -40 ? '--good' : FT.pct >= 20 ? '--haz' : '--unh', `火点指数近 7 天 ${FT.pct > 0 ? '+' : ''}${FT.pct}%`],
    ['--haz', NOTES_ALL.ensoPill],
  ];
  $('#builtTop').textContent = (LIVE_AT || H.built).slice(5);
  $('#fcTop').textContent = (H.fcBuilt || H.built).slice(5);
  $('#statusRow').innerHTML = pills.map(([t, s]) => `<span class="pill"><span class="dot" style="background:var(${t})"></span>${s}</span>`).join('');
  $('#bandLegend').innerHTML = PSI_B.map((b, i) => `<span><i style="background:var(${b[2]})"></i>${b[1]} ${i ? PSI_B[i - 1][0] + 1 : 0}${b[0] < 1e8 ? '–' + b[0] : '+'}</span>`).join('');
}

// ---------- day chips ----------
let selDay = DAYS.length - 1;
function renderDays() {
  $('#days').innerHTML = daily.map((d, i) => {
    const b = d.maxPsi == null ? null : band(d.maxPsi, PSI_B);
    const bg = b ? `var(${b[2]})` : 'var(--line)';
    const ink = b ? onBandInk(b[2]) : 'var(--ink)';
    return `<button class="day" id="day-${i}" data-i="${i}" aria-pressed="${i === selDay}" style="background:${bg};color:${ink}" title="${fmtCN(d.d)} 最高 24h PSI ${r0(d.maxPsi)}，日雨量 ${r1(d.rain)} mm"><span>${dOf(d.d).getUTCDate()}</span><b>${r0(d.maxPsi)}</b></button>`;
  }).join('');
  $('#days').querySelectorAll('.day').forEach((b) => b.addEventListener('click', () => {
    const i = +b.dataset.i; setDay(i);
    zoomTo(DAYS[i] - DAY, DAYS[i] + 2 * DAY);
  }));
}

// ---------- main chart ----------
let metric = 'psi', view = 'range';
const METRIC = { psi: { name: '24 小时 PSI', unit: '', B: PSI_B }, pm1: { name: '1 小时 PM2.5', unit: 'µg/m³', B: PM_B }, pm24: { name: '24 小时 PM2.5', unit: 'µg/m³', B: null } };
function renderMain() {
  const c = C(), ch = mk('mainChart');
  let zoom = null;
  try { const o = ch.getOption(); zoom = o && o.dataZoom; } catch (e) { zoom = null; }
  const m = METRIC[metric];
  const series = [];
  const thresholds = metric === 'psi' ? [[50, '良好/中等'], [100, '不健康'], [200, '非常不健康']] : metric === 'pm1' ? [[55, 'II 级'], [150, 'III 级']] : [];
  const markLine = { silent: true, symbol: 'none', lineStyle: { type: 'dashed', width: 1 }, label: { position: 'insideStartTop', fontSize: 10, fontFamily: BODY }, data: thresholds.map(([v, l]) => { const b = band(v + 1, m.B); return { yAxis: v, name: l, lineStyle: { color: c[{ '--good': 'good', '--mod': 'mod', '--unh': 'unh', '--vunh': 'vunh', '--haz': 'haz' }[b[2]]] }, label: { formatter: l, color: c.muted } }; }) };
  const markArea = { silent: true, itemStyle: { color: c.rainWash }, data: EVENTS.map((e) => [{ xAxis: e.start }, { xAxis: e.end }]) };
  if (view === 'range') {
    const lo = [], span = [], mx = [], mn = [];
    T.forEach((t, i) => { const s = stat(metric, i); lo.push([t, s ? s.min : null]); span.push([t, s ? s.max - s.min : null]); mx.push([t, s ? s.max : null]); mn.push([t, s ? Math.round(s.mean * 10) / 10 : null]); });
    series.push({ name: 'lo', type: 'line', data: lo, stack: 'r', symbol: 'none', lineStyle: { opacity: 0 }, silent: true, xAxisIndex: 0, yAxisIndex: 0, markArea, markLine });
    series.push({ name: '五区最低–最高', type: 'line', data: span, stack: 'r', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: c.muted, opacity: 0.22 }, silent: true, xAxisIndex: 0, yAxisIndex: 0 });
    series.push({ name: '最高区', type: 'line', data: mx, symbol: 'none', lineStyle: { width: 1.5, color: c.accent }, itemStyle: { color: c.accent }, xAxisIndex: 0, yAxisIndex: 0 });
    series.push({ name: '五区平均', type: 'line', data: mn, symbol: 'none', lineStyle: { width: 2, color: c.ink }, itemStyle: { color: c.ink }, xAxisIndex: 0, yAxisIndex: 0 });
    $('#mainLegend').innerHTML = `<span><i style="background:${c.accent}"></i>最高区</span><span><i style="background:${c.ink}"></i>五区平均</span><span><i style="background:${c.muted};opacity:.4"></i>五区最低–最高区间</span><span><i style="background:${c.rainWash};border:1px solid ${c.rain}"></i>降雨时段</span><span><i style="background:${c.accent}"></i>▲ 南向来风（输送烟霾）</span>`;
  } else {
    REG.forEach((g, k) => series.push({ name: REGZH[g], type: 'line', data: T.map((t, i) => [t, H.air[metric][g][i]]), symbol: 'none', lineStyle: { width: 1.5, color: c.s[k] }, itemStyle: { color: c.s[k] }, xAxisIndex: 0, yAxisIndex: 0, ...(k === 0 ? { markArea, markLine } : {}) }));
    $('#mainLegend').innerHTML = REG.map((g, k) => `<span><i style="background:${c.s[k]}"></i>${REGZH[g]}</span>`).join('') + `<span><i style="background:${c.rainWash};border:1px solid ${c.rain}"></i>降雨时段</span>`;
  }
  const rainData = [...RAIN.entries()].sort((a, b) => a[0] - b[0]).map(([t, r]) => [t - HOUR / 2, r.mm]);
  series.push({ name: '全岛平均雨量', type: 'bar', data: rainData, xAxisIndex: 1, yAxisIndex: 1, barMaxWidth: 4, itemStyle: { color: c.rain, borderRadius: [2, 2, 0, 0] } });
  const wind = [];
  WT.forEach((t, i) => {
    if (dOf(t).getUTCHours() % 3 !== 0 || t < T0 || t > TEND) return;
    const d = WX.wind_direction_10m[i], s = WX.wind_speed_10m[i];
    if (d == null) return;
    const sz = 7 + Math.min(s, 20) * 0.6;
    wind.push({ value: [t, 0, d, s], symbol: 'arrow', symbolSize: [sz * 0.6, sz], symbolRotate: -(d + 180), itemStyle: { color: southerly(d) ? c.accent : c.muted } });
  });
  series.push({ name: '风向', type: 'scatter', data: wind, xAxisIndex: 2, yAxisIndex: 2 });
  const ax = axisBase(c);
  const xa = (idx, show) => ({ type: 'time', gridIndex: idx, min: T0, max: TEND, ...ax, axisLabel: { ...ax.axisLabel, show, formatter: (v) => { const d = dOf(v); return d.getUTCHours() === 0 ? `${d.getUTCMonth() + 1}/${d.getUTCDate()}` : `${pad(d.getUTCHours())}:00`; } }, splitLine: { show: false } });
  ch.setOption({
    animation: false,
    textStyle: { fontFamily: BODY },
    grid: [{ left: 52, right: 18, top: 16, height: 300 }, { left: 52, right: 18, top: 350, height: 90 }, { left: 52, right: 18, top: 458, height: 38 }],
    xAxis: [xa(0, true), xa(1, false), xa(2, false)],
    yAxis: [
      { type: 'value', gridIndex: 0, name: m.name + (m.unit ? ` (${m.unit})` : ''), nameTextStyle: { color: c.muted, fontSize: 11, align: 'left' }, min: 0, ...ax },
      { type: 'value', gridIndex: 1, name: '雨量 mm/时', nameTextStyle: { color: c.muted, fontSize: 11, align: 'left' }, ...ax, splitNumber: 2 },
      { type: 'value', gridIndex: 2, min: -1, max: 1, show: false, name: '风' },
    ],
    axisPointer: { link: [{ xAxisIndex: 'all' }], lineStyle: { color: c.ink2 } },
    tooltip: { trigger: 'axis', ...tipBase(c), formatter: (ps) => mainTip(ps, c) },
    dataZoom: [{ type: 'inside', xAxisIndex: [0, 1, 2] }, { type: 'slider', xAxisIndex: [0, 1, 2], bottom: 6, height: 22, borderColor: c.line, textStyle: { color: c.muted, fontSize: 10 }, fillerColor: c.rainWash, labelFormatter: (v) => fmtDT(v), dataBackground: { lineStyle: { color: c.muted }, areaStyle: { color: c.line } } }],
    graphic: [{ type: 'text', left: 56, top: 460, style: { text: '新加坡地面风（每 3 小时）', fill: c.muted, fontSize: 10, fontFamily: BODY } }],
    series,
  }, { notMerge: true });
  if (zoom && zoom[0] && zoom[0].startValue != null) ch.dispatchAction({ type: 'dataZoom', startValue: zoom[0].startValue, endValue: zoom[0].endValue });
}
function nearestT(v) { return Math.round(v / HOUR) * HOUR; }
function mainTip(ps, c) {
  const t = nearestT(ps[0].axisValue), i = IDX.get(t);
  let h = `<div style="font-family:${MONO};font-weight:600;margin-bottom:4px">${fmtCN(t)} ${pad(dOf(t).getUTCHours())}:00</div>`;
  if (i != null) {
    const m = METRIC[metric];
    h += `<div style="color:${c.muted};font-size:11px">${m.name}</div>`;
    h += REG.map((g, k) => { const v = H.air[metric][g][i]; return `<div style="display:flex;justify-content:space-between;gap:14px"><span>${view === 'regions' ? `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${c.s[k]};margin-right:5px"></span>` : ''}${REGZH[g]}</span><b style="font-family:${MONO}">${v ?? '—'}</b></div>`; }).join('');
  }
  const r = rainAt(t);
  h += `<div style="margin-top:4px;border-top:1px solid ${c.line};padding-top:4px">雨量 <b style="font-family:${MONO}">${r1(r.mm)}</b> mm · 雨站覆盖 ${Math.round(r.wet * 100)}%</div>`;
  const w = WIDX.get(t);
  if (w != null) h += `<div>风：来自${compass(WX.wind_direction_10m[w])} ${r0(WX.wind_speed_10m[w])} km/h${southerly(WX.wind_direction_10m[w]) ? ` <span style="color:${c.accent}">（输送方向）</span>` : ''}</div>`;
  return h;
}
function zoomTo(a, b) {
  mk('mainChart').dispatchAction({ type: 'dataZoom', startValue: Math.max(T0, a), endValue: Math.min(TEND, b) });
  document.getElementById('mainChart').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- rain table & insights ----------
function renderRain() {
  const rows = EVENTS.slice().sort((a, b) => b.start - a.start);
  const maxMm = Math.max(...EVENTS.map((e) => e.mm), 1);
  $('#rainTable tbody').innerHTML = rows.map((e) => {
    const dur = Math.round((e.end - e.start) / HOUR);
    const fell = e.drop > 0.05;
    const rec = !fell ? '未下降' : e.rec != null ? `${Math.round(e.rec)} 小时` : e.open ? '尚未回升' : '—';
    const dropTxt = fell ? `−${Math.round(e.drop * 100)}%` : e.drop < 0 ? `+${Math.round(-e.drop * 100)}%` : '≈0';
    const dp = e.dPsi == null ? '—' : (e.dPsi > 0 ? '+' : '') + e.dPsi;
    return `<tr data-s="${e.start}"><td class="mono">${fmtDT(e.start)}</td><td class="mono">${dur} h</td><td class="mono">${r1(e.mm)} mm<span class="bar" style="width:${Math.max(3, 60 * e.mm / maxMm)}px"></span></td><td class="mono">${Math.round(e.maxWet * 100)}%</td><td class="mono">${r0(e.pre)}</td><td class="mono">${r0(e.min)}</td><td class="mono" style="font-weight:600;color:${fell ? 'var(--rain)' : 'var(--muted)'}">${dropTxt}</td><td class="mono">${rec}</td><td class="mono">${dp}</td></tr>`;
  }).join('');
  $('#rainTable tbody').querySelectorAll('tr').forEach((tr) => tr.addEventListener('click', () => { const s = +tr.dataset.s; zoomTo(s - 1.5 * DAY, s + 1.5 * DAY); }));
  const wide = EVENTS.filter((e) => e.maxWet >= 0.5), local = EVENTS.filter((e) => e.maxWet < 0.5);
  const recs = EVENTS.filter((e) => e.rec != null && e.drop > 0.05).map((e) => e.rec);
  const wideRecs = wide.filter((e) => e.rec != null && e.drop > 0.05).map((e) => e.rec);
  const md = (a) => Math.round(median(a) * 100);
  const quick = recs.filter((x) => x <= 12).length;
  $('#rainInsights').innerHTML = [
    ['', `${EVENTS.length}`, '场有雾霾背景的降雨', `9 月以来 NEA 雨量站识别出的降雨时段中，雨前 PM2.5 ≥ 20 µg/m³ 的有 ${EVENTS.length} 场。`],
    ['', `−${md(EVENTS.map((e) => e.drop))}%`, '1 小时 PM2.5 中位降幅', `大范围降雨（≥50% 雨站有雨，${wide.length} 场）中位降幅 −${wide.length ? md(wide.map((e) => e.drop)) : '—'}%；局地阵雨（${local.length} 场）−${local.length ? md(local.map((e) => e.drop)) : '—'}%。`],
    ['amber', `${recs.length ? Math.round(median(recs)) : '—'} 小时`, '雨停后回到雨前水平的中位用时', `${quick} / ${recs.length} 场在 12 小时内就回到雨前 90%；大范围降雨后中位 ${wideRecs.length ? Math.round(median(wideRecs)) : '—'} 小时。本地降雨只冲刷已到达的烟霾，源区火点和南风不变，烟霾很快补回。`],
    ['amber', '滞后 1 天', '24 小时 PSI 反应慢', `PSI 是 24 小时滑动平均，一场几小时的雨往往只让 PSI 小幅下降；看即时改善要看 1 小时 PM2.5（切换上方指标）。`],
  ].map(([cls, big, lab, txt]) => `<div class="ins ${cls}"><div class="big">${big}</div><b>${lab}</b><span class="muted">${txt}</span></div>`).join('');
}

// ---------- heatmap & diurnal ----------
function renderHeat() {
  const c = C(), ch = mk('heatChart');
  const data = [];
  T.forEach((t, i) => { const d = Math.floor((t - T0) / DAY), h = dOf(t).getUTCHours(); if (pmMean[i] != null) data.push([h, d, Math.round(pmMean[i])]); });
  const ax = axisBase(c);
  ch.setOption({
    animation: false,
    grid: { left: 44, right: 12, top: 8, bottom: 62 },
    tooltip: { ...tipBase(c), formatter: (p) => `${fmtCN(DAYS[p.value[1]])} ${pad(p.value[0])}:00<br>全岛平均 1h PM2.5 <b style="font-family:${MONO}">${p.value[2]}</b> µg/m³<br>雨量 ${r1(rainAt(DAYS[p.value[1]] + p.value[0] * HOUR).mm)} mm` },
    xAxis: { type: 'category', data: [...Array(24).keys()].map((h) => pad(h)), ...ax, splitLine: { show: false }, name: '时', nameTextStyle: { color: c.muted } },
    yAxis: { type: 'category', data: DAYS.map(fmtMD), inverse: true, ...ax, splitLine: { show: false }, axisLabel: { ...ax.axisLabel, interval: 2 } },
    visualMap: { min: 0, max: 100, calculable: false, orient: 'horizontal', left: 'center', bottom: 4, itemHeight: 180, itemWidth: 10, inRange: { color: c.seq }, textStyle: { color: c.muted, fontSize: 10 }, text: ['100+ µg/m³', '0'] },
    series: [{ type: 'heatmap', data, itemStyle: { borderColor: c.panel, borderWidth: 1 } }],
  }, { notMerge: true });
  ch.off('click'); ch.on('click', (p) => { const d = p.value[1]; setDay(d); zoomTo(DAYS[d] - DAY, DAYS[d] + 2 * DAY); });
}
function renderDiurnal() {
  const c = C(), ch = mk('diurnalChart');
  const wetDay = new Set(daily.filter((d) => d.rain >= 3).map((d) => Math.floor((d.d - T0) / DAY)));
  const acc = { all: [], wet: [], dry: [] };
  for (let h = 0; h < 24; h++) { acc.all.push([]); acc.wet.push([]); acc.dry.push([]); }
  T.forEach((t, i) => { if (pmMean[i] == null) return; const h = dOf(t).getUTCHours(), d = Math.floor((t - T0) / DAY); acc.all[h].push(pmMean[i]); (wetDay.has(d) ? acc.wet : acc.dry)[h].push(pmMean[i]); });
  const all = acc.all.map((a) => r1(mean(a)) * 1), wet = acc.wet.map((a) => (a.length ? Math.round(mean(a) * 10) / 10 : null)), dry = acc.dry.map((a) => (a.length ? Math.round(mean(a) * 10) / 10 : null));
  const ax = axisBase(c);
  ch.setOption({
    animation: false,
    grid: { left: 40, right: 12, top: 30, bottom: 28 },
    legend: { top: 0, left: 0, textStyle: { color: c.ink2, fontSize: 11 }, itemWidth: 14, itemHeight: 3 },
    tooltip: { trigger: 'axis', ...tipBase(c), valueFormatter: (v) => (v == null ? '—' : v + ' µg/m³') },
    xAxis: { type: 'category', data: [...Array(24).keys()].map((h) => pad(h) + ':00'), ...ax, splitLine: { show: false }, axisLabel: { ...ax.axisLabel, interval: 3 } },
    yAxis: { type: 'value', ...ax, name: 'µg/m³', nameTextStyle: { color: c.muted, fontSize: 10 } },
    series: [
      { name: `无显著降雨日（${DAYS.length - wetDay.size} 天）`, type: 'line', data: dry, symbol: 'none', lineStyle: { width: 2, color: c.accent }, itemStyle: { color: c.accent } },
      { name: `降雨日 ≥3 mm（${wetDay.size} 天）`, type: 'line', data: wet, symbol: 'none', lineStyle: { width: 2, color: c.rain }, itemStyle: { color: c.rain } },
    ],
  }, { notMerge: true });
  const hi = all.indexOf(Math.max(...all)), lo = all.indexOf(Math.min(...all));
  const dMean = mean(dry.filter((x) => x != null)), wMean = mean(wet.filter((x) => x != null));
  const dayPeak = hi >= 9 && hi <= 19;
  const diff = Math.round((1 - wMean / dMean) * 100);
  $('#diurnalIns').innerHTML = [
    ['amber', `${pad(hi)}:00`, `全天最差时段（平均 ${all[hi]} µg/m³）`, `最干净约在 ${pad(lo)}:00（${all[lo]} µg/m³）。` + (dayPeak
      ? '白天偏南风增强时烟霾被持续输送进来，浓度在午后到傍晚累积到最高；夜间到上午相对较低。' + `户外活动宜安排在 ${pad(lo)}:00 前后。`
      : '夜间和清晨混合层低，烟霾贴地积聚；白天混合层抬升、午后常有阵雨，浓度回落。' + `户外活动宜安排在 ${pad(lo)}:00 前后。`)],
    diff >= 5
      ? ['', `${diff}%`, '降雨日全天平均比无雨日低', `降雨日 ${r1(wMean)} µg/m³，无雨日 ${r1(dMean)} µg/m³（1 小时 PM2.5，全岛平均）。`]
      : ['', `${diff > 0 ? '仅 ' + diff : diff}%`, '降雨日并不比无雨日干净', `降雨日 ${r1(wMean)} µg/m³，无雨日 ${r1(dMean)} µg/m³。本地阵雨只带来几小时的缓解，一天的平均水平主要取决于当天的风向和源区烟量。`],
  ].map(([cls, big, lab, txt]) => `<div class="ins ${cls}"><div class="big">${big}</div><b>${lab}</b><span class="muted">${txt}</span></div>`).join('');
}

// ---------- map ----------
const PLACES = [
  ['新加坡', 103.82, 1.35, 'sg'], ['廖内', 101.45, 0.5], ['占碑', 103.6, -1.6], ['巨港（南苏门答腊）', 104.75, -2.98], ['楠榜', 105.25, -5.1],
  ['坤甸（西加里曼丹）', 109.33, -0.03], ['帕朗卡拉亚（中加里曼丹）', 113.9, -2.2], ['马辰（南加里曼丹）', 114.6, -3.3], ['马来半岛', 102.3, 3.3], ['砂拉越', 112.6, 2.4],
];
const X = (lon) => (lon - 98) * 10, Y = (lat) => (4 - lat) * 10;
function drawMapSvg(i) {
  const c = C(), d = daily[i];
  let s = `<g class="boxes" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".35" stroke-dasharray="1.2 1.2"><rect x="${X(99)}" y="${Y(2.5)}" width="${X(106.3) - X(99)}" height="${Y(-6) - Y(2.5)}"/><rect x="${X(108.5)}" y="${Y(4)}" width="${X(118) - X(108.5)}" height="${Y(-4.5) - Y(4)}"/></g>`;
  for (const [n, lon, lat, k] of PLACES) {
    const x = X(lon), y = Y(lat);
    if (k === 'sg') s += `<circle cx="${x}" cy="${y}" r="1.4" fill="#ffd166" stroke="#111" stroke-width=".35"/>`;
    else s += `<circle cx="${x}" cy="${y}" r=".7" fill="#fff" stroke="#111" stroke-width=".25"/>`;
    s += `<text class="pl" x="${x + 1.6}" y="${y + 1}" fill="#fff" stroke="rgba(0,0,0,.75)" stroke-width=".6" paint-order="stroke" font-family='${BODY}' font-weight="${k === 'sg' ? 700 : 500}">${n}</text>`;
  }
  if (d.wdir != null) {
    const to = (d.wdir + 180) * Math.PI / 180, L = 9, x1 = X(103.82), y1 = Y(1.35);
    const x0 = x1 - Math.sin(to) * L, y0 = y1 + Math.cos(to) * L;
    const col = southerly(d.wdir) ? '#ffb454' : '#cfe3ee';
    s += `<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L10 5L0 10z" fill="${col}"/></marker></defs><line x1="${x0}" y1="${y0}" x2="${x1 - Math.sin(to) * 1.8}" y2="${y1 + Math.cos(to) * 1.8}" stroke="${col}" stroke-width="1" marker-end="url(#ah)"/>`;
  }
  s += `<text x="2" y="97" fill="#fff" stroke="rgba(0,0,0,.7)" stroke-width=".6" paint-order="stroke" class="pl" font-family='${MONO}'>NASA GIBS · NOAA-20 VIIRS · ${isoD(d.d)}</text>`;
  $('#mapSvg').innerHTML = s;
  sizeMapText();
}
function sizeMapText() {
  const w = $('#mapbox').clientWidth || 800;
  const fs = Math.max(2.6, 11.5 / (w / 200));
  document.querySelectorAll('#mapSvg .pl').forEach((t) => t.setAttribute('font-size', fs.toFixed(2)));
}
const NOTES = NOTES_ALL.days;
const SAT_DAYS = new Set(H.fire.map((f) => f.d));
// yesterday's and today's images can be replaced by a later build, so tie their URL to the build time
const BUST = '?v=' + encodeURIComponent(H.built);
// days newer than the last build have no stored image: load them straight from NASA GIBS (same request sat.ps1 makes)
const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&STYLES=&CRS=EPSG:4326&BBOX=-6,98,4,118&WIDTH=1200&HEIGHT=600';
const GIBS_LAYER = {
  tc: '&LAYERS=VIIRS_NOAA20_CorrectedReflectance_TrueColor,Coastlines_15m&FORMAT=image/jpeg',
  fire: '&LAYERS=VIIRS_NOAA20_Thermal_Anomalies_375m_All,VIIRS_SNPP_Thermal_Anomalies_375m_All&FORMAT=image/png&TRANSPARENT=TRUE',
  aod: '&LAYERS=VIIRS_NOAA20_AOD_Deep_Blue_Land_Ocean&FORMAT=image/png&TRANSPARENT=TRUE',
};
const nowSgt = () => new Date(Date.now() + 8 * HOUR);
// the NOAA-20 afternoon pass is published from about 16:00 SGT
const satReady = (ds) => { const n = nowSgt(), today = n.toISOString().slice(0, 10); return ds < today || (ds === today && n.getUTCHours() >= 16); };
const satUrl = (kind, ds) => (SAT_DAYS.has(ds) ? `sat/${kind}_${ds}.${kind === 'tc' ? 'jpg' : 'png'}${BUST}` : `${GIBS}${GIBS_LAYER[kind]}&TIME=${ds}`);
function setDay(i) {
  selDay = Math.max(0, Math.min(DAYS.length - 1, i));
  const d = daily[selDay], ds = isoD(d.d);
  $('#daySlider').value = selDay;
  $('#mapDate').textContent = ds;
  const hasSat = SAT_DAYS.has(ds) || satReady(ds);
  $('#mapbox').classList.toggle('empty', !hasSat);
  $('#noSat').hidden = hasSat;
  if (hasSat) {
    $('#imgTc').src = satUrl('tc', ds);
    $('#imgFire').src = satUrl('fire', ds);
    $('#imgAod').src = satUrl('aod', ds);
  }
  drawMapSvg(selDay);
  document.querySelectorAll('.day').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.i === selDay)));
  const f = H.fire.find((x) => x.d === ds) || {};
  const b = d.maxPsi != null ? band(d.maxPsi, PSI_B) : null;
  $('#dayTitle').textContent = fmtCN(d.d) + '（星期' + '日一二三四五六'[dOf(d.d).getUTCDay()] + '）';
  $('#dayKv').innerHTML = [
    ['最高 24 小时 PSI', d.maxPsi != null ? `${d.maxPsi} · ${b[1]}` : '—'],
    ['最高 1 小时 PM2.5', d.maxPm != null ? `${d.maxPm} µg/m³` : '—'],
    ['全岛平均日雨量', `${r1(d.rain)} mm`],
    ['新加坡日均风', d.wdir != null ? `来自${compass(d.wdir)} ${r0(d.wspd)} km/h` : '—'],
    ['火点指数 · 苏门答腊', f.sum != null ? f.sum.toLocaleString() : '待每日更新'],
    ['火点指数 · 加里曼丹', f.kal != null ? f.kal.toLocaleString() : '待每日更新'],
  ].map(([k, v]) => `<div class="kv"><span>${k}</span><span>${v}</span></div>`).join('') + (NOTES[ds] ? `<p class="note">${NOTES[ds]}</p>` : '');
  renderFire();
}
function renderFire() {
  const c = C(), ch = mk('fireChart');
  const ax = axisBase(c);
  ch.setOption({
    animation: false,
    grid: { left: 52, right: 12, top: 34, bottom: 26 },
    legend: { top: 0, left: 0, textStyle: { color: c.ink2, fontSize: 11 }, itemWidth: 12, itemHeight: 8 },
    tooltip: { trigger: 'axis', ...tipBase(c) },
    xAxis: { type: 'category', data: H.fire.map((f) => f.d.slice(5).replace('-', '/')), ...ax, splitLine: { show: false } },
    yAxis: { type: 'value', ...ax, name: '火点像素（相对）', nameTextStyle: { color: c.muted, fontSize: 10, align: 'left' } },
    series: [
      { name: '苏门答腊中南部', type: 'bar', data: H.fire.map((f) => f.sum), itemStyle: { color: c.s[0], borderRadius: [3, 3, 0, 0] }, barGap: '10%', markArea: { silent: true, itemStyle: { color: c.accentWash }, data: [[{ xAxis: selDay }, { xAxis: selDay }]] } },
      { name: '加里曼丹', type: 'bar', data: H.fire.map((f) => f.kal), itemStyle: { color: c.s[1], borderRadius: [3, 3, 0, 0] } },
    ],
  }, { notMerge: true });
  ch.getZr().off('click'); ch.getZr().on('click', (e) => { const p = ch.convertFromPixel({ gridIndex: 0 }, [e.offsetX, e.offsetY]); if (p && p[0] >= 0 && p[0] < DAYS.length) setDay(Math.round(p[0])); });
}
let playT = null;
function initMap() {
  $('#daySlider').max = DAYS.length - 1;
  $('#daySlider').addEventListener('input', (e) => setDay(+e.target.value));
  $('#prevDay').addEventListener('click', () => setDay(selDay - 1));
  $('#nextDay').addEventListener('click', () => setDay(selDay + 1));
  $('#playBtn').addEventListener('click', () => {
    if (playT) { clearInterval(playT); playT = null; $('#playBtn').textContent = '▶ 播放'; return; }
    if (selDay >= DAYS.length - 1) setDay(0);
    $('#playBtn').textContent = '❚❚ 暂停';
    playT = setInterval(() => { if (selDay >= DAYS.length - 1) { $('#playBtn').click(); return; } setDay(selDay + 1); }, 900);
  });
  const tog = (id, img) => $(id).addEventListener('change', (e) => { $(img).hidden = !e.target.checked; });
  tog('#lyrTc', '#imgTc'); tog('#lyrFire', '#imgFire'); tog('#lyrAod', '#imgAod'); tog('#lyrLbl', '#mapSvg');
  // warm the cache so playback is smooth
  setTimeout(() => SAT_DAYS.forEach((ds) => { new Image().src = `sat/tc_${ds}.jpg${BUST}`; new Image().src = `sat/fire_${ds}.png${BUST}`; }), 1500);
}

// ---------- forecast ----------
const ENS = H.ens;
function members(daily, base) { return Object.keys(daily).filter((k) => k === base || k.startsWith(base + '_member')); }
function ensProb(loc, base, test) {
  const d = ENS[loc].daily, keys = members(d, base);
  return d.time.map((_, j) => { const v = keys.map((k) => d[k][j]).filter((x) => x != null); return v.length ? v.filter(test).length / v.length : null; });
}
const pS = ensProb(0, 'wind_direction_10m_dominant', southerly);
const pSrcS = ensProb(1, 'precipitation_sum', (x) => x >= 5), pSrcK = ensProb(2, 'precipitation_sum', (x) => x >= 5), pSG = ensProb(0, 'precipitation_sum', (x) => x >= 5);
const pSrc = pSrcS.map((x, j) => (x + pSrcK[j]) / 2);
const risk = pS.map((x, j) => x * (1 - pSrc[j]) * (1 - pSG[j] / 2));
function renderRisk() {
  const c = C(), ch = mk('riskChart'), ax = axisBase(c);
  const days = ENS[0].daily.time.map((s) => s.slice(5).replace('-', '/'));
  const lvl = (r) => (r >= 0.45 ? c.vunh : r >= 0.25 ? c.unh : c.good);
  ch.setOption({
    animation: false,
    grid: { left: 40, right: 12, top: 34, bottom: 26 },
    legend: { top: 0, left: 0, textStyle: { color: c.ink2, fontSize: 11 }, itemWidth: 14, itemHeight: 6, data: ['输送风险指数', '新加坡南向来风概率', '源区降雨≥5mm 概率'] },
    tooltip: { trigger: 'axis', ...tipBase(c), valueFormatter: (v) => (v == null ? '—' : Math.round(v) + '%') },
    xAxis: { type: 'category', data: days, ...ax, splitLine: { show: false } },
    yAxis: { type: 'value', min: 0, max: 100, ...ax, axisLabel: { ...ax.axisLabel, formatter: '{value}%' } },
    series: [
      { name: '输送风险指数', type: 'bar', data: risk.map((r) => ({ value: Math.round(r * 100), itemStyle: { color: lvl(r), borderRadius: [3, 3, 0, 0] } })), itemStyle: { color: c.unh }, barMaxWidth: 18 },
      { name: '新加坡南向来风概率', type: 'line', data: pS.map((x) => Math.round(x * 100)), symbol: 'circle', symbolSize: 5, lineStyle: { width: 2, color: c.accent }, itemStyle: { color: c.accent } },
      { name: '源区降雨≥5mm 概率', type: 'line', data: pSrc.map((x) => Math.round(x * 100)), symbol: 'circle', symbolSize: 5, lineStyle: { width: 2, color: c.rain }, itemStyle: { color: c.rain } },
    ],
  }, { notMerge: true });
}
function renderCams() {
  const c = C(), ch = mk('camsChart'), ax = axisBase(c);
  const from = TEND - 7 * DAY;
  const obs = T.map((t, i) => [t, pmMean[i] != null ? Math.round(pmMean[i] * 10) / 10 : null]).filter((p) => p[0] >= from);
  const cams = H.cams.hourly.time.map((s, j) => [ms(s), H.cams.hourly.pm2_5[j]]).filter((p) => p[0] >= from);
  ch.setOption({
    animation: false,
    grid: { left: 40, right: 12, top: 34, bottom: 26 },
    legend: { top: 0, left: 0, textStyle: { color: c.ink2, fontSize: 11 }, itemWidth: 14, itemHeight: 3 },
    tooltip: { trigger: 'axis', ...tipBase(c), valueFormatter: (v) => (v == null ? '—' : v + ' µg/m³'), axisPointer: { label: { formatter: (p) => fmtDT(p.value) } } },
    xAxis: { type: 'time', ...ax, splitLine: { show: false }, axisLabel: { ...ax.axisLabel, formatter: (v) => fmtMD(v) } },
    yAxis: { type: 'value', ...ax, name: 'µg/m³', nameTextStyle: { color: c.muted, fontSize: 10 } },
    series: [
      { name: 'NEA 实测（五区平均 1h）', type: 'line', data: obs, symbol: 'none', lineStyle: { width: 2, color: c.s[0] }, itemStyle: { color: c.s[0] }, markLine: { silent: true, symbol: 'none', lineStyle: { color: c.muted, type: 'dashed' }, label: { formatter: '现在', color: c.muted, fontSize: 10 }, data: [{ xAxis: TEND }] } },
      { name: 'CAMS 模型', type: 'line', data: cams, symbol: 'none', lineStyle: { width: 2, color: c.s[1], type: [6, 3] }, itemStyle: { color: c.s[1] } },
    ],
  }, { notMerge: true });
}
const FC_NAMES = ['新加坡', '巨港（南苏门答腊）', '占碑', '北干巴鲁（廖内）', '帕朗卡拉亚（中加里曼丹）', '坤甸（西加里曼丹）', '马辰（南加里曼丹）'];
function renderFc16() {
  const c = C(), ch = mk('fc16Chart'), ax = axisBase(c);
  const days = H.fc16[0].daily.time;
  const data = [];
  H.fc16.forEach((L, r) => L.daily.precipitation_sum.forEach((v, j) => data.push([j, r, v == null ? null : Math.round(v * 10) / 10])));
  ch.setOption({
    animation: false,
    grid: { left: 170, right: 12, top: 6, bottom: 56 },
    tooltip: { ...tipBase(c), formatter: (p) => { const L = H.fc16[p.value[1]].daily, j = p.value[0]; return `${FC_NAMES[p.value[1]]} · ${days[j].slice(5)}<br>雨量 <b style="font-family:${MONO}">${p.value[2]}</b> mm · 降雨概率 ${L.precipitation_probability_max[j] ?? '—'}%<br>主导风：来自${compass(L.wind_direction_10m_dominant[j])}`; } },
    xAxis: { type: 'category', data: days.map((s) => s.slice(5).replace('-', '/')), ...ax, splitLine: { show: false } },
    yAxis: { type: 'category', data: FC_NAMES, inverse: true, ...ax, splitLine: { show: false }, axisLabel: { ...ax.axisLabel, fontFamily: BODY, color: c.ink2 } },
    visualMap: { type: 'piecewise', orient: 'horizontal', left: 'center', bottom: 0, pieces: [{ lt: 1, label: '<1' }, { gte: 1, lt: 5, label: '1–5' }, { gte: 5, lt: 10, label: '5–10' }, { gte: 10, lt: 20, label: '10–20' }, { gte: 20, label: '≥20 mm' }], inRange: { color: [css('--panel2'), '#b7d3f6', '#6da7ec', '#2a78d6', '#104281'] }, textStyle: { color: c.muted, fontSize: 10 }, itemWidth: 14, itemHeight: 10 },
    series: [{ type: 'heatmap', data, label: { show: true, fontSize: 9, fontFamily: MONO, color: '#fff', textBorderColor: 'rgba(0,0,0,.55)', textBorderWidth: 2, formatter: (p) => (p.value[2] >= 1 ? Math.round(p.value[2]) : '') }, itemStyle: { borderColor: c.panel, borderWidth: 2 } }],
  }, { notMerge: true });
}
// seasonal weekly
function seasWeekly(locs) {
  const S = H.seas, d0 = S[locs[0]].daily, keys = members(d0, 'precipitation_sum').filter((k) => k !== 'precipitation_sum');
  const W = 8, perMember = keys.map((k) => { const w = new Array(W).fill(0); for (let j = 0; j < W * 7 && j < d0.time.length; j++) { const v = mean(locs.map((l) => S[l].daily[k][j])); w[Math.floor(j / 7)] += v || 0; } return w; });
  const med = [], lo = [], hi = [];
  for (let w = 0; w < W; w++) { const col = perMember.map((m) => m[w]); med.push(quant(col, 0.5)); lo.push(quant(col, 0.1)); hi.push(quant(col, 0.9)); }
  const clim = [...Array(W).keys()].map((w) => mean(locs.map((l) => H.clim.rain[l][w])));
  return { med, lo, hi, clim, n: keys.length };
}
const SEAS_G = { sum: [1, 2], kal: [4, 6], sg: [0] };
let seasR = 'sum';
function renderSeas() {
  const c = C(), ch = mk('seasChart'), ax = axisBase(c), s = seasWeekly(SEAS_G[seasR]);
  const wk = H.clim.weeks.map((w) => fmtMD(Date.parse(w + 'T00:00:00Z')) + ' 起');
  ch.setOption({
    animation: false,
    grid: { left: 40, right: 12, top: 34, bottom: 26 },
    legend: { top: 0, left: 0, textStyle: { color: c.ink2, fontSize: 11 }, itemWidth: 14, itemHeight: 3, data: ['SEAS5 中位数', '1996–2025 同期平均'] },
    tooltip: { trigger: 'axis', ...tipBase(c), formatter: (ps) => { const j = ps[0].dataIndex; return `${wk[j]} 一周<br>预报中位数 <b style="font-family:${MONO}">${r0(s.med[j])}</b> mm（10–90%：${r0(s.lo[j])}–${r0(s.hi[j])}）<br>常年平均 <b style="font-family:${MONO}">${r0(s.clim[j])}</b> mm · 约为常年 ${Math.round(100 * s.med[j] / s.clim[j])}%`; } },
    xAxis: { type: 'category', data: wk, boundaryGap: false, ...ax, splitLine: { show: false } },
    yAxis: { type: 'value', ...ax, name: 'mm/周', nameTextStyle: { color: c.muted, fontSize: 10 } },
    series: [
      { name: 'lo', type: 'line', data: s.lo, stack: 'b', symbol: 'none', lineStyle: { opacity: 0 }, silent: true },
      { name: '10–90% 区间', type: 'line', data: s.hi.map((h, j) => h - s.lo[j]), stack: 'b', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: c.rain, opacity: 0.18 }, silent: true },
      { name: 'SEAS5 中位数', type: 'line', data: s.med.map((x) => Math.round(x)), symbol: 'circle', symbolSize: 5, lineStyle: { width: 2, color: c.rain }, itemStyle: { color: c.rain } },
      { name: '1996–2025 同期平均', type: 'line', data: s.clim.map((x) => Math.round(x)), symbol: 'none', lineStyle: { width: 2, color: c.ink2, type: [5, 4] }, itemStyle: { color: c.ink2 } },
    ],
  }, { notMerge: true });
}
function renderWindClim() {
  const c = C(), ch = mk('windClimChart'), ax = axisBase(c);
  const wk = H.clim.weeks.map((w) => fmtMD(Date.parse(w + 'T00:00:00Z')) + ' 起');
  ch.setOption({
    animation: false,
    grid: { left: 40, right: 12, top: 34, bottom: 26 },
    legend: { top: 0, left: 0, textStyle: { color: c.ink2, fontSize: 11 }, itemWidth: 14, itemHeight: 3 },
    tooltip: { trigger: 'axis', ...tipBase(c), valueFormatter: (v) => v + '%' },
    xAxis: { type: 'category', data: wk, boundaryGap: false, ...ax, splitLine: { show: false } },
    yAxis: { type: 'value', min: 0, max: 100, ...ax, axisLabel: { ...ax.axisLabel, formatter: '{value}%' } },
    series: [
      { name: '全部年份', type: 'line', data: H.clim.southAll, symbol: 'circle', symbolSize: 5, lineStyle: { width: 2, color: c.s[0] }, itemStyle: { color: c.s[0] }, markLine: { silent: true, symbol: 'none', lineStyle: { color: c.muted, type: 'dashed' }, label: { formatter: '50%', color: c.muted, fontSize: 10 }, data: [{ yAxis: 50 }] } },
      { name: '厄尔尼诺年', type: 'line', data: H.clim.southNino, symbol: 'circle', symbolSize: 5, lineStyle: { width: 2, color: c.s[1] }, itemStyle: { color: c.s[1] } },
    ],
  }, { notMerge: true });
}
// ---------- rule-based outlook (no manual input: recomputed from the forecast files) ----------
const sumArr = (a) => a.reduce((s, x) => s + (x || 0), 0);
const SRC = (() => {
  const sum16 = (i) => sumArr(H.fc16[i].daily.precipitation_sum);
  const clim16 = (i) => H.clim.rain[i][0] + H.clim.rain[i][1] + H.clim.rain[i][2] * 2 / 7;
  const S = (sum16(1) + sum16(2)) / 2, Sc = (clim16(1) + clim16(2)) / 2, K = (sum16(4) + sum16(6)) / 2, Kc = (clim16(4) + clim16(6)) / 2;
  return { S, Sc, K, Kc, ratio: Math.min(S / Sc, K / Kc) };
})();
// satellite fire index: last 7 days with imagery vs the 7 before
const FT = (() => {
  const tot = H.fire.map((f) => f.sum + f.kal), n = tot.length;
  const a = mean(tot.slice(Math.max(0, n - 7))), b = mean(tot.slice(Math.max(0, n - 14), Math.max(0, n - 7)));
  return { ratio: b ? a / b : 1, pct: b ? Math.round((a / b - 1) * 100) : 0, last: H.fire[n - 1].d };
})();
function outlook() {
  const sS = seasWeekly(SEAS_G.sum), sK = seasWeekly(SEAS_G.kal);
  const seasRatio = (a, b) => Math.min(sumArr(sS.med.slice(a, b)) / sumArr(sS.clim.slice(a, b)), sumArr(sK.med.slice(a, b)) / sumArr(sK.clim.slice(a, b)));
  const wk = (i) => Date.parse(H.clim.weeks[i] + 'T00:00:00Z');
  const start = wk(0);
  const mk1 = (label, from, to, transport, ratio, src) => {
    // haze pressure = how often the wind brings smoke, scaled up when the source region stays dry
    const p = transport * (0.4 + 0.6 * (1 - Math.min(1, ratio)));
    const lvl = p >= 0.45 ? 'bad' : p >= 0.2 ? 'mid' : 'good';
    return { label, when: `${fmtMD(from)} – ${fmtMD(to)}`, transport, ratio, p, lvl, src };
  };
  const periods = [
    mk1('未来 1–2 周', start, start + 13 * DAY, mean(pS.slice(1)), SRC.ratio, 'ECMWF 集合预报'),
    mk1('第 3–4 周', wk(2), wk(3) + 6 * DAY, mean(H.clim.southAll.slice(2, 4)) / 100, seasRatio(2, 4), '风向按气候统计，雨量按 SEAS5'),
    mk1('第 5–8 周', wk(4), wk(7) + 6 * DAY, mean(H.clim.southAll.slice(4, 8)) / 100, seasRatio(4, 8), '风向按气候统计，雨量按 SEAS5'),
  ];
  const pS15 = mean(pS.slice(8)), seas5 = seasRatio(0, 5);
  const unh7 = daily.slice(-7).filter((d) => d.maxPsi > 100).length;
  const factors = [
    ['源区 16 天雨量', SRC.ratio >= 0.9 ? 2 : SRC.ratio >= 0.6 ? 1 : SRC.ratio < 0.3 ? -1 : 0, `常年的 ${Math.round(SRC.ratio * 100)}%`],
    ['季节预报 5 周雨量', seas5 >= 0.8 ? 1 : seas5 < 0.4 ? -1 : 0, `常年的 ${Math.round(seas5 * 100)}%`],
    ['第 2 周南向来风', pS15 < 0.35 ? 2 : pS15 < 0.55 ? 1 : pS15 >= 0.7 ? -1 : 0, `概率 ${Math.round(pS15 * 100)}%`],
    ['火点指数趋势', FT.ratio < 0.6 ? 1 : FT.ratio > 1.2 ? -1 : 0, `${FT.pct > 0 ? '+' : ''}${FT.pct}%`],
    ['近 7 天不健康天数', unh7 === 0 ? 1 : 0, `${unh7} 天`],
  ];
  const score = factors.reduce((s, f) => s + f[1], 0);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const opt = clamp(41 + 8 * score, 5, 75), pess = clamp(8 - 6 * score, 5, 60);
  return { periods, factors, score, opt, pess, base: 100 - opt - pess, sS, sK, seas5 };
}
function renderJudgement() {
  const O = outlook();
  const srcS = SRC.S, srcSc = SRC.Sc, srcK = SRC.K, srcKc = SRC.Kc, srcRatio = SRC.ratio;
  const s4S = O.sS, s4K = O.sK;
  const oct = (s) => Math.round(100 * sumArr(s.med.slice(0, 5)) / sumArr(s.clim.slice(0, 5)));
  const pS7 = Math.round(100 * mean(pS.slice(1, 8))), pS15 = Math.round(100 * mean(pS.slice(8)));
  const recs = EVENTS.filter((e) => e.rec != null && e.drop > 0.05).map((e) => e.rec);
  const rainChip = srcRatio >= 0.9 ? ['yes', '接近常年'] : srcRatio >= 0.6 ? ['part', '部分'] : ['no', '未满足'];
  const windChip = pS7 < 35 ? ['yes', '已转向'] : pS7 < 60 ? ['part', '转换中'] : ['no', '仍以南风为主'];
  const fireChip = FT.ratio < 0.6 ? ['yes', '明显下降'] : FT.ratio < 0.85 ? ['part', '有所下降'] : FT.ratio <= 1.2 ? ['no', '未见下降'] : ['no', '上升'];
  const w0 = fmtMD(Date.parse(H.clim.weeks[0] + 'T00:00:00Z')), w5 = fmtMD(Date.parse(H.clim.weeks[4] + 'T00:00:00Z') + 6 * DAY);
  const Nt = NOTES_ALL, hs = Nt.hotspots;
  const conds = [
    [...rainChip, '源区持续降雨', `泥炭火要靠连续多日、累计高于常年的降雨才能压住。未来 16 天预报：南苏门答腊/占碑约 ${r0(srcS)} mm（常年同期约 ${r0(srcSc)} mm），中/南加里曼丹约 ${r0(srcK)} mm（常年约 ${r0(srcKc)} mm）。SEAS5 显示 ${w0}–${w5} 这 5 周两地雨量分别约为常年的 ${oct(s4S)}% 和 ${oct(s4K)}%。`],
    [...windChip, '风向转离新加坡', `ECMWF 集合：未来 7 天新加坡南向来风平均概率 ${pS7}%，第 8–15 天 ${pS15}%。气候上（1996–2025），南风日占比本周约 ${H.clim.southAll[0]}%，3 周后约 ${H.clim.southAll[3]}%，5 周后约 ${H.clim.southAll[5]}%。`],
    [Nt.enso.k, Nt.enso.lab, '气候背景：厄尔尼诺 + 正 IOD', Nt.enso.text + `（整理于 ${Nt.updated}）`],
    [...fireChip, '火点数量', `卫星火点指数（第 02 部分）近 7 天平均比前 7 天 ${FT.pct > 0 ? '+' : ''}${FT.pct}%（截至 ${FT.last}；云多的日子会被低估）。最近一次官方统计：${hs.date} ${hs.src} 报告加里曼丹 ${hs.kal}、苏门答腊 ${hs.sum} 个火点。`],
    ['part', '只是缓解', '新加坡本地降雨', `9 月以来的数据：本地降雨让 1 小时 PM2.5 明显下降，但雨停后中位 ${recs.length ? Math.round(median(recs)) : '—'} 小时就回到雨前水平。季风转换期午后雷雨增多，会让“坏天”变短，但不能单独结束雾霾。`],
  ];
  $('#conds').innerHTML = conds.map(([k, lab, h, t]) => `<div class="cond"><span class="chip ${k}">${k === 'no' ? '✕' : k === 'part' ? '◐' : '✓'} ${lab}</span><h3>${h}</h3><p class="muted" style="font-size:13px;color:var(--ink2)">${t}</p></div>`).join('');
  const LV = {
    bad: ['仍会反复', '烟霾仍会被频繁吹来，24 小时 PSI 预计在中等至不健康之间反复；雷雨日有几小时到一天的缓解。'],
    mid: ['逐步好转，仍有反复', '烟霾被直接吹来的天数减少，不健康时段变少；但源区火点未灭，偏南风一出现仍会回来。'],
    good: ['明显改善', '风向基本不再把烟吹向新加坡，或源区降雨已恢复；预计以良好至中等为主。'],
  };
  $('#timeline').innerHTML = O.periods.map((p) => `<div class="tl ${p.lvl}"><span class="when">${p.label} · ${p.when}</span><span class="what">${LV[p.lvl][0]}</span><span class="muted" style="color:var(--ink2);font-size:13px">南向来风约 ${Math.round(p.transport * 100)}%，源区雨量约为常年的 ${Math.round(p.ratio * 100)}%（${p.src}）。${LV[p.lvl][1]}</span></div>`).join('');
  const iMid = O.periods.findIndex((p) => p.lvl !== 'bad'), iGood = O.periods.findIndex((p) => p.lvl === 'good');
  const baseTxt = iGood === 0 ? '当前条件下已处于明显改善阶段。'
    : `${iMid >= 0 && iMid < iGood ? O.periods[iMid].label + '（' + O.periods[iMid].when + '）起逐步好转，' : ''}${iGood > 0 ? O.periods[iGood].label + '（' + O.periods[iGood].when + '）基本结束。' : '未来 8 周内看不到明显改善的窗口。'}`;
  $('#scen').innerHTML = [
    ['', O.opt, '乐观：比基准早约两周', '季风转换期降雨提前覆盖南苏门答腊和加里曼丹，或风向提早转为北风；类似 2019、2023 年在 10 月上中旬结束。'],
    ['base', O.base, '基准', baseTxt + '参照年：2015 年强厄尔尼诺叠加正 IOD，雾霾拖到 10 月底，11 月中旬才彻底结束。'],
    ['', O.pess, '悲观：比基准晚两到四周', '厄尔尼诺与正 IOD 让源区干旱持续，东北季风推迟；期间偶有 PSI 超过 200 的时段。'],
  ].map(([k, p, h, t]) => `<div class="sc ${k}"><span class="p">约 ${p}%</span><b>${h}</b><span class="muted" style="color:var(--ink2);font-size:13px">${t}</span></div>`).join('')
    + `<div style="grid-column:1/-1;display:flex;flex-direction:column;gap:6px"><div class="factors">${O.factors.map(([n, s, v]) => `<span class="pill">${n} ${v} <b class="mono">${s > 0 ? '+' + s : s}</b></span>`).join('')}<span class="pill">合计 <b class="mono">${O.score > 0 ? '+' + O.score : O.score}</b></span></div><p class="muted">概率由上面五项打分按固定规则换算（乐观 = 41 + 8×合计，悲观 = 8 − 6×合计，其余为基准），用来表达把握程度，不是模型输出，也不是官方预报。</p></div>`;
  $('#signals').innerHTML = Nt.signals.map((s) => `<li>${s}</li>`).join('');
  $('#judgeDate').textContent = `预判更新于 ${H.fcBuilt || H.built}`;
  $('#notesAt').textContent = Nt.updated;
  const extra = (Nt.sources || []).map(([l, u]) => `<a href="${u}" target="_blank" rel="noopener">${l}</a>`).join(' · ');
  if (extra) { const li = document.createElement('li'); li.innerHTML = '每日更新时参考的新增来源：' + extra; $('footer ol').appendChild(li); }
  $('#builtAt').textContent = LIVE_AT || H.built;
  $('#neaRange').textContent = `2026-09-01 至 ${isoD(TEND)}`;
}

// ---------- wiring ----------
function segWire(id, attr, cb) {
  $(id).querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    $(id).querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    cb(b.dataset[attr]);
  }));
}
segWire('#metricSeg', 'm', (v) => { metric = v; renderMain(); });
segWire('#viewSeg', 'v', (v) => { view = v; renderMain(); });
segWire('#seasSeg', 'r', (v) => { seasR = v; renderSeas(); });
$('#zoom7').addEventListener('click', () => zoomTo(TEND - 7 * DAY, TEND));
$('#zoomAll').addEventListener('click', () => zoomTo(T0, TEND));

function renderCharts() { renderMain(); renderHeat(); renderDiurnal(); renderFire(); renderRisk(); renderCams(); renderFc16(); renderSeas(); renderWindClim(); }
renderHeader(); renderDays(); renderRain(); renderJudgement(); initMap();
// open the map on the latest day that has imagery
let lastSat = DAYS.length - 1;
while (lastSat > 0 && !(SAT_DAYS.has(isoD(DAYS[lastSat])) || satReady(isoD(DAYS[lastSat])))) lastSat--;
renderCharts(); setDay(lastSat);

// ---------- refresh button: fetch the hours since the last build from NEA, in this browser ----------
const say = (m) => { $('#refreshMsg').textContent = m; };
const sleep = (t) => new Promise((r) => setTimeout(r, t));
async function getJSON(url) {
  let err;
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) return await r.json(); err = new Error('HTTP ' + r.status); }
    catch (e) { err = e; }
    await sleep(1200 * (i + 1));
  }
  throw err;
}
async function fetchNeaDay(ds, note) {
  const NEA = 'https://api-open.data.gov.sg/v2/real-time/api/';
  note(`读取 NEA ${ds.slice(5).replace('-', '/')} 的空气质量…`);
  const psi = await getJSON(`${NEA}psi?date=${ds}`), pm = await getJSON(`${NEA}pm25?date=${ds}`);
  const pm1 = new Map(((pm.data && pm.data.items) || []).map((it) => [it.timestamp.slice(0, 16), it.readings.pm25_one_hourly]));
  const seen = new Set(), air = [];
  ((psi.data && psi.data.items) || []).slice().sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1)).forEach((it) => {
    const k = it.timestamp.slice(0, 16);
    if (seen.has(k)) return; seen.add(k);
    const r = it.readings, h = pm1.get(k);
    air.push([k, REG.map((g) => r.psi_twenty_four_hourly[g]), REG.map((g) => (h ? h[g] : null)), REG.map((g) => r.pm25_twenty_four_hourly[g])]);
  });
  return air;
}
// Rainfall: 5-minute readings from every gauge, newest page first. NEA rate-limits fast paging, so only
// the pages newer than `fromKey` (an hour key like "2026-10-01T09") are read, slowly, and at most `cap` pages.
async function fetchRainSince(fromKey, today, note) {
  const NEA = 'https://api-open.data.gov.sg/v2/real-time/api/';
  const hours = new Map();
  let oldest = null, pages = 0, complete = false;
  const cap = 8;
  for (let ds = today; !complete && pages < cap && ds >= fromKey.slice(0, 10); ds = isoD(Date.parse(ds + 'T00:00:00Z') - DAY)) {
    let token = '';
    do {
      note(`读取 NEA 雨量（第 ${++pages} 页）…`);
      const rf = await getJSON(`${NEA}rainfall?date=${ds}${token ? '&paginationToken=' + encodeURIComponent(token) : ''}`);
      ((rf.data && rf.data.readings) || []).forEach((rd) => {
        const vals = rd.data.map((x) => +x.value);
        if (!vals.length) return;
        const k = rd.timestamp.slice(0, 13), h = hours.get(k) || { mm: 0, wet: 0 };
        h.mm += vals.reduce((s, x) => s + x, 0) / vals.length;
        h.wet = Math.max(h.wet, vals.filter((x) => x > 0).length / vals.length);
        hours.set(k, h);
        const ts = rd.timestamp.slice(0, 16);
        if (!oldest || ts < oldest) oldest = ts;
      });
      token = (rf.data && rf.data.paginationToken) || '';
      if (oldest && oldest.slice(0, 13) < fromKey) complete = true;
      await sleep(900);
    } while (token && !complete && pages < cap);
  }
  if (!oldest) return null;
  // the oldest hour reached may be only partly read: when paging stopped early, start from the hour after it
  const from = complete ? fromKey : (oldest.endsWith(':00') ? oldest.slice(0, 13) : new Date(ms(oldest.slice(0, 13) + ':00') + HOUR).toISOString().slice(0, 13));
  const rows = [...hours.keys()].filter((k) => k >= from).sort().map((k) => [k, Math.round(hours.get(k).mm * 100) / 100, Math.round(hours.get(k).wet * 100) / 100]);
  return { from, rows };
}
async function liveRefresh() {
  const btn = $('#refreshBtn');
  btn.disabled = true; btn.textContent = '⟳ 刷新中…';
  const done = (m) => { say(m); btn.disabled = false; btn.textContent = '⟳ 刷新数据'; };
  try {
    const n = nowSgt(), today = n.toISOString().slice(0, 10);
    // air quality: every day from the last built hour up to today (two small requests per day), at most 3 days
    const dates = [];
    for (let t = Date.parse(BUILT_LAST.slice(0, 10) + 'T00:00:00Z'); t <= Date.parse(today + 'T00:00:00Z'); t += DAY) dates.push(isoD(t));
    const use = dates.slice(-3), days = {};
    for (const ds of use) { days[ds] = { air: await fetchNeaDay(ds, say) }; await sleep(400); }
    const got = use.reduce((s, ds) => s + days[ds].air.length, 0);
    if (!got) { done('NEA 暂时没有返回数据，请稍后再试。'); return; }
    let rain = null, wx = null;
    try { rain = await fetchRainSince(BUILT_RAIN_LAST, today, say); } catch (e) { rain = null; }
    try {
      say('读取新加坡风向…');
      wx = (await getJSON(`https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=1.35&longitude=103.82&start_date=${use[0]}&end_date=${today}&hourly=wind_speed_10m,wind_direction_10m&timezone=Asia%2FSingapore`)).hourly;
    } catch (e) { wx = null; }
    const at = `${today} ${pad(n.getUTCHours())}:${pad(n.getUTCMinutes())}`;
    const missed = [rain ? '' : '雨量', wx ? '' : '风向'].filter(Boolean).join('、');
    try {
      sessionStorage.setItem('hazeLive', JSON.stringify({ at, days, rain, wx }));
      sessionStorage.setItem('hazeMsg', `已取得 NEA 最新读数${missed ? `（${missed}没取到，沿用上一次的；过一两分钟再点可重试）` : ''}。预判每天更新一次，不随按钮刷新。`);
    } catch (e) { done('浏览器不允许本页保存数据（可能是无痕模式），无法显示刷新结果。'); return; }
    location.reload();
  } catch (e) {
    done('没能连上 NEA 数据接口。如果你是在 claude.ai 的快照链接上，那里不允许联网取数，请打开网站版；否则请过一两分钟再点一次。');
  }
}

$('#refreshBtn').hidden = false;
$('#refreshBtn').addEventListener('click', liveRefresh);
try { const m = sessionStorage.getItem('hazeMsg'); if (m) { say(m); sessionStorage.removeItem('hazeMsg'); } } catch (e) { /* storage unavailable */ }

mk('mainChart').dispatchAction({ type: 'dataZoom', startValue: TEND - 10 * DAY, endValue: TEND });
const rerender = () => { renderCharts(); drawMapSvg(selDay); };
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rerender); } catch (e) { /* older browsers */ }
new MutationObserver(rerender).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
