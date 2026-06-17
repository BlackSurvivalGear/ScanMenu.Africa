import { auth, db } from "./auth.js";
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    getDocs,
    serverTimestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

// DOM Elements
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

/**
 * Attaches event listeners once
 */
function attachEventListeners() {
    if (listenersAttached) return;

    if (addMenuItemBtn) {
        addMenuItemBtn.addEventListener("click", () => openModal());
    }

    if (cancelItemBtn) {
        cancelItemBtn.addEventListener("click", closeModal);
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", closeModal);
    }

    if (closeUpgradeModalBtn) {
        closeUpgradeModalBtn.addEventListener("click", () => {
            upgradeModal.classList.add("hidden");
        });
    }

    if (menuItemForm) {
        menuItemForm.addEventListener("submit", handleFormSubmit);
    }

    if (categorySelect) {
        categorySelect.addEventListener("change", handleCategoryChange);
    }

    listenersAttached = true;
}

/**
 * Initializes the Menu Builder
 * @param {string} uid
 * @param {string} plan
 * @param {string} currencySymbol
 */
export function initMenuItems(uid, plan = "preview", currencySymbol = "£") {
    currentUserId = uid;
    currentUserPlan = plan;
    currentCurrencySymbol = currencySymbol;

    attachEventListeners();
    fetchMenuItems();
}

/**
 * Updates the currency symbol and re-renders menu items
 * @param {string} newSymbol
 */
export function updateMenuCurrency(newSymbol) {
    currentCurrencySymbol = newSymbol;
    fetchMenuItems();
}

/**
 * Opens the modal for adding or editing
 * @param {Object|null} item - Item to edit, or null for new item
 */
function openModal(item = null) {
    menuItemForm.reset();
    document.getElementById("item-id").value = item ? item.id : "";
    modalTitle.innerText = item ? "Edit Menu Item" : "Add Menu Item";

    // Update category options based on plan
    if (categorySelect) {
        Array.from(categorySelect.options).forEach(option => {
            const isProCategory = ["custom"].includes(option.value);
            const isStandardCategory = ["Sides", "Specials"].includes(option.value);

            let isLocked = false;
            if (currentUserPlan === "preview" && (isStandardCategory || isProCategory)) {
                isLocked = true;
            } else if (currentUserPlan === "standard" && isProCategory) {
                isLocked = true;
            }

            if (isLocked) {
                if (!option.text.includes("🔒")) {
                    option.text = option.text + " 🔒";
                }
            } else {
                option.text = option.text.replace(" 🔒", "");
            }
        });
    }

    if (item) {
        document.getElementById("item-name").value = item.name || "";
        document.getElementById("item-description").value = item.description || "";
        document.getElementById("item-price").value = item.price || "";

        const standardCategories = ["Main Courses", "Starters", "Drinks", "Desserts", "Sides", "Specials"];
        if (standardCategories.includes(item.category)) {
            categorySelect.value = item.category;
            customCategoryGroup.classList.add("hidden");
        } else {
            categorySelect.value = "custom";
            customCategoryGroup.classList.remove("hidden");
            document.getElementById("custom-category").value = item.category || "";
        }

        document.getElementById("item-available").checked = item.available !== false;
        document.getElementById("item-featured").checked = !!item.featured;
    } else {
        categorySelect.value = "Main Courses";
        customCategoryGroup.classList.add("hidden");
        document.getElementById("item-available").checked = true;
        document.getElementById("item-featured").checked = false;
    }

    previousCategory = categorySelect.value;
    menuItemModal.classList.remove("hidden");
}

/**
 * Closes the modal
 */
function closeModal() {
    menuItemModal.classList.add("hidden");
    menuItemForm.reset();
}

/**
 * Handles category dropdown changes
 */
function handleCategoryChange() {
    const selectedValue = categorySelect.value;
    const isProCategory = ["custom"].includes(selectedValue);
    const isStandardCategory = ["Sides", "Specials"].includes(selectedValue);

    let isLocked = false;
    if (currentUserPlan === "preview" && (isStandardCategory || isProCategory)) {
        isLocked = true;
    } else if (currentUserPlan === "standard" && isProCategory) {
        isLocked = true;
    }

    if (isLocked) {
        categorySelect.value = previousCategory;
        const msg = selectedValue === "custom"
            ? "Upgrade to Pro to unlock custom categories!"
            : "Upgrade to Standard or Pro to unlock advanced menu categories!";
        showUpgradeModal(msg);
        return;
    }

    previousCategory = selectedValue;

    if (selectedValue === "custom") {
        customCategoryGroup.classList.remove("hidden");
    } else {
        customCategoryGroup.classList.add("hidden");
    }
}

/**
 * Shows the Pro upgrade modal
 */
function showUpgradeModal(customMessage) {
    if (upgradeModal) {
        const titleEl = document.getElementById('upgrade-modal-title');
        const descEl = document.getElementById('upgrade-modal-description');
        const upgradeStandardBtn = document.getElementById('upgrade-standard-btn');
        const upgradeProBtn = document.getElementById('upgrade-pro-btn');

        if (customMessage) {
            if (descEl) descEl.innerText = customMessage;
        }

        if (customMessage && customMessage.includes("Pro")) {
            if (titleEl) titleEl.innerText = "Upgrade to Pro";
            if (upgradeStandardBtn) upgradeStandardBtn.classList.add('hidden');
            if (upgradeProBtn) upgradeProBtn.classList.remove('hidden');
        } else {
            if (titleEl) titleEl.innerText = "Upgrade Your Plan";
            if (currentUserPlan === "preview") {
                if (upgradeStandardBtn) upgradeStandardBtn.classList.remove('hidden');
                if (upgradeProBtn) upgradeProBtn.classList.remove('hidden');
            } else if (currentUserPlan === "standard") {
                if (upgradeStandardBtn) upgradeStandardBtn.classList.add('hidden');
                if (upgradeProBtn) upgradeProBtn.classList.remove('hidden');
            }
        }

        // Set up upgrade modal buttons if they haven't been (though dashboard.js should handle it, we ensure here)
        if (upgradeStandardBtn) {
            upgradeStandardBtn.onclick = () => window.open("https://www.paypal.com/ncp/payment/PU2EMNU3XNUJN", "_blank");
        }
        if (upgradeProBtn) {
            upgradeProBtn.onclick = () => window.open("https://www.paypal.com/ncp/payment/B3FM4VTP4UPXE", "_blank");
        }

        upgradeModal.classList.remove("hidden");
    } else {
        alert(customMessage || "Upgrade to Pro to unlock advanced menu categories!");
    }
}

/**
 * Handles form submission for both add and edit
 * @param {Event} e
 */
async function handleFormSubmit(e) {
    e.preventDefault();

    const itemId = document.getElementById("item-id").value;
    const name = document.getElementById("item-name").value.trim();
    const description = document.getElementById("item-description").value.trim();
    const price = parseFloat(document.getElementById("item-price").value);

    let category = categorySelect.value;
    if (category === "custom") {
        category = document.getElementById("custom-category").value.trim() || "Other";
    }

    const available = document.getElementById("item-available").checked;
    const featured = document.getElementById("item-featured").checked;

    if (!name || isNaN(price)) {
        showError("Please fill in all required fields and provide a valid price.");
        return;
    }

    const itemData = {
        restaurantId: currentUserId,
        name,
        description,
        price,
        category,
        available,
        featured,
        updatedAt: serverTimestamp()
    };

    // Plan validation
    if (currentUserPlan !== "pro") {
        const normalizedCategory = getNormalizedCategory(category);
        const isStandardCategory = ["Sides", "Specials"].includes(category);
        const isProCategory = categorySelect.value === "custom" || (!normalizedCategory && !isStandardCategory);

        // Category checks
        if (currentUserPlan === "preview" && (isStandardCategory || isProCategory)) {
            showUpgradeModal("Upgrade to Standard or Pro to unlock advanced menu categories!");
            return;
        }
        if (currentUserPlan === "standard" && isProCategory) {
            showUpgradeModal("Upgrade to Pro to unlock custom categories!");
            return;
        }

        // Limit checks
        try {
            const q = query(
                collection(db, "menuItems"),
                where("restaurantId", "==", currentUserId)
            );
            const querySnapshot = await getDocs(q);

            const items = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            const totalCount = items.length;
            const isEdit = !!itemId;

            if (currentUserPlan === "preview") {
                if (normalizedCategory) {
                    const limits = {
                        "Main Courses": 4,
                        "Drinks": 2,
                        "Starters": 2,
                        "Desserts": 2
                    };
                    const limit = limits[normalizedCategory];
                    const categoryCount = items.filter(it => getNormalizedCategory(it.category) === normalizedCategory).length;

                    let isAlreadyInThisCategory = false;
                    if (isEdit) {
                        const existingItem = items.find(it => it.id === itemId);
                        if (existingItem && getNormalizedCategory(existingItem.category) === normalizedCategory) {
                            isAlreadyInThisCategory = true;
                        }
                    }

                    if (!isAlreadyInThisCategory && categoryCount >= limit) {
                        showError(`You've reached the Preview Plan limit for ${normalizedCategory} (${limit}). Upgrade to Standard or Pro for more items.`);
                        showUpgradeModal("Upgrade to Standard or Pro to unlock more menu items!");
                        return;
                    }
                }
            } else if (currentUserPlan === "standard") {
                let isAlreadyExisting = false;
                if (isEdit) {
                    isAlreadyExisting = items.some(it => it.id === itemId);
                }

                if (!isAlreadyExisting && totalCount >= 50) {
                    showError(`You've reached the Standard Plan limit of 50 menu items. Upgrade to Pro for unlimited items.`);
                    showUpgradeModal("You've reached your Standard Plan limit of 50 menu items. Upgrade to Pro for unlimited items!");
                    return;
                }
            }
        } catch (error) {
            console.error("Error checking plan limits:", error);
        }
    }

    // Debug logging
    console.log("auth.currentUser.uid:", auth.currentUser ? auth.currentUser.uid : "null");
    console.log("menu item payload:", itemData);
    console.log("restaurantId value:", itemData.restaurantId);
    console.log("price value:", itemData.price);
    console.log("price type:", typeof itemData.price);

    try {
        if (itemId) {
            // Update
            await updateDoc(doc(db, "menuItems", itemId), itemData);
            showSuccess("Menu item updated successfully!");
        } else {
            // Create
            itemData.createdAt = serverTimestamp();
            await addDoc(collection(db, "menuItems"), itemData);
            showSuccess("Menu item added successfully!");
        }

        closeModal();
        fetchMenuItems();
    } catch (error) {
        console.error("Detailed Error saving menu item:", error);
        // Expose raw error message for debugging as requested
        showError(`Firebase Error: ${error.message || error.code || "Unknown error"}`);
    }
}

/**
 * Fetches menu items from Firestore
 */
async function fetchMenuItems() {
    if (!currentUserId || !menuItemsList) return;

    try {
        const q = query(
            collection(db, "menuItems"),
            where("restaurantId", "==", currentUserId)
        );

        const querySnapshot = await getDocs(q);
        const items = [];
        querySnapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
        });

        renderMenuItems(items);
    } catch (error) {
        console.error("Error fetching menu items:", error);
        showError(getFriendlyErrorMessage(error));
    }
}

/**
 * Renders the menu items in the dashboard
 * @param {Array} items
 */
function renderMenuItems(items) {
    console.log("Rendering Menu With:", currentCurrencySymbol);
    menuItemsList.innerHTML = "";

    if (items.length === 0) {
        menuItemsList.innerHTML = '<p class="text-muted">No menu items added yet. Click the button above to create your first item!</p>';
        return;
    }

    items.forEach(item => {
        const card = document.createElement("div");
        card.className = "menu-item-card";

        // Header
        const header = document.createElement("div");
        header.className = "menu-item-header";
        const nameSpan = document.createElement("span");
        nameSpan.className = "menu-item-name";
        nameSpan.textContent = item.name;
        const priceSpan = document.createElement("span");
        priceSpan.className = "menu-item-price";
        priceSpan.textContent = `${currentCurrencySymbol}${item.price.toFixed(2)}`;
        header.appendChild(nameSpan);
        header.appendChild(priceSpan);

        // Category
        const categoryDiv = document.createElement("div");
        categoryDiv.className = "menu-item-category";
        categoryDiv.textContent = item.category;

        // Description
        const descDiv = document.createElement("div");
        descDiv.className = "menu-item-description";
        descDiv.textContent = item.description || "";

        // Badges
        const badgesDiv = document.createElement("div");
        badgesDiv.className = "menu-item-badges";
        const availBadge = document.createElement("span");
        availBadge.className = `badge ${item.available ? 'badge-available' : 'badge-unavailable'}`;
        availBadge.textContent = item.available ? 'Available' : 'Unavailable';
        badgesDiv.appendChild(availBadge);
        if (item.featured) {
            const featuredBadge = document.createElement("span");
            featuredBadge.className = "badge badge-featured";
            featuredBadge.textContent = "★ Featured";
            badgesDiv.appendChild(featuredBadge);
        }

        // Actions
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "menu-item-actions";
        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-outline btn-small edit-btn";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => openModal(item));
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-outline btn-small delete-btn";
        deleteBtn.style.color = "var(--error-color)";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => handleDeleteItem(item.id));
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        card.appendChild(header);
        card.appendChild(categoryDiv);
        card.appendChild(descDiv);
        card.appendChild(badgesDiv);
        card.appendChild(actionsDiv);

        menuItemsList.appendChild(card);
    });
}

/**
 * Handles item deletion
 * @param {string} id
 */
async function handleDeleteItem(id) {
    if (confirm("Are you sure you want to delete this menu item?")) {
        try {
            await deleteDoc(doc(db, "menuItems", id));
            showSuccess("Menu item deleted successfully!");
            fetchMenuItems();
        } catch (error) {
            console.error("Error deleting item:", error);
            showError(getFriendlyErrorMessage(error));
        }
    }
}

/**
 * Error handling helper
 * @param {Error} error
 */
function getFriendlyErrorMessage(error) {
    if (error.code === 'permission-denied') {
        return "You don't have permission to perform this action.";
    }
    if (error.message && error.message.includes("network")) {
        return "Network error. Please check your connection.";
    }
    return "An unexpected error occurred. Please try again.";
}

/**
 * Shows error message
 * @param {string} message
 */
function showError(message) {
    if (menuError) {
        menuError.innerText = message;
        menuError.classList.remove("error-box");
        menuError.classList.add("error-box");
        menuError.classList.remove("hidden");
        setTimeout(() => menuError.classList.add("hidden"), 5000);
    } else {
        alert(message);
    }
}

/**
 * Normalizes category name for plan limit checks
 * @param {string} category
 * @returns {string|null}
 */
function getNormalizedCategory(category) {
    if (!category) return null;
    const cat = category.toLowerCase().trim();

    if (cat === "main" || cat === "mains" || cat === "main courses" || cat === "main course") {
        return "Main Courses";
    }
    if (cat === "starter" || cat === "starters") {
        return "Starters";
    }
    if (cat === "drink" || cat === "drinks") {
        return "Drinks";
    }
    if (cat === "dessert" || cat === "desserts") {
        return "Desserts";
    }
    if (cat === "side" || cat === "sides") {
        return "Sides";
    }
    if (cat === "special" || cat === "specials") {
        return "Specials";
    }

    return null;
}

/**
 * Shows success message
 * @param {string} message
 */
function showSuccess(message) {
    if (menuError) {
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
    } else {
        alert(message);
    }
}
