import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { FileUp, LogOut, ChevronDown, FolderOpen, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { primaryNav, financialNav, registrationNav, adminNav, type AppNavItem } from "@/config/navigation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TenantSwitcher } from "./TenantSwitcher";

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { tenant } = useTenant();
  const { hasAnyPermission, loading, permissions } = usePermissions();

  const filterNavItems = (items: AppNavItem[]) => {
    if (loading && permissions.length === 0) {
      return items;
    }
    return items.filter(item => {
      if (!item.module) return true;
      return hasAnyPermission(item.module);
    });
  };

  const visiblePrimaryNav = filterNavItems(primaryNav);
  const visibleFinancialNav = filterNavItems(financialNav);
  const visibleRegistrationNav = filterNavItems(registrationNav);
  const visibleAdminNav = filterNavItems(adminNav);

  // Check if any financial route is active
  const isFinancialRouteActive = financialNav.some(
    item => location.pathname === item.to
  );

  // Check if any registration route is active
  const isRegistrationRouteActive = registrationNav.some(
    item => location.pathname === item.to
  );

  const [isFinancialOpen, setIsFinancialOpen] = useState(isFinancialRouteActive);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(isRegistrationRouteActive);

  // Keep menu open when navigating to a financial route
  useEffect(() => {
    if (isFinancialRouteActive) {
      setIsFinancialOpen(true);
    }
  }, [isFinancialRouteActive]);

  // Keep menu open when navigating to a registration route
  useEffect(() => {
    if (isRegistrationRouteActive) {
      setIsRegistrationOpen(true);
    }
  }, [isRegistrationRouteActive]);

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar">
      {/* Logo and Tenant Switcher */}
      <div className="flex flex-col border-b border-sidebar-border">
        <div className="flex h-16 items-center gap-2 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <FileUp className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground truncate">
            {tenant?.name || 'MASTERSYSTEM'}
          </span>
        </div>
        <div className="px-3 pb-3">
          <TenantSwitcher />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Primary Navigation */}
        {visiblePrimaryNav.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Principal
            </h3>
            <div className="space-y-1">
              {visiblePrimaryNav.map((item) => {
                const isActive = location.pathname === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "sidebar-link",
                      isActive ? "sidebar-link-active" : "sidebar-link-inactive",
                    )}
                  >
                    {Icon ? <Icon className="h-5 w-5" /> : null}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Financial Navigation - Collapsible */}
        {visibleFinancialNav.length > 0 && (
          <div className="mb-6">
            <Collapsible open={isFinancialOpen} onOpenChange={setIsFinancialOpen}>
              <CollapsibleTrigger className="sidebar-link sidebar-link-inactive w-full justify-between group">
                <span className="flex items-center gap-3">
                  <Wallet className="h-5 w-5" />
                  Financeiro
                </span>
                <ChevronDown 
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isFinancialOpen && "rotate-180"
                  )} 
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 ml-4 space-y-1">
                {visibleFinancialNav.map((item) => {
                  const isActive = location.pathname === item.to;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "sidebar-link",
                        isActive ? "sidebar-link-active" : "sidebar-link-inactive",
                      )}
                    >
                      {Icon ? <Icon className="h-5 w-5" /> : null}
                      {item.label}
                    </Link>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Registration Navigation - Collapsible */}
        {visibleRegistrationNav.length > 0 && (
          <div className="mb-6">
            <Collapsible open={isRegistrationOpen} onOpenChange={setIsRegistrationOpen}>
              <CollapsibleTrigger className="sidebar-link sidebar-link-inactive w-full justify-between group">
                <span className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5" />
                  Cadastro
                </span>
                <ChevronDown 
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isRegistrationOpen && "rotate-180"
                  )} 
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 ml-4 space-y-1">
                {visibleRegistrationNav.map((item) => {
                  const isActive = location.pathname === item.to;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "sidebar-link",
                        isActive ? "sidebar-link-active" : "sidebar-link-inactive",
                      )}
                    >
                      {Icon ? <Icon className="h-5 w-5" /> : null}
                      {item.label}
                    </Link>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Admin Navigation */}
        {visibleAdminNav.length > 0 && (
          <div>
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Administração
            </h3>
            <div className="space-y-1">
              {visibleAdminNav.map((item) => {
                const isActive = location.pathname === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "sidebar-link",
                      isActive ? "sidebar-link-active" : "sidebar-link-inactive",
                    )}
                  >
                    {Icon ? <Icon className="h-5 w-5" /> : null}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Logout */}
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={signOut}
          className="sidebar-link sidebar-link-inactive w-full text-destructive/80 hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </aside>
  );
}
