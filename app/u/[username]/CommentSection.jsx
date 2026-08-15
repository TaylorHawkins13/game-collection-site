'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import { announceTrophies } from '@/lib/trophyToast';
import { announceToast } from '@/lib/toast';
import { notifyTrophies } from '@/lib/notifyTrophies';

export default function CommentSection({ profileId, initialComments, canComment }) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [reportedIds, setReportedIds] = useState(new Set());
  const [reportingId, setReportingId] = useState(null);
  const supabase = createClient();

  // Smallest real version of "report a comment" (see ROADMAP.md) — one
  // click, no reason text, immediately files it via /api/reports and
  // swaps that comment's link to a disabled "Reported" state. Only
  // rendered when `canComment` is true (a signed-in viewer) — the route
  // itself requires sign-in regardless.
  async function reportComment(commentId) {
    if (reportedIds.has(commentId) || reportingId === commentId) return;
    setReportingId(commentId);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'comment', targetId: commentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      setReportedIds((s) => new Set(s).add(commentId));
      announceToast("Comment reported — thanks, we'll take a look.", 'success');
    } catch (err) {
      announceToast(
        err.message && err.message !== 'Failed' ? err.message : "Couldn't report that — try again in a moment."
      );
    } finally {
      setReportingId(null);
    }
  }

  async function post() {
    const text = body.trim();
    if (!text) return;
    setPosting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setPosting(false);
      return;
    }
    const { data, error } = await supabase
      .from('comments')
      .insert({ profile_id: profileId, author_id: user.id, body: text })
      .select('id, body, created_at, author:profiles!comments_author_id_fkey(username, display_name, avatar_url)')
      .single();
    setPosting(false);
    if (error?.message?.includes('rate_limited')) {
      announceToast("You're posting too fast — wait a few minutes and try again.");
      return;
    }
    if (!error && data) {
      setComments((c) => [data, ...c]);
      setBody('');
      if (profileId !== user.id) {
        supabase
          .from('notifications')
          .insert({ user_id: profileId, actor_id: user.id, type: 'comment', comment_id: data.id })
          .then(({ error: notifyError }) => {
            if (notifyError) console.error('comment notification insert failed', notifyError);
          });
      }
      supabase.rpc('check_and_award_achievements', { p_user_id: user.id }).then(({ data: newTrophies }) => {
        announceTrophies(newTrophies);
        notifyTrophies(supabase, user.id, newTrophies);
      });
    } else {
      announceToast("Couldn't post that comment — try again in a moment.");
    }
  }

  return (
    <div>
      {canComment ? (
        <div className="field" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Leave a comment…"
            maxLength={500}
            style={{ flex: 1, minHeight: 44 }}
          />
          <button className="btn-primary" onClick={post} disabled={posting || !body.trim()} type="button">
            Post
          </button>
        </div>
      ) : (
        <div className="sub" style={{ marginBottom: 12 }}>
          <Link href="/login">Log in</Link> to leave a comment.
        </div>
      )}

      {comments.length === 0 ? (
        <div className="sub">No comments yet.</div>
      ) : (
        comments.map((c) => (
          <div className="comment" key={c.id}>
            <div className="comment-meta">
              {c.author?.username ? (
                <Link href={`/u/${c.author.username}`}>{c.author.display_name || c.author.username}</Link>
              ) : (
                'Someone'
              )}
              {' · '}
              {new Date(c.created_at).toLocaleDateString()}
              {canComment && (
                <>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => reportComment(c.id)}
                    disabled={reportedIds.has(c.id) || reportingId === c.id}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      font: 'inherit',
                      color: 'inherit',
                      textDecoration: 'underline',
                      cursor: reportedIds.has(c.id) ? 'default' : 'pointer',
                      opacity: reportedIds.has(c.id) ? 0.6 : 1,
                    }}
                  >
                    {reportedIds.has(c.id) ? 'Reported' : 'Report'}
                  </button>
                </>
              )}
            </div>
            <div>{c.body}</div>
          </div>
        ))
      )}
    </div>
  );
}
