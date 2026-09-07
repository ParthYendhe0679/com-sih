import { redirect } from 'next/navigation';

export default function IntegrityRedirect() {
  redirect('/evidence?tab=integrity');
}
