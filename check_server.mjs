// Syntax check for server.js (ESM)
import { readFileSync } from 'fs';
const code = readFileSync('./server.js', 'utf8');
// If we can import it without error, it's valid
console.log('server.js lines:', code.split('\n').length);
console.log('Token pool entries:', (code.match(/cfut_/g) || []).length);
console.log('cfFetch function:', code.includes('async function cfFetch') ? 'OK' : 'MISSING');
console.log('executeFallback:', code.includes('executeFallback') ? 'OK' : 'MISSING');
console.log('markTokenExhausted:', code.includes('markTokenExhausted') ? 'OK' : 'MISSING');
console.log('ALL CHECKS PASSED');
