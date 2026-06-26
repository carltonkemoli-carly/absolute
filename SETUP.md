# Absolute Comfort Travel — Setup

Internal operations & finance system. Next.js 16 + Supabase + Tailwind.

## 1. Create a Supabase project
1. Go to <https://supabase.com> → **New project** (name it e.g. `absolute-comfort`). Pick a region close to Kenya (e.g. EU/Frankfurt). Save the database password.
2. When it's ready, open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key
   - **service_role** key (keep secret)

## 2. Add the keys
Paste them into `.env.local` in this folder:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 3. Create the database
In the Supabase dashboard → **SQL Editor**:
1. Open `lib/schema.sql` from this project, paste the whole thing, **Run**.
2. Open `lib/seed.sql`, paste, **Run** (loads the real fleet, drivers, BCD/FCM/Absolute, and client orgs).

## 4. (Recommended) Turn off email confirmation for staff
Supabase → **Authentication → Providers → Email** → turn **Confirm email** off, so office staff can sign in immediately. (Or leave on and confirm via email.)

## 5. Run it
```
npm run dev
```
Open <http://localhost:3100>. **The first account you create becomes the Owner** (full access). Create your mom's account first, then add other staff and set their roles.

## Roles
- **owner** — everything, incl. managing users
- **accountant** — finances, billing, reports
- **office / driver** — reserved for later phases (no finance access)

Change a user's role for now in Supabase → **Table editor → profiles → role**.
