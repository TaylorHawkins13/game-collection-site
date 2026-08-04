'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

// Uses @zxing/browser instead of the native BarcodeDetector API because
// BarcodeDetector isn't implemented in Safari or any browser on iOS —
// zxing works everywhere since it decodes frames itself rather than
// relying on a native browser API.

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err, controls) => {
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
          <div className="scanner-frame">
            <video ref={videoRef} className="scanner-video" muted playsInline />
            <div className="scanner-guide" />
          </div>
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
