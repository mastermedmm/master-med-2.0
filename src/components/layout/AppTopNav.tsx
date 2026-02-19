import { NavLink } from "@/components/NavLink";
import { topNav } from "@/config/navigation";

export function AppTopNav() {
  return (
    <nav aria-label="Navegação principal" className="w-full">
      <div className="flex overflow-x-auto">
        {topNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 whitespace-nowrap border-b-2 border-transparent transition-colors"
            activeClassName="text-primary border-primary bg-muted/30"
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
