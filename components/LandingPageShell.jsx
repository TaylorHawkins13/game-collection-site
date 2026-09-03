import Link from 'next/link';
import { LANDING_PAGES } from '@/lib/landingPages';

// Shared visual template for the small set of dedicated SEO landing
// pages (see lib/landingPages.js for the content/reasoning, and
// ROADMAP.md's "SEO landing pages for specific searches"). Deliberately
// reuses existing, already-shipped layout pieces rather than inventing
// new ones: .home-hub-greeting for the header (same as the logged-in
// home page's greeting), a plain .grid/.card grid for feature blurbs
// (same classes the "Owned by" grid on /collectible already uses), and
// <details>/<summary> for the FAQ (same pattern ImportCsvModal's
// warnings list already uses) — so this doesn't need any new CSS, and
// stays visually consistent with the rest of the site instead of
// reading as a bolted-on marketing page.
//
// Emits FAQPage structured data (JSON-LD) from the same faq array
// rendered on the page, so search engines have a shot at an FAQ rich
// result — free SEO value from content that's already being written and
// displayed anyway, not a separate thing to maintain.
export default function LandingPageShell({ data }) {
  // Cross-links every landing page to the other three. Two jobs: lets a
  // real visitor who landed on the "wrong" one for their actual
  // collection self-route to the right one, and — just as important —
  // keeps all four pages reachable purely by clicking through the site,
  // not only by whatever ends up listed in sitemap.xml.
  const otherPages = Object.values(LANDING_PAGES).filter((p) => p.slug !== data.slug);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <main className="container" style={{ maxWidth: 880 }}>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div className="home-hub-greeting">
        <span className="category-pill">{data.eyebrow}</span>
        <h1 style={{ marginTop: 10 }}>{data.h1}</h1>
        <p className="sub" style={{ maxWidth: 640 }}>{data.intro}</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
          <Link href="/signup" className="btn-primary" style={{ textDecoration: 'none', padding: '12px 22px', display: 'inline-block' }}>
            {data.ctaText}
          </Link>
          <Link href="/players" className="btn-ghost" style={{ textDecoration: 'none', padding: '12px 22px', display: 'inline-block' }}>
            Browse collectors
          </Link>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: 40 }}>
        {data.features.map((f) => (
          <div className="card" key={f.title} style={{ padding: 18 }}>
            <div className="value-title" style={{ fontSize: 'var(--fs-xl)' }}>{f.title}</div>
            <p className="sub" style={{ margin: 0 }}>{f.body}</p>
          </div>
        ))}
      </div>

      <h2 className="profile-list-heading">Frequently asked</h2>
      <div style={{ marginBottom: 32 }}>
        {data.faq.map((f) => (
          <details key={f.q} style={{ marginBottom: 8 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '10px 0' }}>{f.q}</summary>
            <p className="sub" style={{ margin: '0 0 10px' }}>{f.a}</p>
          </details>
        ))}
      </div>

      <div className="cta-band">
        <div className="cta-band-title">Ready to catalog your collection?</div>
        <div className="cta-band-text">
          It&apos;s free, takes a minute to set up, and your shelf is yours to make public or keep private.
        </div>
        <Link href="/signup" className="btn-primary" style={{ textDecoration: 'none', padding: '12px 22px', display: 'inline-block' }}>
          {data.ctaText}
        </Link>
      </div>

      <h2 className="profile-list-heading">Also on Shelf Life</h2>
      <div className="category-pills" style={{ marginBottom: 40 }}>
        {otherPages.map((p) => (
          <Link key={p.slug} href={`/${p.slug}`} className="category-pill" style={{ textDecoration: 'none' }}>
            {p.title}
          </Link>
        ))}
      </div>
    </main>
  );
}
