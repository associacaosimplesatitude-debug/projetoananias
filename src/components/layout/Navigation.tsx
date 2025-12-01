import React from 'react';
import { NavLink } from '@/components/NavLink';
import { UserProfileDropdown } from './UserProfileDropdown';
import { Church, Users, TrendingUp, TrendingDown, LayoutDashboard, Building, DollarSign, UserCog, BarChart3, Settings, FileText, Building2, ArrowLeftRight, ChevronDown, Palette, BookOpen, Plus, ShoppingBag, ShoppingCart } from 'lucide-react';
import logoAnanias from '@/assets/logo_ananias_horizontal.png';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useChurchData } from '@/hooks/useChurchData';
import { useClientType } from '@/hooks/useClientType';
import { useBrandingSettings } from '@/hooks/useBrandingSettings';
import { useActiveModules } from '@/hooks/useActiveModules';
import ManualRegistrationDialog from '@/components/ebd/ManualRegistrationDialog';
import { useQuery } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from 'react-router-dom';

export const Navigation = () => {
  const { role, user } = useAuth();
  const { data: brandingSettings } = useBrandingSettings();
  const { clientType } = useClientType();
  const { data: activeModules } = useActiveModules();
  const [processStatus, setProcessStatus] = React.useState<string | null>(null);
  const [manualRegOpen, setManualRegOpen] = React.useState(false);

  // Get church ID for EBD registration
  const { data: churchData } = useQuery({
    queryKey: ["user-church-nav", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("churches")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user && activeModules?.includes('REOBOTE EBD'),
  });

  const hasReoboteIgrejas = role === 'admin' || activeModules?.includes('REOBOTE IGREJAS');
  const hasOnlyReoboteEBD = activeModules?.length === 1 && activeModules.includes('REOBOTE EBD');

  const membersLabel = clientType === 'associacao' ? 'Associados' : 'Membros';

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

  // EBD-only navigation items
  const ebdOnlyNavItems = [
    {
      to: '/ebd/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
    },
  ];

  const ebdMembrosDropdown = [
    { to: '/ebd/students', label: 'Alunos' },
    { to: '/ebd/teachers', label: 'Professores' },
    { to: '/ebd/turmas', label: 'Turmas' },
  ];

  const ebdAcompanhamentoDropdown = [
    { to: '/ebd/quizzes', label: 'Desempenho (Quiz)' },
    { to: '/ebd/frequencia/relatorio', label: 'Relatórios de Frequência' },
  ];

  const ebdCatalogoDropdown = [
    { to: '/ebd/catalogo', label: 'Catálogo (Vitrine)' },
    { to: '/ebd/pedidos', label: 'Meus Pedidos' },
  ];


  const clientNavItems = [
    ...(hasReoboteIgrejas ? [
      {
        to: '/dashboard',
        icon: LayoutDashboard,
        label: 'Dashboard',
      },
      {
        to: '/members',
        icon: Users,
        label: membersLabel,
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
        to: '/abertura',
        icon: Church,
        label: 'Abertura',
        exact: true,
      }] : []),
    ] : []),
    ...(activeModules?.includes('REOBOTE EBD') && !hasOnlyReoboteEBD ? [
      {
        to: '/ebd/dashboard',
        icon: LayoutDashboard,
        label: 'Dashboard EBD',
      },
    ] : []),
  ];

  const shouldShowCatalogo = activeModules?.includes('REOBOTE EBD') && (role === 'client' || role === 'admin');

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
    ...(hasReoboteIgrejas ? [
      {
        to: '/dashboard',
        icon: LayoutDashboard,
        label: 'Dashboard',
      },
      {
        to: '/members',
        icon: Users,
        label: membersLabel,
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
    ] : []),
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
      label: membersLabel,
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
      to: '/admin/processos',
      icon: Settings,
      label: 'Etapas',
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
      to: '/admin/branding',
      icon: Palette,
      label: 'Aparência',
    },
    {
      to: '/admin/curriculo-ebd',
      icon: BookOpen,
      label: 'Currículo EBD',
    },
    {
      to: '/admin/orders',
      icon: ShoppingCart,
      label: 'Pedidos',
    },
  ];

  const navItems = 
    role === 'admin' ? adminNavItems :
    role === 'tesoureiro' ? tesoureiroNavItems :
    role === 'secretario' ? secretarioNavItems :
    hasOnlyReoboteEBD ? ebdOnlyNavItems :
    clientNavItems;

  const navBgColor = brandingSettings?.nav_background_color || '#1a2d40';
  const accentColor = brandingSettings?.accent_color || '#c89c5a';
  const navTextColor = brandingSettings?.nav_text_color || '#ffffff';
  const logoUrl = brandingSettings?.nav_logo_url || logoAnanias;

  return (
    <nav className="border-b sticky top-0 z-10" style={{ backgroundColor: navBgColor, color: navTextColor }}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8 flex-1">
            <div className="flex items-center">
              <img src={logoUrl} alt="Logo" className="h-10" />
            </div>
            
            <div className="flex items-center gap-1 flex-1 overflow-x-auto">
              {navItems.map((item) => {
                const navItemId = `nav-item-${item.to.replace(/\//g, '-')}`;
                return (
                  <React.Fragment key={item.to}>
                    <style>
                      {`
                        #${navItemId}.active {
                          background-color: ${accentColor} !important;
                        }
                      `}
                    </style>
                    <NavLink
                      id={navItemId}
                      to={item.to}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                        'hover:bg-white/10'
                      )}
                      style={{ color: navTextColor, opacity: 0.8 }}
                      activeClassName="active"
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{item.label}</span>
                    </NavLink>
                  </React.Fragment>
                );
              })}
              
              {/* EBD Membros e Turmas Dropdown */}
              {(hasOnlyReoboteEBD || (activeModules?.includes('REOBOTE EBD') && !hasOnlyReoboteEBD)) && (
                <DropdownMenu>
                  <DropdownMenuTrigger 
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                      'hover:bg-white/10'
                    )}
                    style={{ color: navTextColor, opacity: 0.8 }}
                  >
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">👥 Membros e Turmas</span>
                    <ChevronDown className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background z-50">
                    {ebdMembrosDropdown.map((item) => (
                      <DropdownMenuItem key={item.to} asChild>
                        <Link to={item.to} className="cursor-pointer">
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Planejamento - Botão Direto */}
              {(hasOnlyReoboteEBD || (activeModules?.includes('REOBOTE EBD') && !hasOnlyReoboteEBD)) && (
                <>
                  <style>
                    {`
                      #nav-item-ebd-planejamento.active {
                        background-color: ${accentColor} !important;
                      }
                    `}
                  </style>
                  <NavLink
                    id="nav-item-ebd-planejamento"
                    to="/ebd/planejamento"
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                      'hover:bg-white/10'
                    )}
                    style={{ color: navTextColor, opacity: 0.8 }}
                    activeClassName="active"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span className="hidden sm:inline">🗓️ Planejamento</span>
                  </NavLink>
                </>
              )}

              {/* EBD Acompanhamento Dropdown */}
              {(hasOnlyReoboteEBD || (activeModules?.includes('REOBOTE EBD') && !hasOnlyReoboteEBD)) && (
                <DropdownMenu>
                  <DropdownMenuTrigger 
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                      'hover:bg-white/10'
                    )}
                    style={{ color: navTextColor, opacity: 0.8 }}
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span className="hidden sm:inline">📊 Acompanhamento</span>
                    <ChevronDown className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background z-50">
                    {ebdAcompanhamentoDropdown.map((item) => (
                      <DropdownMenuItem key={item.to} asChild>
                        <Link to={item.to} className="cursor-pointer">
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* EBD Catálogo Dropdown */}
              {(hasOnlyReoboteEBD || (activeModules?.includes('REOBOTE EBD') && !hasOnlyReoboteEBD)) && (
                <DropdownMenu>
                  <DropdownMenuTrigger 
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                      'hover:bg-white/10'
                    )}
                    style={{ color: navTextColor, opacity: 0.8 }}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span className="hidden sm:inline">🛒 Catálogo</span>
                    <ChevronDown className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background z-50">
                    {ebdCatalogoDropdown.map((item) => (
                      <DropdownMenuItem key={item.to} asChild>
                        <Link to={item.to} className="cursor-pointer">
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Admin - Botão Direto */}
              {(hasOnlyReoboteEBD || (activeModules?.includes('REOBOTE EBD') && !hasOnlyReoboteEBD)) && (
                <>
                  <style>
                    {`
                      #nav-item-ebd-admin.active {
                        background-color: ${accentColor} !important;
                      }
                    `}
                  </style>
                  <NavLink
                    id="nav-item-ebd-admin"
                    to="/ebd/admin"
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                      'hover:bg-white/10'
                    )}
                    style={{ color: navTextColor, opacity: 0.8 }}
                    activeClassName="active"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">⚙️ Admin</span>
                  </NavLink>
                </>
              )}

              {(role === 'client' || role === 'tesoureiro') && hasReoboteIgrejas && !hasOnlyReoboteEBD && (
                <DropdownMenu>
                  <DropdownMenuTrigger 
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                      'hover:bg-white/10'
                    )}
                    style={{ color: navTextColor, opacity: 0.8 }}
                  >
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

              {activeModules?.includes('REOBOTE EBD') && (role === 'client' || role === 'tesoureiro') && (
                <button
                  onClick={() => setManualRegOpen(true)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                    'hover:bg-white/10'
                  )}
                  style={{ color: navTextColor, opacity: 0.8 }}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">CADASTRO</span>
                </button>
              )}
            </div>
          </div>
          
          <UserProfileDropdown />
        </div>
      </div>

      {churchData && (
        <ManualRegistrationDialog
          open={manualRegOpen}
          onOpenChange={setManualRegOpen}
          churchId={churchData.id}
          onSuccess={() => {}}
        />
      )}
    </nav>
  );
};