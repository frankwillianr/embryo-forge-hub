import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Clock, CheckCircle, XCircle, CreditCard, Mail, Loader2, Calendar, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { Banner, BannerStatus } from "@/types/banner";

const MeusAnunciosPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  // Buscar cidade
  const { data: cidade } = useQuery({
    queryKey: ["cidade-by-slug", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Buscar banners do usuário para esta cidade
  const { data: banners, isLoading } = useQuery({
    queryKey: ["meus-banners", user?.id, cidade?.id],
    queryFn: async () => {
      if (!user?.id || !cidade?.id) return [];

      // Buscar pagamentos do usuário para esta cidade
      const { data: pagamentos, error: pagError } = await supabase
        .from("pagamento_banner")
        .select("banner_id")
        .eq("user_id", user.id)
        .eq("cidade_id", cidade.id);

      if (pagError) throw pagError;

      // Se não há pagamentos, buscar banners diretamente pelo admin_user_id
      let bannerIds: string[] = pagamentos?.map(p => p.banner_id) || [];

      // Também buscar banners criados pelo usuário diretamente
      const { data: directBanners, error: directError } = await supabase
        .from("banner")
        .select("id")
        .eq("admin_user_id", user.id);

      if (directError) throw directError;

      if (directBanners) {
        bannerIds = [...new Set([...bannerIds, ...directBanners.map(b => b.id)])];
      }

      if (bannerIds.length === 0) return [];

      // Buscar detalhes dos banners
      const { data: bannersData, error: bannersError } = await supabase
        .from("banner")
        .select("*")
        .in("id", bannerIds)
        .order("created_at", { ascending: false });

      if (bannersError) throw bannersError;

      // Para cada banner, buscar info de pagamento e dias de exibição
      const bannersWithInfo = await Promise.all(
        (bannersData || []).map(async (banner) => {
          // Buscar pagamento
          const { data: pagamento } = await supabase
            .from("pagamento_banner")
            .select("*")
            .eq("banner_id", banner.id)
            .maybeSingle();

          // Buscar dias de exibição
          const { data: dias } = await supabase
            .from("rel_banner_dias")
            .select("data_exibicao, utilizado")
            .eq("banner_id", banner.id)
            .order("data_exibicao", { ascending: true });

          return {
            ...banner,
            pagamento,
            dias_exibicao: dias || [],
          };
        })
      );

      return bannersWithInfo;
    },
    enabled: !!user?.id && !!cidade?.id,
  });

  // Função para reenviar email de pagamento (gera novo link se expirado)
  const handleResendEmail = async (bannerId: string) => {
    if (!cidade?.id) {
      toast.error("Cidade não identificada");
      return;
    }
    
    setSendingEmail(bannerId);
    console.log("[MeusAnuncios] Sending email request:", { 
      banner_id: bannerId, 
      cidade_id: cidade.id,
      cidadeNome: cidade.nome 
    });
    
    try {
      const { data, error } = await supabase.functions.invoke("send-banner-payment-email", {
        body: { 
          banner_id: bannerId,
          cidade_id: cidade.id,
        },
      });
      
      console.log("[MeusAnuncios] Function response:", { data, error });

      if (error) throw error;
      
      toast.success("Email enviado com sucesso! Verifique sua caixa de entrada.", {
        description: "O link de pagamento é válido por 1 hora.",
        duration: 5000,
      });
    } catch (error: any) {
      console.error("Erro ao reenviar email:", error);
      toast.error("Erro ao enviar email", {
        description: error.message || "Tente novamente mais tarde.",
      });
    } finally {
      setSendingEmail(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground mb-4">Você precisa estar logado para ver seus anúncios.</p>
        <Button onClick={() => navigate(`/cidade/${slug}/auth`)}>
          Fazer Login
        </Button>
      </div>
    );
  }

  // Categorizar banners
  const aguardandoPagamento = banners?.filter((b: any) => 
    b.status === "aguardando_pagamento"
  ) || [];

  const pendentes = banners?.filter((b: any) => 
    b.status === "pendente" && b.pagamento?.status === "pago"
  ) || [];

  const hoje = new Date().toISOString().split("T")[0];
  
  const ativos = banners?.filter((b: any) => {
    if (b.status !== "ativo" || !b.ativo) return false;
    // Verificar se tem exibição hoje
    return b.dias_exibicao?.some((d: any) => d.data_exibicao === hoje);
  }) || [];

  const futuros = banners?.filter((b: any) => {
    if (b.status !== "ativo" || !b.ativo) return false;
    // Verificar se tem exibição futura mas não hoje
    const temFuturo = b.dias_exibicao?.some((d: any) => d.data_exibicao > hoje);
    const temHoje = b.dias_exibicao?.some((d: any) => d.data_exibicao === hoje);
    return temFuturo && !temHoje;
  }) || [];

  const passados = banners?.filter((b: any) => {
    if (b.status !== "ativo" && b.status !== "expirado" && b.status !== "inativo") return false;
    // Todos os dias são passados
    const todosDiasPassados = b.dias_exibicao?.length > 0 && 
      b.dias_exibicao.every((d: any) => d.data_exibicao < hoje);
    return todosDiasPassados;
  }) || [];

  const recusados = banners?.filter((b: any) => 
    b.status === "inativo" && !passados.includes(b)
  ) || [];

  const renderBannerCard = (banner: any, showResendEmail: boolean = false) => {
    const statusColors: Record<string, string> = {
      aguardando_pagamento: "bg-amber-500/10 text-amber-600 border-amber-200",
      pendente: "bg-blue-500/10 text-blue-600 border-blue-200",
      ativo: "bg-green-500/10 text-green-600 border-green-200",
      inativo: "bg-red-500/10 text-red-600 border-red-200",
      expirado: "bg-gray-500/10 text-gray-600 border-gray-200",
    };

    const statusLabels: Record<string, string> = {
      aguardando_pagamento: "Aguardando Pagamento",
      pendente: "Pendente Aprovação",
      ativo: "Ativo",
      inativo: "Inativo",
      expirado: "Expirado",
    };

    const proxDia = banner.dias_exibicao?.find((d: any) => d.data_exibicao >= hoje);
    const ultimoDia = banner.dias_exibicao?.[banner.dias_exibicao.length - 1];

    return (
      <div key={banner.id} className="bg-card border rounded-xl p-4 space-y-3">
        <div className="flex gap-3">
          {banner.imagem_url ? (
            <img
              src={banner.imagem_url}
              alt={banner.titulo}
              className="w-20 h-14 object-cover rounded-lg"
            />
          ) : (
            <div className="w-20 h-14 bg-muted rounded-lg flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {banner.titulo || "Sem título"}
            </h3>
            <Badge 
              variant="outline" 
              className={`text-xs mt-1 ${statusColors[banner.status] || ""}`}
            >
              {statusLabels[banner.status] || banner.status}
            </Badge>
          </div>
        </div>

        {/* Info de dias */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{banner.dias_comprados || 0} dias</span>
          </div>
          {proxDia && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>
                {proxDia.data_exibicao === hoje 
                  ? "Hoje" 
                  : new Date(proxDia.data_exibicao).toLocaleDateString("pt-BR")}
              </span>
            </div>
          )}
        </div>

        {/* Período de exibição */}
        {banner.dias_exibicao?.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Período: {new Date(banner.dias_exibicao[0].data_exibicao).toLocaleDateString("pt-BR")} 
            {" → "}
            {new Date(ultimoDia.data_exibicao).toLocaleDateString("pt-BR")}
          </p>
        )}

        {/* Valor pago */}
        {banner.pagamento && (
          <p className="text-xs text-muted-foreground">
            Valor: R$ {banner.pagamento.valor?.toFixed(2)}
          </p>
        )}

        {/* Indicador de link expirado e botão de reenviar */}
        {showResendEmail && (
          <div className="space-y-2">
            {banner.pagamento?.expira_em && new Date(banner.pagamento.expira_em) < new Date() && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 p-2 rounded-lg">
                <Clock className="h-4 w-4" />
                <span>Link de pagamento expirado. Clique abaixo para gerar um novo.</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => handleResendEmail(banner.id)}
              disabled={sendingEmail === banner.id}
            >
              {sendingEmail === banner.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {banner.pagamento?.expira_em && new Date(banner.pagamento.expira_em) < new Date()
                ? "Gerar Novo Link de Pagamento"
                : "Reenviar Link de Pagamento"}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderEmptyState = (icon: React.ReactNode, message: string) => (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        {icon}
      </div>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border pt-safe">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/cidade/${slug}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-bold text-lg">Meus Anúncios</h1>
            <p className="text-xs text-muted-foreground">{cidade?.nome}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="aguardando" className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-auto">
              <TabsTrigger value="aguardando" className="flex flex-col gap-1 py-2 px-1 text-xs">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Aguardando</span>
                <Badge variant="secondary" className="text-[10px] px-1">
                  {aguardandoPagamento.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="pendentes" className="flex flex-col gap-1 py-2 px-1 text-xs">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Pendentes</span>
                <Badge variant="secondary" className="text-[10px] px-1">
                  {pendentes.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="ativos" className="flex flex-col gap-1 py-2 px-1 text-xs">
                <CheckCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Ativos</span>
                <Badge variant="secondary" className="text-[10px] px-1">
                  {ativos.length + futuros.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="passados" className="flex flex-col gap-1 py-2 px-1 text-xs">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Passados</span>
                <Badge variant="secondary" className="text-[10px] px-1">
                  {passados.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="recusados" className="flex flex-col gap-1 py-2 px-1 text-xs">
                <Ban className="h-4 w-4" />
                <span className="hidden sm:inline">Recusados</span>
                <Badge variant="secondary" className="text-[10px] px-1">
                  {recusados.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="aguardando" className="mt-4 space-y-3">
              {aguardandoPagamento.length > 0 ? (
                aguardandoPagamento.map((banner: any) => renderBannerCard(banner, true))
              ) : (
                renderEmptyState(
                  <CreditCard className="h-8 w-8 text-muted-foreground" />,
                  "Nenhum anúncio aguardando pagamento"
                )
              )}
            </TabsContent>

            <TabsContent value="pendentes" className="mt-4 space-y-3">
              {pendentes.length > 0 ? (
                pendentes.map((banner: any) => renderBannerCard(banner))
              ) : (
                renderEmptyState(
                  <Clock className="h-8 w-8 text-muted-foreground" />,
                  "Nenhum anúncio pendente de aprovação"
                )
              )}
            </TabsContent>

            <TabsContent value="ativos" className="mt-4 space-y-3">
              {ativos.length > 0 && (
                <>
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Exibindo Hoje
                  </h3>
                  {ativos.map((banner: any) => renderBannerCard(banner))}
                </>
              )}
              {futuros.length > 0 && (
                <>
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mt-6">
                    Agendados
                  </h3>
                  {futuros.map((banner: any) => renderBannerCard(banner))}
                </>
              )}
              {ativos.length === 0 && futuros.length === 0 && (
                renderEmptyState(
                  <CheckCircle className="h-8 w-8 text-muted-foreground" />,
                  "Nenhum anúncio ativo ou agendado"
                )
              )}
            </TabsContent>

            <TabsContent value="passados" className="mt-4 space-y-3">
              {passados.length > 0 ? (
                passados.map((banner: any) => renderBannerCard(banner))
              ) : (
                renderEmptyState(
                  <Calendar className="h-8 w-8 text-muted-foreground" />,
                  "Nenhum anúncio expirado"
                )
              )}
            </TabsContent>

            <TabsContent value="recusados" className="mt-4 space-y-3">
              {recusados.length > 0 ? (
                recusados.map((banner: any) => renderBannerCard(banner))
              ) : (
                renderEmptyState(
                  <Ban className="h-8 w-8 text-muted-foreground" />,
                  "Nenhum anúncio recusado"
                )
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default MeusAnunciosPage;
