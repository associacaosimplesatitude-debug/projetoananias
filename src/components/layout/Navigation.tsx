import { NavLink } from '@/components/NavLink';
import { Church, Users, TrendingUp, TrendingDown, LayoutDashboard, Building, CheckSquare, DollarSign, LogOut, UserCog, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

export const Navigation = () => {
  const { role, signOut } = useAuth();

  const clientNavItems = [
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
      to: '/church-members',
      icon: UserPlus,
      label: 'Usuários',
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

  const adminNavItems = [
    {
      to: '/admin',
      icon: LayoutDashboard,
      label: 'Dashboard',
      exact: true,
    },
    {
      to: '/admin/clients',
      icon: Building,
      label: 'Clientes',
    },
    {
      to: '/admin/tasks',
      icon: CheckSquare,
      label: 'Tarefas',
    },
    {
      to: '/admin/users',
      icon: UserCog,
      label: 'Usuários',
    },
    {
      to: '/admin/receivable',
      icon: DollarSign,
      label: 'A Receber',
    },
    {
      to: '/admin/payable',
      icon: DollarSign,
      label: 'A Pagar',
    },
  ];

  const navItems = role === 'admin' ? adminNavItems : clientNavItems;

  return (
    <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8 flex-1">
            <div className="flex items-center gap-2 font-bold text-lg">
              <Church className="h-6 w-6 text-primary" />
              <span className="hidden sm:inline">
                {role === 'admin' ? 'Admin' : 'Sistema Igreja'}
              </span>
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
          
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </nav>
  );
};
