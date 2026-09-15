import qrcode from "./qrcode.js";

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
let listenersBound = false;

export function initQRManager(uid, businessName, logoUrl = "") {
    if (!uid) return;
    currentUid = uid;
    currentBizName = businessName || "Restaurant";
    currentLogoUrl = logoUrl || "";
    publicMenuUrl = `${window.location.protocol}//${window.location.host}/menu.html?id=${uid}`;
    renderBusinessBranding();
    placeMenuActions();

    if (!listenersBound) {
        generateBtn?.addEventListener("click", handleGenerateQR);
        openMenuBtn?.addEventListener("click", handleOpenMenu);
        downloadBtn?.addEventListener("click", handleDownloadPNG);
        copyLinkBtn?.addEventListener("click", handleCopyLink);
        listenersBound = true;
    }
}

function renderBusinessBranding() {
    const profile = document.getElementById("restaurant-details");
    if (!profile) return;
    const headingText = profile.querySelector("h3 span") || profile.querySelector("h3");
    if (headingText) headingText.textContent = "Business Profile";

    // Keep the Business Name value consistent with the other profile values.
    const bizName = document.getElementById("biz-name");
    if (bizName) {
        bizName.style.fontSize = "";
        bizName.style.fontWeight = "";
        bizName.style.color = "";
    }

    let brand = document.getElementById("business-profile-brand");
    if (!brand) {
        brand = document.createElement("div");
        brand.id = "business-profile-brand";
        brand.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:.65rem;margin:1rem 0 1.25rem;text-align:center";
        const firstDetail = profile.querySelector(".detail-item");
        profile.insertBefore(brand, firstDetail);
    }
    brand.innerHTML = "";
    if (currentLogoUrl) {
        const logo = document.createElement("img");
        logo.src = currentLogoUrl;
        logo.alt = `${currentBizName} logo`;
        logo.style.cssText = "width:110px;height:110px;object-fit:contain;border-radius:14px;border:1px solid var(--border-color);background:white;padding:8px";
        brand.appendChild(logo);
    }
    const name = document.createElement("div");
    name.textContent = currentBizName;
    name.style.cssText = "font-size:1.6rem;font-weight:800;line-height:1.15;color:var(--text-color)";
    brand.appendChild(name);
}

function placeMenuActions() {
    const menuSection = document.getElementById("menu-builder-section");
    const menuHeader = menuSection?.querySelector(":scope > div");
    const addMenuItemBtn = document.getElementById("add-menu-item-btn");
    if (!menuHeader || !addMenuItemBtn || !openMenuBtn || !copyLinkBtn) return;

    let actions = document.getElementById("menu-builder-actions");
    if (!actions) {
        actions = document.createElement("div");
        actions.id = "menu-builder-actions";
        actions.style.cssText = "display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;justify-content:flex-end";
        menuHeader.appendChild(actions);
    }

    openMenuBtn.textContent = "Open Menu";
    copyLinkBtn.textContent = "Copy Menu Link";
    openMenuBtn.style.flex = "none";
    copyLinkBtn.style.flex = "none";
    actions.appendChild(openMenuBtn);
    actions.appendChild(copyLinkBtn);
    actions.appendChild(addMenuItemBtn);
}

async function handleGenerateQR() {
    try {
        hideFeedback();
        const qr = qrcode(0, "H");
        qr.addData(publicMenuUrl);
        qr.make();
        const margin = 20;
        const qrSize = qr.getModuleCount();
        const canvas = document.createElement("canvas");
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 300, 300);
        const moduleSize = (300 - margin * 2) / qrSize;
        for (let row = 0; row < qrSize; row++) {
            for (let col = 0; col < qrSize; col++) {
                if (qr.isDark(row, col)) {
                    ctx.fillStyle = "black";
                    ctx.fillRect(margin + col * moduleSize, margin + row * moduleSize, Math.ceil(moduleSize), Math.ceil(moduleSize));
                }
            }
        }
        if (currentLogoUrl) await drawLogoInQr(ctx, currentLogoUrl);

        qrPreviewContainer.innerHTML = "";
        qrPreviewContainer.style.flexDirection = "column";
        qrPreviewContainer.style.gap = "1rem";
        qrPreviewContainer.style.padding = "1.5rem 1rem";
        qrPreviewContainer.style.height = "auto";
        qrPreviewContainer.style.minHeight = "420px";

        const bizNameLabel = document.createElement("div");
        bizNameLabel.textContent = currentBizName;
        bizNameLabel.style.cssText = "font-size:1.4rem;font-weight:800;color:var(--text-color);text-align:center";
        qrPreviewContainer.appendChild(bizNameLabel);
        qrPreviewContainer.appendChild(canvas);

        qrDownloadActions?.classList.remove("hidden");
        if (qrDownloadActions) {
            qrDownloadActions.style.marginTop = ".5rem";
            qrPreviewContainer.appendChild(qrDownloadActions);
        }
    } catch (error) {
        console.error("QR Generation Error:", error);
        showError("Unable to generate QR code. Please try again.");
    }
}

function drawLogoInQr(ctx, url) {
    return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const size = 72;
            const x = (300 - size) / 2;
            const y = (300 - size) / 2;
            ctx.fillStyle = "white";
            ctx.fillRect(x - 6, y - 6, size + 12, size + 12);
            ctx.drawImage(img, x, y, size, size);
            resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
    });
}

function handleOpenMenu() { if (publicMenuUrl) window.open(publicMenuUrl, "_blank"); }
function handleDownloadPNG() {
    try {
        const canvas = qrPreviewContainer?.querySelector("canvas");
        if (!canvas) return showError("Please generate a QR code first.");
        const sanitizedName = currentBizName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        const link = document.createElement("a");
        link.download = `${sanitizedName || "business"}-qr.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    } catch (error) { console.error("Download Error:", error); showError("Download failure. Please try again."); }
}
async function handleCopyLink() {
    try {
        if (!publicMenuUrl) return;
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(publicMenuUrl);
        showMessage("✓ Menu link copied");
    } catch (error) { console.error("Clipboard Error:", error); showError("Clipboard unavailable or permission denied."); }
}
function showError(msg) { if (qrError) { qrError.textContent = msg; qrError.classList.remove("hidden"); setTimeout(() => qrError.classList.add("hidden"), 5000); } }
function showMessage(msg) { if (qrMessage) { qrMessage.textContent = msg; qrMessage.classList.remove("hidden"); setTimeout(() => qrMessage.classList.add("hidden"), 3000); } }
function hideFeedback() { qrError?.classList.add("hidden"); qrMessage?.classList.add("hidden"); }
