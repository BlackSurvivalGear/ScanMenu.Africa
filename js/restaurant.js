import { auth, db } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import { progressiveGeocode } from "./geocoding.js";

const restaurantForm = document.getElementById("restaurant-form");
const submitBtn = document.getElementById("submit-btn");
const btnText = document.getElementById("btn-text");
const btnLoader = document.getElementById("btn-loader");
const errorMessage = document.getElementById("error-message");
const successMessage = document.getElementById("success-message");
const pageTitle = document.getElementById("page-title");
const cancelBtn = document.getElementById("cancel-btn");

// Logo elements
const logoInput = document.getElementById("logo-input");
const uploadLogoBtn = document.getElementById("upload-logo-btn");
const replaceLogoBtn = document.getElementById("replace-logo-btn");
const removeLogoBtn = document.getElementById("remove-logo-btn");
const logoPreview = document.getElementById("logo-preview");
const noLogoText = document.getElementById("no-logo-text");
const progressContainer = document.getElementById("upload-progress-container");
const progressBar = document.getElementById("upload-progress-bar");
const uploadStatus = document.getElementById("upload-status");

let isEditMode = false;
let existingCreatedAt = null;
let currentLogoUrl = "";
let existingApproved = false;
let existingFeatured = false;
let existingVerified = false;
let existingStatus = "pending";

const CLOUDINARY_CLOUD_NAME = "dekre5agw";
const CLOUDINARY_UPLOAD_PRESET = "scanmenu_logos";

const SUPPORTED_CURRENCIES = [
    { code: "DZD", symbol: "د.ج", name: "Algerian Dinar" },
    { code: "AOA", symbol: "Kz", name: "Angolan Kwanza" },
    { code: "BWP", symbol: "P", name: "Botswana Pula" },
    { code: "BIF", symbol: "FBu", name: "Burundian Franc" },
    { code: "CVE", symbol: "Esc", name: "Cape Verdean Escudo" },
    { code: "XAF", symbol: "CFA", name: "Central African CFA Franc" },
    { code: "KMF", symbol: "CF", name: "Comorian Franc" },
    { code: "CDF", symbol: "FC", name: "Congolese Franc" },
    { code: "DJF", symbol: "Fdj", name: "Djiboutian Franc" },
    { code: "EGP", symbol: "ج.م", name: "Egyptian Pound" },
    { code: "ERN", symbol: "Nfk", name: "Eritrean Nakfa" },
    { code: "SZL", symbol: "E", name: "Eswatini Lilangeni" },
    { code: "ETB", symbol: "Br", name: "Ethiopian Birr" },
    { code: "GMD", symbol: "D", name: "Gambian Dalasi" },
    { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi" },
    { code: "GNF", symbol: "FG", name: "Guinean Franc" },
    { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
    { code: "LSL", symbol: "L", name: "Lesotho Loti" },
    { code: "LRD", symbol: "L$", name: "Liberian Dollar" },
    { code: "LYD", symbol: "ل.د", name: "Libyan Dinar" },
    { code: "MGA", symbol: "Ar", name: "Malagasy Ariary" },
    { code: "MWK", symbol: "MK", name: "Malawian Kwacha" },
    { code: "MRU", symbol: "UM", name: "Mauritanian Ouguiya" },
    { code: "MUR", symbol: "₨", name: "Mauritian Rupee" },
    { code: "MAD", symbol: "د.م", name: "Moroccan Dirham" },
    { code: "MZN", symbol: "MT", name: "Mozambican Metical" },
    { code: "NAD", symbol: "N$", name: "Namibian Dollar" },
    { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
    { code: "RWF", symbol: "FRw", name: "Rwandan Franc" },
    { code: "STN", symbol: "Db", name: "São Tomé & Príncipe Dobra" },
    { code: "SCR", symbol: "₨", name: "Seychellois Rupee" },
    { code: "SLE", symbol: "Le", name: "Sierra Leonean Leone" },
    { code: "SOS", symbol: "Sh", name: "Somali Shilling" },
    { code: "ZAR", symbol: "R", name: "South African Rand" },
    { code: "SSP", symbol: "£", name: "South Sudanese Pound" },
    { code: "SDG", symbol: "ج.س", name: "Sudanese Pound" },
    { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling" },
    { code: "TND", symbol: "د.ت", name: "Tunisian Dinar" },
    { code: "UGX", symbol: "USh", name: "Ugandan Shilling" },
    { code: "XOF", symbol: "CFA", name: "West African CFA Franc" },
    { code: "ZMW", symbol: "ZK", name: "Zambian Kwacha" },
    { code: "ZWG", symbol: "ZiG", name: "Zimbabwe Gold" },
    { code: "USD", symbol: "$", name: "United States Dollar" },
    { code: "GBP", symbol: "£", name: "British Pound Sterling" },
    { code: "EUR", symbol: "€", name: "Euro" },
    { code: "RUB", symbol: "₽", name: "Russian Ruble" },
    { code: "CAD", symbol: "C$", name: "Canadian Dollar" }
];

// Form fields
const businessNameInput = document.getElementById("businessName");
const ownerNameInput = document.getElementById("ownerName");
const phoneInput = document.getElementById("phone");
const whatsappInput = document.getElementById("whatsapp");
const addressInput = document.getElementById("address");
const cityInput = document.getElementById("city");
const countryInput = document.getElementById("country");
const categoryInput = document.getElementById("category");
const cuisineInput = document.getElementById("cuisine");
const websiteInput = document.getElementById("website");
const currencyInput = document.getElementById("currency-input");
const currencyList = document.getElementById("currency-list");
const currencyHidden = document.getElementById("currency");

// Populate currency dropdown
function populateCurrencies() {
    if (!currencyList) return;

    SUPPORTED_CURRENCIES.forEach(curr => {
        const option = document.createElement("option");
        const displayName = `${curr.name} (${curr.symbol})`;
        option.value = displayName;
        option.setAttribute('data-code', curr.code);
        currencyList.appendChild(option);
    });

    if (currencyInput) {
        currencyInput.addEventListener('change', (e) => {
            const val = e.target.value;
            const option = SUPPORTED_CURRENCIES.find(c => `${c.name} (${c.symbol})` === val);
            if (option) {
                currencyHidden.value = option.code;
            } else {
                // If typed value is not in list, clear hidden value or keep it for validation
                currencyHidden.value = "";
            }
        });
    }
}

populateCurrencies();

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const urlParams = new URLSearchParams(window.location.search);
        isEditMode = urlParams.get('edit') === 'true';

        // Check if profile already exists in businesses collection
        const docRef = doc(db, "businesses", user.uid);
        let docSnap = await getDoc(docRef);

        // For migration: if not in businesses, check restaurants
        if (!docSnap.exists()) {
            const oldDocRef = doc(db, "restaurants", user.uid);
            docSnap = await getDoc(oldDocRef);
        }

        if (docSnap.exists()) {
            const data = docSnap.data();
            existingCreatedAt = data.createdAt;
            currentLogoUrl = data.logoUrl || "";
            existingApproved = data.approved || false;
            existingFeatured = data.featured || false;
            existingVerified = data.verified || false;
            existingStatus = data.status || "pending";

            if (isEditMode) {
                setupEditMode(data);
            } else {
                // If profile already exists and not explicitly editing, redirect to dashboard
                window.location.href = "dashboard.html";
            }
        } else if (isEditMode) {
            // If edit mode requested but no profile exists, treat as new setup
            isEditMode = false;
            pageTitle.innerText = "Business Profile Setup";
        }
    } else {
        window.location.href = "login.html";
    }
});

async function setupEditMode(data) {
    pageTitle.innerText = "Edit Business Profile";
    cancelBtn.classList.remove("hidden");

    if (data.logoUrl) {
        showLogoPreview(data.logoUrl);
    }

    try {
        businessNameInput.value = data.businessName || "";
        ownerNameInput.value = data.ownerName || "";
        phoneInput.value = data.phone || "";
        whatsappInput.value = data.whatsapp || "";
        addressInput.value = data.address || "";
        cityInput.value = data.city || "";
        countryInput.value = data.country || "";
        categoryInput.value = data.category || "";
        cuisineInput.value = data.cuisine || "";
        websiteInput.value = data.website || "";

        const currencyCode = data.currencyCode || "GBP";
        const curr = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
        if (curr && currencyInput && currencyHidden) {
            currencyInput.value = `${curr.name} (${curr.symbol})`;
            currencyHidden.value = curr.code;
        }
    } catch (error) {
        console.error("Error fetching business data:", error);
        showError("Failed to load business profile.");
    }
}

function showError(message) {
    errorMessage.innerText = message;
    errorMessage.classList.remove("hidden");
    successMessage.classList.add("hidden");
}

function showSuccess(message) {
    successMessage.innerText = message;
    successMessage.classList.remove("hidden");
    errorMessage.classList.add("hidden");
}

// Logo Management functions
function showLogoPreview(url) {
    logoPreview.src = url;
    logoPreview.classList.remove("hidden");
    noLogoText.classList.add("hidden");
    uploadLogoBtn.classList.add("hidden");
    replaceLogoBtn.classList.remove("hidden");
    removeLogoBtn.classList.remove("hidden");
}

function hideLogoPreview() {
    logoPreview.src = "";
    logoPreview.classList.add("hidden");
    noLogoText.classList.remove("hidden");
    uploadLogoBtn.classList.remove("hidden");
    replaceLogoBtn.classList.add("hidden");
    removeLogoBtn.classList.add("hidden");
}

uploadLogoBtn.addEventListener("click", () => logoInput.click());
replaceLogoBtn.addEventListener("click", () => logoInput.click());

removeLogoBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to remove the logo?")) {
        currentLogoUrl = "";
        hideLogoPreview();
        showSuccess("Logo removed successfully. Save profile to apply changes.");

        // Optionally update Firestore immediately if we're in edit mode
        if (auth.currentUser) {
            const docRef = doc(db, "businesses", auth.currentUser.uid);
            await updateDoc(docRef, {
                logoUrl: "",
                updatedAt: serverTimestamp()
            });
        }
    }
});

logoInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validation
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showError("File size too large. Maximum size is 5MB.");
        return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
        showError("Invalid file type. Please upload PNG, JPG, or WEBP.");
        return;
    }

    uploadFile(file);
    // Reset input so the same file can be selected again
    e.target.value = "";
});

async function uploadFile(file) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    progressContainer.classList.remove("hidden");
    uploadStatus.classList.remove("hidden");
    uploadStatus.innerText = "Uploading logo...";
    progressBar.style.width = "0%";

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            progressBar.style.width = percentComplete + "%";
        }
    };

    xhr.onload = async () => {
        if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            currentLogoUrl = response.secure_url;
            showLogoPreview(currentLogoUrl);
            showSuccess("Logo uploaded successfully! Save profile to apply changes.");

            progressContainer.classList.add("hidden");
            uploadStatus.innerText = "Upload complete!";
            setTimeout(() => uploadStatus.classList.add("hidden"), 3000);
        } else {
            console.error("Cloudinary Error:", xhr.responseText);
            showError("Upload failed. Please try again.");
            progressContainer.classList.add("hidden");
            uploadStatus.classList.add("hidden");
        }
    };

    xhr.onerror = () => {
        showError("Upload failed. Please check your connection.");
        progressContainer.classList.add("hidden");
        uploadStatus.classList.add("hidden");
    };

    xhr.send(formData);
}

/**
 * Geocode address using Nominatim
 */
async function geocode(address, city, country) {
    return await progressiveGeocode(address, city, country, 'ScanMenu Africa Melanin Map');
}

restaurantForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const businessName = businessNameInput.value.trim();
    const ownerName = ownerNameInput.value.trim();
    const phone = phoneInput.value.trim();
    const whatsapp = whatsappInput.value.trim();
    const address = addressInput.value.trim();
    const city = cityInput.value.trim();
    const country = countryInput.value;
    const category = categoryInput.value;
    const cuisine = cuisineInput.value.trim();
    const website = websiteInput.value.trim();
    const currencyCode = currencyHidden ? currencyHidden.value : "";

    // Basic Validation
    if (!businessName || !ownerName || !phone || !whatsapp || !address || !city || !country || !category || !currencyCode) {
        showError("All required fields are mandatory. Please select a valid currency from the list.");
        return;
    }

    // Reset UI
    errorMessage.classList.add("hidden");
    btnText.classList.add("hidden");
    btnLoader.classList.remove("hidden");
    submitBtn.disabled = true;

    try {
        if (!auth.currentUser) {
            showError("You must be logged in to save a profile.");
            return;
        }

        // Geocoding
        btnText.innerText = "Geocoding address...";
        btnText.classList.remove("hidden");
        const coords = await geocode(address, city, country);

        if (!coords) {
            showError("Unable to determine your location. Please verify your address and try again.");
            btnText.classList.remove("hidden");
            btnText.innerText = "Save Profile";
            btnLoader.classList.add("hidden");
            submitBtn.disabled = false;
            return;
        }

        console.log("Coordinates saved:", coords.lat, coords.lon);

        const selectedCurrency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);

        const businessData = {
            ownerUid: auth.currentUser.uid,
            businessName,
            ownerName,
            phone,
            whatsapp,
            address,
            city,
            country,
            category,
            cuisine,
            website,
            latitude: coords.lat,
            longitude: coords.lon,
            currencyCode,
            currencySymbol: selectedCurrency ? selectedCurrency.symbol : "£",
            logoUrl: currentLogoUrl,
            verified: isEditMode ? existingVerified : false,
            status: isEditMode ? existingStatus : "pending",
            approved: isEditMode ? existingApproved : true, // Set to true by default for new so it passes legacy filters if any
            featured: isEditMode ? existingFeatured : false,
            createdAt: isEditMode ? existingCreatedAt : serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        // Ensure createdAt is never null if we're in edit mode but it was missing
        if (isEditMode && !businessData.createdAt) {
            businessData.createdAt = serverTimestamp();
        }

        const docRef = doc(db, "businesses", auth.currentUser.uid);

        // Use setDoc for both creation and updates
        await setDoc(docRef, businessData);

        showSuccess("Profile saved successfully! Redirecting...");

        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1500);

    } catch (error) {
        console.error("Firestore Error:", error);
        if (error.code === 'permission-denied') {
            showError("Permission denied. You can only manage your own business profile.");
        } else {
            showError("An error occurred while saving. Please try again.");
        }

        // Restore UI
        btnText.classList.remove("hidden");
        btnText.innerText = "Save Profile";
        btnLoader.classList.add("hidden");
        submitBtn.disabled = false;
    }
});
