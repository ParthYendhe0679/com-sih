'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function IntelligenceCaseRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.id) {
      router.replace(`/cases/${params.id}`);
    }
  }, [params, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      <p className="text-[13.5px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
        Loading Case Intelligence Workspace…
      </p>
    </div>
  );
}
