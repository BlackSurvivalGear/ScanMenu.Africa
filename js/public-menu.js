import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

// Order State
let cart = [];
let currentRestaurantData = null;

// DOM Elements
const loadingScreen = document.getElementById("loading-screen");
const menuContainer = document.getElementById("menu-container");
const errorScreen = document.getElementById("error-screen");
const menuContent = document.getElementById("menu-content");

const resName = document.getElementById("res-name");
const resAddress = document.getElementById("res-address");
const resWhatsapp = document.getElementById("res-whatsapp");
const cartPanel = document.getElementById("cart-panel");
const mobileCartSummary = document.getElementById("mobile-cart-summary");
const drawerOverlay = document.getElementById("drawer-overlay");
const menuLayout = document.getElementById("menu-layout");

const errorTitle = document.getElementById("error-title");
const errorMessage = document.getElementById("error-message");

const orderModal = document.getElementById("order-modal");
const successModal = document.getElementById("success-modal");
const orderForm = document.getElementById("order-form");

/**
 * Show error screen
 */
function showError(title, message) {
    console.log("Showing error:", title, message);
    if (loadingScreen) loadingScreen.classList.add("hidden");
    if (menuLayout) menuLayout.classList.add("hidden");
    if (mobileCartSummary) mobileCartSummary.classList.add("hidden");
    if (cartPanel) cartPanel.classList.add("hidden");
    if (drawerOverlay) drawerOverlay.classList.remove("active");
    if (errorScreen) {
        errorScreen.classList.remove("hidden");
        if (errorTitle) errorTitle.textContent = title;
        if (errorMessage) errorMessage.textContent = message;
    }
}

/**
 * Show the menu container and hide others
 */
function showMenu() {
    if (loadingScreen) loadingScreen.classList.add("hidden");
    if (errorScreen) errorScreen.classList.add("hidden");
    if (menuLayout) menuLayout.classList.remove("hidden");
}

/**
 * Fetch business details from Firestore
 */
async function fetchBusinessDetails(uid) {
    try {
        // Try businesses collection first
        let docRef = doc(firestore, "businesses", uid);
        let docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        }

        // Migration fallback
        docRef = doc(firestore, "restaurants", uid);
        docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
    } catch (e) {
        console.error("Error fetching restaurant:", e);
    }
    return null;
}

/**
 * Fetch menu items from Firestore
 */
async function fetchMenuItems(uid) {
    try {
        const q = query(
            collection(firestore, "menuItems"),
            where("restaurantId", "==", uid)
        );

        const querySnapshot = await getDocs(q);
        const items = [];
        querySnapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() });
        });

        return items;
    } catch (e) {
        console.error("Error fetching items:", e);
        return [];
    }
}

/**
 * Render restaurant details to the DOM
 */
function renderRestaurantDetails(data) {
    currentRestaurantData = data;

    // Add logo if available
    if (data.logoUrl && resName) {
        // Check if logo already exists to avoid duplication
        const existingLogo = document.querySelector(".restaurant-logo");
        if (!existingLogo) {
            const logoContainer = document.createElement("div");
            logoContainer.className = "logo-container";

            const logoImg = document.createElement("img");
            logoImg.src = data.logoUrl;
            logoImg.alt = data.businessName || "Restaurant Logo";
            logoImg.className = "restaurant-logo";

            logoContainer.appendChild(logoImg);

            // Ensure logo is at the top of the header, before the name
            const header = resName.closest('.restaurant-header');
            if (header) {
                header.prepend(logoContainer);
            } else if (resName.parentNode) {
                resName.parentNode.insertBefore(logoContainer, resName);
            }
        }
    }

    if (resName) resName.textContent = data.businessName || "Restaurant";
    if (resAddress) resAddress.textContent = data.address || "";

    if (data.whatsapp && resWhatsapp) {
        const whatsappStr = String(data.whatsapp);
        resWhatsapp.href = `https://wa.me/${whatsappStr.replace(/\D/g, '')}`;
        resWhatsapp.classList.remove("hidden");
    }
}

/**
 * Render empty menu state
 */
function renderEmptyMenu() {
    if (menuContent) {
        menuContent.innerHTML = `
            <div class="empty-state">
                <p>This restaurant has not published any menu items yet.</p>
            </div>
        `;
    }
}

/**
 * Render the full menu grouped by category
 */
function renderMenu(items) {
    // Group by category
    const grouped = items.reduce((acc, item) => {
        const cat = item.category || "Other";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    // Sort categories (optional, but good for consistency)
    const categories = Object.keys(grouped).sort();

    if (menuContent) {
        menuContent.innerHTML = "";

        categories.forEach(category => {
            const section = document.createElement("section");
            section.className = "category-section";

            const title = document.createElement("h2");
            title.className = "category-title";
            title.textContent = category;
            section.appendChild(title);

            grouped[category].forEach(item => {
                const itemEl = document.createElement("div");
                itemEl.className = "public-menu-item";
                if (item.available === false) {
                    itemEl.style.opacity = "0.7";
                }

                const itemMain = document.createElement("div");
                itemMain.className = "item-main";

                const itemTop = document.createElement("div");
                itemTop.className = "item-top";

                const itemName = document.createElement("span");
                itemName.className = "item-name";
                itemName.textContent = item.name;
                itemTop.appendChild(itemName);

                if (item.featured) {
                    const popularBadge = document.createElement("span");
                    popularBadge.className = "item-badge badge-popular";
                    popularBadge.textContent = "⭐ Popular";
                    itemTop.appendChild(popularBadge);
                }

                itemMain.appendChild(itemTop);

                if (item.description) {
                    const itemDesc = document.createElement("p");
                    itemDesc.className = "item-description";
                    itemDesc.textContent = item.description;
                    itemMain.appendChild(itemDesc);
                }

                if (item.available === false) {
                    const unavailable = document.createElement("p");
                    unavailable.className = "unavailable-text";
                    unavailable.textContent = "Currently Unavailable";
                    itemMain.appendChild(unavailable);
                }

                const itemPrice = document.createElement("div");
                itemPrice.className = "item-price";
                const priceValue = parseFloat(item.price);
                const currencySymbol = currentRestaurantData.currencySymbol || "£";
                itemPrice.textContent = `${currencySymbol}${isNaN(priceValue) ? "0.00" : priceValue.toFixed(2)}`;

                itemEl.appendChild(itemMain);

                // Order Action Container
                const actionContainer = document.createElement("div");
                actionContainer.style.display = "flex";
                actionContainer.style.flexDirection = "column";
                actionContainer.style.alignItems = "flex-end";
                actionContainer.style.gap = "0.5rem";

                actionContainer.appendChild(itemPrice);

                if (item.available !== false) {
                    const addBtn = document.createElement("button");
                    addBtn.className = "btn-add-order";
                    addBtn.textContent = "Add to Order";
                    addBtn.onclick = () => addToCart(item);
                    actionContainer.appendChild(addBtn);
                }

                itemEl.appendChild(actionContainer);
                section.appendChild(itemEl);
            });

            menuContent.appendChild(section);
        });
    }
}

/**
 * Initialize the public menu page
 */
async function init() {
    console.log("Initializing public menu...");
    const urlParams = new URLSearchParams(window.location.search);
    const restaurantUid = urlParams.get("id");

    if (!restaurantUid) {
        showError("Invalid URL", "This menu is currently unavailable.");
        return;
    }

    try {
        const restaurantData = await fetchBusinessDetails(restaurantUid);
        if (!restaurantData) {
            showError("Not Found", "This menu is currently unavailable.");
            return;
        }

        try {
            renderRestaurantDetails(restaurantData);
        } catch (e) {
            console.error("Error rendering restaurant details:", e);
        }

        const menuItems = await fetchMenuItems(restaurantUid);
        try {
            if (menuItems.length === 0) {
                renderEmptyMenu();
            } else {
                renderMenu(menuItems);
            }
        } catch (e) {
            console.error("Error rendering menu items:", e);
        }

        showMenu();
    } catch (error) {
        console.error("Error loading menu:", error);
        showError("Error", "Something went wrong while loading the menu.");
    } finally {
        // Ensure loading screen is hidden in all cases where it might have been left visible
        if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
            loadingScreen.classList.add('hidden');
        }
    }
}

// Start the application
init();

/**
 * Add an item to the cart
 */
function addToCart(item) {
    const existingItem = cart.find(i => i.id === item.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: item.id,
            name: item.name,
            price: parseFloat(item.price) || 0,
            quantity: 1
        });
    }
    renderCart();
}

/**
 * Update the quantity of an item in the cart
 */
function updateQuantity(itemId, delta) {
    const itemIndex = cart.findIndex(i => i.id === itemId);
    if (itemIndex !== -1) {
        cart[itemIndex].quantity += delta;
        if (cart[itemIndex].quantity <= 0) {
            cart.splice(itemIndex, 1);
        }
    }
    renderCart();
}

/**
 * Toggle the mobile cart drawer
 */
function toggleCartDrawer(isOpen) {
    if (isOpen) {
        if (cartPanel) cartPanel.classList.add("drawer-open");
        if (drawerOverlay) drawerOverlay.classList.add("active");
        document.body.style.overflow = "hidden"; // Prevent scrolling
    } else {
        if (cartPanel) cartPanel.classList.remove("drawer-open");
        if (drawerOverlay) drawerOverlay.classList.remove("active");
        document.body.style.overflow = ""; // Restore scrolling
    }
}

/**
 * Render the cart panel UI
 */
function renderCart() {
    if (!cartPanel) return;

    if (cart.length === 0) {
        cartPanel.classList.remove("drawer-open");
        if (mobileCartSummary) mobileCartSummary.classList.add("hidden");
        if (drawerOverlay) drawerOverlay.classList.remove("active");
        document.body.style.overflow = "";

        // On desktop, keep the panel visible but empty/hidden if desired
        // For this UI, let's hide it completely if empty
        cartPanel.classList.add("hidden");
        return;
    }

    cartPanel.classList.remove("hidden");

    let total = 0;
    let itemCount = 0;
    const currencySymbol = currentRestaurantData.currencySymbol || "£";
    const itemsHtml = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        itemCount += item.quantity;
        return `
            <div class="cart-item">
                <div class="cart-item-info">
                    <span class="cart-item-name">${item.name}</span>
                    <span class="cart-item-price">${currencySymbol}${item.price.toFixed(2)} each</span>
                </div>
                <div class="cart-item-actions">
                    <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                </div>
            </div>
        `;
    }).join("");

    // Render Full Cart Panel (Desktop sidebar / Mobile drawer)
    cartPanel.innerHTML = `
        <div class="cart-header">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <button class="close-drawer-btn" style="display: none;" onclick="toggleCartDrawer(false)">&times;</button>
                <h3 style="margin: 0;">Your Order</h3>
            </div>
            <button class="btn btn-link btn-small" onclick="clearCart()" style="color: var(--error-color)">Clear All</button>
        </div>
        <div class="cart-items">
            ${itemsHtml}
        </div>
        <div class="cart-total">
            <span>Total:</span>
            <span>${currencySymbol}${total.toFixed(2)}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.5rem;">
            <button class="btn btn-whatsapp-order" onclick="sendWhatsAppOrder()" style="margin-top: 0;">
                Order via WhatsApp
            </button>
            <button class="btn btn-primary btn-full" onclick="toggleOrderModal(true)">
                Submit Order
            </button>
        </div>
    `;

    // Show close button on mobile drawer
    if (window.innerWidth < 1024) {
        const closeBtn = cartPanel.querySelector(".close-drawer-btn");
        if (closeBtn) closeBtn.style.display = "flex";
    }

    // Render Mobile Fixed Summary
    if (mobileCartSummary) {
        mobileCartSummary.innerHTML = `
            <div class="cart-summary-info">
                <div class="cart-summary-count">${itemCount}</div>
                <span class="cart-summary-label">View Order</span>
            </div>
            <div class="cart-summary-total">${currencySymbol}${total.toFixed(2)}</div>
        `;
        mobileCartSummary.classList.remove("hidden");
        mobileCartSummary.onclick = () => toggleCartDrawer(true);
    }
}

/**
 * Clear the entire cart
 */
function clearCart() {
    cart = [];
    renderCart();
}

/**
 * Format and send the order via WhatsApp
 */
function sendWhatsAppOrder() {
    if (!currentRestaurantData || cart.length === 0) return;

    const restaurantName = currentRestaurantData.businessName || "Restaurant";
    const whatsappNumber = (currentRestaurantData.whatsapp || "").replace(/\D/g, "");

    if (!whatsappNumber) {
        alert("This restaurant doesn't have a WhatsApp number configured.");
        return;
    }

    let total = 0;
    const currencySymbol = currentRestaurantData.currencySymbol || "£";
    const itemsList = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        return `${item.quantity} × ${item.name} (${currencySymbol}${item.price.toFixed(2)})`;
    }).join("\n");

    const message = `Hello ${restaurantName},

I'd like to place the following order:

${itemsList}

Order Total: ${currencySymbol}${total.toFixed(2)}

Collection or Delivery:
Customer Name:

Thank you.`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

    window.open(whatsappUrl, "_blank");
}

// Initialize drawer overlay click
if (drawerOverlay) {
    drawerOverlay.addEventListener("click", () => toggleCartDrawer(false));
}

// Handle window resize to adjust drawer state
window.addEventListener("resize", () => {
    if (window.innerWidth >= 1024) {
        toggleCartDrawer(false);
        document.body.style.overflow = "";
    }
});

// Expose functions to window for onclick handlers in string templates
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.clearCart = clearCart;
window.sendWhatsAppOrder = sendWhatsAppOrder;
window.toggleCartDrawer = toggleCartDrawer;
window.toggleOrderModal = toggleOrderModal;
window.toggleSuccessModal = toggleSuccessModal;

/**
 * Toggle Order Submission Modal
 */
function toggleOrderModal(show) {
    if (show) {
        orderModal.classList.remove("hidden");
    } else {
        orderModal.classList.add("hidden");
    }
}

/**
 * Toggle Success Modal
 */
function toggleSuccessModal(show) {
    if (show) {
        successModal.classList.remove("hidden");
    } else {
        successModal.classList.add("hidden");
    }
}

// Handle Order Form Submission
if (orderForm) {
    orderForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const customerName = document.getElementById("customer-name").value;
        const customerPhone = document.getElementById("customer-phone").value;

        if (!customerName || !customerPhone) {
            alert("Please fill in all required fields.");
            return;
        }

        const submitBtn = orderForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const restaurantId = urlParams.get("id");

            let total = 0;
            cart.forEach(item => {
                total += item.price * item.quantity;
            });

            const orderData = {
                restaurantId: restaurantId,
                restaurantName: currentRestaurantData.businessName || "Restaurant",
                customerName: customerName,
                customerPhone: customerPhone,
                items: cart.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price
                })),
                subtotal: total,
                currencyCode: currentRestaurantData.currencyCode || "GBP",
                currencySymbol: currentRestaurantData.currencySymbol || "£",
                status: "new",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            await addDoc(collection(firestore, "orders"), orderData);

            // Success
            toggleOrderModal(false);
            toggleSuccessModal(true);
            clearCart();
            orderForm.reset();

        } catch (error) {
            console.error("Error submitting order:", error);
            alert("There was an error submitting your order. Please try again.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });
}
