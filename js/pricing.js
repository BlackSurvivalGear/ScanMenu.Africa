import { auth, db } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import { startCheckout, planDisplayName } from './billing.js';

const upgradeBtns = document.querySelectorAll('.upgrade-btn');
const checkoutModal = document.getElementById('checkout-modal');
const checkoutModalTitle = document.getElementById('checkout-modal-title');
const checkoutModalMessage = document.getElementById('checkout-modal-message');
const checkoutContinueBtn = document.getElementById('checkout-continue-btn');
const closeModalBtns = [document.getElementById('close-modal'), document.getElementById('close-modal-btn')];
let selectedPlan = null;

onAuthStateChanged(auth, async user => {
    let plan = null;
    if (user) {
        try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            plan = snap.exists() ? (snap.data().plan || 'preview') : 'preview';
        } catch (error) {
            console.error('Unable to load current plan', error);
            plan = 'preview';
        }
    }
    updateUIForCurrentPlan(plan);
});

function updateUIForCurrentPlan(plan) {
    const weights = { preview: 1, standard: 2, pro: 3 };
    upgradeBtns.forEach(btn => {
        const target = btn.dataset.plan;
        const card = document.getElementById(`card-${target}`);
        card?.classList.remove('current-plan-card');
        if (plan === target) {
            btn.textContent = 'Current Plan';
            btn.disabled = true;
            card?.classList.add('current-plan-card');
        } else if (plan && weights[target] < weights[plan]) {
            btn.textContent = 'Included';
            btn.disabled = true;
        } else {
            btn.textContent = target === 'standard' ? 'Upgrade to Standard' : target === 'pro' ? 'Upgrade to Premium' : 'Preview';
            btn.disabled = target === 'preview';
        }
    });
}

function openCheckoutDialog(plan) {
    if (!auth.currentUser) {
        window.location.href = 'login.html?mode=register';
        return;
    }
    selectedPlan = plan;
    if (!checkoutModal) return startCheckout(plan).catch(showBillingError);
    checkoutModalTitle.textContent = `Upgrade to ${planDisplayName(plan)}?`;
    checkoutModalMessage.textContent = `Continue to secure Stripe Checkout for the ${planDisplayName(plan)} annual subscription. Your plan changes only after Stripe confirms payment.`;
    checkoutModal.classList.remove('hidden');
}

function showBillingError(error) {
    console.error(error);
    alert(error.message || 'Unable to start Stripe Checkout.');
}

upgradeBtns.forEach(btn => btn.addEventListener('click', () => openCheckoutDialog(btn.dataset.plan)));
checkoutContinueBtn?.addEventListener('click', async () => {
    if (!selectedPlan) return;
    checkoutContinueBtn.disabled = true;
    checkoutContinueBtn.textContent = 'Opening Stripe…';
    try { await startCheckout(selectedPlan); }
    catch (error) {
        checkoutContinueBtn.disabled = false;
        checkoutContinueBtn.textContent = 'Continue to Stripe';
        showBillingError(error);
    }
});
closeModalBtns.forEach(btn => btn?.addEventListener('click', () => checkoutModal?.classList.add('hidden')));
window.addEventListener('click', event => { if (event.target === checkoutModal) checkoutModal.classList.add('hidden'); });

const params = new URLSearchParams(window.location.search);
if (params.get('checkout') === 'success') {
    const notice = document.getElementById('checkout-status');
    if (notice) {
        notice.textContent = 'Payment received. Stripe is confirming your subscription; your plan will update from the verified webhook.';
        notice.classList.remove('hidden');
    }
} else if (params.get('checkout') === 'cancelled') {
    const notice = document.getElementById('checkout-status');
    if (notice) {
        notice.textContent = 'Checkout cancelled. Your current plan has not changed.';
        notice.classList.remove('hidden');
    }
}
