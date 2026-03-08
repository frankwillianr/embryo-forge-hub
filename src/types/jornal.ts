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
  data_noticia?: string | null;
  descricao_curta?: string | null;
  fonte?: string | null;
  categoria?: string | null;
  video_url?: string | null;
  imagens?: string[] | string | null;
  audio_url?: string | null;
  created_at: string;
  updated_at: string;
  likes_count?: number;
  dislikes_count?: number;
}

export interface JornalInsert {
  cidade_id: string;
  titulo: string;
  descricao: string;
  data_noticia?: string;
  fonte?: string;
  video_url?: string;
  imagens?: string[];
}

/** Normaliza o campo imagens que pode vir como string JSON, array ou null */
export function parseImagens(imagens: string[] | string | null | undefined): string[] {
  if (!imagens) return [];
  if (Array.isArray(imagens)) return imagens.filter(Boolean);
  if (typeof imagens === 'string') {
    const trimmed = imagens.trim();
    // Tenta parsear como JSON array (ex: '["https://...","https://..."]')
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
        if (typeof parsed === 'string') return [parsed];
      } catch {
        // não é JSON válido, trata como URL direta
      }
    }
    return trimmed ? [trimmed] : [];
  }
  return [];
}
