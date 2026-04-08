import crypto from 'node:crypto';

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-admin-password.mjs "<password>"');
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const derivedKey = crypto.scryptSync(password, salt, 64);

console.log(`mb1$${salt.toString('base64')}$${derivedKey.toString('base64')}`);
