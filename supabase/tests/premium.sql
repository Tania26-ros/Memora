\set ON_ERROR_STOP 0
-- Prueba de los créditos Premium. Se corre después de las migraciones.
do $$ begin if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if; end $$;
grant usage on schema public to service_role;
grant execute on function public.premium_charge(uuid, text, integer, integer) to service_role;
grant execute on function public.premium_finish(bigint, integer, integer) to service_role;
grant execute on function public.premium_refund(bigint) to service_role;
-- Como en Supabase: la app tiene permisos de tabla y RLS decide qué filas.
grant select, insert, update, delete on all tables in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','dani@x') on conflict do nothing;

-- El dueño regala 25 créditos.
select public.premium_grant('DANI@x', 25) as dani_saldo;

-- Dani no puede darse créditos ni cobrar desde la app.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d1',false);
update premium_wallets set credits = 9999;
select public.premium_grant('dani@x', 1000);
select public.premium_refund(1);
select credits as dani_ve_su_saldo from premium_wallets;
reset role;

-- El servidor cobra 10 (queda 15), termina bien; cobra 10 (queda 5) y falla: se devuelve (vuelve a 15).
set role service_role;
select public.premium_charge('00000000-0000-0000-0000-0000000000d1', 'resumen', 10, 3) as uso1 \gset
select public.premium_finish(:uso1, 1200, 300);
select public.premium_charge('00000000-0000-0000-0000-0000000000d1', 'preguntas', 10, 3) as uso2 \gset
select public.premium_refund(:uso2);
select public.premium_refund(:uso2);  -- devolver dos veces no da créditos extra
-- Sin saldo suficiente: error.
select public.premium_charge('00000000-0000-0000-0000-0000000000d1', 'resumen', 50, 3);
-- Límite diario (3): ya hay 1 uso válido; 2 más pasan, el 4.º falla.
select public.premium_charge('00000000-0000-0000-0000-0000000000d1', 'dialogo', 5, 3);
select public.premium_charge('00000000-0000-0000-0000-0000000000d1', 'dialogo', 5, 3);
select public.premium_charge('00000000-0000-0000-0000-0000000000d1', 'dialogo', 5, 3);
reset role;
select credits as dani_final from premium_wallets;  -- esperado: 5
select action, credits, status, input_tokens from premium_usage order by id;
