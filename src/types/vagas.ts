export interface Vaga {
  id: string;
  cidade_id: string;
  titulo: string;
  empresa: string;
  descricao: string;
  requisitos?: string;
  salario?: string;
  tipo_contrato: 'clt' | 'pj' | 'temporario' | 'estagio' | 'freelancer';
  modalidade: 'presencial' | 'remoto' | 'hibrido';
  contato_whatsapp?: string;
  contato_email?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const tipoContratoLabels: Record<string, string> = {
  clt: 'CLT',
  pj: 'PJ',
  temporario: 'Temporário',
  estagio: 'Estágio',
  freelancer: 'Freelancer',
};

export const modalidadeLabels: Record<string, string> = {
  presencial: 'Presencial',
  remoto: 'Remoto',
  hibrido: 'Híbrido',
};
