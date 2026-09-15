import { auth, db } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import { startCheckout, openCustomerPortal, planDisplayName } from './billing.js';

function enforceQrPlan(plan) {
    const style = document.getElementById('qr-style-select');
    const logo = document.getElementById('qr-use-logo');
    if (!style) return;
    const premium = plan === 'pro';
    Array.from(style.options).forEach(option => {
        if (option.value !== 'classic') { option.disabled = !premium; option.textContent = option.textContent.replace(' 🔒','') + (!premium ? ' 🔒' : ''); }
    });
    if (!premium && style.value !== 'classic') { style.value = 'classic'; style.dispatchEvent(new Event('change', { bubbles: true })); }
    if (logo) { logo.disabled = !premium; if (!premium) logo.checked = false; logo.closest('label')?.setAttribute('title', premium ? '' : 'Logo in QR is available on Premium.'); }
}

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
    enforceQrPlan(plan);
    new MutationObserver(() => enforceQrPlan(plan)).observe(document.getElementById('qr-code-section') || document.body, { childList: true, subtree: true });
});

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
