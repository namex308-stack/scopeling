const fs = require('fs');
const path = 'manifest.json';

// 1) قراءة وإزالة BOM
let raw = fs.readFileSync(path, 'utf8');
raw = raw.replace(/^\uFEFF/, '');

// 2) تحليل JSON
let m;
try {
  m = JSON.parse(raw);
} catch (e) {
  console.error('[FATAL] manifest.json is not valid JSON:', e.message);
  process.exit(1);
}

// 3) إصلاح host_permissions - استبدال كامل بمصفوفة نظيفة
m.host_permissions = [
  'https://mail.google.com/*',
  'https://upwork.com/*',
  'https://www.upwork.com/*',
  'https://api.paddle.com/*'
];

// 4) إصلاح match patterns في web_accessible_resources
function normalizeMatch(p) {
  if (typeof p !== 'string') return p;
  if (/^https:\/\/upwork\.com\/messages(\/\*)?$/.test(p)) return 'https://upwork.com/*';
  if (/^https:\/\/www\.upwork\.com\/messages(\/\*)?$/.test(p)) return 'https://www.upwork.com/*';
  return p;
}

if (Array.isArray(m.web_accessible_resources)) {
  for (const w of m.web_accessible_resources) {
    if (Array.isArray(w.matches)) {
      w.matches = [...new Set(w.matches.map(normalizeMatch))];
    }
  }
}

// 5) إصلاح match patterns في content_scripts
if (Array.isArray(m.content_scripts)) {
  for (const cs of m.content_scripts) {
    if (Array.isArray(cs.matches)) {
      cs.matches = [...new Set(cs.matches.map(normalizeMatch))];
    }
  }
}

// 6) كتابة نظيفة بدون BOM
fs.writeFileSync(path, JSON.stringify(m, null, 2) + '\n', { encoding: 'utf8' });

console.log('[OK] manifest.json rewritten.');
console.log('[INFO] host_permissions =', JSON.stringify(m.host_permissions, null, 2));
console.log('[INFO] web_accessible_resources.matches =', JSON.stringify(
  (m.web_accessible_resources || []).map(w => w.matches), null, 2));
console.log('[INFO] content_scripts.matches =', JSON.stringify(
  (m.content_scripts || []).map(c => c.matches), null, 2));