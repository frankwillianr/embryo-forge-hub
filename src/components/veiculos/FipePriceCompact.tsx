import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface FipePriceCompactProps {
  // Códigos diretos da FIPE (preferencial)
  fipeMarcaCodigo?: string;
  fipeModeloCodigo?: string;
  fipeVersaoCodigo?: string;
  // Fallback por nome (busca aproximada)
  marcaNome?: string;
  modeloNome?: string;
  anoModelo?: string;
  combustivel?: string;
  precoAnunciado?: number;
}

interface FipeBrand { codigo: string; nome: string; }
interface FipeModel { codigo: string; nome: string; }
interface FipeYear  { codigo: string; nome: string; }
interface FipePrice { Valor: string; }

const FIPE_API = "https://parallelum.com.br/fipe/api/v1/carros";

const FipePriceCompact = ({
  fipeMarcaCodigo,
  fipeModeloCodigo,
  fipeVersaoCodigo,
  marcaNome,
  modeloNome,
  anoModelo,
  combustivel,
  precoAnunciado,
}: FipePriceCompactProps) => {

  // --- Caminho 1: códigos diretos disponíveis ---
  const hasDirectCodes = !!fipeMarcaCodigo && !!fipeModeloCodigo && !!fipeVersaoCodigo;

  const { data: directPrice } = useQuery({
    queryKey: ["fipe-direct", fipeMarcaCodigo, fipeModeloCodigo, fipeVersaoCodigo],
    queryFn: async () => {
      const res = await fetch(
        `${FIPE_API}/marcas/${fipeMarcaCodigo}/modelos/${fipeModeloCodigo}/anos/${fipeVersaoCodigo}`
      );
      if (!res.ok) throw new Error("Erro");
      return res.json() as Promise<FipePrice>;
    },
    enabled: hasDirectCodes,
    staleTime: 1000 * 60 * 60 * 24,
  });

  // --- Caminho 2: fallback por nome (busca aproximada) ---
  const { data: fipeBrands } = useQuery({
    queryKey: ["fipe-brands"],
    queryFn: async () => {
      const res = await fetch(`${FIPE_API}/marcas`);
      if (!res.ok) throw new Error("Erro");
      return res.json() as Promise<FipeBrand[]>;
    },
    enabled: !hasDirectCodes && !!marcaNome,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const fipeBrandId = (() => {
    if (hasDirectCodes || !fipeBrands || !marcaNome) return null;
    const key = marcaNome.toLowerCase();
    return fipeBrands.find(b =>
      b.nome.toLowerCase().includes(key) || key.includes(b.nome.toLowerCase())
    )?.codigo || null;
  })();

  const { data: fipeModels } = useQuery({
    queryKey: ["fipe-models", fipeBrandId],
    queryFn: async () => {
      const res = await fetch(`${FIPE_API}/marcas/${fipeBrandId}/modelos`);
      if (!res.ok) throw new Error("Erro");
      const data = await res.json();
      return data.modelos as FipeModel[];
    },
    enabled: !hasDirectCodes && !!fipeBrandId,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const fipeModelId = (() => {
    if (hasDirectCodes || !fipeModels || !modeloNome) return null;
    const norm = modeloNome.toLowerCase().trim();
    return (
      fipeModels.find(m => m.nome.toLowerCase() === norm) ||
      fipeModels.find(m => m.nome.toLowerCase().includes(norm) || norm.includes(m.nome.toLowerCase().split(" ")[0]))
    )?.codigo || null;
  })();

  const { data: fipeYears } = useQuery({
    queryKey: ["fipe-years", fipeBrandId, fipeModelId],
    queryFn: async () => {
      const res = await fetch(`${FIPE_API}/marcas/${fipeBrandId}/modelos/${fipeModelId}/anos`);
      if (!res.ok) throw new Error("Erro");
      return res.json() as Promise<FipeYear[]>;
    },
    enabled: !hasDirectCodes && !!fipeBrandId && !!fipeModelId,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const fipeYearCode = (() => {
    if (hasDirectCodes || !fipeYears || !anoModelo) return null;
    let filtered = fipeYears;
    if (combustivel) {
      const map: Record<string, string> = { gasolina: "Gasolina", etanol: "Álcool", flex: "Flex", diesel: "Diesel" };
      const t = map[combustivel];
      if (t) { const f = fipeYears.filter(y => y.nome.includes(t)); if (f.length) filtered = f; }
    }
    return filtered.find(y => y.nome.startsWith(anoModelo))?.codigo || filtered[0]?.codigo || null;
  })();

  const { data: fallbackPrice } = useQuery({
    queryKey: ["fipe-price", fipeBrandId, fipeModelId, fipeYearCode],
    queryFn: async () => {
      const res = await fetch(`${FIPE_API}/marcas/${fipeBrandId}/modelos/${fipeModelId}/anos/${fipeYearCode}`);
      if (!res.ok) throw new Error("Erro");
      return res.json() as Promise<FipePrice>;
    },
    enabled: !hasDirectCodes && !!fipeBrandId && !!fipeModelId && !!fipeYearCode,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const fipePrice = directPrice || fallbackPrice;
  if (!fipePrice) return null;

  const fipeValue = parseFloat(
    fipePrice.Valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()
  );
  const diff = precoAnunciado ? ((precoAnunciado - fipeValue) / fipeValue) * 100 : 0;
  const isAbove = diff > 2;
  const isBelow = diff < -2;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground">
        FIPE: {fipePrice.Valor.replace(",00", "")}
      </span>
      {precoAnunciado && (
        <span className={`flex items-center text-[9px] font-medium ${
          isBelow ? "text-green-600" : isAbove ? "text-red-500" : "text-muted-foreground"
        }`}>
          {isBelow ? (
            <><TrendingDown className="h-3 w-3" />{Math.abs(diff).toFixed(0)}%</>
          ) : isAbove ? (
            <><TrendingUp className="h-3 w-3" />+{diff.toFixed(0)}%</>
          ) : (
            <><Minus className="h-3 w-3" />≈FIPE</>
          )}
        </span>
      )}
    </div>
  );
};

export default FipePriceCompact;
