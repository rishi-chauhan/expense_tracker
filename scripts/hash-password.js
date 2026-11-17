#!/usr/bin/env bun
/**
 * Print an argon2id hash for the optional app password (AUTH_PASSWORD_HASH).
 * The password is read from stdin — never pass it as an argument (it would
 * land in shell history and `ps`).
 *
 *   printf '%s' 'my secret' | bun scripts/hash-password.js
 *   bun scripts/hash-password.js          # interactive prompt
 *
 * Put the result in .env SINGLE-QUOTED (the hash contains `$`):
 *   AUTH_PASSWORD_HASH='$argon2id$v=19$...'
 */
async function readPassword() {
  if (process.stdin.isTTY) {
    const pw = prompt('App password:');
    return pw ?? '';
  }
  const text = await new Response(Bun.stdin.stream()).text();
  // Strip one trailing newline (e.g. from `echo`), keep everything else.
  return text.replace(/\r?\n$/, '');
}

const password = await readPassword();
if (!password) {
  console.error('hash-password: empty password');
  process.exit(1);
}
if (password.length < 8) {
  console.error('hash-password: warning — password is shorter than 8 characters');
}

console.log(await Bun.password.hash(password, { algorithm: 'argon2id' }));
