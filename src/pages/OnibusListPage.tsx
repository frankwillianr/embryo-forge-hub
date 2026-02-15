import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Bus, Search, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LinhaOnibus {
  numero_linha: string;
  url: string;
  horarios: string[];
  itinerario: string;
  descricao: string;
}

type DiaType = "semana" | "sabado" | "domingo";

function parseHorarios(horarios: string[], dia: DiaType) {
  // horarios[0] = headers dos dias (ex: "SEGUNDA A SEXTA | SÁBADO | DOMINGO E FERIADO")
  // horarios[1] = destinos (ex: "BAIRRO | CENTRO | BAIRRO | CENTRO | ...")
  // horarios[2] = endereços de saída
  // horarios[3+] = horários separados por |

  if (!horarios || horarios.length < 4) return { destinos: [], saidas: [], rows: [], observacoes: [] };

  const destinos = horarios[1]?.split("|").map(s => s.trim()) || [];
  const saidas = horarios[2]?.split("|").map(s => s.trim()) || [];

  // Columns per day: 2 (ida e volta)
  const colStart = dia === "semana" ? 0 : dia === "sabado" ? 2 : 4;

  const destinosPair = [destinos[colStart] || "", destinos[colStart + 1] || ""];
  const saidasPair = [saidas[colStart] || "", saidas[colStart + 1] || ""];

  const rows: string[][] = [];
  const observacoes: string[] = [];
  let inObs = false;

  for (let i = 3; i < horarios.length; i++) {
    const line = horarios[i];
    if (line === "Observações" || line.startsWith("ATUALIZADO EM")) {
      inObs = true;
    }
    if (inObs) {
      if (line !== "Observações" && line.trim() !== "*" && line.trim() !== "") {
        observacoes.push(line);
      }
      continue;
    }

    const parts = line.split("|").map(s => s.trim());
    const ida = parts[colStart] || "";
    const volta = parts[colStart + 1] || "";
    if (ida || volta) {
      rows.push([ida, volta]);
    }
  }

  // Filter empty rows
  const filtered = rows.filter(r => r[0] || r[1]);

  return { destinos: destinosPair, saidas: saidasPair, rows: filtered, observacoes };
}

const OnibusListPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [linhas, setLinhas] = useState<LinhaOnibus[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diaAtivo, setDiaAtivo] = useState<DiaType>(() => {
    const day = new Date().getDay();
    if (day === 0) return "domingo";
    if (day === 6) return "sabado";
    return "semana";
  });

  useEffect(() => {
    fetch("/data/horarios_onibus.json")
      .then(r => r.json())
      .then(setLinhas)
      .catch(console.error);
  }, []);

  const filtered = useMemo(() => 
    linhas.filter(l => 
      l.numero_linha.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [linhas, searchTerm]
  );

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-background pb-4">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 pt-safe border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cidade/${slug}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Bus className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">Horário de Ônibus</h1>
        </div>
      </header>

      {/* Dia da semana */}
      <div className="px-4 pt-3 pb-2">
        <Tabs value={diaAtivo} onValueChange={(v) => setDiaAtivo(v as DiaType)}>
          <TabsList className="w-full">
            <TabsTrigger value="semana" className="flex-1 text-xs">Seg-Sex</TabsTrigger>
            <TabsTrigger value="sabado" className="flex-1 text-xs">Sábado</TabsTrigger>
            <TabsTrigger value="domingo" className="flex-1 text-xs">Dom/Feriado</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar linha ou bairro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Lista de linhas */}
      <div className="px-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Bus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-1">Nenhuma linha encontrada</h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm ? "Tente buscar por outro termo" : "Carregando linhas..."}
            </p>
          </div>
        ) : (
          filtered.map((linha) => {
            const id = linha.numero_linha;
            const isExpanded = expandedId === id;
            const parsed = isExpanded ? parseHorarios(linha.horarios, diaAtivo) : null;
            // Extract the line number
            const numero = linha.numero_linha.split(" ")[0];
            const nome = linha.numero_linha.substring(numero.length).trim();

            return (
              <div key={id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Linha header */}
                <button
                  onClick={() => toggleExpand(id)}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{numero}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground line-clamp-1">{nome}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Clock className="inline h-3 w-3 mr-1" />
                      Toque para ver horários
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>

                {/* Horários expandidos */}
                {isExpanded && parsed && (
                  <div className="border-t border-border px-3 pb-3">
                    {/* Destinos */}
                    <div className="grid grid-cols-2 gap-2 py-2">
                      {parsed.destinos.map((dest, i) => (
                        <div key={i} className="text-center">
                          <span className="text-[10px] uppercase font-semibold text-primary tracking-wider">
                            {dest || "—"}
                          </span>
                          {parsed.saidas[i] && (
                            <p className="text-[9px] text-muted-foreground/70 mt-0.5 line-clamp-2">
                              {parsed.saidas[i]}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Tabela de horários */}
                    {parsed.rows.length > 0 ? (
                      <div className="space-y-0.5">
                        {parsed.rows.map((row, i) => (
                          <div
                            key={i}
                            className={`grid grid-cols-2 gap-2 py-1.5 px-2 rounded-lg text-center ${
                              i % 2 === 0 ? "bg-muted/30" : ""
                            }`}
                          >
                            <span className="text-sm font-mono text-foreground">{row[0] || "—"}</span>
                            <span className="text-sm font-mono text-foreground">{row[1] || "—"}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Sem horários para este dia
                      </p>
                    )}

                    {/* Observações */}
                    {parsed.observacoes.length > 0 && (
                      <div className="mt-3 p-2 bg-muted/30 rounded-lg">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Observações</p>
                        {parsed.observacoes.map((obs, i) => (
                          <p key={i} className="text-[11px] text-muted-foreground leading-snug">
                            {obs}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OnibusListPage;
