import { redirect } from 'next/navigation';

export default function PredictiveRedirect() {
  redirect('/analytics?tab=patterns');
}
