import { auth, db } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const paypalModal = document.getElementById("paypal-modal");
const paypalModalTitle = document.getElementById("paypal-modal-title");
const paypalContinueBtn = document.getElementById("paypal-continue-btn");
const closeModalBtns = [
    document.getElementById("close-modal"),
    document.getElementById("close-modal-btn")
];
const upgradeBtns = document.querySelectorAll(".upgrade-btn");

let userPlan = "preview";
let selectedPlanLink = "";

const PAYPAL_LINKS = {
    standard: "https://www.paypal.com/ncp/payment/PU2EMNU3XNUJN",
    pro: "https://www.paypal.com/ncp/payment/B3FM4VTP4UPXE"
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                userPlan = userDoc.data().plan || "preview";
            }

            updateUIForCurrentPlan(userPlan);
        } catch (error) {
            console.error("Error fetching user plan:", error);
            updateUIForCurrentPlan("preview");
        }
    } else {
        // User not logged in, they can see the plans but clicking upgrade will prompt login
        updateUIForCurrentPlan(null);
    }
});

function updateUIForCurrentPlan(plan) {
    upgradeBtns.forEach(btn => {
        const btnPlan = btn.getAttribute("data-plan");

        if (plan === btnPlan) {
            btn.innerText = "Current Plan";
            btn.disabled = true;
            btn.classList.remove("btn-primary", "btn-secondary");
            btn.classList.add("btn-outline");

            // Highlight current plan card
            const card = document.getElementById(`card-${btnPlan}`);
            if (card) {
                card.style.borderColor = "var(--primary-color)";
                card.style.backgroundColor = "rgba(0, 135, 81, 0.02)";
            }
        } else {
            // If user is on a higher plan, show "Current Plan" (implicitly, but here we just handle upgrade)
            // or if they are on "standard" and looking at "preview", maybe still disabled
            const planWeights = { "preview": 1, "standard": 2, "pro": 3 };
            if (plan && planWeights[btnPlan] < planWeights[plan]) {
                btn.innerText = "Included";
                btn.disabled = true;
                btn.classList.remove("btn-primary", "btn-secondary");
                btn.classList.add("btn-outline");
            } else {
                if (btnPlan === "standard") {
                    btn.innerText = "Upgrade to Standard";
                } else if (btnPlan === "pro") {
                    btn.innerText = "Upgrade to Pro";
                } else {
                    btn.innerText = "Upgrade";
                }
                btn.disabled = false;
            }
        }
    });
}

function handleUpgrade(plan) {
    if (!auth.currentUser) {
        window.location.href = "login.html?mode=register";
        return;
    }

    if (plan === "preview" || !PAYPAL_LINKS[plan]) return;

    selectedPlanLink = PAYPAL_LINKS[plan];

    if (paypalModal) {
        if (paypalModalTitle) {
            paypalModalTitle.innerText = `Upgrade to ${plan.charAt(0).toUpperCase() + plan.slice(1)}?`;
        }
        paypalModal.classList.remove("hidden");
    } else {
        window.open(selectedPlanLink, "_blank");
    }
}

if (paypalContinueBtn) {
    paypalContinueBtn.addEventListener("click", () => {
        if (selectedPlanLink) {
            window.open(selectedPlanLink, "_blank");
            if (paypalModal) paypalModal.classList.add("hidden");
        }
    });
}

upgradeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        const targetPlan = btn.getAttribute("data-plan");
        handleUpgrade(targetPlan);
    });
});

closeModalBtns.forEach(btn => {
    if (btn) {
        btn.addEventListener("click", () => {
            if (paypalModal) paypalModal.classList.add("hidden");
        });
    }
});

// Close modal when clicking outside
window.addEventListener("click", (e) => {
    if (e.target === paypalModal) {
        paypalModal.classList.add("hidden");
    }
});
