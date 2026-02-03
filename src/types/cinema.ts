export interface Cinema {
  id: string;
  cidade_id: string;
  nome_filme: string;
  sinopse: string | null;
  nome_cinema: string;
  banner_url: string | null;
  trailer_url: string | null;
  horarios: string[];
  created_at: string;
  updated_at: string;
}
