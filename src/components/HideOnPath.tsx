'use client';

import { usePathname } from 'next/navigation';

// 특정 화면(예: /ko/reserve)에서 떠 있는 버튼·바를 숨긴다. segment 는 로케일 뒤 경로.
export default function HideOnPath({ segment, children }: { segment: string; children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const rest = pathname.split('/').slice(2).join('/'); // '/ko/reserve' → 'reserve'
  if (rest === segment || rest.startsWith(`${segment}/`)) return null;
  return <>{children}</>;
}
