import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Heart, MessageCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type PeriodFilter = "today" | "7d" | "30d" | "custom";

type LikeItem = {
  id: string;
  source: "jornal" | "voz_do_povo";
  sourceLabel: string;
  itemTitle: string;
  actor: string;
  actorLabel: string;
  createdAt: string;
};

type CommentItem = {
  id: string;
  source: "jornal" | "voz_do_povo";
  sourceLabel: string;
  itemTitle: string;
  authorName: string;
  comment: string;
  createdAt: string;
};

const toIsoDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const shortFingerprint = (value?: string | null) => {
  const v = (value || "").trim();
  if (!v) return "visitante";
  return v.length > 10 ? `${v.slice(0, 4)}...${v.slice(-4)}` : v;
};

const AdminAtividade = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodFilter>("30d");

  const today = useMemo(() => toIsoDate(new Date()), []);
  const [customStartDate, setCustomStartDate] = useState(today);
  const [customEndDate, setCustomEndDate] = useState(today);

  const selectedCidadeId =
    typeof window !== "undefined" ? window.localStorage.getItem("admin:selectedCidadeId") || "" : "";

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === "today") {
      const d = toIsoDate(now);
      return { startDate: d, endDate: d };
    }
    if (period === "7d") {
      return { startDate: toIsoDate(addDays(now, -6)), endDate: toIsoDate(now) };
    }
    if (period === "30d") {
      return { startDate: toIsoDate(addDays(now, -29)), endDate: toIsoDate(now) };
    }
    return { startDate: customStartDate, endDate: customEndDate };
  }, [period, customStartDate, customEndDate]);

  const { data: cidade } = useQuery({
    queryKey: ["admin-atividade-cidade", selectedCidadeId],
    queryFn: async () => {
      if (!selectedCidadeId) return null;
      const { data, error } = await supabase
        .from("cidade")
        .select("id, nome, slug")
        .eq("id", selectedCidadeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCidadeId,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "admin-atividade",
      selectedCidadeId,
      dateRange.startDate,
      dateRange.endDate,
    ],
    queryFn: async () => {
      if (!selectedCidadeId) {
        return { likes: [] as LikeItem[], comments: [] as CommentItem[] };
      }

      const startIso = `${dateRange.startDate}T00:00:00`;
      const endIso = `${dateRange.endDate}T23:59:59`;

      const [jornalItemsRes, aloItemsRes] = await Promise.all([
        supabase.from("rel_cidade_jornal").select("id, titulo").eq("cidade_id", selectedCidadeId),
        supabase.from("rel_cidade_alo_prefeitura").select("id, titulo").eq("cidade_id", selectedCidadeId),
      ]);

      if (jornalItemsRes.error) throw jornalItemsRes.error;
      if (aloItemsRes.error) throw aloItemsRes.error;

      const jornalItems = jornalItemsRes.data || [];
      const aloItems = aloItemsRes.data || [];
      const jornalIds = jornalItems.map((i) => i.id);
      const aloIds = aloItems.map((i) => i.id);
      const jornalTitleMap = new Map(jornalItems.map((i) => [i.id, i.titulo || "Jornal sem titulo"]));
      const aloTitleMap = new Map(aloItems.map((i) => [i.id, i.titulo || "Post sem titulo"]));

      const [jrRes, arRes, jcRes, acRes] = await Promise.all([
        jornalIds.length
          ? supabase
              .from("rel_cidade_jornal_reacoes")
              .select("id, jornal_id, tipo, user_fingerprint, created_at")
              .in("jornal_id", jornalIds)
              .eq("tipo", "like")
              .gte("created_at", startIso)
              .lte("created_at", endIso)
              .order("created_at", { ascending: false })
              .limit(300)
          : Promise.resolve({ data: [], error: null } as any),
        aloIds.length
          ? supabase
              .from("rel_cidade_alo_prefeitura_reacoes")
              .select("id, alo_prefeitura_id, tipo, user_fingerprint, created_at")
              .in("alo_prefeitura_id", aloIds)
              .eq("tipo", "like")
              .gte("created_at", startIso)
              .lte("created_at", endIso)
              .order("created_at", { ascending: false })
              .limit(300)
          : Promise.resolve({ data: [], error: null } as any),
        jornalIds.length
          ? supabase
              .from("rel_cidade_jornal_comentarios")
              .select("id, jornal_id, user_id, comentario, created_at")
              .in("jornal_id", jornalIds)
              .gte("created_at", startIso)
              .lte("created_at", endIso)
              .order("created_at", { ascending: false })
              .limit(300)
          : Promise.resolve({ data: [], error: null } as any),
        aloIds.length
          ? supabase
              .from("rel_cidade_alo_prefeitura_comentarios")
              .select("id, alo_prefeitura_id, user_id, comentario, created_at")
              .in("alo_prefeitura_id", aloIds)
              .gte("created_at", startIso)
              .lte("created_at", endIso)
              .order("created_at", { ascending: false })
              .limit(300)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (jrRes.error) throw jrRes.error;
      if (arRes.error) throw arRes.error;
      if (jcRes.error) throw jcRes.error;
      if (acRes.error) throw acRes.error;

      const jornalComments = jcRes.data || [];
      const aloComments = acRes.data || [];
      const allUserIds = Array.from(
        new Set(
          [...jornalComments, ...aloComments]
            .map((c: any) => c.user_id)
            .filter((id: string | null | undefined) => !!id),
        ),
      );

      const profilesMap = new Map<string, { nome: string | null; email: string | null }>();
      if (allUserIds.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", allUserIds);
        if (profilesError) throw profilesError;
        (profiles || []).forEach((p) => profilesMap.set(p.id, { nome: p.nome, email: p.email }));
      }

      const likes: LikeItem[] = [
        ...(jrRes.data || []).map((r: any) => ({
          id: `j-${r.id}`,
          source: "jornal" as const,
          sourceLabel: "Jornal",
          itemTitle: jornalTitleMap.get(r.jornal_id) || "Jornal",
          actor: r.user_fingerprint || "-",
          actorLabel: `Visitante (${shortFingerprint(r.user_fingerprint)})`,
          createdAt: r.created_at,
        })),
        ...(arRes.data || []).map((r: any) => ({
          id: `a-${r.id}`,
          source: "voz_do_povo" as const,
          sourceLabel: "Voz do Povo",
          itemTitle: aloTitleMap.get(r.alo_prefeitura_id) || "Voz do Povo",
          actor: r.user_fingerprint || "-",
          actorLabel: `Visitante (${shortFingerprint(r.user_fingerprint)})`,
          createdAt: r.created_at,
        })),
      ]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

      const comments: CommentItem[] = [
        ...jornalComments.map((c: any) => ({
          id: `j-${c.id}`,
          source: "jornal" as const,
          sourceLabel: "Jornal",
          itemTitle: jornalTitleMap.get(c.jornal_id) || "Jornal",
          authorName:
            profilesMap.get(c.user_id)?.nome ||
            profilesMap.get(c.user_id)?.email ||
            `Usuario (${String(c.user_id || "").slice(0, 8)})`,
          comment: c.comentario || "",
          createdAt: c.created_at,
        })),
        ...aloComments.map((c: any) => ({
          id: `a-${c.id}`,
          source: "voz_do_povo" as const,
          sourceLabel: "Voz do Povo",
          itemTitle: aloTitleMap.get(c.alo_prefeitura_id) || "Voz do Povo",
          authorName:
            profilesMap.get(c.user_id)?.nome ||
            profilesMap.get(c.user_id)?.email ||
            `Usuario (${String(c.user_id || "").slice(0, 8)})`,
          comment: c.comentario || "",
          createdAt: c.created_at,
        })),
      ]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

      return { likes, comments };
    },
    enabled: !!selectedCidadeId,
  });

  const kpis = useMemo(() => {
    const likes = data?.likes || [];
    const comments = data?.comments || [];
    const uniqueActors = new Set<string>();
    likes.forEach((l) => uniqueActors.add(`fp:${l.actor}`));
    comments.forEach((c) => uniqueActors.add(`u:${c.authorName}`));

    return {
      likes: likes.length,
      comments: comments.length,
      interactions: likes.length + comments.length,
      activeActors: uniqueActors.size,
    };
  }, [data]);

  if (!selectedCidadeId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Atividade</h1>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-700">Selecione uma cidade no menu lateral para ver a atividade.</p>
          <Button className="mt-4" onClick={() => navigate("/admin/cidades")}>
            Ir para cidades
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Atividade</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cidade: <span className="font-medium text-gray-700">{cidade?.nome || "-"}</span>
        </p>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Periodo</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="custom">Outro periodo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {period === "custom" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Data inicio</label>
                <Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500">Data fim</label>
                <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-gray-500">
            <span className="text-sm font-medium">Curtidas</span>
            <Heart className="h-4 w-4" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">{isLoading ? "..." : kpis.likes}</div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-gray-500">
            <span className="text-sm font-medium">Comentarios</span>
            <MessageCircle className="h-4 w-4" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">{isLoading ? "..." : kpis.comments}</div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-gray-500">
            <span className="text-sm font-medium">Interacoes</span>
            <Activity className="h-4 w-4" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">{isLoading ? "..." : kpis.interactions}</div>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-gray-500">
            <span className="text-sm font-medium">Atores ativos</span>
            <Users className="h-4 w-4" />
          </div>
          <div className="text-2xl font-semibold text-gray-900">{isLoading ? "..." : kpis.activeActors}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Ultimas curtidas</h2>
          {isLoading ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : isError ? (
            <p className="text-sm text-red-600">Erro ao carregar curtidas.</p>
          ) : (data?.likes.length || 0) === 0 ? (
            <p className="text-sm text-gray-500">Sem curtidas no filtro selecionado.</p>
          ) : (
            <div className="space-y-3">
              {data?.likes.slice(0, 20).map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium text-gray-900">{item.itemTitle}</p>
                  <p className="text-xs text-gray-500">
                    {item.sourceLabel} - {item.actorLabel} - {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-gray-900">Ultimos comentarios</h2>
          {isLoading ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : isError ? (
            <p className="text-sm text-red-600">Erro ao carregar comentarios.</p>
          ) : (data?.comments.length || 0) === 0 ? (
            <p className="text-sm text-gray-500">Sem comentarios no filtro selecionado.</p>
          ) : (
            <div className="space-y-3">
              {data?.comments.slice(0, 20).map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium text-gray-900">{item.itemTitle}</p>
                  <p className="text-xs text-gray-500">
                    {item.sourceLabel} - {item.authorName} - {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-1 text-sm text-gray-700">{item.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAtividade;
