import qrcode from "./qrcode.js";

/**
 * QR Code Manager Module
 * Handles generation, preview, download, and link copying.
 */

// DOM Elements
const generateBtn = document.getElementById("generate-qr-btn");
const openMenuBtn = document.getElementById("open-menu-btn");
const downloadBtn = document.getElementById("download-qr-btn");
const copyLinkBtn = document.getElementById("copy-link-btn");
const qrPreviewContainer = document.getElementById("qr-preview-container");
const qrDownloadActions = document.getElementById("qr-download-actions");
const qrMessage = document.getElementById("qr-message");
const qrError = document.getElementById("qr-error");

let currentUid = null;
let currentBizName = "restaurant";
let publicMenuUrl = "";
let currentLogoUrl = "";

/**
 * Initialize the QR Manager
 * @param {string} uid - Authenticated user UID
 * @param {string} businessName - Restaurant business name
 * @param {string} logoUrl - Restaurant logo URL
 */
export function initQRManager(uid, businessName, logoUrl = "") {
    if (!uid) return;

    currentUid = uid;
    currentBizName = businessName || "Restaurant";
    currentLogoUrl = logoUrl;
    // Keep it relative or dynamic for sandbox
    const host = window.location.host;
    const protocol = window.location.protocol;
    publicMenuUrl = `${protocol}//${host}/menu.html?id=${uid}`;

    if (generateBtn) {
        generateBtn.addEventListener("click", handleGenerateQR);
    }

    if (openMenuBtn) {
        openMenuBtn.addEventListener("click", handleOpenMenu);
    }

    if (downloadBtn) {
        downloadBtn.addEventListener("click", handleDownloadPNG);
    }

    if (copyLinkBtn) {
        copyLinkBtn.addEventListener("click", handleCopyLink);
    }
}

/**
 * Handle QR Code Generation
 */
function handleGenerateQR() {
    try {
        hideFeedback();

        // Generate QR code data
        const qr = qrcode(0, 'H'); // Type 0 (auto), Error Correction Level H (High)
        qr.addData(publicMenuUrl);
        qr.make();

        // Create Canvas for better control and download
        const cellSize = 8;
        const margin = 20;
        const qrSize = qr.getModuleCount();

        const canvas = document.createElement('canvas');
        canvas.width = 300; // Force 300x300 as per requirements
        canvas.height = 300;
        const ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw QR code scaled to fit 300x300 with margin
        const scale = (300 - margin * 2) / (qrSize * cellSize);

        ctx.save();
        ctx.translate(margin, margin);
        ctx.scale(scale * cellSize, scale * cellSize);

        for (let row = 0; row < qrSize; row++) {
            for (let col = 0; col < qrSize; col++) {
                if (qr.isDark(row, col)) {
                    ctx.fillStyle = "black";
                    ctx.fillRect(col, row, 1, 1);
                }
            }
        }
        ctx.restore();

        // Update UI - Reorder branding elements
        qrPreviewContainer.innerHTML = "";
        qrPreviewContainer.style.flexDirection = "column";
        qrPreviewContainer.style.gap = "1.5rem";
        qrPreviewContainer.style.padding = "2rem 1rem";
        qrPreviewContainer.style.height = "auto";
        qrPreviewContainer.style.minHeight = "450px";

        // 1. QR Code
        qrPreviewContainer.appendChild(canvas);

        // 2. Restaurant Logo (if available)
        if (currentLogoUrl) {
            const logoImg = document.createElement("img");
            logoImg.src = currentLogoUrl;
            logoImg.className = "qr-logo-preview";
            logoImg.style.marginTop = "0"; // Reset margin
            qrPreviewContainer.appendChild(logoImg);
        }

        // 3. Business Name
        const bizNameLabel = document.createElement("div");
        bizNameLabel.textContent = currentBizName;
        bizNameLabel.style.fontSize = "1.25rem";
        bizNameLabel.style.fontWeight = "700";
        bizNameLabel.style.color = "var(--text-color)";
        qrPreviewContainer.appendChild(bizNameLabel);

        // 4. Clickable Menu Link
        const menuLink = document.createElement("a");
        menuLink.href = publicMenuUrl;
        menuLink.target = "_blank";
        menuLink.rel = "noopener";
        menuLink.textContent = "Open Restaurant Menu";
        menuLink.style.fontSize = "1rem";
        menuLink.style.color = "var(--primary-color)";
        menuLink.style.textDecoration = "none";
        menuLink.style.fontWeight = "600";
        menuLink.addEventListener("mouseover", () => menuLink.style.textDecoration = "underline");
        menuLink.addEventListener("mouseout", () => menuLink.style.textDecoration = "none");
        qrPreviewContainer.appendChild(menuLink);

        // 5. Buttons Row
        qrDownloadActions.classList.remove("hidden");
        qrDownloadActions.style.marginTop = "0.5rem";
        qrPreviewContainer.appendChild(qrDownloadActions);

        console.log("QR Code generated successfully for:", currentBizName);

    } catch (error) {
        console.error("QR Generation Error:", error);
        showError("Unable to generate QR code. Please try again.");
    }
}

/**
 * Handle Open Menu
 */
function handleOpenMenu() {
    if (publicMenuUrl) {
        window.open(publicMenuUrl, '_blank');
    }
}

/**
 * Handle PNG Download
 */
function handleDownloadPNG() {
    try {
        const canvas = qrPreviewContainer.querySelector("canvas");
        if (!canvas) {
            showError("Please generate a QR code first.");
            return;
        }

        // Sanitize business name for filename
        const sanitizedName = currentBizName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        const filename = `${sanitizedName || 'restaurant'}-qr.png`;

        // Create download link
        const link = document.createElement("a");
        link.download = filename;
        link.href = canvas.toDataURL("image/png");
        link.click();
    } catch (error) {
        console.error("Download Error:", error);
        showError("Download failure. Please try again.");
    }
}

/**
 * Handle Copy Link to Clipboard
 */
async function handleCopyLink() {
    try {
        if (!publicMenuUrl) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(publicMenuUrl);
            showMessage("✓ Menu link copied");
        } else {
            throw new Error("Clipboard unavailable");
        }
    } catch (error) {
        console.error("Clipboard Error:", error);
        showError("Clipboard unavailable or permission denied.");
    }
}

/**
 * Show error message
 */
function showError(msg) {
    if (qrError) {
        qrError.textContent = msg;
        qrError.classList.remove("hidden");
        setTimeout(() => qrError.classList.add("hidden"), 5000);
    }
}

/**
 * Show success message
 */
function showMessage(msg) {
    if (qrMessage) {
        qrMessage.textContent = msg;
        qrMessage.classList.remove("hidden");
        setTimeout(() => qrMessage.classList.add("hidden"), 3000);
    }
}

/**
 * Hide all feedback boxes
 */
function hideFeedback() {
    if (qrError) qrError.classList.add("hidden");
    if (qrMessage) qrMessage.classList.add("hidden");
}
