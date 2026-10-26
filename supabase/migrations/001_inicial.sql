-- Crônicas de Mesa: esquema inicial
-- Rode este arquivo inteiro no Supabase em SQL Editor > New query > Run.
--
-- Modelo: cada campanha tem um Mestre (quem criou) e jogadores que entram por código
-- de convite. As regras de acesso (RLS) garantem que jogadores só leiam o que o Mestre
-- liberou: NPCs descobertos (sem a descrição verdadeira) e links públicos ou liberados.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (char_length(username) between 2 and 30),
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  gm_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default 'Nova Campanha',
  description text not null default '',
  fields jsonb not null default '[]'::jsonb,
  currencies jsonb not null default '[]'::jsonb,
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('GM', 'PLAYER')),
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table public.npcs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  public_description text not null default '',
  category text not null default 'HOSTILE' check (category in ('FRIENDLY', 'HOSTILE', 'DECEPTIVE')),
  stats jsonb not null default '{"hp":{"current":10,"max":10},"mp":{"current":0,"max":0}}'::jsonb,
  discovered_by text[] not null default '{}', -- usernames dos jogadores que conhecem o NPC
  created_at timestamptz not null default now()
);

-- Separado de npcs para que jogadores nunca recebam a descrição verdadeira
create table public.npc_secrets (
  npc_id uuid primary key references public.npcs (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  description text not null default '',
  notes text
);

create table public.links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null,
  category text not null check (category in ('MAP', 'DOC', 'DISCORD', 'OTHER')),
  type text not null check (type in ('EXTERNAL', 'INTERNAL')),
  url text,
  content text,
  is_public boolean not null default true,
  visible_to text[] not null default '{}', -- usernames com acesso
  created_at timestamptz not null default now()
);

create table public.session_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  author_name text not null default '',
  data jsonb not null default '{}'::jsonb,
  summary text,
  created_at timestamptz not null default now()
);

create index on public.campaign_members (user_id);
create index on public.npcs (campaign_id);
create index on public.links (campaign_id);
create index on public.session_logs (campaign_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Funções auxiliares (security definer para não cair em recursão de RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaign_members where campaign_id = c and user_id = auth.uid());
$$;

create or replace function public.is_gm(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from campaigns where id = c and gm_id = auth.uid());
$$;

create or replace function public.my_username() returns text
language sql stable security definer set search_path = public as $$
  select username from profiles where id = auth.uid();
$$;

create or replace function public.shares_campaign(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from campaign_members a
    join campaign_members b on a.campaign_id = b.campaign_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- Usado no cadastro, antes de existir sessão
create or replace function public.username_available(name text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where lower(username) = lower(trim(name)));
$$;

-- Entrar numa campanha pelo código de convite
create or replace function public.join_campaign(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  select id into c from campaigns where invite_code = upper(trim(code));
  if c is null then
    raise exception 'Código de convite inválido';
  end if;
  insert into campaign_members (campaign_id, user_id, role)
  values (c, auth.uid(), 'PLAYER')
  on conflict do nothing;
  return c;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gatilhos
-- ---------------------------------------------------------------------------

-- Cria o perfil quando alguém se cadastra (username vem dos metadados do cadastro)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'username'), ''), split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quem cria a campanha vira Mestre dela
create or replace function public.handle_new_campaign() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into campaign_members (campaign_id, user_id, role) values (new.id, new.gm_id, 'GM');
  return new;
end;
$$;

create trigger on_campaign_created
  after insert on public.campaigns
  for each row execute function public.handle_new_campaign();

-- O autor do registro é sempre quem está logado (não dá para se passar por outro)
create or replace function public.set_log_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_id := auth.uid();
  new.author_name := (select username from profiles where id = auth.uid());
  return new;
end;
$$;

create trigger on_session_log_insert
  before insert on public.session_logs
  for each row execute function public.set_log_author();

-- ---------------------------------------------------------------------------
-- Regras de acesso (RLS)
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.npcs enable row level security;
alter table public.npc_secrets enable row level security;
alter table public.links enable row level security;
alter table public.session_logs enable row level security;

create policy "ver perfis de quem joga comigo" on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_campaign(id));

-- gm_id = auth.uid() também, porque ao criar (insert ... returning) o Mestre ainda não é membro
create policy "membros veem a campanha" on public.campaigns
  for select to authenticated using (gm_id = auth.uid() or public.is_member(id));
create policy "qualquer um cria campanha como Mestre" on public.campaigns
  for insert to authenticated with check (gm_id = auth.uid());
create policy "Mestre altera a campanha" on public.campaigns
  for update to authenticated using (gm_id = auth.uid()) with check (gm_id = auth.uid());
create policy "Mestre apaga a campanha" on public.campaigns
  for delete to authenticated using (gm_id = auth.uid());

create policy "membros veem os membros" on public.campaign_members
  for select to authenticated using (public.is_member(campaign_id));
create policy "Mestre remove jogador ou jogador sai" on public.campaign_members
  for delete to authenticated using (public.is_gm(campaign_id) or (user_id = auth.uid() and role = 'PLAYER'));

create policy "Mestre vê todos os NPCs, jogador só os descobertos" on public.npcs
  for select to authenticated using (
    public.is_gm(campaign_id)
    or (public.is_member(campaign_id) and public.my_username() = any (discovered_by))
  );
create policy "Mestre cria NPCs" on public.npcs
  for insert to authenticated with check (public.is_gm(campaign_id));
create policy "Mestre altera NPCs" on public.npcs
  for update to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));
create policy "Mestre apaga NPCs" on public.npcs
  for delete to authenticated using (public.is_gm(campaign_id));

create policy "só o Mestre acessa segredos" on public.npc_secrets
  for all to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));

create policy "Mestre vê todos os links, jogador só os liberados" on public.links
  for select to authenticated using (
    public.is_gm(campaign_id)
    or (public.is_member(campaign_id) and (is_public or public.my_username() = any (visible_to)))
  );
create policy "Mestre cria links" on public.links
  for insert to authenticated with check (public.is_gm(campaign_id));
create policy "Mestre altera links" on public.links
  for update to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));
create policy "Mestre apaga links" on public.links
  for delete to authenticated using (public.is_gm(campaign_id));

create policy "membros veem os registros" on public.session_logs
  for select to authenticated using (public.is_member(campaign_id));
create policy "membros registram sessões" on public.session_logs
  for insert to authenticated with check (public.is_member(campaign_id));
create policy "autor ou Mestre apaga registro" on public.session_logs
  for delete to authenticated using (author_id = auth.uid() or public.is_gm(campaign_id));

-- ---------------------------------------------------------------------------
-- Tempo real: avisa os jogadores quando o Mestre muda algo e vice-versa
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.campaigns, public.campaign_members, public.npcs, public.links, public.session_logs;
