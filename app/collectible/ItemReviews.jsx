'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import { announceToast } from '@/lib/toast';
import { averageRating } from '@/lib/itemReviews';
import StarRating from '@/components/StarRating';

// Per-item reviews (ROADMAP.md "Per-item reviews (separate from personal
// rating)") — a star rating plus real written text, one per reviewer per
// item, shown alongside the collectible detail page's existing
// aggregated stats. Modeled directly on CommentSection.jsx: a signed-in
// viewer posts straight through the browser Supabase client, protected
// by item_reviews' own RLS policies rather than a dedicated API route —
// there's no secret-generation step here the way there was for API
// tokens, so the simpler direct-client pattern applies.
//
// `canReview` reflects whether the viewer currently has this exact item
// logged with ownership = 'owned' — the same thing item_reviews' insert
// policy itself checks, computed here from data the page already loaded
// so posting a review that the database would reject never gets offered
// in the first place. It only gates *new* reviews; someone who already
// left one keeps the ability to edit or delete it even if they later
// mark the item sold or remove it, same as the rest of this project
// treats existing content when the thing that qualified it changes.
export default function ItemReviews({ itemType, title, initialReviews, viewerId, canReview }) {
  const [reviews, setReviews] = useState(initialReviews);
  const ownReview = reviews.find((r) => r.user_id === viewerId) || null;

  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(ownReview?.rating || 0);
  const [body, setBody] = useState(ownReview?.body || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();

  const others = reviews.filter((r) => r.id !== ownReview?.id);
  const avg = averageRating(reviews);

  function startEditing() {
    setRating(ownReview?.rating || 0);
    setBody(ownReview?.body || '');
    setEditing(true);
  }

  async function save() {
    const text = body.trim();
    if (!text || rating <= 0) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const query = ownReview
      ? supabase.from('item_reviews').update({ rating, body: text }).eq('id', ownReview.id)
      : supabase.from('item_reviews').insert({ user_id: user.id, item_type: itemType, title, rating, body: text });

    const { data, error } = await query
      .select('id, user_id, rating, body, created_at, updated_at, author:profiles!item_reviews_user_id_fkey(username, display_name, avatar_url)')
      .single();

    setSaving(false);
    if (error?.message?.includes('rate_limited')) {
      announceToast("You're posting too fast — wait a few minutes and try again.");
      return;
    }
    if (error?.code === '23505') {
      announceToast("You've already reviewed this item — edit your existing review instead.");
      return;
    }
    if (error || !data) {
      announceToast("Couldn't save that review — try again in a moment.");
      return;
    }

    setReviews((list) => [data, ...list.filter((r) => r.id !== data.id)]);
    setEditing(false);
    announceToast(ownReview ? 'Review updated.' : 'Review posted.', 'success');
  }

  async function remove() {
    if (!ownReview) return;
    setDeleting(true);
    const { error } = await supabase.from('item_reviews').delete().eq('id', ownReview.id);
    setDeleting(false);
    if (error) {
      announceToast("Couldn't delete that review — try again in a moment.");
      return;
    }
    setReviews((list) => list.filter((r) => r.id !== ownReview.id));
    setEditing(false);
    announceToast('Review deleted.', 'success');
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 className="profile-list-heading">
        Reviews{reviews.length > 0 ? ` (${reviews.length})` : ''}
        {avg != null && (
          <span className="sub" style={{ fontWeight: 400, marginLeft: 8 }}>
            avg {avg.toFixed(1)}★
          </span>
        )}
      </h3>

      {editing ? (
        <div className="comment" style={{ marginBottom: 14 }}>
          <div style={{ marginBottom: 8 }}>
            <StarRating value={rating} interactive size={20} onChange={setRating} />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you think of this one?"
            maxLength={1000}
            style={{ width: '100%', minHeight: 70 }}
          />
          <div className="toolbar" style={{ marginTop: 8, marginBottom: 0 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={save}
              disabled={saving || !body.trim() || rating <= 0}
            >
              {saving ? 'Saving…' : 'Save review'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            {ownReview && (
              <button type="button" className="btn-ghost" onClick={remove} disabled={deleting || saving}>
                {deleting ? 'Deleting…' : 'Delete review'}
              </button>
            )}
          </div>
        </div>
      ) : ownReview ? (
        <div className="toolbar" style={{ marginTop: 0, marginBottom: 14 }}>
          <button type="button" className="btn-ghost" onClick={startEditing}>
            Edit your review
          </button>
        </div>
      ) : canReview ? (
        <div className="toolbar" style={{ marginTop: 0, marginBottom: 14 }}>
          <button type="button" className="btn-ghost" onClick={startEditing}>
            + Write a review
          </button>
        </div>
      ) : viewerId ? (
        <p className="sub" style={{ margin: '0 0 14px' }}>
          Add this to your shelf as owned to leave a review.
        </p>
      ) : (
        <p className="sub" style={{ margin: '0 0 14px' }}>
          <Link href="/login">Log in</Link> to leave a review.
        </p>
      )}

      {others.length === 0 && !ownReview ? (
        <p className="sub">No reviews yet.</p>
      ) : (
        others.map((r) => (
          <div className="comment" key={r.id}>
            <div className="comment-meta">
              {r.author?.username ? (
                <Link href={`/u/${r.author.username}`}>{r.author.display_name || r.author.username}</Link>
              ) : (
                'Someone'
              )}
              {' · '}
              <StarRating value={Number(r.rating)} size={11} />
              {' · '}
              {new Date(r.updated_at || r.created_at).toLocaleDateString()}
            </div>
            <div>{r.body}</div>
          </div>
        ))
      )}
    </div>
  );
}
