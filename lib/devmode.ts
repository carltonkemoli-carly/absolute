// Dev/demo mode is ON automatically whenever Supabase isn't configured.
// Add real keys to .env.local and it switches to the real database with no
// code changes. You can also force it with NEXT_PUBLIC_DEV_MODE=true.
export const DEV_MODE =
  process.env.NEXT_PUBLIC_DEV_MODE === 'true' ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL
