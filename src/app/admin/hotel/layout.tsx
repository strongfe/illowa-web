import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import HotelAdminLayout from '@/components/hotel/HotelAdminLayout';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;

  if (session !== process.env.ADMIN_PASSWORD) {
    redirect('/admin');
  }

  return <HotelAdminLayout>{children}</HotelAdminLayout>;
}
