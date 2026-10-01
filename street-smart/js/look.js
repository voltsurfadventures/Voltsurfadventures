/* Visual pass: dusk Old Quarter, teal awnings, warm shop light. */
(function () {
  const SS = window.SS;
  if (!SS || !SS.LIGHTING || !SS.WORLDS) return;
  const g = SS.LIGHTING.golden;
  g.sky = ['#f3b07a', '#ffe0b0'];
  g.far = '#8a6a52';
  g.farLit = '#e0a36a';
  g.haze = 'rgba(255,196,130,0.14)';
  g.road = '#6d5b50';
  g.pathBase = '#c9a37a';
  g.pathLine = '#a48462';
  g.lantern = 1;
  g.windowGlow = 0.85;
  g.neon = 1;
  g.sunGlow = 'rgba(255,150,70,0.22)';
  const m = SS.LIGHTING.morning;
  m.sky = ['#f6c59a', '#fff0d2'];
  m.pathBase = '#d2b48c';
  m.lantern = 0.7;
  m.windowGlow = 0.55;
  const pal = SS.WORLDS.vietnam.palette;
  pal.awnings = ['#1f8f88', '#16867f', '#2aa39a', '#0f7c76', '#3cb0a4', '#14756f'];
  pal.helmets = ['#00b14f', '#e14b3b', '#f2c230', '#f4f4f0', '#2a2a2e', '#3d7fd0'];
  SS.COL_PLAYER = '#00b14f';
})();
