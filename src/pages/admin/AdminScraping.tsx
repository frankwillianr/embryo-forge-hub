import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Rss,
  ExternalLink,
  CheckCircle2,
  Clock,
  Globe,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FonteDetectada {
  nome: string;
  url: string | null;
  total: number;
  ultima: string;
  cidade: string;
}

interface ScrapingResult {
  data_processada: string;
  modo: string;
  inseridas: number;
  antigas_rejeitadas: number;
  duplicadas_url: number;
  duplicadas_titulo: number;
  sem_imagens_validas: number;
  urls_invalidas: number;
  sem_conteudo: number;
  erros: string[];
}

const AdminScraping = () => {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ScrapingResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const { data: artigosScrapados, isLoading } = useQuery({
    queryKey: ["admin-scraping-geral"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rel_cidade_jornal")
        .select("id, titulo, fonte, id_externo, created_at, data_noticia, cidade_id, cidade(nome)")
        .not("id_externo", "is", null)
        .order("data_noticia", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const fontes: FonteDetectada[] = artigosScrapados
    ? (Object.values(
        artigosScrapados.reduce(
          (acc: Record<string, FonteDetectada>, item: any) => {
            if (!item.fonte) return acc;
            if (!acc[item.fonte]) {
              let origin: string | null = null;
              try {
                origin = new URL(item.id_externo).origin;
              } catch {}
              acc[item.fonte] = {
                nome: item.fonte,
                url: origin,
                total: 0,
                ultima: item.data_noticia || item.created_at,
                cidade: item.cidade?.nome ?? "",
              };
            }
            acc[item.fonte].total++;
            const dataComparacao = item.data_noticia || item.created_at;
            if (new Date(dataComparacao) > new Date(acc[item.fonte].ultima)) {
              acc[item.fonte].ultima = dataComparacao;
            }
            return acc;
          },
          {}
        )
      ) as FonteDetectada[])
    : [];

  async function handleBuscarAgora() {
    setIsRunning(true);
    setLastResult(null);
    setRunError(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "coletar-noticias-gv",
        { body: { test_mode: false } },
      );

      if (error) throw error;

      setLastResult(data as ScrapingResult);
      // Refresh the articles list
      queryClient.invalidateQueries({ queryKey: ["admin-scraping-geral"] });
    } catch (err: any) {
      setRunError(err?.message ?? "Erro desconhecido ao executar scraping");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            Scraping de Notícias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão geral de todas as fontes e artigos coletados automaticamente
          </p>
        </div>

        <Button
          onClick={handleBuscarAgora}
          disabled={isRunning}
          className="shrink-0 gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRunning ? "animate-spin" : ""}`} />
          {isRunning ? "Buscando..." : "Buscar Notícias Agora"}
        </Button>
      </div>

      {/* Resultado da última execução */}
      {runError && (
        <div className="flex items-start gap-3 p-4 border border-red-200 bg-red-50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm text-red-700">Erro ao executar scraping</p>
            <p className="text-sm text-red-600 mt-0.5">{runError}</p>
          </div>
        </div>
      )}

      {lastResult && (
        <div className="border border-green-200 bg-green-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="font-medium text-sm text-green-700">
              Scraping concluído — {lastResult.data_processada} · Modo: {lastResult.modo}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 text-center border border-green-100">
              <p className="text-2xl font-bold text-green-600">{lastResult.inseridas}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Inseridas</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center border border-green-100">
              <p className="text-2xl font-bold text-gray-500">{lastResult.duplicadas_url + lastResult.duplicadas_titulo}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Duplicadas</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center border border-green-100">
              <p className="text-2xl font-bold text-gray-500">{lastResult.antigas_rejeitadas}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Antigas</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center border border-green-100">
              <p className="text-2xl font-bold text-gray-500">{lastResult.urls_invalidas + lastResult.sem_conteudo + lastResult.sem_imagens_validas}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Rejeitadas</p>
            </div>
          </div>

          {lastResult.erros.length > 0 && (
            <div className="text-xs text-red-600 space-y-0.5">
              <p className="font-medium">Erros ({lastResult.erros.length}):</p>
              {lastResult.erros.slice(0, 5).map((e, i) => (
                <p key={i} className="font-mono truncate">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fontes ativas */}
      <div className="space-y-3">
        <h2 className="font-medium text-gray-700 flex items-center gap-2">
          <Rss className="h-4 w-4" />
          Fontes ativas
        </h2>

        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : fontes.length === 0 ? (
          <div className="text-center py-8 border rounded-lg bg-muted/30">
            <Globe className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma fonte detectada ainda
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fontes.map((fonte) => (
              <div
                key={fonte.nome}
                className="flex items-start gap-3 p-4 border rounded-lg bg-white shadow-sm"
              >
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{fonte.nome}</p>
                  {fonte.url && (
                    <a
                      href={fonte.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate"
                    >
                      {fonte.url}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{fonte.total} artigos</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(fonte.ultima).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Artigos recentes */}
      <div className="space-y-3">
        <h2 className="font-medium text-gray-700">
          Artigos coletados recentemente
          {artigosScrapados && (
            <span className="ml-2 text-muted-foreground font-normal text-sm">
              ({artigosScrapados.length})
            </span>
          )}
        </h2>

        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Carregando...
          </div>
        ) : !artigosScrapados || artigosScrapados.length === 0 ? (
          <div className="text-center py-8 border rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Nenhum artigo coletado ainda
            </p>
          </div>
        ) : (
          <div className="border rounded-lg bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Link original</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artigosScrapados.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      {item.titulo}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.fonte}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.cidade?.nome ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      {item.id_externo && (
                        <a
                          href={item.id_externo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline flex items-center gap-1 text-sm"
                        >
                          Ver
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminScraping;
