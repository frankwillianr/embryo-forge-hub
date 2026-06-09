import { useMemo, useState } from "react";
import { Copy, ExternalLink, Loader2, Radio, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type LiveResponse = {
  provider: string;
  liveStreamId: string | null;
  title: string;
  broadcasting: boolean;
  streamKey: string;
  servers: {
    rtmp: string;
    rtmps: string;
    srt: string;
  };
  urls: Record<string, string>;
  raw: {
    assets?: Record<string, string>;
    playerId?: string;
    iframe?: string;
    [key: string]: unknown;
  };
};

const getLiveUrl = (live: LiveResponse | null) => {
  if (!live) return "";
  const candidates = [
    live.urls?.player,
    live.urls?.iframe,
    live.urls?.hls,
    live.raw?.assets?.player,
    live.raw?.assets?.iframe,
    live.raw?.assets?.hls,
  ];
  return candidates.find((value) => typeof value === "string" && value.trim()) || "";
};

const maskStreamKey = (value: string) => {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const AdminAbrirLive = () => {
  const [title, setTitle] = useState(() => `Live ${new Date().toLocaleDateString("pt-BR")}`);
  const [record, setRecord] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [live, setLive] = useState<LiveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const liveUrl = useMemo(() => getLiveUrl(live), [live]);

  const copyToClipboard = async (value?: string | null) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  const handleCreateLive = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke("abrir-live", {
        body: { title, record },
      });

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      setLive(data as LiveResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel criar a live.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Abrir live</h1>
          <p className="mt-1 text-sm text-gray-500">
            Crie uma live na api.video e use a chave gerada no OBS ou app de transmissao.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          <Radio className="h-4 w-4" />
          api.video
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,440px)_1fr]">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Video className="h-5 w-5 text-gray-700" />
            <h2 className="text-base font-semibold text-gray-900">Nova transmissao</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Titulo da live</label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>

            <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3">
              <span>
                <span className="block text-sm font-medium text-gray-800">Gravar live</span>
                <span className="block text-xs text-gray-500">Salva uma copia depois que a live terminar.</span>
              </span>
              <Switch checked={record} onCheckedChange={setRecord} />
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="button" onClick={handleCreateLive} disabled={isCreating} className="w-full gap-2">
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
              Criar live
            </Button>
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Dados da transmissao</h2>
          <p className="mt-1 text-sm text-gray-500">
            Use RTMPS no OBS. A chave de transmissao fica visivel apenas para admins.
          </p>

          {!live ? (
            <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              Nenhuma live criada nesta sessao.
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <InfoRow label="Servidor RTMPS" value={live.servers.rtmps} onCopy={copyToClipboard} />
              <InfoRow label="Servidor RTMP" value={live.servers.rtmp} onCopy={copyToClipboard} />
              <InfoRow label="SRT" value={live.servers.srt} onCopy={copyToClipboard} />
              <InfoRow label="Stream key" value={live.streamKey} displayValue={maskStreamKey(live.streamKey)} onCopy={copyToClipboard} />
              <InfoRow label="ID da live" value={live.liveStreamId || "-"} onCopy={copyToClipboard} />
              <InfoRow label="Player" value={liveUrl || "-"} onCopy={copyToClipboard} />

              {liveUrl && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" variant="outline" className="gap-2" onClick={() => window.open(liveUrl, "_blank")}>
                    <ExternalLink className="h-4 w-4" />
                    Abrir player
                  </Button>
                  <Button type="button" variant="outline" className="gap-2" onClick={() => copyToClipboard(liveUrl)}>
                    <Copy className="h-4 w-4" />
                    Copiar link
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const InfoRow = ({
  label,
  value,
  displayValue,
  onCopy,
}: {
  label: string;
  value: string;
  displayValue?: string;
  onCopy: (value: string) => void;
}) => (
  <div className="rounded-lg border border-gray-200 p-3">
    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
    <div className="mt-1 flex items-center gap-2">
      <code className="min-w-0 flex-1 break-all rounded bg-gray-50 px-2 py-1 text-sm text-gray-800">
        {displayValue || value}
      </code>
      {value && value !== "-" && (
        <Button type="button" variant="ghost" size="icon" onClick={() => onCopy(value)} title="Copiar">
          <Copy className="h-4 w-4" />
        </Button>
      )}
    </div>
  </div>
);

export default AdminAbrirLive;
