// One-off: apply schema.sql + seed.sql to a Postgres database.
// Usage: DATABASE_URL="postgresql://..." node scripts/apply-db.cjs
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) { console.error('Set DATABASE_URL'); process.exit(1) }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log('Connected.')

  for (const file of ['lib/schema.sql', 'lib/seed.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    console.log(`\n→ Applying ${file} …`)
    await client.query(sql)
    console.log(`✓ ${file} applied.`)
  }

  // Quick sanity counts
  const counts = await client.query(`
    select 'contractors' t, count(*) n from contractors
    union all select 'vehicles', count(*) from vehicles
    union all select 'drivers', count(*) from drivers
    union all select 'routes', count(*) from routes
    union all select 'organizations', count(*) from organizations
  `)
  console.log('\nSeeded rows:')
  counts.rows.forEach((r) => console.log(`  ${r.t}: ${r.n}`))

  await client.end()
  console.log('\nDone ✓')
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
