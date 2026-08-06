import Link from 'next/link';
import { TYPE_LABELS } from '@/lib/mosaicData';

// A search-result tile for one deduped collectible (one card per
// distinct title+type, not one per collector who owns it — see
// PlayersClient.jsx for how results get deduped/counted before this
// ever renders).
export default function CollectibleCard({ item }) {
  const href = `/collectible?type=${encodeURIComponent(item.item_type)}&title=${encodeURIComponent(item.title)}`;
  return (
    <Link href={href} className="card clickable" style={{ textDecoration: 'none', color: 'inherit' }}>
      {item.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="cover" src={item.cover} alt={item.title} />
      ) : (
        <div className="cover placeholder">No Cover</div>
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </div>
        <div className="sub" style={{ margin: '2px 0 0' }}>
          {TYPE_LABELS[item.item_type] || item.item_type} · {item.count} collector{item.count === 1 ? '' : 's'}
        </div>
      </div>
    </Link>
  );
}
