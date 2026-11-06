const fs = require('fs');
let html = fs.readFileSync('lavora-calisma-masasi-v38-firebase.html', 'utf8');

// Fix 1: Change lvOpenWorkflowProject call to use window. prefix
const old1 = '    openWfBtn.onclick=()=>lvOpenWorkflowProject(r.projectId, r.itemId||r.itemName);';
const new1 = '    openWfBtn.onclick=()=>window.lvOpenWorkflowProject(r.projectId, r.itemId||r.itemName);';

// Fix 2: Change lvAdminReply call to use window. prefix  
const old2 = '    replyBtn.onclick=()=>lvAdminReply(id, r._ownerUid, r);';
const new2 = '    replyBtn.onclick=()=>window.lvAdminReply(id, r._ownerUid, r);';

// Fix 3: remaining alert calls
const alertFixes = [
  ['   alert(\'Hata: \'+err(e));\n  }\n };', '   if(typeof toast===\'function\')toast(\'Hata: \'+err(e));\n  }\n };'],
  ['}catch(e){alert(\'Hata: \'+err(e));}', '}catch(e){if(typeof toast===\'function\')toast(\'Hata: \'+err(e));}'],
  ['}catch(e){alert(\'Hata: \'+err(e))}', '}catch(e){if(typeof toast===\'function\')toast(\'Hata: \'+err(e))}'],
];

let changes = 0;

if (html.includes(old1)) { html = html.replace(old1, new1); changes++; console.log('Fix 1 OK'); }
else console.log('Fix 1 NOT FOUND');

if (html.includes(old2)) { html = html.replace(old2, new2); changes++; console.log('Fix 2 OK'); }
else console.log('Fix 2 NOT FOUND');

for (const [from, to] of alertFixes) {
  const count = (html.split(from).length - 1);
  if (count > 0) {
    html = html.replaceAll(from, to);
    changes += count;
    console.log('Alert fix OK:', count, 'replacements -', from.slice(0, 50));
  } else {
    console.log('Alert fix NOT FOUND:', from.slice(0, 50));
  }
}

fs.writeFileSync('lavora-calisma-masasi-v38-firebase.html', html);
console.log('\nTotal changes:', changes);

// Verify no alert() remain (excluding confirm)
const lines = html.split('\n');
const remaining = lines.filter(l => l.includes('alert(') && !l.includes('confirm('));
console.log('Remaining alert() calls:', remaining.length);
remaining.forEach(l => console.log(' ', l.trim().slice(0, 100)));
