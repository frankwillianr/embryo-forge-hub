alter table public.solicitacao_orcamento
  add column if not exists whatsapp text;

update public.solicitacao_orcamento so
set whatsapp = regexp_replace(coalesce(p.contato, ''), '\D', '', 'g')
from public.profiles p
where p.id = so.user_id
  and so.whatsapp is null
  and length(regexp_replace(coalesce(p.contato, ''), '\D', '', 'g')) = 11;

alter table public.solicitacao_orcamento
  drop constraint if exists solicitacao_orcamento_whatsapp_check;

alter table public.solicitacao_orcamento
  add constraint solicitacao_orcamento_whatsapp_check
  check (
    whatsapp is null
    or whatsapp ~ '^[0-9]{11}$'
  );

comment on column public.solicitacao_orcamento.whatsapp is
  'WhatsApp do solicitante no momento da solicitação de orçamento. Obrigatório no app para novas solicitações.';
