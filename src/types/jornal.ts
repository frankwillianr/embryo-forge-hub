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
  video_url?: string | null;
  imagens?: string[];
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
