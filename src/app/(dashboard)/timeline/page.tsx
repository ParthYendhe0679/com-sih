import { redirect } from 'next/navigation';

export default function TimelinePageRedirect() {
  redirect('/cases/CASE-102?tab=timeline');
}
