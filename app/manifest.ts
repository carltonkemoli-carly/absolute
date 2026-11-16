import type { MetadataRoute } from 'next'

// Lets the app be added to a phone's home screen and open full-screen like an
// installed app. Served at /manifest.webmanifest, which the auth proxy leaves
// public: browsers fetch it without cookies, so a login redirect would break it.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Absolute Comfort Travel · Operations',
    short_name: 'Absolute',
    description: 'Trips, dispatch, fleet and finance for Absolute Comfort Travel.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F3F5FA',
    theme_color: '#354DA4',
    lang: 'en-KE',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Today’s work', url: '/workday' },
      { name: 'Dispatch', url: '/dispatch' },
      { name: 'Trips', url: '/trips' },
    ],
  }
}
