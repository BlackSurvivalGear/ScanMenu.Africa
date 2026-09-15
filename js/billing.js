import { auth, db } from './auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

const FUNCTIONS_BASE = 'https://us-central1-scanmenuqr-884ba.cloudfunctions.net';

async function callBillingFunction(name, body = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error('Please sign in first.');
    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Billing request failed.');
    return data;
}

export async function startCheckout(plan) {
    if (!['standard', 'pro'].includes(plan)) return;
    const { url } = await callBillingFunction('createCheckoutSession', { plan });
    window.location.assign(url);
}

export async function openCustomerPortal() {
    const { url } = await callBillingFunction('createCustomerPortal');
    window.location.assign(url);
}

export async function getCurrentPlan() {
    if (!auth.currentUser) return 'preview';
    const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
    return snap.exists() ? (snap.data().plan || 'preview') : 'preview';
}

export function planDisplayName(plan) {
    return plan === 'pro' ? 'Premium' : `${String(plan || 'preview').charAt(0).toUpperCase()}${String(plan || 'preview').slice(1)}`;
}
