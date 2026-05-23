import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import {
  ArrowLeft,
  MessageCircle,
  ChevronDown,
  Clock,
  MapPin,
  Instagram,
  Phone,
  Share2,
  Copy,
  Check,
  ShoppingBag,
  Eye,
  Info,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface HorarioFuncionamento {
  dia: string;
  aberto: boolean;
  abertura: string;
  fechamento: string;
}

interface ProdutoCatalogo {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | string | null;
  foto_url: string | null;
}

const diasOrdem = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"];

const normalizeDia = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]/g, "");

const ServicoEmpresaDetailPage = () => {
  const { slug, categoriaId, empresaId } = useParams<{
    slug: string;
    categoriaId: string;
    empresaId: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as { backTo?: string } | null)?.backTo || `/cidade/${slug}/servicos/${categoriaId}`;
  useSwipeBack({ onBack: () => navigate(backTo) });
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAllHours, setShowAllHours] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>("informacoes");
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoCatalogo | null>(null);

  const { data: empresa, isLoading } = useQuery({
    queryKey: ["servico-empresa", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_servico_empresa")
        .select(`
          *,
          fotos:rel_cidade_servico_empresa_foto(id, url, ordem),
          produtos:rel_cidade_servico_empresa_produto(id, nome, descricao, preco, foto_url, ativo, ordem)
        `)
        .eq("id", empresaId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const handleWhatsApp = () => {
    if (!empresa?.whatsapp) return;
    const message = encodeURIComponent("Ola! Vi seu perfil no app e gostaria de mais informações.");
    window.open(`https://wa.me/55${empresa.whatsapp}?text=${message}`, "_blank");
  };

  const handleInstagram = () => {
    if (!empresa?.instagram) return;
    window.open(`https://instagram.com/${empresa.instagram}`, "_blank");
  };

  const handleShare = async () => {
    if (!empresa) return;

    if (navigator.share) {
      await navigator.share({
        title: empresa.nome,
        text: `Confira ${empresa.nome}`,
        url: window.location.href,
      });
      return;
    }

    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPhone = () => {
    if (!empresa?.whatsapp) return;
    navigator.clipboard.writeText(empresa.whatsapp);
    toast.success("Número copiado!");
  };

  const fotosOrdenadas = empresa?.fotos ? [...empresa.fotos].sort((a, b) => a.ordem - b.ordem) : [];
  const images = empresa?.logomarca_url
    ? [{ id: "logomarca", url: empresa.logomarca_url, ordem: -1 }, ...fotosOrdenadas]
    : fotosOrdenadas;
  const produtos = empresa?.produtos
    ? [...empresa.produtos]
        .filter((produto) => produto.ativo !== false)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
    : [];
  const horarios = (empresa?.horario_funcionamento as HorarioFuncionamento[]) || [];
  const horariosOrdenados = [...horarios].sort(
    (a, b) => diasOrdem.indexOf(normalizeDia(a.dia)) - diasOrdem.indexOf(normalizeDia(b.dia)),
  );

  const getStatusHoje = () => {
    const dias = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
    const hoje = dias[new Date().getDay()];
    const horarioHoje = horarios.find((h) => normalizeDia(h.dia) === hoje);

    if (!horarioHoje || !horarioHoje.aberto) {
      return { aberto: false, texto: "Fechado hoje", horario: null as string | null };
    }

    const agora = new Date();
    const horaAtual = agora.getHours() * 60 + agora.getMinutes();
    const [aberturaH, aberturaM] = horarioHoje.abertura.split(":").map(Number);
    const [fechamentoH, fechamentoM] = horarioHoje.fechamento.split(":").map(Number);
    const abertura = aberturaH * 60 + aberturaM;
    const fechamento = fechamentoH * 60 + fechamentoM;

    if (horaAtual >= abertura && horaAtual < fechamento) {
      return {
        aberto: true,
        texto: "Aberto agora",
        horario: `Fecha às ${horarioHoje.fechamento}`,
      };
    }

    if (horaAtual < abertura) {
      return {
        aberto: false,
        texto: "Fechado",
        horario: `Abre às ${horarioHoje.abertura}`,
      };
    }

    return { aberto: false, texto: "Fechado", horario: null as string | null };
  };

  const statusHoje = getStatusHoje();

  const formatEndereco = () => {
    if (!empresa) return null;
    const parts = [empresa.endereco_rua, empresa.endereco_numero, empresa.endereco_bairro].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const formatWhatsApp = (num: string) => {
    const digits = String(num || "").replace(/\D/g, "");
    if (digits.length < 10) return num || "";
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const formatPreco = (preco: number | string | null) => {
    if (preco == null) return null;
    const value = typeof preco === "number" ? preco : Number(preco);
    if (!Number.isFinite(value)) return null;
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const visualizacoes = Number((empresa as { visualizacoes?: number | null } | null)?.visualizacoes || 0);
  const labelVisualizacao = visualizacoes === 1 ? "visualização" : "visualizações";
  const endereco = formatEndereco();
  const fullImageUrl = images[currentImageIndex]?.url || empresa?.banner_oferta_url || "";
  const tabs = [
    { id: "informacoes", label: "Informações", Icon: Info },
    empresa?.video_url ? { id: "video", label: "Vídeo", Icon: Eye } : null,
    horariosOrdenados.length > 0 ? { id: "horarios", label: "Horários", Icon: Clock } : null,
    endereco ? { id: "localizacao", label: "Localização", Icon: MapPin } : null,
  ].filter(Boolean) as Array<{ id: string; label: string; Icon: typeof Info }>;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-[300px] bg-muted animate-pulse" />
        <div className="p-5 space-y-4">
          <div className="h-8 w-2/3 bg-muted animate-pulse rounded-lg" />
          <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
          <div className="h-12 w-full bg-muted animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center gap-4 p-4 pt-safe">
          <button onClick={() => navigate(backTo)} className="p-2 -m-2 hover:bg-muted rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Empresa não encontrada</p>
            <Button variant="outline" onClick={() => navigate(backTo)}>
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="swipe-back-page" className="min-h-screen overflow-x-hidden bg-background pb-28">
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 pt-safe pointer-events-none">
        <button
          onClick={() => navigate(backTo)}
          className="pointer-events-auto p-2.5 bg-background/85 backdrop-blur-md rounded-full shadow-sm border border-border/60 hover:bg-background transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => fullImageUrl && setShowFullImage(true)}
          className="pointer-events-auto p-2.5 bg-background/85 backdrop-blur-md rounded-full shadow-sm border border-border/60 hover:bg-background transition-colors"
          aria-label="Ver foto inteira"
        >
          <Eye className="h-5 w-5" />
        </button>
      </header>

      <section className="relative bg-muted overflow-hidden" style={{ height: 350 }}>
        {images.length > 0 ? (
          <>
            <img src={images[currentImageIndex].url} alt={empresa.nome} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
            {images.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    aria-label={`Foto ${index + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      index === currentImageIndex ? "w-6 bg-white" : "w-1.5 bg-white/55"
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : empresa.banner_oferta_url ? (
          <>
            <img src={empresa.banner_oferta_url} alt={empresa.nome} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/35" />
          </div>
        )}

        <div className="hidden">
          <div className="flex items-center gap-3">
            {empresa.logomarca_url && (
              <img
                src={empresa.logomarca_url}
                alt=""
                className="w-14 h-14 rounded-2xl object-cover border border-white/35 bg-background shadow-lg"
              />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold leading-tight text-white drop-shadow-sm">{empresa.nome}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-md ${
                    statusHoje.aberto ? "bg-emerald-500/90 text-white" : "bg-white/18 text-white"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${statusHoje.aberto ? "bg-white" : "bg-white/65"}`} />
                  {statusHoje.texto}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
                  <Eye className="h-3.5 w-3.5" />
                  {visualizacoes} {labelVisualizacao}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-7 rounded-t-[28px] bg-background px-5 pt-5">
        <div className="flex items-center gap-4">
          {empresa.logomarca_url && (
            <img
              src={empresa.logomarca_url}
              alt=""
              className="h-[86px] w-[86px] flex-shrink-0 rounded-2xl border border-border bg-[#f6f6f6] object-cover shadow-sm"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight text-foreground">{empresa.nome}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  statusHoje.aberto ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${statusHoje.aberto ? "bg-emerald-500" : "bg-neutral-400"}`} />
                {statusHoje.texto}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                <Eye className="h-3.5 w-3.5" />
                {visualizacoes} {labelVisualizacao}
              </span>
            </div>
          </div>
        </div>
      </section>

      {images.length > 1 && (
        <div className="flex gap-3 px-5 py-4 overflow-x-auto scrollbar-hide bg-background">
          {images.map((img, index) => (
            <button
              key={img.id}
              onClick={() => setCurrentImageIndex(index)}
              className={`flex-shrink-0 h-[72px] w-[72px] rounded-2xl overflow-hidden border bg-[#f6f6f6] transition-all ${
                index === currentImageIndex ? "border-neutral-900 shadow-md" : "border-transparent opacity-80"
              }`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <nav className="z-30 bg-background px-5 pb-4">
        <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 sm:grid-cols-5">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection((current) => (current === id ? null : id))}
                className={`inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-2xl border px-2 text-xs font-semibold shadow-sm transition-colors sm:text-sm ${
                  activeSection === id
                    ? "border-[#1f2937] bg-[#1f2937] text-white"
                    : "border-border bg-card text-foreground hover:border-neutral-300 hover:bg-neutral-100"
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${activeSection === id ? "text-white" : "text-muted-foreground"}`} />
                <span className="min-w-0 truncate">{label}</span>
              </button>
            ))}
        </div>
      </nav>

      <main className="px-5 pb-5 pt-1 space-y-6">
        <section className="hidden">
          {statusHoje.horario && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{statusHoje.texto}</p>
                  <p className="text-sm text-muted-foreground">{statusHoje.horario}</p>
                </div>
              </div>
            </div>
          )}

        </section>

        {false && activeSection === "catalogo" && produtos.length > 0 && (
          <section id="catalogo" className="scroll-mt-20 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Catálogo de produtos</h2>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{produtos.length} itens</span>
            </div>
            <div className="space-y-3">
              {produtos.map((produto) => {
                const precoFormatado = formatPreco(produto.preco);
                return (
                  <article key={produto.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
                    {produto.foto_url ? (
                      <img src={produto.foto_url} alt={produto.nome} className="h-20 w-20 flex-shrink-0 rounded-xl object-cover bg-muted" />
                    ) : (
                      <div className="h-20 w-20 flex-shrink-0 rounded-xl bg-muted flex items-center justify-center">
                        <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold leading-tight text-foreground">{produto.nome}</h3>
                        {precoFormatado && <span className="text-sm font-bold text-foreground whitespace-nowrap">{precoFormatado}</span>}
                      </div>
                      {produto.descricao && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{produto.descricao}</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeSection === "video" && empresa.video_url && (
          <section id="video" className="scroll-mt-20 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vídeo</h2>
            <div className="rounded-2xl overflow-hidden bg-black border border-border">
              <video src={empresa.video_url} controls playsInline preload="metadata" className="w-full" />
            </div>
          </section>
        )}

        {activeSection === "informacoes" && (
        <section id="informacoes" className="scroll-mt-20 space-y-3">
          <div className="hidden">
            <Info className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Informações</h2>
          </div>

          <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
            {empresa.banner_oferta_url && (
              <div className="p-2">
                <div className="overflow-hidden rounded-2xl bg-background">
                  <img src={empresa.banner_oferta_url} alt="Oferta" className="w-full h-auto" />
                </div>
              </div>
            )}

            {empresa.descricao && (
              <div className="px-2 py-3">
                <p className="mb-1 text-sm font-semibold text-[#5b4b82]">Sobre {empresa.nome}</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{empresa.descricao}</p>
              </div>
            )}

            {empresa.whatsapp && (
              <button onClick={handleCopyPhone} className="group flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-neutral-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f6f6f6]">
                  <Phone className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#5b4b82]">Telefone</p>
                  <p className="font-medium text-foreground">{formatWhatsApp(empresa.whatsapp)}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#f6f2fb] px-3 py-2 text-sm font-semibold text-[#5b4b82]">
                  <Copy className="h-4 w-4" />
                  Copiar
                </span>
              </button>
            )}

            {false && endereco && (
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f6f6f6]">
                  <MapPin className="h-4 w-4 text-rose-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Endereço</p>
                  <p className="font-medium text-foreground">
                    {endereco}
                    {empresa.endereco_complemento && ` - ${empresa.endereco_complemento}`}
                  </p>
                  {empresa.endereco_cep && <p className="mt-0.5 text-sm text-muted-foreground">CEP {empresa.endereco_cep}</p>}
                </div>
              </div>
            )}

            {empresa.instagram && (
              <button onClick={handleInstagram} className="flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-neutral-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f6f6f6]">
                  <Instagram className="h-4 w-4 text-pink-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#5b4b82]">Instagram</p>
                  <p className="font-medium text-foreground">@{empresa.instagram}</p>
                </div>
              </button>
            )}

            {produtos.length > 0 && (
              <div>
                <div className="flex items-start gap-3 px-2 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f6f6f6]">
                    <ShoppingBag className="h-4 w-4 text-[#5b4b82]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="[&_h2]:hidden">
                      <p className="text-sm font-semibold text-[#5b4b82]">Catálogo de produtos</p>
                      <p className="text-xs text-muted-foreground">{produtos.length} itens disponíveis</p>
                    <h2 className="text-lg font-bold text-foreground">Catálogo de produtos</h2>
                  </div>
                  <span className="hidden">{produtos.length} itens</span>
                  </div>
                </div>
                <div>
                  {produtos.map((produto) => {
                    const precoFormatado = formatPreco(produto.preco);
                    return (
                      <button
                        key={produto.id}
                        type="button"
                        onClick={() => setProdutoSelecionado(produto as ProdutoCatalogo)}
                        className="flex w-full min-w-0 items-start gap-3 py-3 pl-2 pr-3 text-left transition-colors hover:bg-neutral-50 active:bg-neutral-100 min-[390px]:py-4 min-[390px]:pl-3 min-[390px]:pr-4"
                      >
                        {produto.foto_url ? (
                          <img src={produto.foto_url} alt={produto.nome} className="h-16 w-16 flex-shrink-0 rounded-xl object-cover bg-muted min-[390px]:h-20 min-[390px]:w-20" />
                        ) : (
                          <div className="h-16 w-16 flex-shrink-0 rounded-xl bg-[#f6f6f6] flex items-center justify-center min-[390px]:h-20 min-[390px]:w-20">
                            <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold leading-tight text-foreground">{produto.nome}</h3>
                          {produto.descricao && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{produto.descricao}</p>}
                          {precoFormatado && <p className="mt-2 text-sm font-bold text-[#3b1b67] min-[390px]:hidden">{precoFormatado}</p>}
                        </div>
                        {precoFormatado && <span className="hidden text-sm font-bold text-[#3b1b67] whitespace-nowrap min-[390px]:block">{precoFormatado}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </section>
        )}

        {activeSection === "horarios" && horariosOrdenados.length > 0 && (
          <section id="horarios" className="scroll-mt-20 space-y-3">
            <div className="hidden">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Horários</h2>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => setShowAllHours(!showAllHours)}
                className="hidden"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 text-left">
                  <p className={`text-sm font-semibold ${statusHoje.aberto ? "text-emerald-600" : "text-foreground"}`}>{statusHoje.texto}</p>
                  <p className="text-sm text-muted-foreground">{statusHoje.horario || "Ver todos os horários"}</p>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${showAllHours ? "rotate-180" : ""}`} />
              </button>

              {true && (
                <div className="space-y-1">
                  {horariosOrdenados.map((h) => {
                    const isHoje = diasOrdem.indexOf(normalizeDia(h.dia)) === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
                    return (
                      <div key={h.dia} className={`flex items-center justify-between rounded-xl px-3 py-2 ${isHoje ? "bg-muted/70" : ""}`}>
                        <span className={`text-sm ${isHoje ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {h.dia}
                          {isHoje && <span className="ml-2 text-xs font-normal text-muted-foreground">(hoje)</span>}
                        </span>
                        <span className={`text-sm ${h.aberto ? "text-foreground" : "text-muted-foreground"}`}>
                          {h.aberto ? `${h.abertura} - ${h.fechamento}` : "Fechado"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {activeSection === "localizacao" && endereco && (
          <section id="localizacao" className="scroll-mt-20 space-y-3">
            <div className="hidden">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Localização</h2>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Endereço completo</p>
              <p className="font-medium text-foreground">
                {endereco}
                {empresa.endereco_complemento && ` - ${empresa.endereco_complemento}`}
              </p>
              {empresa.endereco_cep && (
                <p className="text-sm text-muted-foreground">CEP {empresa.endereco_cep}</p>
              )}
            </div>
            <div className="rounded-2xl overflow-hidden border border-border h-48 shadow-sm">
              <iframe
                title="Mapa"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(endereco)}`}
              />
            </div>
          </section>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background p-4 pb-8 shadow-[0_-10px_28px_rgba(15,23,42,0.12)]">
        <button
          onClick={handleWhatsApp}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-full text-sm font-semibold transition-colors"
          style={{
            backgroundColor: "#2f8f5b",
            color: "#ffffff",
            border: "1px solid #287a4f",
            boxShadow: "0 12px 28px rgba(47, 143, 91, 0.24)",
            opacity: 1,
          }}
        >
          <MessageCircle className="h-4 w-4" />
          Chamar no WhatsApp
        </button>
      </div>

      <Dialog open={!!produtoSelecionado} onOpenChange={(open) => !open && setProdutoSelecionado(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto p-0 sm:max-w-md">
          {produtoSelecionado && (
            <div>
              <div className="bg-muted/40">
                {produtoSelecionado.foto_url ? (
                  <img
                    src={produtoSelecionado.foto_url}
                    alt={produtoSelecionado.nome}
                    className="max-h-[45vh] w-full object-contain"
                  />
                ) : (
                  <div className="flex h-52 w-full items-center justify-center">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="space-y-4 p-5">
                <DialogHeader className="pr-8 text-left">
                  <DialogTitle className="text-lg leading-snug text-[#2b124c]">
                    {produtoSelecionado.nome}
                  </DialogTitle>
                  {formatPreco(produtoSelecionado.preco) && (
                    <DialogDescription className="text-base font-bold text-[#3b1b67]">
                      {formatPreco(produtoSelecionado.preco)}
                    </DialogDescription>
                  )}
                </DialogHeader>

                {produtoSelecionado.descricao && (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {produtoSelecionado.descricao}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showFullImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Foto inteira"
          onClick={() => setShowFullImage(false)}
        >
          <button
            type="button"
            onClick={() => setShowFullImage(false)}
            className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25"
            aria-label="Fechar foto"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="flex h-full w-full items-center justify-center p-2 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            {fullImageUrl && (
              <img
                src={fullImageUrl}
                alt={empresa.nome}
                className="max-h-full max-w-full object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicoEmpresaDetailPage;
