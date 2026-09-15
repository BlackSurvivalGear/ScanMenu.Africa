import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = p => fs.readFileSync(p, 'utf8');
const pricing = read('pricing.html') + read('js/pricing.js');
const dashboard = read('dashboard.html') + read('js/dashboard-billing.js');
const backend = read('functions/index.js');
const rules = read('firestore.rules');
const menu = read('js/menu-items.js');
const admin = read('admin.html') + read('js/admin-subscriptions.js');
const publicMenu = read('js/public-entitlements.js');

for (const [name, text] of Object.entries({ pricing, dashboard })) {
  assert(!/paypal/i.test(text), `${name} still contains PayPal`);
}
assert(backend.includes('price_1UG0IXJD1JSqfPWiCf4GIdRN'));
assert(backend.includes('price_1UG0IcJD1JSqfPWiZcyUAddy'));
assert(backend.includes('constructEvent(req.rawBody'));
assert(backend.includes("'invoice.payment_failed'"));
assert(backend.includes("'customer.subscription.deleted'"));
assert(backend.includes('billingPortal.sessions.create'));
assert(backend.includes('STANDARD_LIMIT = 25'));
assert(backend.includes("'Main Courses': 3") && backend.includes('Sides: 2') && backend.includes('Drinks: 2'));
assert(rules.includes('allow create, update: if false;'), 'Direct menu writes must be blocked');
assert(menu.includes('/menuItemMutation'), 'Menu mutations must use backend enforcement');
assert(admin.includes('sub-mrr') && admin.includes('sub-arr') && admin.includes('recent-upgrades-body'));
assert(publicMenu.includes("plan !== 'preview'"));
console.log('Stripe subscription regression checks passed.');
