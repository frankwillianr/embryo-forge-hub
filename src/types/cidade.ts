export interface Cidade {
  id: string;
  nome: string;
  slug: string;
  banner?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CidadeInsert {
  nome: string;
  slug: string;
  banner?: string;
}

export interface CidadeUpdate {
  nome?: string;
  slug?: string;
  banner?: string;
}
