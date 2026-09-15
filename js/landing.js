import qrcode from "./qrcode.js";

/**
 * Landing Page Logic
 * Handles the live QR code generation for the demo section.
 */

document.addEventListener("DOMContentLoaded", () => {
    enhanceHeroVideo();
    generateDemoQR();
});

/**
 * Makes the animated hero artwork clearer without exposing the video's edges on mobile.
 */
function enhanceHeroVideo() {
    const videoContainer = document.querySelector(".hero-video-container");
    const video = videoContainer?.querySelector("video");
    if (!videoContainer || !video) return;

    videoContainer.style.opacity = "0.25";

    const applyFraming = () => {
        video.style.objectFit = "cover";
        video.style.transform = "none";

        if (window.matchMedia("(max-width: 640px)").matches) {
            // Restore the seamless mobile crop so the video edges never show.
            video.style.objectPosition = "center center";
        } else {
            // Shift the desktop artwork down slightly so more of the upper composition is visible.
            video.style.objectPosition = "center 38%";
        }
    };

    applyFraming();
    window.addEventListener("resize", applyFraming, { passive: true });
}

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
