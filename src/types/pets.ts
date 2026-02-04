export type PetStatus = "perdido" | "encontrado";
export type PetEspecie = "cachorro" | "gato" | "passaro" | "outro";

export interface Pet {
  id: string;
  cidade_id: string;
  nome: string;
  especie: PetEspecie;
  raca?: string | null;
  cor: string;
  descricao?: string | null;
  status: PetStatus;
  local_visto: string;
  data_ocorrencia: string;
  foto_url?: string | null;
  contato_whatsapp: string;
  contato_nome: string;
  ativo: boolean;
  created_at: string;
}

export interface PetInsert {
  cidade_id: string;
  nome: string;
  especie: PetEspecie;
  raca?: string;
  cor: string;
  descricao?: string;
  status: PetStatus;
  local_visto: string;
  data_ocorrencia: string;
  foto_url?: string;
  contato_whatsapp: string;
  contato_nome: string;
}
