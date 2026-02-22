import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Flame, CheckCircle, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function getTodayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function diaAnterior(dataStr: string): string {
  const [y, m, d] = dataStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function diasConsecutivos(datas: string[]): number {
  if (datas.length === 0) return 0;
  const sorted = [...datas].sort((a, b) => b.localeCompare(a));
  const today = getTodayLocal();
  if (sorted[0] !== today) return 0;
  let count = 1;
  let prev = today;
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i];
    const esperado = diaAnterior(prev);
    if (d === esperado) {
      count++;
      prev = d;
    } else break;
  }
  return count;
}

interface CheckinSectionProps {
  cidadeSlug?: string;
}

const CheckinSection = ({ cidadeSlug }: CheckinSectionProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cidade } = useQuery({
    queryKey: ["cidade-id-checkin", cidadeSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cidade")
        .select("id")
        .eq("slug", cidadeSlug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!cidadeSlug,
  });

  const { data: checkins = [] } = useQuery({
    queryKey: ["checkins", user?.id, cidade?.id],
    queryFn: async () => {
      if (!user?.id || !cidade?.id) return [];
      const { data, error } = await supabase
        .from("checkin")
        .select("data")
        .eq("user_id", user.id)
        .eq("cidade_id", cidade.id)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data || []).map((r) => r.data as string);
    },
    enabled: !!user?.id && !!cidade?.id,
  });

  const fazerCheckin = useMutation({
    mutationFn: async () => {
      if (!user?.id || !cidade?.id) throw new Error("Faça login para fazer check-in.");
      const hoje = getTodayLocal();
      const { error } = await supabase.from("checkin").insert({
        user_id: user.id,
        cidade_id: cidade.id,
        data: hoje,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
      queryClient.invalidateQueries({ queryKey: ["cupons", cidade?.id] });
      toast({
        title: "Check-in feito!",
        description: "Continue acessando para manter sua sequência e desbloquear cupons.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Erro no check-in",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const hoje = getTodayLocal();
  const jaFezHoje = checkins.includes(hoje);
  const consecutivos = diasConsecutivos(checkins);

  return (
    <section className="px-4 py-2">
      <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/15 overflow-hidden">
        <div className="px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Flame className="h-3.5 w-3.5 text-emerald-600/90" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-foreground">Check-in diário</h2>
              <p className="text-[10px] text-muted-foreground">7 dias seguidos → cupom</p>
            </div>
          </div>

          {user ? (
            <>
              <div className="flex items-center gap-2 ml-auto shrink-0">
                <span className="text-sm font-semibold text-emerald-700/90 dark:text-emerald-400/90 tabular-nums">
                  {consecutivos}
                </span>
                <span className="text-[10px] text-muted-foreground">dias</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <div
                      key={d}
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        d <= consecutivos ? "bg-emerald-500/80" : "bg-muted/60"
                      }`}
                      title={d <= consecutivos ? `Dia ${d}` : `Faltam ${7 - consecutivos} para cupom`}
                    />
                  ))}
                </div>
                {jaFezHoje ? (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-3 w-3" />
                    Hoje
                  </span>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => fazerCheckin.mutate()}
                    disabled={fazerCheckin.isPending}
                    className="h-7 text-xs bg-emerald-600/90 hover:bg-emerald-600 text-white shrink-0 px-2"
                  >
                    {fazerCheckin.isPending ? "..." : (
                      <>
                        <CalendarCheck className="h-3 w-3 mr-1" />
                        Check-in
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Button
              size="sm"
              disabled={!cidadeSlug}
              onClick={() => {
                if (cidadeSlug) navigate(`/cidade/${cidadeSlug}/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
              }}
              className="h-7 text-xs bg-emerald-600/90 hover:bg-emerald-600 text-white shrink-0 px-2 ml-auto"
            >
              <CalendarCheck className="h-3 w-3 mr-1" />
              Check-in
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};

export default CheckinSection;
