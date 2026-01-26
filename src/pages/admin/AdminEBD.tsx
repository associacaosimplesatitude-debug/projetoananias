import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, subDays, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ImageCropDialog } from "@/components/financial/ImageCropDialog";
import { UserProfileDropdown } from "@/components/layout/UserProfileDropdown";
import { 
  DollarSign, 
  ShoppingCart, 
  Truck, 
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Trophy,
  LineChartIcon,
  UserPlus,
  ArrowRightLeft,
  Upload,
  User,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Church,
  CalendarDays,
  GraduationCap,
  BookOpen,
  Target,
  HelpCircle,
  FileQuestion,
  ClipboardList,
  Search,
  Filter,
  UserX,
  Phone,
  Mail,
  Calendar,
  Play,
  ExternalLink,
} from "lucide-react";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { AdminPedidosTab } from "@/components/admin/AdminPedidosTab";
import { ImportLeadsDialog } from "@/components/admin/ImportLeadsDialog";
import { LeadScoringKPIs } from "@/components/leads/LeadScoringKPIs";
import { SalesChannelCards } from "@/components/admin/SalesChannelCards";
import { ClientsSummaryCards } from "@/components/admin/ClientsSummaryCards";
import { VendedoresSummaryCards } from "@/components/admin/VendedoresSummaryCards";
import { ClientesParaAtribuirCard } from "@/components/admin/ClientesParaAtribuirCard";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type Order = {
  id: string;
  church_id: string;
  created_at: string | null;
  approved_at: string | null;
  status: string;
  payment_status: string | null;
  status_logistico: string | null;
  valor_total: number;
  valor_produtos: number;
  valor_frete: number;
  metodo_frete: string | null;
  codigo_rastreio: string | null;
  nome_cliente: string | null;
  endereco_estado: string;
  church: {
    church_name: string;
    vendedor_id: string | null;
  } | null;
  ebd_pedidos_itens: {
    quantidade: number;
    preco_total: number;
  }[] | null;
};

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  foto_url: string | null;
  comissao_percentual: number;
  status: string;
  meta_mensal_valor: number;
  created_at: string;
  tipo_perfil: 'vendedor' | 'representante';
  gerente_id: string | null;
  is_gerente: boolean;
}

interface Church {
  id: string;
  church_name: string;
  vendedor_id: string | null;
  pastor_email: string;
  city: string | null;
  state: string | null;
  created_at: string;
}

interface EBDClient {
  cliente_id: string;
  cnpj?: string | null;
  cpf?: string | null;
  email?: string | null;
  church: {
    id: string;
    church_name: string;
    pastor_email: string;
    city: string | null;
    state: string | null;
    vendedor_id: string | null;
  } | null;
  source: 'churches' | 'ebd_clientes';
}

const COLORS = {
  primary: "hsl(var(--primary))",
  success: "hsl(142, 76%, 36%)",
  warning: "hsl(38, 92%, 50%)",
  danger: "hsl(0, 84%, 60%)",
  muted: "hsl(var(--muted-foreground))",
  chart1: "hsl(221, 83%, 53%)",
  chart2: "hsl(142, 76%, 36%)",
  chart3: "hsl(38, 92%, 50%)",
  chart4: "hsl(280, 67%, 50%)",
  chart5: "hsl(0, 84%, 60%)",
};

const PIE_COLORS = [COLORS.chart1, COLORS.chart2, COLORS.chart3, COLORS.chart4, COLORS.chart5];

const SELLER_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 67%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(180, 67%, 40%)",
  "hsl(330, 70%, 50%)",
];

export default function AdminEBD() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAuth();
  const { impersonateVendedor } = useImpersonation();
  const isGerenteEbd = role === 'gerente_ebd';
  
  // Map URL paths to tab keys
  const getTabFromPath = (pathname: string) => {
    if (pathname.includes('/admin/ebd/clientes')) return 'clientes';
    if (pathname.includes('/admin/ebd/leads')) return 'leads';
    if (pathname.includes('/admin/ebd/vendedores')) return 'vendedores';
    if (pathname.includes('/admin/ebd/catalogo')) return 'catalogo';
    return 'vendas';
  };
  
  const [activeTab, setActiveTab] = useState(() => getTabFromPath(location.pathname));
  
  // Update tab when URL changes
  useEffect(() => {
    setActiveTab(getTabFromPath(location.pathname));
  }, [location.pathname]);
  const [period, setPeriod] = useState("all");
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Vendedores state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null);
  const [selectedChurch, setSelectedChurch] = useState<string>('');
  const [targetVendedor, setTargetVendedor] = useState<string>('');
  const [transferSearchTerm, setTransferSearchTerm] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    foto_url: '',
    comissao_percentual: 5,
    status: 'Ativo',
    meta_mensal_valor: 0,
    tipo_perfil: 'vendedor' as 'vendedor' | 'representante',
    gerente_id: '' as string,
    is_gerente: false,
  });

  // Clientes EBD filter states
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [clientVendedorFilter, setClientVendedorFilter] = useState('all');
  const [clientStatusFilter, setClientStatusFilter] = useState('all');
  const [clientPurchaseStatusFilter, setClientPurchaseStatusFilter] = useState('all');
  const [clientStateFilter, setClientStateFilter] = useState('all');

  // Clientes EBD edit/delete states
  const [editClientDialogOpen, setEditClientDialogOpen] = useState(false);
  const [deleteClientDialogOpen, setDeleteClientDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<EBDClient | null>(null);
  const [editClientForm, setEditClientForm] = useState({
    nome_igreja: '',
    email: '',
    telefone: '',
    cnpj: '',
    endereco_cidade: '',
    endereco_estado: '',
  });

  // Leads state
  const [importLeadsDialogOpen, setImportLeadsDialogOpen] = useState(false);
  const [leadSearchTerm, setLeadSearchTerm] = useState('');
  const [leadVendedorFilter, setLeadVendedorFilter] = useState('all');
  const [leadStatusFilter, setLeadStatusFilter] = useState('all');
  const [leadScoreFilter, setLeadScoreFilter] = useState('all');
  const [leadContaFilter, setLeadContaFilter] = useState('all');
  const [editLeadDialogOpen, setEditLeadDialogOpen] = useState(false);
  const [deleteLeadDialogOpen, setDeleteLeadDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [editLeadForm, setEditLeadForm] = useState({
    nome_igreja: '',
    email: '',
    telefone: '',
    nome_responsavel: '',
    endereco_cep: '',
    endereco_rua: '',
    endereco_numero: '',
    endereco_complemento: '',
    endereco_bairro: '',
    endereco_cidade: '',
    endereco_estado: '',
    cnpj: '',
    status_lead: 'Não Contatado',
    observacoes: '',
  });

  // Data fetching
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["sales-report-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_pedidos")
        .select(`
          id,
          church_id,
          created_at,
          approved_at,
          status,
          payment_status,
          status_logistico,
          valor_total,
          valor_produtos,
          valor_frete,
          metodo_frete,
          codigo_rastreio,
          nome_cliente,
          endereco_estado,
          church:churches(church_name, vendedor_id),
          ebd_pedidos_itens(quantidade, preco_total)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  // Fetch all Shopify orders for KPIs (Pedidos Igrejas)
  const { data: shopifyOrders = [] } = useQuery({
    queryKey: ["admin-shopify-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select("*, cliente:ebd_clientes(cnpj, tipo_cliente)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all Shopify CG orders for KPIs (Pedidos Online)
  const { data: shopifyCGOrders = [] } = useQuery({
    queryKey: ["admin-shopify-cg-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos_cg")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch Bling marketplace orders (Amazon, Shopee, Mercado Livre)
  // IMPORTANTE: ordenar por order_date (data real da venda), igual às páginas de listagem,
  // para não cair no limite padrão de 1000 registros retornando apenas pedidos antigos (por data de venda).
  const { data: marketplacePedidos = [] } = useQuery({
    queryKey: ["admin-marketplace-pedidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bling_marketplace_pedidos")
        .select("*")
        .order("order_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: vendedores, isLoading: vendedoresLoading } = useQuery({
    queryKey: ['vendedores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as Vendedor[];
    },
  });

  const { data: churches } = useQuery({
    queryKey: ['churches-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('churches')
        .select('id, church_name, vendedor_id, pastor_email, city, state, created_at')
        .order('church_name');
      if (error) throw error;
      return data as Church[];
    },
  });

  const { data: ebdClients } = useQuery({
    queryKey: ['ebd-clients'],
    queryFn: async () => {
      // Buscar clientes de assinaturas (tabela churches)
      const { data: assinaturasData, error: assinaturasError } = await supabase
        .from('assinaturas')
        .select(`
          cliente_id,
          church:churches(id, church_name, pastor_email, city, state, vendedor_id),
          modulos!inner(nome_modulo)
        `)
        .eq('status', 'Ativo');
      if (assinaturasError) throw assinaturasError;
      
      const fromAssinaturas = (assinaturasData || [])
        .filter((a: any) => a.modulos?.nome_modulo === 'REOBOTE EBD')
        .map((a: any) => ({
          cliente_id: a.cliente_id,
          church: a.church,
          source: 'churches' as const,
        }));
      
      // Buscar clientes de ebd_clientes (cadastrados por vendedores)
      const { data: ebdClientesData, error: ebdClientesError } = await supabase
        .from('ebd_clientes')
        .select('*');
      if (ebdClientesError) throw ebdClientesError;
      
      const fromEbdClientes = (ebdClientesData || []).map((c: any) => ({
        cliente_id: c.id,
        cnpj: c.cnpj,
        cpf: c.cpf,
        email: c.email_superintendente,
        church: {
          id: c.id,
          church_name: c.nome_igreja,
          pastor_email: c.email_superintendente || '',
          city: c.endereco_cidade,
          state: c.endereco_estado,
          vendedor_id: c.vendedor_id,
        },
        source: 'ebd_clientes' as const,
      }));
      
      // Combinar (evitar duplicados pelo cliente_id)
      const allClients = [...fromAssinaturas, ...fromEbdClientes];
      const uniqueClients = allClients.reduce((acc: any[], client) => {
        if (!acc.find(c => c.cliente_id === client.cliente_id)) {
          acc.push(client);
        }
        return acc;
      }, []);
      
      return uniqueClients as EBDClient[];
    },
  });

  // Query leads de reativação
  const { data: leadsReativacao, refetch: refetchLeads } = useQuery({
    queryKey: ['leads-reativacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ebd_leads_reativacao')
        .select('*, vendedor:vendedores(nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: totalAlunos } = useQuery({
    queryKey: ['total-alunos'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('ebd_alunos')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: totalProfessores } = useQuery({
    queryKey: ['total-professores'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('ebd_professores')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: totalTurmas } = useQuery({
    queryKey: ['total-turmas'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('ebd_turmas')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      if (error) throw error;
      return count || 0;
    },
  });

  // Query propostas digitais em aberto
  const { data: propostasAbertas = [] } = useQuery({
    queryKey: ['propostas-digitais-abertas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedor_propostas')
        .select('id, status')
        .in('status', ['PROPOSTA_PENDENTE', 'PROPOSTA_ACEITA', 'AGUARDANDO_PAGAMENTO']);
      if (error) throw error;
      return data || [];
    },
  });

  // Query propostas faturadas para incluir na meta dos vendedores e nos cards de canais
  const { data: propostasFaturadasMeta = [] } = useQuery({
    queryKey: ['propostas-faturadas-meta'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedor_propostas')
        .select(`
          id, 
          vendedor_id, 
          valor_total, 
          valor_frete, 
          created_at,
          cliente:ebd_clientes(tipo_cliente)
        `)
        .in('status', ['FATURADO', 'PAGO']);
      if (error) throw error;
      return data || [];
    },
  });

  // Query pedidos Bling pendentes (usando ebd_pedidos com status_logistico pendente)
  const { data: pedidosBlingPendentes = 0 } = useQuery({
    queryKey: ['pedidos-bling-pendentes'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('ebd_pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'approved')
        .is('bling_order_id', null);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: churchProgress } = useQuery({
    queryKey: ['church-lesson-progress'],
    queryFn: async () => {
      // Get EBD module id
      const { data: ebdModulo } = await supabase
        .from('modulos')
        .select('id')
        .eq('nome_modulo', 'REOBOTE EBD')
        .single();

      if (!ebdModulo) return [];

      // Get all active EBD subscriptions with church and vendedor data
      const { data: ebdAssinaturas, error: assError } = await supabase
        .from('assinaturas')
        .select(`
          cliente_id,
          church:churches(id, church_name, vendedor_id)
        `)
        .eq('modulo_id', ebdModulo.id)
        .eq('status', 'Ativo');
      if (assError) throw assError;

      // Get planejamento for each church
      const { data: planejamentos, error: planError } = await supabase
        .from('ebd_planejamento')
        .select(`
          id,
          church_id,
          data_inicio,
          data_termino,
          dia_semana,
          revista:ebd_revistas(id, titulo, num_licoes)
        `);
      if (planError) throw planError;

      // Calculate REMAINING lessons for each church - ONLY from ACTIVE planejamentos
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const churchProgressMap: Record<string, { 
        church_id: string; 
        church_name: string; 
        vendedor_id: string | null;
        remaining: number;
        total: number;
        data_termino: string;
        completed: number;
      }> = {};

      ebdAssinaturas?.forEach(a => {
        if (a.church) {
          const churchPlanejamentos = planejamentos?.filter(p => p.church_id === a.church.id) || [];
          
          // Filter ONLY ACTIVE planejamentos (data_termino >= today)
          const activePlans = churchPlanejamentos.filter(plan => {
            if (!plan.data_termino) return false;
            const endDate = new Date(plan.data_termino + 'T23:59:59');
            return endDate >= today;
          });

          // Get the first active planejamento (closest to ending)
          let bestPlan: any = null;
          let minRemaining = Infinity;

          activePlans.forEach(plan => {
            const revista = plan.revista as any;
            if (revista && plan.data_termino) {
              const startDate = new Date(plan.data_inicio);
              const endDate = new Date(plan.data_termino + 'T23:59:59');
              const totalLessons = revista.num_licoes || 13;
              
              // Calculate elapsed weeks since start
              let elapsedWeeks = 0;
              if (today >= startDate) {
                elapsedWeeks = Math.floor((today.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
              }
              
              const completedLessons = Math.min(elapsedWeeks, totalLessons);
              // Remaining lessons = total - completed (but not negative)
              const remainingLessons = Math.max(0, totalLessons - completedLessons);
              
              if (remainingLessons < minRemaining) {
                minRemaining = remainingLessons;
                bestPlan = {
                  remaining: remainingLessons,
                  total: totalLessons,
                  completed: completedLessons,
                  data_termino: plan.data_termino,
                };
              }
            }
          });

          if (bestPlan) {
            churchProgressMap[a.church.id] = {
              church_id: a.church.id,
              church_name: a.church.church_name,
              vendedor_id: a.church.vendedor_id,
              remaining: bestPlan.remaining,
              total: bestPlan.total,
              completed: bestPlan.completed,
              data_termino: bestPlan.data_termino,
            };
          }
        }
      });

      return Object.values(churchProgressMap);
    },
  });

  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [selectedProgressRange, setSelectedProgressRange] = useState<'high' | 'medium' | 'low' | null>(null);
  const [escalasDialogOpen, setEscalasDialogOpen] = useState(false);
  const [selectedChurchForEscalas, setSelectedChurchForEscalas] = useState<{ id: string; name: string } | null>(null);

  // Query to fetch planejamentos for selected church
  const { data: churchPlanejamentos } = useQuery({
    queryKey: ['church-planejamentos', selectedChurchForEscalas?.id],
    queryFn: async () => {
      if (!selectedChurchForEscalas?.id) return [];
      const { data, error } = await supabase
        .from('ebd_planejamento')
        .select(`
          id,
          church_id,
          data_inicio,
          data_termino,
          dia_semana,
          revista:ebd_revistas(id, titulo, num_licoes, faixa_etaria_alvo, imagem_url)
        `)
        .eq('church_id', selectedChurchForEscalas.id)
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedChurchForEscalas?.id,
  });

  // Filter active planejamentos
  const activePlanejamentos = useMemo(() => {
    if (!churchPlanejamentos) return [];
    const today = new Date();
    return churchPlanejamentos.filter(p => {
      const endDate = new Date(p.data_termino + 'T23:59:59');
      return endDate >= today;
    });
  }, [churchPlanejamentos]);

  // Group by REMAINING lessons (not completed)
  const progressGroups = useMemo(() => {
    if (!churchProgress) return { high: [], medium: [], low: [] };
    
    return {
      // 9-13 remaining = still have many classes (GREEN)
      high: churchProgress.filter(c => c.remaining >= 9 && c.remaining <= 13),
      // 5-8 remaining = getting close (YELLOW)
      medium: churchProgress.filter(c => c.remaining >= 5 && c.remaining <= 8),
      // 0-4 remaining = ready to buy new magazines! (ORANGE)
      low: churchProgress.filter(c => c.remaining >= 0 && c.remaining <= 4),
    };
  }, [churchProgress]);

  // Get unique states from clients
  const uniqueStates = useMemo(() => {
    if (!ebdClients) return [];
    const states = ebdClients
      .map(c => c.church?.state)
      .filter((state): state is string => !!state);
    return [...new Set(states)].sort();
  }, [ebdClients]);

  // Get purchase status for a client
  const getClientPurchaseStatus = (clientId: string) => {
    const progress = churchProgress?.find(p => p.church_id === clientId);
    if (!progress) return null;
    if (progress.remaining >= 0 && progress.remaining <= 4) return 'ready'; // Pronta para Comprar
    if (progress.remaining >= 5 && progress.remaining <= 8) return 'soon'; // Próxima
    if (progress.remaining >= 9 && progress.remaining <= 13) return 'full'; // Estoque Cheio
    return null;
  };

  // Filter clients
  const filteredEbdClients = useMemo(() => {
    if (!ebdClients) return [];
    
    return ebdClients.filter(client => {
      // Search filter
      if (clientSearchTerm) {
        const searchLower = clientSearchTerm.toLowerCase();
        const churchName = client.church?.church_name?.toLowerCase() || '';
        const email = client.church?.pastor_email?.toLowerCase() || '';
        const vendedorName = vendedores?.find(v => v.id === client.church?.vendedor_id)?.nome?.toLowerCase() || '';
        
        if (!churchName.includes(searchLower) && !email.includes(searchLower) && !vendedorName.includes(searchLower)) {
          return false;
        }
      }
      
      // Vendedor filter
      if (clientVendedorFilter !== 'all') {
        if (clientVendedorFilter === 'none') {
          if (client.church?.vendedor_id) return false;
        } else if (client.church?.vendedor_id !== clientVendedorFilter) {
          return false;
        }
      }
      
      // State filter
      if (clientStateFilter !== 'all' && client.church?.state !== clientStateFilter) {
        return false;
      }
      
      // Purchase status filter
      if (clientPurchaseStatusFilter !== 'all') {
        const purchaseStatus = getClientPurchaseStatus(client.cliente_id);
        if (purchaseStatus !== clientPurchaseStatusFilter) return false;
      }
      
      return true;
    });
  }, [ebdClients, clientSearchTerm, clientVendedorFilter, clientStateFilter, clientPurchaseStatusFilter, vendedores, churchProgress]);

  // Filtered clients for transfer dialog (search by name, CNPJ, email)
  const filteredTransferClients = useMemo(() => {
    if (!ebdClients || !transferSearchTerm.trim()) return [];
    const term = transferSearchTerm.toLowerCase().replace(/[^a-z0-9]/g, '');
    return ebdClients.filter(client => {
      const nome = (client.church?.church_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const cnpj = (client.cnpj || client.cpf || '').replace(/[^0-9]/g, '');
      const email = (client.email || client.church?.pastor_email || '').toLowerCase();
      return nome.includes(term) || cnpj.includes(term) || email.includes(term);
    }).slice(0, 10);
  }, [ebdClients, transferSearchTerm]);

  // Calculate lead score dynamically
  const getLeadScore = (lead: { ultimo_login_ebd?: string | null; email_aberto?: boolean }): string => {
    if (lead.ultimo_login_ebd) return 'Quente';
    if (lead.email_aberto) return 'Morno';
    return 'Frio';
  };

  // Filter leads
  const filteredLeads = useMemo(() => {
    if (!leadsReativacao) return [];
    
    return leadsReativacao.filter(lead => {
      // Search filter
      if (leadSearchTerm) {
        const searchLower = leadSearchTerm.toLowerCase();
        const nome = lead.nome_igreja?.toLowerCase() || '';
        const email = lead.email?.toLowerCase() || '';
        const vendedorName = (lead.vendedor as any)?.nome?.toLowerCase() || '';
        
        if (!nome.includes(searchLower) && !email.includes(searchLower) && !vendedorName.includes(searchLower)) {
          return false;
        }
      }
      
      // Vendedor filter
      if (leadVendedorFilter !== 'all') {
        if (leadVendedorFilter === 'none') {
          if (lead.vendedor_id) return false;
        } else if (lead.vendedor_id !== leadVendedorFilter) {
          return false;
        }
      }
      
      // Status filter
      if (leadStatusFilter !== 'all' && lead.status_lead !== leadStatusFilter) {
        return false;
      }
      
      // Score filter (dynamic)
      if (leadScoreFilter !== 'all' && getLeadScore(lead) !== leadScoreFilter) {
        return false;
      }
      
      // Conta criada filter
      if (leadContaFilter !== 'all') {
        const contaCriada = lead.conta_criada === true;
        if (leadContaFilter === 'criada' && !contaCriada) return false;
        if (leadContaFilter === 'pendente' && contaCriada) return false;
      }
      
      return true;
    });
  }, [leadsReativacao, leadSearchTerm, leadVendedorFilter, leadStatusFilter, leadScoreFilter, leadContaFilter]);

  // Date range calculation
  const dateRange = useMemo(() => {
    const now = new Date();

    // Default: all time
    if (period === "all") {
      return { start: new Date(0), end: endOfDay(now) };
    }

    let start: Date;
    let end: Date = endOfDay(now);

    switch (period) {
      case "today":
        start = startOfDay(now);
        break;
      case "7":
        start = startOfDay(subDays(now, 7));
        break;
      case "thisMonth":
        start = startOfMonth(now);
        break;
      case "lastMonth":
        start = startOfMonth(subMonths(now, 1));
        end = endOfMonth(subMonths(now, 1));
        break;
      case "custom":
        if (customStartDate && customEndDate) {
          return { start: parseISO(customStartDate), end: endOfDay(parseISO(customEndDate)) };
        }
        // If custom is selected but dates are missing, fall back to all
        return { start: new Date(0), end: endOfDay(now) };
      default:
        return { start: new Date(0), end: endOfDay(now) };
    }

    return { start, end };
  }, [period, customStartDate, customEndDate]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (!dateRange) return orders; // No filtering when "all" is selected
    return orders.filter((order) => {
      if (!order.created_at) return false;
      const orderDate = parseISO(order.created_at);
      return isWithinInterval(orderDate, { start: dateRange.start, end: dateRange.end });
    });
  }, [orders, dateRange]);

  // KPIs from old ebd_pedidos (keeping for chart compatibility)
  const pendingOrders = filteredOrders.filter(o => o.payment_status === 'pending' && o.status !== 'cancelled');
  const paidOrders = filteredOrders.filter(o => o.payment_status === 'approved');
  const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelled');
  const totalEbdClients = ebdClients?.length || 0;

  // KPIs from Shopify Igrejas - filtered by date range
  const filteredShopifyOrders = useMemo(() => {
    if (!dateRange) return shopifyOrders; // No filtering when "all" is selected
    return shopifyOrders.filter((order) => {
      if (!order.created_at) return false;
      const orderDate = parseISO(order.created_at);
      return isWithinInterval(orderDate, { start: dateRange.start, end: dateRange.end });
    });
  }, [shopifyOrders, dateRange]);

  // KPIs from Shopify CG (Online) - filtered by date range
  const filteredShopifyCGOrders = useMemo(() => {
    if (!dateRange) return shopifyCGOrders; // No filtering when "all" is selected
    return shopifyCGOrders.filter((order) => {
      if (!order.created_at) return false;
      const orderDate = parseISO(order.created_at);
      return isWithinInterval(orderDate, { start: dateRange.start, end: dateRange.end });
    });
  }, [shopifyCGOrders, dateRange]);

  const shopifyPaidOrders = useMemo(() => 
    filteredShopifyOrders.filter(o => 
      o.status_pagamento === 'Pago' || 
      o.status_pagamento === 'paid' || 
      o.status_pagamento === 'Faturado'
    ), 
    [filteredShopifyOrders]
  );
  const shopifyRefundedOrders = useMemo(() => 
    filteredShopifyOrders.filter(o => o.status_pagamento === 'Estornado' || o.status_pagamento === 'refunded'), 
    [filteredShopifyOrders]
  );
  const shopifyPendingOrders = useMemo(() => 
    filteredShopifyOrders.filter(o => o.status_pagamento === 'pending' || o.status_pagamento === 'Pendente'), 
    [filteredShopifyOrders]
  );

  // Shopify CG (Online) KPIs
  const shopifyCGPaidOrders = useMemo(() => 
    filteredShopifyCGOrders.filter(o => 
      o.status_pagamento === 'paid' || 
      o.status_pagamento === 'Pago' ||
      o.status_pagamento === 'Faturado'
    ), 
    [filteredShopifyCGOrders]
  );

  // Dashboard KPIs - Consolidado
  const dashboardKPIs = useMemo(() => {
    // Pedidos Online (Central Gospel)
    const totalPedidosOnline = filteredShopifyCGOrders.length;
    const valorPedidosOnline = shopifyCGPaidOrders.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
    const pedidosOnlinePagos = shopifyCGPaidOrders.length;

    // Pedidos Igrejas (Shopify principal)
    const totalPedidosIgrejas = filteredShopifyOrders.length;
    const valorPedidosIgrejas = shopifyPaidOrders.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
    const pedidosIgrejasPagos = shopifyPaidOrders.length;

    // Propostas/Pedidos internos (ebd_pedidos)
    const propostasPendentes = filteredOrders.filter(o => o.status === 'pending' || o.payment_status === 'pending').length;
    const pedidosFaturados = filteredOrders.filter(o => o.status_logistico === 'faturado' || o.status_logistico === 'shipped').length;
    const valorFaturados = filteredOrders.filter(o => o.status_logistico === 'faturado' || o.status_logistico === 'shipped')
      .reduce((sum, o) => sum + Number(o.valor_total || 0), 0);
    
    // Pedidos Pagos combinados
    const totalPedidosPagos = pedidosOnlinePagos + pedidosIgrejasPagos + paidOrders.length;
    const valorTotalPago = valorPedidosOnline + valorPedidosIgrejas + paidOrders.reduce((sum, o) => sum + Number(o.valor_total || 0), 0);

    // Clientes Recorrentes - emails únicos com mais de 1 pedido
    const emailCountsIgrejas: Record<string, number> = {};
    filteredShopifyOrders.forEach(o => {
      if (o.customer_email) {
        emailCountsIgrejas[o.customer_email] = (emailCountsIgrejas[o.customer_email] || 0) + 1;
      }
    });
    const recorrentesIgrejas = Object.values(emailCountsIgrejas).filter(count => count > 1).length;

    const emailCountsCG: Record<string, number> = {};
    filteredShopifyCGOrders.forEach(o => {
      if (o.customer_email) {
        emailCountsCG[o.customer_email] = (emailCountsCG[o.customer_email] || 0) + 1;
      }
    });
    const recorrentesCG = Object.values(emailCountsCG).filter(count => count > 1).length;

    return {
      totalPedidosOnline,
      valorPedidosOnline,
      pedidosOnlinePagos,
      totalPedidosIgrejas,
      valorPedidosIgrejas,
      pedidosIgrejasPagos,
      propostasPendentes,
      pedidosFaturados,
      valorFaturados,
      totalPedidosPagos,
      valorTotalPago,
      recorrentesIgrejas,
      recorrentesCG,
      totalRecorrentes: recorrentesIgrejas + recorrentesCG,
    };
  }, [filteredShopifyCGOrders, shopifyCGPaidOrders, filteredShopifyOrders, shopifyPaidOrders, filteredOrders, paidOrders]);

  // Main KPIs from Shopify
  const totalRevenue = useMemo(() => 
    shopifyPaidOrders.reduce((sum, o) => sum + Number(o.valor_total || 0), 0), 
    [shopifyPaidOrders]
  );
  const totalShipping = useMemo(() => 
    shopifyPaidOrders.reduce((sum, o) => sum + Number(o.valor_frete || 0), 0), 
    [shopifyPaidOrders]
  );
  const totalProducts = totalRevenue - totalShipping;
  const avgTicket = shopifyPaidOrders.length > 0 ? totalRevenue / shopifyPaidOrders.length : 0;
  const totalItems = shopifyPaidOrders.length; // For Shopify, count orders as items
  
  const deliveryStats = useMemo(() => {
    const shipped = shopifyPaidOrders.filter(o => o.codigo_rastreio).length;
    const awaitingShipment = shopifyPaidOrders.filter(o => !o.codigo_rastreio).length;
    return { shipped, awaitingShipment };
  }, [shopifyPaidOrders]);

  // Chart data
  const paymentStatusData = useMemo(() => [
    { name: "Pagos", value: paidOrders.length, color: COLORS.chart2 },
    { name: "Pendentes", value: pendingOrders.length, color: COLORS.chart3 },
    { name: "Cancelados", value: cancelledOrders.length, color: COLORS.chart5 },
  ], [paidOrders.length, pendingOrders.length, cancelledOrders.length]);

  const shippingMethodData = useMemo(() => {
    const methods: Record<string, number> = {};
    paidOrders.forEach((order) => {
      const method = order.metodo_frete || "Não informado";
      methods[method] = (methods[method] || 0) + 1;
    });
    return Object.entries(methods).map(([name, value]) => ({ name, value }));
  }, [paidOrders]);

  const dailyRevenueData = useMemo(() => {
    const daily: Record<string, { date: string; receita: number; pedidos: number }> = {};
    paidOrders.forEach((order) => {
      if (!order.approved_at && !order.created_at) return;
      const date = format(parseISO(order.approved_at || order.created_at!), "dd/MM");
      if (!daily[date]) {
        daily[date] = { date, receita: 0, pedidos: 0 };
      }
      daily[date].receita += Number(order.valor_total);
      daily[date].pedidos += 1;
    });
    return Object.values(daily).sort((a, b) => {
      const [dayA, monthA] = a.date.split("/").map(Number);
      const [dayB, monthB] = b.date.split("/").map(Number);
      if (monthA !== monthB) return monthA - monthB;
      return dayA - dayB;
    });
  }, [paidOrders]);

  const stateDistributionData = useMemo(() => {
    const states: Record<string, number> = {};
    paidOrders.forEach((order) => {
      const state = order.endereco_estado || "N/A";
      states[state] = (states[state] || 0) + Number(order.valor_total);
    });
    return Object.entries(states)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [paidOrders]);

  const vendedorStats = useMemo(() => {
    if (!vendedores || !paidOrders) return [];
    
    // Use already filtered Shopify orders (handles null dateRange)
    const shopifyOrdersForStats = filteredShopifyOrders;
    
    // Filter propostas faturadas by date range if applicable
    const propostasFaturadasForStats = dateRange?.start 
      ? propostasFaturadasMeta.filter(p => {
          const createdAt = new Date(p.created_at);
          return createdAt >= dateRange.start && (!dateRange.end || createdAt <= dateRange.end);
        })
      : propostasFaturadasMeta;
    
    return vendedores.map(vendedor => {
      // Internal orders
      const vendedorOrders = paidOrders.filter(order => 
        order.church?.vendedor_id === vendedor.id
      );
      const internalSales = vendedorOrders.length;
      const internalValue = vendedorOrders.reduce((sum, o) => sum + Number(o.valor_total), 0);
      
      // Shopify orders
      const vendedorShopifyOrders = shopifyOrdersForStats.filter(order => 
        order.vendedor_id === vendedor.id
      );
      const shopifySales = vendedorShopifyOrders.length;
      const shopifyValue = vendedorShopifyOrders.reduce((sum, o) => sum + Number(o.valor_para_meta || 0), 0);
      
      // Propostas faturadas (B2B)
      const vendedorPropostasFaturadas = propostasFaturadasForStats.filter(p => 
        p.vendedor_id === vendedor.id
      );
      const propostasFaturadasSales = vendedorPropostasFaturadas.length;
      const propostasFaturadasValue = vendedorPropostasFaturadas.reduce((sum, p) => 
        sum + (Number(p.valor_total || 0) - Number(p.valor_frete || 0)), 0
      );
      
      // Combined totals
      const totalSales = internalSales + shopifySales + propostasFaturadasSales;
      const totalValue = internalValue + shopifyValue + propostasFaturadasValue;
      const commission = totalValue * (vendedor.comissao_percentual / 100);
      const goalProgress = vendedor.meta_mensal_valor > 0 
        ? (totalValue / vendedor.meta_mensal_valor) * 100 
        : 0;
      return {
        ...vendedor,
        totalSales,
        totalValue,
        commission,
        goalProgress: Math.min(goalProgress, 100),
        goalProgressRaw: goalProgress,
      };
    }).sort((a, b) => b.totalValue - a.totalValue);
  }, [vendedores, paidOrders, filteredShopifyOrders, propostasFaturadasMeta, dateRange]);

  const salesEvolutionBySeller = useMemo(() => {
    if (!vendedores || !paidOrders) return [];
    const dateMap: Record<string, Record<string, number>> = {};
    paidOrders.forEach((order) => {
      if (!order.approved_at && !order.created_at) return;
      const date = format(parseISO(order.approved_at || order.created_at!), "dd/MM");
      const vendedorId = order.church?.vendedor_id || 'sem_vendedor';
      if (!dateMap[date]) dateMap[date] = {};
      dateMap[date][vendedorId] = (dateMap[date][vendedorId] || 0) + Number(order.valor_total);
    });
    return Object.entries(dateMap).map(([date, sellers]) => {
      const entry: Record<string, string | number> = { date };
      vendedores.forEach(v => { entry[v.nome] = sellers[v.id] || 0; });
      return entry;
    }).sort((a, b) => {
      const [dayA, monthA] = (a.date as string).split("/").map(Number);
      const [dayB, monthB] = (b.date as string).split("/").map(Number);
      if (monthA !== monthB) return monthA - monthB;
      return dayA - dayB;
    });
  }, [vendedores, paidOrders]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Vendedor mutations
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("A imagem deve ter no máximo 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setShowCropDialog(true);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    setUploadingImage(true);
    try {
      const fileName = `vendedores/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(fileName, croppedImageBlob, { contentType: "image/jpeg", upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("profile-avatars").getPublicUrl(fileName);
      setFormData({ ...formData, foto_url: publicUrl });
      toast.success("Foto carregada com sucesso!");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploadingImage(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase.functions.invoke('create-vendedor', {
        body: {
          email: data.email,
          password: data.senha,
          nome: data.nome,
          foto_url: data.foto_url || null,
          comissao_percentual: data.comissao_percentual,
          status: data.status,
          meta_mensal_valor: data.meta_mensal_valor,
          tipo_perfil: data.tipo_perfil,
        },
      });
      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
      const perfilLabel = variables.tipo_perfil === 'representante' ? 'Representante' : 'Vendedor';
      toast.success(`${perfilLabel} criado com sucesso!`);
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar vendedor/representante');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
      novaSenha,
      emailAntigo,
    }: {
      id: string;
      data: Omit<typeof formData, 'senha'>;
      novaSenha?: string;
      emailAntigo: string;
    }) => {
      // 1) Sempre atualiza os dados do vendedor no banco
      const { error } = await supabase
        .from('vendedores')
        .update({
          nome: data.nome,
          email: data.email,
          foto_url: data.foto_url || null,
          comissao_percentual: data.comissao_percentual,
          status: data.status,
          meta_mensal_valor: data.meta_mensal_valor,
          tipo_perfil: data.tipo_perfil,
          gerente_id: data.gerente_id || null,
          is_gerente: data.is_gerente || false,
        })
        .eq('id', id);
      if (error) throw error;

      // 2) Se o gerente informou senha nova, tenta atualizar no sistema de login
      if (novaSenha && novaSenha.trim().length >= 6) {
        const { data: updateResult, error: pwdError } = await supabase.functions.invoke(
          'update-user-password-by-email',
          {
            body: {
              oldEmail: emailAntigo,
              newEmail: data.email,
              newPassword: novaSenha,
            },
          }
        );

        const businessError = updateResult?.success === false ? updateResult?.error : null;

        if (pwdError || businessError) {
          // Importante: NÃO derrubar a atualização do vendedor; apenas avisar
          return {
            passwordUpdated: false,
            passwordError: pwdError?.message || businessError || 'Erro ao atualizar senha',
          };
        }

        return { passwordUpdated: true };
      }

      return { passwordUpdated: null };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });

      if (result?.passwordUpdated === false) {
        toast.success('Dados do vendedor atualizados.');
        toast.error(`Senha não foi atualizada: ${result.passwordError}`);
      } else if (result?.passwordUpdated === true) {
        toast.success('Dados e senha atualizados com sucesso!');
      } else {
        toast.success('Atualizado com sucesso!');
      }

      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vendedores').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
      toast.success('Vendedor removido com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao remover vendedor');
    },
  });

  const transferMutation = useMutation({
    mutationFn: async ({
      clienteId,
      vendedorId,
      source,
    }: {
      clienteId: string;
      vendedorId: string | null;
      source: 'churches' | 'ebd_clientes';
    }) => {
      // Usa função SECURITY DEFINER para contornar RLS restritivo
      const { error } = await supabase.rpc('transfer_cliente_vendedor' as any, {
        _source: source,
        _cliente_id: clienteId,
        _vendedor_id: vendedorId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['churches-all'] });
      queryClient.invalidateQueries({ queryKey: ['ebd-clients'] });
      toast.success('Cliente transferido com sucesso!');
      setTransferDialogOpen(false);
      setSelectedChurch('');
      setTargetVendedor('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao transferir cliente');
    },
  });

  // Client mutations
  const updateClientMutation = useMutation({
    mutationFn: async ({ client, data }: { client: EBDClient; data: typeof editClientForm }) => {
      if (client.source === 'ebd_clientes') {
        const { error } = await supabase.from('ebd_clientes').update({
          nome_igreja: data.nome_igreja,
          email_superintendente: data.email,
          telefone: data.telefone,
          cnpj: data.cnpj,
          endereco_cidade: data.endereco_cidade,
          endereco_estado: data.endereco_estado,
        }).eq('id', client.cliente_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('churches').update({
          church_name: data.nome_igreja,
          pastor_email: data.email,
          pastor_whatsapp: data.telefone,
          cnpj: data.cnpj,
          city: data.endereco_cidade,
          state: data.endereco_estado,
        }).eq('id', client.cliente_id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebd-clients'] });
      queryClient.invalidateQueries({ queryKey: ['churches-all'] });
      toast.success('Cliente atualizado com sucesso!');
      setEditClientDialogOpen(false);
      setSelectedClient(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar cliente');
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (client: EBDClient) => {
      if (client.source === 'ebd_clientes') {
        const { error } = await supabase.from('ebd_clientes').delete().eq('id', client.cliente_id);
        if (error) throw error;
      } else {
        // For churches, we need to delete the assinatura and optionally the church
        const { error: assError } = await supabase.from('assinaturas').delete().eq('cliente_id', client.cliente_id);
        if (assError) throw assError;
        // Optionally delete the church record if no other assinaturas exist
        const { data: otherAssinaturas } = await supabase.from('assinaturas').select('id').eq('cliente_id', client.cliente_id);
        if (!otherAssinaturas || otherAssinaturas.length === 0) {
          const { error: churchError } = await supabase.from('churches').delete().eq('id', client.cliente_id);
          if (churchError) throw churchError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ebd-clients'] });
      queryClient.invalidateQueries({ queryKey: ['churches-all'] });
      toast.success('Cliente excluído com sucesso!');
      setDeleteClientDialogOpen(false);
      setSelectedClient(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir cliente');
    },
  });

  const handleEditClient = (client: EBDClient) => {
    setSelectedClient(client);
    setEditClientForm({
      nome_igreja: client.church?.church_name || '',
      email: client.church?.pastor_email || '',
      telefone: '',
      cnpj: '',
      endereco_cidade: client.church?.city || '',
      endereco_estado: client.church?.state || '',
    });
    setEditClientDialogOpen(true);
  };

  const handleDeleteClient = (client: EBDClient) => {
    setSelectedClient(client);
    setDeleteClientDialogOpen(true);
  };

  const handleSaveClient = () => {
    if (!selectedClient) return;
    updateClientMutation.mutate({ client: selectedClient, data: editClientForm });
  };

  const confirmDeleteClient = () => {
    if (!selectedClient) return;
    deleteClientMutation.mutate(selectedClient);
  };


  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editLeadForm }) => {
      const { error } = await supabase.from('ebd_leads_reativacao').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-reativacao'] });
      toast.success('Lead atualizado com sucesso!');
      setEditLeadDialogOpen(false);
      setSelectedLead(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar lead');
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ebd_leads_reativacao').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-reativacao'] });
      toast.success('Lead excluído com sucesso!');
      setDeleteLeadDialogOpen(false);
      setSelectedLead(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir lead');
    },
  });

  const handleEditLead = (lead: any) => {
    setSelectedLead(lead);
    setEditLeadForm({
      nome_igreja: lead.nome_igreja || '',
      email: lead.email || '',
      telefone: lead.telefone || '',
      nome_responsavel: lead.nome_responsavel || '',
      endereco_cep: lead.endereco_cep || '',
      endereco_rua: lead.endereco_rua || '',
      endereco_numero: lead.endereco_numero || '',
      endereco_complemento: lead.endereco_complemento || '',
      endereco_bairro: lead.endereco_bairro || '',
      endereco_cidade: lead.endereco_cidade || '',
      endereco_estado: lead.endereco_estado || '',
      cnpj: lead.cnpj || '',
      status_lead: lead.status_lead || 'Não Contatado',
      observacoes: lead.observacoes || '',
    });
    setEditLeadDialogOpen(true);
  };

  const handleDeleteLead = (lead: any) => {
    setSelectedLead(lead);
    setDeleteLeadDialogOpen(true);
  };

  const handleSaveLead = () => {
    if (!selectedLead) return;
    updateLeadMutation.mutate({ id: selectedLead.id, data: editLeadForm });
  };

  const confirmDeleteLead = () => {
    if (!selectedLead) return;
    deleteLeadMutation.mutate(selectedLead.id);
  };

  const resetForm = () => {
    setFormData({ nome: '', email: '', senha: '', foto_url: '', comissao_percentual: 5, status: 'Ativo', meta_mensal_valor: 0, tipo_perfil: 'vendedor', gerente_id: '', is_gerente: false });
    setEditingVendedor(null);
    setShowPassword(false);
  };

  const handleEdit = (vendedor: Vendedor) => {
    setEditingVendedor(vendedor);
    setFormData({
      nome: vendedor.nome,
      email: vendedor.email,
      senha: '',
      foto_url: vendedor.foto_url || '',
      comissao_percentual: vendedor.comissao_percentual,
      status: vendedor.status,
      meta_mensal_valor: vendedor.meta_mensal_valor,
      tipo_perfil: vendedor.tipo_perfil || 'vendedor',
      gerente_id: vendedor.gerente_id || '',
      is_gerente: vendedor.is_gerente || false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) { toast.error("Preencha o nome completo"); return; }
    if (!formData.email.trim()) { toast.error("Preencha o email"); return; }
    if (!editingVendedor && !formData.senha.trim()) { toast.error("Preencha a senha de acesso"); return; }
    if (!editingVendedor && formData.senha.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres"); return; }
    // Validate password length on edit only if provided
    if (editingVendedor && formData.senha.trim() && formData.senha.length < 6) { 
      toast.error("A senha deve ter pelo menos 6 caracteres"); 
      return; 
    }
    
    setIsSubmitting(true);
    try {
      if (editingVendedor) {
        const { senha, ...dataWithoutPassword } = formData;
        await updateMutation.mutateAsync({ 
          id: editingVendedor.id, 
          data: dataWithoutPassword, 
          novaSenha: senha.trim() || undefined,
          emailAntigo: editingVendedor.email 
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getVendedorName = (vendedorId: string | null) => {
    if (!vendedorId) return 'Sem vendedor';
    return vendedores?.find(v => v.id === vendedorId)?.nome || 'Desconhecido';
  };

  const getClientCount = (vendedorId: string) => {
    return churches?.filter(c => c.vendedor_id === vendedorId).length || 0;
  };

  if (ordersLoading && vendedoresLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const isInAdminEBDLayout = location.pathname.startsWith('/admin/ebd');

  return (
    <div className={isInAdminEBDLayout ? "space-y-6" : "min-h-screen flex flex-col"}>
      {/* Local header only when NOT wrapped by AdminEBDLayout (avoids duplicated menus) */}
      {!isInAdminEBDLayout && (
        <header className="border-b bg-background sticky top-0 z-10">
          <nav className="container mx-auto px-4">
            <div className="flex items-center gap-1 overflow-x-auto py-3">
              {[
                { key: "vendas", label: "Painel Admin EBD", icon: TrendingUp },
                { key: "pedidos", label: "Pedidos", icon: ShoppingCart },
                { key: "clientes", label: "Clientes EBD", icon: Users },
                { key: "leads", label: "Leads Reativação", icon: UserX },
                { key: "vendedores", label: "Vendedores", icon: User },
                ...(!isGerenteEbd ? [{ key: "catalogo", label: "Catálogo", icon: BookOpen }] : []),
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === item.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}

              {/* Period Filter and Avatar */}
              <div className="flex items-center gap-4 ml-auto">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="7">Últimos 7 dias</SelectItem>
                      <SelectItem value="thisMonth">Mês Atual</SelectItem>
                      <SelectItem value="lastMonth">Mês Anterior</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <UserProfileDropdown />
              </div>
            </div>
          </nav>
        </header>
      )}

      {/* Main Content */}
      <main className={isInAdminEBDLayout ? "space-y-6" : "flex-1 container mx-auto px-4 py-6 space-y-6"}>
        {/* Custom Date Range */}
        {period === 'custom' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data Final</Label>
                  <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Conteúdo das seções */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="hidden" />

        {/* VENDAS TAB */}
        <TabsContent value="vendas" className="space-y-6">
          {/* Dashboard de Vendas - KPIs Consolidados */}
          <SalesChannelCards
            dashboardKPIs={dashboardKPIs}
            totalEbdClients={totalEbdClients}
            totalAlunos={totalAlunos}
            totalTurmas={totalTurmas}
            shopifyOrders={shopifyOrders}
            shopifyCGOrders={shopifyCGOrders}
            vendedorStats={vendedorStats}
            propostasDigitaisAbertas={propostasAbertas.length}
            pedidosBlingPendentes={pedidosBlingPendentes}
            marketplacePedidos={marketplacePedidos}
            propostasFaturadas={propostasFaturadasMeta}
          />

          {/* Bloco Resumo de Clientes - 10 Cards de Métricas */}
          <ClientsSummaryCards
            shopifyOrders={shopifyOrders}
            ebdClients={ebdClients || []}
          />

          {/* Bloco Performance de Vendedores - Metas, Ranking e Comissão */}
          <VendedoresSummaryCards
            vendedores={vendedores || []}
            shopifyOrders={shopifyOrders}
            blingOrders={marketplacePedidos}
            propostasFaturadas={propostasFaturadasMeta}
          />

          {/* Church Progress Cards - Aulas Restantes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Aulas Restantes por Igreja
              </CardTitle>
              <CardDescription>Baseado no planejamento escolar. Clique para ver detalhes e vendedor responsável.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => { setSelectedProgressRange('high'); setProgressDialogOpen(true); }}
                  className="p-4 rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-red-700 dark:text-red-300">9 a 13 restantes</span>
                    <Badge className="bg-red-500 hover:bg-red-600">{progressGroups.high.length}</Badge>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">Muitas aulas ainda</p>
                  <Progress value={30} className="mt-2 h-2 [&>div]:bg-red-500" />
                </button>

                <button
                  onClick={() => { setSelectedProgressRange('medium'); setProgressDialogOpen(true); }}
                  className="p-4 rounded-lg border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950 hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">5 a 8 restantes</span>
                    <Badge className="bg-yellow-500 hover:bg-yellow-600">{progressGroups.medium.length}</Badge>
                  </div>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Chegando perto do fim</p>
                  <Progress value={60} className="mt-2 h-2 [&>div]:bg-yellow-500" />
                </button>

                <button
                  onClick={() => { setSelectedProgressRange('low'); setProgressDialogOpen(true); }}
                  className="p-4 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">0 a 4 restantes</span>
                    <Badge className="bg-green-500 hover:bg-green-600">{progressGroups.low.length}</Badge>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">🛒 Prontas para comprar revistas!</p>
                  <Progress value={90} className="mt-2 h-2 [&>div]:bg-green-500" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Progress Dialog */}
          <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedProgressRange === 'high' && <Badge className="bg-red-500">9 a 13 restantes</Badge>}
                  {selectedProgressRange === 'medium' && <Badge className="bg-yellow-500">5 a 8 restantes</Badge>}
                  {selectedProgressRange === 'low' && <Badge className="bg-green-500">0 a 4 restantes</Badge>}
                  Igrejas com turmas terminando
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {selectedProgressRange && progressGroups[selectedProgressRange].length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhuma igreja nesta faixa</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Igreja</TableHead>
                        <TableHead>Aulas Restantes</TableHead>
                        <TableHead>Término</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedProgressRange && progressGroups[selectedProgressRange].map((church) => (
                        <TableRow key={church.church_id}>
                          <TableCell className="font-medium">{church.church_name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={(church.completed / church.total) * 100} 
                                className={`w-20 h-2 ${
                                  selectedProgressRange === 'high' ? '[&>div]:bg-red-500' :
                                  selectedProgressRange === 'medium' ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'
                                }`} 
                              />
                              <span className="text-sm font-medium">{church.completed} de {church.total}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {church.data_termino ? format(new Date(church.data_termino + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={church.vendedor_id ? "default" : "secondary"}>
                              {getVendedorName(church.vendedor_id)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedChurchForEscalas({ id: church.church_id, name: church.church_name });
                                setEscalasDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver Escalas
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Escalas Dialog */}
          <Dialog open={escalasDialogOpen} onOpenChange={setEscalasDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Revistas Ativas - {selectedChurchForEscalas?.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {activePlanejamentos.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nenhuma revista ativa para esta igreja</p>
                ) : (
                  activePlanejamentos.map((plan) => {
                    const revista = plan.revista as any;
                    const startDate = new Date(plan.data_inicio);
                    const endDate = new Date(plan.data_termino);
                    const today = new Date();
                    const totalLessons = revista?.num_licoes || 13;
                    
                    // Calculate progress
                    let elapsedWeeks = 0;
                    if (today >= startDate) {
                      elapsedWeeks = Math.floor((Math.min(today.getTime(), endDate.getTime()) - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
                    }
                    const completedLessons = Math.min(elapsedWeeks, totalLessons);
                    const progress = (completedLessons / totalLessons) * 100;

                    return (
                      <Card key={plan.id} className="border">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            {revista?.imagem_url && (
                              <img 
                                src={revista.imagem_url} 
                                alt={revista.titulo}
                                className="w-16 h-20 object-cover rounded"
                              />
                            )}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                              <div>
                                <p className="text-xs text-muted-foreground">Revista</p>
                                <p className="font-medium">{revista?.titulo || 'Sem título'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Faixa Etária</p>
                                <p className="text-sm">{revista?.faixa_etaria_alvo || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Dia</p>
                                <p className="text-sm">{plan.dia_semana}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Período</p>
                                <p className="text-sm">
                                  {format(startDate, 'dd/MM/yyyy')} - {format(endDate, 'dd/MM/yyyy')}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Progresso</p>
                                <div className="flex items-center gap-2">
                                  <Progress value={progress} className="w-20 h-2" />
                                  <span className="text-sm">{completedLessons}/{totalLessons}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </DialogContent>
          </Dialog>

        </TabsContent>

        {/* PEDIDOS TAB */}
        <TabsContent value="pedidos" className="space-y-6">
          <AdminPedidosTab vendedores={vendedores?.map(v => ({ id: v.id, nome: v.nome })) || []} />
        </TabsContent>

        {/* CLIENTES EBD TAB */}
        <TabsContent value="clientes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Church className="h-5 w-5" />
                Clientes com Módulo EBD ({filteredEbdClients.length} de {totalEbdClients})
              </CardTitle>
              <CardDescription>Igrejas com assinatura ativa do módulo REOBOTE EBD</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filters */}
              <div className="flex flex-col gap-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome da igreja, email ou vendedor..."
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                  <Select value={clientVendedorFilter} onValueChange={setClientVendedorFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Vendedores</SelectItem>
                      <SelectItem value="none">Sem Vendedor</SelectItem>
                      {vendedores?.map((vendedor) => (
                        <SelectItem key={vendedor.id} value={vendedor.id}>
                          {vendedor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={clientPurchaseStatusFilter} onValueChange={setClientPurchaseStatusFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Status de Compra" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="ready">🟠 Pronta para Comprar (0-4)</SelectItem>
                      <SelectItem value="soon">🟡 Próxima (5-8)</SelectItem>
                      <SelectItem value="full">🟢 Estoque Cheio (9-13)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={clientStateFilter} onValueChange={setClientStateFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Estados</SelectItem>
                      {uniqueStates.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(clientSearchTerm || clientVendedorFilter !== 'all' || clientPurchaseStatusFilter !== 'all' || clientStateFilter !== 'all') && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setClientSearchTerm('');
                        setClientVendedorFilter('all');
                        setClientPurchaseStatusFilter('all');
                        setClientStateFilter('all');
                      }}
                    >
                      Limpar filtros
                    </Button>
                  )}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Igreja</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cidade/Estado</TableHead>
                    <TableHead>Status de Compra</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEbdClients.map((client) => {
                    const purchaseStatus = getClientPurchaseStatus(client.cliente_id);
                    const progress = churchProgress?.find(p => p.church_id === client.cliente_id);
                    
                    return (
                      <TableRow key={client.cliente_id}>
                        <TableCell className="font-medium">{client.church?.church_name || '-'}</TableCell>
                        <TableCell>{client.church?.pastor_email || '-'}</TableCell>
                        <TableCell>{client.church?.city && client.church?.state ? `${client.church.city}/${client.church.state}` : '-'}</TableCell>
                        <TableCell>
                          {purchaseStatus === 'ready' && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              Pronta ({progress?.remaining || 0} aulas)
                            </Badge>
                          )}
                          {purchaseStatus === 'soon' && (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                              Próxima ({progress?.remaining || 0} aulas)
                            </Badge>
                          )}
                          {purchaseStatus === 'full' && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Estoque ({progress?.remaining || 0} aulas)
                            </Badge>
                          )}
                          {!purchaseStatus && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={client.church?.vendedor_id || "sem_vendedor"}
                            onValueChange={(value) => {
                              if (client.church?.id) {
                                transferMutation.mutate({
                                  clienteId: client.church.id,
                                  vendedorId: value === "sem_vendedor" ? null : value,
                                  source: client.source,
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Selecionar vendedor" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sem_vendedor">Sem vendedor</SelectItem>
                              {vendedores?.map((vendedor) => (
                                <SelectItem key={vendedor.id} value={vendedor.id}>
                                  {vendedor.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditClient(client)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClient(client)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredEbdClients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {ebdClients && ebdClients.length > 0 
                          ? "Nenhum cliente encontrado com os filtros aplicados" 
                          : "Nenhum cliente EBD encontrado"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEADS CHURN TAB */}
        <TabsContent value="leads" className="space-y-6">
          {/* Lead Scoring KPIs */}
          <LeadScoringKPIs isAdmin />
          
          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserX className="h-5 w-5" />
                    Leads de Reativação
                  </CardTitle>
                  <CardDescription>
                    {filteredLeads.length} leads encontrados
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setImportLeadsDialogOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col lg:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, email ou vendedor..."
                    value={leadSearchTerm}
                    onChange={(e) => setLeadSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={leadVendedorFilter} onValueChange={setLeadVendedorFilter}>
                    <SelectTrigger className="w-[160px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Vendedores</SelectItem>
                      <SelectItem value="none">Sem Vendedor</SelectItem>
                      {vendedores?.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={leadStatusFilter} onValueChange={setLeadStatusFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="Não Contatado">Não Contatado</SelectItem>
                      <SelectItem value="Em Negociação">Em Negociação</SelectItem>
                      <SelectItem value="Reativado">Reativado</SelectItem>
                      <SelectItem value="Perdido">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={leadScoreFilter} onValueChange={setLeadScoreFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Score" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Scores</SelectItem>
                      <SelectItem value="Quente">Quente</SelectItem>
                      <SelectItem value="Morno">Morno</SelectItem>
                      <SelectItem value="Frio">Frio</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={leadContaFilter} onValueChange={setLeadContaFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Conta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Contas</SelectItem>
                      <SelectItem value="criada">Criada</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Leads Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Igreja</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Como Conheceu</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.nome_igreja}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          {lead.email && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </span>
                          )}
                          {lead.telefone && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {lead.telefone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lead.endereco_cidade && lead.endereco_estado
                          ? `${lead.endereco_cidade}/${lead.endereco_estado}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {(lead as any).como_conheceu || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          <span className="text-muted-foreground">{(lead as any).origem_lead || '-'}</span>
                          <span className="text-muted-foreground">{(lead as any).tipo_lead || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            lead.status_lead === 'Reativado'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : lead.status_lead === 'Em Negociação'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : lead.status_lead === 'Perdido'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                          }
                        >
                          {lead.status_lead}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const score = getLeadScore(lead);
                          return (
                            <Badge
                              variant="outline"
                              className={
                                score === 'Quente'
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : score === 'Morno'
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }
                            >
                              {score}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            lead.conta_criada
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                          }
                        >
                          {lead.conta_criada ? 'Criada' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={lead.vendedor_id || "sem_vendedor"}
                          onValueChange={async (value) => {
                            const { error } = await supabase
                              .from('ebd_leads_reativacao')
                              .update({ vendedor_id: value === "sem_vendedor" ? null : value })
                              .eq('id', lead.id);
                            if (error) {
                              toast.error('Erro ao atribuir vendedor');
                            } else {
                              toast.success('Vendedor atribuído');
                              refetchLeads();
                            }
                          }}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Selecionar vendedor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sem_vendedor">Sem vendedor</SelectItem>
                            {vendedores?.map((vendedor) => (
                              <SelectItem key={vendedor.id} value={vendedor.id}>
                                {vendedor.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Navigate to activation with lead data
                              navigate(`/vendedor/ativacao?leadId=${lead.id}&leadNome=${encodeURIComponent(lead.nome_igreja)}`);
                            }}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Ativar Painel
                          </Button>
                          {role === 'admin' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditLead(lead)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteLead(lead)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {leadsReativacao && leadsReativacao.length > 0
                          ? "Nenhum lead encontrado com os filtros aplicados"
                          : "Nenhum lead cadastrado. Importe um arquivo CSV para começar."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* VENDEDORES TAB */}
        <TabsContent value="vendedores" className="space-y-6">
          <div className="flex justify-end gap-2">
            <Dialog open={transferDialogOpen} onOpenChange={(open) => { 
              setTransferDialogOpen(open); 
              if (!open) { 
                setTransferSearchTerm(''); 
                setSelectedChurch(''); 
                setTargetVendedor(''); 
              } 
            }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Transferir Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Transferir Cliente</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {/* Search Field */}
                  <div className="space-y-2">
                    <Label>Pesquisar Cliente</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Digite nome, CNPJ ou email..."
                        value={transferSearchTerm}
                        onChange={(e) => setTransferSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Search Results */}
                  {transferSearchTerm.trim() && (
                    <div className="space-y-2">
                      <Label>Resultados ({filteredTransferClients.length})</Label>
                      <div className="max-h-60 overflow-y-auto border rounded-md">
                        {filteredTransferClients.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            Nenhum cliente encontrado
                          </div>
                        ) : (
                          filteredTransferClients.map((client) => {
                            const isSelected = selectedChurch === `${client.cliente_id}|${client.source}`;
                            const vendedorAtual = getVendedorName(client.church?.vendedor_id);
                            const documento = client.cnpj || client.cpf || '';
                            const documentoFormatado = documento.length === 14 
                              ? documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
                              : documento.length === 11 
                                ? documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
                                : documento;
                            return (
                              <div 
                                key={client.cliente_id}
                                className={`p-3 border-b last:border-b-0 cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/50'}`}
                                onClick={() => setSelectedChurch(`${client.cliente_id}|${client.source}`)}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`mt-1 h-4 w-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                                    {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{client.church?.church_name}</p>
                                    {documentoFormatado && (
                                      <p className="text-xs text-muted-foreground">CNPJ/CPF: {documentoFormatado}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      Vendedor atual: <span className={vendedorAtual === 'Sem vendedor' ? 'text-orange-500' : 'text-primary'}>{vendedorAtual}</span>
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* New Vendedor Select */}
                  <div className="space-y-2">
                    <Label>Novo Vendedor</Label>
                    <Select value={targetVendedor || "none"} onValueChange={(val) => setTargetVendedor(val === "none" ? "" : val)}>
                      <SelectTrigger><SelectValue placeholder="Selecione o vendedor (ou deixe vazio)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem vendedor</SelectItem>
                        {vendedores?.map((vendedor) => (
                          <SelectItem key={vendedor.id} value={vendedor.id}>{vendedor.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selected Client Summary */}
                  {selectedChurch && (
                    <div className="p-3 bg-muted/50 rounded-md text-sm">
                      <p><strong>Cliente selecionado:</strong> {ebdClients?.find(c => `${c.cliente_id}|${c.source}` === selectedChurch)?.church?.church_name}</p>
                      <p><strong>Novo vendedor:</strong> {targetVendedor ? vendedores?.find(v => v.id === targetVendedor)?.nome : 'Sem vendedor'}</p>
                    </div>
                  )}

                  <Button 
                    onClick={() => {
                      const [clienteId, source] = selectedChurch.split('|');
                      transferMutation.mutate({ clienteId, vendedorId: targetVendedor || null, source: source as 'churches' | 'ebd_clientes' });
                    }} 
                    className="w-full" 
                    disabled={!selectedChurch}
                  >
                    Transferir
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><UserPlus className="h-4 w-4 mr-2" />Novo Vendedor/Representante</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingVendedor ? `Editar ${formData.tipo_perfil === 'representante' ? 'Representante' : 'Vendedor'}` : 'Novo Vendedor/Representante'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Tipo de Perfil - Only on creation */}
                  {!editingVendedor && (
                    <div className="space-y-2">
                      <Label>Tipo de Perfil <span className="text-destructive">*</span></Label>
                      <Select value={formData.tipo_perfil} onValueChange={(value: 'vendedor' | 'representante') => setFormData({ ...formData, tipo_perfil: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo de perfil" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vendedor">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Vendedor</span>
                              <span className="text-xs text-muted-foreground">Acesso completo: leads, prospecção, ativação</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="representante">
                            <div className="flex flex-col items-start">
                              <span className="font-medium">Representante</span>
                              <span className="text-xs text-muted-foreground">Apenas vendas diretas aos clientes da carteira</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Foto de Perfil</Label>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={formData.foto_url} />
                        <AvatarFallback><User className="h-10 w-10" /></AvatarFallback>
                      </Avatar>
                      <div>
                        <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" id="vendedor-avatar-upload" disabled={uploadingImage} />
                        <Button type="button" variant="outline" onClick={() => document.getElementById("vendedor-avatar-upload")?.click()} disabled={uploadingImage}>
                          <Upload className="h-4 w-4 mr-2" />{uploadingImage ? "Carregando..." : "Escolher Foto"}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Completo <span className="text-destructive">*</span></Label>
                    <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email <span className="text-destructive">*</span></Label>
                    <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {editingVendedor ? 'Nova Senha' : 'Senha de Acesso'} 
                      {!editingVendedor && <span className="text-destructive">*</span>}
                      {editingVendedor && <span className="text-muted-foreground text-xs ml-1">(deixe vazio para manter)</span>}
                    </Label>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        value={formData.senha} 
                        onChange={(e) => setFormData({ ...formData, senha: e.target.value })} 
                        placeholder={editingVendedor ? "Deixe vazio para manter a senha atual" : "Mínimo 6 caracteres"} 
                        required={!editingVendedor} 
                      />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Comissão (%)</Label>
                      <Input type="number" step="0.01" min="0" max="100" value={formData.comissao_percentual} onChange={(e) => setFormData({ ...formData, comissao_percentual: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Meta Mensal (R$)</Label>
                      <Input type="number" step="0.01" min="0" value={formData.meta_mensal_valor} onChange={(e) => setFormData({ ...formData, meta_mensal_valor: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Gerente Responsável - aparece apenas para vendedores (não gerentes) */}
                  {!formData.is_gerente && (
                    <div className="space-y-2">
                      <Label>Gerente Responsável</Label>
                      <Select 
                        value={formData.gerente_id || '_none'} 
                        onValueChange={(value) => setFormData({ ...formData, gerente_id: value === '_none' ? '' : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sem gerente (vendedor direto)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Sem gerente</SelectItem>
                          {vendedores?.filter(v => v.is_gerente && v.id !== editingVendedor?.id).map(g => (
                            <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">O gerente receberá comissão sobre as vendas deste vendedor</p>
                    </div>
                  )}

                  {/* Checkbox É Gerente */}
                  <div className="flex items-center space-x-2 p-3 rounded-lg border bg-muted/30">
                    <input 
                      type="checkbox" 
                      id="is_gerente"
                      checked={formData.is_gerente} 
                      onChange={(e) => setFormData({ ...formData, is_gerente: e.target.checked, gerente_id: e.target.checked ? '' : formData.gerente_id })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div>
                      <Label htmlFor="is_gerente" className="cursor-pointer font-medium">É Gerente</Label>
                      <p className="text-xs text-muted-foreground">Gerentes recebem comissão sobre vendas da equipe</p>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando...' : (editingVendedor ? 'Atualizar' : `Criar ${formData.tipo_perfil === 'representante' ? 'Representante' : 'Vendedor'}`)}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Vendedores Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vendedores?.map((vendedor) => (
              <Card key={vendedor.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={vendedor.foto_url || undefined} />
                        <AvatarFallback>{vendedor.nome.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{vendedor.nome}</p>
                          <Badge variant={vendedor.tipo_perfil === 'representante' ? 'outline' : 'default'} className="text-xs">
                            {vendedor.tipo_perfil === 'representante' ? 'Representante' : 'Vendedor'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{vendedor.email}</p>
                      </div>
                    </div>
                    <Badge variant={vendedor.status === 'Ativo' ? 'default' : 'secondary'}>{vendedor.status}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Comissão</p>
                      <p className="font-medium">{vendedor.comissao_percentual}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Meta Mensal</p>
                      <p className="font-medium">{formatCurrency(vendedor.meta_mensal_valor)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Clientes</p>
                      <p className="font-medium">{getClientCount(vendedor.id)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => impersonateVendedor({
                        id: vendedor.id,
                        nome: vendedor.nome,
                        email: vendedor.email,
                        email_bling: null,
                        comissao_percentual: vendedor.comissao_percentual,
                        meta_mensal_valor: vendedor.meta_mensal_valor,
                        tipo_perfil: vendedor.tipo_perfil,
                        status: vendedor.status,
                        foto_url: vendedor.foto_url,
                      })}
                      title="Acessar o painel como este vendedor"
                    >
                      <Eye className="h-4 w-4 mr-1" />Acessar
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(vendedor)}>
                      <Pencil className="h-4 w-4 mr-1" />Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(vendedor.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!vendedores || vendedores.length === 0) && (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">Nenhum vendedor ou representante cadastrado</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* CATALOGO TAB - Only visible for admins, not for gerente_ebd */}
        {!isGerenteEbd && (
          <TabsContent value="catalogo" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate('/admin/curriculo-ebd')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-500/10">
                      <BookOpen className="h-8 w-8 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Gestão de Catálogo EBD</h3>
                      <p className="text-sm text-muted-foreground">Cadastre, edite e gerencie revistas e suas lições</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate('/admin/quiz-mestre')}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-purple-500/10">
                      <FileQuestion className="h-8 w-8 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Quiz Mestre</h3>
                      <p className="text-sm text-muted-foreground">Cadastre as 10 perguntas de cada lição para gamificação</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Como funciona o Quiz Mestre?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  O Quiz Mestre é a funcionalidade de gamificação do sistema EBD. Cada lição da revista precisa ter 10 perguntas cadastradas para que os alunos possam responder e ganhar pontos.
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="font-medium">1. Selecione a Revista</p>
                    <p className="text-sm text-muted-foreground">Escolha a revista que deseja cadastrar o quiz</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="font-medium">2. Cadastre as Perguntas</p>
                    <p className="text-sm text-muted-foreground">10 perguntas por lição com 3 opções de resposta</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <p className="font-medium">3. Ative para os Alunos</p>
                    <p className="text-sm text-muted-foreground">Quando todas as 13 lições estiverem completas, o quiz é ativado automaticamente</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

        {/* Image Crop Dialog */}
        <ImageCropDialog
          open={showCropDialog}
          onOpenChange={(open) => { if (!open) { setShowCropDialog(false); setSelectedImage(null); } }}
          imageSrc={selectedImage || ""}
          onCropComplete={handleCropComplete}
        />

        {/* Import Leads Dialog */}
        <ImportLeadsDialog
          open={importLeadsDialogOpen}
          onOpenChange={setImportLeadsDialogOpen}
          vendedores={vendedores || []}
          onImportComplete={() => refetchLeads()}
        />

        {/* Edit Lead Dialog */}
        <Dialog open={editLeadDialogOpen} onOpenChange={setEditLeadDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Lead</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da Igreja *</Label>
                  <Input
                    value={editLeadForm.nome_igreja}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, nome_igreja: e.target.value })}
                    placeholder="Nome da igreja"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input
                    value={editLeadForm.nome_responsavel}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, nome_responsavel: e.target.value })}
                    placeholder="Nome do responsável"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editLeadForm.email}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={editLeadForm.telefone}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input
                    value={editLeadForm.cnpj}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editLeadForm.status_lead}
                    onValueChange={(value) => setEditLeadForm({ ...editLeadForm, status_lead: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Não Contatado">Não Contatado</SelectItem>
                      <SelectItem value="Em Negociação">Em Negociação</SelectItem>
                      <SelectItem value="Reativado">Reativado</SelectItem>
                      <SelectItem value="Perdido">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={editLeadForm.endereco_cep}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, endereco_cep: e.target.value })}
                    placeholder="00000-000"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Rua</Label>
                  <Input
                    value={editLeadForm.endereco_rua}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, endereco_rua: e.target.value })}
                    placeholder="Nome da rua"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input
                    value={editLeadForm.endereco_numero}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, endereco_numero: e.target.value })}
                    placeholder="Nº"
                  />
                </div>
                <div className="col-span-3 space-y-2">
                  <Label>Complemento</Label>
                  <Input
                    value={editLeadForm.endereco_complemento}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, endereco_complemento: e.target.value })}
                    placeholder="Apto, Sala, etc."
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input
                    value={editLeadForm.endereco_bairro}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, endereco_bairro: e.target.value })}
                    placeholder="Bairro"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={editLeadForm.endereco_cidade}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, endereco_cidade: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input
                    value={editLeadForm.endereco_estado}
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, endereco_estado: e.target.value })}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Input
                  value={editLeadForm.observacoes}
                  onChange={(e) => setEditLeadForm({ ...editLeadForm, observacoes: e.target.value })}
                  placeholder="Anotações sobre o lead..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditLeadDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveLead} disabled={updateLeadMutation.isPending}>
                {updateLeadMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Lead Confirmation Dialog */}
        <Dialog open={deleteLeadDialogOpen} onOpenChange={setDeleteLeadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir Lead</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Tem certeza que deseja excluir o lead <strong>{selectedLead?.nome_igreja}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteLeadDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDeleteLead} disabled={deleteLeadMutation.isPending}>
                {deleteLeadMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Client Dialog */}
        <Dialog open={editClientDialogOpen} onOpenChange={setEditClientDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome da Igreja <span className="text-destructive">*</span></Label>
                <Input
                  value={editClientForm.nome_igreja}
                  onChange={(e) => setEditClientForm({ ...editClientForm, nome_igreja: e.target.value })}
                  placeholder="Nome da igreja"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editClientForm.email}
                    onChange={(e) => setEditClientForm({ ...editClientForm, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={editClientForm.telefone}
                    onChange={(e) => setEditClientForm({ ...editClientForm, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={editClientForm.cnpj}
                  onChange={(e) => setEditClientForm({ ...editClientForm, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={editClientForm.endereco_cidade}
                    onChange={(e) => setEditClientForm({ ...editClientForm, endereco_cidade: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input
                    value={editClientForm.endereco_estado}
                    onChange={(e) => setEditClientForm({ ...editClientForm, endereco_estado: e.target.value })}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setEditClientDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveClient} disabled={updateClientMutation.isPending}>
                {updateClientMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Client Confirmation Dialog */}
        <Dialog open={deleteClientDialogOpen} onOpenChange={setDeleteClientDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir Cliente</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Tem certeza que deseja excluir o cliente <strong>{selectedClient?.church?.church_name}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteClientDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDeleteClient} disabled={deleteClientMutation.isPending}>
                {deleteClientMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
