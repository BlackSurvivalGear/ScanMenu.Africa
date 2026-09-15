const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

const PRICE_IDS = {
  standard: 'price_1UG0IXJD1JSqfPWiCf4GIdRN',
  pro: 'price_1UG0IcJD1JSqfPWiZcyUAddy'
};
const PRICE_TO_PLAN = Object.fromEntries(Object.entries(PRICE_IDS).map(([plan, price]) => [price, plan]));
const PREVIEW_LIMITS = { 'Main Courses': 3, Sides: 2, Drinks: 2 };
const STANDARD_LIMIT = 25;
const STANDARD_CATEGORIES = new Set(['Main Courses', 'Starters', 'Drinks', 'Desserts', 'Sides', 'Specials']);

function cors(req, res) {
  const origin = req.get('origin');
  if (origin && (/^https:\/\/(www\.)?scanmenu\.africa$/.test(origin) || /^http:\/\/localhost(?::\d+)?$/.test(origin))) res.set('Access-Control-Allow-Origin', origin);
  res.set('Vary', 'Origin');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).send(''); return true; }
  return false;
}

async function requireUser(req) {
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  return admin.auth().verifyIdToken(header.slice(7));
}

function sendError(res, error) {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Request failed.' });
}

function normalizeCategory(category) {
  const value = String(category || '').toLowerCase().trim();
  if (['main', 'mains', 'main courses', 'main course'].includes(value)) return 'Main Courses';
  if (['starter', 'starters'].includes(value)) return 'Starters';
  if (['drink', 'drinks'].includes(value)) return 'Drinks';
  if (['dessert', 'desserts'].includes(value)) return 'Desserts';
  if (['side', 'sides'].includes(value)) return 'Sides';
  if (['special', 'specials'].includes(value)) return 'Specials';
  return category ? String(category).trim() : '';
}

function validateMenuMutation(plan, items, next, existingId) {
  const existing = existingId ? items.find(i => i.id === existingId) : null;
  const category = normalizeCategory(next.category);
  if (plan === 'preview') {
    const limit = PREVIEW_LIMITS[category];
    if (!limit) throw Object.assign(new Error('Preview includes Main Courses, Sides and Drinks only.'), { status: 403, code: 'upgrade_required', targetPlan: 'standard' });
    const count = items.filter(i => normalizeCategory(i.category) === category && i.id !== existingId).length;
    if (count >= limit) throw Object.assign(new Error(`Preview limit reached: ${limit} ${category}.`), { status: 403, code: 'limit_reached', targetPlan: 'standard' });
  }
  if (plan === 'standard') {
    if (!STANDARD_CATEGORIES.has(category)) throw Object.assign(new Error('Custom categories require Premium.'), { status: 403, code: 'upgrade_required', targetPlan: 'pro' });
    if (!existing && items.length >= STANDARD_LIMIT) throw Object.assign(new Error('Standard is limited to 25 menu items.'), { status: 403, code: 'limit_reached', targetPlan: 'pro' });
  }
  if (next.featured && plan !== 'pro') throw Object.assign(new Error('Featured items require Premium.'), { status: 403, code: 'upgrade_required', targetPlan: 'pro' });
  return category;
}

async function syncSubscription(subscription, fallbackUid) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  let uid = subscription.metadata?.firebaseUid || fallbackUid || null;
  if (!uid && customerId) {
    const snap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
    if (!snap.empty) uid = snap.docs[0].id;
  }
  if (!uid) return;
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const paidPlan = PRICE_TO_PLAN[priceId] || subscription.metadata?.plan || 'preview';
  const active = ['active', 'trialing'].includes(subscription.status);
  const plan = active ? paidPlan : 'preview';
  const update = {
    plan,
    stripeCustomerId: customerId || null,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
    subscriptionCurrentPeriodEnd: subscription.current_period_end ? admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000) : null,
    subscriptionUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  if (active) update.subscriptionActivatedAt = admin.firestore.FieldValue.serverTimestamp();
  if (subscription.status === 'canceled') update.subscriptionCancelledAt = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('users').doc(uid).set(update, { merge: true });
  await db.collection('businesses').doc(uid).set({ billingPlan: plan, subscriptionStatus: subscription.status }, { merge: true });
}

exports.createCheckoutSession = onRequest({ cors: false, secrets: [STRIPE_SECRET_KEY] }, async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });
  try {
    const decoded = await requireUser(req);
    const plan = req.body?.plan;
    if (!PRICE_IDS[plan]) return res.status(400).json({ error: 'Invalid plan.' });
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    const userRef = db.collection('users').doc(decoded.uid);
    const user = (await userRef.get()).data() || {};
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: decoded.email, metadata: { firebaseUid: decoded.uid } });
      customerId = customer.id;
      await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }
    const origin = /^https:\/\/(www\.)?scanmenu\.africa$/.test(req.get('origin') || '') ? req.get('origin') : 'https://www.scanmenu.africa';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', customer: customerId,
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/pricing.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing.html?checkout=cancelled`,
      client_reference_id: decoded.uid,
      metadata: { firebaseUid: decoded.uid, plan },
      subscription_data: { metadata: { firebaseUid: decoded.uid, plan } }
    });
    res.json({ url: session.url });
  } catch (error) { sendError(res, error); }
});

exports.createCustomerPortal = onRequest({ cors: false, secrets: [STRIPE_SECRET_KEY] }, async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });
  try {
    const decoded = await requireUser(req);
    const user = (await db.collection('users').doc(decoded.uid).get()).data() || {};
    if (!user.stripeCustomerId) return res.status(409).json({ error: 'No Stripe subscription is linked to this account.' });
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    const origin = /^https:\/\/(www\.)?scanmenu\.africa$/.test(req.get('origin') || '') ? req.get('origin') : 'https://www.scanmenu.africa';
    const session = await stripe.billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: `${origin}/dashboard.html` });
    res.json({ url: session.url });
  } catch (error) { sendError(res, error); }
});

exports.menuItemMutation = onRequest({ cors: false }, async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required.' });
  try {
    const decoded = await requireUser(req);
    const { action, itemId, item = {} } = req.body || {};
    const user = (await db.collection('users').doc(decoded.uid).get()).data() || {};
    const plan = ['preview', 'standard', 'pro'].includes(user.plan) ? user.plan : 'preview';
    const itemsSnap = await db.collection('menuItems').where('restaurantId', '==', decoded.uid).get();
    const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (action === 'delete') {
      if (!items.some(i => i.id === itemId)) return res.status(404).json({ error: 'Menu item not found.' });
      await db.collection('menuItems').doc(itemId).delete();
      return res.json({ ok: true });
    }
    if (!['create', 'update'].includes(action)) return res.status(400).json({ error: 'Invalid action.' });
    if (!item.name || !Number.isFinite(Number(item.price))) return res.status(400).json({ error: 'Name and valid price are required.' });
    if (action === 'update' && !items.some(i => i.id === itemId)) return res.status(404).json({ error: 'Menu item not found.' });
    const category = validateMenuMutation(plan, items, item, action === 'update' ? itemId : null);
    const payload = {
      restaurantId: decoded.uid,
      name: String(item.name).trim().slice(0, 160),
      description: String(item.description || '').trim().slice(0, 2000),
      price: Number(item.price), category,
      available: item.available !== false,
      featured: plan === 'pro' && item.featured === true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (action === 'create') {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection('menuItems').add(payload);
      return res.json({ ok: true, id: ref.id });
    }
    await db.collection('menuItems').doc(itemId).update(payload);
    res.json({ ok: true, id: itemId });
  } catch (error) {
    if (error.code) return res.status(error.status || 403).json({ error: error.message, code: error.code, targetPlan: error.targetPlan });
    sendError(res, error);
  }
});

exports.stripeWebhook = onRequest({ cors: false, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('POST required');
  const stripe = new Stripe(STRIPE_SECRET_KEY.value());
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.get('stripe-signature'), STRIPE_WEBHOOK_SECRET.value());
  } catch (error) {
    console.error('Stripe signature verification failed', error.message);
    return res.status(400).send('Invalid webhook signature');
  }
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode === 'subscription' && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await syncSubscription(subscription, session.client_reference_id || session.metadata?.firebaseUid);
      }
    } else if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      await syncSubscription(event.data.object);
    } else if (['invoice.payment_succeeded', 'invoice.payment_failed'].includes(event.type)) {
      const invoice = event.data.object;
      if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        await syncSubscription(subscription);
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const snap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
          if (!snap.empty) await snap.docs[0].ref.set({ lastInvoiceStatus: event.type === 'invoice.payment_succeeded' ? 'paid' : 'failed', lastInvoiceAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
      }
    }
    res.json({ received: true });
  } catch (error) { sendError(res, error); }
});
