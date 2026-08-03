'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';

export default function CommentSection({ profileId, initialComments, canComment }) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const supabase = createClient();

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
    if (!error && data) {
      setComments((c) => [data, ...c]);
      setBody('');
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
            </div>
            <div>{c.body}</div>
          </div>
        ))
      )}
    </div>
  );
}
