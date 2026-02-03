import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface FipePriceCompactProps {
  marcaNome?: string;
  modeloNome?: string;
  anoModelo?: string;
  combustivel?: string;
  precoAnunciado?: number;
}

interface FipeBrand {
  codigo: string;
  nome: string;
}

interface FipeModel {
  codigo: string;
  nome: string;
}

interface FipeYear {
  codigo: string;
  nome: string;
}

interface FipePrice {
  Valor: string;
}

const FIPE_API = "https://parallelum.com.br/fipe/api/v1/carros";

// Cache para evitar múltiplas requisições
const brandCache: Record<string, string> = {};
const modelCache: Record<string, string> = {};

const FipePriceCompact = ({ 
  marcaNome, 
  modeloNome, 
  anoModelo, 
  combustivel,
  precoAnunciado 
}: FipePriceCompactProps) => {
  
  // Buscar marcas FIPE
  const { data: fipeBrands } = useQuery({
    queryKey: ["fipe-brands"],
    queryFn: async () => {
      const res = await fetch(`${FIPE_API}/marcas`);
      if (!res.ok) throw new Error("Erro");
      return res.json() as Promise<FipeBrand[]>;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 horas
  });

  // Encontrar marca
  const fipeBrandId = (() => {
    if (!fipeBrands || !marcaNome) return null;
    const key = marcaNome.toLowerCase();
    if (brandCache[key]) return brandCache[key];
    const found = fipeBrands.find(b => 
      b.nome.toLowerCase().includes(key) ||
      key.includes(b.nome.toLowerCase())
    );
    if (found) brandCache[key] = found.codigo;
    return found?.codigo || null;
  })();

  // Buscar modelos
  const { data: fipeModels } = useQuery({
    queryKey: ["fipe-models", fipeBrandId],
    queryFn: async () => {
      const res = await fetch(`${FIPE_API}/marcas/${fipeBrandId}/modelos`);
      if (!res.ok) throw new Error("Erro");
      const data = await res.json();
      return data.modelos as FipeModel[];
    },
    enabled: !!fipeBrandId,
    staleTime: 1000 * 60 * 60 * 24,
  });

  // Encontrar modelo
  const fipeModelId = (() => {
    if (!fipeModels || !modeloNome) return null;
    const key = `${fipeBrandId}-${modeloNome.toLowerCase()}`;
    if (modelCache[key]) return modelCache[key];
    const normalizedModelo = modeloNome.toLowerCase().trim();
    let found = fipeModels.find(m => m.nome.toLowerCase() === normalizedModelo);
    if (!found) {
      found = fipeModels.find(m => 
        m.nome.toLowerCase().includes(normalizedModelo) ||
        normalizedModelo.includes(m.nome.toLowerCase().split(' ')[0])
      );
    }
    if (found) modelCache[key] = found.codigo;
    return found?.codigo || null;
  })();

  // Buscar anos
  const { data: fipeYears } = useQuery({
    queryKey: ["fipe-years", fipeBrandId, fipeModelId],
    queryFn: async () => {
      const res = await fetch(`${FIPE_API}/marcas/${fipeBrandId}/modelos/${fipeModelId}/anos`);
      if (!res.ok) throw new Error("Erro");
      return res.json() as Promise<FipeYear[]>;
    },
    enabled: !!fipeBrandId && !!fipeModelId,
    staleTime: 1000 * 60 * 60 * 24,
  });

  // Encontrar ano
  const fipeYearCode = (() => {
    if (!fipeYears || !anoModelo) return null;
    let filtered = fipeYears;
    if (combustivel) {
      const combustivelMap: Record<string, string> = {
        gasolina: "Gasolina",
        etanol: "Álcool",
        flex: "Flex",
        diesel: "Diesel",
      };
      const tipoComb = combustivelMap[combustivel];
      if (tipoComb) {
        const f = fipeYears.filter(y => y.nome.includes(tipoComb));
        if (f.length > 0) filtered = f;
      }
    }
    const found = filtered.find(y => y.nome.startsWith(anoModelo));
    return found?.codigo || filtered[0]?.codigo || null;
  })();

  // Buscar preço
  const { data: fipePrice } = useQuery({
    queryKey: ["fipe-price", fipeBrandId, fipeModelId, fipeYearCode],
    queryFn: async () => {
      const res = await fetch(`${FIPE_API}/marcas/${fipeBrandId}/modelos/${fipeModelId}/anos/${fipeYearCode}`);
      if (!res.ok) throw new Error("Erro");
      return res.json() as Promise<FipePrice>;
    },
    enabled: !!fipeBrandId && !!fipeModelId && !!fipeYearCode,
    staleTime: 1000 * 60 * 60 * 24,
  });

  if (!fipePrice) return null;

  // Parsear o valor FIPE (ex: "R$ 89.500,00" -> 89500)
  const fipeValue = parseFloat(
    fipePrice.Valor.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()
  );

  // Calcular diferença
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
            <>
              <TrendingDown className="h-3 w-3" />
              {Math.abs(diff).toFixed(0)}%
            </>
          ) : isAbove ? (
            <>
              <TrendingUp className="h-3 w-3" />
              +{diff.toFixed(0)}%
            </>
          ) : (
            <>
              <Minus className="h-3 w-3" />
              ≈FIPE
            </>
          )}
        </span>
      )}
    </div>
  );
};

export default FipePriceCompact;
