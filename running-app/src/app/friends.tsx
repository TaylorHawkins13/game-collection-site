// Friends now lives in the Feed tab; keep this route so older links still work.
import { Redirect } from 'expo-router';

export default function Friends() {
  return <Redirect href="/feed" />;
}
