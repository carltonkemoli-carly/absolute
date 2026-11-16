// Runs every Node test in this folder. `npm test`.
// The PostgreSQL suite is separate: python3 tests/integrity.py local (or a Docker container name).
const { readdirSync } = require('node:fs')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const files = readdirSync(__dirname).filter((f) => f.endsWith('.cjs') && f !== 'run.cjs').sort()
let failed = 0
for (const file of files) {
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, file)], { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    console.log(`ok    ${file}  ${out.trim().split('\n').pop()}`)
  } catch (error) {
    failed++
    console.log(`FAIL  ${file}\n${(error.stderr || error.stdout || error.message).toString().trim()}\n`)
  }
}
console.log(`\n${files.length - failed} of ${files.length} test files passed.`)
process.exitCode = failed ? 1 : 0
