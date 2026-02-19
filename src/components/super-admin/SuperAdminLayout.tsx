import { Link, useLocation } from 'react-router-dom';
import { useSuperAdminAuth } from '@/contexts/SuperAdminAuthContext';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Building2, 
  LogOut, 
  Shield,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { to: '/super-admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/super-admin/tenants', icon: Building2, label: 'Empresas' },
];

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const location = useLocation();
  const { superAdmin, signOut } = useSuperAdminAuth();

  const isActive = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-[#1e2235] text-white">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold text-white">Super Admin</span>
              <p className="text-xs text-white/60">Portal</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const active = isActive(item.to, item.exact);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                    active 
                      ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                  {active && <ChevronRight className="ml-auto h-4 w-4" />}
                </Link>
              );
            })}
          </nav>

          {/* User & Logout */}
          <div className="border-t border-white/10 p-4">
            <div className="mb-3 px-2">
              <p className="text-sm font-medium text-white">{superAdmin?.name}</p>
              <p className="text-xs text-white/60">Super Admin</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-red-400 hover:bg-white/10 hover:text-red-300"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
