import FeedbackForm from './FeedbackForm';

export const metadata = {
  title: 'Feedback — Shelf Life',
  description: 'Report a bug, flag an issue, or suggest a feature for Shelf Life.',
};

export default function FeedbackPage() {
  return (
    <main className="container">
      <FeedbackForm />
    </main>
  );
}
