import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'Absolute Comfort Travel — Operations',
  description: 'Bookings, fleet, fuel and finance for Absolute Comfort Travel.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('theme')?.value === 'dark' ? 'dark' : 'light'
  return (
    <html lang="en" data-theme={theme} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'var(--font-geist-sans), sans-serif',
              fontSize: '13px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              color: 'var(--ink)',
              border: '1px solid var(--border-med)',
              boxShadow: 'var(--shadow-md)',
            },
          }}
        />
      </body>
    </html>
  )
}
