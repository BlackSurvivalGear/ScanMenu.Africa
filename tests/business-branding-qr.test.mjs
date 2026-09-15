import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../js/qr-manager.js', import.meta.url), 'utf8');

assert.match(source, /Business Profile/, 'dashboard heading should be Business Profile');
assert.match(source, /business-profile-brand/, 'business profile branding container should be rendered');
assert.match(source, /currentLogoUrl/, 'saved business logo should be consumed');
assert.match(source, /drawLogoInQr/, 'business logo should be drawn into QR canvas');
assert.match(source, /ctx\.drawImage\(img, x, y, size, size\)/, 'logo should be embedded in QR canvas');
assert.doesNotMatch(source, /qrPreviewContainer\.appendChild\(logoImg\)/, 'logo must not be rendered below the QR code');
assert.match(source, /font-size:1\.6rem;font-weight:800/, 'business name should be prominent');

console.log('Business profile / QR branding regression checks passed.');
