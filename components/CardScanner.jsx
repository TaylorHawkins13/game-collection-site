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

// Grayscale + stretch contrast to the actual brightness range in the
// photo. Card art is often busy/colorful/glossy, which generic OCR
// (trained on plain documents) struggles with far more than it does
// with flat high-contrast text — this alone tends to matter more than
// resolution.
function preprocessForOcr(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;

  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }

  let min = 255;
  let max = 0;
  for (let p = 0; p < gray.length; p++) {
    if (gray[p] < min) min = gray[p];
    if (gray[p] > max) max = gray[p];
  }
  const range = Math.max(max - min, 1);

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const v = Math.round(((gray[p] - min) / range) * 255);
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

const NOISE_WORDS = new Set(['hp', 'lv', 'no', 'stage', 'basic', 'ex', 'gx', 'vmax']);

function guessCardName(rawText) {
  const lines = (rawText || '')
    .split('\n')
    .map((l) => l.replace(/[^\w\s'’,.\-]/g, '').trim())
    .filter(Boolean);

  // Score each line: real card names are a handful of words, mostly
  // letters, not a single short stat/keyword and not a card number
  // fraction. Prefer the best-looking line in the first several found,
  // rather than blindly taking whichever line OCR happened to read first
  // (which is often noise picked out of the card art/border).
  const candidates = lines
    .slice(0, 8)
    .map((line, index) => {
      const letters = (line.match(/[A-Za-z]/g) || []).length;
      const words = line.split(/\s+/).filter(Boolean);
      const isNoise = words.length === 1 && NOISE_WORDS.has(words[0].toLowerCase());
      const isFraction = /^\d+\s*\/\s*\d+$/.test(line);
      const score = letters - index * 2 - (isNoise || isFraction || letters < 3 ? 100 : 0);
      return { line, score };
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.line || lines[0] || '';
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
      preprocessForOcr(canvas);

      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker('eng');
      // Card layouts are scattered text (name, HP, abilities, flavor
      // text) over art, not one coherent paragraph — SPARSE_TEXT tells
      // Tesseract to look for isolated text blocks anywhere in the
      // image instead of assuming a normal page layout.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
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
