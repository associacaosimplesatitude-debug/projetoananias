import React from 'react';
import { NavLink } from '@/components/NavLink';
import { UserProfileDropdown } from './UserProfileDropdown';
import { Church, Users, TrendingUp, TrendingDown, LayoutDashboard, Building, DollarSign, UserCog, BarChart3, Settings, FileText, Building2, ArrowLeftRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from 'react-router-dom';

export const Navigation = () => {
  const { role, user } = useAuth();
  const [processStatus, setProcessStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchProcessStatus = async () => {
      if (user && role === 'client') {
        const { data: churchData } = await supabase
          .from('churches')
          .select('process_status')
          .eq('user_id', user.id)
          .single();
        
        setProcessStatus(churchData?.process_status || null);
      }
    };

    fetchProcessStatus();
  }, [user, role]);

  const clientNavItems = [
    {
      to: '/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
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
      to: '/bank-accounts',
      icon: Building2,
      label: 'Contas Bancárias',
    },
    {
      to: '/bank-transfers',
      icon: ArrowLeftRight,
      label: 'Transferências',
    },
    ...(processStatus === 'in_progress' ? [{
      to: '/',
      icon: Church,
      label: 'Abertura',
      exact: true,
    }] : []),
  ];

  const accountingMenuItems = [
    {
      to: '/reports/accounting',
      label: 'Balancete',
    },
    {
      to: '/reports/journal',
      label: 'Livro Diário',
    },
    {
      to: '/reports/income-statement',
      label: 'DRE',
    },
    {
      to: '/reports/balance-sheet',
      label: 'Balanço',
    },
  ];

  const tesoureiroNavItems = [
    {
      to: '/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
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
      to: '/bank-accounts',
      icon: Building2,
      label: 'Contas Bancárias',
    },
    {
      to: '/bank-transfers',
      icon: ArrowLeftRight,
      label: 'Transferências',
    },
  ];

  const secretarioNavItems = [
    {
      to: '/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
    },
    {
      to: '/members',
      icon: Users,
      label: 'Membros',
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
      to: '/admin/receivable',
      icon: DollarSign,
      label: 'A Receber',
    },
    {
      to: '/admin/payable',
      icon: DollarSign,
      label: 'A Pagar',
    },
    {
      to: '/admin/reports',
      icon: BarChart3,
      label: 'Relatórios',
    },
    {
      to: '/admin/stages',
      icon: Settings,
      label: 'Etapas',
    },
  ];

  const navItems = 
    role === 'admin' ? adminNavItems :
    role === 'tesoureiro' ? tesoureiroNavItems :
    role === 'secretario' ? secretarioNavItems :
    clientNavItems;

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
              
              {(role === 'client' || role === 'tesoureiro') && (
                <DropdownMenu>
                  <DropdownMenuTrigger className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                    'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}>
                    <FileText className="h-4 w-4" />
                    <span className="hidden sm:inline">Contabilidade</span>
                    <ChevronDown className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background z-50">
                    {accountingMenuItems.map((item) => (
                      <DropdownMenuItem key={item.to} asChild>
                        <Link to={item.to} className="cursor-pointer">
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
          <UserProfileDropdown />
        </div>
      </div>
    </nav>
  );
};