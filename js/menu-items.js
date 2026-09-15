import { auth, db } from "./auth.js";
import {
    collection, doc, addDoc, updateDoc, deleteDoc, query, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const menuItemsList = document.getElementById("menu-items-list");
const menuError = document.getElementById("menu-error");
const addMenuItemBtn = document.getElementById("add-menu-item-btn");
const menuItemModal = document.getElementById("menu-item-modal");
const menuItemForm = document.getElementById("menu-item-form");
const cancelItemBtn = document.getElementById("cancel-item-btn");
const closeModalBtn = document.querySelector(".close-modal");
const modalTitle = document.getElementById("modal-title");
const categorySelect = document.getElementById("item-category");
const customCategoryGroup = document.getElementById("custom-category-group");
const upgradeModal = document.getElementById("upgrade-modal");
const closeUpgradeModalBtn = document.getElementById("close-upgrade-modal");

let currentUserId = null;
let currentUserPlan = "preview";
let currentCurrencySymbol = "£";
let previousCategory = "";
let listenersAttached = false;

const PREVIEW_LIMITS = { "Main Courses": 3, "Sides": 2, "Drinks": 2 };
const STANDARD_ITEM_LIMIT = 25;
const STANDARD_CATEGORIES = ["Main Courses", "Starters", "Drinks", "Desserts", "Sides", "Specials"];

function displayPlan(plan) {
    return plan === "pro" ? "Premium" : plan.charAt(0).toUpperCase() + plan.slice(1);
}

function attachEventListeners() {
    if (listenersAttached) return;
    addMenuItemBtn?.addEventListener("click", () => openModal());
    cancelItemBtn?.addEventListener("click", closeModal);
    closeModalBtn?.addEventListener("click", closeModal);
    closeUpgradeModalBtn?.addEventListener("click", () => upgradeModal?.classList.add("hidden"));
    menuItemForm?.addEventListener("submit", handleFormSubmit);
    categorySelect?.addEventListener("change", handleCategoryChange);
    listenersAttached = true;
}

export function initMenuItems(uid, plan = "preview", currencySymbol = "£") {
    currentUserId = uid;
    currentUserPlan = plan;
    currentCurrencySymbol = currencySymbol;
    attachEventListeners();
    fetchMenuItems();
}

export function updateMenuCurrency(newSymbol) {
    currentCurrencySymbol = newSymbol;
    fetchMenuItems();
}

function categoryAllowed(categoryValue) {
    if (currentUserPlan === "pro") return true;
    if (currentUserPlan === "standard") return categoryValue !== "custom";
    return Object.prototype.hasOwnProperty.call(PREVIEW_LIMITS, getNormalizedCategory(categoryValue));
}

function updateCategoryLocks() {
    if (!categorySelect) return;
    Array.from(categorySelect.options).forEach(option => {
        const locked = !categoryAllowed(option.value);
        option.text = option.text.replace(" 🔒", "") + (locked ? " 🔒" : "");
    });
}

function updateFeaturedGate() {
    const featured = document.getElementById("item-featured");
    if (!featured) return;
    featured.disabled = currentUserPlan !== "pro";
    if (currentUserPlan !== "pro") featured.checked = false;
    const label = featured.closest("label");
    if (label) label.title = currentUserPlan === "pro" ? "" : "Featured items are available on Premium.";
}

function openModal(item = null) {
    if (!menuItemForm) return;
    menuItemForm.reset();
    document.getElementById("item-id").value = item ? item.id : "";
    if (modalTitle) modalTitle.innerText = item ? "Edit Menu Item" : "Add Menu Item";
    updateCategoryLocks();
    updateFeaturedGate();

    if (item) {
        document.getElementById("item-name").value = item.name || "";
        document.getElementById("item-description").value = item.description || "";
        document.getElementById("item-price").value = item.price || "";
        if (STANDARD_CATEGORIES.includes(item.category)) {
            categorySelect.value = item.category;
            customCategoryGroup?.classList.add("hidden");
        } else {
            categorySelect.value = "custom";
            customCategoryGroup?.classList.remove("hidden");
            const customInput = document.getElementById("custom-category");
            if (customInput) customInput.value = item.category || "";
        }
        document.getElementById("item-available").checked = item.available !== false;
        const featured = document.getElementById("item-featured");
        if (featured) featured.checked = currentUserPlan === "pro" && !!item.featured;
    } else {
        categorySelect.value = "Main Courses";
        customCategoryGroup?.classList.add("hidden");
        document.getElementById("item-available").checked = true;
    }

    previousCategory = categorySelect.value;
    menuItemModal?.classList.remove("hidden");
}

function closeModal() {
    menuItemModal?.classList.add("hidden");
    menuItemForm?.reset();
}

function handleCategoryChange() {
    const selected = categorySelect.value;
    if (!categoryAllowed(selected)) {
        categorySelect.value = previousCategory;
        showUpgradeModal(selected === "custom"
            ? "Upgrade to Premium to unlock custom categories."
            : "Preview includes Main Courses, Sides and Drinks only. Upgrade to Standard for more categories.");
        return;
    }
    previousCategory = selected;
    customCategoryGroup?.classList.toggle("hidden", selected !== "custom");
}

function showUpgradeModal(message) {
    if (!upgradeModal) {
        alert(message || "Upgrade your ScanMenu plan to continue.");
        return;
    }
    const title = document.getElementById("upgrade-modal-title");
    const desc = document.getElementById("upgrade-modal-description");
    const standardBtn = document.getElementById("upgrade-standard-btn");
    const premiumBtn = document.getElementById("upgrade-pro-btn");
    if (title) title.innerText = currentUserPlan === "standard" ? "Upgrade to Premium" : "Upgrade Your Plan";
    if (desc) desc.innerText = message || "Choose the plan that fits your menu.";
    if (standardBtn) {
        standardBtn.classList.toggle("hidden", currentUserPlan !== "preview");
        standardBtn.onclick = () => { window.location.href = "pricing.html"; };
    }
    if (premiumBtn) {
        premiumBtn.classList.remove("hidden");
        premiumBtn.innerText = "View Premium";
        premiumBtn.onclick = () => { window.location.href = "pricing.html"; };
    }
    upgradeModal.classList.remove("hidden");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const itemId = document.getElementById("item-id").value;
    const name = document.getElementById("item-name").value.trim();
    const description = document.getElementById("item-description").value.trim();
    const price = parseFloat(document.getElementById("item-price").value);
    let category = categorySelect.value;
    if (category === "custom") category = document.getElementById("custom-category").value.trim() || "Other";
    const available = document.getElementById("item-available").checked;
    const featuredRequested = document.getElementById("item-featured")?.checked === true;

    if (!name || Number.isNaN(price)) {
        showError("Please fill in all required fields and provide a valid price.");
        return;
    }
    if (!categoryAllowed(categorySelect.value)) {
        showUpgradeModal(categorySelect.value === "custom"
            ? "Custom categories are available on Premium."
            : "Upgrade to Standard to unlock this category.");
        return;
    }
    if (featuredRequested && currentUserPlan !== "pro") {
        showUpgradeModal("Featured Menu Items are available on Premium.");
        return;
    }

    try {
        const q = query(collection(db, "menuItems"), where("restaurantId", "==", currentUserId));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const existing = itemId ? items.find(item => item.id === itemId) : null;

        if (currentUserPlan === "preview") {
            const normalized = getNormalizedCategory(category);
            const limit = PREVIEW_LIMITS[normalized];
            if (!limit) {
                showUpgradeModal("Preview includes 3 Main Courses, 2 Sides and 2 Drinks only.");
                return;
            }
            const count = items.filter(item => getNormalizedCategory(item.category) === normalized).length;
            const stayingInCategory = existing && getNormalizedCategory(existing.category) === normalized;
            if (!stayingInCategory && count >= limit) {
                showError(`Preview allows ${limit} ${normalized}. Upgrade to Standard for up to 25 menu items.`);
                showUpgradeModal("You've reached a Preview menu limit. Upgrade to Standard to continue.");
                return;
            }
        }

        if (currentUserPlan === "standard" && !existing && items.length >= STANDARD_ITEM_LIMIT) {
            showError("You've reached the Standard Plan limit of 25 menu items.");
            showUpgradeModal("Upgrade to Premium for unlimited menu items.");
            return;
        }

        const itemData = {
            restaurantId: currentUserId,
            name, description, price, category, available,
            featured: currentUserPlan === "pro" && featuredRequested,
            updatedAt: serverTimestamp()
        };

        if (itemId) {
            await updateDoc(doc(db, "menuItems", itemId), itemData);
            showSuccess("Menu item updated successfully!");
        } else {
            itemData.createdAt = serverTimestamp();
            await addDoc(collection(db, "menuItems"), itemData);
            showSuccess("Menu item added successfully!");
        }
        closeModal();
        fetchMenuItems();
    } catch (error) {
        console.error("Error saving menu item:", error);
        showError(getFriendlyErrorMessage(error));
    }
}

async function fetchMenuItems() {
    if (!currentUserId || !menuItemsList) return;
    try {
        const q = query(collection(db, "menuItems"), where("restaurantId", "==", currentUserId));
        const snapshot = await getDocs(q);
        renderMenuItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
        console.error("Error fetching menu items:", error);
        showError(getFriendlyErrorMessage(error));
    }
}

function renderMenuItems(items) {
    menuItemsList.innerHTML = "";
    if (!items.length) {
        menuItemsList.innerHTML = '<p class="text-muted">No menu items added yet. Click the button above to create your first item!</p>';
        return;
    }
    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "menu-item-card";
        const safePrice = Number(item.price || 0).toFixed(2);
        card.innerHTML = `
            <div class="menu-item-header"><span class="menu-item-name"></span><span class="menu-item-price"></span></div>
            <div class="menu-item-category"></div>
            <div class="menu-item-description"></div>
            <div class="menu-item-badges"></div>
            <div class="menu-item-actions"></div>`;
        card.querySelector(".menu-item-name").textContent = item.name || "";
        card.querySelector(".menu-item-price").textContent = `${currentCurrencySymbol}${safePrice}`;
        card.querySelector(".menu-item-category").textContent = item.category || "";
        card.querySelector(".menu-item-description").textContent = item.description || "";
        const badges = card.querySelector(".menu-item-badges");
        const availability = document.createElement("span");
        availability.className = `badge ${item.available ? "badge-available" : "badge-unavailable"}`;
        availability.textContent = item.available ? "Available" : "Unavailable";
        badges.appendChild(availability);
        if (item.featured && currentUserPlan === "pro") {
            const featured = document.createElement("span");
            featured.className = "badge badge-featured";
            featured.textContent = "★ Featured";
            badges.appendChild(featured);
        }
        const actions = card.querySelector(".menu-item-actions");
        const edit = document.createElement("button");
        edit.className = "btn btn-outline btn-small edit-btn";
        edit.textContent = "Edit";
        edit.onclick = () => openModal(item);
        const remove = document.createElement("button");
        remove.className = "btn btn-outline btn-small delete-btn";
        remove.style.color = "var(--error-color)";
        remove.textContent = "Delete";
        remove.onclick = () => handleDeleteItem(item.id);
        actions.append(edit, remove);
        menuItemsList.appendChild(card);
    });
}

async function handleDeleteItem(id) {
    if (!confirm("Are you sure you want to delete this menu item?")) return;
    try {
        await deleteDoc(doc(db, "menuItems", id));
        showSuccess("Menu item deleted successfully!");
        fetchMenuItems();
    } catch (error) {
        showError(getFriendlyErrorMessage(error));
    }
}

function getNormalizedCategory(category) {
    if (!category) return null;
    const cat = category.toLowerCase().trim();
    if (["main", "mains", "main courses", "main course"].includes(cat)) return "Main Courses";
    if (["starter", "starters"].includes(cat)) return "Starters";
    if (["drink", "drinks"].includes(cat)) return "Drinks";
    if (["dessert", "desserts"].includes(cat)) return "Desserts";
    if (["side", "sides"].includes(cat)) return "Sides";
    if (["special", "specials"].includes(cat)) return "Specials";
    return null;
}

function getFriendlyErrorMessage(error) {
    if (error?.code === "permission-denied") return "You don't have permission to perform this action.";
    if (error?.message?.includes("network")) return "Network error. Please check your connection.";
    return "An unexpected error occurred. Please try again.";
}

function showError(message) {
    if (!menuError) return alert(message);
    menuError.innerText = message;
    menuError.classList.add("error-box");
    menuError.classList.remove("hidden");
    setTimeout(() => menuError.classList.add("hidden"), 5000);
}

function showSuccess(message) {
    if (!menuError) return alert(message);
    menuError.innerText = message;
    menuError.classList.remove("error-box");
    menuError.style.backgroundColor = "#dcfce7";
    menuError.style.color = "#166534";
    menuError.classList.remove("hidden");
    setTimeout(() => {
        menuError.classList.add("hidden");
        menuError.classList.add("error-box");
        menuError.style.backgroundColor = "";
        menuError.style.color = "";
    }, 5000);
}
