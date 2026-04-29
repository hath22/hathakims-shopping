/* =========================================================
   Hathakim's Pantry — app logic
   v1.0 · Supabase backend with real-time sync
   ========================================================= */

(() => {
'use strict';

const BUILD = '29 Apr 2026 06:15 UTC';

// ---------- Supabase ----------
const SUPABASE_URL = 'https://cviqjcdhnsvcdodxmddo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cDpGQ4EIHU_2q-BftQQOXA_X1JPCp32';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, flowType: 'implicit' },
});

// ---------- Module-level auth state ----------
let householdId  = null;
let currentUser  = null;  // { id, email, displayName }
let realtimeSub  = null;

// ---------- Date helpers ----------
const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYS_LONG    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
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
  if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${MONTHS_SHORT[s.getMonth()]}`;
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
const genUUID = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

// ---------- App state ----------
const state = {
  products: [],
  list:     [],
  meals:    [],
  week:     {},
  prefs: { defaultStore: 'coles', notifyOnAdd: false, demoOffline: false },
};

const ui = {
  currentScreen:     'signin',
  history:           [],
  activeMealId:      null,
  pickedIngredients: new Set(),
  libFilter:         'all',
  sheetOpen:         false,
  daySheetOpen:      false,
  priceSheetOpen:    false,
  confirmSheetOpen:  false,
  addMode:           'past',
  urlScraping:       false,
  urlScraped:        null,
  urlError:          null,
  pastSelectedId:    null,
  pastQty:           1,
  pastNote:          '',
  pastSearch:        '',
  formDraft:         null,
  dayTarget:         null,
  showingPastWeeks:  false,
};

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

// ---------- DB adapters ----------
function productFromRow(r) {
  return {
    id:           r.id,
    name:         r.name,
    package:      r.package,
    store:        r.store,
    emoji:        r.emoji,
    category:     r.category,
    sourceUrl:    r.source_url,
    lastBuyDate:  r.last_buy_date ? new Date(r.last_buy_date).getTime() : null,
    lastBuyQty:   r.last_buy_qty,
    scrapeFailed: r.scrape_failed,
  };
}
function productToRow(p) {
  return {
    name:          p.name,
    package:       p.package || 'Each',
    store:         p.store || null,
    emoji:         p.emoji || '🛒',
    category:      p.category || 'Other',
    source_url:    p.sourceUrl || null,
    last_buy_date: p.lastBuyDate ? new Date(p.lastBuyDate).toISOString() : null,
    last_buy_qty:  p.lastBuyQty || null,
    scrape_failed: p.scrapeFailed || false,
  };
}
function itemFromRow(r) {
  return {
    id:        r.id,
    productId: r.product_id,
    qty:       r.qty,
    note:      r.note || '',
    ticked:    r.ticked,
    addedBy:   r.added_by,
    addedAt:   r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  };
}
function mealFromRow(r) {
  return {
    id:           r.id,
    name:         r.name,
    emoji:        r.emoji,
    color:        r.color,
    notes:        r.notes || '',
    recipeUrl:    r.recipe_url || '',
    frequent:     r.is_frequent,
    timeMin:      r.time_min,
    lastMadeDate: r.last_made_date ? new Date(r.last_made_date).getTime() : null,
    ingredients:  r.ingredients || [],
  };
}
function mealToRow(m) {
  return {
    name:           m.name,
    emoji:          m.emoji || '🍽️',
    color:          m.color || 'peach',
    notes:          m.notes || null,
    recipe_url:     m.recipeUrl || null,
    is_frequent:    m.frequent || false,
    time_min:       m.timeMin || null,
    last_made_date: m.lastMadeDate ? new Date(m.lastMadeDate).toISOString() : null,
    ingredients:    m.ingredients || [],
  };
}
function planFromRow(r) {
  return {
    mealId:       r.meal_id,
    eatingOut:    r.eating_out,
    eatingOutNote: r.eating_out_note || '',
    isBendigo:    r.is_bendigo,
  };
}

// ---------- Data loading ----------
async function loadData() {
  const [pRes, iRes, mRes, wRes] = await Promise.all([
    sb.from('products').select('*').eq('household_id', householdId).order('name'),
    sb.from('shopping_items').select('*').eq('household_id', householdId).order('created_at'),
    sb.from('meals').select('*').eq('household_id', householdId).order('name'),
    sb.from('week_plans').select('*').eq('household_id', householdId),
  ]);
  state.products = (pRes.data || []).map(productFromRow);
  state.list     = (iRes.data || []).map(itemFromRow);
  state.meals    = (mRes.data || []).map(mealFromRow);
  state.week     = {};
  (wRes.data || []).forEach(r => { state.week[r.plan_date] = planFromRow(r); });

  // Load local prefs
  try { Object.assign(state.prefs, JSON.parse(localStorage.getItem('hathakims-prefs') || '{}')); } catch {}
}

// ---------- Real-time ----------
function subscribeToChanges() {
  if (realtimeSub) { realtimeSub.unsubscribe(); realtimeSub = null; }

  realtimeSub = sb
    .channel(`hh-${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `household_id=eq.${householdId}` },
        p => { applyChange('shopping_items', p); render(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `household_id=eq.${householdId}` },
        p => { applyChange('products', p); render(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meals', filter: `household_id=eq.${householdId}` },
        p => { applyChange('meals', p); render(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'week_plans', filter: `household_id=eq.${householdId}` },
        p => { applyChange('week_plans', p); render(); })
    .subscribe();
}

function applyChange(table, payload) {
  const { eventType, new: nw, old: ol } = payload;
  if (table === 'shopping_items') {
    if (eventType === 'INSERT') {
      if (!state.list.find(x => x.id === nw.id)) state.list.push(itemFromRow(nw));
    } else if (eventType === 'UPDATE') {
      const i = state.list.findIndex(x => x.id === nw.id);
      if (i >= 0) state.list[i] = itemFromRow(nw); else state.list.push(itemFromRow(nw));
    } else if (eventType === 'DELETE') {
      state.list = state.list.filter(x => x.id !== ol.id);
    }
  } else if (table === 'products') {
    if (eventType === 'INSERT') {
      if (!state.products.find(x => x.id === nw.id)) state.products.push(productFromRow(nw));
    } else if (eventType === 'UPDATE') {
      const i = state.products.findIndex(x => x.id === nw.id);
      if (i >= 0) state.products[i] = productFromRow(nw);
    } else if (eventType === 'DELETE') {
      state.products = state.products.filter(x => x.id !== ol.id);
    }
  } else if (table === 'meals') {
    if (eventType === 'INSERT') {
      if (!state.meals.find(x => x.id === nw.id)) state.meals.push(mealFromRow(nw));
    } else if (eventType === 'UPDATE') {
      const i = state.meals.findIndex(x => x.id === nw.id);
      if (i >= 0) state.meals[i] = mealFromRow(nw);
    } else if (eventType === 'DELETE') {
      state.meals = state.meals.filter(x => x.id !== ol.id);
    }
  } else if (table === 'week_plans') {
    if (eventType === 'INSERT' || eventType === 'UPDATE') state.week[nw.plan_date] = planFromRow(nw);
    else if (eventType === 'DELETE') delete state.week[ol.plan_date];
  }
}

// ---------- Product image lookup (Woolworths API) ----------
const IMG_CACHE_KEY = 'productImgCache';
function imgCacheGet(name) {
  try {
    const c = JSON.parse(localStorage.getItem(IMG_CACHE_KEY) || '{}');
    const key = name.toLowerCase();
    return key in c ? c[key] : undefined;
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
  } catch { imgCacheSet(name, null); return null; }
}
async function loadShoppingImages() {
  const thumbs = document.querySelectorAll('#shopList .thumb[data-product-id]:not(.has-img)');
  for (const thumb of thumbs) {
    const product = state.products.find(p => p.id === thumb.dataset.productId);
    if (!product) continue;
    const imgUrl = await fetchProductImage(product.name);
    if (!document.contains(thumb)) continue;
    if (!imgUrl) continue;
    thumb.classList.add('has-img');
    thumb.innerHTML = `<img src="${escapeHTML(imgUrl)}" alt="">`;
    await new Promise(r => setTimeout(r, 40));
  }
}
function storeLabel(s) { return { coles:'Coles', woolies:'Woolies', aldi:'Aldi' }[s] || ''; }

// ---------- Toast ----------
let toastTimeout;
function toast(msg, duration = 2000) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), duration);
}

// ---------- Routing ----------
function showScreen(name, addToHistory = true) {
  if (addToHistory && ui.currentScreen && ui.currentScreen !== name) ui.history.push(ui.currentScreen);
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

// ---------- URL product parser ----------
const EMOJI_MAP = [
  { keys:['tomato'],                           emoji:'🍅', category:'Produce' },
  { keys:['banana'],                           emoji:'🍌', category:'Produce' },
  { keys:['avocado'],                          emoji:'🥑', category:'Produce' },
  { keys:['spinach','kale','lettuce','salad'], emoji:'🥬', category:'Produce' },
  { keys:['broccoli'],                         emoji:'🥦', category:'Produce' },
  { keys:['carrot'],                           emoji:'🥕', category:'Produce' },
  { keys:['mushroom'],                         emoji:'🍄', category:'Produce' },
  { keys:['lemon','lime'],                     emoji:'🍋', category:'Produce' },
  { keys:['apple'],                            emoji:'🍎', category:'Produce' },
  { keys:['strawberr','berry','berries'],      emoji:'🍓', category:'Produce' },
  { keys:['grape'],                            emoji:'🍇', category:'Produce' },
  { keys:['onion','garlic'],                   emoji:'🧅', category:'Produce' },
  { keys:['potato'],                           emoji:'🥔', category:'Produce' },
  { keys:['milk','cream','yoghurt','yogurt'],  emoji:'🥛', category:'Dairy'   },
  { keys:['cheese','cheddar','brie','feta'],   emoji:'🧀', category:'Dairy'   },
  { keys:['butter','margarine'],               emoji:'🧈', category:'Dairy'   },
  { keys:['egg'],                              emoji:'🥚', category:'Dairy'   },
  { keys:['chicken','poultry'],                emoji:'🍗', category:'Meat'    },
  { keys:['beef','mince','steak'],             emoji:'🥩', category:'Meat'    },
  { keys:['pork','bacon','ham','prosciutto'],  emoji:'🥓', category:'Meat'    },
  { keys:['lamb'],                             emoji:'🍖', category:'Meat'    },
  { keys:['salmon','tuna','fish','prawn','seafood'], emoji:'🐟', category:'Seafood' },
  { keys:['bread','sourdough','loaf','roll'],  emoji:'🍞', category:'Bakery'  },
  { keys:['pasta','spaghetti','penne','fett'], emoji:'🍝', category:'Pantry'  },
  { keys:['rice'],                             emoji:'🍚', category:'Pantry'  },
  { keys:['olive','oil'],                      emoji:'🫒', category:'Pantry'  },
  { keys:['sauce','paste','passata'],          emoji:'🫙', category:'Pantry'  },
  { keys:['coffee'],                           emoji:'☕', category:'Pantry'  },
  { keys:['tea'],                              emoji:'🍵', category:'Pantry'  },
  { keys:['chocolate','tim tam','biscuit','cookie','cake'], emoji:'🍪', category:'Pantry' },
  { keys:['chip','crisp','snack'],             emoji:'🥔', category:'Pantry'  },
  { keys:['water','juice','drink','soda','cola'], emoji:'🧃', category:'Drinks' },
  { keys:['wine','beer','spirit','vodka','gin'], emoji:'🍷', category:'Drinks' },
  { keys:['soap','shampoo','conditioner','deodorant'], emoji:'🧴', category:'Personal' },
  { keys:['toilet','tissue','paper'],          emoji:'🧻', category:'Household' },
  { keys:['detergent','cleaner','wash'],       emoji:'🧹', category:'Household' },
];

function guessEmojiAndCategory(name) {
  const n = name.toLowerCase();
  for (const row of EMOJI_MAP) {
    if (row.keys.some(k => n.includes(k))) return { emoji: row.emoji, category: row.category };
  }
  return { emoji: '🛒', category: 'Other' };
}

function toTitleCase(str) {
  const LOWER = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of','up','as','is']);
  return str.split(' ')
    .map((w, i) => (i === 0 || !LOWER.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ');
}

function parseProductFromSlug(slug) {
  // Remove store brand prefix (coles-, woolworths-, woolies-, aldi-)
  let s = slug.replace(/^(coles|woolworths?|woolies|aldi)-/i, '');
  // Remove trailing numeric product ID
  s = s.replace(/-\d{4,}$/, '');
  // Replace hyphens with spaces
  s = s.replace(/-/g, ' ').trim();
  // Extract package weight/volume/count at the end
  const pkgRe = /\b(\d+\.?\d*\s*(kg|g|ml|l|lt|pk|pack|pcs|sheets?|rolls?|count|x\s*\d+))\s*$/i;
  const pkgMatch = s.match(pkgRe);
  const pkg = pkgMatch ? pkgMatch[0].trim() : 'Each';
  const name = toTitleCase(s.replace(pkgRe, '').trim());
  return { name: name || toTitleCase(s), package: pkg };
}

function mockScrape(url) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      let store = null;
      try {
        const u = new URL(url);
        const h = u.hostname.replace(/^www\./, '');
        if (h.includes('coles.com.au'))           store = 'coles';
        else if (h.includes('woolworths.com.au')) store = 'woolies';
        else if (h.includes('aldi.com.au'))       store = 'aldi';
        if (!store) return reject(new Error('Only Coles, Woolies, and Aldi URLs are supported.'));
        const segments = u.pathname.split('/').filter(Boolean);
        const slug = segments[segments.length - 1] || '';
        const { name, package: pkg } = parseProductFromSlug(slug);
        const { emoji, category } = guessEmojiAndCategory(name);
        resolve({ name, package: pkg, emoji, category, store, sourceUrl: url, scrapeFailed: false });
      } catch {
        reject(new Error('Could not read that URL.'));
      }
    }, 400);
  });
}

// ---------- Mock prices ----------
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
    if (name.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(name.toLowerCase().split(' ')[0])) return v;
  }
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  const base = 2.00 + (Math.abs(h) % 1200) / 100;
  const diff = 0.10 + (Math.abs(h >> 4) % 80) / 100;
  return h % 2 === 0
    ? { coles: +(base).toFixed(2), woolies: +(base + diff).toFixed(2) }
    : { coles: +(base + diff).toFixed(2), woolies: +(base).toFixed(2) };
}

// ---------- Mutations (optimistic — write to DB in background) ----------
function addProduct(p) {
  const existing = state.products.find(x => x.sourceUrl && p.sourceUrl && x.sourceUrl === p.sourceUrl);
  if (existing) {
    Object.assign(existing, { name: p.name, package: p.package, store: p.store, emoji: p.emoji, category: p.category, scrapeFailed: false });
    sb.from('products').update({ name: p.name, package: p.package, store: p.store, emoji: p.emoji, category: p.category, scrape_failed: false }).eq('id', existing.id);
    return existing;
  }
  const id = genUUID();
  const np = { id, name: p.name, package: p.package || 'Each', store: p.store, emoji: p.emoji || '🛒', category: p.category || 'Other', sourceUrl: p.sourceUrl, lastBuyDate: null, lastBuyQty: null, scrapeFailed: false };
  state.products.push(np);
  sb.from('products').insert({ id, household_id: householdId, ...productToRow(np) });
  return np;
}

function addToList(productId, qty = 1, note = '') {
  const id = genUUID();
  const item = { id, productId, qty: Math.max(1, qty|0), note: note.trim(), ticked: false, addedBy: currentUser?.id, addedAt: Date.now() };
  state.list.push(item);
  sb.from('shopping_items').insert({ id, household_id: householdId, product_id: productId, qty: item.qty, note: item.note || null, ticked: false, added_by: currentUser?.id });
  const prod = state.products.find(x => x.id === productId);
  if (prod) {
    prod.lastBuyDate = Date.now(); prod.lastBuyQty = item.qty;
    sb.from('products').update({ last_buy_date: new Date().toISOString(), last_buy_qty: item.qty }).eq('id', productId);
  }
  return item;
}

function tickItem(itemId) {
  const it = state.list.find(x => x.id === itemId);
  if (!it) return;
  it.ticked = !it.ticked;
  it.tickedAt = it.ticked ? Date.now() : null;
  sb.from('shopping_items').update({ ticked: it.ticked, ticked_at: it.ticked ? new Date().toISOString() : null }).eq('id', itemId);
  if (it.ticked && state.list.length > 0 && state.list.every(x => x.ticked)) setTimeout(celebrateAllDone, 320);
}

function clearTicked() {
  const ids = state.list.filter(x => x.ticked).map(x => x.id);
  if (!ids.length) return;
  state.list = state.list.filter(x => !x.ticked);
  sb.from('shopping_items').delete().in('id', ids);
}

function getDayEntry(key) {
  const e = state.week[key];
  if (!e || typeof e !== 'object') return { mealId: null, eatingOut: false, eatingOutNote: '', isBendigo: false };
  return e;
}
function setDayEntry(key, updates) {
  const merged = { ...getDayEntry(key), ...updates };
  state.week[key] = merged;
  sb.from('week_plans').upsert({
    household_id: householdId,
    plan_date: key,
    meal_id: merged.mealId || null,
    eating_out: merged.eatingOut || false,
    eating_out_note: merged.eatingOutNote || null,
    is_bendigo: merged.isBendigo || false,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'household_id,plan_date' });
}
function setDayMeal(key, mealId) {
  setDayEntry(key, { mealId, eatingOut: false, eatingOutNote: '' });
  if (mealId) {
    const m = state.meals.find(x => x.id === mealId);
    if (m) {
      const [y, mo, d] = key.split('-').map(Number);
      const dayDate = new Date(y, mo-1, d);
      const today = new Date(); today.setHours(0,0,0,0);
      if (dayDate <= today && (!m.lastMadeDate || dayDate.getTime() > m.lastMadeDate)) {
        m.lastMadeDate = dayDate.getTime();
        sb.from('meals').update({ last_made_date: dayDate.toISOString() }).eq('id', mealId);
      }
    }
  }
}

// ---------- Tick delight ----------
const TICK_COPY = ['Sorted', 'Got it', 'In the trolley', 'Grabbed', 'Picked up'];
let lastTickIdx = -1;
function showTickToast() {
  const total = state.list.length;
  const willBeDone = state.list.filter(x => !x.ticked).length;
  if (willBeDone <= 1) return;
  if (total > 3 && willBeDone === Math.ceil(total / 2)) { toast('Halfway through the list', 1600); return; }
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
  canvas.width = rect.width; canvas.height = rect.height;
  canvas.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:999;`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const COLORS = ['#C97D5D','#6B8E6F','#E8C9A8','#b5d4b7','#FFF1E2','#c4a882'];
  const particles = Array.from({length: 60}, () => ({
    x: W * 0.15 + Math.random() * W * 0.7, y: H * 0.45,
    vx: (Math.random() - 0.5) * 11, vy: -(Math.random() * 11 + 4),
    w: Math.random() * 9 + 4, h: Math.random() * 5 + 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.26, alpha: 1,
  }));
  (function draw() {
    ctx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.38; p.vx *= 0.98; p.rot += p.rotV; p.alpha -= 0.015;
      if (p.alpha <= 0) continue;
      alive = true;
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); ctx.restore();
    }
    if (alive) requestAnimationFrame(draw); else canvas.remove();
  })();
}

// ---------- Render: shopping ----------
function renderShopping() {
  const total = state.list.length;
  const done  = state.list.filter(i => i.ticked).length;
  $('#shopTitle').textContent = 'Shopping list';
  $('#shopSub').textContent   = total ? `· ${total} items · ${done} done` : '· nothing on the list';

  const banner = $('#offlineBanner');
  if (state.prefs.demoOffline) {
    banner.classList.remove('hidden');
    banner.outerHTML = `<div class="offline-banner" id="offlineBanner"><span class="pulse"></span><div class="txt"><div class="ttl">You're offline</div><div class="sm">Ticks save here and sync when you're back.</div></div></div>`;
  } else {
    if (banner && !banner.classList.contains('hidden')) banner.outerHTML = `<div id="offlineBanner" class="hidden"></div>`;
  }

  const list = $('#shopList');
  if (total === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🧺</div><h2 class="empty-h">All caught up</h2><p class="empty-sub">Nothing on the list right now. Add items as you think of them — they'll sync to Vicky's phone in real time.</p><button class="empty-link" data-action="open-add">Add the first item →</button></div>`;
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
    const note      = item.note ? `<div class="note">📝 ${escapeHTML(item.note)}</div>` : '';
    const storeSpan = product.store ? `<span class="store ${product.store}">${storeLabel(product.store)}</span>` : '';
    const meta      = `${qtyPrefix}${escapeHTML(product.package)}${storeSpan ? ' · ' + storeSpan : ''}`;
    return `<div class="card${item.ticked ? ' done' : ''}" data-item-id="${item.id}">
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
    const p   = state.products.find(x => x.id === item.productId);
    const cat = p?.category || 'Other';
    (groups[cat] = groups[cat] || []).push(item);
  }
  const order = ['Produce','Bakery','Dairy','Seafood','Meat','Pantry','Recipe','Other'];
  const cats  = Object.keys(groups).sort((a,b) => order.indexOf(a) - order.indexOf(b));

  let html = cats.map(cat => `
    <div class="section-title"><span>${cat}</span></div>
    ${groups[cat].map(rowHtml).join('')}
  `).join('');

  if (ticked.length) {
    html += `<div class="section-title trolley-head"><span>In the trolley</span><button class="clear-btn" data-action="clear-trolley">Clear picked items</button></div>${ticked.map(rowHtml).join('')}`;
  }
  if (unticked.length === 0 && ticked.length > 0) {
    html = `<div class="empty-state" style="padding:32px 32px 8px;"><div class="empty-icon">✅</div><h2 class="empty-h">All collected</h2><p class="empty-sub">Everything's in the trolley. Clear it out when you're home.</p></div>` + html;
  }

  list.innerHTML = html;
  loadShoppingImages();
}

// ---------- Render: meal planner ----------
function renderMeals() {
  const today = new Date(); today.setHours(0,0,0,0);
  const histBtn = $('#weekHistoryBtn');
  if (histBtn) {
    histBtn.classList.toggle('active-mode', ui.showingPastWeeks);
    histBtn.title = ui.showingPastWeeks ? 'Show upcoming weeks' : 'View previous weeks';
  }
  $('#weekSub').textContent = ui.showingPastWeeks ? 'Previous 6 weeks' : 'Upcoming 6 weeks · dinners';
  const offsets = ui.showingPastWeeks ? [-6,-5,-4,-3,-2,-1] : [0,1,2,3,4,5];

  const dayRowHtml = (d, isToday) => {
    const key   = ymd(d);
    const entry = getDayEntry(key);
    const dateCap = `<div class="date-cap"><div class="dn">${DAYS_SHORT[d.getDay()]}</div><div class="dnum">${d.getDate()}</div>${entry.isBendigo ? '<div class="bendigo-dot"></div>' : ''}</div>`;
    if (entry.eatingOut) {
      return `<button class="day-row eating-out${isToday ? ' today' : ''}" data-action="open-day" data-day="${key}">${dateCap}<div class="meal-info"><div class="meal-name">Eating out</div><div class="meal-meta">${escapeHTML(entry.eatingOutNote || 'Tap to add details')}</div>${entry.isBendigo ? '<span class="bendigo-pill">Bendigo</span>' : ''}</div><div class="chev">›</div></button>`;
    }
    const meal = entry.mealId && state.meals.find(m => m.id === entry.mealId);
    if (!meal) {
      return `<button class="day-row empty" data-action="open-day" data-day="${key}">${dateCap}<div class="empty-add"><span>+ Add dinner</span>${entry.isBendigo ? '<span class="bendigo-pill">Bendigo</span>' : ''}</div></button>`;
    }
    const bits = [];
    if (meal.timeMin) bits.push(`${meal.timeMin} min`);
    if (host(meal.recipeUrl)) bits.push(host(meal.recipeUrl));
    const meta = bits.join(' · ') || ' ';
    return `<button class="day-row${isToday ? ' today' : ''}" data-action="open-day" data-day="${key}">${dateCap}<div class="meal-info"><div class="meal-name">${escapeHTML(meal.name)}</div><div class="meal-meta">${escapeHTML(meta)}</div>${entry.isBendigo ? '<span class="bendigo-pill">Bendigo</span>' : ''}</div><div class="chev">›</div></button>`;
  };

  const html = offsets.map(offset => {
    const week  = getWeek(offset);
    const label = weekLabel(offset);
    const range = weekRangeShort(offset);
    const rows  = week.map(d => dayRowHtml(d, isSameDay(d, today))).join('');
    const todayBtn = offset !== 0 ? `<button class="week-today-btn" data-action="scroll-to-today">↑ Today</button>` : '';
    return `<div class="week-section"><div class="week-divider"><span class="wlabel">${escapeHTML(label)}</span><span class="wrange">${escapeHTML(range)}</span><span class="wline"></span>${todayBtn}</div>${rows}</div>`;
  }).join('');

  $('#weekList').innerHTML = html;
}

// ---------- Render: meal library ----------
function renderLibrary() {
  let meals = state.meals.slice();
  if (ui.libFilter === 'frequent') meals = meals.filter(m => m.frequent);
  else if (ui.libFilter === 'quick') meals = meals.filter(m => (m.timeMin||0) > 0 && m.timeMin <= 30);
  meals.sort((a,b) => Number(b.frequent) - Number(a.frequent));

  const total = state.meals.length;
  const fav   = state.meals.filter(m => m.frequent).length;
  $('#libSub').innerHTML = `<span>${total} saved · ${fav} frequent</span>`;
  $$('#libFilters button').forEach(b => b.classList.toggle('on', b.dataset.filter === ui.libFilter));

  if (meals.length === 0) {
    $('#libList').innerHTML = `<div class="empty-state"><div class="empty-icon">🍽️</div><h2 class="empty-h">No meals saved yet</h2><p class="empty-sub">Save a few favourites and dinner planning gets a lot easier.</p></div>`;
    return;
  }
  $('#libList').innerHTML = meals.map(m => {
    const tags = [];
    if (m.frequent) tags.push(`<span class="ltag fav">★ Frequent</span>`);
    tags.push(`<span class="ltag last-made">${escapeHTML(lastMadeLabel(m.lastMadeDate))}</span>`);
    if (host(m.recipeUrl)) tags.push(`<span class="ltag">${escapeHTML(host(m.recipeUrl))}</span>`);
    return `<div class="lib-card" role="button" tabindex="0" data-action="open-meal" data-meal-id="${m.id}">
      <div class="body">
        <div class="lname">${escapeHTML(m.name)}</div>
        <div class="lmeta">${m.ingredients.length} ingredients${m.timeMin ? ` · ${m.timeMin} min` : ''}</div>
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
  $('#mealTitle').textContent = m.name;
  const meta = [];
  if (m.timeMin) meta.push(`<span><b>${m.timeMin}</b> min</span>`);
  meta.push(`<span><b>${m.ingredients.length}</b> ingredients</span>`);
  if (m.frequent) meta.push(`<span><b>★ Frequent</b></span>`);
  $('#mealMeta').innerHTML = meta.join('');
  $('#mealNotes').style.display = m.notes ? '' : 'none';
  if (m.notes) $('#mealNotes').innerHTML = escapeHTML(m.notes);
  const src = $('#mealSource');
  if (m.recipeUrl) {
    src.style.display = '';
    src.href = m.recipeUrl;
    src.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>View recipe<span class="host">· ${escapeHTML(host(m.recipeUrl))}</span>`;
  } else { src.style.display = 'none'; }
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
    ui.formDraft = { id: null, name: '', emoji: '🍽️', color: 'peach', frequent: false, notes: '', recipeUrl: '', timeMin: null, lastMadeDate: null, ingredients: [{qty:'', name:''}] };
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
  $('#formName').value  = d.name || '';
  $('#formNotes').value = d.notes || '';
  $('#formUrl').value   = d.recipeUrl || '';
  $('#formFrequent').classList.toggle('off', !d.frequent);
  $('#formIngredients').innerHTML = d.ingredients.map((ing, idx) => `
    <div class="ing-edit-row" data-idx="${idx}">
      <input class="qf" placeholder="Qty"  value="${escapeHTML(ing.qty)}"  data-field="qty"  data-idx="${idx}"/>
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
  d.name      = $('#formName').value.trim();
  d.notes     = $('#formNotes').value.trim();
  d.recipeUrl = $('#formUrl').value.trim();
  d.frequent  = !$('#formFrequent').classList.contains('off');
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
    if (idx >= 0) state.meals[idx] = { ...d };
    sb.from('meals').update(mealToRow(d)).eq('id', d.id);
  } else {
    d.id = genUUID();
    state.meals.push({ ...d });
    sb.from('meals').insert({ id: d.id, household_id: householdId, ...mealToRow(d) });
  }
  toast(d.id ? 'Meal saved' : 'Meal created');
  ui.formDraft = null;
  back();
}
function deleteMeal() {
  const d = ui.formDraft;
  if (!d || !d.id) return;
  openConfirmSheet(`Delete "${d.name}"?`, 'It will also be removed from your meal planner.', 'Delete meal', true, () => {
    Object.keys(state.week).forEach(k => {
      if (state.week[k]?.mealId === d.id) setDayEntry(k, { mealId: null });
    });
    state.meals = state.meals.filter(m => m.id !== d.id);
    sb.from('meals').delete().eq('id', d.id);
    toast('Meal deleted');
    ui.formDraft = null;
    back();
  });
}

// ---------- Render: settings ----------
function renderSettings() {
  const initial = (currentUser?.displayName || '?')[0].toUpperCase();
  const otherInitial = initial === 'L' ? 'V' : 'L';
  $('#settingsMembers').innerHTML = `<span class="av ${initial.toLowerCase()}">${initial}</span><span class="av ${otherInitial.toLowerCase()}">${otherInitial}</span>`;
  $('#settingsInitial').textContent = initial;
  $('#settingsName').textContent = currentUser?.displayName || '';
  const email = currentUser?.email || '';
  const emailEl = $('#settingsEmail');
  if (emailEl) emailEl.textContent = email.length > 24 ? email.slice(0, 12) + '…' + email.slice(-8) : email;
  $$('#defaultStore button').forEach(b => b.classList.toggle('on', b.dataset.store === state.prefs.defaultStore));
  $$('[data-pref]').forEach(b => { const k = b.dataset.pref; b.classList.toggle('off', !state.prefs[k]); });
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
  $('#confirmBody').textContent  = body;
  const btn = $('#confirmBtn');
  btn.textContent = confirmLabel;
  btn.className   = `btn ${isDanger ? 'danger-solid' : 'terra'}`;
  ui.confirmSheetOpen = true;
  $('#scrim').classList.add('open');
  $('#confirmSheet').classList.add('open');
}
function closeConfirmSheet() {
  ui.confirmSheetOpen = false;
  confirmCallback     = null;
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
  setAddMode('past');
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
  $('#urlStatus').innerHTML = `<div class="preview" aria-hidden="true"><div class="pthumb loading-skel"></div><div class="pbody" style="flex:1"><div class="loading-skel" style="height:14px;width:80%;border-radius:6px;"></div><div class="loading-skel" style="height:11px;width:50%;border-radius:6px;margin-top:6px;"></div></div></div>`;
  scrapeDebounce = setTimeout(async () => {
    try {
      ui.urlScraping = true;
      const r = await mockScrape(url);
      ui.urlScraping = false; ui.urlScraped = r;
      $('#urlStatus').innerHTML = '';
      $('#urlPreview').innerHTML = `<div class="preview"><div class="pthumb">${r.emoji}</div><div class="pbody"><div class="ptitle">${escapeHTML(r.name)}</div><div class="pmeta">${escapeHTML(r.package)} · <span class="store ${r.store}">${storeLabel(r.store)}</span></div><span class="ppill">${escapeHTML(r.category)}</span></div></div><div class="qty"><div class="field"><span class="lbl">Qty</span><input id="urlQty" type="number" inputmode="numeric" min="1" value="1"/></div><div class="field"><span class="lbl">Note (optional)</span><input id="urlNote" placeholder="—"/></div></div>`;
      $('#urlAddBtn').classList.remove('hidden');
    } catch (e) {
      ui.urlScraping = false; ui.urlError = e.message;
      $('#urlInputWrap').classList.add('errored');
      $('#urlStatus').innerHTML = `<div class="error-block"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div><div class="ebody"><div class="etitle">${escapeHTML(e.message)}</div><div class="esub">Check the URL, try again, or fill the details in by hand.</div></div></div><div class="error-actions"><button class="err-btn" data-action="edit-url">Edit URL</button><button class="err-btn primary" data-action="retry-url">Try again</button></div><button class="manual-fill" data-action="goto-quick">Or just type what you need<span class="lk">Fill it in manually →</span></button>`;
    }
  }, 600);
}
function urlAddCommit() {
  if (!ui.urlScraped) return;
  const r       = ui.urlScraped;
  const product = addProduct({ name: r.name, package: r.package, store: r.store, emoji: r.emoji, category: r.category, sourceUrl: r.sourceUrl });
  const qty     = parseInt($('#urlQty')?.value, 10) || 1;
  const note    = $('#urlNote')?.value || '';
  addToList(product.id, qty, note);
  closeAdd(); showScreen('shopping', false);
  toast(`Added ${product.name}`);
}
function quickAddCommit() {
  const name = $('#quickName').value.trim();
  if (!name) { toast('Type a name first'); return; }
  const qty     = parseInt($('#quickQty').value, 10) || 1;
  const note    = $('#quickNote').value || '';
  const product = addProduct({ name, package: 'Each', store: null, emoji: '🛒', category: 'Other', sourceUrl: null });
  addToList(product.id, qty, note);
  closeAdd(); showScreen('shopping', false);
  toast(`Added ${name}`);
}

// ---------- Past items pane ----------
function renderPastList() {
  const search   = ui.pastSearch.toLowerCase();
  const products = state.products.slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .filter(p => !search || p.name.toLowerCase().includes(search));
  const html = products.map(p => {
    const isSel   = p.id === ui.pastSelectedId;
    const lastBuy = p.lastBuyDate
      ? `Last bought ${Math.round((Date.now()-p.lastBuyDate)/86400000)} days ago${p.lastBuyQty?` · qty ${p.lastBuyQty}`:''}`
      : 'Not bought yet';
    if (isSel) {
      return `<div class="past-expanded"><div class="top"><div class="pt ${thumbColor(p.id)}">${p.emoji}</div><div class="pbody"><div class="pname">${escapeHTML(p.name)}</div><div class="pmeta">${escapeHTML(p.package)}${p.store?` · <span class="store ${p.store}">${storeLabel(p.store)}</span>`:''}</div><div class="lastbuy">${lastBuy}</div></div></div><div class="qty-row"><div class="qty-stepper"><button data-action="qty-dec">−</button><span class="num" id="pastQtyNum">${ui.pastQty}</span><button data-action="qty-inc">+</button></div><div class="note-pill-input"><span class="lbl">Note for this shop</span><input id="pastNote" placeholder="—" value="${escapeHTML(ui.pastNote)}"/></div></div><button class="add-mini" data-action="past-commit">Add to list</button></div>`;
    }
    return `<button class="past-row" data-action="past-select" data-id="${p.id}"><div class="pt ${thumbColor(p.id)}">${p.emoji}</div><div class="pbody"><div class="pname">${escapeHTML(p.name)}</div><div class="pmeta">${escapeHTML(p.package)}${p.store?` · <span class="store ${p.store}">${storeLabel(p.store)}</span>`:''}</div></div><span class="qadd">+</span></button>`;
  }).join('');
  $('#pastList').innerHTML = html || `<div class="empty-state" style="padding:20px 0;"><div class="empty-h" style="font-size:18px;">No past products</div><p class="empty-sub" style="font-size:13px;">Add a few items first.</p></div>`;
}
function pastSelect(productId) {
  const p = state.products.find(x => x.id === productId);
  if (p && p.sourceUrl) {
    mockScrape(p.sourceUrl).then(r => {
      p.name = r.name; p.package = r.package; p.emoji = r.emoji; p.store = r.store; p.scrapeFailed = false;
      sb.from('products').update({ name: r.name, package: r.package, emoji: r.emoji, store: r.store, scrape_failed: false }).eq('id', p.id);
      if (ui.sheetOpen && ui.addMode === 'past') renderPastList();
    }).catch(() => { p.scrapeFailed = true; sb.from('products').update({ scrape_failed: true }).eq('id', p.id); });
  }
  ui.pastSelectedId = productId; ui.pastQty = 1; ui.pastNote = '';
  renderPastList();
}
function pastQtyDelta(d) { ui.pastQty = Math.max(1, ui.pastQty + d); $('#pastQtyNum').textContent = ui.pastQty; }
function pastCommit() {
  const id = ui.pastSelectedId;
  if (!id) return;
  const note = $('#pastNote')?.value || '';
  addToList(id, ui.pastQty, note);
  const p = state.products.find(x => x.id === id);
  closeAdd(); showScreen('shopping', false);
  toast(`Added ${p?.name || 'item'}`);
}

// ---------- Day sheet ----------
function openDaySheet(dayKey) {
  const [y, mo, d] = dayKey.split('-').map(Number);
  const date = new Date(y, mo-1, d);
  ui.dayTarget    = { key: dayKey, date };
  ui.daySheetOpen = true;
  $('#daySheetTitle').textContent = longDateLabel(date);
  const entry = getDayEntry(dayKey);
  $('#dayBendigoToggle').classList.toggle('off', !entry.isBendigo);
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
  const entry   = getDayEntry(key);
  let html = '';
  const eatingOutSel = entry.eatingOut;
  html += `<div class="eating-out-option${eatingOutSel ? ' selected' : ''}" data-action="day-eating-out"><div class="eo-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg></div><div class="eo-body"><div class="eo-name">Eating out</div><div class="eo-sub">Restaurant, takeaway, or going out</div></div><div class="eo-check"></div></div>`;
  if (eatingOutSel) {
    html += `<div class="eating-out-note-wrap"><div class="input-row"><div class="v"><span class="lbl">Where / what</span><input id="eatingOutNote" placeholder="e.g. Thai place on Smith St" value="${escapeHTML(entry.eatingOutNote || '')}"/></div></div></div>`;
  }
  html += `<div class="day-sheet-divider"><span>or pick a meal</span></div>`;
  state.meals.forEach(m => {
    const isSel = !entry.eatingOut && entry.mealId === m.id;
    html += `<div class="day-meal-option${isSel ? ' selected' : ''}" data-action="day-pick-meal" data-meal-id="${m.id}"><div class="dm-body"><div class="dm-name">${escapeHTML(m.name)}</div><div class="dm-meta">${m.timeMin ? m.timeMin + ' min' : ''}${m.timeMin && host(m.recipeUrl) ? ' · ' : ''}${host(m.recipeUrl) ? escapeHTML(host(m.recipeUrl)) : ''}</div></div><div class="dm-check"></div></div>`;
  });
  if (entry.mealId || entry.eatingOut) html += `<button class="day-clear-btn" data-action="day-clear">Clear this day</button>`;
  $('#daySheetBody').innerHTML = html;
  const noteInput = $('#eatingOutNote');
  if (noteInput) noteInput.addEventListener('input', () => setDayEntry(key, { eatingOutNote: noteInput.value }));
}

// ---------- Scroll to today ----------
function scrollToToday() {
  if (ui.showingPastWeeks) { ui.showingPastWeeks = false; renderMeals(); }
  requestAnimationFrame(() => {
    const screen   = document.querySelector('.screen[data-screen="meals"]');
    const todayRow = screen?.querySelector('.day-row.today');
    if (!screen || !todayRow) return;
    const screenRect = screen.getBoundingClientRect();
    const rowRect    = todayRow.getBoundingClientRect();
    const top        = rowRect.top - screenRect.top + screen.scrollTop - 80;
    screen.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  });
}

// ---------- Price comparison ----------
function openPriceSheet() {
  if (state.list.length === 0) { toast('Add items to your list first'); return; }
  ui.priceSheetOpen = true;
  const messages = ['Checking the Coles shelves…','Asking Woolworths nicely…','Comparing this week\'s specials…','Running the numbers for you…','Almost there…'];
  let i = 0;
  const body = $('#priceSheetBody');
  body.innerHTML = `<div class="price-loading">${messages[0]}</div>`;
  const ticker = setInterval(() => { i = (i+1) % messages.length; const el = body.querySelector('.price-loading'); if (el) el.textContent = messages[i]; }, 300);
  $('#scrim').classList.add('open');
  $('#priceSheet').classList.add('open');
  setTimeout(() => { clearInterval(ticker); renderPriceSheetBody(); }, 1200);
}
function closePriceSheet() { ui.priceSheetOpen = false; $('#scrim').classList.remove('open'); $('#priceSheet').classList.remove('open'); }
function renderPriceSheetBody() {
  const unticked = state.list.filter(i => !i.ticked);
  if (unticked.length === 0) { $('#priceSheetBody').innerHTML = `<div class="price-loading">No items left to compare.</div>`; return; }
  let colesTotal = 0, wooliesTotal = 0;
  const rows = unticked.map(item => {
    const p = state.products.find(x => x.id === item.productId);
    if (!p || p.store === 'aldi') return '';
    const prices   = getMockPrices(p.name);
    const colesP   = prices.coles * item.qty;
    const wooliesP = prices.woolies * item.qty;
    colesTotal += colesP; wooliesTotal += wooliesP;
    const colesWins = colesP <= wooliesP;
    return `<div class="price-row"><div class="pr-name">${escapeHTML(p.name)}${item.qty > 1 ? ` <span style="color:var(--mute);font-weight:400;">× ${item.qty}</span>` : ''}</div><div class="price-cols"><div class="price-col${colesWins ? ' winner' : ''}"><div class="pc-store"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#E01A4F;margin-right:4px;"></span>Coles</div><div class="pc-price">$${colesP.toFixed(2)}</div>${colesWins ? '<div class="pc-badge">Cheaper</div>' : ''}</div><div class="price-col${!colesWins ? ' winner' : ''}"><div class="pc-store"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#00813F;margin-right:4px;"></span>Woolies</div><div class="pc-price">$${wooliesP.toFixed(2)}</div>${!colesWins ? '<div class="pc-badge">Cheaper</div>' : ''}</div></div></div>`;
  }).filter(Boolean).join('');
  const winner  = colesTotal <= wooliesTotal ? 'Coles' : 'Woolworths';
  const saving  = Math.abs(colesTotal - wooliesTotal).toFixed(2);
  const summary = `<div class="price-summary"><strong>${winner}</strong> is cheaper overall — saves you <strong>$${saving}</strong> on this shop. Coles total: <strong>$${colesTotal.toFixed(2)}</strong> · Woolies total: <strong>$${wooliesTotal.toFixed(2)}</strong></div>`;
  $('#priceSheetBody').innerHTML = summary + (rows || '<div class="price-loading">No Coles or Woolworths items to compare.</div>');
}

// ---------- Add ingredients to list ----------
function emojiForIngredient(name) {
  const n   = name.toLowerCase();
  const map = [
    ['lemon','🍋'],['lime','🍋‍🟩'],['basil','🌿'],['parmesan','🧀'],['cheddar','🧀'],['feta','🧀'],['mozzarella','🧀'],['olive','🫒'],
    ['pasta','🍝'],['spaghetti','🍝'],['rice','🍚'],['chicken','🍗'],['salmon','🐟'],['tomato','🍅'],['onion','🧅'],['garlic','🧄'],
    ['ginger','🫚'],['bread','🍞'],['lasagna','🍝'],['avocado','🥑'],['banana','🍌'],['milk','🥛'],['butter','🧈'],['flour','🌾'],
    ['rosemary','🌿'],['broccoli','🥦'],['bok choy','🥬'],['mince','🥩'],['beef','🥩'],['salsa','🌶️'],['chipotle','🌶️'],['chilli','🌶️'],
    ['coriander','🌿'],['tortilla','🌮'],['bean','🫘'],['potato','🥔'],['passata','🍅'],
  ];
  for (const [k,e] of map) if (n.includes(k)) return e;
  return '🛒';
}
function addPickedIngredientsToList() {
  const m = state.meals.find(x => x.id === ui.activeMealId);
  if (!m) return;
  let n = 0;
  for (const idx of ui.pickedIngredients) {
    const ing = m.ingredients[idx];
    if (!ing) continue;
    let p = state.products.find(x => x.name.toLowerCase() === ing.name.toLowerCase());
    if (!p) p = addProduct({ name: ing.name, package: 'Each', store: null, emoji: emojiForIngredient(ing.name), category: 'Recipe', sourceUrl: null });
    addToList(p.id, 1, ing.qty);
    n++;
  }
  ui.pickedIngredients = new Set();
  toast(`Added ${n} item${n===1?'':'s'} to your list`);
  showScreen('shopping', false);
}

// ---------- Wire up events ----------
function bind() {
  const stamp = document.getElementById('buildStamp');
  if (stamp) stamp.textContent = `Updated ${BUILD}`;
  document.addEventListener('click', (e) => {
    const t      = e.target;
    const action = t.closest('[data-action]')?.dataset.action;
    if (action) handleAction(action, t.closest('[data-action]'), e);
  });

  // Sign-in form
  $('#signinBtn').addEventListener('click', async () => {
    const email = $('#signinEmail').value.trim();
    if (!email) { toast('Enter your email first'); return; }
    const btn = $('#signinBtn');
    btn.disabled    = true;
    btn.textContent = 'Sending…';
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'https://hath22.github.io/hathakims-shopping/' },
    });
    if (error) {
      toast('Something went wrong. Try again.');
      btn.disabled = false; btn.textContent = 'Send sign-in link';
      return;
    }
    $('#signinSentEmail').textContent = email;
    $('#signinForm').classList.add('hidden');
    $('#signinSent').classList.remove('hidden');
  });
  $('#signinResend').addEventListener('click', () => {
    $('#signinForm').classList.remove('hidden');
    $('#signinSent').classList.add('hidden');
    const btn = $('#signinBtn');
    btn.disabled = false; btn.textContent = 'Send sign-in link';
  });

  $$('#tabbar button').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.tab, false)));
  $$('#libFilters button').forEach(b => b.addEventListener('click', () => { ui.libFilter = b.dataset.filter; render(); }));

  $('#scrim').addEventListener('click', () => {
    if (ui.sheetOpen) closeAdd();
    else if (ui.daySheetOpen) closeDaySheet();
    else if (ui.priceSheetOpen) closePriceSheet();
    else if (ui.confirmSheetOpen) closeConfirmSheet();
  });
  $('#confirmBtn').addEventListener('click', () => { const cb = confirmCallback; closeConfirmSheet(); if (cb) cb(); });
  $('#confirmCancelBtn').addEventListener('click', closeConfirmSheet);
  $$('#addTabs button').forEach(b => b.addEventListener('click', () => setAddMode(b.dataset.mode)));
  $('#urlInput').addEventListener('input', onUrlInput);
  $('#pasteBtn').addEventListener('click', async () => {
    try { const t = await navigator.clipboard.readText(); $('#urlInput').value = t; onUrlInput(); }
    catch { $('#urlInput').focus(); toast('Paste from your keyboard'); }
  });
  $('#urlAddBtn').addEventListener('click', urlAddCommit);
  $('#pastSearch').addEventListener('input', (e) => { ui.pastSearch = e.target.value; renderPastList(); });
  $('#quickAddBtn').addEventListener('click', quickAddCommit);
  $('#formFrequent').addEventListener('click', () => { ui.formDraft && (ui.formDraft.frequent = !ui.formDraft.frequent); $('#formFrequent').classList.toggle('off'); });
  $('#deleteMealBtn').addEventListener('click', deleteMeal);
  $('#mealDeleteBtn').addEventListener('click', () => {
    const m = state.meals.find(x => x.id === ui.activeMealId);
    if (!m) return;
    openConfirmSheet(`Delete "${m.name}"?`, 'It will also be removed from your meal planner.', 'Delete meal', true, () => {
      Object.keys(state.week).forEach(k => {
        if (state.week[k]?.mealId === m.id) setDayEntry(k, { mealId: null });
      });
      state.meals = state.meals.filter(x => x.id !== m.id);
      sb.from('meals').delete().eq('id', m.id);
      toast('Meal deleted');
      back();
    });
  });
  $('#mealFavBtn').addEventListener('click', () => {
    const m = state.meals.find(x => x.id === ui.activeMealId);
    if (!m) return;
    m.frequent = !m.frequent;
    sb.from('meals').update({ is_frequent: m.frequent }).eq('id', m.id);
    renderMealDetail();
    toast(m.frequent ? 'Pinned to frequent' : 'Removed from frequent');
  });
  $('#ingPickAll').addEventListener('click', () => {
    const m = state.meals.find(x => x.id === ui.activeMealId);
    if (!m) return;
    if (ui.pickedIngredients.size === m.ingredients.length) ui.pickedIngredients = new Set();
    else ui.pickedIngredients = new Set(m.ingredients.map((_,i)=>i));
    renderMealDetail();
  });
  $('#dayBendigoToggle').addEventListener('click', () => {
    if (!ui.dayTarget) return;
    const { key } = ui.dayTarget;
    const entry   = getDayEntry(key);
    setDayEntry(key, { isBendigo: !entry.isBendigo });
    $('#dayBendigoToggle').classList.toggle('off', !getDayEntry(key).isBendigo);
  });
  $$('[data-pref]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.pref;
    state.prefs[k] = !state.prefs[k];
    b.classList.toggle('off', !state.prefs[k]);
    try { localStorage.setItem('hathakims-prefs', JSON.stringify(state.prefs)); } catch {}
    if (k === 'demoOffline') renderShopping();
  }));
  $$('#defaultStore button').forEach(b => b.addEventListener('click', () => {
    state.prefs.defaultStore = b.dataset.store;
    try { localStorage.setItem('hathakims-prefs', JSON.stringify(state.prefs)); } catch {}
    renderSettings();
  }));
}

// ---------- Action dispatcher ----------
function handleAction(action, el, ev) {
  switch (action) {
    case 'open-add':      openAdd(); break;
    case 'open-settings': showScreen('settings'); break;
    case 'back':          (ui.sheetOpen || ui.daySheetOpen || ui.priceSheetOpen || ui.confirmSheetOpen) ? (ui.sheetOpen ? closeAdd() : ui.daySheetOpen ? closeDaySheet() : ui.priceSheetOpen ? closePriceSheet() : closeConfirmSheet()) : back(); break;
    case 'goto-quick':    setAddMode('quick'); break;
    case 'edit-url':      $('#urlInput').focus(); break;
    case 'retry-url':     onUrlInput(); break;
    case 'toggle-history': ui.showingPastWeeks = !ui.showingPastWeeks; render(); break;
    case 'compare-prices':  openPriceSheet(); break;
    case 'scroll-to-today': scrollToToday(); break;
    case 'tick': {
      ev?.stopPropagation();
      const tickId     = el.dataset.itemId;
      const tickedItem = state.list.find(x => x.id === tickId);
      if (!tickedItem) break;
      if (!tickedItem.ticked) {
        const card = document.querySelector(`.card[data-item-id="${tickId}"]`);
        if (card) requestAnimationFrame(() => card.classList.add('popping'));
        showTickToast();
        setTimeout(() => { tickItem(tickId); render(); }, 260);
      } else {
        tickItem(tickId); render();
      }
      break;
    }
    case 'clear-trolley': {
      const n = state.list.filter(i => i.ticked).length;
      if (n === 0) return;
      openConfirmSheet('Clear picked items?', `${n} picked-up item${n===1?'':'s'} will be removed from the list.`, `Clear ${n} item${n===1?'':'s'}`, false, () => { clearTicked(); toast(`Cleared ${n} item${n===1?'':'s'}`); render(); });
      break;
    }
    case 'open-meal': {
      ui.activeMealId = el.dataset.mealId;
      ui.pickedIngredients = new Set();
      ui._ingredientsForMeal = null;
      showScreen('meal-detail');
      break;
    }
    case 'open-day': openDaySheet(el.dataset.day); break;
    case 'day-eating-out': {
      if (!ui.dayTarget) break;
      const { key } = ui.dayTarget;
      const entry      = getDayEntry(key);
      const nowEatingOut = !entry.eatingOut;
      setDayEntry(key, { eatingOut: nowEatingOut, mealId: nowEatingOut ? null : entry.mealId });
      renderDaySheetBody();
      break;
    }
    case 'day-pick-meal': {
      if (!ui.dayTarget) break;
      setDayMeal(ui.dayTarget.key, el.dataset.mealId);
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
    case 'close-day-sheet': closeDaySheet(); break;
    case 'edit-meal':       startMealForm(ui.activeMealId); break;
    case 'edit-meal-quick': ev?.stopPropagation(); startMealForm(el.dataset.mealId); break;
    case 'new-meal':   startMealForm(); break;
    case 'save-meal':  commitMealForm(); break;
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
    case 'past-select':  pastSelect(el.dataset.id); break;
    case 'qty-dec':      pastQtyDelta(-1); break;
    case 'qty-inc':      pastQtyDelta(+1); break;
    case 'past-commit':  ui.pastNote = $('#pastNote').value || ''; pastCommit(); break;
    case 'signout':
      sb.auth.signOut();
      break;
    case 'reset-data':
      openConfirmSheet('Reset all data?', 'This will permanently delete your shopping list, meal planner, and meal library.', 'Delete everything', true, async () => {
        const ids = state.list.map(x => x.id);
        if (ids.length) await sb.from('shopping_items').delete().in('id', ids);
        const planKeys = Object.keys(state.week);
        if (planKeys.length) await sb.from('week_plans').delete().eq('household_id', householdId);
        const mealIds = state.meals.map(m => m.id);
        if (mealIds.length) await sb.from('meals').delete().in('id', mealIds);
        const prodIds = state.products.map(p => p.id);
        if (prodIds.length) await sb.from('products').delete().in('id', prodIds);
        state.list = []; state.meals = []; state.week = {}; state.products = [];
        toast('All data cleared');
        render();
      });
      break;
  }
}

// ---------- Auth: household check ----------
async function checkHousehold() {
  const { data: membership } = await sb
    .from('household_members')
    .select('household_id, display_name')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (membership) {
    householdId             = membership.household_id;
    currentUser.displayName = membership.display_name;
    return true;
  }

  // New user — check invite
  const { data: invite } = await sb
    .from('household_invites')
    .select('household_id, display_name')
    .maybeSingle();

  if (invite) {
    const { error } = await sb.from('household_members').insert({
      household_id: invite.household_id,
      user_id:      currentUser.id,
      display_name: invite.display_name,
    });
    if (!error) {
      householdId             = invite.household_id;
      currentUser.displayName = invite.display_name;
      return true;
    }
  }
  return false;
}

async function onSignedIn(session) {
  currentUser = { id: session.user.id, email: session.user.email, displayName: null };
  const authorised = await checkHousehold();
  if (!authorised) {
    showScreen('signin', false);
    toast('Account not authorised for this household.');
    await sb.auth.signOut();
    return;
  }
  await loadData();
  subscribeToChanges();
  showScreen('shopping', false);
}

// ---------- Boot ----------
let _overlayHidden = false;
function hideOverlay() {
  if (_overlayHidden) return;
  _overlayHidden = true;
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 350); }
}

function boot() {
  try { bind(); } catch (e) { console.error('bind failed', e); }

  // Absolute worst-case escape hatch — 4s and we show something
  setTimeout(() => {
    hideOverlay();
    if (!ui.currentScreen) showScreen('signin', false);
  }, 4000);

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') {
      // Reads from localStorage — instant, no network needed.
      // Hide overlay immediately; onSignedIn loads data in the background.
      hideOverlay();
      if (session) {
        onSignedIn(session).catch(() => showScreen('signin', false));
      } else {
        showScreen('signin', false);
      }
    } else if (event === 'SIGNED_IN' && !householdId) {
      // Magic link callback — only if not already signed in
      onSignedIn(session).catch(() => showScreen('signin', false));
    } else if (event === 'SIGNED_OUT') {
      householdId = null; currentUser = null;
      if (realtimeSub) { realtimeSub.unsubscribe(); realtimeSub = null; }
      showScreen('signin', false);
    }
  });
}

boot();

})();
