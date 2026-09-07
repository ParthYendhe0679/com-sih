import { redirect } from 'next/navigation';

export default function HotspotsRedirect() {
  redirect('/analytics?tab=hotspots');
}
