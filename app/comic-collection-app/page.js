import LandingPageShell from '@/components/LandingPageShell';
import { getLandingPage } from '@/lib/landingPages';

const data = getLandingPage('comic-collection-app');

// See lib/landingPages.js for the content/reasoning and
// components/LandingPageShell.jsx for the shared template.
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

export default function ComicCollectionAppPage() {
  return <LandingPageShell data={data} />;
}
