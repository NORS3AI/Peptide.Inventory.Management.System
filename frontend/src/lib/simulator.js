/**
 * Sandbox simulator — populates every PIMS store with plausible
 * fake data so the app looks lived-in for demos / screenshots.
 *
 *   await runSimulator()      → fills peptides, batches, boxes,
 *                                tasks, minutes, snapshots,
 *                                WooCommerce caches
 *   await clearSimulatedData() → wipes the operational stores
 *                                but preserves users/roles,
 *                                settings, and the site password
 */
import { db } from './db';
import { generateUserId } from './auth';

const PEPTIDES = [
  { id: 'SR_001_Semaglutide-5',  name: 'Semaglutide',  size: '5',   qty: 40, labeled: 32, batch: 'SRG126', purity: '99%' },
  { id: 'SR_002_Semaglutide-10', name: 'Semaglutide',  size: '10',  qty: 60, labeled: 45, batch: 'SRG126', purity: '99%' },
  { id: 'SR_003_Semaglutide-15', name: 'Semaglutide',  size: '15',  qty: 12, labeled: 10, batch: 'SRG126', purity: '99%' },
  { id: 'SR_004_Tirzepatide-10', name: 'Tirzepatide',  size: '10',  qty: 55, labeled: 50, batch: 'SRG126', purity: '99%' },
  { id: 'SR_005_Tirzepatide-15', name: 'Tirzepatide',  size: '15',  qty: 20, labeled: 18, batch: 'SRG126', purity: '99%' },
  { id: 'SR_006_Tirzepatide-20', name: 'Tirzepatide',  size: '20',  qty: 8,  labeled: 6,  batch: 'SRG126', purity: '99%' },
  { id: 'SR_007_Retatrutide-10', name: 'Retatrutide',  size: '10',  qty: 100, labeled: 90, batch: 'SRG126', purity: '99%' },
  { id: 'SR_008_Retatrutide-20', name: 'Retatrutide',  size: '20',  qty: 25, labeled: 22, batch: 'SRG126', purity: '99%' },
  { id: 'SR_010_AOD-9604-5',     name: 'AOD-9604',     size: '5',   qty: 40, labeled: 35, batch: 'SRG126', purity: '99%' },
  { id: 'SR_011_AOD-9604-10',    name: 'AOD-9604',     size: '10',  qty: 20, labeled: 15, batch: 'SRG126', purity: '99%' },
  { id: 'SR_012_BPC-157-5',      name: 'BPC-157',      size: '5',   qty: 15, labeled: 10, batch: 'SRG126', purity: '99%' },
  { id: 'SR_013_BPC-157-10',     name: 'BPC-157',      size: '10',  qty: 30, labeled: 25, batch: 'SRG126', purity: '99%' },
  { id: 'SR_020_GHK-Cu-50',      name: 'GHK-Cu',       size: '50',  qty: 60, labeled: 55, batch: 'SRG126', purity: '99%' },
  { id: 'SR_024_KPV-10',         name: 'KPV',          size: '10',  qty: 15, labeled: 12, batch: 'SRG126', purity: '99%' },
  { id: 'SR_030_Oxytocin-5',     name: 'Oxytocin',     size: '5',   qty: 5,  labeled: 4,  batch: 'SRG126', purity: '99%' },
  { id: 'SR_031_PT-141-10',      name: 'PT-141',       size: '10',  qty: 10, labeled: 8,  batch: 'SRG126', purity: '99%' },
  { id: 'SR_035_Sermorelin-10',  name: 'Sermorelin',   size: '10',  qty: 7,  labeled: 6,  batch: 'SRG126', purity: '99%' },
  { id: 'SR_037_Tesamorelin-20', name: 'Tesamorelin',  size: '20',  qty: 4,  labeled: 3,  batch: 'SRG126', purity: '99%' },
];

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Sage', 'Reese'];
const LAST_NAMES = ['Carter', 'Chen', 'Martinez', 'Patel', 'Nguyen', 'Johnson', 'Garcia', 'Kim', 'Hall', 'Wright'];

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function money(min, max) {
  return Number((min + Math.random() * (max - min)).toFixed(2));
}

async function fillPeptides() {
  await db.peptides.clear();
  const now = new Date().toISOString();
  for (const p of PEPTIDES) {
    await db.peptides.set(p.id, {
      peptideId: p.id,
      peptideName: p.name,
      sku: p.id,
      size: p.size,
      netWeight: '',
      quantity: p.qty,
      labeledCount: p.labeled,
      reserve: Math.floor(Math.random() * 4),
      batchNumber: p.batch,
      purity: p.purity,
      velocity: pick(['0', '0.5', '1', '2']),
      daysLeft: '',
      unit: 'mg',
      importedAt: now,
    });
  }
}

async function fillBatches() {
  // Direct store access via bulkImport if available; otherwise skip
  if (!db.batches?.bulkImport) return;
  const batches = PEPTIDES.slice(0, 5).map((p, i) => ({
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
    createdAt: daysAgo(60 - i * 10),
  }));
  await db.batches.bulkImport(batches);
}

async function fillBoxes() {
  if (!db.boxes?.bulkImport) return;
  const boxes = [
    { id: 'box-sim-1', sku: 'BOX-10ML', name: '10ml vial box', onHand: 500, dailyUsage: 20, supplier: 'VialCo', costPerUnit: 0.15 },
    { id: 'box-sim-2', sku: 'BOX-5ML',  name: '5ml vial box',  onHand: 350, dailyUsage: 15, supplier: 'VialCo', costPerUnit: 0.12 },
    { id: 'box-sim-3', sku: 'LBL-STD',  name: 'Standard label', onHand: 2000, dailyUsage: 60, supplier: 'LabelPro', costPerUnit: 0.03 },
  ];
  await db.boxes.bulkImport(boxes);
}

async function fillTasks() {
  if (!db.tasks?.create) return;
  const now = new Date();
  const samples = [
    { title: 'Count label stock on hand',       priority: 'high',     frequency: 'daily',  expiresInDays: 1 },
    { title: 'Email QC lab for last batch',     priority: 'critical', frequency: 'weekly', expiresInDays: 2 },
    { title: 'Restock BPC-157 10mg',            priority: 'medium',   frequency: 'weekly', expiresInDays: 3 },
    { title: 'Snapshot inventory for the week', priority: 'low',      frequency: 'weekly', expiresInDays: 5 },
    { title: 'Review returning customers',      priority: 'medium',   frequency: 'daily',  expiresInDays: 1 },
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
    // Tiny stagger so ids don't collide (ids use Date.now())
    await new Promise(r => setTimeout(r, 5));
  }
}

async function fillMinutes() {
  if (!db.minutes?.create) return;
  await db.minutes.create({
    title: 'Weekly ops sync',
    meetingDate: daysAgo(7),
    notes: '<p>Covered QC results on the latest Semaglutide batch, agreed to re-label 5mg vials, and set a 48-hour SLA for the GHK-Cu replenishment.</p>',
    attendees: ['Alex', 'Jordan', 'Taylor'],
    actionItems: [
      { member: 'Alex',   task: 'Order 500 more 10ml vials',  completed: false },
      { member: 'Jordan', task: 'Re-label Semaglutide 5mg',  completed: true  },
      { member: 'Taylor', task: 'Confirm QC batch SRG126',   completed: false },
    ],
  });
  await new Promise(r => setTimeout(r, 10));
  await db.minutes.create({
    title: 'Monthly planning',
    meetingDate: daysAgo(30),
    notes: '<p>Reviewed inventory turnover; flagged slow movers; approved GHK-Cu reserve policy.</p>',
    attendees: ['Alex', 'Morgan', 'Casey'],
    actionItems: [],
  });
}

async function fillSnapshots() {
  const peptides = await db.peptides.getAll();
  if (!db.snapshots?.save || peptides.length === 0) return;
  // A snapshot today, a week ago, and a month ago (quantities nudged
  // so the Compare view has non-trivial deltas).
  await db.snapshots.save(peptides, 'Today');
  const weekAgo = peptides.map(p => ({ ...p, quantity: Math.max(0, (p.quantity || 0) + Math.floor(Math.random() * 10) - 3) }));
  await db.snapshots.save(weekAgo, '1 week ago');
  const monthAgo = peptides.map(p => ({ ...p, quantity: Math.max(0, (p.quantity || 0) + Math.floor(Math.random() * 20) - 8) }));
  await db.snapshots.save(monthAgo, '1 month ago');
}

async function fillWooCommerce() {
  const products = PEPTIDES.map((p, i) => ({
    id: 1000 + i,
    name: `${p.name} ${p.size}mg`,
    sku: p.id,
    price: money(60, 150),
    regularPrice: money(80, 170),
    salePrice: 0,
    stockQuantity: Math.max(0, p.labeled - 2),
    stockStatus: p.qty > 0 ? 'instock' : 'outofstock',
    manageStock: true,
    type: 'simple',
    status: 'publish',
    categories: ['Peptides'],
    dateModified: daysAgo(2),
  }));
  await db.woocommerce.products.replaceAll(products);

  const customers = Array.from({ length: 6 }).map((_, i) => {
    const fn = pick(FIRST_NAMES), ln = pick(LAST_NAMES);
    return {
      id: 2000 + i,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`,
      firstName: fn,
      lastName: ln,
      fullName: `${fn} ${ln}`,
      username: `${fn.toLowerCase()}${i}`,
      role: 'customer',
      dateCreated: daysAgo(90 - i * 10),
      ordersCount: 1 + Math.floor(Math.random() * 8),
      totalSpent: money(80, 1200),
    };
  });
  await db.woocommerce.customers.replaceAll(customers);

  const STATES = ['California', 'Texas', 'Florida', 'New York', 'Illinois', 'Washington', 'Arizona', 'Georgia', 'Ohio', 'Colorado'];
  const orders = Array.from({ length: 14 }).map((_, i) => {
    const cust = pick(customers);
    const product = pick(products);
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
      dateCreated: daysAgo(45 - i * 3),
      dateCompleted: daysAgo(44 - i * 3),
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
  await fillPeptides();
  await fillBatches();
  await fillBoxes();
  await fillTasks();
  await fillMinutes();
  await fillSnapshots();
  await fillWooCommerce();
  return { ok: true };
}

/**
 * Wipe operational data. Preserves users/roles/settings so the
 * site password, column renames, and auth stay intact.
 */
export async function clearSimulatedData() {
  await db.peptides.clear();
  if (db.batches?.clear) await db.batches.clear();
  if (db.boxes?.clear) await db.boxes.clear();
  if (db.woocommerce?.orders?.clear) await db.woocommerce.orders.clear();
  if (db.woocommerce?.products?.clear) await db.woocommerce.products.clear();
  if (db.woocommerce?.customers?.clear) await db.woocommerce.customers.clear();
  // tasks/minutes/snapshots: iterate + delete so we don't nuke the stores wholesale
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
}
