'use client';

import { useEffect, useRef, useState } from 'react';

// Unlike barcode scanning, individual trading cards don't have a
// scannable code on them — so this takes a still photo and runs OCR
// (tesseract.js, client-side, no key/signup needed) to read the card's
// name off it. That guess fills the Title field; the actual lookup
// still happens through the normal Search button, since OCR on a
// glossy/holo card is unreliable enough that auto-applying a result
// without a person checking it would do more harm than good.
//
// tesseract.js is dynamically imported only when a scan actually runs,
// so it doesn't add to everyone's initial page load.

function guessCardName(rawText) {
  const lines = (rawText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  // The name is almost always the first line with real letters in it —
  // stats, HP, and card numbers are mostly digits/symbols.
  const candidate = lines.find((l) => /[A-Za-z]{3,}/.test(l) && !/^\d+\s*\/\s*\d+$/.test(l));
  return (candidate || lines[0] || '').replace(/[^\w\s'’,.\-]/g, '').trim();
}

export default function CardScanner({ onCaptured, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);

  function hardStopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: 'continuous' }],
        },
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name === 'NotAllowedError') {
          setError('Camera access was blocked. Allow camera access for this site in your browser settings and try again.');
        } else if (err?.name === 'NotFoundError') {
          setError('No camera found on this device.');
        } else {
          setError('Could not start the camera. Try again, or fill the details in manually.');
        }
      });

    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
      hardStopCamera();
    };
  }, []);

  function handleClose() {
    hardStopCamera();
    onClose();
  }

  async function handleCapture() {
    if (!videoRef.current || reading) return;
    setReading(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);

      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const { data } = await worker.recognize(canvas);
      await worker.terminate();

      hardStopCamera();
      onCaptured(guessCardName(data.text));
    } catch {
      setReading(false);
      setError("Couldn't read that photo — try again with more light, or fill the details in manually.");
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !reading && handleClose()}>
      <div className="modal scanner-modal">
        <h2>Scan Card</h2>
        <div className="sub">Frame the whole card, hold steady, then capture.</div>

        {error ? (
          <div className="error-text">{error}</div>
        ) : (
          <>
            <div className="scanner-frame card-scanner-frame">
              <video ref={videoRef} className="scanner-video" muted playsInline autoPlay />
              <div className="scanner-guide card-scanner-guide" />
            </div>
            <div className="sub" style={{ marginTop: 8, marginBottom: 0 }}>
              {reading
                ? 'Reading the card… this can take a few seconds.'
                : "Good, even light and no glare on the card matters more than distance."}
            </div>
          </>
        )}

        <div className="modal-actions">
          <div />
          <div className="right">
            <button className="btn-ghost" type="button" onClick={handleClose} disabled={reading}>Cancel</button>
            {!error && (
              <button className="btn-primary" type="button" onClick={handleCapture} disabled={reading}>
                {reading ? 'Reading…' : 'Capture'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
