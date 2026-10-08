// Recipe definitions. Each pour-over recipe scales to any dose/ratio:
// build(dose, water, opts) returns timed steps; `target` is the cumulative scale reading.
const r1 = n => Math.round(n);

const ROAST_LEVELS = ['light', 'medium', 'dark'];

const POUROVER_RECIPES = [
  {
    id: 'hoffmann-v60',
    name: 'Ultimate V60',
    author: 'James Hoffmann',
    dripper: 'Hario V60',
    ratio: 16.67, dose: 15,
    grind: 'Medium-fine',
    temp: { light: 100, medium: 95, dark: 90 },
    notes: [
      'Use water as hot as possible for light roasts — just off the boil.',
      'Swirling after the bloom and after the final pour flattens the bed for an even drawdown.',
      'Drawdown running long? Grind coarser. Finishing fast and tasting sour? Grind finer.',
    ],
    build(d, W) {
      const bloom = r1(d * 2);
      return {
        total: 210,
        steps: [
          { at: 0, target: bloom, text: `Bloom: pour ${bloom} g (2× dose), then swirl until all grounds are wet` },
          { at: 45, target: r1(W * 0.6), text: 'Pour steadily to 60% of total water within 30 s' },
          { at: 75, target: W, text: 'Pour more slowly to the full amount within the next 30 s' },
          { at: 105, text: 'Stir once clockwise and once anticlockwise, then give it a gentle swirl' },
          { at: 210, text: 'Drawdown should finish around 3:30 — enjoy' },
        ],
      };
    },
  },
  {
    id: 'hoffmann-1cup',
    name: 'Better 1-Cup V60',
    author: 'James Hoffmann',
    dripper: 'Hario V60',
    ratio: 16.67, dose: 15,
    grind: 'Medium-fine (a touch finer than usual)',
    temp: { light: 100, medium: 95, dark: 90 },
    notes: [
      'Designed for small doses: five equal pulses keep the bed hot and the extraction even.',
      'Pour each pulse gently in the centre in about 10 s.',
    ],
    build(d, W) {
      const p = f => r1(W * f);
      return {
        total: 180,
        steps: [
          { at: 0, target: p(0.2), text: `Bloom: pour ${p(0.2)} g and swirl gently` },
          { at: 45, target: p(0.4), text: 'Pour to 40%' },
          { at: 70, target: p(0.6), text: 'Pour to 60%' },
          { at: 90, target: p(0.8), text: 'Pour to 80%' },
          { at: 110, target: W, text: 'Pour to 100%, then a gentle swirl' },
          { at: 180, text: 'Drawdown done around 3:00' },
        ],
      };
    },
  },
  {
    id: 'kasuya-46',
    name: '4:6 Method',
    author: 'Tetsu Kasuya',
    dripper: 'Hario V60',
    ratio: 15, dose: 20,
    grind: 'Coarse',
    temp: { light: 93, medium: 88, dark: 83 },
    options: [
      { key: 'taste', label: 'First 40% (taste)', choices: [['balanced', 'Balanced'], ['sweet', 'Sweeter'], ['bright', 'Brighter']] },
      { key: 'strength', label: 'Last 60% (strength)', choices: [['standard', 'Standard (3 pours)'], ['light', 'Lighter (2 pours)'], ['strong', 'Stronger (4 pours)']] },
    ],
    notes: [
      'The first 40% of water controls sweetness vs. acidity; the last 60% controls strength.',
      'Pour each portion quickly and let it drain before the next one (every 45 s).',
      'Remove the dripper at the end time even if water remains.',
    ],
    build(d, W, o = {}) {
      const first = W * 0.4;
      const split = { balanced: [0.5, 0.5], sweet: [5 / 12, 7 / 12], bright: [7 / 12, 5 / 12] }[o.taste || 'balanced'];
      const n = { light: 2, standard: 3, strong: 4 }[o.strength || 'standard'];
      const portions = [first * split[0], first * split[1], ...Array(n).fill((W * 0.6) / n)];
      let cum = 0;
      const steps = portions.map((amt, i) => {
        cum += amt;
        const target = i === portions.length - 1 ? W : r1(cum);
        return { at: i * 45, target, text: `Pour ${i + 1} of ${portions.length}: ${r1(amt)} g${i === 0 ? ' (no swirl, just wet everything)' : ''}` };
      });
      const total = portions.length * 45 - 15;
      steps.push({ at: total, text: 'Remove the dripper — done' });
      return { total, steps };
    },
  },
  {
    id: 'rao-v60',
    name: 'Rao Spin V60',
    author: 'Scott Rao',
    dripper: 'Hario V60',
    ratio: 16.5, dose: 20,
    grind: 'Medium-fine',
    temp: { light: 99, medium: 94, dark: 89 },
    notes: [
      'A big 3× bloom and one continuous main pour make this very repeatable.',
      'The final "Rao spin" (swirling the brewer) leaves a flat bed for an even drawdown.',
    ],
    build(d, W) {
      const bloom = r1(d * 3);
      return {
        total: 210,
        steps: [
          { at: 0, target: bloom, text: `Bloom: pour ${bloom} g (3× dose) and stir/swirl to wet all grounds` },
          { at: 45, target: W, text: 'One continuous pour to the full amount, finishing by ~1:45' },
          { at: 105, text: 'Gentle stir around the edge, then spin the brewer to flatten the bed' },
          { at: 210, text: 'Drawdown done around 3:00–3:30' },
        ],
      };
    },
  },
  {
    id: 'kalita-pulse',
    name: 'Kalita Wave Pulse',
    author: 'Classic',
    dripper: 'Kalita Wave',
    ratio: 16, dose: 20,
    grind: 'Medium',
    temp: { light: 96, medium: 93, dark: 90 },
    notes: [
      'Flat-bottom brewers like steady, low pulse pours in small circles.',
      'Keep the water level roughly constant between pulses.',
    ],
    build(d, W) {
      const bloom = r1(d * 2.5);
      return {
        total: 210,
        steps: [
          { at: 0, target: bloom, text: `Bloom: pour ${bloom} g` },
          { at: 30, target: r1(W * 0.4), text: 'Pulse to 40%' },
          { at: 60, target: r1(W * 0.6), text: 'Pulse to 60%' },
          { at: 90, target: r1(W * 0.8), text: 'Pulse to 80%' },
          { at: 120, target: W, text: 'Pulse to 100%, light tap or swirl' },
          { at: 210, text: 'Drawdown done around 3:30' },
        ],
      };
    },
  },
  {
    id: 'chemex',
    name: 'Chemex Classic',
    author: 'Classic',
    dripper: 'Chemex',
    ratio: 15.5, dose: 30,
    grind: 'Medium-coarse',
    temp: { light: 96, medium: 94, dark: 91 },
    notes: [
      'Rinse the thick paper filter well — it can taste papery.',
      'Keep the triple-fold side of the filter over the spout.',
    ],
    build(d, W) {
      const bloom = r1(d * 2);
      return {
        total: 270,
        steps: [
          { at: 0, target: bloom, text: `Bloom: pour ${bloom} g and gently stir` },
          { at: 45, target: r1(W * 0.5), text: 'Pour in slow spirals to 50%' },
          { at: 90, target: r1(W * 0.75), text: 'Pour to 75%' },
          { at: 135, target: W, text: 'Pour to 100%' },
          { at: 270, text: 'Drawdown done around 4:00–4:30' },
        ],
      };
    },
  },
  {
    id: 'two-pour',
    name: 'Two-Pour Flat Bed',
    author: 'April-style',
    dripper: 'April',
    ratio: 15.4, dose: 13,
    grind: 'Medium-coarse',
    temp: { light: 96, medium: 92, dark: 88 },
    notes: [
      'Two big, quick pours in circles — very low agitation and a short brew.',
      'Works best on flat-bottom brewers (April, Orea, Kalita).',
    ],
    build(d, W) {
      return {
        total: 135,
        steps: [
          { at: 0, target: r1(W * 0.5), text: 'Pour 50% in circles within ~10 s' },
          { at: 35, target: W, text: 'Pour the second half within ~10 s' },
          { at: 135, text: 'Drawdown done around 2:00–2:30' },
        ],
      };
    },
  },
];

// ---------------- AeroPress dice ----------------
const DICE = [
  {
    id: 'temp', name: 'Temperature', icon: '🌡️',
    faces: [
      { label: '80°C', temp: 80 }, { label: '85°C', temp: 85 }, { label: '90°C', temp: 90 },
      { label: '92°C', temp: 92 }, { label: '95°C', temp: 95 }, { label: 'Off the boil', temp: 100 },
    ],
  },
  {
    id: 'ratio', name: 'Coffee : water', icon: '⚖️',
    faces: [
      { label: '12 g : 200 g', dose: 12, water: 200 },
      { label: '15 g : 200 g', dose: 15, water: 200 },
      { label: '15 g : 250 g', dose: 15, water: 250 },
      { label: '18 g : 250 g', dose: 18, water: 250 },
      { label: '23 g : 200 g, dilute to 300 g', dose: 23, water: 200, bypass: 100 },
      { label: '30 g : 200 g, dilute to 400 g', dose: 30, water: 200, bypass: 200 },
    ],
  },
  {
    id: 'grind', name: 'Grind & steep', icon: '⏱️',
    faces: [
      { label: 'Fine · 0:30', grind: 'Fine', steep: 30 },
      { label: 'Fine · 1:00', grind: 'Fine', steep: 60 },
      { label: 'Medium-fine · 1:30', grind: 'Medium-fine', steep: 90 },
      { label: 'Medium · 2:00', grind: 'Medium', steep: 120 },
      { label: 'Medium-coarse · 2:30', grind: 'Medium-coarse', steep: 150 },
      { label: 'Coarse · 4:00', grind: 'Coarse', steep: 240 },
    ],
  },
  {
    id: 'bloom', name: 'Bloom', icon: '🌱',
    faces: [
      { label: 'No bloom', mult: 0 },
      { label: '2× dose · 30 s', mult: 2, time: 30 },
      { label: '2× dose · 45 s', mult: 2, time: 45 },
      { label: '3× dose · 30 s', mult: 3, time: 30 },
      { label: '3× dose + stir · 30 s', mult: 3, time: 30, stir: true },
      { label: '4× dose · 45 s', mult: 4, time: 45 },
    ],
  },
  {
    id: 'stir', name: 'Agitation', icon: '🥄',
    faces: [
      { label: 'No stir', kind: 'none', text: '' },
      { label: 'Stir 3×', kind: 'stir', text: 'Stir 3 times' },
      { label: 'Stir 10× back & forth', kind: 'stir', text: 'Stir 10 times back and forth' },
      { label: 'Stir N-S-E-W', kind: 'stir', text: 'Stir once north–south, then east–west' },
      { label: 'Swirl before pressing', kind: 'swirl', text: 'Gently swirl' },
      { label: 'Stir 5× each way', kind: 'stir', text: 'Stir 5× clockwise, then 5× anticlockwise' },
    ],
  },
  {
    id: 'setup', name: 'Setup', icon: '🔄',
    faces: [
      { label: 'Standard · paper', inverted: false, filter: 'Paper' },
      { label: 'Inverted · paper', inverted: true, filter: 'Paper' },
      { label: 'Standard · 2 papers', inverted: false, filter: '2× paper' },
      { label: 'Inverted · 2 papers', inverted: true, filter: '2× paper' },
      { label: 'Inverted · metal', inverted: true, filter: 'Metal' },
      { label: 'Standard · paper + metal', inverted: false, filter: 'Paper + metal' },
    ],
  },
];

// faces: { temp, ratio, grind, bloom, stir, setup } — one face object per die
function buildDiceRecipe(f) {
  const { temp, ratio, grind, bloom, stir, setup } = f;
  const d = ratio.dose, W = ratio.water, bypass = ratio.bypass || 0;
  const B = bloom.mult ? Math.min(r1(d * bloom.mult), W - 40) : 0;
  const prep = [
    { at: null, text: `Heat water to ${temp.temp === 100 ? 'a boil' : temp.temp + '°C'}${bypass ? ` (you'll need ${W + bypass} g in total)` : ''}` },
    { at: null, text: `Grind ${d} g ${grind.grind.toLowerCase()}` },
    { at: null, text: setup.inverted
        ? `Assemble inverted (plunger in at the bottom, upside down). Rinse your ${setup.filter.toLowerCase()} filter in the cap.`
        : `Rinse the ${setup.filter.toLowerCase()} filter in the cap, attach it and set the AeroPress on your cup` },
  ];
  const steps = [];
  let pourStart = 0;
  if (B) {
    steps.push({ at: 0, target: B, text: `Bloom: pour ${B} g${bloom.stir ? ' and stir to wet all grounds' : ''}` });
    pourStart = bloom.time;
    steps.push({ at: pourStart, target: W, text: `Pour to ${W} g` });
  } else {
    steps.push({ at: 0, target: W, text: `Pour all ${W} g in ~10 s` });
  }
  const pourEnd = pourStart + 10;
  const stirred = stir.kind === 'stir';
  steps.push({
    at: pourEnd,
    text: setup.inverted
      ? (stirred ? `${stir.text}, then steep` : 'Steep')
      : (stirred ? `${stir.text}, then insert the plunger ~1 cm to stop drips` : 'Insert the plunger ~1 cm to stop drips and steep'),
  });

  const pressAt = pourEnd + grind.steep;
  if (stir.kind === 'swirl') steps.push({ at: pressAt - (setup.inverted ? 25 : 10), text: 'Gently swirl the AeroPress' });
  if (setup.inverted) steps.push({ at: pressAt - 15, text: 'Attach the filter cap and carefully flip onto your cup' });
  steps.push({ at: pressAt, text: setup.filter === 'Metal' ? 'Press gently over ~30 s' : 'Press gently over ~30 s, stop at the hiss' });
  let end = pressAt + 30;
  if (bypass) { steps.push({ at: end, text: `Dilute with ${bypass} g hot water` }); end += 10; }
  steps.push({ at: end, text: 'Done — taste and take notes!' });

  return {
    title: 'AeroPress dice roll',
    subtitle: Object.values(f).map(x => x.label).join(' · '),
    dose: d, water: W, bypass, temp: temp.temp, grind: grind.grind, total: end,
    prep, steps,
    notes: ['Not every roll will be great — that is the fun. Log the good ones and favourite them.'],
    log: {
      method: 'aeropress', dose: d, water: W, temp: temp.temp, recipeName: 'AeroPress dice',
      details: {
        orientation: setup.inverted ? 'Inverted' : 'Standard', filter: setup.filter,
        bloomWater: B || '', steepTime: grind.steep, agitation: stir.kind === 'none' ? 'None' : stir.text,
        pressTime: 30, bypass: bypass || '',
      },
    },
  };
}

const AEROPRESS_CLASSICS = [
  {
    id: 'hoffmann-ultimate',
    name: 'Ultimate AeroPress (Hoffmann)',
    build: () => ({
      title: 'Ultimate AeroPress', subtitle: 'James Hoffmann · standard · paper',
      dose: 11, water: 200, bypass: 0, temp: 100, grind: 'Fine', total: 180,
      prep: [
        { at: null, text: 'Bring water to the boil — use it straight off the boil' },
        { at: null, text: 'Grind 11 g fine (a bit finer than a V60)' },
        { at: null, text: 'Paper filter in the cap — no need to rinse; standard orientation on your cup' },
      ],
      steps: [
        { at: 0, target: 200, text: 'Pour all 200 g quickly to wet everything' },
        { at: 10, text: 'Insert the plunger ~1 cm to create a vacuum, then wait' },
        { at: 120, text: 'Holding plunger and chamber, gently swirl' },
        { at: 150, text: 'Press gently all the way over ~30 s' },
        { at: 180, text: 'Done' },
      ],
      notes: ['A low-dose, long-steep, low-agitation recipe — clean and sweet.', 'Lots of fines in the cup? Grind slightly coarser.'],
      log: { method: 'aeropress', dose: 11, water: 200, temp: 100, recipeName: 'Ultimate AeroPress (Hoffmann)',
        details: { orientation: 'Standard', filter: 'Paper', steepTime: 120, agitation: 'Swirl', pressTime: 30 } },
    }),
  },
  {
    id: 'adler-original',
    name: 'Original-style (Alan Adler)',
    build: () => ({
      title: 'Original-style AeroPress', subtitle: 'Alan Adler · concentrate + dilute',
      dose: 15, water: 90, bypass: 130, temp: 80, grind: 'Fine', total: 50,
      prep: [
        { at: null, text: 'Heat water to about 80°C' },
        { at: null, text: 'Grind 15 g fine (like espresso to fine filter)' },
        { at: null, text: 'Rinse a paper filter in the cap; standard orientation on a sturdy cup' },
      ],
      steps: [
        { at: 0, target: 90, text: 'Pour 90 g of water' },
        { at: 5, text: 'Stir for 10 s' },
        { at: 15, text: 'Press gently over ~20–30 s' },
        { at: 45, text: 'Top up with 130 g hot water (or milk)' },
        { at: 50, text: 'Done' },
      ],
      notes: ['Short, cool brew for low bitterness. Dilute more or less to taste.'],
      log: { method: 'aeropress', dose: 15, water: 90, temp: 80, recipeName: 'Original-style AeroPress (Adler)',
        details: { orientation: 'Standard', filter: 'Paper', steepTime: 10, agitation: 'Stir 10 s', pressTime: 25, bypass: 130 } },
    }),
  },
];

function fmtTime(sec) {
  if (sec == null || isNaN(sec)) return '';
  sec = Math.max(0, Math.round(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
