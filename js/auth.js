import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    reload,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const btnText = document.getElementById("btn-text");
const btnLoader = document.getElementById("btn-loader");
const errorMessage = document.getElementById("error-message");
const toggleAuthBtn = document.getElementById("toggle-auth");
const passwordHint = document.getElementById("password-hint");
const googleSignInBtn = document.getElementById("google-signin-btn");
const verificationMessage = document.getElementById("verification-message");

let isRegisterMode = false;
let isRedirectingAfterAuth = false;

const urlParams = new URLSearchParams(window.location.search);
const returnedFromVerification = urlParams.get("verified") === "1";
if (urlParams.get("mode") === "register") setAuthMode(true);

function setAuthMode(isRegister) {
    isRegisterMode = isRegister;
    if (!authTitle) return;
    if (isRegisterMode) {
        authTitle.innerText = "Create Account";
        authSubtitle.innerText = "Join ScanMenu.Africa today!";
        btnText.innerText = "Create Account";
        const switchTextEl = document.getElementById("switch-text");
        if (switchTextEl) {
            switchTextEl.innerHTML = `Already have an account? <a href="#" id="toggle-auth">Sign In</a>`;
            document.getElementById("toggle-auth").addEventListener("click", toggleMode);
        }
        passwordHint?.classList.remove("hidden");
    } else {
        authTitle.innerText = "Sign In";
        authSubtitle.innerText = "Welcome back! Please enter your details.";
        btnText.innerText = "Sign In";
        const switchTextEl = document.getElementById("switch-text");
        if (switchTextEl) {
            switchTextEl.innerHTML = `Don't have an account? <a href="#" id="toggle-auth">Create Account</a>`;
            document.getElementById("toggle-auth").addEventListener("click", toggleMode);
        }
        passwordHint?.classList.add("hidden");
    }
    errorMessage?.classList.add("hidden");
    verificationMessage?.classList.add("hidden");
}

function toggleMode(e) {
    e.preventDefault();
    setAuthMode(!isRegisterMode);
}

toggleAuthBtn?.addEventListener("click", toggleMode);

function getFriendlyErrorMessage(errorCode) {
    switch (errorCode) {
        case "auth/invalid-email": return "Please enter a valid email address.";
        case "auth/user-disabled": return "This account has been disabled.";
        case "auth/user-not-found": return "No account found with this email.";
        case "auth/wrong-password": return "Incorrect password. Please try again.";
        case "auth/email-already-in-use": return "This email is already registered.";
        case "auth/weak-password": return "Password must be at least 6 characters long.";
        case "auth/network-request-failed": return "Network error. Please check your connection.";
        case "auth/invalid-credential": return "Invalid email or password.";
        case "auth/popup-closed-by-user": return "Gmail sign-in was cancelled.";
        case "auth/popup-blocked": return "Your browser blocked the Gmail sign-in window. Please allow pop-ups and try again.";
        case "auth/operation-not-allowed": return "This sign-in method is not enabled yet.";
        default: return "An unexpected error occurred. Please try again.";
    }
}

async function ensureUserDocument(user) {
    const userRef = doc(db, "users", user.uid);
    const existing = await getDoc(userRef);
    if (!existing.exists()) {
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            plan: "preview",
            createdAt: serverTimestamp()
        });
    }
}

function showError(message) {
    if (!errorMessage) return;
    errorMessage.innerText = message;
    errorMessage.classList.remove("hidden");
}

function showVerificationMessage(title, message) {
    if (!verificationMessage) return;
    verificationMessage.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
    verificationMessage.classList.remove("hidden");
}

async function redirectAfterAuth(user) {
    await ensureUserDocument(user);
    isRedirectingAfterAuth = true;
    window.location.href = "dashboard.html";
}

if (authForm) {
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        errorMessage?.classList.add("hidden");
        verificationMessage?.classList.add("hidden");
        btnText?.classList.add("hidden");
        btnLoader?.classList.remove("hidden");
        authSubmitBtn.disabled = true;

        try {
            if (isRegisterMode) {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                await ensureUserDocument(user);
                await sendEmailVerification(user, {
                    url: `${window.location.origin}${window.location.pathname}?verified=1`,
                    handleCodeInApp: false
                });
                setAuthMode(false);
                showVerificationMessage("Check your email", "We sent you a verification link. Keep this browser signed in and open the link to continue automatically.");
            } else {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                await reload(user);
                if (!user.emailVerified) {
                    showError("Please verify your email address before signing in. Check your inbox for the verification email.");
                    return;
                }
                await redirectAfterAuth(user);
            }
        } catch (error) {
            console.error("Auth Error:", error);
            showError(getFriendlyErrorMessage(error.code));
        } finally {
            btnText?.classList.remove("hidden");
            btnLoader?.classList.add("hidden");
            authSubmitBtn.disabled = false;
        }
    });
}

googleSignInBtn?.addEventListener("click", async () => {
    errorMessage?.classList.add("hidden");
    verificationMessage?.classList.add("hidden");
    googleSignInBtn.disabled = true;
    try {
        const result = await signInWithPopup(auth, googleProvider);
        await redirectAfterAuth(result.user);
    } catch (error) {
        console.error("Gmail Auth Error:", error);
        showError(getFriendlyErrorMessage(error.code));
    } finally {
        googleSignInBtn.disabled = false;
    }
});

const logoutBtn = document.getElementById("logout-btn");
logoutBtn?.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "index.html";
    } catch (error) {
        console.error("Logout Error:", error);
    }
});

async function checkBusinessProfileExists(uid) {
    try {
        let docRef = doc(db, "businesses", uid);
        let docSnap = await getDoc(docRef);
        if (docSnap.exists()) return true;
        docRef = doc(db, "restaurants", uid);
        docSnap = await getDoc(docRef);
        return docSnap.exists();
    } catch (error) {
        console.error("Error checking business profile:", error);
        return false;
    }
}

async function checkIsAdmin(uid) {
    if (!uid) return false;
    try {
        const docSnap = await getDoc(doc(db, "admins", uid));
        return docSnap.exists();
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

async function checkIsModerator(uid) {
    if (!uid) return false;
    try {
        const docSnap = await getDoc(doc(db, "moderators", uid));
        return docSnap.exists();
    } catch (error) {
        console.error("Error checking moderator status:", error);
        return false;
    }
}

async function injectDashboardLink(uid) {
    const isAdmin = await checkIsAdmin(uid);
    const isModerator = await checkIsModerator(uid);
    if (!isAdmin && !isModerator) return;

    const navContainer = document.querySelector('nav .nav-links') || document.querySelector('nav');
    if (navContainer && !document.getElementById('admin-link')) {
        const adminLink = document.createElement('a');
        adminLink.id = 'admin-link';
        adminLink.href = 'admin.html';
        adminLink.className = 'btn btn-outline';
        adminLink.innerText = isAdmin ? 'Admin Dashboard' : 'Moderator Panel';
        const pageLogoutBtn = document.getElementById('logout-btn');
        if (pageLogoutBtn) {
            pageLogoutBtn.parentNode.insertBefore(adminLink, pageLogoutBtn);
            adminLink.style.marginRight = '1rem';
        } else {
            navContainer.appendChild(adminLink);
        }
    }
}

onAuthStateChanged(auth, async (user) => {
    const path = window.location.pathname;
    const currentPage = path.substring(path.lastIndexOf('/') + 1) || "index.html";
    if (isRedirectingAfterAuth) return;

    if (user) {
        const usesPassword = user.providerData.some(provider => provider.providerId === "password");
        if (usesPassword) {
            try {
                await reload(user);
            } catch (error) {
                console.error("Error refreshing verification status:", error);
            }
        }

        if (usesPassword && !user.emailVerified) {
            if (returnedFromVerification && currentPage === "login.html") {
                showVerificationMessage("Verification pending", "Your verification is still being confirmed. Refresh this page in a moment if you are not redirected automatically.");
            }
            if (["dashboard.html", "restaurant.html", "admin.html"].includes(currentPage)) {
                window.location.href = "login.html?verify=required";
            }
            return;
        }

        const isAdmin = await checkIsAdmin(user.uid);
        const isModerator = await checkIsModerator(user.uid);
        const profileExists = await checkBusinessProfileExists(user.uid);
        if (isAdmin || isModerator) injectDashboardLink(user.uid);

        if (currentPage === "login.html" || currentPage === "index.html") {
            if (profileExists || isAdmin || isModerator) window.location.href = "dashboard.html";
            else window.location.href = "restaurant.html";
        } else if (currentPage === "dashboard.html") {
            if (!profileExists && !isAdmin && !isModerator) window.location.href = "restaurant.html";
        } else if (currentPage === "restaurant.html") {
            const params = new URLSearchParams(window.location.search);
            const isEditMode = params.get("edit") === "true";
            if (profileExists && !isEditMode && !isAdmin && !isModerator) window.location.href = "dashboard.html";
        } else if (currentPage === "admin.html" && !isAdmin && !isModerator) {
            window.location.href = "dashboard.html";
        }
    } else if (returnedFromVerification && currentPage === "login.html") {
        setAuthMode(false);
        showVerificationMessage("Email confirmed", "Your email has been confirmed. Sign in to continue to your account.");
    } else if (["dashboard.html", "restaurant.html", "admin.html"].includes(currentPage)) {
        window.location.href = "login.html";
    }
});

export { auth, db, signOut };
