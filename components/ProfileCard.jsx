import Link from 'next/link';

export default function ProfileCard({ profile }) {
  if (!profile) return null;
  return (
    <Link
      href={`/u/${profile.username}`}
      className="card"
      style={{ textDecoration: 'none', color: 'inherit', padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}
    >
      <div className="avatar" style={{ width: 48, height: 48, fontSize: 18, flexShrink: 0 }}>
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt={profile.username} />
        ) : (
          (profile.display_name || profile.username || '?').slice(0, 1).toUpperCase()
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--fs-md)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {profile.display_name || profile.username}
        </div>
        <div className="sub" style={{ margin: 0 }}>@{profile.username}</div>
      </div>
    </Link>
  );
}
