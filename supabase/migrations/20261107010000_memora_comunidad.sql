-- ─────────────────────────────────────────────────────────────
-- Memora · Etapa 6: comunidad, competencias y créditos.
--
-- Reglas de seguridad (RLS):
--  • Juegos públicos: los ve cualquiera con cuenta. Privados: solo su autor
--    (o quien tenga el código, a través de game_by_code).
--  • Los créditos NO se pueden editar directamente: solo cambian con las
--    funciones de abajo (security definer), que dejan registro.
--  • En una competencia, todos los participantes ven las reglas de todos
--    (transparencia del modo moderador) y la tabla de resultados.
-- ─────────────────────────────────────────────────────────────

-- ── Créditos ─────────────────────────────────────────────────
create table if not exists public.wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  credits integer not null default 0 check (credits >= 0)
);
alter table public.wallets enable row level security;
create policy "Veo mis créditos" on public.wallets for select to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.credit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists credit_events_user_idx on public.credit_events (user_id, created_at desc);
alter table public.credit_events enable row level security;
create policy "Veo mi historial" on public.credit_events for select to authenticated using ((select auth.uid()) = user_id);

-- Mueve créditos y deja registro. Solo la usan otras funciones.
create or replace function public._add_credits(p_user uuid, p_amount integer, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.wallets (user_id, credits) values (p_user, 0) on conflict (user_id) do nothing;
  update public.wallets set credits = credits + p_amount where user_id = p_user;
  insert into public.credit_events (user_id, amount, reason) values (p_user, p_amount, p_reason);
end $$;
revoke all on function public._add_credits(uuid, integer, text) from public, anon, authenticated;

-- Crea el perfil la primera vez (con 50 créditos de bienvenida) o cambia el nombre.
create or replace function public.ensure_profile(p_name text)
returns table (display_name text, credits integer)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Necesitas entrar con tu cuenta'; end if;
  insert into public.profiles (id, display_name) values (uid, left(coalesce(nullif(trim(p_name), ''), 'Estudiante'), 40))
  on conflict (id) do update set display_name = coalesce(nullif(left(trim(p_name), 40), ''), public.profiles.display_name);
  if not exists (select 1 from public.wallets w where w.user_id = uid) then
    perform public._add_credits(uid, 50, 'Bienvenida a Memora');
  end if;
  return query select p.display_name, w.credits from public.profiles p join public.wallets w on w.user_id = p.id where p.id = uid;
end $$;

-- ── Juegos compartidos ───────────────────────────────────────
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null default 'Estudiante',
  title text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 300),
  is_public boolean not null default false,
  join_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 300),
  question_count integer generated always as (jsonb_array_length(questions)) stored,
  plays integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists games_public_idx on public.games (is_public, created_at desc);
alter table public.games enable row level security;
create policy "Ver juegos públicos o míos" on public.games for select to authenticated using (is_public or owner = (select auth.uid()));
create policy "Publicar mis juegos" on public.games for insert to authenticated with check (owner = (select auth.uid()));
create policy "Editar mis juegos" on public.games for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "Borrar mis juegos" on public.games for delete to authenticated using (owner = (select auth.uid()));

-- Juego privado: se abre con su código.
create or replace function public.game_by_code(p_code text)
returns setof public.games language sql security definer set search_path = '' stable as $$
  select * from public.games where join_code = upper(trim(p_code)) and auth.uid() is not null;
$$;

-- Alguien juega o copia un juego: +1 jugada y +1 crédito para el autor (una vez por persona).
create table if not exists public.game_plays (
  game_id uuid references public.games (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  primary key (game_id, user_id)
);
alter table public.game_plays enable row level security;

create or replace function public.record_play(p_game uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); g public.games;
begin
  select * into g from public.games where id = p_game;
  if g.id is null or uid is null or g.owner = uid then return; end if;
  insert into public.game_plays (game_id, user_id) values (p_game, uid) on conflict do nothing;
  if found then
    update public.games set plays = plays + 1 where id = p_game;
    perform public._add_credits(g.owner, 1, 'Alguien jugó «' || g.title || '»');
  end if;
end $$;

-- ── Competencias en línea ────────────────────────────────────
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  host uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  study_minutes integer not null default 0 check (study_minutes between 0 and 60),
  seconds integer not null default 20 check (seconds between 0 and 300),
  hints boolean not null default false,
  moderated boolean not null default false,
  prizes integer[] not null default '{0,0,0}' check (array_length(prizes, 1) = 3 and 0 <= all (prizes)),
  closes_at timestamptz not null default now() + interval '1 day',
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.challenges enable row level security;

create table if not exists public.challenge_players (
  challenge_id uuid references public.challenges (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  display_name text not null,
  seconds integer not null,
  hints boolean not null,
  points integer,
  correct integer,
  time_spent numeric(8, 1),
  hints_used integer,
  finished_at timestamptz,
  place integer,
  primary key (challenge_id, user_id)
);
alter table public.challenge_players enable row level security;

-- ¿Participo (o soy anfitrión) en esta competencia?
create or replace function public.in_challenge(p_challenge uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.challenges c where c.id = p_challenge and c.host = auth.uid())
      or exists (select 1 from public.challenge_players p where p.challenge_id = p_challenge and p.user_id = auth.uid());
$$;

create policy "Ver mis competencias" on public.challenges for select to authenticated using (public.in_challenge(id));
create policy "Ver a los participantes" on public.challenge_players for select to authenticated using (public.in_challenge(challenge_id));

-- Crear una competencia. Los premios salen de los créditos del anfitrión.
create or replace function public.create_challenge(p_game uuid, p_title text, p_study integer, p_seconds integer, p_hints boolean, p_moderated boolean, p_prizes integer[], p_hours integer)
returns public.challenges language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pool integer := coalesce(p_prizes[1], 0) + coalesce(p_prizes[2], 0) + coalesce(p_prizes[3], 0); c public.challenges;
begin
  if uid is null then raise exception 'Necesitas entrar con tu cuenta'; end if;
  if not exists (select 1 from public.games g where g.id = p_game and (g.is_public or g.owner = uid)) then raise exception 'Ese juego no existe o es privado'; end if;
  if pool > 0 then
    if (select credits from public.wallets where user_id = uid) < pool then raise exception 'No tienes créditos suficientes para esos premios'; end if;
    perform public._add_credits(uid, -pool, 'Premios de la competencia «' || p_title || '»');
  end if;
  insert into public.challenges (game_id, host, title, study_minutes, seconds, hints, moderated, prizes, closes_at)
  values (p_game, uid, left(p_title, 80), p_study, p_seconds, p_hints, p_moderated, p_prizes, now() + make_interval(hours => greatest(1, least(p_hours, 24 * 14))))
  returning * into c;
  return c;
end $$;

-- Unirse con el código. Empieza con las reglas generales; el moderador puede cambiarlas.
create or replace function public.join_challenge(p_code text, p_name text)
returns public.challenges language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c public.challenges;
begin
  select * into c from public.challenges where code = upper(trim(p_code));
  if c.id is null then raise exception 'No hay ninguna competencia con ese código'; end if;
  if c.closed or c.closes_at < now() then raise exception 'Esa competencia ya terminó'; end if;
  insert into public.challenge_players (challenge_id, user_id, display_name, seconds, hints)
  values (c.id, uid, left(coalesce(nullif(trim(p_name), ''), 'Estudiante'), 40), c.seconds, c.hints)
  on conflict (challenge_id, user_id) do nothing;
  return c;
end $$;

-- Modo moderador: el anfitrión da tiempo o pistas a un jugador (antes de que juegue).
create or replace function public.set_player_rules(p_challenge uuid, p_user uuid, p_seconds integer, p_hints boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.challenges where id = p_challenge and host = auth.uid() and moderated) then raise exception 'Solo el moderador puede cambiar las reglas'; end if;
  update public.challenge_players set seconds = greatest(0, least(p_seconds, 300)), hints = p_hints
  where challenge_id = p_challenge and user_id = p_user and finished_at is null;
end $$;

-- Enviar el resultado (una sola vez). Se rechazan resultados imposibles.
create or replace function public.submit_result(p_challenge uuid, p_points integer, p_correct integer, p_time numeric, p_hints integer)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); total integer; c public.challenges;
begin
  select * into c from public.challenges where id = p_challenge;
  if c.id is null or c.closed or c.closes_at < now() then raise exception 'La competencia ya terminó'; end if;
  select question_count into total from public.games where id = c.game_id;
  if p_correct < 0 or p_correct > total or p_points < 0 or p_points > total * 250 or p_time < 0 or p_hints < 0 or p_hints > total then
    raise exception 'Resultado no válido';
  end if;
  update public.challenge_players set points = p_points, correct = p_correct, time_spent = p_time, hints_used = p_hints, finished_at = now()
  where challenge_id = p_challenge and user_id = uid and finished_at is null;
  if not found then raise exception 'Ya enviaste tu resultado o no estás en esta competencia'; end if;
end $$;

-- Cerrar: puestos (más puntos; empate → menos tiempo) y premios a los 3 primeros.
create or replace function public.close_challenge(p_challenge uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.challenges; r record; leftover integer; amount integer;
begin
  select * into c from public.challenges where id = p_challenge for update;
  if c.id is null then raise exception 'No existe'; end if;
  if c.closed then return; end if;
  if c.host <> auth.uid() and c.closes_at > now() then raise exception 'Solo el anfitrión puede cerrarla antes de tiempo'; end if;
  update public.challenge_players p set place = x.place
  from (select user_id, rank() over (order by points desc, time_spent asc) as place from public.challenge_players where challenge_id = p_challenge and finished_at is not null) x
  where p.challenge_id = p_challenge and p.user_id = x.user_id;
  leftover := c.prizes[1] + c.prizes[2] + c.prizes[3];
  for r in select user_id, place from public.challenge_players where challenge_id = p_challenge and place between 1 and 3 order by place, finished_at loop
    -- Con empates nunca se reparte más de lo que puso el anfitrión.
    amount := least(c.prizes[r.place], leftover);
    if amount > 0 then
      perform public._add_credits(r.user_id, amount, 'Puesto ' || r.place || ' en «' || c.title || '»');
      leftover := leftover - amount;
    end if;
  end loop;
  -- Si no hubo suficientes jugadores, los premios sobrantes vuelven al anfitrión.
  if leftover > 0 then perform public._add_credits(c.host, leftover, 'Devolución de premios de «' || c.title || '»'); end if;
  update public.challenges set closed = true where id = p_challenge;
end $$;

-- Preguntas de una competencia (aunque el juego sea privado), solo para quien participa.
create or replace function public.challenge_game(p_challenge uuid)
returns setof public.games language sql security definer set search_path = '' stable as $$
  select g.* from public.games g join public.challenges c on c.game_id = g.id
  where c.id = p_challenge and public.in_challenge(p_challenge);
$$;
