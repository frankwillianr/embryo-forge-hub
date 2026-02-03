export interface AloPrefeitura {
  id: string;
  cidade_id: string;
  titulo: string;
  descricao: string | null;
  video_url: string | null;
  created_at: string;
  updated_at: string;
  imagens?: AloPrefeituraImagem[];
  likes_count?: number;
  dislikes_count?: number;
}

export interface AloPrefeituraImagem {
  id: string;
  alo_prefeitura_id: string;
  imagem_url: string;
  ordem: number;
  created_at: string;
}
