// Text that comes from news and official advisories rather than the data feeds.
// Hand-maintained background notes. Everything else on the page is computed from data.js, which the
// refresh button rebuilds; this file only changes when someone edits it.
window.HAZE_NOTES = {
  updated: '2026-09-30',

  // latest official hotspot count, quoted in the fire-count card
  hotspots: { total: 518, kal: 327, sum: 191, date: '9/29', src: 'DOE' },

  // header pill for the climate background (the other pills are computed from data)
  ensoPill: '强厄尔尼诺：Niño 3.4 +3.0°C（9 月中）',

  // one line per day, shown under the satellite map for that date
  days: {
    '2026-09-04': '24 小时 PSI 自 2023 年 10 月 8 日以来首次进入不健康范围；NEA 开始每日发布雾霾通报。',
    '2026-09-09': 'NEA 通报：24h PSI 74–98，中等。',
    '2026-09-14': '加里曼丹火点 12 日 301 个 → 13 日 461 个 → 14 日 808 个；NEA：24h PSI 88–117。',
    '2026-09-15': '中区 24h PSI 达 154，为当时本轮最高。',
    '2026-09-19': '雾霾重回不健康范围，烟雾来自印尼。',
    '2026-09-25': 'NEA 通报：24h PSI 61–79，中等。',
    '2026-09-27': 'NEA 通报：24h PSI 83–119。',
    '2026-09-28': 'NEA 通报：24h PSI 68–94。',
    '2026-09-29': '五区全部进入不健康；中区 24h PSI 早上 7 时 158，中午升至 167，为 9 月最高。DOE：加里曼丹 327、苏门答腊 191 个火点。云量大，卫星未能完整监测火点。',
    '2026-09-30': '阵雨带来改善：18 时 1 小时 PM2.5 降至 6–18 µg/m³，24h PSI 91–112。NEA 预计南/东南风下烟霾风险仍在。',
  },

  // climate-background card (the rain, wind, fire and local-rain cards are computed from data)
  enso: { k: 'no', lab: '不利', text: 'Niño 3.4 周值 9 月中达 +3.0°C，NOAA 给出 9–11 月“非常强”厄尔尼诺的概率 >90%；正印度洋偶极子预计在 9–11 月发展。两者都压制印尼南部降雨，这一背景在年底前不会改变。ASMC 季节展望同样预计 9–11 月海洋性大陆南部雨量偏少。' },

  signals: [
    'ASMC 每日火点数：加里曼丹 + 苏门答腊连续数天降到 100 个以下，是源头减弱最直接的信号。',
    '南苏门答腊（巨港）与中加里曼丹（帕朗卡拉亚）出现连续 3 天以上、每天 10 mm 以上的降雨（见 16 天雨量预报图）。',
    'MSS 宣布季风转换期或东北季风开始；新加坡地面风从东南、南转为北、东北或风弱多变（第 01 部分底部箭头变灰）。',
    'NEA 每日通报中 24 小时 PSI 预报降到“良好至中等”，或不再发布每日雾霾通报。',
    '反向信号：连续晴热、南风 3 米/秒以上且源区无雨，意味着未来 1–2 天可能再次进入不健康甚至更高。',
  ],

  // extra source links: [label, url]
  sources: [],
};
