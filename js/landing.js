import qrcode from "./qrcode.js";

/**
 * Landing Page Logic
 * Handles the live QR code generation for the demo section.
 */

document.addEventListener("DOMContentLoaded", () => {
    generateDemoQR();
});

/**
 * Generates a QR code for the demonstration menu
 */
function generateDemoQR() {
    const container = document.getElementById("demo-qr-container");
    if (!container) return;

    try {
        const demoUrl = "https://www.scanmenu.africa/menu.html?id=demo";

        // Use qrcode-generator logic as seen in qr-manager.js
        const qr = qrcode(0, 'H');
        qr.addData(demoUrl);
        qr.make();

        // Create an image tag
        const imgTag = qr.createImgTag(5, 10, "ScanMenu.Africa Demo Menu");

        // Inject into container
        container.innerHTML = imgTag;

        // Ensure the image fits nicely
        const img = container.querySelector("img");
        if (img) {
            img.style.maxWidth = "100%";
            img.style.height = "auto";
            img.style.display = "block";
        }

    } catch (error) {
        console.error("Failed to generate demo QR:", error);
        container.innerHTML = "<p>Preview unavailable</p>";
    }
}
