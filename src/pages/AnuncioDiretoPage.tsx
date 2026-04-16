import { useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Eye,
  MapPin,
  Megaphone,
  MessageCircle,
  QrCode,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

const WHATSAPP_NUMBER = "5533999999999";
const WHATSAPP_MESSAGE =
  "Ola! Vi a pagina do app e quero colocar minha loja na plataforma de Governador Valadares.";
const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

const MONTSERRAT = { fontFamily: "Montserrat, Poppins, sans-serif" } as const;

const stats = [
  { value: "3.000+", label: "acessos por dia" },
  { value: "100%", label: "publico de Valadares" },
  { value: "365", label: "dias de vitrine" },
];

const benefits = [
  {
    icon: Store,
    title: "Cadastro completo da loja",
    desc: "Fotos, endereco, horario, telefone e link direto para o WhatsApp.",
    tone: "bg-violet-100 text-violet-700",
  },
  {
    icon: Megaphone,
    title: "1 banner no mural de ofertas",
    desc: "Sua campanha em destaque na tela que o cliente ve toda semana.",
    tone: "bg-rose-100 text-rose-700",
  },
  {
    icon: Search,
    title: "Apareca na busca de servicos",
    desc: "Quando o morador procurar seu ramo, sua loja aparece listada.",
    tone: "bg-blue-100 text-blue-700",
  },
  {
    icon: BadgeCheck,
    title: "Selo de loja verificada",
    desc: "Passa confianca ja na primeira impressao de quem visita seu card.",
    tone: "bg-emerald-100 text-emerald-700",
  },
];

const steps = [
  {
    n: "01",
    icon: MessageCircle,
    title: "Voce fecha o plano",
    desc: "Envia os dados da loja pelo WhatsApp e escolhe PIX ou cartao.",
  },
  {
    n: "02",
    icon: Sparkles,
    title: "A gente publica tudo",
    desc: "Cadastramos a loja, as fotos e o primeiro banner em ate 48h.",
  },
  {
    n: "03",
    icon: Eye,
    title: "Sua loja comeca a aparecer",
    desc: "Em minutos, voce ja e visto por quem abre o app em Valadares.",
  },
];

const faqs = [
  {
    q: "Quanto tempo dura o plano?",
    a: "12 meses corridos a partir da publicacao da sua loja. Em um unico pagamento de R$ 297, sem mensalidade.",
  },
  {
    q: "Preciso produzir o banner?",
    a: "Nao. Voce manda um logo e algumas fotos, nos montamos a arte padrao. Se preferir uma arte sua, tambem aceitamos.",
  },
  {
    q: "E se eu quiser trocar a oferta do banner depois?",
    a: "Pode trocar. O plano inclui 1 banner ativo por vez, e voce pode pedir atualizacao da imagem quando lancar uma nova campanha.",
  },
  {
    q: "Como recebo os contatos dos clientes?",
    a: "Direto no WhatsApp ou telefone que voce cadastrar. O app conecta o cliente a voce, sem intermediar a conversa.",
  },
  {
    q: "Meu ramo pode entrar?",
    a: "Comercio, prestadores de servico, restaurantes, oficinas, clinicas, escritorios. Se atende o morador de Valadares, cabe aqui.",
  },
];

const AnuncioDiretoPage = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const perDay = (297 / 365).toFixed(2).replace(".", ",");

  return (
    <main className="min-h-screen bg-slate-50 pb-28">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-gradient-to-br from-orange-500 via-amber-500 to-rose-500"
          aria-hidden
        />
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,.5), transparent 40%), radial-gradient(circle at 80% 60%, rgba(255,255,255,.35), transparent 45%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-5xl px-5 pb-12 pt-10 text-white sm:px-8 sm:pb-16 sm:pt-14">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90">
            <MapPin className="h-3.5 w-3.5" />
            Governador Valadares | MG
          </div>

          <h1
            className="mt-4 text-3xl font-black leading-[1.1] sm:text-5xl sm:leading-tight"
            style={MONTSERRAT}
          >
            Coloque sua loja no app que os valadarenses ja abrem todo dia.
          </h1>

          <p className="mt-4 max-w-2xl text-sm text-white/90 sm:text-base">
            Um unico pagamento, 1 ano inteiro de visibilidade local. Sem mensalidade,
            sem taxa por clique, sem letras miudas.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-orange-600 shadow-lg shadow-orange-900/20 transition hover:scale-[1.02] hover:shadow-xl sm:text-base"
            >
              <MessageCircle className="h-5 w-5" />
              Quero colocar minha loja
            </a>
            <a
              href="#planos"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 sm:text-base"
            >
              Ver o que esta incluso
            </a>
          </div>

          {/* STAT STRIP */}
          <div className="mt-10 grid grid-cols-3 gap-2 rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur sm:gap-4 sm:p-5">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p
                  className="text-xl font-black leading-none sm:text-3xl"
                  style={MONTSERRAT}
                >
                  {s.value}
                </p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-white/80 sm:text-xs">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROVA SOCIAL / POR QUE */}
      <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Movimento real</h3>
            <p className="mt-1 text-sm text-slate-600">
              3 mil acessos por dia. Nao e projecao, e o numero que o app ja entrega.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Publico certo</h3>
            <p className="mt-1 text-sm text-slate-600">
              Um app feito so para Valadares. Quem ve, mora aqui e pode virar cliente.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Custo previsivel</h3>
            <p className="mt-1 text-sm text-slate-600">
              Um valor fechado no ano. Sem surpresa, sem reajuste por clique ou impressao.
            </p>
          </article>
        </div>
      </section>

      {/* BENEFITS */}
      <section id="planos" className="mx-auto w-full max-w-5xl px-5 pb-10 sm:px-8 sm:pb-14">
        <div className="mb-6 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
            o que esta incluso
          </p>
          <h2
            className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl"
            style={MONTSERRAT}
          >
            Tudo que sua loja precisa para aparecer.
          </h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Um pacote simples, pensado para pequeno e medio comercio local.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {benefits.map(({ icon: Icon, title, desc, tone }) => (
            <article
              key={title}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div
                className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-10 sm:px-8 sm:pb-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
              como funciona
            </p>
            <h2
              className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl"
              style={MONTSERRAT}
            >
              Do sim ao ar em ate 48 horas.
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {steps.map(({ n, icon: Icon, title, desc }) => (
              <div
                key={n}
                className="relative rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <span
                  className="absolute right-4 top-4 text-2xl font-black text-slate-200"
                  style={MONTSERRAT}
                >
                  {n}
                </span>
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-10 sm:px-8 sm:pb-14">
        <div className="overflow-hidden rounded-3xl border border-slate-900 bg-slate-900 text-white shadow-xl">
          <div className="grid gap-0 sm:grid-cols-[1.2fr_1fr]">
            <div className="p-6 sm:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">
                plano anual
              </p>
              <h2
                className="mt-2 text-2xl font-black sm:text-3xl"
                style={MONTSERRAT}
              >
                Um investimento que cabe no orcamento.
              </h2>
              <p className="mt-3 text-sm text-white/80 sm:text-base">
                Sua loja ativa por 365 dias, com banner, busca e cadastro completo.
                Voce paga uma vez e pronto.
              </p>

              <ul className="mt-5 space-y-2 text-sm text-white/90">
                {[
                  "1 banner rotativo no mural de ofertas",
                  "Listagem na busca por categoria",
                  "Cadastro completo com fotos e contato",
                  "Selo de loja verificada",
                  "Suporte por WhatsApp",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-slate-900 sm:p-10">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-900/70">
                pagamento unico
              </p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-base font-bold">R$</span>
                <span
                  className="text-5xl font-black leading-none sm:text-6xl"
                  style={MONTSERRAT}
                >
                  297
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900/80">
                por 1 ano inteiro
              </p>

              <div className="mt-4 rounded-xl bg-white/40 p-3 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-900/70">
                  Equivalente a
                </p>
                <p
                  className="text-xl font-black text-slate-900 sm:text-2xl"
                  style={MONTSERRAT}
                >
                  R$ {perDay}/dia
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900 shadow-sm">
                  <QrCode className="h-3.5 w-3.5" />
                  PIX
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900 shadow-sm">
                  <CreditCard className="h-3.5 w-3.5" />
                  Cartao
                </span>
              </div>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <MessageCircle className="h-4 w-4" />
                Falar com a equipe
              </a>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Pagamento seguro
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Smartphone className="h-4 w-4 text-blue-600" />
            Sua loja no celular de quem compra aqui
          </span>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-5 pb-16 sm:px-8">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
            duvidas frequentes
          </p>
          <h2
            className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl"
            style={MONTSERRAT}
          >
            Antes de fechar, aqui vai tudo que lojista costuma perguntar.
          </h2>
        </div>

        <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {faqs.map((f, i) => {
            const open = openFaq === i;
            return (
              <div key={f.q}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <span className="text-sm font-semibold text-slate-900 sm:text-base">
                    {f.q}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
                {open && (
                  <div className="px-5 pb-4 text-sm text-slate-600">{f.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* STICKY CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,.08)] backdrop-blur sm:p-4">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-wide text-orange-600 sm:text-sm">
              R$ 297 por 1 ano
            </p>
            <p className="truncate text-[11px] text-slate-600 sm:text-xs">
              Equivale a R$ {perDay} por dia de vitrine no app.
            </p>
          </div>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-700 sm:px-5 sm:py-3"
          >
            <MessageCircle className="h-4 w-4" />
            Chamar no WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
};

export default AnuncioDiretoPage;
