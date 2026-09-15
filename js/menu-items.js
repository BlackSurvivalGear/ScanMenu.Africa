import { auth, db } from './auth.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

const FUNCTIONS_BASE = 'https://us-central1-scanmenuqr-884ba.cloudfunctions.net';
const menuItemsList = document.getElementById('menu-items-list');
const menuError = document.getElementById('menu-error');
const addMenuItemBtn = document.getElementById('add-menu-item-btn');
const menuItemModal = document.getElementById('menu-item-modal');
const menuItemForm = document.getElementById('menu-item-form');
const cancelItemBtn = document.getElementById('cancel-item-btn');
const closeModalBtn = document.querySelector('.close-modal');
const modalTitle = document.getElementById('modal-title');
const categorySelect = document.getElementById('item-category');
const customCategoryGroup = document.getElementById('custom-category-group');
const upgradeModal = document.getElementById('upgrade-modal');
const closeUpgradeModalBtn = document.getElementById('close-upgrade-modal');
let currentUserId = null;
let currentUserPlan = 'preview';
let currentCurrencySymbol = '£';
let previousCategory = '';
let listenersAttached = false;
const PREVIEW_LIMITS = { 'Main Courses': 3, Sides: 2, Drinks: 2 };
const STANDARD_CATEGORIES = ['Main Courses', 'Starters', 'Drinks', 'Desserts', 'Sides', 'Specials'];

function attachEventListeners() {
    if (listenersAttached) return;
    addMenuItemBtn?.addEventListener('click', () => openModal());
    cancelItemBtn?.addEventListener('click', closeModal);
    closeModalBtn?.addEventListener('click', closeModal);
    closeUpgradeModalBtn?.addEventListener('click', () => upgradeModal?.classList.add('hidden'));
    document.getElementById('cancel-upgrade-btn')?.addEventListener('click', () => upgradeModal?.classList.add('hidden'));
    menuItemForm?.addEventListener('submit', handleFormSubmit);
    categorySelect?.addEventListener('change', handleCategoryChange);
    listenersAttached = true;
}

export function initMenuItems(uid, plan = 'preview', currencySymbol = '£') {
    currentUserId = uid; currentUserPlan = plan; currentCurrencySymbol = currencySymbol;
    attachEventListeners(); fetchMenuItems();
}
export function updateMenuCurrency(newSymbol) { currentCurrencySymbol = newSymbol; fetchMenuItems(); }

function categoryAllowed(value) {
    if (currentUserPlan === 'pro') return true;
    if (currentUserPlan === 'standard') return value !== 'custom';
    return Object.prototype.hasOwnProperty.call(PREVIEW_LIMITS, getNormalizedCategory(value));
}
function updateCategoryLocks() {
    if (!categorySelect) return;
    Array.from(categorySelect.options).forEach(option => {
        const locked = !categoryAllowed(option.value);
        option.text = option.text.replace(' 🔒', '') + (locked ? ' 🔒' : '');
    });
}
function updateFeaturedGate() {
    const featured = document.getElementById('item-featured');
    if (!featured) return;
    featured.disabled = currentUserPlan !== 'pro';
    if (currentUserPlan !== 'pro') featured.checked = false;
    featured.closest('label')?.setAttribute('title', currentUserPlan === 'pro' ? '' : 'Featured items are available on Premium.');
}
function openModal(item = null) {
    if (!menuItemForm) return;
    menuItemForm.reset(); document.getElementById('item-id').value = item?.id || '';
    if (modalTitle) modalTitle.innerText = item ? 'Edit Menu Item' : 'Add Menu Item';
    updateCategoryLocks(); updateFeaturedGate();
    if (item) {
        document.getElementById('item-name').value = item.name || '';
        document.getElementById('item-description').value = item.description || '';
        document.getElementById('item-price').value = item.price || '';
        if (STANDARD_CATEGORIES.includes(item.category)) { categorySelect.value = item.category; customCategoryGroup?.classList.add('hidden'); }
        else { categorySelect.value = 'custom'; customCategoryGroup?.classList.remove('hidden'); document.getElementById('custom-category').value = item.category || ''; }
        document.getElementById('item-available').checked = item.available !== false;
        const featured = document.getElementById('item-featured'); if (featured) featured.checked = currentUserPlan === 'pro' && !!item.featured;
    } else { categorySelect.value = 'Main Courses'; customCategoryGroup?.classList.add('hidden'); document.getElementById('item-available').checked = true; }
    previousCategory = categorySelect.value; menuItemModal?.classList.remove('hidden');
}
function closeModal() { menuItemModal?.classList.add('hidden'); menuItemForm?.reset(); }
function handleCategoryChange() {
    const selected = categorySelect.value;
    if (!categoryAllowed(selected)) {
        categorySelect.value = previousCategory;
        showUpgradeModal(selected === 'custom' ? 'Custom Categories are a Premium feature.' : 'Preview includes Main Courses, Sides and Drinks only. Standard unlocks Starters, Desserts and Specials.');
        return;
    }
    previousCategory = selected; customCategoryGroup?.classList.toggle('hidden', selected !== 'custom');
}
function showUpgradeModal(message, targetPlan = null) {
    if (!upgradeModal) return alert(message || 'Upgrade your ScanMenu plan to continue.');
    const title = document.getElementById('upgrade-modal-title'); const desc = document.getElementById('upgrade-modal-description');
    const standardBtn = document.getElementById('upgrade-standard-btn'); const premiumBtn = document.getElementById('upgrade-pro-btn');
    const premiumOnly = targetPlan === 'pro' || currentUserPlan === 'standard';
    if (title) title.innerText = premiumOnly ? 'Upgrade to Premium' : 'Upgrade to Standard';
    if (desc) desc.innerText = message || (premiumOnly ? 'Premium unlocks this feature.' : 'Standard unlocks more menu capacity and ordering tools.');
    if (standardBtn) { standardBtn.classList.toggle('hidden', premiumOnly); standardBtn.innerText = 'Upgrade to Standard ($9.99/year)'; standardBtn.onclick = () => window.location.href = 'pricing.html'; }
    if (premiumBtn) { premiumBtn.classList.remove('hidden'); premiumBtn.innerText = 'Upgrade to Premium ($19.99/year)'; premiumBtn.onclick = () => window.location.href = 'pricing.html'; }
    upgradeModal.classList.remove('hidden');
}
async function mutateMenu(payload) {
    const user = auth.currentUser; if (!user) throw new Error('Please sign in again.');
    const token = await user.getIdToken();
    const response = await fetch(`${FUNCTIONS_BASE}/menuItemMutation`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || 'Unable to save menu item.'); error.code = data.code; error.targetPlan = data.targetPlan; throw error; }
    return data;
}
async function handleFormSubmit(e) {
    e.preventDefault();
    const itemId = document.getElementById('item-id').value;
    let category = categorySelect.value; if (category === 'custom') category = document.getElementById('custom-category').value.trim() || 'Other';
    const item = { name: document.getElementById('item-name').value.trim(), description: document.getElementById('item-description').value.trim(), price: Number(document.getElementById('item-price').value), category, available: document.getElementById('item-available').checked, featured: document.getElementById('item-featured')?.checked === true };
    if (!item.name || !Number.isFinite(item.price)) return showError('Please fill in all required fields and provide a valid price.');
    try {
        await mutateMenu({ action: itemId ? 'update' : 'create', itemId: itemId || undefined, item });
        showSuccess(itemId ? 'Menu item updated successfully!' : 'Menu item added successfully!'); closeModal(); fetchMenuItems();
    } catch (error) {
        console.error(error); showError(error.message);
        if (error.code === 'upgrade_required' || error.code === 'limit_reached') showUpgradeModal(error.message, error.targetPlan);
    }
}
async function fetchMenuItems() {
    if (!currentUserId || !menuItemsList) return;
    try { const snap = await getDocs(query(collection(db, 'menuItems'), where('restaurantId', '==', currentUserId))); renderMenuItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }
    catch (error) { console.error(error); showError('Unable to load menu items.'); }
}
function renderMenuItems(items) {
    menuItemsList.innerHTML = '';
    if (!items.length) { menuItemsList.innerHTML = '<p class="text-muted">No menu items added yet. Click the button above to create your first item!</p>'; return; }
    items.forEach(item => {
        const card = document.createElement('div'); card.className = 'menu-item-card';
        card.innerHTML = '<div class="menu-item-header"><span class="menu-item-name"></span><span class="menu-item-price"></span></div><div class="menu-item-category"></div><div class="menu-item-description"></div><div class="menu-item-badges"></div><div class="menu-item-actions"></div>';
        card.querySelector('.menu-item-name').textContent = item.name || ''; card.querySelector('.menu-item-price').textContent = `${currentCurrencySymbol}${Number(item.price || 0).toFixed(2)}`; card.querySelector('.menu-item-category').textContent = item.category || ''; card.querySelector('.menu-item-description').textContent = item.description || '';
        const badges = card.querySelector('.menu-item-badges'); const availability = document.createElement('span'); availability.className = `badge ${item.available ? 'badge-available' : 'badge-unavailable'}`; availability.textContent = item.available ? 'Available' : 'Unavailable'; badges.appendChild(availability);
        if (item.featured && currentUserPlan === 'pro') { const featured = document.createElement('span'); featured.className = 'badge badge-featured'; featured.textContent = '★ Featured'; badges.appendChild(featured); }
        const actions = card.querySelector('.menu-item-actions'); const edit = document.createElement('button'); edit.className = 'btn btn-outline btn-small edit-btn'; edit.textContent = 'Edit'; edit.onclick = () => openModal(item); const remove = document.createElement('button'); remove.className = 'btn btn-outline btn-small delete-btn'; remove.style.color = 'var(--error-color)'; remove.textContent = 'Delete'; remove.onclick = () => handleDeleteItem(item.id); actions.append(edit, remove); menuItemsList.appendChild(card);
    });
}
async function handleDeleteItem(id) {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try { await mutateMenu({ action: 'delete', itemId: id }); showSuccess('Menu item deleted successfully!'); fetchMenuItems(); }
    catch (error) { showError(error.message); }
}
function getNormalizedCategory(category) {
    if (!category) return null; const cat = category.toLowerCase().trim();
    if (['main','mains','main courses','main course'].includes(cat)) return 'Main Courses'; if (['starter','starters'].includes(cat)) return 'Starters'; if (['drink','drinks'].includes(cat)) return 'Drinks'; if (['dessert','desserts'].includes(cat)) return 'Desserts'; if (['side','sides'].includes(cat)) return 'Sides'; if (['special','specials'].includes(cat)) return 'Specials'; return null;
}
function showError(message) { if (!menuError) return alert(message); menuError.innerText = message; menuError.classList.add('error-box'); menuError.classList.remove('hidden'); setTimeout(() => menuError.classList.add('hidden'), 6000); }
function showSuccess(message) { if (!menuError) return alert(message); menuError.innerText = message; menuError.classList.remove('error-box'); menuError.style.backgroundColor = '#dcfce7'; menuError.style.color = '#166534'; menuError.classList.remove('hidden'); setTimeout(() => { menuError.classList.add('hidden'); menuError.classList.add('error-box'); menuError.style.backgroundColor = ''; menuError.style.color = ''; }, 4000); }
