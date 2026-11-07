\set ON_ERROR_STOP 0
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','ana@x'),('00000000-0000-0000-0000-00000000000b','beto@x'),('00000000-0000-0000-0000-00000000000c','caro@x');
set role authenticated;
-- Ana
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select * from ensure_profile('Ana');
update wallets set credits = 9999;  -- debe no cambiar nada (sin política de update)
select credits as ana_tras_hack from wallets;
insert into games (title, author_name, is_public, questions) values ('Célula', 'Ana', false, '[{"type":"tf","prompt":"x","correct":true},{"type":"tf","prompt":"y","correct":false}]') returning join_code \gset
select * from create_challenge((select id from games limit 1), 'Reto', 0, 20, false, true, '{20,10,5}', 24) \gset c_
select credits as ana_tras_premios from wallets;
-- Beto
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select * from ensure_profile('Beto');
select count(*) as beto_ve_juegos_privados from games;
select count(*) as beto_por_codigo from game_by_code(:'join_code');
select record_play((select id from game_by_code(:'join_code')));
select title from join_challenge(:'c_code', 'Beto');
select submit_result((select id from challenges limit 1), 999999, 2, 3.5, 0);  -- imposible
select submit_result((select id from challenges limit 1), 400, 2, 3.5, 0);
select submit_result((select id from challenges limit 1), 400, 2, 3.5, 0);  -- repetido
-- Caro
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select * from ensure_profile('Caro');
select title from join_challenge(:'c_code', 'Caro');
select set_player_rules((select id from challenges limit 1), auth.uid(), 300, true);  -- no es moderador
-- Ana modera: más tiempo para Caro
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select set_player_rules((select id from challenges limit 1), '00000000-0000-0000-0000-00000000000c', 60, true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',false);
select display_name, seconds, hints from challenge_players order by display_name;  -- Caro ve las reglas de todos
select submit_result((select id from challenges limit 1), 300, 2, 2.0, 1);
select close_challenge((select id from challenges limit 1));  -- Caro no puede cerrar antes
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a',false);
select close_challenge((select id from challenges limit 1));
reset role;
select p.display_name, p.place, w.credits from challenge_players p join wallets w using (user_id) order by place;
select pr.display_name, w.credits from profiles pr join wallets w on w.user_id = pr.id order by 1;
select plays from games;
-- Resultado esperado: Beto 1.º (70), Caro 2.º (60), Ana 21 (50 + 1 por jugada − 35 de premios + 5 devueltos).
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',false);
select count(*) as beto_ve_preguntas_de_la_competencia from challenge_game((select id from challenges limit 1));
reset role;
