const FIPE_BASE_URL = "https://parallelum.com.br/fipe/api/v1";

export interface FipeMarca {
  codigo: string;
  nome: string;
}

export interface FipeModelo {
  codigo: number;
  nome: string;
}

export interface FipeAno {
  codigo: string;
  nome: string;
}

export interface FipeVeiculo {
  Valor: string;
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
  TipoVeiculo: number;
  SiglaCombustivel: string;
}

// Cache simples em memória
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 horas

async function fetchWithCache<T>(url: string): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FIPE API error: ${response.statusText}`);
  }

  const data = await response.json();
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}

export const fipeApi = {
  /**
   * Busca todas as marcas de carros
   */
  async getMarcas(): Promise<FipeMarca[]> {
    return fetchWithCache(`${FIPE_BASE_URL}/carros/marcas`);
  },

  /**
   * Busca modelos de uma marca específica
   */
  async getModelos(marcaId: string): Promise<{ modelos: FipeModelo[] }> {
    return fetchWithCache(`${FIPE_BASE_URL}/carros/marcas/${marcaId}/modelos`);
  },

  /**
   * Busca anos/versões disponíveis para um modelo
   */
  async getAnos(marcaId: string, modeloId: number): Promise<FipeAno[]> {
    return fetchWithCache(
      `${FIPE_BASE_URL}/carros/marcas/${marcaId}/modelos/${modeloId}/anos`
    );
  },

  /**
   * Busca informações completas de um veículo específico
   */
  async getVeiculo(
    marcaId: string,
    modeloId: number,
    anoId: string
  ): Promise<FipeVeiculo> {
    return fetchWithCache(
      `${FIPE_BASE_URL}/carros/marcas/${marcaId}/modelos/${modeloId}/anos/${anoId}`
    );
  },

  /**
   * Limpa o cache (útil para forçar atualização)
   */
  clearCache() {
    cache.clear();
  },
};
