const fs = require('fs');
const vm = require('vm');

// 1. Read the tested engine from test_user_engine.cjs
const testEngineSrc = fs.readFileSync('test_user_engine.cjs', 'utf8');
const engineStartStr = '/* =====================================================================\r\n   LAVORA AI v2  —  BLOK 1';
const engineStartStrUnix = '/* =====================================================================\n   LAVORA AI v2  —  BLOK 1';
let startIdx = testEngineSrc.indexOf(engineStartStr);
if (startIdx === -1) startIdx = testEngineSrc.indexOf(engineStartStrUnix);

const engineEndStr = '  LA.generateProductVisual = async function (prompt, opts) {\r\n';
const engineEndStrUnix = '  LA.generateProductVisual = async function (prompt, opts) {\n';

// Find the closing of the IIFE
const iifeClose = '\n})();';
const endIdx = testEngineSrc.indexOf(iifeClose, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not extract engine from test_user_engine.cjs:', { startIdx, endIdx });
  process.exit(1);
}

let v2EngineCode = testEngineSrc.substring(startIdx, endIdx + iifeClose.length);

// Ensure PARTS has 'renk' support in body
if (!v2EngineCode.includes('renk(?:te|i|te)?')) {
  v2EngineCode = v2EngineCode.replace(
    `{ k: 'body',     re: /(?<![a-z])(?:govde|ana\\s*renk|korpus|iskelet|tamami|tumu|hepsi|genel)[a-z]*/ }`,
    `{ k: 'body',     re: /(?<![a-z])(?:govde|ana\\s*renk|korpus|iskelet|tamami|tumu|hepsi|genel|renk(?:te|i|te)?)[a-z]*/ }`
  );
}

// Enhance describe(S) with dynamic dimension modifications
const oldDescribeDims = `    var d = S.dims, dimStr = T.dims;
    if (d.w || d.d || d.h) {
      var dd = T.dims.split(/\\s*×\\s*|\\s*cm/).filter(Boolean).map(Number);
      dimStr = [d.w || dd[0], d.d || dd[1], d.h || dd[2]].join(' × ') + ' cm';
    }`;

const newDescribeDims = `    var d = S.dims, dimStr = T.dims;
    var dd = T.dims.split(/\\s*×\\s*|\\s*cm/).filter(Boolean).map(Number);
    var w = d.w || dd[0] || 120, depth = d.d || dd[1] || 45, h = d.h || dd[2] || 85;
    if (S.mods) {
      if (S.mods.comp && S.mods.comp.v === 'down') {
        w = Math.round(w * 0.8); depth = Math.round(depth * 0.85); h = Math.round(h * 0.85);
      }
      if (S.mods.w) { w = S.mods.w.v === 'up' ? Math.round(w * 1.25) : Math.round(w * 0.75); }
      if (S.mods.h) { h = S.mods.h.v === 'up' ? Math.round(h * 1.25) : Math.round(h * 0.75); }
      if (S.mods.d) { depth = S.mods.d.v === 'up' ? Math.round(depth * 1.25) : Math.round(depth * 0.75); }
    }
    dimStr = [w, depth, h].join(' × ') + ' cm';`;

if (v2EngineCode.includes(oldDescribeDims)) {
  v2EngineCode = v2EngineCode.replace(oldDescribeDims, newDescribeDims);
} else {
  // Try regex replace for line ending differences
  v2EngineCode = v2EngineCode.replace(
    /var d = S\.dims, dimStr = T\.dims;[\s\S]*?dimStr = \[d\.w \|\| dd\[0\], d\.d \|\| dd\[1\], d\.h \|\| dd\[2\]\]\.join\(' × '\) \+ ' cm';\s*\}/,
    newDescribeDims + '\n    }'
  );
}

// 2. Read working HTML
let html = fs.readFileSync('lavora-calisma-masasi-v38-firebase.html', 'utf8');

const targetStart = 'window.LavoraAI.extractDesignFromChat = async function';
const targetEnd = 'window.lvEstimateFurniturePrice = function(specs) {';

const replaceStart = html.indexOf(targetStart);
const replaceEnd = html.indexOf(targetEnd);

if (replaceStart === -1 || replaceEnd === -1) {
  console.error('Target boundaries not found in html:', { replaceStart, replaceEnd });
  process.exit(1);
}

html = html.substring(0, replaceStart) + v2EngineCode + '\n\n' + html.substring(replaceEnd);

// 3. Update handleSendUserMessage to automatically trigger generation when furniture is detected
const oldMsgHandlerPattern = /var aiSaysReady = \/\(3d\|stüdyo[\s\S]*?triggerInChatGeneration\(\);\s*\}/;
const newMsgHandlerCode = `var designState = window.LavoraAI.parseDesign ? window.LavoraAI.parseDesign(conversation) : null;
      var hasFurniture = designState && designState.type;
      var userWantsGen = /(oluştur|üret|tasarla|çiz|göster|yap|başla|tamam|hazırla|hadi|bakalım|3d|görsel|resim|fotoğraf)/i.test(text);

      if (hasFurniture || userWantsGen) {
        triggerInChatGeneration();
      }`;

if (oldMsgHandlerPattern.test(html)) {
  html = html.replace(oldMsgHandlerPattern, newMsgHandlerCode);
  console.log('Updated handleSendUserMessage trigger logic.');
} else {
  console.warn('Could not match oldMsgHandlerPattern, checking manual replacement...');
}

// 4. Update responsive mobile CSS
const oldMobileCss = `  #lv-gemini-container { width: 100vw !important; height: 100dvh !important; max-height: 100dvh !important; max-width: 100vw !important; border-radius: 0 !important; border: none !important; }
  #lv-gemini-modal { padding: 0 !important; }
  .lv-render-thumb { height: 210px !important; }
  .lv-chat-stream-pad { padding: 14px 14px 18px !important; }`;

const newMobileCss = `  #lv-gemini-container { width: 100vw !important; height: 100dvh !important; max-height: 100dvh !important; max-width: 100vw !important; border-radius: 0 !important; border: none !important; }
  #lv-gemini-modal { padding: 0 !important; }
  #lv-btn-instant-3d span { display: none !important; }
  #lv-btn-instant-3d { padding: 0 10px !important; height: 32px !important; }
  .lv-render-thumb { height: 210px !important; }
  .lv-chat-stream-pad { padding: 12px 12px 16px !important; }`;

if (html.includes(oldMobileCss)) {
  html = html.replace(oldMobileCss, newMobileCss);
  console.log('Updated mobile responsive styles.');
}

// 5. Validate all inline scripts
const scripts = [];
const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
let m;
while ((m = scriptRegex.exec(html)) !== null) {
  const content = m[1];
  if (!m[0].includes('src=') && !m[0].includes('type="importmap"') && !m[0].includes('type="application/json"') && content.trim()) {
    scripts.push(content);
  }
}

console.log(`Validating ${scripts.length} inline scripts with vm.Script...`);
let scriptErrors = 0;
scripts.forEach((code, idx) => {
  try {
    new vm.Script(code);
  } catch(e) {
    console.error(`Script #${idx+1} syntax error:`, e.message);
    scriptErrors++;
  }
});

if (scriptErrors === 0) {
  console.log('ALL INLINE SCRIPTS ARE 100% VALID! Writing files...');
  fs.writeFileSync('lavora-calisma-masasi-v38-firebase.html', html, 'utf8');
  fs.writeFileSync('index.html', html, 'utf8');
  console.log('Successfully written lavora-calisma-masasi-v38-firebase.html and index.html');
} else {
  console.error(`Validation failed with ${scriptErrors} error(s). Files not modified.`);
  process.exit(1);
}
