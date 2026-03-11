import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AdminCidadePushNotificationsProps {
  cidadeId: string;
}

type PushPlatformFilter = "todos" | "ios" | "android";

const parseFunctionError = async (error: any): Promise<string> => {
  try {
    const status = error?.context?.status;
    let payload: any = null;

    if (error?.context && typeof error.context.clone === "function") {
      const cloned = error.context.clone();
      const text = await cloned.text();
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { raw: text };
        }
      }
    }

    const details =
      payload?.error ||
      payload?.message ||
      payload?.msg ||
      payload?.raw ||
      error?.message ||
      "Erro desconhecido";

    return status ? `HTTP ${status}: ${details}` : details;
  } catch {
    return error?.message || "Erro desconhecido";
  }
};

const AdminCidadePushNotifications = ({ cidadeId }: AdminCidadePushNotificationsProps) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<PushPlatformFilter>("todos");

  const { data: pushCountData, isLoading: loadingTokens } = useQuery({
    queryKey: ["admin-cidade-push-count", cidadeId, platformFilter],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          cidadeId,
          platform: platformFilter === "todos" ? undefined : platformFilter,
          dryRun: true,
        },
      });
      if (error) {
        const detailed = await parseFunctionError(error);
        console.error("Erro detalhado no dryRun de push:", detailed, error);
        throw new Error(detailed);
      }
      console.log("DryRun push response:", data);
      return data;
    },
  });

  const tokensCount = useMemo(() => {
    return pushCountData?.wouldSend ?? 0;
  }, [pushCountData]);

  const handleSendPush = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Preencha título e mensagem.");
      return;
    }

    try {
      setSending(true);
      toast.loading("Enviando push...");

      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          cidadeId,
          platform: platformFilter === "todos" ? undefined : platformFilter,
          title: title.trim(),
          body: body.trim(),
        },
      });
      console.log("Push send response:", data);

      toast.dismiss();

      if (error) {
        const detailed = await parseFunctionError(error);
        console.error("Erro detalhado ao enviar push:", detailed, error);
        toast.error(`Erro ao enviar push: ${detailed}`);
        return;
      }

      if (!data?.success) {
        const detailed =
          data?.error ||
          data?.message ||
          (Array.isArray(data?.failureReasons) && data.failureReasons.length > 0
            ? data.failureReasons.join(" | ")
            : null) ||
          "Falha ao enviar push.";
        console.error("Falha de push (payload):", data);
        toast.error(`Falha ao enviar push: ${detailed}`);
        return;
      }

      if ((data?.failureCount ?? 0) > 0) {
        const reasonPreview = Array.isArray(data?.failureReasons) ? data.failureReasons.slice(0, 2).join(" | ") : "";
        toast.warning(
          `Push parcial. Sucesso: ${data.successCount ?? 0} | Falhas: ${data.failureCount ?? 0}${reasonPreview ? ` | ${reasonPreview}` : ""}`,
        );
      } else {
        toast.success(`Push enviado. Sucesso: ${data.successCount ?? 0} | Falhas: ${data.failureCount ?? 0}`);
      }
    } catch (err) {
      toast.dismiss();
      toast.error("Erro inesperado ao enviar push.");
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-gray-700" />
        <h2 className="text-lg font-semibold text-gray-900">Push Notificação</h2>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPlatformFilter("todos")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              platformFilter === "todos" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setPlatformFilter("ios")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              platformFilter === "ios" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            iOS
          </button>
          <button
            type="button"
            onClick={() => setPlatformFilter("android")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              platformFilter === "android" ? "bg-black text-white" : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            Android
          </button>
        </div>
        <p className="text-sm text-gray-600">
          Dispositivos cadastrados ({platformFilter}):
          <span className="ml-2 font-semibold text-gray-900">
            {loadingTokens ? "..." : tokensCount}
          </span>
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Título</label>
          <Input
            placeholder="Ex.: Comunicado importante"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Mensagem</label>
          <Textarea
            placeholder="Digite a mensagem da notificação..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={500}
          />
        </div>

        <Button
          onClick={handleSendPush}
          disabled={sending}
          className="bg-black hover:bg-black/90 text-white"
        >
          <Send className="h-4 w-4 mr-2" />
          {sending ? "Enviando..." : "Enviar Push"}
        </Button>
      </div>
    </div>
  );
};

export default AdminCidadePushNotifications;
