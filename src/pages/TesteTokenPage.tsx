import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell, Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TesteTokenPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const { user } = useAuth();

  const { data: cidade } = useQuery({
    queryKey: ["cidade-token-teste", slug],
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

  const { token, permissionStatus } = usePushNotifications({
    cidadeId: cidade?.id || null,
    userId: user?.id || null,
    cidadeSlug: slug || null,
    pagina: "teste_token",
  });

  const permissionLabel = useMemo(() => {
    if (permissionStatus === "granted") return "granted";
    if (permissionStatus === "denied") return "denied";
    return "prompt";
  }, [permissionStatus]);

  const copyToken = async () => {
    if (!token) {
      toast.error("Token ainda nao disponivel.");
      return;
    }

    try {
      await navigator.clipboard.writeText(token);
      toast.success("Token copiado.");
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel copiar o token.");
    }
  };

  const sendTestPushToThisToken = async () => {
    if (!token) {
      toast.error("Token ainda nao disponivel.");
      return;
    }

    try {
      setIsSending(true);
      toast.loading("Enviando push de teste...");

      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          deviceToken: token,
          title: "Teste de push",
          body: `Push de teste para ${cidade?.nome || "cidade"}`,
          data: {
            source: "teste_token",
            slug: slug || "",
          },
        },
      });

      toast.dismiss();

      if (error) {
        toast.error(`Erro ao enviar push: ${error.message}`);
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || data?.message || "Falha ao enviar push.");
        return;
      }

      toast.success(`Push enviado. Sucesso: ${data.successCount ?? 0}`);
    } catch (error) {
      toast.dismiss();
      console.error(error);
      toast.error("Erro inesperado ao enviar push.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 p-4 pt-safe border-b border-border bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">teste_token</h1>
      </header>

      <div className="p-4 space-y-4">
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Status</p>
          </div>
          <p className="text-sm text-muted-foreground">Cidade: {cidade?.nome || "carregando..."}</p>
          <p className="text-sm text-muted-foreground">Permissao: {permissionLabel}</p>
          <p className="text-sm text-muted-foreground">
            Token: {token ? "disponivel" : "aguardando registro no dispositivo"}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">Token atual</p>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs break-all font-mono text-muted-foreground">
              {token || "Sem token no momento. Abra no app nativo e permita notificacoes."}
            </p>
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={copyToken}>
            <Copy className="h-4 w-4" />
            Copiar token
          </Button>
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={!token || isSending}
          onClick={sendTestPushToThisToken}
        >
          <Send className="h-4 w-4" />
          {isSending ? "Enviando..." : "Enviar push de teste para este token"}
        </Button>
      </div>
    </div>
  );
};

export default TesteTokenPage;
