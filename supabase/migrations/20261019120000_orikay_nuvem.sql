-- Orikay na nuvem: agências, equipe, convites e os dados de cada agência.
--
-- Modelo: cada registro da plataforma (cliente, post, vídeo, lançamento...)
-- vira uma linha em `registros`, com o JSON inteiro em `dados`. A aplicação
-- já trabalha com esses objetos; o banco só guarda, isola por agência e
-- avisa em tempo real quem está com a agência aberta.
--
-- Isolamento: toda leitura e escrita passa por RLS. Ninguém enxerga dado de
-- uma agência da qual não é membro, e lançamentos/cobranças só aparecem
-- para quem tem acesso ao Financeiro.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ --
-- Tabelas
-- ------------------------------------------------------------------ --

create table public.agencias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  criada_em timestamptz not null default now(),
  criada_por uuid references auth.users on delete set null
);

create table public.membros (
  agencia_id uuid not null references public.agencias on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  nome text not null,
  email text,
  cargo text not null default 'Equipe',
  cor text not null default '#7c5cff',
  admin boolean not null default false,
  financeiro boolean not null default false,
  entrou_em timestamptz not null default now(),
  primary key (agencia_id, user_id)
);
create index membros_user_idx on public.membros (user_id);

create table public.convites (
  token text primary key default encode(gen_random_bytes(18), 'hex'),
  agencia_id uuid not null references public.agencias on delete cascade,
  cargo text not null default 'Equipe',
  admin boolean not null default false,
  financeiro boolean not null default false,
  criado_por uuid references auth.users on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '14 days',
  usado_por uuid references auth.users on delete set null,
  usado_em timestamptz
);
create index convites_agencia_idx on public.convites (agencia_id);

create table public.registros (
  agencia_id uuid not null references public.agencias on delete cascade,
  tipo text not null,
  id text not null,
  dados jsonb not null,
  excluido boolean not null default false,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  -- Aba/aparelho que escreveu: o app ignora o eco das próprias gravações.
  origem text,
  -- Posição na lista (ordem dos cartões no quadro), fracionária pra mover
  -- um cartão sem regravar os vizinhos.
  ordem double precision not null default 0,
  primary key (agencia_id, tipo, id)
);
create index registros_agencia_tempo_idx on public.registros (agencia_id, atualizado_em);

-- Mantém atualizado_em/por sempre do servidor (relógio do aparelho não manda).
create or replace function public.registros_carimbo() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;

create trigger registros_carimbo before insert or update on public.registros
for each row execute function public.registros_carimbo();

-- ------------------------------------------------------------------ --
-- Quem é quem (security definer: consultam membros sem cair na própria RLS)
-- ------------------------------------------------------------------ --

create or replace function public.sou_membro(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where agencia_id = a and user_id = auth.uid())
$$;

create or replace function public.sou_admin(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where agencia_id = a and user_id = auth.uid() and admin)
$$;

create or replace function public.vejo_financeiro(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where agencia_id = a and user_id = auth.uid() and (financeiro or admin))
$$;

-- Tipos de registro que só quem tem Financeiro enxerga.
create or replace function public.tipo_financeiro(t text) returns boolean
language sql immutable as $$ select t in ('transacao', 'cobranca') $$;

-- ------------------------------------------------------------------ --
-- RLS
-- ------------------------------------------------------------------ --

alter table public.agencias enable row level security;
alter table public.membros enable row level security;
alter table public.convites enable row level security;
alter table public.registros enable row level security;

create policy agencias_ler on public.agencias for select using (public.sou_membro(id));
create policy agencias_renomear on public.agencias for update using (public.sou_admin(id)) with check (public.sou_admin(id));

create policy membros_ler on public.membros for select using (public.sou_membro(agencia_id));
-- Alterações de membros passam pelas funções abaixo (que validam admin e
-- impedem a agência de ficar sem administrador).

create policy convites_ler on public.convites for select using (public.sou_admin(agencia_id));
create policy convites_criar on public.convites for insert with check (public.sou_admin(agencia_id) and criado_por = auth.uid());
create policy convites_apagar on public.convites for delete using (public.sou_admin(agencia_id));

create policy registros_ler on public.registros for select
  using (public.sou_membro(agencia_id) and (not public.tipo_financeiro(tipo) or public.vejo_financeiro(agencia_id)));
create policy registros_criar on public.registros for insert
  with check (public.sou_membro(agencia_id) and (not public.tipo_financeiro(tipo) or public.vejo_financeiro(agencia_id)));
create policy registros_alterar on public.registros for update
  using (public.sou_membro(agencia_id) and (not public.tipo_financeiro(tipo) or public.vejo_financeiro(agencia_id)))
  with check (public.sou_membro(agencia_id) and (not public.tipo_financeiro(tipo) or public.vejo_financeiro(agencia_id)));

-- ------------------------------------------------------------------ --
-- Funções chamadas pelo app
-- ------------------------------------------------------------------ --

-- Cria a agência e põe quem criou como administrador com Financeiro.
create or replace function public.criar_agencia(p_nome text, p_meu_nome text, p_cargo text default 'Direção')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  nova uuid;
  meu_email text;
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Entre de novo.'; end if;
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Informe o nome da agência.'; end if;
  select email into meu_email from auth.users where id = auth.uid();
  insert into agencias (nome, criada_por) values (trim(p_nome), auth.uid()) returning id into nova;
  insert into membros (agencia_id, user_id, nome, email, cargo, admin, financeiro)
  values (nova, auth.uid(), coalesce(nullif(trim(p_meu_nome), ''), split_part(meu_email, '@', 1)), meu_email,
          coalesce(nullif(trim(p_cargo), ''), 'Direção'), true, true);
  return nova;
end $$;

-- Mostra de qual agência é um convite (a tela de convite abre antes do login).
create or replace function public.ver_convite(p_token text)
returns table (agencia text, cargo text, valido boolean)
language sql stable security definer set search_path = public as $$
  select a.nome, c.cargo, (c.usado_em is null and c.expira_em > now())
  from convites c join agencias a on a.id = c.agencia_id
  where c.token = p_token
$$;

-- Entra na agência pelo convite. Cada convite vale para uma pessoa.
create or replace function public.aceitar_convite(p_token text, p_nome text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c convites%rowtype;
  meu_email text;
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Entre de novo.'; end if;
  select * into c from convites where token = p_token for update;
  if not found then raise exception 'Convite não encontrado.'; end if;
  if exists (select 1 from membros where agencia_id = c.agencia_id and user_id = auth.uid()) then
    return c.agencia_id;
  end if;
  if c.usado_em is not null then raise exception 'Este convite já foi usado. Peça um novo ao administrador.'; end if;
  if c.expira_em <= now() then raise exception 'Este convite expirou. Peça um novo ao administrador.'; end if;
  select email into meu_email from auth.users where id = auth.uid();
  insert into membros (agencia_id, user_id, nome, email, cargo, admin, financeiro)
  values (c.agencia_id, auth.uid(), coalesce(nullif(trim(p_nome), ''), split_part(meu_email, '@', 1)), meu_email,
          c.cargo, c.admin, c.financeiro);
  update convites set usado_por = auth.uid(), usado_em = now() where token = p_token;
  return c.agencia_id;
end $$;

-- Garante que sobra pelo menos um administrador.
create or replace function public.checar_ultimo_admin(a uuid, saindo uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from membros where agencia_id = a and admin and user_id <> saindo) then
    raise exception 'A agência precisa de pelo menos um administrador.';
  end if;
end $$;

create or replace function public.definir_permissoes(p_agencia uuid, p_user uuid, p_admin boolean, p_financeiro boolean, p_cargo text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_admin(p_agencia) then raise exception 'Só administradores mudam permissões.'; end if;
  if not p_admin then perform public.checar_ultimo_admin(p_agencia, p_user); end if;
  update membros set admin = p_admin, financeiro = p_financeiro, cargo = coalesce(nullif(trim(p_cargo), ''), cargo)
  where agencia_id = p_agencia and user_id = p_user;
end $$;

create or replace function public.remover_membro(p_agencia uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user <> auth.uid() and not public.sou_admin(p_agencia) then
    raise exception 'Só administradores removem pessoas da equipe.';
  end if;
  if exists (select 1 from membros where agencia_id = p_agencia and user_id = p_user and admin) then
    perform public.checar_ultimo_admin(p_agencia, p_user);
  end if;
  delete from membros where agencia_id = p_agencia and user_id = p_user;
end $$;

-- Cada um ajusta o próprio nome, cor e cargo.
create or replace function public.atualizar_perfil(p_agencia uuid, p_nome text, p_cor text, p_cargo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update membros set
    nome = coalesce(nullif(trim(p_nome), ''), nome),
    cor = coalesce(nullif(trim(p_cor), ''), cor),
    cargo = coalesce(nullif(trim(p_cargo), ''), cargo)
  where agencia_id = p_agencia and user_id = auth.uid();
end $$;

revoke all on function public.criar_agencia(text, text, text) from public, anon;
revoke all on function public.aceitar_convite(text, text) from public, anon;
revoke all on function public.definir_permissoes(uuid, uuid, boolean, boolean, text) from public, anon;
revoke all on function public.remover_membro(uuid, uuid) from public, anon;
revoke all on function public.atualizar_perfil(uuid, text, text, text) from public, anon;
revoke all on function public.checar_ultimo_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.criar_agencia(text, text, text) to authenticated;
grant execute on function public.aceitar_convite(text, text) to authenticated;
grant execute on function public.definir_permissoes(uuid, uuid, boolean, boolean, text) to authenticated;
grant execute on function public.remover_membro(uuid, uuid) to authenticated;
grant execute on function public.atualizar_perfil(uuid, text, text, text) to authenticated;
grant execute on function public.ver_convite(text) to anon, authenticated;

-- ------------------------------------------------------------------ --
-- Tempo real
-- ------------------------------------------------------------------ --

alter publication supabase_realtime add table public.registros;
alter publication supabase_realtime add table public.membros;
alter table public.registros replica identity full;
alter table public.membros replica identity full;

-- ------------------------------------------------------------------ --
-- Arquivos (imagens e vídeos anexados): pasta por agência
-- ------------------------------------------------------------------ --

insert into storage.buckets (id, name, public, file_size_limit)
values ('midia', 'midia', true, 52428800)
on conflict (id) do nothing;

create policy midia_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'midia' and public.sou_membro(((storage.foldername(name))[1])::uuid));
create policy midia_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'midia' and public.sou_membro(((storage.foldername(name))[1])::uuid));
