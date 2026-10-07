import { randomBytes, createHash } from 'node:crypto';

const token = randomBytes(32).toString('base64url');
const sessionSecret = randomBytes(32).toString('base64url');
console.log('OWNER ACCESS CODE (enter this in AI Talk; do not put it in a progress backup):');
console.log(token);
console.log('\nServer settings (local .dev.vars or Worker secrets):');
console.log(`OWNER_TOKEN_HASH=${createHash('sha256').update(token).digest('hex')}`);
console.log(`SESSION_SECRET=${sessionSecret}`);
