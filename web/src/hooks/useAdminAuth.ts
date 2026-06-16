import { useAdminAuthContext } from '../context/AdminAuthContext';

export function useAdminAuth() {
  return useAdminAuthContext();
}

export async function adminLogout() {
  try {
    const res = await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' });
    if (res.ok) {
      window.location.href = '/admin/login';
    } else {
      console.error(`Logout failed: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error('Logout request failed', err);
  }
}
