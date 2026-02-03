import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Loader2, AlertCircle, Info } from "lucide-react";

interface FipePriceProps {
  marcaNome?: string;
  modeloNome?: string;
  anoModelo?: string;
  combustivel?: string;
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
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
}

const FIPE_API = "https://parallelum.com.br/fipe/api/v1/carros";

const FipePrice = ({ marcaNome, modeloNome, anoModelo, combustivel }: FipePriceProps) => {
  const [fipeBrandId, setFipeBrandId] = useState<string | null>(null);
  const [fipeModelId, setFipeModelId] = useState<string | null>(null);
  const [fipeYearCode, setFipeYearCode] = useState<string | null>(null);

  // Buscar marcas FIPE
  const { data: fipeBrands } = useQuery({
    queryKey: ["fipe-brands"],
    queryFn: async () => {
      const res = await fetch(`${FIPE_API}/marcas`);
      if (!res.ok) throw new Error("Erro ao buscar marcas FIPE");
      return res.json() as Promise<FipeBrand[]>;
    },
    staleTime: 1000 * 60 * 60, // 1 hora
  });

  // Encontrar marca FIPE correspondente
  useEffect(() => {
    if (fipeBrands && marcaNome) {
      const normalizedMarca = marcaNome.toLowerCase().trim();
      const found = fipeBrands.find(b => 
        b.nome.toLowerCase().includes(normalizedMarca) ||
        normalizedMarca.includes(b.nome.toLowerCase())
      );
      setFipeBrandId(found?.codigo || null);
      setFipeModelId(null);
      setFipeYearCode(null);
    }
  }, [fipeBrands, marcaNome]);

  // Buscar modelos FIPE da marca
  const { data: fipeModels } = useQuery({
    queryKey: ["fipe-models", fipeBrandId],
    queryFn: async () => {
      const res = await fetch(`${FIPE_API}/marcas/${fipeBrandId}/modelos`);
      if (!res.ok) throw new Error("Erro ao buscar modelos FIPE");
      const data = await res.json();
      return data.modelos as FipeModel[];
    },
    enabled: !!fipeBrandId,
    staleTime: 1000 * 60 * 60,
  });

  // Encontrar modelo FIPE correspondente
  useEffect(() => {
    if (fipeModels && modeloNome) {
      const normalizedModelo = modeloNome.toLowerCase().trim();
      // Tentar match exato primeiro
      let found = fipeModels.find(m => 
        m.nome.toLowerCase() === normalizedModelo
      );
      // Se não encontrar, buscar por inclusão
      if (!found) {
        found = fipeModels.find(m => 
          m.nome.toLowerCase().includes(normalizedModelo) ||
          normalizedModelo.includes(m.nome.toLowerCase().split(' ')[0])
        );
      }
      setFipeModelId(found?.codigo || null);
      setFipeYearCode(null);
    }
  }, [fipeModels, modeloNome]);

  // Buscar anos FIPE do modelo
  const { data: fipeYears } = useQuery({
    queryKey: ["fipe-years", fipeBrandId, fipeModelId],
    queryFn: async () => {
      const res = await fetch(`${FIPE_API}/marcas/${fipeBrandId}/modelos/${fipeModelId}/anos`);
      if (!res.ok) throw new Error("Erro ao buscar anos FIPE");
      return res.json() as Promise<FipeYear[]>;
    },
    enabled: !!fipeBrandId && !!fipeModelId,
    staleTime: 1000 * 60 * 60,
  });

  // Encontrar ano FIPE correspondente
  useEffect(() => {
    if (fipeYears && anoModelo) {
      // Filtrar por combustível se disponível
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
          filtered = fipeYears.filter(y => y.nome.includes(tipoComb));
        }
      }
      
      // Buscar pelo ano
      const found = filtered.find(y => y.nome.startsWith(anoModelo));
      setFipeYearCode(found?.codigo || filtered[0]?.codigo || null);
    }
  }, [fipeYears, anoModelo, combustivel]);

  // Buscar preço FIPE
  const { data: fipePrice, isLoading, isError } = useQuery({
    queryKey: ["fipe-price", fipeBrandId, fipeModelId, fipeYearCode],
    queryFn: async () => {
      const res = await fetch(`${FIPE_API}/marcas/${fipeBrandId}/modelos/${fipeModelId}/anos/${fipeYearCode}`);
      if (!res.ok) throw new Error("Erro ao buscar preço FIPE");
      return res.json() as Promise<FipePrice>;
    },
    enabled: !!fipeBrandId && !!fipeModelId && !!fipeYearCode,
    staleTime: 1000 * 60 * 60,
  });

  // Se não tiver dados suficientes, não mostra nada
  if (!marcaNome || !modeloNome || !anoModelo) {
    return null;
  }

  // Loading
  if (isLoading && fipeBrandId && fipeModelId && fipeYearCode) {
    return (
      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Buscando preço FIPE...</span>
        </div>
      </div>
    );
  }

  // Erro ou não encontrado
  if (isError || (!fipePrice && fipeBrandId && fipeModelId)) {
    return (
      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground">
              Preço FIPE não disponível para este veículo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Sucesso
  if (fipePrice) {
    return (
      <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-green-600 dark:text-green-400 font-medium uppercase tracking-wide">
              Tabela FIPE - {fipePrice.MesReferencia}
            </p>
            <p className="text-xl font-bold text-green-700 dark:text-green-300 mt-1">
              {fipePrice.Valor}
            </p>
            <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
              {fipePrice.Marca} {fipePrice.Modelo} • {fipePrice.AnoModelo} • {fipePrice.Combustivel}
            </p>
            <p className="text-[10px] text-green-600/50 dark:text-green-400/50 mt-1">
              Código FIPE: {fipePrice.CodigoFipe}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Buscando marca/modelo
  if (!fipeBrandId || !fipeModelId) {
    return (
      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Buscando na tabela FIPE...</span>
        </div>
      </div>
    );
  }

  return null;
};

export default FipePrice;
