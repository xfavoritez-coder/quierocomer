-- ============================================================
-- QuieroComer English Practice — Supabase Setup
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Tablas
create table if not exists english_cards (
  id uuid default gen_random_uuid() primary key,
  phrase_en text not null,
  phrase_es text not null,
  pronunciation_hint text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists english_progress (
  id uuid default gen_random_uuid() primary key,
  card_id uuid references english_cards(id) on delete cascade,
  direction text not null check (direction in ('en_to_es', 'es_to_en')),
  ease_factor float not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  next_review_at timestamptz not null default now(),
  unique(card_id, direction)
);

create table if not exists english_reviews (
  id uuid default gen_random_uuid() primary key,
  card_id uuid references english_cards(id) on delete cascade,
  direction text not null,
  quality int not null check (quality between 0 and 3),
  reviewed_at timestamptz default now()
);

-- 2. Seed: tus notas coleccionadas en EEUU
insert into english_cards (phrase_en, phrase_es, pronunciation_hint, notes) values

-- Pronunciación / vocabulario básico
('through', 'a través de / pasando', 'throo', null),
('acetaminophen', 'acetaminofén (paracetamol)', 'a-SEET-a-MIN-o-fen', null),
('patience', 'paciencia', 'PEI-shens', null),
('trust', 'confianza / confiar', 'trast', null),
('appreciate', 'apreciar / agradecer', 'uh-PREE-shee-ate', null),
('foreign', 'extranjero', 'FOR-en', null),
('grateful', 'agradecido', 'GRAYT-ful', null),
('rescue', 'rescate', 'RES-kyoo', null),
('women', 'mujeres', 'WIM-en', null),
('discover', 'descubrir', 'dis-KAV-er', null),
('uploaded', 'subido / cargado', 'UP-loh-ded', null),
('jewel', 'joya', 'JOO-ul', null),
('huge', 'enorme / gigante', 'hyooj', null),

-- yet / already (confundibles)
('yet', 'todavía / aún / ya (preguntas)', null, 'Are you ready yet? = ¿Ya estás listo? | Did you call him yet? = ¿Ya lo llamaste?'),
('already', 'ya (frases afirmativas)', null, 'I already ate = Ya comí. Diferente de "yet" que va en negativas y preguntas.'),
('not yet', 'todavía no / aún no', null, 'I haven''t eaten yet = Todavía no comí'),

-- even / not even
('even', 'incluso / hasta / ni (con not)', null, 'not even = ni siquiera'),
('not even', 'ni siquiera', null, 'I can''t even = ni siquiera puedo'),

-- while / while
('while', 'mientras', null, null),

-- Phrasal verbs — go/get/come/pull/look through
('go through', 'procesarse / concretarse / pasar por / revisar', null, 'Did the transfer go through? = ¿Se procesó el pago? | go through your files = revisar tus archivos'),
('get through', 'lograr comunicarse / superar / terminar', null, 'I finally got through to him = Finalmente me pude comunicar con él'),
('come through', 'cumplir / llegar / salir adelante', null, 'She always comes through = Ella siempre cumple'),
('pull through', 'recuperarse (de una enfermedad o crisis)', null, 'He pulled through after the surgery = Se recuperó de la cirugía'),
('look through', 'revisar / hojear', null, 'Look through these files = Revisá estos archivos'),
('put away', 'guardar algo / poner en su lugar', null, 'I''m folding my clothes to put them away = Estoy doblando la ropa para guardarla'),
('get up', 'levantarse', null, 'to get up vs wake up: wake up = despertarse, get up = levantarse de la cama'),
('wake up', 'despertarse', null, 'I wake up at 7 every day = Me despierto a las 7 todos los días'),

-- ASAP
('ASAP', 'lo antes posible / cuanto antes', 'EY-sap', 'as soon as possible'),
('as soon as', 'apenas / en cuanto / tan pronto como', null, 'As soon as I wake up = Apenas me despierto'),

-- I owe / you owe
('You owe me', 'Me debés / Me debes', 'óu como en oh', 'You owe me ten dollars = Me debés diez dólares'),
('I owe you', 'Te debo', null, 'I owe you one = Te debo una'),

-- Frases clásicas — preguntas y respuestas
('Did the transfer go through?', '¿Se procesó el pago? / ¿Llegó la transferencia?', null, null),
('Did you receive the money?', '¿Recibiste el dinero?', null, null),
('That''s why', 'Por eso', null, 'Also: "Because of that" = por eso mismo'),
('5 PM sounds good', '5 PM me funciona bien', null, 'Also: "5 PM works for me"'),
('Thank you for your patience and your trust', 'Gracias por tu paciencia y confianza', null, null),
('Thank you for your patience and for trusting me', 'Gracias por tu paciencia y confiar en mí', null, 'Más personal que la versión sin "me"'),
('I appreciate you trusting me', 'Aprecio que hayas confiado en mí', null, null),
('I really appreciate your help', 'Realmente aprecio tu ayuda', null, null),
('I''d really appreciate it if you could help me', 'Te agradecería mucho si pudieras ayudarme', null, null),
('What is this called?', '¿Cómo se llama esto?', 'called = KAWLD', null),
('I feel very grateful for the life I have', 'Me siento muy agradecido por la vida que tengo', null, null),
('Is it okay if I say it like that?', '¿Está bien si lo digo así?', null, null),
('Is that how you say it?', '¿Así se dice?', null, null),
('That''s how you say it', 'Así se dice', null, null),
('I''m not in a hurry', 'No tengo apuro / No tengo prisa', null, null),
('I''m in no rush', 'No tengo apuro (variante más enfática)', null, null),
('There''s no rush', 'No hay apuro (hablás de la situación, no de vos)', null, 'Útil cuando querés tranquilizar al otro'),
('Take your time, I''m not in a hurry', 'Tómate tu tiempo, yo no tengo apuro', null, null),
('She bought a beautiful jewel', 'Ella compró una joya hermosa', null, null),
('Just so I understand correctly, did you work there?', 'Solo para entender bien, ¿trabajaste ahí?', null, 'Phrase para pedir aclaración sin sonar rudo'),
('Why did you leave?', '¿Por qué te fuiste?', null, null),
('I''m in love with San Diego', 'Estoy enamorado de San Diego', null, null),
('How did you discover it?', '¿Cómo lo descubriste?', 'dis-KAV-erd', null),
('Do you come here often?', '¿Vienes seguido por acá?', null, null),
('I make sure', 'Me aseguro / Me encargo', null, 'I make sure everything is ready = Me aseguro de que todo esté listo'),
('We''re screwed', 'Estamos jodidos / Nos fue mal', 'skrood', null),
('Tipping is part of the wage here', 'Las propinas son parte del sueldo acá', null, null),
('I made a mistake', 'Cometí un error / Me equivoqué', null, 'Also: "That was my mistake"'),
('Why is it so expensive?', '¿Por qué es tan caro?', null, null),
('Can I give you a hug?', '¿Puedo darte un abrazo?', null, null),
('This house is huge!', '¡Esta casa es enorme!', null, null),
('Since I was a child', 'Desde que era niño/a', null, null),
('I''m kidding / I''m just kidding', 'Estoy bromeando / Es broma', null, null),
('Don''t kid me', 'No me tomes el pelo / No me bromees', null, null),
('I got my hair cut', 'Me corté el pelo / Fui a que me lo cortaran', null, 'Notar el "got": lo hiciste hacer, no lo hiciste vos mismo'),
('I got a bad haircut', 'Me cortaron mal el pelo', null, null),
('We gotta leave ASAP', 'Tenemos que irnos lo antes posible', null, 'gotta = have got to (informal)'),
('I''m doing good, man. How about you?', 'Estoy bien, man. ¿Y vos?', null, null),
('The house belongs to all of us', 'La casa nos pertenece a todos', null, null),
('I come in clutch', 'Salvo la situación justo cuando se necesita', null, '"Clutch" = decisivo en el momento crítico (término de gaming/deportes)'),
('I was gonna', 'Iba a... / Iba a hacer...', null, '"gonna" = going to (informal)'),
('Did you get high?', '¿Te pusiste pedo? / ¿Te drogaste?', null, null),
('Are you ready yet?', '¿Ya estás listo?', null, null),
('Did you call him yet?', '¿Ya lo llamaste?', null, null),
('I haven''t eaten yet', 'Todavía no comí', null, null),
('I already ate', 'Ya comí', null, null),
('As soon as I wake up', 'Apenas me despierto', null, null),
('Can you call me ASAP?', '¿Podés llamarme lo antes posible?', null, null),
('I''m folding my clothes to put them away', 'Estoy doblando la ropa para guardarla', null, null),
('dish rack', 'secador de platos / escurridor', null, null),
('You should be proud of yourself', 'Deberías estar orgulloso/a de vos mismo/a', null, null),
('I just need to speak more', 'Solo necesito hablar más', null, null),
('I went to the beach', 'Fui a la playa', null, null),
('Where were you?', '¿Dónde estabas?', null, null),
('There''s a woman who''s driving me crazy', 'Hay una mujer que me está volviendo loco', null, null),
('I returned it the next day', 'Lo devolví al día siguiente', null, null),
('You need to leave things running smoothly', 'Necesitás dejar las cosas funcionando bien', null, null),
('One day I''ll have a Tesla', 'Un día voy a tener un Tesla', null, null),
('On the beach I saw a lot of beautiful women', 'En la playa vi muchas mujeres hermosas', null, null),
('a lot of', 'mucho/muchos de', 'uh-LAT-uv', 'Se pronuncia como una sola palabra: "uh-LAT-uv"');
