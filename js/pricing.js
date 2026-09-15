import { auth, db } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const paymentModal = document.getElementById("paypal-modal");
const paymentModalTitle = document.getElementById("paypal-modal-title");
const paymentContinueBtn = document.getElementById("paypal-continue-btn");
const closeModalBtns = [document.getElementById("close-modal"), document.getElementById("close-modal-btn")];
const upgradeBtns = document.querySelectorAll(".upgrade-btn");

let userPlan = "preview";
let selectedPlanLink = "";

// Stripe sandbox Payment Links. The internal `pro` plan key is retained for compatibility;
// customers see the plan name Premium.
const PAYMENT_LINKS = {
    standard: "https://buy.stripe.com/test_bJeaEY2mEc0K3Ic7sP1ck00",
    pro: "https://buy.stripe.com/test_28EeVef9qfcWguYfZl1ck01"
};

const displayPlanName = plan => plan === "pro" ? "Premium" : plan.charAt(0).toUpperCase() + plan.slice(1);

onAuthStateChanged(auth, async user => {
    if (!user) return updateUIForCurrentPlan(null);
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) userPlan = userDoc.data().plan || "preview";
        updateUIForCurrentPlan(userPlan);
    } catch (error) {
        console.error("Error fetching user plan:", error);
        updateUIForCurrentPlan("preview");
    }
});

function updateUIForCurrentPlan(plan) {
    const weights = { preview: 1, standard: 2, pro: 3 };
    upgradeBtns.forEach(btn => {
        const target = btn.getAttribute("data-plan");
        if (plan === target) {
            btn.innerText = "Current Plan";
            btn.disabled = true;
            btn.classList.remove("btn-primary", "btn-secondary");
            btn.classList.add("btn-outline");
            const card = document.getElementById(`card-${target}`);
            if (card) {
                card.style.borderColor = "var(--primary-color)";
                card.style.backgroundColor = "rgba(0, 135, 81, 0.02)";
            }
            return;
        }
        if (plan && weights[target] < weights[plan]) {
            btn.innerText = "Included";
            btn.disabled = true;
            btn.classList.remove("btn-primary", "btn-secondary");
            btn.classList.add("btn-outline");
            return;
        }
        btn.innerText = target === "standard" ? "Upgrade to Standard" : target === "pro" ? "Upgrade to Premium" : "Upgrade";
        btn.disabled = false;
    });
}

function handleUpgrade(plan) {
    if (!auth.currentUser) {
        window.location.href = "login.html?mode=register";
        return;
    }
    if (plan === "preview" || !PAYMENT_LINKS[plan]) return;
    selectedPlanLink = PAYMENT_LINKS[plan];
    if (paymentModal) {
        if (paymentModalTitle) paymentModalTitle.innerText = `Upgrade to ${displayPlanName(plan)}?`;
        const message = document.getElementById("paypal-modal-message");
        if (message) message.innerText = `Continue to secure Stripe test checkout for the ${displayPlanName(plan)} annual subscription.`;
        if (paymentContinueBtn) paymentContinueBtn.innerText = "Continue to Stripe";
        paymentModal.classList.remove("hidden");
    } else {
        window.location.href = selectedPlanLink;
    }
}

paymentContinueBtn?.addEventListener("click", () => {
    if (selectedPlanLink) window.location.href = selectedPlanLink;
});

upgradeBtns.forEach(btn => btn.addEventListener("click", () => handleUpgrade(btn.getAttribute("data-plan"))));
closeModalBtns.forEach(btn => btn?.addEventListener("click", () => paymentModal?.classList.add("hidden")));
window.addEventListener("click", event => {
    if (event.target === paymentModal) paymentModal.classList.add("hidden");
});
