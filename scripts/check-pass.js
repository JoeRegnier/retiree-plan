const bcrypt = require('bcrypt');
const hash = process.argv[2];
const pass = process.argv[3];
if (!hash || !pass) { console.error('Usage: node scripts/check-pass.js <hash> <password>'); process.exit(2); }
bcrypt.compare(pass, hash).then(r => console.log(r)).catch(e => { console.error(e); process.exit(1); });
