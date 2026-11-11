-- ─────────────────────────────────────────────────────────────
-- Memora · Etapa 7: Premium con IA (Claude).
--
-- Los créditos Premium son distintos de los créditos de la comunidad:
-- los de la comunidad se ganan jugando, y si sirvieran para la IA
-- alguien podría "fabricarlos" y gastar dinero real. Los Premium solo
-- los da el dueño de Memora (o, más adelante, un pago).
--
-- Nadie puede cambiar su saldo desde el celular: solo la función
-- "memora-ia" del servidor (con la clave service_role) cobra y devuelve.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.premium_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  credits integer not null default 0 check (credits >= 0)
);
alter table public.premium_wallets enable row level security;
create policy "Veo mis créditos Premium" on public.premium_wallets for select to authenticated using ((select auth.uid()) = user_id);

-- Cada uso de la IA: qué se pidió, cuánto costó y cuántos tokens usó.
create table if not exists public.premium_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  credits integer not null,
  input_tokens integer,
  output_tokens integer,
  status text not null default 'cobrado' check (status in ('cobrado', 'listo', 'devuelto')),
  created_at timestamptz not null default now()
);
create index if not exists premium_usage_user_idx on public.premium_usage (user_id, created_at desc);
alter table public.premium_usage enable row level security;
create policy "Veo mis usos Premium" on public.premium_usage for select to authenticated using ((select auth.uid()) = user_id);

-- Cobra antes de llamar a la IA. Falla si no alcanza el saldo o si ya se
-- usó demasiado hoy (protege contra gastos inesperados).
create or replace function public.premium_charge(p_user uuid, p_action text, p_credits integer, p_daily_limit integer)
returns bigint language plpgsql security definer set search_path = '' as $$
declare usage_id bigint; used_today integer;
begin
  if p_credits < 0 then raise exception 'Costo inválido'; end if;
  select count(*) into used_today from public.premium_usage
    where user_id = p_user and status <> 'devuelto' and created_at > now() - interval '1 day';
  if used_today >= p_daily_limit then
    raise exception 'Llegaste al límite de % usos de IA por día. Vuelve mañana.', p_daily_limit;
  end if;
  update public.premium_wallets set credits = credits - p_credits
    where user_id = p_user and credits >= p_credits;
  if not found then raise exception 'No tienes créditos Premium suficientes'; end if;
  insert into public.premium_usage (user_id, action, credits) values (p_user, p_action, p_credits)
    returning id into usage_id;
  return usage_id;
end $$;

-- Marca el uso como terminado y guarda los tokens (para saber el costo real).
create or replace function public.premium_finish(p_usage bigint, p_input integer, p_output integer)
returns void language sql security definer set search_path = '' as $$
  update public.premium_usage set status = 'listo', input_tokens = p_input, output_tokens = p_output
    where id = p_usage and status = 'cobrado';
$$;

-- Si la IA falla, se devuelven los créditos (una sola vez).
create or replace function public.premium_refund(p_usage bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare u record;
begin
  update public.premium_usage set status = 'devuelto' where id = p_usage and status = 'cobrado'
    returning user_id, credits into u;
  if found then
    update public.premium_wallets set credits = credits + u.credits where user_id = u.user_id;
  end if;
end $$;

-- Para que el dueño regale o venda créditos desde el editor SQL de Supabase:
--   select public.premium_grant('correo@ejemplo.com', 100);
create or replace function public.premium_grant(p_email text, p_credits integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare uid uuid; total integer;
begin
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'No hay ninguna cuenta con el correo %', p_email; end if;
  insert into public.premium_wallets (user_id, credits) values (uid, 0) on conflict (user_id) do nothing;
  update public.premium_wallets set credits = greatest(0, credits + p_credits) where user_id = uid
    returning credits into total;
  return total;
end $$;

-- Ninguna de estas funciones se puede llamar desde la app: solo el servidor.
revoke all on function public.premium_charge(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.premium_finish(bigint, integer, integer) from public, anon, authenticated;
revoke all on function public.premium_refund(bigint) from public, anon, authenticated;
revoke all on function public.premium_grant(text, integer) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.premium_charge(uuid, text, integer, integer) to service_role;
    grant execute on function public.premium_finish(bigint, integer, integer) to service_role;
    grant execute on function public.premium_refund(bigint) to service_role;
  end if;
end $$;
