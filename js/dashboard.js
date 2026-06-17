import { auth, db } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { progressiveGeocode } from "./geocoding.js";
import { initMenuItems, updateMenuCurrency } from "./menu-items.js";
import { initQRManager } from "./qr-manager.js";
import { initOrders } from "./orders.js";

const userEmailEl = document.getElementById("user-email");
const userDisplayEmailEl = document.getElementById("user-display-email");
const userUidEl = document.getElementById("user-uid");
const userCreatedAtEl = document.getElementById("user-created-at");

// Restaurant elements
const bizNameEl = document.getElementById("biz-name");
const ownerNameEl = document.getElementById("owner-name");
const bizPhoneEl = document.getElementById("biz-phone");
const bizWhatsappEl = document.getElementById("biz-whatsapp");
const bizAddressEl = document.getElementById("biz-address");
const bizCurrencyEl = document.getElementById("biz-currency");
const editProfileBtn = document.getElementById("edit-profile-btn");

let menuItemsInitialized = false;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in, fetch Firestore data
        try {
            userEmailEl.innerText = user.email;
            userDisplayEmailEl.innerText = user.email.split('@')[0];
            userUidEl.innerText = user.uid;

            // Fetch User Account Info
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            let userPlan = "preview";

            if (userDoc.exists()) {
                const userData = userDoc.data();
                userPlan = userData.plan || "preview";

                // Update Plan Badge
                const planBadge = document.getElementById("plan-badge");
                if (planBadge) {
                    planBadge.innerText = userPlan.charAt(0).toUpperCase() + userPlan.slice(1);
                    planBadge.style.display = "inline-block";
                    planBadge.className = "badge"; // Reset
                    if (userPlan === "pro") planBadge.classList.add("badge-featured");
                    else if (userPlan === "standard") planBadge.classList.add("badge-available");
                    else planBadge.classList.add("badge-preview");
                }

                if (userData.createdAt) {
                    const date = userData.createdAt.toDate();
                    userCreatedAtEl.innerText = date.toLocaleString();
                } else {
                    userCreatedAtEl.innerText = "N/A";
                }
            } else {
                userCreatedAtEl.innerText = "Not found in records";
            }

            // Real-time listener for Business Profile Info
            const restDocRef = doc(db, "businesses", user.uid);
            onSnapshot(restDocRef, async (restDoc) => {
                if (!restDoc.exists()) {
                    // Migration fallback
                    const oldDocRef = doc(db, "restaurants", user.uid);
                    const oldDocSnap = await getDoc(oldDocRef);
                    if (oldDocSnap.exists()) {
                        updateUIDisplay(oldDocSnap.data(), user.uid, userPlan);
                    } else {
                        showEmptyProfile();
                    }
                } else {
                    updateUIDisplay(restDoc.data(), user.uid, userPlan);
                }
            });

            function updateUIDisplay(restData, uid, userPlan) {
                console.log("Business Currency:", restData.currencyCode);
                console.log("Currency Symbol:", restData.currencySymbol);

                bizNameEl.innerText = restData.businessName || "N/A";
                ownerNameEl.innerText = restData.ownerName || "N/A";
                bizPhoneEl.innerText = restData.phone || "N/A";
                bizWhatsappEl.innerText = restData.whatsapp || "N/A";
                bizAddressEl.innerText = restData.address || "N/A";

                const currencyCode = restData.currencyCode || "GBP";
                const currencySymbol = restData.currencySymbol || "£";

                if (bizCurrencyEl) {
                    bizCurrencyEl.innerText = `${currencyCode} (${currencySymbol})`;
                }

                // Update price input symbol in modal
                const priceCurrencySymbolEl = document.getElementById("price-currency-symbol");
                if (priceCurrencySymbolEl) {
                    priceCurrencySymbolEl.innerText = currencySymbol;
                }

                // Initialize or update menu items management
                if (!menuItemsInitialized) {
                    initMenuItems(uid, userPlan, currencySymbol);
                    menuItemsInitialized = true;
                } else {
                    updateMenuCurrency(currencySymbol);
                }

                // Show usage card
                renderUsageCard(uid, userPlan);

                // Show Verification Status
                renderVerificationStatus(restData);

                // Initialize QR Code management
                initQRManager(uid, restData.businessName, restData.logoUrl);

                // Initialize Orders management
                initOrders(uid);
            }

            function showEmptyProfile() {
                bizNameEl.innerText = "No profile found";
                ownerNameEl.innerText = "No profile found";
                bizPhoneEl.innerText = "No profile found";
                bizWhatsappEl.innerText = "No profile found";
                bizAddressEl.innerText = "No profile found";
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            userCreatedAtEl.innerText = "Error loading";
            bizNameEl.innerText = "Error loading";
        }
    }
});

/**
 * Renders the Plan Usage card
 * @param {string} uid
 * @param {string} plan
 */
async function renderUsageCard(uid, plan = "preview") {
    const usageSection = document.getElementById("plan-usage-section");
    if (!usageSection) return;

    try {
        const q = query(
            collection(db, "menuItems"),
            where("restaurantId", "==", uid)
        );
        const querySnapshot = await getDocs(q);

        const usage = {
            "Main Courses": 0,
            "Drinks": 0,
            "Starters": 0,
            "Desserts": 0,
            "Sides": 0,
            "Specials": 0,
            "Custom Categories": 0
        };

        let totalItems = 0;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            totalItems++;
            const normalized = getNormalizedCategory(data.category);
            if (normalized) {
                if (usage.hasOwnProperty(normalized)) {
                    usage[normalized]++;
                } else {
                    usage["Custom Categories"]++;
                }
            } else if (data.category) {
                usage["Custom Categories"]++;
            }
        });

        const isPreview = plan === "preview";
        const isStandard = plan === "standard";
        const isPro = plan === "pro";

        let headerTitle = "Menu Usage";
        let badgeText = "Pro Plan";
        let badgeClass = "badge-featured";

        if (isPreview) {
            headerTitle = "Preview Plan Usage";
            badgeText = "Preview Plan";
            badgeClass = "";
        } else if (isStandard) {
            headerTitle = "Standard Plan Usage";
            badgeText = "Standard Plan";
            badgeClass = "badge-available";
        } else if (isPro) {
            headerTitle = "Pro Plan Usage";
            badgeText = "Current Plan: Pro";
            badgeClass = "badge-featured";
        }

        let usageHTML = `
            <div class="usage-header">
                <h3 style="margin-bottom: 0;">${headerTitle}</h3>
                <span class="badge ${badgeClass}">${badgeText}</span>
            </div>
        `;

        if (isStandard) {
            let limitWarning = "";
            if (totalItems >= 50) {
                limitWarning = `<p style="color: var(--error-color); font-weight: 600; margin-top: 0.5rem;">You've reached your Standard Plan limit of 50 menu items. Upgrade to Pro for unlimited items.</p>`;
            } else if (totalItems >= 40) {
                limitWarning = `<p style="color: var(--accent-orange); font-weight: 600; margin-top: 0.5rem;">You're approaching your Standard Plan limit (${totalItems}/50).</p>`;
            }

            usageHTML += `
                <div class="stat-card-compact" style="margin-bottom: 1rem; border-color: ${totalItems >= 45 ? 'var(--error-color)' : 'var(--border-color)'}">
                    <div class="stat-label-compact">Total Menu Items</div>
                    <div class="stat-value-compact" style="font-size: 1.5rem;">${totalItems} / 50</div>
                    ${limitWarning}
                </div>
            `;
        }

        usageHTML += `
            <div class="usage-container">
                <div class="usage-row">
                    <div class="stat-card-compact">
                        <div class="stat-label-compact">Main Courses</div>
                        <div class="stat-value-compact">${usage["Main Courses"]}${isPreview ? ' / 4' : ''}</div>
                    </div>
                    <div class="stat-card-compact">
                        <div class="stat-label-compact">Starters</div>
                        <div class="stat-value-compact">${usage["Starters"]}${isPreview ? ' / 2' : ''}</div>
                    </div>
                    <div class="stat-card-compact">
                        <div class="stat-label-compact">Drinks</div>
                        <div class="stat-value-compact">${usage["Drinks"]}${isPreview ? ' / 2' : ''}</div>
                    </div>
                    <div class="stat-card-compact">
                        <div class="stat-label-compact">Desserts</div>
                        <div class="stat-value-compact">${usage["Desserts"]}${isPreview ? ' / 2' : ''}</div>
                    </div>
                </div>
                <div class="usage-row">
                    <div class="stat-card-compact ${isPreview ? 'locked-stat' : ''}" style="cursor: ${isPreview ? 'pointer' : 'default'};">
                        <div class="stat-label-compact">${isPreview ? '🔒 ' : ''}Sides</div>
                        <div class="stat-value-compact">${usage["Sides"]}${isPreview ? ' / 0' : ''}</div>
                    </div>
                    <div class="stat-card-compact ${isPreview ? 'locked-stat' : ''}" style="cursor: ${isPreview ? 'pointer' : 'default'};">
                        <div class="stat-label-compact">${isPreview ? '🔒 ' : ''}Specials</div>
                        <div class="stat-value-compact">${usage["Specials"]}${isPreview ? ' / 0' : ''}</div>
                    </div>
                    <div class="stat-card-compact ${(isPreview || isStandard) ? 'locked-stat' : ''}" style="cursor: ${(isPreview || isStandard) ? 'pointer' : 'default'};">
                        <div class="stat-label-compact">${(isPreview || isStandard) ? '🔒 ' : ''}Custom Categories</div>
                        <div class="stat-value-compact">${usage["Custom Categories"]}${(isPreview || isStandard) ? ' / 0' : ''}</div>
                    </div>
                </div>
            </div>
        `;

        if (isPreview) {
            usageHTML += `<p style="margin-bottom: 0; font-size: 0.875rem; margin-top: 0.75rem;">Upgrade to Standard or Pro to unlock more menu items and advanced categories.</p>`;
        } else if (isStandard) {
            usageHTML += `<p style="margin-bottom: 0; font-size: 0.875rem; margin-top: 0.75rem;">Upgrade to Pro to unlock unlimited menu items and custom categories.</p>`;
        }

        usageSection.innerHTML = usageHTML;

        // Set up upgrade modal buttons
        const upgradeStandardBtn = document.getElementById('upgrade-standard-btn');
        const upgradeProBtn = document.getElementById('upgrade-pro-btn');

        if (upgradeStandardBtn) {
            upgradeStandardBtn.onclick = () => window.open("https://www.paypal.com/ncp/payment/PU2EMNU3XNUJN", "_blank");
        }
        if (upgradeProBtn) {
            upgradeProBtn.onclick = () => window.open("https://www.paypal.com/ncp/payment/B3FM4VTP4UPXE", "_blank");
        }

        // Add event listeners to locked stats
        usageSection.querySelectorAll('.locked-stat').forEach(el => {
            el.addEventListener('click', () => {
                const modal = document.getElementById('upgrade-modal');
                if (modal) {
                    const titleEl = document.getElementById('upgrade-modal-title');
                    const descEl = document.getElementById('upgrade-modal-description');

                    if (el.innerText.includes("Custom")) {
                        if (titleEl) titleEl.innerText = "Upgrade to Pro";
                        if (descEl) descEl.innerText = "Unlock custom categories with ScanMenu.Africa Pro.";
                        if (upgradeStandardBtn) upgradeStandardBtn.classList.add('hidden');
                        if (upgradeProBtn) upgradeProBtn.classList.remove('hidden');
                    } else {
                        if (titleEl) titleEl.innerText = "Upgrade Your Plan";
                        if (descEl) descEl.innerText = "Unlock advanced menu categories with ScanMenu.Africa Standard or Pro.";

                        if (plan === "preview") {
                            if (upgradeStandardBtn) upgradeStandardBtn.classList.remove('hidden');
                            if (upgradeProBtn) upgradeProBtn.classList.remove('hidden');
                        } else if (plan === "standard") {
                            if (upgradeStandardBtn) upgradeStandardBtn.classList.add('hidden');
                            if (upgradeProBtn) upgradeProBtn.classList.remove('hidden');
                        }
                    }

                    modal.classList.remove('hidden');
                }
            });
        });

        usageSection.classList.remove("hidden");
    } catch (error) {
        console.error("Error rendering usage card:", error);
    }
}

/**
 * Renders the Verification Status card
 * @param {object} restData
 */
function renderVerificationStatus(restData) {
    const section = document.getElementById("verification-status-section");
    const statusValue = document.getElementById("business-status-value");
    const statusDesc = document.getElementById("business-status-desc");

    if (!section || !statusValue || !statusDesc) return;

    let statusText = "Pending Verification";
    let statusDescription = "Your business is visible on the Melanin Map™. An admin will review and verify your listing soon.";
    let color = "var(--accent-orange)";

    if (restData.status === "location_issue") {
        statusText = "Needs Attention";
        statusDescription = "There is an issue with your business location. Please verify your address and update your map location.";
        color = "var(--error-color)";
    } else if (restData.verified) {
        statusText = "Verified";
        statusDescription = "Your business is verified! A green marker is displayed on the Melanin Map™.";
        color = "var(--success-color)";
    }

    statusValue.innerText = statusText;
    statusValue.style.color = color;
    statusDesc.innerText = statusDescription;
    section.classList.remove("hidden");
}

/**
 * Normalizes category name (duplicated from menu-items.js for dashboard display)
 */
function getNormalizedCategory(category) {
    if (!category) return null;
    const cat = category.toLowerCase().trim();
    if (cat === "main" || cat === "mains" || cat === "main courses" || cat === "main course") return "Main Courses";
    if (cat === "starter" || cat === "starters") return "Starters";
    if (cat === "drink" || cat === "drinks") return "Drinks";
    if (cat === "dessert" || cat === "desserts") return "Desserts";
    if (cat === "side" || cat === "sides") return "Sides";
    if (cat === "special" || cat === "specials") return "Specials";
    return null;
}

const cancelUpgradeBtn = document.getElementById("cancel-upgrade-btn");
if (cancelUpgradeBtn) {
    cancelUpgradeBtn.addEventListener("click", () => {
        const modal = document.getElementById('upgrade-modal');
        if (modal) modal.classList.add('hidden');
    });
}

if (editProfileBtn) {
    editProfileBtn.addEventListener("click", () => {
        window.location.href = "restaurant.html?edit=true";
    });
}

const geocodeBtn = document.getElementById("geocode-business-btn");
const geocodeError = document.getElementById("geocode-error");
const geocodeSuccess = document.getElementById("geocode-success");

if (geocodeBtn) {
    geocodeBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;

        geocodeBtn.disabled = true;
        const originalText = geocodeBtn.innerText;
        geocodeBtn.innerText = "📍 Geocoding...";
        geocodeError.classList.add("hidden");
        geocodeSuccess.classList.add("hidden");

        try {
            const docRef = doc(db, "businesses", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const { address, city, country } = data;

                if (!address || !city || !country) {
                    throw new Error("Business address, city, or country is missing.");
                }

                const coords = await progressiveGeocode(address, city, country, 'ScanMenu Africa Melanin Map');

                if (coords) {
                    const lat = coords.lat;
                    const lon = coords.lon;

                    await updateDoc(docRef, {
                        latitude: lat,
                        longitude: lon,
                        updatedAt: serverTimestamp()
                    });

                    console.log("Coordinates saved:", lat, lon);
                    geocodeSuccess.innerText = "Location updated successfully! Your business is now correctly placed on the Melanin Map.";
                    geocodeSuccess.classList.remove("hidden");
                } else {
                    throw new Error("Unable to determine your location. Please verify your address in profile settings.");
                }
            } else {
                throw new Error("Business profile not found.");
            }
        } catch (error) {
            console.error("Geocoding error:", error);
            geocodeError.innerText = error.message || "An error occurred during geocoding.";
            geocodeError.classList.remove("hidden");
        } finally {
            geocodeBtn.disabled = false;
            geocodeBtn.innerText = originalText;
        }
    });
}
