'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

// Uses @zxing/browser instead of the native BarcodeDetector API because
// BarcodeDetector isn't implemented in Safari or any browser on iOS —
// zxing works everywhere since it decodes frames itself rather than
// relying on a native browser API.
//
// Two tweaks that matter a lot for real-world UPC/EAN reliability:
// - Restricting to the actual retail barcode formats (rather than the
//   default "try literally everything including QR/DataMatrix") makes
//   the 1D decoder path noticeably more accurate, not just faster.
// - Requesting a higher-resolution stream with continuous autofocus
//   (where the browser supports it) avoids the blurry-up-close problem
//   most phone cameras have by default at typical barcode distance.

const RETAIL_FORMATS = [
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.ITF,
];

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, RETAIL_FORMATS);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });

    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        advanced: [{ focusMode: 'continuous' }],
      },
    };

    reader
      .decodeFromConstraints(constraints, videoRef.current, (result, err, controls) => {
        controlsRef.current = controls;
        if (cancelled) return;
        if (result) {
          controls.stop();
          onDetected(result.getText());
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name === 'NotAllowedError') {
          setError('Camera access was blocked. Allow camera access for this site in your browser settings and try again.');
        } else if (err?.name === 'NotFoundError') {
          setError('No camera found on this device.');
        } else {
          setError('Could not start the camera. Try again, or type the barcode in manually.');
        }
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    controlsRef.current?.stop();
    onClose();
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal scanner-modal">
        <h2>Scan Barcode</h2>
        <div className="sub">Point your camera at the barcode — it fills in automatically once found.</div>

        {error ? (
          <div className="error-text">{error}</div>
        ) : (
          <>
            <div className="scanner-frame">
              <video ref={videoRef} className="scanner-video" muted playsInline />
              <div className="scanner-guide" />
            </div>
            <div className="sub" style={{ marginTop: 8, marginBottom: 0 }}>
              Hold steady, fill the box with the barcode, and make sure there's good light — that matters more than distance.
            </div>
          </>
        )}

        <div className="modal-actions">
          <div />
          <div className="right">
            <button className="btn-ghost" type="button" onClick={handleClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
