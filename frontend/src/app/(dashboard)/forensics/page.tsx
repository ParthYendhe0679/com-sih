import { redirect } from 'next/navigation';

export default function ForensicsRedirect() {
  redirect('/evidence?tab=forensics');
}
