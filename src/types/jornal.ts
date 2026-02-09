export interface JornalImagem {
  id: string;
  jornal_id: string;
  imagem_url: string;
  ordem: number;
  created_at: string;
}

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
  created_at: string;
  updated_at: string;
  imagens?: JornalImagem[];
  likes_count?: number;
  dislikes_count?: number;
}

export interface JornalInsert {
  cidade_id: string;
  titulo: string;
  descricao: string;
  fonte?: string;
  video_url?: string;
}
