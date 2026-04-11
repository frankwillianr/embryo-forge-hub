export interface Cinema {
  id: string;
  cidade_id: string;
  nome_filme: string;
  sinopse: string | null;
  nome_cinema: string;
  banner_url: string | null;
  trailer_url: string | null;
  horarios: string[];
  dias_exibicao?: string[] | null;
  duracao: string | null;
  genero: string | null;
  classificacao?: string | null;
  data_estreia?: string | null;
  idioma?: string | null;
  situacao_exibicao?: 'em_cartaz' | 'em_breve' | 'pre_venda' | 'desconhecido' | null;
  status: 'em_cartaz' | 'em_breve' | 'pre_venda' | 'desconhecido';
  id_externo: string | null;
  created_at: string;
  updated_at: string;
}
