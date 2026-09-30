import { NextResponse } from 'next/server';
import { getCardArtistWorks } from '@/lib/cardArtistLookup';

// TEMPORARY diagnostic route — same pattern app/api/lego-debug-temp used
// earlier this session to catch a silent wrong-field-shape bug live.
// Not meant to ship; remove once the /creator/cards/mtg/* "couldn't find
// that illustrator" mystery is actually understood.
export const maxDuration = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') || 'Rebecca Guay';
  const game = searchParams.get('game') || 'mtg';
  const startedAt = Date.now();
  try {
    const result = await getCardArtistWorks(name, game);
    return NextResponse.json({
      ms: Date.now() - startedAt,
      error: result.error || null,
      name: result.name,
      entryCount: Array.isArray(result.entries) ? result.entries.length : null,
      truncated: result.truncated,
      firstEntry: Array.isArray(result.entries) ? result.entries[0] : null,
    });
  } catch (e) {
    return NextResponse.json(
      { ms: Date.now() - startedAt, threw: true, message: String(e?.message || e), stack: String(e?.stack || '').split('\n').slice(0, 5) },
      { status: 500 }
    );
  }
}
