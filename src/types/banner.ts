export type BannerStatus = 'rascunho' | 'aguardando_pagamento' | 'pendente' | 'ativo' | 'inativo' | 'expirado';

export interface Banner {
  id: string;
  titulo: string;
  imagem_url: string;
  descricao: string | null;
  video_youtube_url: string | null;
  video_upload_url: string | null;
  dias_comprados: number;
  dias_usados: number;
  ativo: boolean;
  status?: BannerStatus;
  admin_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BannerImagem {
  id: string;
  banner_id: string;
  imagem_url: string;
  ordem: number;
  created_at: string;
}

export interface BannerInsert {
  titulo: string;
  imagem_url: string;
  descricao?: string;
  video_youtube_url?: string;
  video_upload_url?: string;
  dias_comprados: number;
  status?: BannerStatus;
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

export type PagamentoStatus = 'pendente' | 'pago' | 'cancelado' | 'expirado';

export interface PagamentoBanner {
  id: string;
  banner_id: string;
  user_id: string;
  cidade_id: string;
  valor: number;
  dias_comprados: number;
  valor_dia: number;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  status: PagamentoStatus;
  email_enviado: boolean;
  expira_em: string | null;
  pago_em: string | null;
  created_at: string;
  updated_at: string;
}
