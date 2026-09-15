import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';
import firebaseConfig from './firebase-config.js';

const app = getApps()[0] || initializeApp(firebaseConfig);
const db = getFirestore(app);
const uid = new URLSearchParams(window.location.search).get('id');

async function applyPublicEntitlements() {
    if (!uid) return;
    const snap = await getDoc(doc(db, 'businesses', uid));
    const plan = snap.exists() ? (snap.data().billingPlan || 'preview') : 'preview';
    if (plan !== 'preview') return;
    const enforce = () => {
        document.getElementById('res-whatsapp')?.classList.add('hidden');
        document.getElementById('cart-panel')?.classList.add('hidden');
        document.getElementById('mobile-cart-summary')?.classList.add('hidden');
        document.querySelectorAll('.btn-add-order').forEach(button => button.remove());
    };
    enforce();
    new MutationObserver(enforce).observe(document.getElementById('menu-layout') || document.body, { childList: true, subtree: true });
}

applyPublicEntitlements().catch(error => console.error('Public entitlement check failed', error));
