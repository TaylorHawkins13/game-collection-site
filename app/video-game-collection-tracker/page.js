import LandingPageShell from '@/components/LandingPageShell';
import { getLandingPage } from '@/lib/landingPages';

const data = getLandingPage('video-game-collection-tracker');

// See lib/landingPages.js for the content/reasoning and
// components/LandingPageShell.jsx for the shared template. Static (no
// Supabase calls) on purpose — pure content/entry page, cheaply
// cacheable, nothing here needs to be fresh per-request.
export const metadata = {
  title: data.title,
  description: data.metaDescription,
  openGraph: {
    title: data.title,
    description: data.metaDescription,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: data.title,
    description: data.metaDescription,
  },
};

export default function VideoGameCollectionTrackerPage() {
  return <LandingPageShell data={data} />;
}
