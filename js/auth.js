import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements for Login/Register
const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const btnText = document.getElementById("btn-text");
const btnLoader = document.getElementById("btn-loader");
const errorMessage = document.getElementById("error-message");
const toggleAuthBtn = document.getElementById("toggle-auth");
const passwordHint = document.getElementById("password-hint");

let isRegisterMode = false;
let isRedirectingAfterAuth = false;

// Check URL parameters for registration mode
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('mode') === 'register') {
    setAuthMode(true);
}

// Function to toggle between Login and Register
function setAuthMode(isRegister) {
    isRegisterMode = isRegister;
    if (isRegisterMode) {
        authTitle.innerText = "Create Account";
        authSubtitle.innerText = "Join ScanMenu.Africa today!";
        btnText.innerText = "Create Account";
        toggleAuthBtn.innerText = "Sign In";
        const switchTextEl = document.getElementById("switch-text");
        if (switchTextEl) {
            switchTextEl.innerHTML = `Already have an account? <a href="#" id="toggle-auth">Sign In</a>`;
            document.getElementById("toggle-auth").addEventListener("click", (e) => {
                e.preventDefault();
                setAuthMode(!isRegisterMode);
            });
        }
        passwordHint.classList.remove("hidden");
    } else {
        authTitle.innerText = "Sign In";
        authSubtitle.innerText = "Welcome back! Please enter your details.";
        btnText.innerText = "Sign In";
        toggleAuthBtn.innerText = "Create Account";
        const switchTextEl = document.getElementById("switch-text");
        if (switchTextEl) {
            switchTextEl.innerHTML = `Don't have an account? <a href="#" id="toggle-auth">Create Account</a>`;
            document.getElementById("toggle-auth").addEventListener("click", (e) => {
                e.preventDefault();
                setAuthMode(!isRegisterMode);
            });
        }
        passwordHint.classList.add("hidden");
    }
    errorMessage.classList.add("hidden");
}

if (toggleAuthBtn) {
    toggleAuthBtn.addEventListener("click", (e) => {
        e.preventDefault();
        setAuthMode(!isRegisterMode);
    });
}

// Map Firebase error codes to friendly messages
function getFriendlyErrorMessage(errorCode) {
    switch (errorCode) {
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/user-disabled":
            return "This account has been disabled.";
        case "auth/user-not-found":
            return "No account found with this email.";
        case "auth/wrong-password":
            return "Incorrect password. Please try again.";
        case "auth/email-already-in-use":
            return "This email is already registered.";
        case "auth/weak-password":
            return "Password must be at least 6 characters long.";
        case "auth/network-request-failed":
            return "Network error. Please check your connection.";
        case "auth/invalid-credential":
            return "Invalid email or password.";
        default:
            return "An unexpected error occurred. Please try again.";
    }
}

// Form Submission handling
if (authForm) {
    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        // Reset UI
        errorMessage.classList.add("hidden");
        btnText.classList.add("hidden");
        btnLoader.classList.remove("hidden");
        authSubmitBtn.disabled = true;

        try {
            if (isRegisterMode) {
                // Register
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Create user document in Firestore
                await setDoc(doc(db, "users", user.uid), {
                    uid: user.uid,
                    email: user.email,
                    plan: "preview",
                    createdAt: serverTimestamp()
                });

                isRedirectingAfterAuth = true;
                window.location.href = "dashboard.html";
            } else {
                // Login
                await signInWithEmailAndPassword(auth, email, password);
                isRedirectingAfterAuth = true;
                window.location.href = "dashboard.html";
            }
        } catch (error) {
            console.error("Auth Error:", error);
            errorMessage.innerText = getFriendlyErrorMessage(error.code);
            errorMessage.classList.remove("hidden");

            // Restore UI
            btnText.classList.remove("hidden");
            btnLoader.classList.add("hidden");
            authSubmitBtn.disabled = false;
        }
    });
}

// Logout functionality
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
            // Explicitly redirect to index.html as per requirements
            window.location.href = "index.html";
        } catch (error) {
            console.error("Logout Error:", error);
        }
    });
}

/**
 * Checks if a business profile exists for the given UID
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
async function checkBusinessProfileExists(uid) {
    try {
        // Check businesses first
        let docRef = doc(db, "businesses", uid);
        let docSnap = await getDoc(docRef);
        if (docSnap.exists()) return true;

        // Fallback for migration
        docRef = doc(db, "restaurants", uid);
        docSnap = await getDoc(docRef);
        return docSnap.exists();
    } catch (error) {
        console.error("Error checking business profile:", error);
        return false;
    }
}

// Authentication state listener and redirection logic
/**
 * Checks if the current user has administrative privileges
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
async function checkIsAdmin(uid) {
    if (!uid) return false;
    try {
        const docRef = doc(db, "admins", uid);
        const docSnap = await getDoc(docRef);
        return docSnap.exists();
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

/**
 * Checks if the current user has moderator privileges
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
async function checkIsModerator(uid) {
    if (!uid) return false;
    try {
        const docRef = doc(db, "moderators", uid);
        const docSnap = await getDoc(docRef);
        return docSnap.exists();
    } catch (error) {
        console.error("Error checking moderator status:", error);
        return false;
    }
}

/**
 * Injects Admin/Moderator Dashboard link into navigation if user has privileges
 */
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

        // Find logout button to insert before it, or just append
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.parentNode.insertBefore(adminLink, logoutBtn);
            // Add some margin to the admin link
            adminLink.style.marginRight = '1rem';
        } else {
            navContainer.appendChild(adminLink);
        }
    }
}

// Authentication state listener and redirection logic
onAuthStateChanged(auth, async (user) => {
    const path = window.location.pathname;
    const currentPage = path.substring(path.lastIndexOf('/') + 1) || "index.html";

    // If we are currently handling a manual redirect after auth action, skip this listener
    if (isRedirectingAfterAuth) return;

    if (user) {
        // User is signed in
        const isAdmin = await checkIsAdmin(user.uid);
        const isModerator = await checkIsModerator(user.uid);
        const profileExists = await checkBusinessProfileExists(user.uid);

        if (isAdmin || isModerator) {
            injectDashboardLink(user.uid);
        }

        if (currentPage === "login.html" || currentPage === "index.html") {
            if ((isAdmin || isModerator) && currentPage !== "admin.html") {
                // Admins/Moderators can go to dashboard or admin page, but let's default to dashboard if they login
                window.location.href = "dashboard.html";
            } else if (profileExists) {
                window.location.href = "dashboard.html";
            } else {
                window.location.href = "restaurant.html";
            }
        } else if (currentPage === "dashboard.html") {
            if (!profileExists && !isAdmin && !isModerator) {
                window.location.href = "restaurant.html";
            }
        } else if (currentPage === "restaurant.html") {
            const urlParams = new URLSearchParams(window.location.search);
            const isEditMode = urlParams.get('edit') === 'true';
            if (profileExists && !isEditMode && !isAdmin && !isModerator) {
                window.location.href = "dashboard.html";
            }
        } else if (currentPage === "admin.html") {
            if (!isAdmin && !isModerator) {
                window.location.href = "dashboard.html";
            }
        }
    } else {
        // User is signed out
        if (currentPage === "dashboard.html" || currentPage === "restaurant.html" || currentPage === "admin.html") {
            window.location.href = "login.html";
        }
    }
});

export { auth, db, signOut };
