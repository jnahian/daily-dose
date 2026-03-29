import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface AdminUser {
  id: string;
  slackUserId: string;
  name: string;
  avatar: string | null;
}

interface AdminOrg {
  id: string;
  name: string;
  role: 'OWNER' | 'ADMIN';
}

interface AdminAuthState {
  user: AdminUser | null;
  isSuperAdmin: boolean;
  organizations: AdminOrg[];
  activeOrgId: string | null;
  isLoading: boolean;
  setActiveOrgId: (id: string) => void;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [organizations, setOrganizations] = useState<AdminOrg[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setUser(data.user);
          setIsSuperAdmin(data.isSuperAdmin);
          setOrganizations(data.organizations);
          if (data.organizations.length > 0) {
            setActiveOrgId(data.organizations[0].id);
          }
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AdminAuthContext.Provider value={{ user, isSuperAdmin, organizations, activeOrgId, isLoading, setActiveOrgId }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuthContext() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuthContext must be used within AdminAuthProvider');
  return ctx;
}
