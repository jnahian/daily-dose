import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router';
import { AdminAuthProvider, useAdminAuthContext } from '../../context/AdminAuthContext';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopBar } from './AdminTopBar';

function AdminLayoutInner() {
  const { user, isLoading } = useAdminAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/admin/login');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f16] flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0a0f16] flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <AdminTopBar />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminLayout() {
  return (
    <AdminAuthProvider>
      <AdminLayoutInner />
    </AdminAuthProvider>
  );
}
