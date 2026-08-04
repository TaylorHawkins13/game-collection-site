// Google requires an ads.txt file listing which ad networks are authorized
// to sell your inventory, or it'll flag/limit ad serving. Serving it from
// this env-var-driven route means it "just works" once
// NEXT_PUBLIC_ADSENSE_CLIENT_ID is set — no separate static file to
// remember to add.

export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  if (!clientId) {
    return new Response('', { status: 404 });
  }
  // AdSense client IDs look like "ca-pub-XXXXXXXXXXXXXXXX"; ads.txt wants
  // just the "pub-XXXXXXXXXXXXXXXX" part.
  const pubId = clientId.replace(/^ca-/, '');
  const body = `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
