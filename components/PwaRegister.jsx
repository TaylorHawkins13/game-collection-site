import Script from 'next/script';

// Registers public/sw.js — silently a no-op in browsers without service
// worker support (older Safari versions, some in-app browsers), and in
// dev it's fine for this to register too since the SW deliberately never
// touches API/Supabase requests.
//
// Deliberately a plain inline <script> (via next/script, strategy
// "afterInteractive") rather than a useEffect in a client component.
// Registering from inside a React effect only fires after the whole JS
// bundle has downloaded, parsed, and hydrated — a real delay that some
// PWA auditing tools (PWABuilder's scan flagged this specifically) can
// miss entirely if they check shortly after the page's load event.
// A plain script tag registers as soon as the page is interactive,
// independent of React's hydration timing.
export default function PwaRegister() {
  return (
    <Script id="register-sw" strategy="afterInteractive">
      {`
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js').catch(function () {});
        }
      `}
    </Script>
  );
}
