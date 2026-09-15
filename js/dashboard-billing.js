import { auth, db } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import { startCheckout, openCustomerPortal, planDisplayName } from './billing.js';

onAuthStateChanged(auth, async user => {
    if (!user) return;
    const snap = await getDoc(doc(db, 'users', user.uid));
    const data = snap.exists() ? snap.data() : {};
    const plan = data.plan || 'preview';
    const badge = document.getElementById('plan-badge');
    if (badge) badge.textContent = planDisplayName(plan);
    const manage = document.getElementById('manage-subscription-btn');
    if (manage) {
        manage.classList.toggle('hidden', !data.stripeCustomerId);
        manage.addEventListener('click', async () => {
            manage.disabled = true;
            try { await openCustomerPortal(); }
            catch (error) { alert(error.message); manage.disabled = false; }
        });
    }
});

// Capture upgrade clicks before legacy handlers so no PayPal destination can run.
document.addEventListener('click', async event => {
    const button = event.target.closest('#upgrade-standard-btn, #upgrade-pro-btn');
    if (!button) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const plan = button.id === 'upgrade-pro-btn' ? 'pro' : 'standard';
    button.disabled = true;
    const old = button.textContent; button.textContent = 'Opening Stripe…';
    try { await startCheckout(plan); }
    catch (error) { alert(error.message); button.disabled = false; button.textContent = old; }
}, true);
