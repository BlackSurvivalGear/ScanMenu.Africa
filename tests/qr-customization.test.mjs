import fs from 'node:fs';

const source = fs.readFileSync('js/qr-manager.js', 'utf8');
const required = [
  'Premium Branded',
  'Brand Gold',
  'qr-foreground-color',
  'qr-background-color',
  'qr-use-logo',
  'Reset to Default',
  'contrastRatio',
  'renderPremiumFrame'
];
const missing = required.filter(token => !source.includes(token));
if (missing.length) {
  console.error(`QR customization implementation missing: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('QR customization source checks passed.');
