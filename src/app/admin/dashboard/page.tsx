import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AdminDashboard from '@/components/AdminDashboard';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;

  if (session !== process.env.ADMIN_PASSWORD) {
    redirect('/admin');
  }

  return <AdminDashboard />;
}
