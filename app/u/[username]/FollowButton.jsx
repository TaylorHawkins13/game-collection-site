'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { announceTrophies } from '@/lib/trophyToast';
import { announceToast } from '@/lib/toast';

export default function FollowButton({ profileId, initialFollowing }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function toggle() {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      router.push('/login');
      return;
    }
    if (following) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', profileId);
      if (error) {
        announceToast("Couldn't unfollow — try again in a moment.");
      } else {
        setFollowing(false);
      }
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: profileId });
      if (error) {
        announceToast("Couldn't follow — try again in a moment.");
      } else {
        setFollowing(true);
        supabase.rpc('check_and_award_achievements', { p_user_id: user.id }).then(({ data }) => {
          announceTrophies(data);
        });
      }
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
