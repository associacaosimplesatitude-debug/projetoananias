import { NavLink } from '@/components/NavLink';
import { Church, Users, TrendingUp, TrendingDown, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Navigation = () => {
  const navItems = [
    {
      to: '/',
      icon: Church,
      label: 'Abertura',
      exact: true,
    },
    {
      to: '/members',
      icon: Users,
      label: 'Membros',
    },
    {
      to: '/entries',
      icon: TrendingUp,
      label: 'Entradas',
    },
    {
      to: '/expenses',
      icon: TrendingDown,
      label: 'Despesas',
    },
    {
      to: '/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
    },
  ];

  return (
    <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center h-16 gap-8">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Church className="h-6 w-6 text-primary" />
            <span className="hidden sm:inline">Sistema Igreja</span>
          </div>
          
          <div className="flex items-center gap-1 flex-1 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                  'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
                activeClassName="text-primary bg-primary/10"
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};
