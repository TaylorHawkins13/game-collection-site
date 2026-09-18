/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Apple's own docs for the Associated Domains file (now served by
  // app/.well-known/apple-app-site-association/route.js and
  // app/apple-app-site-association/route.js — see those files and
  // lib/webauthnConfig.js for why it exists: passkey sign-in inside the
  // wrapped iOS app) say it must come back as `application/json`. Both
  // route handlers already set that header themselves via Response.json()
  // + an explicit header, so this is pure defense-in-depth left over from
  // when this was a plain static file under public/ with no built-in mime
  // mapping for an extensionless file (confirmed directly at the time: it
  // served as a generic `application/octet-stream` without this). Costs
  // nothing to leave in even though the route handlers no longer need it.
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
      {
        source: '/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ];
  },
};

module.exports = nextConfig;
