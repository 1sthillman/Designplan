const fs = require('fs');
let html = fs.readFileSync('lavora-calisma-masasi-v38-firebase.html', 'utf8');

// Find and replace: add error div between textarea and action buttons
const oldSnippet = 'margin-bottom:16px;resize:vertical">${esc(r.reply||\'\')}</textarea>\n  <div style="display:flex;gap:10px">';
const newSnippet = 'margin-bottom:12px;resize:vertical">${esc(r.reply||\'\')}</textarea>\n  <div id="_lv-reply-err" style="display:none;color:#f87171;font-size:13px;margin-bottom:10px;padding:8px 12px;background:#f871711a;border-radius:8px;border:1px solid #f8717140"></div>\n  <div style="display:flex;gap:10px">';

if (html.includes(oldSnippet)) {
  html = html.replace(oldSnippet, newSnippet);
  fs.writeFileSync('lavora-calisma-masasi-v38-firebase.html', html);
  console.log('OK: Added _lv-reply-err div to admin reply modal');
} else {
  // Try to find partial
  const idx = html.indexOf('_lv-reply-input');
  if (idx >= 0) {
    console.log('Found _lv-reply-input at:', idx);
    const snippet = html.slice(idx, idx + 400);
    console.log('Context:', JSON.stringify(snippet.slice(0,300)));
  } else {
    console.log('NOT FOUND at all');
  }
}
