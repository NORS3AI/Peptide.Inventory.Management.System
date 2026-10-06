/**
 * Sandbox simulator — populates every PIMS store with plausible
 * fake data so the app looks lived-in for demos / screenshots.
 *
 *   await runSimulator()      → fills inventory, batches, boxes,
 *                                tasks, minutes, snapshots,
 *                                accounts, prices, WooCommerce
 *   await clearSimulatedData() → wipes the operational stores
 *                                but preserves settings and the
 *                                core auth owner
 */
import { db } from './db';
import { generateUserId, hashPassword } from './auth';
import { DEFAULT_ROLES } from './permissions';

// 25 products spanning every stock status (out-of-stock, nearly-out,
// low, good, and on-order) plus a mix of sales-ready / needs-testing
// so Sales Ready, Reports, and the Dashboard breakdown all show
// non-trivial numbers after a single Run.
const PRODUCTS = [
  // ── Good stock (qty > 25), fully labeled, sales-ready ───────────
  { id: 'SKU-001-Semaglutide-10',  name: 'Semaglutide',  size: '10',  qty: 60,  labeled: 55, netWeight: '10.1' },
  { id: 'SKU-002-Tirzepatide-10',  name: 'Tirzepatide',  size: '10',  qty: 55,  labeled: 50, netWeight: '10.0' },
  { id: 'SKU-003-Retatrutide-10',  name: 'Retatrutide',  size: '10',  qty: 100, labeled: 90, netWeight: '10.2' },
  { id: 'SKU-004-GHK-Cu-50',       name: 'GHK-Cu',       size: '50',  qty: 80,  labeled: 70, netWeight: '50.1' },
  { id: 'SKU-005-BPC-157-10',      name: 'BPC-157',      size: '10',  qty: 42,  labeled: 38, netWeight: '10.0' },
  { id: 'SKU-006-TB-500-5',        name: 'TB-500',       size: '5',   qty: 70,  labeled: 60, netWeight: '5.0'  },

  // ── Low stock (11–25), partially labeled, mostly sales-ready ────
  { id: 'SKU-007-Semaglutide-5',   name: 'Semaglutide',  size: '5',   qty: 22,  labeled: 18, netWeight: '5.0'  },
  { id: 'SKU-008-Tirzepatide-15',  name: 'Tirzepatide',  size: '15',  qty: 18,  labeled: 15, netWeight: '15.1' },
  { id: 'SKU-009-AOD-9604-10',     name: 'AOD-9604',     size: '10',  qty: 20,  labeled: 15, netWeight: '10.0' },
  { id: 'SKU-010-CJC-1295-5',      name: 'CJC-1295',     size: '5',   qty: 15,  labeled: 12, netWeight: ''     },
  { id: 'SKU-011-Kisspeptin-10',   name: 'Kisspeptin-10',size: '10',  qty: 12,  labeled: 10, netWeight: '10.0' },

  // ── Nearly out (1–10) ───────────────────────────────────────────
  { id: 'SKU-012-Oxytocin-5',      name: 'Oxytocin',     size: '5',   qty: 5,   labeled: 4,  netWeight: '5.0'  },
  { id: 'SKU-013-PT-141-10',       name: 'PT-141',       size: '10',  qty: 10,  labeled: 8,  netWeight: '10.0' },
  { id: 'SKU-014-Sermorelin-10',   name: 'Sermorelin',   size: '10',  qty: 7,   labeled: 6,  netWeight: ''     },
  { id: 'SKU-015-Tesamorelin-20',  name: 'Tesamorelin',  size: '20',  qty: 4,   labeled: 3,  netWeight: '20.1' },
  { id: 'SKU-016-Epithalon-10',    name: 'Epithalon',    size: '10',  qty: 3,   labeled: 2,  netWeight: ''     },

  // ── Out of stock (0) ────────────────────────────────────────────
  { id: 'SKU-017-NAD+-500',        name: 'NAD+',         size: '500', qty: 0,   labeled: 0,  netWeight: ''     },
  { id: 'SKU-018-KPV-10',          name: 'KPV',          size: '10',  qty: 0,   labeled: 0,  netWeight: '10.0' },
  { id: 'SKU-019-Thymosin-5',      name: 'Thymosin',     size: '5',   qty: 0,   labeled: 0,  netWeight: ''     },
  { id: 'SKU-020-Hexarelin-5',     name: 'Hexarelin',    size: '5',   qty: 0,   labeled: 0,  netWeight: '5.0'  },

  // ── On order (orderedQty + orderedDate set) ─────────────────────
  { id: 'SKU-021-MOTS-c-10',       name: 'MOTS-c',       size: '10',  qty: 0,   labeled: 0,  netWeight: '',    orderedQty: 50, orderedDate: 2 },
  { id: 'SKU-022-SS-31-10',        name: 'SS-31',        size: '10',  qty: 2,   labeled: 2,  netWeight: '10.0', orderedQty: 30, orderedDate: 5 },
  { id: 'SKU-023-DSIP-5',          name: 'DSIP',         size: '5',   qty: 8,   labeled: 6,  netWeight: '',    orderedQty: 20, orderedDate: 1 },
  { id: 'SKU-024-Selank-10',       name: 'Selank',       size: '10',  qty: 15,  labeled: 10, netWeight: '10.1', orderedQty: 25, orderedDate: 7 },
  { id: 'SKU-025-Semax-10',        name: 'Semax',        size: '10',  qty: 22,  labeled: 18, netWeight: '',    orderedQty: 15, orderedDate: 3 },
];

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Sage', 'Reese'];
const LAST_NAMES  = ['Carter', 'Chen', 'Martinez', 'Patel', 'Nguyen', 'Johnson', 'Garcia', 'Kim', 'Hall', 'Wright'];

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function money(min, max) {
  return Number((min + Math.random() * (max - min)).toFixed(2));
}

async function ensureDefaultRoles() {
  const existing = await db.roles.count();
  if (existing > 0) return;
  for (const role of DEFAULT_ROLES) await db.roles.set(role.id, role);
}

async function fillInventory() {
  await db.peptides.clear();
  const now = new Date().toISOString();
  for (const p of PRODUCTS) {
    const velocityPool = p.qty > 25 ? [1, 2, 3] : p.qty > 10 ? [0.5, 1, 1.5] : [0, 0.5];
    const peptide = {
      peptideId: p.id,
      peptideName: p.name,
      sku: p.id,
      size: p.size,
      netWeight: p.netWeight || '',
      quantity: p.qty,
      labeledCount: p.labeled,
      reserve: Math.floor(Math.random() * 3),
      batchNumber: `B-${String(p.id).slice(-6)}`,
      purity: Math.random() < 0.9 ? '99%' : '98%',
      velocity: String(pick(velocityPool)),
      daysLeft: '',
      unit: 'mg',
      importedAt: now,
      ...(p.orderedQty ? {
        orderedQty: p.orderedQty,
        orderedDate: daysAgo(p.orderedDate ?? 2),
        hasActiveOrder: true,
      } : {}),
    };
    await db.peptides.set(p.id, peptide);
  }
}

async function fillBatches() {
  if (!db.batches?.bulkImport) return;
  const batches = PRODUCTS.slice(0, 8).map((p, i) => ({
    id: `batch-sim-${i}`,
    vendor: pick(['Belgium', 'Lab Alpha', 'Lab Beta']),
    productId: p.id,
    name: p.name,
    mgMl: p.size,
    pricePerVial: money(5, 25),
    pricePerBox: money(100, 400),
    qtyPurchased: 10 + i * 5,
    comp1: money(30, 80),
    comp2: money(30, 80),
    comp3: money(30, 80),
    srgSale: money(60, 150),
    createdAt: daysAgo(60 - i * 7),
  }));
  await db.batches.bulkImport(batches);
}

async function fillBoxes() {
  if (!db.boxes?.bulkImport) return;
  await db.boxes.bulkImport([
    { id: 'box-sim-1', sku: 'BOX-10ML', name: '10ml vial box',  onHand: 500,  dailyUsage: 20, supplier: 'VialCo',   costPerUnit: 0.15 },
    { id: 'box-sim-2', sku: 'BOX-5ML',  name: '5ml vial box',   onHand: 350,  dailyUsage: 15, supplier: 'VialCo',   costPerUnit: 0.12 },
    { id: 'box-sim-3', sku: 'LBL-STD',  name: 'Standard label', onHand: 2000, dailyUsage: 60, supplier: 'LabelPro', costPerUnit: 0.03 },
    { id: 'box-sim-4', sku: 'STOP-GRY', name: 'Grey stoppers',  onHand: 1500, dailyUsage: 55, supplier: 'VialCo',   costPerUnit: 0.05 },
  ]);
}

async function fillTasks() {
  if (!db.tasks?.create) return;
  const now = new Date();
  const samples = [
    { title: 'Count label stock on hand',                priority: 'high',     frequency: 'daily',  expiresInDays: 1 },
    { title: 'Email QC lab for last batch',              priority: 'critical', frequency: 'weekly', expiresInDays: 2 },
    { title: 'Restock BPC-157 10mg',                     priority: 'medium',   frequency: 'weekly', expiresInDays: 3 },
    { title: 'Snapshot inventory for the week',          priority: 'low',      frequency: 'weekly', expiresInDays: 5 },
    { title: 'Review returning customers',               priority: 'medium',   frequency: 'daily',  expiresInDays: 1 },
    { title: 'Reorder empty SKUs (NAD+, KPV, Thymosin)', priority: 'critical', frequency: 'daily',  expiresInDays: 1 },
    { title: 'Confirm shipping address: order #3002',    priority: 'high',     frequency: 'daily',  expiresInDays: 1 },
    { title: 'Weekly velocity review',                   priority: 'low',      frequency: 'weekly', expiresInDays: 6 },
  ];
  for (const s of samples) {
    await db.tasks.create({
      title: s.title,
      notes: '',
      priority: s.priority,
      frequency: s.frequency,
      expirationDate: new Date(now.getTime() + s.expiresInDays * 86400000).toISOString(),
      completed: false,
    });
    await new Promise(r => setTimeout(r, 5));
  }
}

async function fillMinutes() {
  if (!db.minutes?.create) return;
  await db.minutes.create({
    title: 'Weekly ops sync',
    meetingDate: daysAgo(7),
    notes: '<p>Covered QC results on the latest Semaglutide batch, agreed to re-label 5mg vials, set a 48-hour SLA for GHK-Cu replenishment, flagged NAD+ and KPV as out of stock.</p>',
    attendees: ['Alex', 'Jordan', 'Taylor'],
    actionItems: [
      { member: 'Alex',   task: 'Order 500 more 10ml vials',    completed: false },
      { member: 'Jordan', task: 'Re-label Semaglutide 5mg',     completed: true  },
      { member: 'Taylor', task: 'Confirm QC batch B-125',       completed: false },
    ],
  });
  await new Promise(r => setTimeout(r, 10));
  await db.minutes.create({
    title: 'Monthly planning',
    meetingDate: daysAgo(30),
    notes: '<p>Reviewed inventory turnover; flagged slow movers; approved off-book reserve policy.</p>',
    attendees: ['Alex', 'Morgan', 'Casey'],
    actionItems: [
      { member: 'Casey',  task: 'Draft Q2 forecast',            completed: false },
    ],
  });
}

async function fillSnapshots() {
  const peptides = await db.peptides.getAll();
  if (!db.snapshots?.save || peptides.length === 0) return;
  await db.snapshots.save(peptides, 'Today');
  const weekAgo = peptides.map(p => ({ ...p, quantity: Math.max(0, (p.quantity || 0) + Math.floor(Math.random() * 10) - 3) }));
  await db.snapshots.save(weekAgo, '1 week ago');
  const monthAgo = peptides.map(p => ({ ...p, quantity: Math.max(0, (p.quantity || 0) + Math.floor(Math.random() * 20) - 8) }));
  await db.snapshots.save(monthAgo, '1 month ago');
}

async function fillPrices() {
  // Prices view reads db.settings.priceData keyed by peptideId.
  const prices = {};
  for (const p of PRODUCTS) {
    const base = Number(p.size) || 10;
    prices[p.id] = {
      cost:   Number((base * money(1.0, 1.8)).toFixed(2)),
      price:  Number((base * money(6, 12)).toFixed(2)),
      vendor: pick(['Belgium', 'Lab Alpha', 'Lab Beta']),
    };
  }
  await db.settings.set('priceData', prices);
}

async function fillAccounts() {
  // Seed the full default role set so the role-gated UI has colour.
  await ensureDefaultRoles();
  const now = new Date().toISOString();
  // Keep whatever Super Admin already exists; add demo team members.
  const existing = await db.users.getAll();
  const existingUsernames = new Set(existing.map(u => u.username.toLowerCase()));
  const samples = [
    { username: 'anna.admin',    firstName: 'Anna',    lastName: 'Admin',    roleId: 'role_admin',    email: 'anna@demo.pims' },
    { username: 'mike.manager',  firstName: 'Mike',    lastName: 'Manager',  roleId: 'role_manager',  email: 'mike@demo.pims' },
    { username: 'carl.customer', firstName: 'Carl',    lastName: 'Customer', roleId: 'role_customer', email: 'carl@demo.pims', phone: '555-0100' },
    { username: 'gina.guest',    firstName: 'Gina',    lastName: 'Guest',    roleId: 'role_guest',    email: 'gina@demo.pims' },
  ];
  // One pre-hashed password for all demo users so the sandbox shows
  // the login flow even though we never actually hit it.
  const demoHash = await hashPassword('demo');
  for (const s of samples) {
    if (existingUsernames.has(s.username.toLowerCase())) continue;
    const id = generateUserId();
    await db.users.set(id, {
      id,
      username: s.username,
      email: s.email || '',
      firstName: s.firstName,
      lastName: s.lastName,
      phone: s.phone || '',
      roleId: s.roleId,
      source: 'local',
      passwordHash: demoHash,
      createdAt: now,
    });
  }
}

async function fillWooCommerce() {
  const wcProducts = PRODUCTS.map((p, i) => ({
    id: 1000 + i,
    name: `${p.name} ${p.size}mg`,
    sku: p.id,
    price: money(60, 150),
    regularPrice: money(80, 170),
    salePrice: 0,
    stockQuantity: Math.max(0, p.labeled - 2),
    stockStatus: p.qty > 0 || p.orderedQty ? 'instock' : 'outofstock',
    manageStock: true,
    type: 'simple',
    status: 'publish',
    categories: ['Inventory'],
    dateModified: daysAgo(2),
  }));
  await db.woocommerce.products.replaceAll(wcProducts);

  const customers = Array.from({ length: 8 }).map((_, i) => {
    const fn = pick(FIRST_NAMES), ln = pick(LAST_NAMES);
    return {
      id: 2000 + i,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`,
      firstName: fn,
      lastName: ln,
      fullName: `${fn} ${ln}`,
      username: `${fn.toLowerCase()}${i}`,
      role: 'customer',
      dateCreated: daysAgo(90 - i * 8),
      ordersCount: 1 + Math.floor(Math.random() * 8),
      totalSpent: money(80, 1500),
    };
  });
  await db.woocommerce.customers.replaceAll(customers);

  const STATES = ['California', 'Texas', 'Florida', 'New York', 'Illinois', 'Washington', 'Arizona', 'Georgia', 'Ohio', 'Colorado', 'Nevada', 'Oregon'];
  const orders = Array.from({ length: 24 }).map((_, i) => {
    const cust = pick(customers);
    const product = pick(wcProducts);
    const quantity = 1 + Math.floor(Math.random() * 3);
    const total = Number((product.price * quantity).toFixed(2));
    const state = pick(STATES);
    return {
      id: 3000 + i,
      number: String(3000 + i),
      status: pick(['completed', 'completed', 'completed', 'processing', 'on-hold']),
      total,
      currency: 'USD',
      customerId: cust.id,
      customerEmail: cust.email,
      customerName: cust.fullName,
      billingState: state,
      billingCountry: 'US',
      shippingState: state,
      shippingCountry: 'US',
      dateCreated: daysAgo(60 - i * 2),
      dateCompleted: daysAgo(59 - i * 2),
      itemCount: quantity,
      lineItems: [{
        id: i + 1,
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity,
        total,
      }],
    };
  });
  await db.woocommerce.orders.replaceAll(orders);
}

export async function runSimulator() {
  await fillInventory();
  await fillBatches();
  await fillBoxes();
  await fillTasks();
  await fillMinutes();
  await fillSnapshots();
  await fillPrices();
  await fillAccounts();
  await fillWooCommerce();
  return { ok: true, productCount: PRODUCTS.length };
}

/**
 * Wipe operational data. Preserves the current owner user and
 * default roles so the app stays usable.
 */
export async function clearSimulatedData() {
  await db.peptides.clear();
  if (db.batches?.clear) await db.batches.clear();
  if (db.boxes?.clear) await db.boxes.clear();
  if (db.woocommerce?.orders?.clear) await db.woocommerce.orders.clear();
  if (db.woocommerce?.products?.clear) await db.woocommerce.products.clear();
  if (db.woocommerce?.customers?.clear) await db.woocommerce.customers.clear();
  await db.settings.set('priceData', {});
  if (db.tasks?.getAll && db.tasks?.delete) {
    const t = await db.tasks.getAll();
    for (const x of t) await db.tasks.delete(x.id);
  }
  if (db.minutes?.getAll && db.minutes?.delete) {
    const m = await db.minutes.getAll();
    for (const x of m) await db.minutes.delete(x.id);
  }
  if (db.snapshots?.getAll && db.snapshots?.delete) {
    const s = await db.snapshots.getAll();
    for (const x of s) await db.snapshots.delete(x.id);
  }
  // Remove the demo (non-owner) accounts; keep super-admin owner.
  if (db.users?.getAll && db.users?.delete) {
    const users = await db.users.getAll();
    for (const u of users) {
      if (u.roleId !== 'role_super_admin') await db.users.delete(u.id);
    }
  }
}
