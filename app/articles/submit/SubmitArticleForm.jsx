'use client';

import { useState } from 'react';
import StarRating from '@/components/StarRating';

const STATUS_LABEL = {
  pending: 'Pending review',
  approved: 'Published',
  rejected: "Not published",
};

export default function SubmitArticleForm({ pastSubmissions }) {
  const [type, setType] = useState('review');
  const [title, setTitle] = useState('');
  const [dek, setDek] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!title.trim() || !dek.trim() || !body.trim()) {
      setError('Title, a one-line summary, and the body are all required.');
      return;
    }
    if (body.trim().length < 200) {
      setError('Give it a bit more — at least a few short paragraphs (200 characters min).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/articles/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title.trim(),
          dek: dek.trim(),
          body: body.trim(),
          rating: type === 'review' ? rating : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't submit that, try again in a bit.");
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <form className="form-card">
        <h1>Thanks!</h1>
        <p className="sub" style={{ marginBottom: 0 }}>
          Your {type} is in the queue for review. If it's approved, it'll show up on the Reviews &amp; Articles page
          under your name.
        </p>
      </form>
    );
  }

  return (
    <>
      <form className="form-card" onSubmit={handleSubmit}>
        <h1>Submit a review or article</h1>
        <p className="sub">
          Write about anything worth collecting. Every submission is reviewed before it goes live — you'll see it
          here once it's approved (or not).
        </p>

        <div className="field">
          <label htmlFor="submit-article-type">What is this?</label>
          <select id="submit-article-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="review">A review (with a star rating)</option>
            <option value="article">An article (no rating)</option>
          </select>
        </div>

        {type === 'review' && (
          <div className="field">
            <label>Your rating</label>
            <StarRating value={rating} size={26} interactive onChange={setRating} />
          </div>
        )}

        <div className="field">
          <label htmlFor="submit-article-title">Title</label>
          <input
            id="submit-article-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Tomb Raider: The Angel of Darkness Deserves a Second Look"
            maxLength={200}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="submit-article-dek">One-line summary</label>
          <input
            id="submit-article-dek"
            type="text"
            value={dek}
            onChange={(e) => setDek(e.target.value)}
            placeholder="The single sentence that sells someone on reading the rest"
            maxLength={200}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="submit-article-body">Body</label>
          <textarea
            id="submit-article-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            maxLength={8000}
            placeholder="Write it out — separate paragraphs with a blank line, same as writing an email."
            required
          />
        </div>

        {error && <div className="error-text">{error}</div>}

        <button className="btn-primary" type="submit" disabled={submitting} style={{ width: '100%', marginTop: 8 }}>
          {submitting ? 'Submitting…' : 'Submit for review'}
        </button>
      </form>

      {pastSubmissions.length > 0 && (
        <div className="home-articles" style={{ maxWidth: 680, margin: '32px auto 60px' }}>
          <h2 className="home-section-heading">Your submissions</h2>
          {pastSubmissions.map((s) => (
            <div className="home-whatsnew-row" key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>{s.title}</span>
              <span className={`submission-status submission-status-${s.status}`}>{STATUS_LABEL[s.status]}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
