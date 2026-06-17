import { db } from "./auth.js";
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    serverTimestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

let currentRestaurantId = null;
let currentFilter = "new";
let orders = [];
let unsubscribeOrders = null;

const ordersListEl = document.getElementById("orders-list");
const newOrdersBadge = document.getElementById("new-orders-badge");
const filterBtns = document.querySelectorAll(".order-filter-btn");

/**
 * Initialize Orders Management
 */
export function initOrders(restaurantId) {
    currentRestaurantId = restaurantId;

    // Set up filter click listeners
    filterBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            filterBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.getAttribute("data-filter");
            renderOrders();
        });
    });

    // Start listening for orders
    startOrdersListener();
}

/**
 * Listen for orders in real-time
 */
function startOrdersListener() {
    if (unsubscribeOrders) unsubscribeOrders();

    const q = query(
        collection(db, "orders"),
        where("restaurantId", "==", currentRestaurantId),
        orderBy("createdAt", "desc")
    );

    unsubscribeOrders = onSnapshot(q, (snapshot) => {
        orders = [];
        snapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
        });

        updateNewOrdersBadge();
        renderOrders();
    }, (error) => {
        console.error("Error listening for orders:", error);
        if (ordersListEl) {
            ordersListEl.innerHTML = `<p class="error-box">Error loading orders: ${error.message}</p>`;
        }
    });
}

/**
 * Update the navigation badge with the count of 'new' orders
 */
function updateNewOrdersBadge() {
    const newCount = orders.filter(o => o.status === "new").length;
    if (newOrdersBadge) {
        if (newCount > 0) {
            newOrdersBadge.innerText = newCount;
            newOrdersBadge.classList.remove("hidden");
        } else {
            newOrdersBadge.classList.add("hidden");
        }
    }
}

/**
 * Render orders based on current filter
 */
function renderOrders() {
    if (!ordersListEl) return;

    const filteredOrders = orders.filter(o => o.status === currentFilter);

    if (filteredOrders.length === 0) {
        ordersListEl.innerHTML = `<p class="text-muted" style="padding: 2rem; text-align: center;">No ${currentFilter} orders found.</p>`;
        return;
    }

    ordersListEl.innerHTML = "";
    filteredOrders.forEach(order => {
        const orderCard = document.createElement("div");
        orderCard.className = `order-card status-${order.status}`;

        const date = order.createdAt ? order.createdAt.toDate() : new Date();
        const formattedDate = date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const itemsHtml = order.items.map(item => `
            <div class="order-item-row">
                <span class="order-item-qty">${item.quantity} ×</span>
                <span class="order-item-name">${item.name}</span>
            </div>
        `).join("");

        let actionsHtml = "";
        if (order.status === "new") {
            actionsHtml = `
                <div class="order-actions">
                    <button class="btn btn-primary btn-small" onclick="updateOrderStatus('${order.id}', 'accepted')">Accept</button>
                    <button class="btn btn-outline btn-small" style="color: var(--error-color); border-color: var(--error-color);" onclick="updateOrderStatus('${order.id}', 'cancelled')">Cancel</button>
                </div>
            `;
        } else if (order.status === "accepted") {
            actionsHtml = `
                <div class="order-actions">
                    <button class="btn btn-primary btn-small" onclick="updateOrderStatus('${order.id}', 'completed')">Complete</button>
                    <button class="btn btn-outline btn-small" onclick="updateOrderStatus('${order.id}', 'cancelled')">Cancel</button>
                </div>
            `;
        }

        orderCard.innerHTML = `
            <div class="order-header">
                <div class="order-status-badge">${order.status.toUpperCase()}</div>
                <div class="order-time">${formattedDate} at ${formattedTime}</div>
            </div>
            <div class="order-customer">
                <div class="customer-name">${order.customerName}</div>
                <div class="customer-phone">${order.customerPhone}</div>
            </div>
            <div class="order-items-list">
                ${itemsHtml}
            </div>
            <div class="order-footer">
                <div class="order-total">
                    <span class="label">Total:</span>
                    <span class="value">${order.currencySymbol}${order.subtotal.toFixed(2)}</span>
                </div>
                ${actionsHtml}
            </div>
        `;
        ordersListEl.appendChild(orderCard);
    });
}

/**
 * Update Order Status
 */
window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
            status: newStatus,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error updating order status:", error);
        alert("Failed to update order status.");
    }
};
