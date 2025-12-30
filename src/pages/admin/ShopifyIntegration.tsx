import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Store, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  ShoppingBag, 
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
} from "lucide-react";
import { 
  SHOPIFY_STORE_PERMANENT_DOMAIN, 
  SHOPIFY_API_VERSION,
  SHOPIFY_STOREFRONT_URL,
  fetchShopifyProducts 
} from "@/lib/shopify";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ShopifyIntegration() {
  const [showToken, setShowToken] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    productCount?: number;
  } | null>(null);

  // Test connection to Shopify
  const { mutate: testConnection, isPending: isTestingConnection } = useMutation({
    mutationFn: async () => {
      const products = await fetchShopifyProducts(10);
      return products;
    },
    onSuccess: (products) => {
      setTestResult({
        success: true,
        message: "Conexão bem-sucedida!",
        productCount: products.length,
      });
      toast.success("Conexão com Shopify verificada!");
    },
    onError: (error: Error) => {
      setTestResult({
        success: false,
        message: error.message,
      });
      toast.error("Falha na conexão com Shopify", {
        description: error.message,
      });
    },
  });

  // Fetch products count
  const { data: allProducts, isLoading: isLoadingProducts, refetch: refetchProducts } = useQuery({
    queryKey: ['admin-shopify-products-count'],
    queryFn: () => fetchShopifyProducts(500),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integração Shopify</h1>
        <p className="text-muted-foreground">
          Gerencie a integração da loja Shopify para o catálogo de produtos
        </p>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Status da Integração
          </CardTitle>
          <CardDescription>
            Verifique o status da conexão com a Shopify
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Loja</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={SHOPIFY_STORE_PERMANENT_DOMAIN} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => copyToClipboard(SHOPIFY_STORE_PERMANENT_DOMAIN, "Domínio")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  asChild
                >
                  <a 
                    href={`https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/admin`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Versão da API</Label>
              <Input 
                value={SHOPIFY_API_VERSION} 
                readOnly 
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Storefront Access Token</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="password"
                value="••••••••••••••••••••" 
                readOnly 
                className="font-mono text-sm"
              />
              <Badge variant="secondary">
                Configurado via Secret
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              O token está armazenado de forma segura nos secrets do projeto.
            </p>
          </div>

          <div className="space-y-2">
            <Label>URL da API Storefront</Label>
            <div className="flex items-center gap-2">
              <Input 
                value={SHOPIFY_STOREFRONT_URL} 
                readOnly 
                className="font-mono text-sm text-xs"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => copyToClipboard(SHOPIFY_STOREFRONT_URL, "URL")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <Button 
              onClick={() => testConnection()}
              disabled={isTestingConnection}
            >
              {isTestingConnection ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Testar Conexão
                </>
              )}
            </Button>

            {testResult && (
              <Badge 
                variant={testResult.success ? "default" : "destructive"}
                className="flex items-center gap-1"
              >
                {testResult.success ? (
                  <>
                    <CheckCircle className="h-3 w-3" />
                    {testResult.message} ({testResult.productCount} produtos)
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" />
                    Erro: {testResult.message}
                  </>
                )}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Products Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Produtos da Loja
          </CardTitle>
          <CardDescription>
            Resumo dos produtos disponíveis na Shopify
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingProducts ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : allProducts ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold">{allProducts.length}</p>
                  <p className="text-sm text-muted-foreground">
                    produtos encontrados
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => refetchProducts()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>

              {allProducts.length === 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Nenhum produto encontrado</AlertTitle>
                  <AlertDescription>
                    Verifique se a loja Shopify tem produtos publicados e se o token de acesso tem as permissões corretas.
                  </AlertDescription>
                </Alert>
              )}

              {allProducts.length > 0 && (
                <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">Produto</th>
                        <th className="text-right p-2">Preço</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allProducts.slice(0, 20).map((product) => (
                        <tr key={product.node.id} className="border-t">
                          <td className="p-2">{product.node.title}</td>
                          <td className="p-2 text-right">
                            R$ {parseFloat(product.node.priceRange.minVariantPrice.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                      {allProducts.length > 20 && (
                        <tr className="border-t">
                          <td colSpan={2} className="p-2 text-center text-muted-foreground">
                            ... e mais {allProducts.length - 20} produtos
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro ao carregar produtos</AlertTitle>
              <AlertDescription>
                Não foi possível carregar os produtos da Shopify. Verifique a conexão.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Resolução de Problemas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Se os produtos não aparecem:</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Verifique se o <strong>Storefront Access Token</strong> está correto</li>
              <li>Certifique-se de que o app Shopify tem o scope <code>unauthenticated_read_product_listings</code></li>
              <li>Verifique se os produtos estão <strong>publicados</strong> no canal "Online Store"</li>
              <li>Confirme se a loja está ativa e não em modo de senha</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Token incorreto (erro 401/403):</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Acesse o admin da Shopify → Apps → Seu App → API credentials</li>
              <li>Copie o <strong>Storefront access token</strong> (não o Admin API token)</li>
              <li>Atualize o token no arquivo <code>src/lib/shopify.ts</code></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Erro de pagamento (402):</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>A loja Shopify precisa de um plano pago ativo</li>
              <li>Verifique o status da assinatura em <code>Settings → Plan</code></li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
