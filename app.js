/* =========================================================
   Hathakim's Pantry — app logic
   v0.1 · static prototype with localStorage persistence
   ========================================================= */

(() => {
'use strict';

// ---------- Storage layer ----------
const STORAGE_KEY = 'hathakims-pantry-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.version) return null;
    return parsed;
  } catch { return null; }
}
function saveState() {
  try {
    const dump = { ...state, version: 1 };
    delete dump.ui;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dump));
  } catch (e) { console.warn('Save failed', e); }
}

// ---------- Date helpers ----------
const DAYS_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_LONG   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

// Returns the 7-day week array for a given week offset (0 = current week, -1 = last week, etc.)
function getWeek(offset = 0) {
  const now = new Date(); now.setHours(0,0,0,0);
  const day = now.getDay();
  const toMonday = day === 0 ? 6 : day - 1;
  const mon = new Date(now);
  mon.setDate(now.getDate() - toMonday + offset * 7);
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i);
    return d;
  });
}

function isSameDay(a, b) { return ymd(a) === ymd(b); }

function weekLabel(offset) {
  if (offset === 0) return 'This week';
  if (offset === 1) return 'Next week';
  if (offset === -1) return 'Last week';
  if (offset === 2) return 'In 2 weeks';
  if (offset === 3) return 'In 3 weeks';
  if (offset === 4) return 'In 4 weeks';
  if (offset === 5) return 'In 5 weeks';
  if (offset === -2) return '2 weeks ago';
  if (offset === -3) return '3 weeks ago';
  if (offset === -4) return '4 weeks ago';
  if (offset === -5) return '5 weeks ago';
  if (offset === -6) return '6 weeks ago';
  const w = getWeek(offset);
  return `${w[0].getDate()} ${MONTHS_SHORT[w[0].getMonth()]} – ${w[6].getDate()} ${MONTHS_SHORT[w[6].getMonth()]}`;
}

function weekRangeShort(offset) {
  const w = getWeek(offset);
  const s = w[0], e = w[6];
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS_SHORT[s.getMonth()]}`;
  }
  return `${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]}`;
}

function longDateLabel(d) {
  return `${DAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

function lastMadeLabel(dateMs) {
  if (!dateMs) return 'Never made';
  const days = Math.round((Date.now() - dateMs) / 86400000);
  if (days <= 0) return 'Made today';
  if (days === 1) return 'Made yesterday';
  if (days < 7) return `Made ${days} days ago`;
  if (days < 14) return 'Made last week';
  const d = new Date(dateMs);
  return `Last made ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// ---------- ID helper ----------
const uid = (p='') => p + Math.random().toString(36).slice(2, 10);

// ---------- Default seed ----------
function seedState() {
  const products = [
    { id:'p_bananas',  name:'Bananas',           package:'Bunch of 6', store:'coles',   emoji:'🍌', category:'Produce', sourceUrl:'https://coles.com.au/product/bananas',           lastBuyDate:Date.now()-86400000*7,  lastBuyQty:1 },
    { id:'p_basil',    name:'Fresh basil',       package:'Bunch',      store:'woolies', emoji:'🌿', category:'Produce', sourceUrl:'https://woolworths.com.au/shop/basil',           lastBuyDate:Date.now()-86400000*9,  lastBuyQty:1 },
    { id:'p_avocados', name:'Avocados',          package:'Each',       store:'coles',   emoji:'🥑', category:'Produce', sourceUrl:'https://coles.com.au/product/avocados',          lastBuyDate:Date.now()-86400000*4,  lastBuyQty:2 },
    { id:'p_olive',    name:'Cobram olive oil',  package:'750mL',      store:'aldi',    emoji:'🫒', category:'Pantry',  sourceUrl:'https://aldi.com.au/product/olive-oil',          lastBuyDate:Date.now()-86400000*12, lastBuyQty:1, scrapeFailed:true },
    { id:'p_timtams',  name:'Tim Tams',          package:'200g pack',  store:'woolies', emoji:'🍪', category:'Pantry',  sourceUrl:'https://woolworths.com.au/shop/timtams',         lastBuyDate:Date.now()-86400000*14, lastBuyQty:2 },
    { id:'p_sourdough',name:'Sourdough loaf',    package:'Each',       store:'woolies', emoji:'🍞', category:'Bakery',  sourceUrl:'https://woolworths.com.au/shop/sourdough',       lastBuyDate:Date.now()-86400000*5,  lastBuyQty:1 },
    { id:'p_salmon',   name:'Salmon fillets',    package:'Each',       store:'coles',   emoji:'🐟', category:'Seafood', sourceUrl:'https://coles.com.au/product/salmon-fillets',    lastBuyDate:Date.now()-86400000*6,  lastBuyQty:2 },
    { id:'p_milk',     name:'Pauls Smarter Milk',package:'2L',         store:'woolies', emoji:'🥛', category:'Dairy',   sourceUrl:'https://woolworths.com.au/shop/milk',            lastBuyDate:Date.now()-86400000*3,  lastBuyQty:1 },
  ];

  const list = [
    { id:uid('i_'), productId:'p_bananas',  qty:1, note:'ripe ones please', ticked:false, addedBy:'u1', addedAt:Date.now()-3600000 },
    { id:uid('i_'), productId:'p_basil',    qty:1, note:'',                 ticked:false, addedBy:'u2', addedAt:Date.now()-3000000 },
    { id:uid('i_'), productId:'p_avocados', qty:2, note:'firm',             ticked:true,  addedBy:'u1', addedAt:Date.now()-2400000 },
    { id:uid('i_'), productId:'p_olive',    qty:1, note:'light flavour',    ticked:false, addedBy:'u1', addedAt:Date.now()-1800000 },
    { id:uid('i_'), productId:'p_timtams',  qty:2, note:'',                 ticked:true,  addedBy:'u2', addedAt:Date.now()-1200000 },
  ];

  const meals = [
    {
      id:'m_pasta', name:'Lemon basil pasta', emoji:'🍝', frequent:true,
      notes:"Vicky's favourite — double the basil, easy on the chilli. Use the good parmesan from the deli counter.",
      recipeUrl:'https://www.bonappetit.com/recipe/lemon-basil-pasta',
      timeMin: 25, lastMadeDate: Date.now() - 86400000 * 5,
      ingredients: [
        {qty:'250 g', name:'Spaghetti'},{qty:'2', name:'Lemons'},{qty:'1 bunch', name:'Fresh basil'},
        {qty:'80 g', name:'Parmesan'},{qty:'3 tbsp', name:'Olive oil'},{qty:'2 cloves', name:'Garlic'},{qty:'to taste', name:'Chilli flakes'},
      ],
    },
    {
      id:'m_chicken', name:'Roast chicken & potatoes', emoji:'🍗', frequent:true,
      notes:'',recipeUrl:'',timeMin: 70, lastMadeDate: Date.now() - 86400000 * 12,
      ingredients: [
        {qty:'1', name:'Whole chicken'},{qty:'1 kg', name:'Roasting potatoes'},{qty:'1 head', name:'Garlic'},
        {qty:'1 bunch', name:'Rosemary'},{qty:'2 tbsp', name:'Olive oil'},{qty:'1', name:'Lemon'},
      ],
    },
    {
      id:'m_salmon', name:'Salmon, greens, rice', emoji:'🐟', frequent:false,
      notes:'',recipeUrl:'https://www.recipetineats.com/easy-salmon',timeMin: 30, lastMadeDate: Date.now() - 86400000 * 18,
      ingredients: [
        {qty:'2 fillets', name:'Salmon'},{qty:'1 cup', name:'Jasmine rice'},{qty:'1 head', name:'Broccoli'},
        {qty:'1 bunch', name:'Bok choy'},{qty:'2 tbsp', name:'Soy sauce'},{qty:'1 thumb', name:'Ginger'},{qty:'1', name:'Lime'},
      ],
    },
    {
      id:'m_lasagna', name:"Vicky's lasagna", emoji:'🍲', frequent:true,
      notes:'Make a double batch of bechamel, freezes well.',recipeUrl:'',timeMin: 90, lastMadeDate: Date.now() - 86400000 * 30,
      ingredients: [
        {qty:'500 g', name:'Beef mince'},{qty:'1 jar', name:'Tomato passata'},{qty:'250 g', name:'Lasagna sheets'},
        {qty:'500 mL', name:'Milk'},{qty:'80 g', name:'Butter'},{qty:'80 g', name:'Plain flour'},
        {qty:'200 g', name:'Mozzarella'},{qty:'1', name:'Onion'},{qty:'2 cloves', name:'Garlic'},
      ],
    },
    {
      id:'m_tacos', name:'Black bean tacos', emoji:'🌮', frequent:false,
      notes:'',recipeUrl:'https://cooking.nytimes.com/recipes/black-bean-tacos',timeMin: 35, lastMadeDate: null,
      ingredients: [
        {qty:'2 cans', name:'Black beans'},{qty:'1 pack', name:'Soft tortillas'},{qty:'1', name:'Red onion'},
        {qty:'1 bunch', name:'Coriander'},{qty:'2', name:'Limes'},{qty:'1', name:'Avocado'},
        {qty:'1 jar', name:'Salsa'},{qty:'100 g', name:'Feta'},{qty:'to taste', name:'Chipotle'},
      ],
    },
  ];

  // Build week — current week with some meals, next week stubbed
  const days = getWeek(0);
  const assign = ['m_pasta','m_salmon','m_tacos',null,'m_chicken',null,'m_lasagna'];
  const week = {};
  days.forEach((d, i) => {
    week[ymd(d)] = { mealId: assign[i] || null, eatingOut: false, eatingOutNote: '', isBendigo: false };
  });
  // Seed a Bendigo day and an eating-out day in the current week for demo
  if (days[1]) week[ymd(days[1])].isBendigo = true;
  if (days[4]) { week[ymd(days[4])].eatingOut = true; week[ymd(days[4])].eatingOutNote = 'Thai place on Smith St'; week[ymd(days[4])].mealId = null; }

  return {
    version: 1,
    signedIn: false,
    household: {
      id: 'h1',
      name: 'The Hathakims',
      members: [
        { id:'u1', name:'Leigh', initial:'L', color:'terra' },
        { id:'u2', name:'Vicky', initial:'V', color:'sage'  },
      ],
    },
    user: { id:'u1', name:'Leigh', initial:'L' },
    prefs: {
      defaultStore: 'coles',
      notifyOnAdd: false,
      demoOffline: false,
    },
    products,
    list,
    meals,
    week,
  };
}

// ---------- App state ----------
let state = loadState() || seedState();

// Migrate old week format (string|null) → new object format
{
  const newWeek = {};
  for (const [k, v] of Object.entries(state.week || {})) {
    if (v === null || typeof v === 'string') {
      newWeek[k] = { mealId: v || null, eatingOut: false, eatingOutNote: '', isBendigo: false };
    } else {
      newWeek[k] = v;
    }
  }
  state.week = newWeek;
}

// Ensure meals have lastMadeDate
state.meals.forEach(m => { if (!('lastMadeDate' in m)) m.lastMadeDate = null; });

const ui = {
  currentScreen: state.signedIn ? 'shopping' : 'signin',
  history: [],
  activeMealId: null,
  pickedIngredients: new Set(),
  libFilter: 'all',
  sheetOpen: false,
  daySheetOpen: false,
  priceSheetOpen: false,
  confirmSheetOpen: false,
  addMode: 'url',
  urlScraping: false,
  urlScraped: null,
  urlError: null,
  pastSelectedId: null,
  pastQty: 1,
  pastNote: '',
  pastSearch: '',
  formDraft: null,
  dayTarget: null,         // { key, date } — day currently open in sheet
  showingPastWeeks: false, // toggle between upcoming and past week view
};
state.ui = ui;

// ---------- DOM helpers ----------
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const escapeHTML = s => String(s ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

function thumbColor(id) {
  const colors = ['peach','sage','cream','rose','terra'];
  let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return colors[Math.abs(h) % colors.length];
}
function host(url) {
  try { return new URL(url).hostname.replace(/^www\./,''); } catch { return ''; }
}

// ---------- Product image lookup (Woolworths API) ----------
const IMG_CACHE_KEY = 'productImgCache';
function imgCacheGet(name) {
  try {
    const c = JSON.parse(localStorage.getItem(IMG_CACHE_KEY) || '{}');
    const key = name.toLowerCase();
    return key in c ? c[key] : undefined; // undefined = uncached; null = searched, not found
  } catch { return undefined; }
}
function imgCacheSet(name, url) {
  try {
    const c = JSON.parse(localStorage.getItem(IMG_CACHE_KEY) || '{}');
    c[name.toLowerCase()] = url;
    localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(c));
  } catch {}
}
async function fetchProductImage(name) {
  const cached = imgCacheGet(name);
  if (cached !== undefined) return cached;
  try {
    const r = await fetch(
      `https://www.woolworths.com.au/apis/ui/Search/products?searchTerm=${encodeURIComponent(name)}&pageSize=1&sortType=TraderRelevance`,
      { headers: { Accept: 'application/json' } }
    );
    if (!r.ok) throw 0;
    const d = await r.json();
    const imgUrl = d?.Products?.[0]?.Products?.[0]?.MediumImageFile || null;
    imgCacheSet(name, imgUrl);
    return imgUrl;
  } catch {
    imgCacheSet(name, null);
    return null;
  }
}
async function loadShoppingImages() {
  const thumbs = document.querySelectorAll('#shopList .thumb[data-product-id]:not(.has-img)');
  for (const thumb of thumbs) {
    const product = state.products.find(p => p.id === thumb.dataset.productId);
    if (!product) continue;
    const imgUrl = await fetchProductImage(product.name);
    if (!document.contains(thumb)) continue; // re-rendered while we were fetching
    if (!imgUrl) continue;
    thumb.classList.add('has-img');
    thumb.innerHTML = `<img src="${escapeHTML(imgUrl)}" alt="">`;
    await new Promise(r => setTimeout(r, 40)); // gentle rate limit
  }
}
function storeLabel(s) {
  return { coles:'Coles', woolies:'Woolies', aldi:'Aldi' }[s] || '';
}

let toastTimeout;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), 2000);
}

// ---------- Routing ----------
function showScreen(name, addToHistory = true) {
  if (addToHistory && ui.currentScreen && ui.currentScreen !== name) {
    ui.history.push(ui.currentScreen);
  }
  ui.currentScreen = name;
  $$('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === name));
  const showTabs = ['shopping','meals','recipes'].includes(name);
  $('#tabbar').style.display = showTabs ? 'flex' : 'none';
  $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  const screenEl = $(`.screen[data-screen="${name}"]`);
  if (screenEl) screenEl.scrollTop = 0;
  render();
}
function back() {
  const prev = ui.history.pop();
  if (prev) showScreen(prev, false);
  else showScreen('shopping', false);
}

// ---------- Mock scraper ----------
const SAMPLE_PRODUCTS = [
  { keys:['olive','oil'],          name:'Cobram Light Olive Oil',          package:'750mL',     emoji:'🫒', category:'Pantry'  },
  { keys:['banana'],               name:'Bananas',                          package:'Bunch of 6', emoji:'🍌', category:'Produce' },
  { keys:['milk'],                 name:'Pauls Smarter White Milk',         package:'2L',        emoji:'🥛', category:'Dairy'   },
  { keys:['bread','sourdough'],    name:'Sourdough loaf',                   package:'Each',      emoji:'🍞', category:'Bakery'  },
  { keys:['salmon'],               name:'Tasmanian Salmon Fillet',          package:'Each',      emoji:'🐟', category:'Seafood' },
  { keys:['avocado'],              name:'Avocados',                         package:'Each',      emoji:'🥑', category:'Produce' },
  { keys:['chicken'],              name:'Free range chicken breast',        package:'500 g',     emoji:'🍗', category:'Meat'    },
  { keys:['cheese','cheddar'],     name:'Aged cheddar',                     package:'250 g',     emoji:'🧀', category:'Dairy'   },
  { keys:['pasta','spaghetti'],    name:'Spaghetti',                        package:'500 g',     emoji:'🍝', category:'Pantry'  },
  { keys:['rice','jasmine'],       name:'Jasmine rice',                     package:'1 kg',      emoji:'🍚', category:'Pantry'  },
  { keys:['tomato'],               name:'Roma tomatoes',                    package:'Each',      emoji:'🍅', category:'Produce' },
  { keys:['biscuit','tim'],        name:'Tim Tams Original',                package:'200 g',     emoji:'🍪', category:'Pantry'  },
];
function mockScrape(url) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      let store = null, h = '';
      try {
        const u = new URL(url);
        h = u.hostname.replace(/^www\./,'');
        if (h.includes('coles.com.au'))           store = 'coles';
        else if (h.includes('woolworths.com.au')) store = 'woolies';
        else if (h.includes('aldi.com.au'))       store = 'aldi';
      } catch {}
      if (!store) return reject(new Error('Only Coles, Woolies, and Aldi URLs are supported.'));
      if (/fail|404/i.test(url)) return reject(new Error("Couldn't read that page."));
      const path = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return ''; }})();
      const match = SAMPLE_PRODUCTS.find(s => s.keys.some(k => path.includes(k))) || {
        name: 'Sample product', package: 'Each', emoji: '🛒', category: 'Pantry',
      };
      resolve({ ...match, store, sourceUrl: url, scrapeFailed: false });
    }, 700);
  });
}

// ---------- Mock price comparison ----------
const MOCK_PRICES = {
  'Bananas':           { coles: 3.90, woolies: 3.50 },
  'Fresh basil':       { coles: 3.00, woolies: 2.80 },
  'Avocados':          { coles: 2.50, woolies: 2.00 },
  'Tim Tams':          { coles: 4.50, woolies: 4.00 },
  'Sourdough loaf':    { coles: 5.00, woolies: 5.50 },
  'Salmon fillets':    { coles: 9.00, woolies: 10.50 },
  'Pauls Smarter Milk':{ coles: 3.20, woolies: 3.00 },
  'Cobram olive oil':  { coles: 9.50, woolies: 8.80 },
};
function getMockPrices(name) {
  for (const [k, v] of Object.entries(MOCK_PRICES)) {
    if (name.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(name.toLowerCase().split(' ')[0])) {
      return v;
    }
  }
  // Generate deterministic fake prices from name hash
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  const base = 2.00 + (Math.abs(h) % 1200) / 100;
  const diff = 0.10 + (Math.abs(h >> 4) % 80) / 100;
  return h % 2 === 0
    ? { coles: +(base).toFixed(2), woolies: +(base + diff).toFixed(2) }
    : { coles: +(base + diff).toFixed(2), woolies: +(base).toFixed(2) };
}

// ---------- Mutations ----------
function addProduct(p) {
  const existing = state.products.find(x => x.sourceUrl && p.sourceUrl && x.sourceUrl === p.sourceUrl);
  if (existing) {
    Object.assign(existing, { name: p.name, package: p.package, store: p.store, emoji: p.emoji, category: p.category, scrapeFailed: false });
    return existing;
  }
  const np = { id: uid('p_'), ...p, lastBuyDate: null, lastBuyQty: null, scrapeFailed: false };
  state.products.push(np);
  return np;
}
function addToList(productId, qty=1, note='') {
  const item = {
    id: uid('i_'),
    productId, qty: Math.max(1, qty|0), note: note.trim(),
    ticked: false,
    addedBy: state.user.id,
    addedAt: Date.now(),
  };
  state.list.push(item);
  const p = state.products.find(x => x.id === productId);
  if (p) { p.lastBuyDate = Date.now(); p.lastBuyQty = item.qty; }
  saveState();
  return item;
}
function tickItem(itemId) {
  const it = state.list.find(x => x.id === itemId);
  if (!it) return;
  it.ticked = !it.ticked;
  saveState();
  if (it.ticked && state.list.length > 0 && state.list.every(x => x.ticked)) {
    setTimeout(celebrateAllDone, 320);
  }
}

const TICK_COPY = ['Sorted', 'Got it', 'In the trolley', 'Grabbed', 'Picked up'];
let lastTickIdx = -1;
function showTickToast() {
  const total = state.list.length;
  const willBeDone = state.list.filter(x => !x.ticked).length; // one is about to be ticked
  if (willBeDone <= 1) return; // last item — confetti + "nice work" handles this
  if (total > 3 && willBeDone === Math.ceil(total / 2)) {
    toast('Halfway through the list', 1600);
    return;
  }
  let idx;
  do { idx = Math.floor(Math.random() * TICK_COPY.length); }
  while (idx === lastTickIdx && TICK_COPY.length > 1);
  lastTickIdx = idx;
  toast(TICK_COPY[idx], 1100);
}

function celebrateAllDone() {
  toast('Nice work, you two', 2200);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const appEl = document.getElementById('app');
  if (!appEl) return;
  const rect = appEl.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.width  = rect.width;
  canvas.height = rect.height;
  canvas.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:999;`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const COLORS = ['#C97D5D','#6B8E6F','#E8C9A8','#b5d4b7','#FFF1E2','#c4a882'];
  const particles = Array.from({length: 60}, () => ({
    x:     W * 0.15 + Math.random() * W * 0.7,
    y:     H * 0.45,
    vx:    (Math.random() - 0.5) * 11,
    vy:    -(Math.random() * 11 + 4),
    w:     Math.random() * 9 + 4,
    h:     Math.random() * 5 + 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot:   Math.random() * Math.PI * 2,
    rotV:  (Math.random() - 0.5) * 0.26,
    alpha: 1,
  }));
  (function draw() {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.38;
      p.vx *= 0.98; p.rot += p.rotV; p.alpha -= 0.015;
      if (p.alpha <= 0) continue;
      alive = true;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive) requestAnimationFrame(draw);
    else canvas.remove();
  })();
}
function clearTicked() {
  state.list = state.list.filter(x => !x.ticked);
  saveState();
}

function getDayEntry(key) {
  const e = state.week[key];
  if (!e || typeof e !== 'object') return { mealId: null, eatingOut: false, eatingOutNote: '', isBendigo: false };
  return e;
}
function setDayEntry(key, updates) {
  state.week[key] = { ...getDayEntry(key), ...updates };
  saveState();
}
function setDayMeal(key, mealId) {
  setDayEntry(key, { mealId, eatingOut: false, eatingOutNote: '' });
  // Update lastMadeDate on the meal if the day is today or in the past
  if (mealId) {
    const m = state.meals.find(x => x.id === mealId);
    if (m) {
      const [y, mo, d] = key.split('-').map(Number);
      const dayDate = new Date(y, mo-1, d);
      const today = new Date(); today.setHours(0,0,0,0);
      if (dayDate <= today) {
        if (!m.lastMadeDate || dayDate.getTime() > m.lastMadeDate) {
          m.lastMadeDate = dayDate.getTime();
        }
      }
    }
  }
  saveState();
}

// ---------- Render: shopping ----------
function renderShopping() {
  const total = state.list.length;
  const done = state.list.filter(i => i.ticked).length;

  $('#shopTitle').textContent = 'Shopping list';
  $('#shopSub').textContent = total ? `· ${total} items · ${done} done` : '· nothing on the list';


  const banner = $('#offlineBanner');
  if (state.prefs.demoOffline) {
    banner.classList.remove('hidden');
    banner.outerHTML = `
      <div class="offline-banner" id="offlineBanner">
        <span class="pulse"></span>
        <div class="txt">
          <div class="ttl">You're offline</div>
          <div class="sm">Ticks save here and sync when you're back.</div>
        </div>
      </div>`;
  } else {
    if (banner && !banner.classList.contains('hidden')) banner.outerHTML = `<div id="offlineBanner" class="hidden"></div>`;
  }

  const list = $('#shopList');
  if (total === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🧺</div>
        <h2 class="empty-h">All caught up</h2>
        <p class="empty-sub">Nothing on the list right now. Add items as you think of them — they'll sync to Vicky's phone in real time.</p>
        <button class="empty-link" data-action="open-add">Add the first item →</button>
      </div>`;
    return;
  }

  const unticked = state.list.filter(i => !i.ticked);
  const ticked   = state.list.filter(i =>  i.ticked);

  const rowHtml = (item) => {
    const product = state.products.find(x => x.id === item.productId);
    if (!product) return '';
    const qtyPrefix = item.qty > 1 ? `<b>${item.qty} ×</b> ` : '';
    const stale = product.scrapeFailed
      ? `<span class="stale-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>Couldn't refresh</span>`
      : '';
    const note = item.note ? `<div class="note">📝 ${escapeHTML(item.note)}</div>` : '';
    const storeSpan = product.store ? `<span class="store ${product.store}">${storeLabel(product.store)}</span>` : '';
    const meta = `${qtyPrefix}${escapeHTML(product.package)}${storeSpan ? ' · ' + storeSpan : ''}`;
    return `
      <div class="card${item.ticked ? ' done' : ''}" data-item-id="${item.id}">
        <div class="thumb ${thumbColor(product.id)}" data-product-id="${product.id}">${product.emoji}</div>
        <div class="body">
          <div class="name">${escapeHTML(product.name)}</div>
          <div class="meta">${meta}${stale}</div>
          ${note}
        </div>
        <button class="check" data-action="tick" data-item-id="${item.id}" aria-label="Tick ${escapeHTML(product.name)}">
          <svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>`;
  };

  const groups = {};
  for (const item of unticked) {
    const p = state.products.find(x => x.id === item.productId);
    const cat = p?.category || 'Other';
    (groups[cat] = groups[cat] || []).push(item);
  }
  const order = ['Produce','Bakery','Dairy','Seafood','Meat','Pantry','Recipe','Other'];
  const cats = Object.keys(groups).sort((a,b) => order.indexOf(a) - order.indexOf(b));

  let html = cats.map(cat => `
    <div class="section-title"><span>${cat}</span></div>
    ${groups[cat].map(rowHtml).join('')}
  `).join('');

  if (ticked.length) {
    html += `
      <div class="section-title trolley-head">
        <span>In the trolley</span>
        <button class="clear-btn" data-action="clear-trolley">Clear picked items</button>
      </div>
      ${ticked.map(rowHtml).join('')}`;
  }

  if (unticked.length === 0 && ticked.length > 0) {
    html = `
      <div class="empty-state" style="padding: 32px 32px 8px;">
        <div class="empty-icon">✅</div>
        <h2 class="empty-h">All collected</h2>
        <p class="empty-sub">Everything's in the trolley. Clear it out when you're home.</p>
      </div>` + html;
  }

  list.innerHTML = html;
  loadShoppingImages();
}

// ---------- Render: meal planner (multi-week) ----------
function renderMeals() {
  const today = new Date(); today.setHours(0,0,0,0);

  // History button state
  const histBtn = $('#weekHistoryBtn');
  if (histBtn) {
    histBtn.classList.toggle('active-mode', ui.showingPastWeeks);
    histBtn.title = ui.showingPastWeeks ? 'Show upcoming weeks' : 'View previous weeks';
  }

  // Sub-title
  $('#weekSub').textContent = ui.showingPastWeeks ? 'Previous 6 weeks' : 'Upcoming 6 weeks · dinners';

  const offsets = ui.showingPastWeeks ? [-6,-5,-4,-3,-2,-1] : [0,1,2,3,4,5];

  const dayRowHtml = (d, isToday) => {
    const key = ymd(d);
    const entry = getDayEntry(key);
    // Dot inside the date cap for Bendigo days
    const dateCap = `<div class="date-cap">
      <div class="dn">${DAYS_SHORT[d.getDay()]}</div>
      <div class="dnum">${d.getDate()}</div>
      ${entry.isBendigo ? '<div class="bendigo-dot"></div>' : ''}
    </div>`;

    if (entry.eatingOut) {
      return `<button class="day-row eating-out${isToday ? ' today' : ''}" data-action="open-day" data-day="${key}">
        ${dateCap}
        <div class="meal-info">
          <div class="meal-name">Eating out</div>
          <div class="meal-meta">${escapeHTML(entry.eatingOutNote || 'Tap to add details')}</div>
          ${entry.isBendigo ? '<span class="bendigo-pill">Bendigo</span>' : ''}
        </div>
        <div class="chev">›</div>
      </button>`;
    }

    const meal = entry.mealId && state.meals.find(m => m.id === entry.mealId);
    if (!meal) {
      return `<button class="day-row empty" data-action="open-day" data-day="${key}">
        ${dateCap}
        <div class="empty-add">
          <span>+ Add dinner</span>
          ${entry.isBendigo ? '<span class="bendigo-pill">Bendigo</span>' : ''}
        </div>
      </button>`;
    }

    const bits = [];
    if (meal.timeMin) bits.push(`${meal.timeMin} min`);
    if (host(meal.recipeUrl)) bits.push(host(meal.recipeUrl));
    const meta = bits.join(' · ') || ' ';
    return `<button class="day-row${isToday ? ' today' : ''}" data-action="open-day" data-day="${key}">
      ${dateCap}
      <div class="meal-info">
        <div class="meal-name">${escapeHTML(meal.name)}</div>
        <div class="meal-meta">${escapeHTML(meta)}</div>
        ${entry.isBendigo ? '<span class="bendigo-pill">Bendigo</span>' : ''}
      </div>
      <div class="chev">›</div>
    </button>`;
  };

  const html = offsets.map(offset => {
    const week = getWeek(offset);
    const label = weekLabel(offset);
    const range = weekRangeShort(offset);
    const rows = week.map(d => dayRowHtml(d, isSameDay(d, today))).join('');
    const todayBtn = offset !== 0
      ? `<button class="week-today-btn" data-action="scroll-to-today">↑ Today</button>`
      : '';
    return `
      <div class="week-section">
        <div class="week-divider">
          <span class="wlabel">${escapeHTML(label)}</span>
          <span class="wrange">${escapeHTML(range)}</span>
          <span class="wline"></span>
          ${todayBtn}
        </div>
        ${rows}
      </div>`;
  }).join('');

  $('#weekList').innerHTML = html;
}

function mealInitial(name) {
  return escapeHTML((name || '?').charAt(0).toUpperCase());
}

// ---------- Render: meal library ----------
function renderLibrary() {
  let meals = state.meals.slice();
  if (ui.libFilter === 'frequent') meals = meals.filter(m => m.frequent);
  else if (ui.libFilter === 'quick') meals = meals.filter(m => (m.timeMin||0) > 0 && m.timeMin <= 30);
  meals.sort((a,b) => Number(b.frequent) - Number(a.frequent));

  const total = state.meals.length;
  const fav = state.meals.filter(m => m.frequent).length;
  $('#libSub').innerHTML = `<span>${total} saved · ${fav} frequent</span>`;

  $$('#libFilters button').forEach(b => b.classList.toggle('on', b.dataset.filter === ui.libFilter));

  if (meals.length === 0) {
    $('#libList').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍽️</div>
        <h2 class="empty-h">No meals saved yet</h2>
        <p class="empty-sub">Save a few favourites and dinner planning gets a lot easier.</p>
      </div>`;
    return;
  }

  $('#libList').innerHTML = meals.map(m => {
    const tags = [];
    if (m.frequent) tags.push(`<span class="ltag fav">★ Frequent</span>`);
    tags.push(`<span class="ltag last-made">${escapeHTML(lastMadeLabel(m.lastMadeDate))}</span>`);
    if (host(m.recipeUrl)) tags.push(`<span class="ltag">${escapeHTML(host(m.recipeUrl))}</span>`);
    return `<div class="lib-card" role="button" tabindex="0" data-action="open-meal" data-meal-id="${m.id}">
      <div class="lt ${thumbColor(m.id)}">${mealInitial(m.name)}</div>
      <div class="body">
        <div class="lname">${escapeHTML(m.name)}</div>
        <div class="lmeta">${m.ingredients.length} ingredients${m.timeMin?` · ${m.timeMin} min`:''}</div>
        ${tags.length ? `<div class="ltags">${tags.join('')}</div>` : ''}
      </div>
      <button class="lib-edit" data-action="edit-meal-quick" data-meal-id="${m.id}" aria-label="Edit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
      </button>
    </div>`;
  }).join('');
}

// ---------- Render: meal detail ----------
function renderMealDetail() {
  const m = state.meals.find(x => x.id === ui.activeMealId);
  if (!m) { back(); return; }

  $('#mealHero').style.background = `linear-gradient(135deg, var(--terra-soft), var(--terra))`;
  $('#mealHeroEmoji').textContent = m.emoji;
  $('#mealTitle').textContent = m.name;

  const meta = [];
  if (m.timeMin) meta.push(`<span><b>${m.timeMin}</b> min</span>`);
  meta.push(`<span><b>${m.ingredients.length}</b> ingredients</span>`);
  if (m.frequent) meta.push(`<span><b>★ Frequent</b></span>`);
  $('#mealMeta').innerHTML = meta.join('');

  $('#mealNotes').style.display = m.notes ? '' : 'none';
  $('#mealNotes').textContent = m.notes || '';
  if (m.notes) $('#mealNotes').innerHTML = escapeHTML(m.notes);

  const src = $('#mealSource');
  if (m.recipeUrl) {
    src.style.display = '';
    src.href = m.recipeUrl;
    src.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
      View recipe<span class="host">· ${escapeHTML(host(m.recipeUrl))}</span>`;
  } else {
    src.style.display = 'none';
  }

  if (!ui._ingredientsForMeal || ui._ingredientsForMeal !== m.id) {
    ui.pickedIngredients = new Set();
    ui._ingredientsForMeal = m.id;
  }
  $('#mealIngredients').innerHTML = m.ingredients.map((ing, idx) => `
    <button class="ing-row${ui.pickedIngredients.has(idx) ? ' picked' : ''}" data-action="pick-ing" data-idx="${idx}">
      <span class="qtyl">${escapeHTML(ing.qty)}</span>
      <span class="nm">${escapeHTML(ing.name)}</span>
      <span class="ck"><svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    </button>`).join('');

  const picked = ui.pickedIngredients.size;
  const btn = $('#addToListBtn');
  btn.disabled = picked === 0;
  btn.textContent = picked === 0 ? 'Pick ingredients to add' : `Add ${picked} to shopping list`;

  $('#mealFavBtn').style.color = m.frequent ? 'var(--terra)' : 'var(--mute-2)';
}

// ---------- Render: meal form ----------
function startMealForm(mealId = null) {
  if (mealId) {
    const m = state.meals.find(x => x.id === mealId);
    if (!m) return;
    ui.formDraft = JSON.parse(JSON.stringify(m));
  } else {
    ui.formDraft = {
      id: null, name: '', emoji: '🍽️', frequent: false,
      notes: '', recipeUrl: '', timeMin: null,
      lastMadeDate: null,
      ingredients: [{qty:'', name:''}],
    };
  }
  showScreen('meal-form');
}

const FORM_EMOJIS = ['🍝','🍗','🥗','🐟','🌮','🍲','🍛','🍜','🥘','🥪','🍔','🌯','🍱','🍣','🍕','🥙','🍳','🥞','🍞','🍰','🍽️'];
function cycleFormEmoji() {
  if (!ui.formDraft) return;
  const i = FORM_EMOJIS.indexOf(ui.formDraft.emoji);
  ui.formDraft.emoji = FORM_EMOJIS[(i + 1) % FORM_EMOJIS.length];
  $('#formEmojiCurrent').textContent = ui.formDraft.emoji;
}

function renderMealForm() {
  const d = ui.formDraft;
  if (!d) return;
  $('#formTitle').textContent = d.id ? 'Edit meal' : 'New meal';
  $('#formEmojiCurrent').textContent = d.emoji;
  $('#formName').value = d.name || '';
  $('#formNotes').value = d.notes || '';
  $('#formUrl').value = d.recipeUrl || '';
  $('#formFrequent').classList.toggle('off', !d.frequent);

  $('#formIngredients').innerHTML = d.ingredients.map((ing, idx) => `
    <div class="ing-edit-row" data-idx="${idx}">
      <input class="qf" placeholder="Qty"  value="${escapeHTML(ing.qty)}" data-field="qty"  data-idx="${idx}"/>
      <input class="nf" placeholder="Name" value="${escapeHTML(ing.name)}" data-field="name" data-idx="${idx}"/>
      <button class="rm" data-action="remove-ing" data-idx="${idx}" aria-label="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>
      </button>
    </div>`).join('');

  $('#deleteMealBtn').style.display = d.id ? '' : 'none';
}

function saveFormDraft() {
  const d = ui.formDraft;
  if (!d) return;
  d.name = $('#formName').value.trim();
  d.notes = $('#formNotes').value.trim();
  d.recipeUrl = $('#formUrl').value.trim();
  d.frequent = !$('#formFrequent').classList.contains('off');
  $$('#formIngredients .ing-edit-row').forEach((row, i) => {
    const q = row.querySelector('[data-field=qty]')?.value ?? '';
    const n = row.querySelector('[data-field=name]')?.value ?? '';
    if (d.ingredients[i]) { d.ingredients[i].qty = q; d.ingredients[i].name = n; }
  });
  d.ingredients = d.ingredients.filter(ing => ing.qty.trim() || ing.name.trim());
  if (d.ingredients.length === 0) d.ingredients = [{qty:'', name:''}];
}

function commitMealForm() {
  saveFormDraft();
  const d = ui.formDraft;
  if (!d.name.trim()) { toast('Give the meal a name first.'); return; }
  if (d.id) {
    const idx = state.meals.findIndex(m => m.id === d.id);
    if (idx >= 0) state.meals[idx] = d;
  } else {
    d.id = uid('m_');
    state.meals.push(d);
  }
  saveState();
  toast(d.id ? 'Meal saved' : 'Meal created');
  ui.formDraft = null;
  back();
}

function deleteMeal() {
  const d = ui.formDraft;
  if (!d || !d.id) return;
  openConfirmSheet(
    `Delete "${d.name}"?`,
    'It will also be removed from your meal planner.',
    'Delete meal',
    true,
    () => {
      state.meals = state.meals.filter(m => m.id !== d.id);
      Object.keys(state.week).forEach(k => {
        const e = getDayEntry(k);
        if (e.mealId === d.id) setDayEntry(k, { mealId: null });
      });
      saveState();
      toast('Meal deleted');
      ui.formDraft = null;
      back();
    }
  );
}

// ---------- Render: settings ----------
function renderSettings() {
  $('#settingsMembers').innerHTML = state.household.members.map(m =>
    `<span class="av ${m.initial.toLowerCase()}">${escapeHTML(m.initial)}</span>`
  ).join('');
  $('#settingsInitial').textContent = state.user.initial;
  $('#settingsName').textContent = state.user.name + ' Hathaway';
  $$('#defaultStore button').forEach(b => b.classList.toggle('on', b.dataset.store === state.prefs.defaultStore));
  $$('[data-pref]').forEach(b => {
    const k = b.dataset.pref;
    b.classList.toggle('off', !state.prefs[k]);
  });
}

// ---------- Render dispatcher ----------
function render() {
  switch (ui.currentScreen) {
    case 'shopping':    renderShopping(); break;
    case 'meals':       renderMeals(); break;
    case 'recipes':     renderLibrary(); break;
    case 'meal-detail': renderMealDetail(); break;
    case 'meal-form':   renderMealForm(); break;
    case 'settings':    renderSettings(); break;
  }
}

// ---------- Confirm sheet ----------
let confirmCallback = null;

function openConfirmSheet(title, body, confirmLabel, isDanger, onConfirm) {
  confirmCallback = onConfirm;
  $('#confirmTitle').textContent = title;
  $('#confirmBody').textContent = body;
  const btn = $('#confirmBtn');
  btn.textContent = confirmLabel;
  btn.className = `btn ${isDanger ? 'danger-solid' : 'terra'}`;
  ui.confirmSheetOpen = true;
  $('#scrim').classList.add('open');
  $('#confirmSheet').classList.add('open');
}

function closeConfirmSheet() {
  ui.confirmSheetOpen = false;
  confirmCallback = null;
  $('#scrim').classList.remove('open');
  $('#confirmSheet').classList.remove('open');
}

// ---------- Add sheet ----------
function openAdd() {
  ui.sheetOpen = true;
  ui.urlScraping = false; ui.urlScraped = null; ui.urlError = null;
  ui.pastSelectedId = null; ui.pastQty = 1; ui.pastNote = '';
  $('#urlInput').value = '';
  $('#quickName').value = ''; $('#quickQty').value = '1'; $('#quickNote').value = '';
  $('#urlStatus').innerHTML = ''; $('#urlPreview').innerHTML = '';
  $('#urlAddBtn').classList.add('hidden');
  setAddMode('url');
  $('#scrim').classList.add('open');
  $('#addSheet').classList.add('open');
  renderPastList();
}
function closeAdd() {
  ui.sheetOpen = false;
  $('#scrim').classList.remove('open');
  $('#addSheet').classList.remove('open');
}
function setAddMode(mode) {
  ui.addMode = mode;
  $$('#addTabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  $$('.add-pane').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== mode));
}

let scrapeDebounce;
function onUrlInput() {
  clearTimeout(scrapeDebounce);
  const url = $('#urlInput').value.trim();
  ui.urlScraped = null; ui.urlError = null;
  $('#urlPreview').innerHTML = '';
  $('#urlAddBtn').classList.add('hidden');
  $('#urlInputWrap').classList.remove('errored');
  if (!url) { $('#urlStatus').innerHTML = ''; return; }
  $('#urlStatus').innerHTML = `
    <div class="preview" aria-hidden="true">
      <div class="pthumb loading-skel"></div>
      <div class="pbody" style="flex:1">
        <div class="loading-skel" style="height:14px;width:80%;border-radius:6px;"></div>
        <div class="loading-skel" style="height:11px;width:50%;border-radius:6px;margin-top:6px;"></div>
      </div>
    </div>`;
  scrapeDebounce = setTimeout(async () => {
    try {
      ui.urlScraping = true;
      const r = await mockScrape(url);
      ui.urlScraping = false; ui.urlScraped = r;
      $('#urlStatus').innerHTML = '';
      $('#urlPreview').innerHTML = `
        <div class="preview">
          <div class="pthumb">${r.emoji}</div>
          <div class="pbody">
            <div class="ptitle">${escapeHTML(r.name)}</div>
            <div class="pmeta">${escapeHTML(r.package)} · <span class="store ${r.store}">${storeLabel(r.store)}</span></div>
            <span class="ppill">${escapeHTML(r.category)}</span>
          </div>
        </div>
        <div class="qty">
          <div class="field"><span class="lbl">Qty</span><input id="urlQty" type="number" inputmode="numeric" min="1" value="1"/></div>
          <div class="field"><span class="lbl">Note (optional)</span><input id="urlNote" placeholder="—"/></div>
        </div>`;
      $('#urlAddBtn').classList.remove('hidden');
    } catch (e) {
      ui.urlScraping = false; ui.urlError = e.message;
      $('#urlInputWrap').classList.add('errored');
      $('#urlStatus').innerHTML = `
        <div class="error-block">
          <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div>
          <div class="ebody">
            <div class="etitle">${escapeHTML(e.message)}</div>
            <div class="esub">Check the URL, try again, or fill the details in by hand.</div>
          </div>
        </div>
        <div class="error-actions">
          <button class="err-btn" data-action="edit-url">Edit URL</button>
          <button class="err-btn primary" data-action="retry-url">Try again</button>
        </div>
        <button class="manual-fill" data-action="goto-quick">
          Or just type what you need
          <span class="lk">Fill it in manually →</span>
        </button>`;
    }
  }, 600);
}

function urlAddCommit() {
  if (!ui.urlScraped) return;
  const r = ui.urlScraped;
  const product = addProduct({ name: r.name, package: r.package, store: r.store, emoji: r.emoji, category: r.category, sourceUrl: r.sourceUrl });
  const qty = parseInt($('#urlQty')?.value, 10) || 1;
  const note = $('#urlNote')?.value || '';
  addToList(product.id, qty, note);
  closeAdd();
  showScreen('shopping', false);
  toast(`Added ${product.name}`);
}

function quickAddCommit() {
  const name = $('#quickName').value.trim();
  if (!name) { toast('Type a name first'); return; }
  const qty = parseInt($('#quickQty').value, 10) || 1;
  const note = $('#quickNote').value || '';
  const product = addProduct({ name, package: 'Each', store: null, emoji: '🛒', category: 'Other', sourceUrl: null });
  addToList(product.id, qty, note);
  closeAdd();
  showScreen('shopping', false);
  toast(`Added ${name}`);
}

// ---------- Past items pane ----------
function renderPastList() {
  const search = ui.pastSearch.toLowerCase();
  const products = state.products.slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .filter(p => !search || p.name.toLowerCase().includes(search));

  const html = products.map(p => {
    const isSel = p.id === ui.pastSelectedId;
    const lastBuy = p.lastBuyDate
      ? `Last bought ${Math.round((Date.now()-p.lastBuyDate)/86400000)} days ago${p.lastBuyQty?` · qty ${p.lastBuyQty}`:''}`
      : 'Not bought yet';
    if (isSel) {
      return `
        <div class="past-expanded">
          <div class="top">
            <div class="pt ${thumbColor(p.id)}">${p.emoji}</div>
            <div class="pbody">
              <div class="pname">${escapeHTML(p.name)}</div>
              <div class="pmeta">${escapeHTML(p.package)}${p.store?` · <span class="store ${p.store}">${storeLabel(p.store)}</span>`:''}</div>
              <div class="lastbuy">${lastBuy}</div>
            </div>
          </div>
          <div class="qty-row">
            <div class="qty-stepper">
              <button data-action="qty-dec">−</button>
              <span class="num" id="pastQtyNum">${ui.pastQty}</span>
              <button data-action="qty-inc">+</button>
            </div>
            <div class="note-pill-input">
              <span class="lbl">Note for this shop</span>
              <input id="pastNote" placeholder="—" value="${escapeHTML(ui.pastNote)}"/>
            </div>
          </div>
          <button class="add-mini" data-action="past-commit">Add to list</button>
        </div>`;
    }
    return `<button class="past-row" data-action="past-select" data-id="${p.id}">
      <div class="pt ${thumbColor(p.id)}">${p.emoji}</div>
      <div class="pbody">
        <div class="pname">${escapeHTML(p.name)}</div>
        <div class="pmeta">${escapeHTML(p.package)}${p.store?` · <span class="store ${p.store}">${storeLabel(p.store)}</span>`:''}</div>
      </div>
      <span class="qadd">+</span>
    </button>`;
  }).join('');

  $('#pastList').innerHTML = html || `
    <div class="empty-state" style="padding:20px 0;">
      <div class="empty-h" style="font-size:18px;">No past products</div>
      <p class="empty-sub" style="font-size:13px;">Add a few items first.</p>
    </div>`;
}

function pastSelect(productId) {
  const p = state.products.find(x => x.id === productId);
  if (p && p.sourceUrl) {
    mockScrape(p.sourceUrl).then(r => {
      p.name = r.name; p.package = r.package; p.emoji = r.emoji;
      p.store = r.store; p.scrapeFailed = false;
      saveState();
      if (ui.sheetOpen && ui.addMode === 'past') renderPastList();
    }).catch(() => { p.scrapeFailed = true; saveState(); });
  }
  ui.pastSelectedId = productId; ui.pastQty = 1; ui.pastNote = '';
  renderPastList();
}
function pastQtyDelta(d) {
  ui.pastQty = Math.max(1, ui.pastQty + d);
  $('#pastQtyNum').textContent = ui.pastQty;
}
function pastCommit() {
  const id = ui.pastSelectedId;
  if (!id) return;
  const note = $('#pastNote')?.value || '';
  addToList(id, ui.pastQty, note);
  const p = state.products.find(x => x.id === id);
  closeAdd();
  showScreen('shopping', false);
  toast(`Added ${p?.name || 'item'}`);
}

// ---------- Day options sheet ----------
function openDaySheet(dayKey) {
  // Parse the date from the key
  const [y, mo, d] = dayKey.split('-').map(Number);
  const date = new Date(y, mo-1, d);
  ui.dayTarget = { key: dayKey, date };
  ui.daySheetOpen = true;

  $('#daySheetTitle').textContent = longDateLabel(date);

  const entry = getDayEntry(dayKey);
  const bendigoToggle = $('#dayBendigoToggle');
  bendigoToggle.classList.toggle('off', !entry.isBendigo);

  renderDaySheetBody();

  $('#scrim').classList.add('open');
  $('#daySheet').classList.add('open');
}

function closeDaySheet() {
  ui.daySheetOpen = false;
  $('#scrim').classList.remove('open');
  $('#daySheet').classList.remove('open');
  ui.dayTarget = null;
  if (ui.currentScreen === 'meals') render();
}

function renderDaySheetBody() {
  if (!ui.dayTarget) return;
  const { key } = ui.dayTarget;
  const entry = getDayEntry(key);

  let html = '';

  // Eating out option
  const eatingOutSel = entry.eatingOut;
  html += `
    <div class="eating-out-option${eatingOutSel ? ' selected' : ''}" data-action="day-eating-out">
      <div class="eo-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
      </div>
      <div class="eo-body">
        <div class="eo-name">Eating out</div>
        <div class="eo-sub">Restaurant, takeaway, or going out</div>
      </div>
      <div class="eo-check"></div>
    </div>`;

  if (eatingOutSel) {
    html += `
      <div class="eating-out-note-wrap">
        <div class="input-row">
          <div class="v">
            <span class="lbl">Where / what</span>
            <input id="eatingOutNote" placeholder="e.g. Thai place on Smith St" value="${escapeHTML(entry.eatingOutNote || '')}"/>
          </div>
        </div>
      </div>`;
  }

  // Meal picker divider
  html += `<div class="day-sheet-divider"><span>or pick a meal</span></div>`;

  // Meal list
  state.meals.forEach(m => {
    const isSel = !entry.eatingOut && entry.mealId === m.id;
    html += `
      <div class="day-meal-option${isSel ? ' selected' : ''}" data-action="day-pick-meal" data-meal-id="${m.id}">
        <div class="dm-thumb ${thumbColor(m.id)}">${mealInitial(m.name)}</div>
        <div class="dm-body">
          <div class="dm-name">${escapeHTML(m.name)}</div>
          <div class="dm-meta">${m.timeMin ? m.timeMin + ' min' : ''}${m.timeMin && host(m.recipeUrl) ? ' · ' : ''}${host(m.recipeUrl) ? escapeHTML(host(m.recipeUrl)) : ''}</div>
        </div>
        <div class="dm-check"></div>
      </div>`;
  });

  // Clear option if something is set
  if (entry.mealId || entry.eatingOut) {
    html += `<button class="day-clear-btn" data-action="day-clear">Clear this day</button>`;
  }

  // View meal detail button if a meal is selected
  if (entry.mealId && !entry.eatingOut) {
    html += `<div style="height:10px;"></div>
      <button class="btn ghost" data-action="day-view-meal" style="margin-bottom:8px;">View meal →</button>`;
  }

  $('#daySheetBody').innerHTML = html;

  // Bind eating-out note save on input
  const noteInput = $('#eatingOutNote');
  if (noteInput) {
    noteInput.addEventListener('input', () => {
      setDayEntry(key, { eatingOutNote: noteInput.value });
    });
  }
}

// ---------- Scroll to today ----------
function scrollToToday() {
  if (ui.showingPastWeeks) {
    ui.showingPastWeeks = false;
    renderMeals();
  }
  requestAnimationFrame(() => {
    const screen = document.querySelector('.screen[data-screen="meals"]');
    const todayRow = screen?.querySelector('.day-row.today');
    if (!screen || !todayRow) return;
    const screenRect = screen.getBoundingClientRect();
    const rowRect = todayRow.getBoundingClientRect();
    const top = rowRect.top - screenRect.top + screen.scrollTop - 80;
    screen.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  });
}

// ---------- Price comparison sheet ----------
function openPriceSheet() {
  if (state.list.length === 0) { toast('Add items to your list first'); return; }
  ui.priceSheetOpen = true;
  const messages = [
    'Checking the Coles shelves…',
    'Asking Woolworths nicely…',
    'Comparing this week\'s specials…',
    'Running the numbers for you…',
    'Almost there…',
  ];
  let i = 0;
  const body = $('#priceSheetBody');
  body.innerHTML = `<div class="price-loading">${messages[0]}</div>`;
  const ticker = setInterval(() => {
    i = (i + 1) % messages.length;
    const el = body.querySelector('.price-loading');
    if (el) el.textContent = messages[i];
  }, 300);
  $('#scrim').classList.add('open');
  $('#priceSheet').classList.add('open');
  setTimeout(() => { clearInterval(ticker); renderPriceSheetBody(); }, 1200);
}

function closePriceSheet() {
  ui.priceSheetOpen = false;
  $('#scrim').classList.remove('open');
  $('#priceSheet').classList.remove('open');
}

function renderPriceSheetBody() {
  const unticked = state.list.filter(i => !i.ticked);
  if (unticked.length === 0) {
    $('#priceSheetBody').innerHTML = `<div class="price-loading">No items left to compare.</div>`;
    return;
  }

  let colesTotal = 0, wooliesTotal = 0;

  const rows = unticked.map(item => {
    const p = state.products.find(x => x.id === item.productId);
    if (!p) return '';
    // Skip Aldi items
    if (p.store === 'aldi') return '';

    const prices = getMockPrices(p.name);
    const colesP = prices.coles * item.qty;
    const wooliesP = prices.woolies * item.qty;
    colesTotal += colesP;
    wooliesTotal += wooliesP;
    const colesWins = colesP <= wooliesP;
    const saving = Math.abs(colesP - wooliesP).toFixed(2);

    return `
      <div class="price-row">
        <div class="pr-name">${escapeHTML(p.name)}${item.qty > 1 ? ` <span style="color:var(--mute);font-weight:400;">× ${item.qty}</span>` : ''}</div>
        <div class="price-cols">
          <div class="price-col${colesWins ? ' winner' : ''}">
            <div class="pc-store"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#E01A4F;margin-right:4px;"></span>Coles</div>
            <div class="pc-price">$${colesP.toFixed(2)}</div>
            ${colesWins ? `<div class="pc-badge">Cheaper</div>` : ''}
          </div>
          <div class="price-col${!colesWins ? ' winner' : ''}">
            <div class="pc-store"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#00813F;margin-right:4px;"></span>Woolies</div>
            <div class="pc-price">$${wooliesP.toFixed(2)}</div>
            ${!colesWins ? `<div class="pc-badge">Cheaper</div>` : ''}
          </div>
        </div>
      </div>`;
  }).filter(Boolean).join('');

  const winner = colesTotal <= wooliesTotal ? 'Coles' : 'Woolworths';
  const saving = Math.abs(colesTotal - wooliesTotal).toFixed(2);

  const summary = `
    <div class="price-summary">
      <strong>${winner}</strong> is cheaper overall — saves you <strong>$${saving}</strong> on this shop.
      Coles total: <strong>$${colesTotal.toFixed(2)}</strong> · Woolies total: <strong>$${wooliesTotal.toFixed(2)}</strong>
    </div>`;

  $('#priceSheetBody').innerHTML = summary + (rows || '<div class="price-loading">No Coles or Woolworths items to compare.</div>');
}

// ---------- Add ingredients to list ----------
function addPickedIngredientsToList() {
  const m = state.meals.find(x => x.id === ui.activeMealId);
  if (!m) return;
  let n = 0;
  for (const idx of ui.pickedIngredients) {
    const ing = m.ingredients[idx];
    if (!ing) continue;
    let p = state.products.find(x => x.name.toLowerCase() === ing.name.toLowerCase());
    if (!p) {
      p = addProduct({ name: ing.name, package: 'Each', store: null, emoji: emojiForIngredient(ing.name), category: 'Recipe', sourceUrl: null });
    }
    addToList(p.id, 1, ing.qty);
    n++;
  }
  ui.pickedIngredients = new Set();
  toast(`Added ${n} item${n===1?'':'s'} to your list`);
  showScreen('shopping', false);
}
function emojiForIngredient(name) {
  const n = name.toLowerCase();
  const map = [
    ['lemon','🍋'],['lime','🍋‍🟩'],['basil','🌿'],['parmesan','🧀'],['cheddar','🧀'],
    ['feta','🧀'],['mozzarella','🧀'],['olive','🫒'],['pasta','🍝'],['spaghetti','🍝'],
    ['rice','🍚'],['chicken','🍗'],['salmon','🐟'],['tomato','🍅'],['onion','🧅'],
    ['garlic','🧄'],['ginger','🫚'],['bread','🍞'],['lasagna','🍝'],['avocado','🥑'],
    ['banana','🍌'],['milk','🥛'],['butter','🧈'],['flour','🌾'],['rosemary','🌿'],
    ['broccoli','🥦'],['bok choy','🥬'],['mince','🥩'],['beef','🥩'],['salsa','🌶️'],
    ['chipotle','🌶️'],['chilli','🌶️'],['coriander','🌿'],['tortilla','🌮'],['bean','🫘'],
    ['potato','🥔'],['passata','🍅'],
  ];
  for (const [k,e] of map) if (n.includes(k)) return e;
  return '🛒';
}

// ---------- Wire up events ----------
function bind() {
  document.addEventListener('click', (e) => {
    const t = e.target;
    const action = t.closest('[data-action]')?.dataset.action;
    if (action) handleAction(action, t.closest('[data-action]'), e);
  });

  $('#signinBtn').addEventListener('click', () => {
    state.signedIn = true; saveState(); showScreen('shopping', false);
  });

  $$('#tabbar button').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.tab, false)));

  $$('#libFilters button').forEach(b => b.addEventListener('click', () => {
    ui.libFilter = b.dataset.filter; render();
  }));

  $('#scrim').addEventListener('click', () => {
    if (ui.sheetOpen) closeAdd();
    else if (ui.daySheetOpen) closeDaySheet();
    else if (ui.priceSheetOpen) closePriceSheet();
    else if (ui.confirmSheetOpen) closeConfirmSheet();
  });

  $('#confirmBtn').addEventListener('click', () => {
    const cb = confirmCallback;
    closeConfirmSheet();
    if (cb) cb();
  });
  $('#confirmCancelBtn').addEventListener('click', closeConfirmSheet);

  $$('#addTabs button').forEach(b => b.addEventListener('click', () => setAddMode(b.dataset.mode)));

  $('#urlInput').addEventListener('input', onUrlInput);
  $('#pasteBtn').addEventListener('click', async () => {
    try {
      const t = await navigator.clipboard.readText();
      $('#urlInput').value = t; onUrlInput();
    } catch {
      $('#urlInput').focus(); toast('Paste from your keyboard');
    }
  });
  $('#urlAddBtn').addEventListener('click', urlAddCommit);
  $('#pastSearch').addEventListener('input', (e) => { ui.pastSearch = e.target.value; renderPastList(); });
  $('#quickAddBtn').addEventListener('click', quickAddCommit);

  $('#formEmoji').addEventListener('click', cycleFormEmoji);
  $('#formFrequent').addEventListener('click', () => {
    ui.formDraft && (ui.formDraft.frequent = !ui.formDraft.frequent);
    $('#formFrequent').classList.toggle('off');
  });
  $('#deleteMealBtn').addEventListener('click', deleteMeal);

  $('#mealFavBtn').addEventListener('click', () => {
    const m = state.meals.find(x => x.id === ui.activeMealId);
    if (!m) return;
    m.frequent = !m.frequent; saveState(); renderMealDetail();
    toast(m.frequent ? 'Pinned to frequent' : 'Removed from frequent');
  });
  $('#ingPickAll').addEventListener('click', () => {
    const m = state.meals.find(x => x.id === ui.activeMealId);
    if (!m) return;
    if (ui.pickedIngredients.size === m.ingredients.length) ui.pickedIngredients = new Set();
    else ui.pickedIngredients = new Set(m.ingredients.map((_,i)=>i));
    renderMealDetail();
  });

  // Day Bendigo toggle
  $('#dayBendigoToggle').addEventListener('click', () => {
    if (!ui.dayTarget) return;
    const { key } = ui.dayTarget;
    const entry = getDayEntry(key);
    setDayEntry(key, { isBendigo: !entry.isBendigo });
    $('#dayBendigoToggle').classList.toggle('off', !getDayEntry(key).isBendigo);
  });

  $$('[data-pref]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.pref;
    state.prefs[k] = !state.prefs[k];
    b.classList.toggle('off', !state.prefs[k]);
    saveState();
    if (k === 'demoOffline') renderShopping();
  }));
  $$('#defaultStore button').forEach(b => b.addEventListener('click', () => {
    state.prefs.defaultStore = b.dataset.store;
    saveState(); renderSettings();
  }));
}

// ---------- Action dispatcher ----------
function handleAction(action, el, ev) {
  switch (action) {
    case 'open-add':       openAdd(); break;
    case 'open-settings':  showScreen('settings'); break;
    case 'back':           (ui.sheetOpen || ui.daySheetOpen || ui.priceSheetOpen || ui.confirmSheetOpen) ? (ui.sheetOpen ? closeAdd() : ui.daySheetOpen ? closeDaySheet() : ui.priceSheetOpen ? closePriceSheet() : closeConfirmSheet()) : back(); break;
    case 'goto-quick':     setAddMode('quick'); break;
    case 'edit-url':       $('#urlInput').focus(); break;
    case 'retry-url':      onUrlInput(); break;
    case 'toggle-history': {
      ui.showingPastWeeks = !ui.showingPastWeeks;
      render();
      break;
    }
    case 'compare-prices':    openPriceSheet(); break;
    case 'scroll-to-today':   scrollToToday(); break;
    case 'tick': {
      ev?.stopPropagation();
      const tickId = el.dataset.itemId;
      const tickedItem = state.list.find(x => x.id === tickId);
      if (!tickedItem) break;
      if (!tickedItem.ticked) {
        // Ticking on: animate first, commit after
        const card = document.querySelector(`.card[data-item-id="${tickId}"]`);
        if (card) requestAnimationFrame(() => card.classList.add('popping'));
        showTickToast();
        setTimeout(() => { tickItem(tickId); render(); }, 260);
      } else {
        // Ticking off: immediate, no fanfare
        tickItem(tickId); render();
      }
      break;
    }
    case 'clear-trolley': {
      const n = state.list.filter(i => i.ticked).length;
      if (n === 0) return;
      openConfirmSheet(
        'Clear picked items?',
        `${n} picked-up item${n===1?'':'s'} will be removed from the list.`,
        `Clear ${n} item${n===1?'':'s'}`,
        false,
        () => { clearTicked(); toast(`Cleared ${n} item${n===1?'':'s'}`); render(); }
      );
      break;
    }
    case 'open-meal': {
      ui.activeMealId = el.dataset.mealId;
      ui.pickedIngredients = new Set();
      ui._ingredientsForMeal = null;
      showScreen('meal-detail');
      break;
    }
    case 'open-day': {
      openDaySheet(el.dataset.day);
      break;
    }
    case 'day-eating-out': {
      if (!ui.dayTarget) break;
      const { key } = ui.dayTarget;
      const entry = getDayEntry(key);
      const nowEatingOut = !entry.eatingOut;
      setDayEntry(key, { eatingOut: nowEatingOut, mealId: nowEatingOut ? null : entry.mealId });
      renderDaySheetBody();
      break;
    }
    case 'day-pick-meal': {
      if (!ui.dayTarget) break;
      const { key } = ui.dayTarget;
      const mealId = el.dataset.mealId;
      setDayMeal(key, mealId);
      renderDaySheetBody();
      toast('Meal set');
      break;
    }
    case 'day-clear': {
      if (!ui.dayTarget) break;
      setDayEntry(ui.dayTarget.key, { mealId: null, eatingOut: false, eatingOutNote: '' });
      renderDaySheetBody();
      toast('Day cleared');
      break;
    }
    case 'day-view-meal': {
      if (!ui.dayTarget) break;
      const entry = getDayEntry(ui.dayTarget.key);
      if (!entry.mealId) break;
      closeDaySheet();
      ui.activeMealId = entry.mealId;
      ui.pickedIngredients = new Set();
      ui._ingredientsForMeal = null;
      showScreen('meal-detail');
      break;
    }
    case 'edit-meal':
      startMealForm(ui.activeMealId); break;
    case 'edit-meal-quick': {
      ev?.stopPropagation();
      startMealForm(el.dataset.mealId); break;
    }
    case 'new-meal':    startMealForm(); break;
    case 'save-meal':   commitMealForm(); break;
    case 'add-ing':
      saveFormDraft();
      ui.formDraft.ingredients.push({qty:'', name:''});
      renderMealForm();
      break;
    case 'remove-ing': {
      saveFormDraft();
      const idx = parseInt(el.dataset.idx, 10);
      ui.formDraft.ingredients.splice(idx, 1);
      if (ui.formDraft.ingredients.length === 0) ui.formDraft.ingredients = [{qty:'',name:''}];
      renderMealForm();
      break;
    }
    case 'pick-ing': {
      const idx = parseInt(el.dataset.idx, 10);
      if (ui.pickedIngredients.has(idx)) ui.pickedIngredients.delete(idx);
      else ui.pickedIngredients.add(idx);
      renderMealDetail();
      break;
    }
    case 'add-ings-to-list': addPickedIngredientsToList(); break;
    case 'past-select':    pastSelect(el.dataset.id); break;
    case 'qty-dec':        pastQtyDelta(-1); break;
    case 'qty-inc':        pastQtyDelta(+1); break;
    case 'past-commit':
      ui.pastNote = $('#pastNote').value || '';
      pastCommit();
      break;
    case 'signout':
      state.signedIn = false; saveState(); showScreen('signin', false); break;
    case 'reset-data':
      openConfirmSheet(
        'Reset all demo data?',
        'This will clear all your meals, shopping list, and planner data.',
        'Reset data',
        true,
        () => { localStorage.removeItem(STORAGE_KEY); location.reload(); }
      );
      break;
  }
}

// ---------- Boot ----------
bind();
showScreen(ui.currentScreen, false);

})();
