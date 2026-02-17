import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, ChevronRight, MapPin, Info } from "lucide-react";

interface LinhaOnibus {
  numero_linha: string;
  url: string;
  horarios: string[];
  itinerario: string;
  descricao: string;
}

type DiaType = "semana" | "sabado" | "domingo";

function parseHorarios(horarios: string[], dia: DiaType) {
  if (!horarios || horarios.length < 4) return { destinos: [], saidas: [], rows: [], observacoes: [] };

  const destinos = horarios[1]?.split("|").map(s => s.trim()) || [];
  const saidas = horarios[2]?.split("|").map(s => s.trim()) || [];

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

  const dias: { key: DiaType; label: string }[] = [
    { key: "semana", label: "Seg-Sex" },
    { key: "sabado", label: "Sábado" },
    { key: "domingo", label: "Dom/Feriado" },
  ];

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header iOS style */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center px-4 py-2 pt-safe">
          <button
            onClick={() => navigate(`/cidade/${slug}`)}
            className="flex items-center gap-1 text-primary active:opacity-60 transition-opacity"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-[15px]">Voltar</span>
          </button>
        </div>
        <div className="px-5 pb-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Horários</h1>
        </div>
      </header>

      <div className="px-5 pt-4 space-y-4">
        {/* Segmented Control iOS */}
        <div className="flex bg-muted/60 rounded-[10px] p-[3px]">
          {dias.map((dia) => (
            <button
              key={dia.key}
              onClick={() => setDiaAtivo(dia.key)}
              className={`flex-1 py-2 text-[13px] font-medium rounded-[8px] transition-all duration-200 ${
                diaAtivo === dia.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {dia.label}
            </button>
          ))}
        </div>

        {/* Search iOS style */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Buscar linha ou bairro"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-muted/50 rounded-xl py-2.5 pl-10 pr-4 text-[15px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* Contagem */}
        {filtered.length > 0 && !searchTerm && (
          <p className="text-[13px] text-muted-foreground">
            {filtered.length} linhas disponíveis
          </p>
        )}

        {/* Lista de linhas */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-[15px] font-medium text-foreground">
                {searchTerm ? "Nenhum resultado" : "Carregando..."}
              </p>
              {searchTerm && (
                <p className="text-[13px] text-muted-foreground mt-1">
                  Tente outro termo de busca
                </p>
              )}
            </div>
          ) : (
            filtered.map((linha) => {
              const id = linha.numero_linha;
              const isExpanded = expandedId === id;
              const parsed = isExpanded ? parseHorarios(linha.horarios, diaAtivo) : null;
              const numero = linha.numero_linha.split(" ")[0];
              const nome = linha.numero_linha.substring(numero.length).trim();

              return (
                <div
                  key={id}
                  className="bg-card rounded-2xl overflow-hidden transition-all duration-200"
                  style={{ boxShadow: isExpanded ? "0 2px 12px rgba(0,0,0,0.06)" : "0 1px 3px rgba(0,0,0,0.04)" }}
                >
                  {/* Card header */}
                  <button
                    onClick={() => toggleExpand(id)}
                    className="w-full flex items-center gap-3.5 p-4 text-left active:bg-muted/30 transition-colors"
                  >
                    <div className="flex-shrink-0 w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-[13px] font-bold text-primary">{numero}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-semibold text-foreground line-clamp-1">{nome}</h3>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 text-muted-foreground/40 flex-shrink-0 transition-transform duration-200 ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  {/* Horários expandidos */}
                  {isExpanded && parsed && (
                    <div className="px-4 pb-4">
                      {/* Destinos */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        {parsed.destinos.map((dest, i) => (
                          <div key={i} className="bg-muted/40 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <MapPin className="h-3 w-3 text-primary" />
                              <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">
                                {dest || "—"}
                              </span>
                            </div>
                            {parsed.saidas[i] && (
                              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                                {parsed.saidas[i]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Tabela de horários */}
                      {parsed.rows.length > 0 ? (
                        <div className="rounded-xl overflow-hidden border border-border/40">
                          {/* Header da tabela */}
                          <div className="grid grid-cols-2 bg-muted/40">
                            {parsed.destinos.map((dest, i) => (
                              <div key={i} className="py-2 px-3 text-center">
                                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                                  {dest || "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                          {/* Linhas de horário */}
                          {parsed.rows.map((row, i) => (
                            <div
                              key={i}
                              className={`grid grid-cols-2 ${
                                i % 2 === 0 ? "bg-background" : "bg-muted/20"
                              }`}
                            >
                              <div className="py-2 px-3 text-center border-r border-border/20">
                                <span className="text-[14px] font-mono text-foreground tabular-nums">
                                  {row[0] || "—"}
                                </span>
                              </div>
                              <div className="py-2 px-3 text-center">
                                <span className="text-[14px] font-mono text-foreground tabular-nums">
                                  {row[1] || "—"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center">
                          <p className="text-[14px] text-muted-foreground">
                            Sem horários para este dia
                          </p>
                        </div>
                      )}

                      {/* Observações */}
                      {parsed.observacoes.length > 0 && (
                        <div className="mt-3 flex gap-2 p-3 bg-primary/5 rounded-xl">
                          <Info className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            {parsed.observacoes.map((obs, i) => (
                              <p key={i} className="text-[12px] text-muted-foreground leading-relaxed">
                                {obs}
                              </p>
                            ))}
                          </div>
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
    </div>
  );
};

export default OnibusListPage;
