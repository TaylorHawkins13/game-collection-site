/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Apple's own docs for the Associated Domains file
  // (public/.well-known/apple-app-site-association — see that file and
  // lib/webauthnConfig.js for why it exists: passkey sign-in inside the
  // wrapped iOS app) say it must be served as `application/json`.
  // Next.js doesn't know the mime type for an extensionless static file,
  // so without this it's served as a generic `application/octet-stream`
  // (confirmed directly with a real production server + curl) — Apple's
  // fetcher tends to tolerate that in practice, but there's no reason to
  // rely on tolerance when getting the header right is one config block.
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ];
  },
};

module.exports = nextConfig;
