'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function FollowButton({ profileId, initialFollowing }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function toggle() {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    if (following) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profileId);
      setFollowing(false);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: profileId });
      setFollowing(true);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <button className={following ? 'btn-ghost' : 'btn-primary'} onClick={toggle} disabled={busy} type="button">
      {following ? 'Following' : '+ Follow'}
    </button>
  );
}
