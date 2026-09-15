import { db } from './auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

const ANNUAL_VALUE = { standard: 9.99, pro: 19.99 };
const displayPlan = plan => plan === 'pro' ? 'Premium' : `${String(plan || 'preview').charAt(0).toUpperCase()}${String(plan || 'preview').slice(1)}`;

async function loadSubscriptionDashboard() {
    const root = document.getElementById('subscription-dashboard');
    if (!root) return;
    try {
        const snap = await getDocs(collection(db, 'users'));
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const counts = { preview: 0, standard: 0, pro: 0 };
        let active = 0, cancelled = 0, arr = 0;
        users.forEach(user => {
            const plan = ['preview','standard','pro'].includes(user.plan) ? user.plan : 'preview';
            counts[plan]++;
            if (['active','trialing'].includes(user.subscriptionStatus)) active++;
            if (user.subscriptionStatus === 'canceled' || user.cancelAtPeriodEnd) cancelled++;
            if (['active','trialing'].includes(user.subscriptionStatus)) arr += ANNUAL_VALUE[plan] || 0;
        });
        document.getElementById('sub-preview').textContent = counts.preview;
        document.getElementById('sub-standard').textContent = counts.standard;
        document.getElementById('sub-premium').textContent = counts.pro;
        document.getElementById('sub-active').textContent = active;
        document.getElementById('sub-cancelled').textContent = cancelled;
        document.getElementById('sub-mrr').textContent = `$${(arr / 12).toFixed(2)}`;
        document.getElementById('sub-arr').textContent = `$${arr.toFixed(2)}`;
        const recent = users.filter(u => u.subscriptionActivatedAt).sort((a,b) => (b.subscriptionActivatedAt?.seconds || 0) - (a.subscriptionActivatedAt?.seconds || 0)).slice(0,10);
        const body = document.getElementById('recent-upgrades-body'); body.innerHTML = '';
        if (!recent.length) body.innerHTML = '<tr><td colspan="4" style="text-align:center;">No Stripe upgrades recorded yet.</td></tr>';
        recent.forEach(user => {
            const tr = document.createElement('tr');
            const date = user.subscriptionActivatedAt?.toDate ? user.subscriptionActivatedAt.toDate().toLocaleString() : '—';
            [user.email || user.id, displayPlan(user.plan), user.subscriptionStatus || '—', date].forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.appendChild(td); });
            body.appendChild(tr);
        });
    } catch (error) {
        console.error('Subscription dashboard failed', error);
        root.querySelector('.subscription-error')?.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', loadSubscriptionDashboard);
