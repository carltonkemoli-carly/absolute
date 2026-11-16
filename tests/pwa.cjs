// The auth proxy must leave the web app manifest and icons public: browsers
// fetch the manifest without cookies, so a login redirect would stop the app
// being installable on a phone. Pages must still go through the proxy.
const assert = require('node:assert/strict'), fs = require('node:fs')
const source = fs.readFileSync('proxy.ts', 'utf8')
const literal = source.match(/matcher:\s*\[\s*(?:\/\/[^\n]*\n\s*)*'([^']+)'/)
assert.ok(literal, 'proxy matcher found')
const pattern = new RegExp('^' + literal[1].replace(/\\\\/g, '\\') + '$')
const proxied = (path) => pattern.test(path)
for (const path of ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-maskable-512.png', '/apple-icon.png', '/icon.svg', '/favicon.ico', '/brand/absolute-comfort.svg'])
  assert.equal(proxied(path), false, `${path} must be public`)
for (const path of ['/', '/trips', '/receivables', '/receivables/inv-1', '/workday', '/login', '/settings'])
  assert.equal(proxied(path), true, `${path} must go through the auth proxy`)

const manifest = fs.readFileSync('app/manifest.ts', 'utf8')
for (const icon of manifest.matchAll(/src: '([^']+)'/g)) assert.ok(fs.existsSync('public' + icon[1]), `${icon[1]} exists`)
assert.match(manifest, /purpose: 'maskable'/, 'a maskable icon for Android home screens')
assert.ok(fs.existsSync('app/apple-icon.png'), 'an Apple touch icon')
console.log('PASS: manifest and icons stay public, pages stay behind the auth proxy, every listed icon exists.')
