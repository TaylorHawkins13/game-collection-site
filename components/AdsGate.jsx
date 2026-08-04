'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

const CONSENT_KEY = 'shelf-life-ad-consent';

// Gates loading the Google AdSense script behind a cookie-consent decision.
// Google's EU User Consent Policy requires publishers to get consent
// before showing personalized ads to EEA/UK visitors — this is a simple
// accept/decline banner rather than a full IAB-certified consent platform,
// which is the honest baseline for a small site (worth revisiting with a
// proper CMP if this ever grows well beyond a friends-and-family project).
//
// Renders nothing at all if ads aren't configured on this deployment yet
// (no NEXT_PUBLIC_ADSENSE_CLIENT_ID set) — so this is safe to always
// include in the layout.
export default function AdsGate() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const [consent, setConsent] = useState(undefined); // undefined = still loading from storage

  useEffect(() => {
    setConsent(typeof window !== 'undefined' ? localStorage.getItem(CONSENT_KEY) : null);
  }, []);

  function decide(value) {
    localStorage.setItem(CONSENT_KEY, value);
    setConsent(value);
  }

  if (!clientId || consent === undefined) return null;

  return (
    <>
      {consent === 'accepted' && (
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}
      {consent === null && (
        <div className="cookie-banner">
          <span>
            This site shows ads to help cover hosting costs, using cookies for ad personalization. See our{' '}
            <a href="/privacy">Privacy Policy</a>.
          </span>
          <div className="cookie-banner-actions">
            <button type="button" className="btn-ghost" onClick={() => decide('declined')}>
              Decline
            </button>
            <button type="button" className="btn-primary" onClick={() => decide('accepted')}>
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}
