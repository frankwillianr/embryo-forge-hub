export interface JornalReacao {
  id: string;
  jornal_id: string;
  tipo: 'like' | 'dislike';
  user_fingerprint: string;
  created_at: string;
}

export interface Jornal {
  id: string;
  cidade_id: string;
  titulo: string;
  descricao: string;
  descricao_curta?: string | null;
  fonte?: string | null;
  categoria?: string | null;
  video_url?: string | null;
  imagens?: string[] | string | null;
  created_at: string;
  updated_at: string;
  likes_count?: number;
  dislikes_count?: number;
}

export interface JornalInsert {
  cidade_id: string;
  titulo: string;
  descricao: string;
  fonte?: string;
  video_url?: string;
  imagens?: string[];
}

/** Normaliza o campo imagens que pode vir como string, array ou null */
export function parseImagens(imagens: string[] | string | null | undefined): string[] {
  if (!imagens) return [];
  if (Array.isArray(imagens)) return imagens.filter(Boolean);
  if (typeof imagens === 'string') return [imagens];
  return [];
}
