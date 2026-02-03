export interface Banner {
  id: string;
  titulo: string;
  imagem_url: string;
  descricao: string | null;
  video_youtube_url: string | null;
  dias_comprados: number;
  dias_usados: number;
  ativo: boolean;
  admin_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BannerInsert {
  titulo: string;
  imagem_url: string;
  descricao?: string;
  video_youtube_url?: string;
  dias_comprados: number;
  admin_user_id?: string;
}

export interface RelCidadeBanner {
  id: string;
  cidade_id: string;
  banner_id: string;
  created_at: string;
}

export interface RelBannerDias {
  id: string;
  banner_id: string;
  data_exibicao: string;
  utilizado: boolean;
  created_at: string;
}
