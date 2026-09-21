import Link from 'next/link';
import Image from 'next/image';

// A tile in the /lists directory — one public custom list, not one
// collector (see components/ProfileCard.jsx for that). Shows the list's
// name, its owner, a representative cover pulled from one of its items,
// and how many items are in it.
export default function PublicListCard({ list }) {
  return (
    <Link href={`/lists/${list.id}`} className="card clickable" style={{ textDecoration: 'none', color: 'inherit' }}>
      {list.cover ? (
        <div className="card-cover-wrap">
          <Image
            className="cover"
            src={list.cover}
            alt=""
            fill
            sizes="220px"
            style={{ objectFit: 'cover' }}
            onError={(e) => {
              e.currentTarget.parentElement.outerHTML = '<div class="cover placeholder">No Cover</div>';
            }}
            unoptimized={list.cover.startsWith('data:')}
          />
        </div>
      ) : (
        <div className="cover placeholder">No Cover</div>
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--fs-md)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {list.name}
        </div>
        <div className="sub" style={{ margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="avatar" style={{ width: 18, height: 18, fontSize: 9, flexShrink: 0 }}>
            {list.avatar_url ? (
              <Image src={list.avatar_url} alt="" fill sizes="18px" style={{ objectFit: 'cover' }} />
            ) : (
              (list.display_name || list.username || '?').slice(0, 1).toUpperCase()
            )}
          </div>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {list.display_name || list.username}
          </span>
          <span>· {list.item_count} item{list.item_count === 1 ? '' : 's'}</span>
        </div>
      </div>
    </Link>
  );
}
