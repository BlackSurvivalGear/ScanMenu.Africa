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
let controlsBound = false;
let qrStyle = "classic";
let qrForeground = "#000000";
let qrBackground = "#ffffff";
let useLogo = true;
let lastDownloadCanvas = null;

export function initQRManager(uid, businessName, logoUrl = "") {
    if (!uid) return;
    currentUid = uid;
    currentBizName = businessName || "Restaurant";
    currentLogoUrl = logoUrl || "";
    publicMenuUrl = `${window.location.protocol}//${window.location.host}/menu.html?id=${uid}`;
    renderBusinessBranding();
    placeMenuActions();
    renderQRControls();

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
    const bizName = document.getElementById("biz-name");
    if (bizName) { bizName.style.fontSize = ""; bizName.style.fontWeight = ""; bizName.style.color = ""; }
    let brand = document.getElementById("business-profile-brand");
    if (!brand) {
        brand = document.createElement("div");
        brand.id = "business-profile-brand";
        brand.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:.65rem;margin:1rem 0 1.25rem;text-align:center";
        profile.insertBefore(brand, profile.querySelector(".detail-item"));
    }
    brand.innerHTML = "";
    if (currentLogoUrl) {
        const logo = document.createElement("img");
        logo.src = currentLogoUrl; logo.alt = `${currentBizName} logo`;
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
        actions = document.createElement("div"); actions.id = "menu-builder-actions";
        actions.style.cssText = "display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;justify-content:flex-end";
        menuHeader.appendChild(actions);
    }
    openMenuBtn.textContent = "Open Menu"; copyLinkBtn.textContent = "Copy Menu Link";
    openMenuBtn.style.flex = "none"; copyLinkBtn.style.flex = "none";
    actions.append(openMenuBtn, copyLinkBtn, addMenuItemBtn);
}

function renderQRControls() {
    const section = document.getElementById("qr-code-section");
    const container = section?.querySelector(".qr-container");
    if (!container || document.getElementById("qr-customization-controls")) return;
    const controls = document.createElement("div");
    controls.id = "qr-customization-controls";
    controls.style.cssText = "width:100%;padding:1rem;border:1px solid var(--border-color);border-radius:var(--radius-sm);background:var(--bg-light);display:grid;gap:.85rem";
    controls.innerHTML = `
      <label style="font-weight:700">QR Style
        <select id="qr-style-select" style="width:100%;margin-top:.35rem;padding:.65rem;border:1px solid var(--border-color);border-radius:6px;background:white">
          <option value="classic">Classic</option>
          <option value="gold">Brand Gold</option>
          <option value="premium">Premium Branded</option>
        </select>
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <label style="font-size:.85rem;font-weight:600">QR Colour<input id="qr-foreground-color" type="color" value="#000000" style="display:block;width:100%;height:38px;margin-top:.3rem"></label>
        <label style="font-size:.85rem;font-weight:600">Background<input id="qr-background-color" type="color" value="#ffffff" style="display:block;width:100%;height:38px;margin-top:.3rem"></label>
      </div>
      <label style="font-size:.85rem"><input id="qr-use-logo" type="checkbox" checked> Use Business Logo</label>
      <div id="qr-contrast-warning" class="hidden" style="font-size:.8rem;color:#991b1b;background:#fee2e2;padding:.55rem;border-radius:6px">Choose colours with stronger contrast so the QR remains easy to scan.</div>
      <button id="qr-reset-default" type="button" class="btn btn-outline btn-small">Reset to Default</button>`;
    container.insertBefore(controls, qrPreviewContainer);
    if (!controlsBound) {
        controls.addEventListener("change", handleControlChange);
        controls.querySelector("#qr-reset-default")?.addEventListener("click", resetQRControls);
        controlsBound = true;
    }
}

function handleControlChange() {
    qrStyle = document.getElementById("qr-style-select")?.value || "classic";
    qrForeground = document.getElementById("qr-foreground-color")?.value || "#000000";
    qrBackground = document.getElementById("qr-background-color")?.value || "#ffffff";
    useLogo = Boolean(document.getElementById("qr-use-logo")?.checked);
    if (qrStyle === "gold") { qrForeground = "#9a6a12"; setPicker("qr-foreground-color", qrForeground); }
    if (qrStyle === "premium") { qrForeground = "#8b6508"; qrBackground = "#ffffff"; setPicker("qr-foreground-color", qrForeground); setPicker("qr-background-color", qrBackground); }
    updateContrastWarning();
}
function setPicker(id, value) { const el = document.getElementById(id); if (el) el.value = value; }
function resetQRControls() {
    qrStyle = "classic"; qrForeground = "#000000"; qrBackground = "#ffffff"; useLogo = true;
    const style = document.getElementById("qr-style-select"); if (style) style.value = "classic";
    setPicker("qr-foreground-color", qrForeground); setPicker("qr-background-color", qrBackground);
    const logo = document.getElementById("qr-use-logo"); if (logo) logo.checked = true;
    updateContrastWarning();
}
function updateContrastWarning() {
    const warning = document.getElementById("qr-contrast-warning");
    warning?.classList.toggle("hidden", contrastRatio(qrForeground, qrBackground) >= 4.5);
}
function contrastRatio(a, b) {
    const lum = hex => { const rgb = hex.match(/[a-f\d]{2}/gi).map(v => parseInt(v,16)/255).map(v => v <= .03928 ? v/12.92 : ((v+.055)/1.055)**2.4); return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]; };
    const x=lum(a), y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

async function handleGenerateQR() {
    try {
        hideFeedback(); handleControlChange();
        if (contrastRatio(qrForeground, qrBackground) < 4.5) return showError("Please choose QR and background colours with stronger contrast.");
        const qr = qrcode(0, "H"); qr.addData(publicMenuUrl); qr.make();
        const canvas = document.createElement("canvas"); canvas.width = 300; canvas.height = 300;
        const ctx = canvas.getContext("2d"); drawQR(ctx, qr, qrForeground, qrBackground);
        if (useLogo && currentLogoUrl) await drawLogoInQr(ctx, currentLogoUrl);
        const output = qrStyle === "premium" ? await renderPremiumFrame(canvas) : canvas;
        lastDownloadCanvas = output;
        qrPreviewContainer.innerHTML = "";
        qrPreviewContainer.style.cssText += ";flex-direction:column;gap:1rem;padding:1.5rem 1rem;height:auto;min-height:420px";
        const bizNameLabel = document.createElement("div"); bizNameLabel.textContent = currentBizName;
        bizNameLabel.style.cssText = "font-size:1.4rem;font-weight:800;color:var(--text-color);text-align:center";
        if (qrStyle !== "premium") qrPreviewContainer.appendChild(bizNameLabel);
        qrPreviewContainer.appendChild(output);
        qrDownloadActions?.classList.remove("hidden");
        if (qrDownloadActions) { qrDownloadActions.style.marginTop = ".5rem"; qrPreviewContainer.appendChild(qrDownloadActions); }
    } catch (error) { console.error("QR Generation Error:", error); showError("Unable to generate QR code. Please try again."); }
}

function drawQR(ctx, qr, foreground, background) {
    const margin=20, size=qr.getModuleCount(), moduleSize=(300-margin*2)/size;
    ctx.fillStyle=background; ctx.fillRect(0,0,300,300);
    for(let row=0;row<size;row++) for(let col=0;col<size;col++) if(qr.isDark(row,col)){ ctx.fillStyle=foreground; ctx.fillRect(margin+col*moduleSize,margin+row*moduleSize,Math.ceil(moduleSize),Math.ceil(moduleSize)); }
}
function drawLogoInQr(ctx, url) {
    return new Promise(resolve => { const img=new Image(); img.crossOrigin="anonymous"; img.onload=()=>{const size=72,x=114,y=114;ctx.fillStyle=qrBackground;ctx.fillRect(x-6,y-6,size+12,size+12);ctx.drawImage(img,x,y,size,size);resolve();}; img.onerror=()=>resolve(); img.src=url; });
}
async function renderPremiumFrame(qrCanvas) {
    const canvas=document.createElement("canvas"); canvas.width=420; canvas.height=500; const ctx=canvas.getContext("2d");
    ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,420,500); ctx.strokeStyle="#b8860b"; ctx.lineWidth=7; ctx.strokeRect(14,14,392,472);
    ctx.fillStyle="#5d4612"; ctx.font="700 28px Inter, sans-serif"; ctx.textAlign="center"; ctx.fillText(currentBizName.toUpperCase(),210,60);
    ctx.drawImage(qrCanvas,60,90,300,300);
    ctx.fillStyle="#8b6508"; ctx.font="600 20px Inter, sans-serif"; ctx.fillText("Scan for Our Menu",210,430);
    ctx.fillStyle="#555"; ctx.font="14px Inter, sans-serif"; ctx.fillText("ScanMenu.Africa",210,462);
    return canvas;
}

function handleOpenMenu() { if (publicMenuUrl) window.open(publicMenuUrl, "_blank"); }
function handleDownloadPNG() {
    try {
        const canvas = lastDownloadCanvas || qrPreviewContainer?.querySelector("canvas");
        if (!canvas) return showError("Please generate a QR code first.");
        const name=currentBizName.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");
        const link=document.createElement("a"); link.download=`${name||"business"}-${qrStyle}-qr.png`; link.href=canvas.toDataURL("image/png"); link.click();
    } catch(error){ console.error("Download Error:",error); showError("Download failure. Please try again."); }
}
async function handleCopyLink(){try{if(!publicMenuUrl)return;if(!navigator.clipboard?.writeText)throw new Error("Clipboard unavailable");await navigator.clipboard.writeText(publicMenuUrl);showMessage("✓ Menu link copied");}catch(error){console.error("Clipboard Error:",error);showError("Clipboard unavailable or permission denied.");}}
function showError(msg){if(qrError){qrError.textContent=msg;qrError.classList.remove("hidden");setTimeout(()=>qrError.classList.add("hidden"),5000);}}
function showMessage(msg){if(qrMessage){qrMessage.textContent=msg;qrMessage.classList.remove("hidden");setTimeout(()=>qrMessage.classList.add("hidden"),3000);}}
function hideFeedback(){qrError?.classList.add("hidden");qrMessage?.classList.add("hidden");}
