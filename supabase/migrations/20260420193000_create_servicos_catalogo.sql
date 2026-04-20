-- Catalogo administravel para a tela "Onde ir & Servicos"

create or replace function public.is_admin_any_city(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rel_cidade_admin a
    where a.user_id = p_user_id
  );
$$;

grant execute on function public.is_admin_any_city(uuid) to authenticated;

create table if not exists public.servico_categoria (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titulo text not null,
  emoji text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  categorias_banco text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.servico_subcategoria (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.servico_categoria(id) on delete cascade,
  slug text not null unique,
  nome text not null,
  emoji text,
  icon_key text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.servico_categoria enable row level security;
alter table public.servico_subcategoria enable row level security;

drop policy if exists servico_categoria_select_public on public.servico_categoria;
create policy servico_categoria_select_public
  on public.servico_categoria
  for select
  using (true);

drop policy if exists servico_subcategoria_select_public on public.servico_subcategoria;
create policy servico_subcategoria_select_public
  on public.servico_subcategoria
  for select
  using (true);

drop policy if exists servico_categoria_insert_admin on public.servico_categoria;
create policy servico_categoria_insert_admin
  on public.servico_categoria
  for insert
  to authenticated
  with check (public.is_admin_any_city(auth.uid()));

drop policy if exists servico_categoria_update_admin on public.servico_categoria;
create policy servico_categoria_update_admin
  on public.servico_categoria
  for update
  to authenticated
  using (public.is_admin_any_city(auth.uid()))
  with check (public.is_admin_any_city(auth.uid()));

drop policy if exists servico_categoria_delete_admin on public.servico_categoria;
create policy servico_categoria_delete_admin
  on public.servico_categoria
  for delete
  to authenticated
  using (public.is_admin_any_city(auth.uid()));

drop policy if exists servico_subcategoria_insert_admin on public.servico_subcategoria;
create policy servico_subcategoria_insert_admin
  on public.servico_subcategoria
  for insert
  to authenticated
  with check (public.is_admin_any_city(auth.uid()));

drop policy if exists servico_subcategoria_update_admin on public.servico_subcategoria;
create policy servico_subcategoria_update_admin
  on public.servico_subcategoria
  for update
  to authenticated
  using (public.is_admin_any_city(auth.uid()))
  with check (public.is_admin_any_city(auth.uid()));

drop policy if exists servico_subcategoria_delete_admin on public.servico_subcategoria;
create policy servico_subcategoria_delete_admin
  on public.servico_subcategoria
  for delete
  to authenticated
  using (public.is_admin_any_city(auth.uid()));

insert into public.servico_categoria (slug, titulo, emoji, ordem, ativo, categorias_banco)
values
  ('bares', 'Bares e Restaurantes', '🍽️', 0, true, array['bares','bar','restaurantes','lanchonete','pizzaria','hamburgueria','sushi','cafeteria']),
  ('beleza', 'Beleza', '💇', 1, true, array['salao','barbeiro','manicure','estetica','maquiagem','sobrancelha','depilacao','cosmeticos']),
  ('servicos', 'Serviços', '🛠️', 2, true, array['reparos','eletricista','encanador','obras','limpeza','dedetizacao','chaveiro','pintor','marceneiro','serralheria','vidraceiro','ar-condicionado','jardinagem','mudancas','diarista','costura']),
  ('profissionais', 'Profissionais', '👔', 3, true, array['advogado','contador','despachante','engenheiro','arquiteto','corretor','fotografo','aulas','idiomas','informatica','eventos']),
  ('saude', 'Saúde', '🏥', 4, true, array['clinica','dentista','psicologo','fisioterapeuta','nutricionista','personal','academia','massagista','farmacia']),
  ('comercio', 'Comércio', '🛍️', 5, true, array['desapega','lojas','promocoes','restaurantes','entregador','moda','eletronicos']),
  ('veiculos', 'Veículos', '🚗', 6, true, array['mecanico','lava-jato','auto-pecas','guincho','funilaria','borracharia','vistoria','motorista']),
  ('pets', 'Pets', '🐶', 7, true, array['veterinario','pet','petshop','adestrador','hotel-pet','passeador'])
on conflict (slug) do update set
  titulo = excluded.titulo,
  emoji = excluded.emoji,
  ordem = excluded.ordem,
  ativo = excluded.ativo,
  categorias_banco = excluded.categorias_banco,
  updated_at = now();

insert into public.servico_subcategoria (categoria_id, slug, nome, emoji, icon_key, ordem, ativo)
select c.id, x.slug, x.nome, x.emoji, x.icon_key, x.ordem, true
from (
  values
    ('bares','restaurantes','Restaurantes','🍽️',null,0),
    ('bares','bares','Bares','🍻',null,1),
    ('bares','lanchonete','Lanchonete','🍔',null,2),
    ('bares','pizzaria','Pizzaria','🍕',null,3),
    ('bares','hamburgueria','Hamburgueria','🍟',null,4),
    ('bares','sushi','Sushi','🍣',null,5),
    ('bares','cafeteria','Cafeteria','☕',null,6),
    ('bares','doceria','Doceria','🍰',null,7),

    ('beleza','salao','Salão',null,'salao',0),
    ('beleza','barbeiro','Barbeiro','💈',null,1),
    ('beleza','manicure','Manicure','💅',null,2),
    ('beleza','estetica','Estética','✨',null,3),
    ('beleza','maquiagem','Maquiagem','💄',null,4),
    ('beleza','sobrancelha','Sobrancelha','🪮',null,5),
    ('beleza','depilacao','Depilação','🌸',null,6),
    ('beleza','cosmeticos','Cosméticos','💄',null,7),

    ('servicos','reparos','Reparos',null,'reparos',0),
    ('servicos','eletricista','Eletricista','⚡',null,1),
    ('servicos','encanador','Encanador','🚿',null,2),
    ('servicos','obras','Obras',null,'obras',3),
    ('servicos','limpeza','Limpeza',null,'limpeza',4),
    ('servicos','dedetizacao','Dedetização','🪲',null,5),
    ('servicos','chaveiro','Chaveiro','🔑',null,6),
    ('servicos','pintor','Pintor','🎨',null,7),
    ('servicos','marceneiro','Marceneiro','🪑',null,8),
    ('servicos','serralheria','Serralheria','⚙️',null,9),
    ('servicos','vidraceiro','Vidraceiro','🪟',null,10),
    ('servicos','ar-condicionado','Ar Cond.','❄️',null,11),
    ('servicos','jardinagem','Jardinagem','🌳',null,12),
    ('servicos','mudancas','Mudanças','🚚',null,13),
    ('servicos','diarista','Diarista','🏠',null,14),
    ('servicos','costura','Costura','🧵',null,15),

    ('profissionais','advogado','Advogado','⚖️',null,0),
    ('profissionais','contador','Contador','📊',null,1),
    ('profissionais','despachante','Despachante','📄',null,2),
    ('profissionais','engenheiro','Engenheiro','🏗️',null,3),
    ('profissionais','arquiteto','Arquiteto','📐',null,4),
    ('profissionais','corretor','Corretor','🏡',null,5),
    ('profissionais','fotografo','Fotógrafo','📷',null,6),
    ('profissionais','aulas','Aulas','📚',null,7),
    ('profissionais','idiomas','Idiomas','🌎',null,8),
    ('profissionais','informatica','Informática','💻',null,9),
    ('profissionais','eventos','Eventos','🎉',null,10),

    ('saude','clinica','Clínica','🏥',null,0),
    ('saude','dentista','Dentista','🦷',null,1),
    ('saude','psicologo','Psicólogo','🧠',null,2),
    ('saude','fisioterapeuta','Fisio','🦴',null,3),
    ('saude','nutricionista','Nutrição','🍎',null,4),
    ('saude','personal','Personal','🏋️',null,5),
    ('saude','academia','Academia','💪',null,6),
    ('saude','massagista','Massagem','💆',null,7),
    ('saude','farmacia','Farmácia','💊',null,8),

    ('comercio','desapega','Marketplace local',null,'desapega',0),
    ('comercio','lojas','Lojas','🏪',null,1),
    ('comercio','promocoes','Promoções','🏷️',null,2),
    ('comercio','restaurantes','Restaurantes','🍽️',null,3),
    ('comercio','entregador','Delivery',null,'entregador',4),
    ('comercio','moda','Moda','👗',null,5),
    ('comercio','eletronicos','Eletrônicos','📱',null,6),

    ('veiculos','mecanico','Mecânico','🔧',null,0),
    ('veiculos','lava-jato','Lava Jato','🚿',null,1),
    ('veiculos','auto-pecas','Auto Peças','⚙️',null,2),
    ('veiculos','guincho','Guincho','🏗️',null,3),
    ('veiculos','funilaria','Funilaria','🔨',null,4),
    ('veiculos','borracharia','Borracharia','🔄',null,5),
    ('veiculos','vistoria','Vistoria','📋',null,6),
    ('veiculos','motorista','Motorista','🚙',null,7),

    ('pets','veterinario','Veterinário','🩺',null,0),
    ('pets','pet','Banho e Tosa',null,'pet',1),
    ('pets','petshop','Pet Shop','🐾',null,2),
    ('pets','adestrador','Adestrador','🐕',null,3),
    ('pets','hotel-pet','Hotel Pet','🏨',null,4),
    ('pets','passeador','Passeador','🐕',null,5)
) as x(categoria_slug, slug, nome, emoji, icon_key, ordem)
join public.servico_categoria c on c.slug = x.categoria_slug
on conflict (slug) do update set
  categoria_id = excluded.categoria_id,
  nome = excluded.nome,
  emoji = excluded.emoji,
  icon_key = excluded.icon_key,
  ordem = excluded.ordem,
  ativo = excluded.ativo,
  updated_at = now();

