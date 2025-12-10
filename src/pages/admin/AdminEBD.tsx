import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";
import { AdminPedidosTab } from "@/components/admin/AdminPedidosTab";
import { ImportLeadsDialog } from "@/components/admin/ImportLeadsDialog";
import { LeadScoringKPIs } from "@/components/leads/LeadScoringKPIs";
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
  church: {
    id: string;
    church_name: string;
    pastor_email: string;
    city: string | null;
    state: string | null;
    vendedor_id: string | null;
  } | null;
  source?: 'churches' | 'ebd_clientes';
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
  const [activeTab, setActiveTab] = useState("vendas");
  const [period, setPeriod] = useState("thisMonth");
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Vendedores state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [editingVendedor, setEditingVendedor] = useState<Vendedor | null>(null);
  const [selectedChurch, setSelectedChurch] = useState<string>('');
  const [targetVendedor, setTargetVendedor] = useState<string>('');
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
  });

  // Clientes EBD filter states
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [clientVendedorFilter, setClientVendedorFilter] = useState('all');
  const [clientStatusFilter, setClientStatusFilter] = useState('all');
  const [clientPurchaseStatusFilter, setClientPurchaseStatusFilter] = useState('all');
  const [clientStateFilter, setClientStateFilter] = useState('all');

  // Leads state
  const [importLeadsDialogOpen, setImportLeadsDialogOpen] = useState(false);
  const [leadSearchTerm, setLeadSearchTerm] = useState('');
  const [leadVendedorFilter, setLeadVendedorFilter] = useState('all');
  const [leadStatusFilter, setLeadStatusFilter] = useState('all');
  const [leadScoreFilter, setLeadScoreFilter] = useState('all');
  const [leadContaFilter, setLeadContaFilter] = useState('all');

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

  // Query to fetch churches with their REMAINING lessons progress
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
        start = startOfMonth(now);
        break;
      default:
        start = startOfMonth(now);
    }
    return { start, end };
  }, [period, customStartDate, customEndDate]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => {
      if (!order.created_at) return false;
      const orderDate = parseISO(order.created_at);
      return isWithinInterval(orderDate, { start: dateRange.start, end: dateRange.end });
    });
  }, [orders, dateRange]);

  // KPIs
  const pendingOrders = filteredOrders.filter(o => o.payment_status === 'pending' && o.status !== 'cancelled');
  const paidOrders = filteredOrders.filter(o => o.payment_status === 'approved');
  const cancelledOrders = filteredOrders.filter(o => o.status === 'cancelled');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.valor_total), 0);
  const totalProducts = paidOrders.reduce((sum, o) => sum + Number(o.valor_produtos), 0);
  const totalShipping = paidOrders.reduce((sum, o) => sum + Number(o.valor_frete), 0);
  const avgTicket = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
  const totalItems = paidOrders.reduce((sum, o) => 
    sum + (o.ebd_pedidos_itens?.reduce((s, item) => s + item.quantidade, 0) || 0), 0
  );
  const totalEbdClients = ebdClients?.length || 0;
  const deliveryStats = useMemo(() => {
    const shipped = paidOrders.filter(o => o.codigo_rastreio).length;
    const awaitingShipment = paidOrders.filter(o => !o.codigo_rastreio).length;
    return { shipped, awaitingShipment };
  }, [paidOrders]);

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
    return vendedores.map(vendedor => {
      const vendedorOrders = paidOrders.filter(order => 
        order.church?.vendedor_id === vendedor.id
      );
      const totalSales = vendedorOrders.length;
      const totalValue = vendedorOrders.reduce((sum, o) => sum + Number(o.valor_total), 0);
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
  }, [vendedores, paidOrders]);

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
        },
      });
      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
      toast.success('Vendedor criado com sucesso!');
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar vendedor');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Omit<typeof formData, 'senha'> }) => {
      const { error } = await supabase.from('vendedores').update({
        nome: data.nome,
        email: data.email,
        foto_url: data.foto_url || null,
        comissao_percentual: data.comissao_percentual,
        status: data.status,
        meta_mensal_valor: data.meta_mensal_valor,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
      toast.success('Vendedor atualizado com sucesso!');
      resetForm();
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar vendedor');
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
    mutationFn: async ({ churchId, vendedorId }: { churchId: string; vendedorId: string | null }) => {
      const { error } = await supabase.from('churches').update({ vendedor_id: vendedorId }).eq('id', churchId);
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

  const resetForm = () => {
    setFormData({ nome: '', email: '', senha: '', foto_url: '', comissao_percentual: 5, status: 'Ativo', meta_mensal_valor: 0 });
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
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) { toast.error("Preencha o nome completo"); return; }
    if (!formData.email.trim()) { toast.error("Preencha o email"); return; }
    if (!editingVendedor && !formData.senha.trim()) { toast.error("Preencha a senha de acesso"); return; }
    if (!editingVendedor && formData.senha.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres"); return; }
    
    setIsSubmitting(true);
    try {
      if (editingVendedor) {
        const { senha, ...dataWithoutPassword } = formData;
        await updateMutation.mutateAsync({ id: editingVendedor.id, data: dataWithoutPassword });
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin EBD</h1>
          <p className="text-muted-foreground">Gerenciamento completo do módulo EBD</p>
        </div>
        
        {/* Period Filter */}
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="thisMonth">Mês Atual</SelectItem>
              <SelectItem value="lastMonth">Mês Anterior</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

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

      {/* Lead Scoring KPIs */}
      <LeadScoringKPIs isAdmin />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes EBD</TabsTrigger>
          <TabsTrigger value="leads">Leads Churn</TabsTrigger>
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
        </TabsList>

        {/* VENDAS TAB */}
        <TabsContent value="vendas" className="space-y-6">
          {/* EBD Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Clientes EBD</p>
                    <p className="text-2xl font-bold">{totalEbdClients}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Alunos</p>
                    <p className="text-2xl font-bold">{totalAlunos ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Professores</p>
                    <p className="text-2xl font-bold">{totalProfessores ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Church className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Turmas</p>
                    <p className="text-2xl font-bold">{totalTurmas ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

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

          {/* Sales KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{formatCurrency(totalRevenue)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Produtos: {formatCurrency(totalProducts)} | Frete: {formatCurrency(totalShipping)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pedidos Pagos</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{paidOrders.length}</div>
                <p className="text-xs text-muted-foreground mt-1">{totalItems} itens vendidos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(avgTicket)}</div>
                <p className="text-xs text-muted-foreground mt-1">Por pedido pago</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Status Logístico</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">{deliveryStats.shipped} Enviados</Badge>
                  <Badge variant="secondary">{deliveryStats.awaitingShipment} Aguardando</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Faturamento por Dia</CardTitle>
                <CardDescription>Evolução da receita no período</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyRevenueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} className="text-xs" />
                      <Tooltip formatter={(value: number) => [formatCurrency(value), "Receita"]} />
                      <Line type="monotone" dataKey="receita" stroke={COLORS.primary} strokeWidth={2} dot={{ fill: COLORS.primary }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">Sem dados para o período</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Status</CardTitle>
                <CardDescription>Status de pagamento dos pedidos</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredOrders.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={paymentStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                        {paymentStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, "Pedidos"]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">Sem dados para o período</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Faturamento por Estado</CardTitle>
                <CardDescription>Top 10 estados por valor de vendas</CardDescription>
              </CardHeader>
              <CardContent>
                {stateDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stateDistributionData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} className="text-xs" />
                      <YAxis type="category" dataKey="name" width={40} className="text-xs" />
                      <Tooltip formatter={(value: number) => [formatCurrency(value), "Faturamento"]} />
                      <Bar dataKey="value" fill={COLORS.chart1} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">Sem dados para o período</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métodos de Envio</CardTitle>
                <CardDescription>Distribuição por tipo de frete</CardDescription>
              </CardHeader>
              <CardContent>
                {shippingMethodData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={shippingMethodData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {shippingMethodData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, "Pedidos"]} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">Sem dados para o período</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Seller Evolution Chart */}
          {vendedores && vendedores.length > 0 && salesEvolutionBySeller.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5 text-primary" />
                  Evolução de Vendas por Vendedor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={salesEvolutionBySeller}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} className="text-xs" />
                    <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name]} />
                    {vendedores.map((vendedor, index) => (
                      <Line key={vendedor.id} type="monotone" dataKey={vendedor.nome} stroke={SELLER_COLORS[index % SELLER_COLORS.length]} strokeWidth={2} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-4 mt-4 justify-center">
                  {vendedores.map((vendedor, index) => (
                    <div key={vendedor.id} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SELLER_COLORS[index % SELLER_COLORS.length] }} />
                      <span className="text-sm text-muted-foreground">{vendedor.nome}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Seller Ranking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Ranking de Vendedores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Rank</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead className="text-center">Vendas</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="w-[200px]">Progresso da Meta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendedorStats.map((vendedor, index) => (
                    <TableRow key={vendedor.id}>
                      <TableCell>
                        {index === 0 && <span className="text-2xl">🥇</span>}
                        {index === 1 && <span className="text-2xl">🥈</span>}
                        {index === 2 && <span className="text-2xl">🥉</span>}
                        {index > 2 && <span className="text-lg font-medium text-muted-foreground">{index + 1}</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={vendedor.foto_url || undefined} />
                            <AvatarFallback>{vendedor.nome.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{vendedor.nome}</div>
                            <div className="text-xs text-muted-foreground">{vendedor.comissao_percentual}% comissão</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center"><Badge variant="secondary">{vendedor.totalSales}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(vendedor.totalValue)}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">{formatCurrency(vendedor.commission)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Progress value={vendedor.goalProgress} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{vendedor.goalProgressRaw.toFixed(0)}%</span>
                            <span>Meta: {formatCurrency(vendedor.meta_mensal_valor)}</span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {vendedorStats.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum vendedor ativo cadastrado</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Commission Summary */}
          {vendedorStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  Resumo de Comissões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Total a Pagar</div>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(vendedorStats.reduce((sum, v) => sum + v.commission, 0))}</div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Média por Vendedor</div>
                    <div className="text-2xl font-bold">{formatCurrency(vendedorStats.reduce((sum, v) => sum + v.totalValue, 0) / (vendedorStats.length || 1))}</div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Vendedores que Bateram Meta</div>
                    <div className="text-2xl font-bold">{vendedorStats.filter(v => v.goalProgressRaw >= 100).length} / {vendedorStats.length}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Period Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo do Período</CardTitle>
              <CardDescription>
                {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} até {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                  <p className="text-xl font-semibold">{filteredOrders.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                  <p className="text-xl font-semibold">{filteredOrders.length > 0 ? ((paidOrders.length / filteredOrders.length) * 100).toFixed(1) : 0}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Taxa de Cancelamento</p>
                  <p className="text-xl font-semibold">{filteredOrders.length > 0 ? ((cancelledOrders.length / filteredOrders.length) * 100).toFixed(1) : 0}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Taxa de Envio</p>
                  <p className="text-xl font-semibold">{paidOrders.length > 0 ? ((deliveryStats.shipped / paidOrders.length) * 100).toFixed(1) : 0}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
                                  churchId: client.church.id,
                                  vendedorId: value === "sem_vendedor" ? null : value,
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
                      </TableRow>
                    );
                  })}
                  {filteredEbdClients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserX className="h-5 w-5" />
                    Leads de Reativação (Churn)
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
            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Transferir Cliente
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transferir Cliente</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select value={selectedChurch} onValueChange={setSelectedChurch}>
                      <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                      <SelectContent>
                        {churches?.map((church) => (
                          <SelectItem key={church.id} value={church.id}>{church.church_name} ({getVendedorName(church.vendedor_id)})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Novo Vendedor</Label>
                    <Select value={targetVendedor} onValueChange={setTargetVendedor}>
                      <SelectTrigger><SelectValue placeholder="Selecione o vendedor (ou deixe vazio)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sem vendedor</SelectItem>
                        {vendedores?.map((vendedor) => (
                          <SelectItem key={vendedor.id} value={vendedor.id}>{vendedor.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => transferMutation.mutate({ churchId: selectedChurch, vendedorId: targetVendedor || null })} className="w-full">Transferir</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><UserPlus className="h-4 w-4 mr-2" />Novo Vendedor</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingVendedor ? 'Editar Vendedor' : 'Novo Vendedor'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                  {!editingVendedor && (
                    <div className="space-y-2">
                      <Label>Senha de Acesso <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} value={formData.senha} onChange={(e) => setFormData({ ...formData, senha: e.target.value })} placeholder="Mínimo 6 caracteres" required />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
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
                  <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Salvando...' : (editingVendedor ? 'Atualizar' : 'Criar Vendedor')}</Button>
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
                        <p className="font-semibold">{vendedor.nome}</p>
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
                <CardContent className="py-8 text-center text-muted-foreground">Nenhum vendedor cadastrado</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* CATALOGO TAB */}
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
    </div>
  );
}
