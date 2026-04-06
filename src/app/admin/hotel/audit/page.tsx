import { Suspense } from 'react';
import AuditPage from '@/components/hotel/AuditPage';

export default function Page() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500">로딩 중...</div>}>
      <AuditPage />
    </Suspense>
  );
}
