-- Crônicas de Mesa: esquema inicial
-- Rode este arquivo inteiro no SQL Editor do Supabase (ou via `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Perfis (nome de usuário público, ligado ao usuário do Supabase Auth)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null check (char_length(username) between 2 and 32),
  created_at timestamptz not null default now()
);

create unique index profiles_username_unique on public.profiles (lower(username));

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
begin
  -- Usa o nome escolhido no cadastro; se faltar ou já existir, gera uma variação
  -- (o app já confere antes, isto só evita que o cadastro falhe)
  base := left(coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1)), 28);
  if base is null or char_length(base) < 2 then
    base := 'aventureiro';
  end if;
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    candidate := base || '_' || substr(md5(random()::text), 1, 3);
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usado na tela de cadastro antes de criar a conta
create function public.username_available(name text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(trim(name)));
$$;

-- ---------------------------------------------------------------------------
-- Campanhas e membros
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Nova Campanha',
  description text not null default '',
  fields jsonb not null default '[]',
  currencies jsonb not null default '[]',
  gm_id uuid not null default auth.uid() references auth.users on delete cascade,
  invite_code text not null unique default upper(encode(gen_random_bytes(4), 'hex')),
  created_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('GM', 'PLAYER')),
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

-- Funções auxiliares (security definer para não cair em recursão de RLS)
create function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.campaign_members where campaign_id = cid and user_id = auth.uid());
$$;

create function public.is_gm(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.campaigns where id = cid and gm_id = auth.uid());
$$;

create function public.my_username() returns text
language sql stable security definer set search_path = public as $$
  select username from public.profiles where id = auth.uid();
$$;

-- Quem cria a campanha vira o Mestre dela
create function public.handle_new_campaign() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.campaign_members (campaign_id, user_id, role) values (new.id, new.gm_id, 'GM');
  return new;
end $$;

create trigger on_campaign_created
  after insert on public.campaigns
  for each row execute function public.handle_new_campaign();

-- Jogadores entram pelo código de convite
create function public.join_campaign(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  select id into cid from public.campaigns where invite_code = upper(trim(code));
  if cid is null then
    raise exception 'Código de convite inválido';
  end if;
  insert into public.campaign_members (campaign_id, user_id, role)
  values (cid, auth.uid(), 'PLAYER')
  on conflict do nothing;
  return cid;
end $$;

-- ---------------------------------------------------------------------------
-- NPCs: a parte pública fica em npcs, a verdade do Mestre em npc_secrets
-- ---------------------------------------------------------------------------
create table public.npcs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns on delete cascade,
  name text not null,
  public_description text not null default '',
  category text not null default 'HOSTILE' check (category in ('FRIENDLY', 'HOSTILE', 'DECEPTIVE')),
  stats jsonb not null default '{}',
  discovered_by text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.npc_secrets (
  npc_id uuid primary key references public.npcs on delete cascade,
  campaign_id uuid not null references public.campaigns on delete cascade,
  description text not null default '',
  notes text
);

-- ---------------------------------------------------------------------------
-- Links, mapas e documentos
-- ---------------------------------------------------------------------------
create table public.campaign_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns on delete cascade,
  title text not null,
  category text not null default 'OTHER',
  type text not null default 'EXTERNAL',
  url text,
  content text,
  is_public boolean not null default true,
  visible_to text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Registros de sessão
-- ---------------------------------------------------------------------------
create table public.session_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns on delete cascade,
  author_id uuid not null default auth.uid() references auth.users on delete cascade,
  author text not null,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}',
  summary text
);

create index on public.npcs (campaign_id);
create index on public.npc_secrets (campaign_id);
create index on public.campaign_links (campaign_id);
create index on public.session_logs (campaign_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.npcs enable row level security;
alter table public.npc_secrets enable row level security;
alter table public.campaign_links enable row level security;
alter table public.session_logs enable row level security;

create policy "perfis visíveis para usuários logados" on public.profiles
  for select to authenticated using (true);

create policy "membros veem a campanha" on public.campaigns
  for select to authenticated using (public.is_member(id));
create policy "qualquer um cria campanha como mestre" on public.campaigns
  for insert to authenticated with check (gm_id = auth.uid());
create policy "mestre edita a campanha" on public.campaigns
  for update to authenticated using (gm_id = auth.uid()) with check (gm_id = auth.uid());
create policy "mestre apaga a campanha" on public.campaigns
  for delete to authenticated using (gm_id = auth.uid());

create policy "membros veem os membros" on public.campaign_members
  for select to authenticated using (public.is_member(campaign_id));
create policy "sair da campanha ou mestre remove jogador" on public.campaign_members
  for delete to authenticated using (
    (user_id = auth.uid() and role = 'PLAYER') or (public.is_gm(campaign_id) and role = 'PLAYER')
  );

create policy "mestre vê tudo, jogador só NPCs descobertos" on public.npcs
  for select to authenticated using (
    public.is_gm(campaign_id)
    or (public.is_member(campaign_id) and public.my_username() = any(discovered_by))
  );
create policy "mestre cria NPCs" on public.npcs
  for insert to authenticated with check (public.is_gm(campaign_id));
create policy "mestre edita NPCs" on public.npcs
  for update to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));
create policy "mestre apaga NPCs" on public.npcs
  for delete to authenticated using (public.is_gm(campaign_id));

create policy "só o mestre acessa segredos" on public.npc_secrets
  for all to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));

create policy "links visíveis conforme permissão" on public.campaign_links
  for select to authenticated using (
    public.is_gm(campaign_id)
    or (public.is_member(campaign_id) and (is_public or public.my_username() = any(visible_to)))
  );
create policy "mestre cria links" on public.campaign_links
  for insert to authenticated with check (public.is_gm(campaign_id));
create policy "mestre edita links" on public.campaign_links
  for update to authenticated using (public.is_gm(campaign_id)) with check (public.is_gm(campaign_id));
create policy "mestre apaga links" on public.campaign_links
  for delete to authenticated using (public.is_gm(campaign_id));

create policy "membros leem os registros" on public.session_logs
  for select to authenticated using (public.is_member(campaign_id));
create policy "membro registra a própria sessão" on public.session_logs
  for insert to authenticated with check (
    public.is_member(campaign_id) and author_id = auth.uid() and author = public.my_username()
  );
create policy "autor ou mestre apaga registro" on public.session_logs
  for delete to authenticated using (author_id = auth.uid() or public.is_gm(campaign_id));

-- ---------------------------------------------------------------------------
-- Tempo real: o app recarrega a campanha quando algo muda
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.campaigns, public.campaign_members, public.npcs, public.npc_secrets,
  public.campaign_links, public.session_logs;
