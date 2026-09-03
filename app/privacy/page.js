export const metadata = {
  title: 'Privacy Policy — Shelf Life',
};

export default function PrivacyPage() {
  return (
    <main className="container" style={{ maxWidth: 720, padding: '40px 20px' }}>
      <h1 style={{ fontSize: 'var(--fs-5xl)', marginBottom: 4 }}>Privacy Policy</h1>
      <p className="sub" style={{ marginBottom: 28 }}>Last updated: {new Date().toLocaleDateString()}</p>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)' }}>What we collect</h2>
        <p>
          When you create an account, we store the email and password you sign up with (handled by our
          authentication provider, Supabase — we never see or store your password in plain text), plus whatever
          profile info you choose to add: username, display name, bio, and avatar image. Your collection data
          (the items you add, their details, and any photos/cover art URLs you provide) is stored the same way.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)' }}>Cookies</h2>
        <p>
          We use a session cookie to keep you signed in — that one's required for the site to work and isn't
          optional. If you accept the ads cookie banner, Google AdSense also sets cookies to serve and
          personalize ads; you can decline that banner and the site will still work normally, just without
          personalized ads.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)' }}>Third-party services</h2>
        <p>This site relies on a few external services to work:</p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li><strong>Supabase</strong> — hosts our database, authentication, and file storage (avatars).</li>
          <li><strong>Google AdSense</strong> — serves ads, if you've accepted the cookie banner. Google's own privacy policy covers what they do with ad-related data.</li>
          <li>
            <strong>IGDB / Twitch, eBay, Open Library, the Pokémon TCG API, and Scryfall</strong> — used for
            auto-fill and price-lookup features. When you use Search or Check eBay price, the search term you're
            looking up is sent to the relevant service to fetch results. No account or personal information is
            sent along with those requests.
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)' }}>Public vs. private data</h2>
        <p>
          Your profile defaults to public — your collection, follower/following lists, and comments are visible
          to anyone. You can switch your profile to private in Settings at any time, which hides your
          collection and removes it from the leaderboard (your username and the fact that you have an account
          may still be discoverable).
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)' }}>Your data, your choice</h2>
        <p>
          Want your account or data deleted, or have any other privacy question? Reach out at{' '}
          <a href="mailto:taylorbobbysaunders@outlook.com">taylorbobbysaunders@outlook.com</a> and we'll take care
          of it.
        </p>
      </section>

      <p className="sub">
        This is a small, independently-run hobby project rather than a company with a legal department — this
        policy is written to be plain and accurate about what actually happens, not a template.
      </p>
    </main>
  );
}
