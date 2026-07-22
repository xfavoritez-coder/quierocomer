-- ============================================================
-- English Tenses Practice System
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS english_tense_levels (
  id TEXT PRIMARY KEY,
  name_es TEXT NOT NULL,
  order_num INT NOT NULL,
  unlock_threshold INT NOT NULL DEFAULT 20
);

CREATE TABLE IF NOT EXISTS english_tense_sentences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  level_id TEXT NOT NULL REFERENCES english_tense_levels(id),
  sentence_es TEXT NOT NULL,
  sentence_en TEXT NOT NULL,
  order_num INT NOT NULL
);

CREATE TABLE IF NOT EXISTS english_tense_progress (
  level_id TEXT PRIMARY KEY REFERENCES english_tense_levels(id),
  total_correct INT NOT NULL DEFAULT 0,
  total_attempts INT NOT NULL DEFAULT 0,
  is_unlocked BOOLEAN NOT NULL DEFAULT false,
  mastered_at TIMESTAMPTZ NULL
);

-- ============================================================
-- LEVELS
-- ============================================================
INSERT INTO english_tense_levels (id, name_es, order_num, unlock_threshold) VALUES
  ('present-simple',   'Present Simple',     1, 20),
  ('past-simple',      'Past Simple',         2, 20),
  ('future',           'Future (will / going to)', 3, 20),
  ('present-continuous','Present Continuous', 4, 20),
  ('past-continuous',  'Past Continuous',     5, 20),
  ('present-perfect',  'Present Perfect',     6, 20),
  ('past-perfect',     'Past Perfect',        7, 20)
ON CONFLICT (id) DO NOTHING;

-- Level 1 is unlocked by default
INSERT INTO english_tense_progress (level_id, is_unlocked) VALUES ('present-simple', true)
ON CONFLICT (level_id) DO NOTHING;

-- ============================================================
-- LEVEL 1 — Present Simple
-- ============================================================
INSERT INTO english_tense_sentences (level_id, sentence_es, sentence_en, order_num) VALUES
('present-simple','Como desayuno todos los días.','I eat breakfast every day.',1),
('present-simple','Ella trabaja en un hospital.','She works in a hospital.',2),
('present-simple','Vivimos cerca del centro.','We live near downtown.',3),
('present-simple','Él no habla español.','He doesn''t speak Spanish.',4),
('present-simple','No tengo mucho tiempo.','I don''t have much time.',5),
('present-simple','¿Hablas inglés?','Do you speak English?',6),
('present-simple','¿A qué hora llega ella?','What time does she arrive?',7),
('present-simple','Me gusta el café por la mañana.','I like coffee in the morning.',8),
('present-simple','Él siempre llega tarde.','He always arrives late.',9),
('present-simple','No comemos carne.','We don''t eat meat.',10),
('present-simple','¿Dónde trabajas?','Where do you work?',11),
('present-simple','Ella estudia medicina.','She studies medicine.',12),
('present-simple','El tren sale a las ocho.','The train leaves at eight.',13),
('present-simple','No entiendo el problema.','I don''t understand the problem.',14),
('present-simple','¿Vive él solo?','Does he live alone?',15),
('present-simple','Corro tres veces a la semana.','I run three times a week.',16),
('present-simple','Ella no tiene hermanos.','She doesn''t have any siblings.',17),
('present-simple','¿Cuánto cuesta?','How much does it cost?',18),
('present-simple','Trabajamos de lunes a viernes.','We work from Monday to Friday.',19),
('present-simple','Él bebe mucha agua.','He drinks a lot of water.',20),
('present-simple','No sé la respuesta.','I don''t know the answer.',21),
('present-simple','¿Qué comes normalmente?','What do you usually eat?',22),
('present-simple','Ella siempre llega a tiempo.','She always arrives on time.',23),
('present-simple','No dormimos bien.','We don''t sleep well.',24),
('present-simple','¿Te gusta la música?','Do you like music?',25),
('present-simple','Él maneja al trabajo todos los días.','He drives to work every day.',26),
('present-simple','No recuerdo su nombre.','I don''t remember his name.',27),
('present-simple','¿Cuándo empieza la clase?','When does the class start?',28),
('present-simple','Ella lee mucho.','She reads a lot.',29),
('present-simple','No me importa.','I don''t care.',30);

-- ============================================================
-- LEVEL 2 — Past Simple (verbos irregulares integrados)
-- ============================================================
INSERT INTO english_tense_sentences (level_id, sentence_es, sentence_en, order_num) VALUES
('past-simple','Fui al mercado ayer.','I went to the market yesterday.',1),
('past-simple','Ella comió pizza anoche.','She ate pizza last night.',2),
('past-simple','Compramos una casa el año pasado.','We bought a house last year.',3),
('past-simple','Él no fue a la fiesta.','He didn''t go to the party.',4),
('past-simple','¿Viste esa película?','Did you see that movie?',5),
('past-simple','Me desperté tarde esta mañana.','I woke up late this morning.',6),
('past-simple','Ella me dijo la verdad.','She told me the truth.',7),
('past-simple','No traje mi billetera.','I didn''t bring my wallet.',8),
('past-simple','¿A qué hora llegaste?','What time did you arrive?',9),
('past-simple','Tomé un taxi al aeropuerto.','I took a taxi to the airport.',10),
('past-simple','Él encontró las llaves.','He found the keys.',11),
('past-simple','No supe qué decir.','I didn''t know what to say.',12),
('past-simple','¿Entendiste lo que dijo?','Did you understand what he said?',13),
('past-simple','Ella dejó su trabajo.','She left her job.',14),
('past-simple','Dormí ocho horas anoche.','I slept eight hours last night.',15),
('past-simple','No tuve tiempo de llamarte.','I didn''t have time to call you.',16),
('past-simple','¿Cómo te sentiste después?','How did you feel afterwards?',17),
('past-simple','Él me dio su número.','He gave me his number.',18),
('past-simple','Corrí cinco kilómetros esta mañana.','I ran five kilometers this morning.',19),
('past-simple','Ella no vino a la reunión.','She didn''t come to the meeting.',20),
('past-simple','¿Qué pensaste del partido?','What did you think of the game?',21),
('past-simple','Pagué la cuenta.','I paid the bill.',22),
('past-simple','No encontré mi teléfono.','I didn''t find my phone.',23),
('past-simple','¿Hablaste con él?','Did you speak to him?',24),
('past-simple','Ella hizo la cena anoche.','She made dinner last night.',25),
('past-simple','Perdí mis llaves esta mañana.','I lost my keys this morning.',26),
('past-simple','No bebí alcohol en la fiesta.','I didn''t drink alcohol at the party.',27),
('past-simple','¿Escuchaste las noticias?','Did you hear the news?',28),
('past-simple','Me senté en la primera fila.','I sat in the front row.',29),
('past-simple','Ella escribió un mensaje largo.','She wrote a long message.',30);

-- ============================================================
-- LEVEL 3 — Future (will / going to)
-- ============================================================
INSERT INTO english_tense_sentences (level_id, sentence_es, sentence_en, order_num) VALUES
('future','Te llamaré mañana.','I will call you tomorrow.',1),
('future','Ella va a viajar la próxima semana.','She''s going to travel next week.',2),
('future','Creo que va a llover.','I think it''s going to rain.',3),
('future','No voy a comer eso.','I''m not going to eat that.',4),
('future','¿Me ayudarás?','Will you help me?',5),
('future','Vamos a llegar tarde.','We''re going to be late.',6),
('future','No sé si iré.','I don''t know if I will go.',7),
('future','¿Qué vas a hacer este fin de semana?','What are you going to do this weekend?',8),
('future','Lo haré después.','I will do it later.',9),
('future','Ella no va a venir a la fiesta.','She''s not going to come to the party.',10),
('future','¿Cuándo volverás?','When will you come back?',11),
('future','Voy a pedir pizza.','I''m going to order pizza.',12),
('future','Prometo que no lo haré de nuevo.','I promise I won''t do it again.',13),
('future','¿Vas a hablar con él?','Are you going to talk to him?',14),
('future','Será un día largo.','It will be a long day.',15),
('future','No voy a mentirte.','I''m not going to lie to you.',16),
('future','¿Lo terminarás hoy?','Will you finish it today?',17),
('future','Vamos a necesitar más tiempo.','We''re going to need more time.',18),
('future','Te lo enviaré por correo.','I will send it to you by email.',19),
('future','Ella va a tener un bebé.','She''s going to have a baby.',20),
('future','No creo que funcione.','I don''t think it will work.',21),
('future','¿Van a mudarse?','Are they going to move?',22),
('future','Lo intentaré otra vez.','I will try again.',23),
('future','No voy a esperar más.','I''m not going to wait anymore.',24),
('future','¿Quién pagará la cuenta?','Who will pay the bill?',25),
('future','Vamos a empezar sin ellos.','We''re going to start without them.',26),
('future','No lo haré sin tu permiso.','I won''t do it without your permission.',27),
('future','¿Vas a estudiar esta noche?','Are you going to study tonight?',28),
('future','Habrá mucho tráfico.','There will be a lot of traffic.',29),
('future','No voy a rendirme.','I''m not going to give up.',30);

-- ============================================================
-- LEVEL 4 — Present Continuous
-- ============================================================
INSERT INTO english_tense_sentences (level_id, sentence_es, sentence_en, order_num) VALUES
('present-continuous','Estoy trabajando ahora mismo.','I am working right now.',1),
('present-continuous','Ella está almorzando.','She is eating lunch.',2),
('present-continuous','No estamos escuchando.','We are not listening.',3),
('present-continuous','¿Estás durmiendo?','Are you sleeping?',4),
('present-continuous','Él está hablando por teléfono.','He is talking on the phone.',5),
('present-continuous','Está lloviendo afuera.','It is raining outside.',6),
('present-continuous','No estoy bromeando.','I am not joking.',7),
('present-continuous','¿Qué estás haciendo?','What are you doing?',8),
('present-continuous','Estamos esperando el bus.','We are waiting for the bus.',9),
('present-continuous','Ella no está viniendo.','She is not coming.',10),
('present-continuous','¿Por qué están gritando?','Why are they shouting?',11),
('present-continuous','Estoy tratando de concentrarme.','I am trying to concentrate.',12),
('present-continuous','Él está aprendiendo a cocinar.','He is learning to cook.',13),
('present-continuous','No nos está yendo bien.','We are not doing well.',14),
('present-continuous','¿Está funcionando el internet?','Is the internet working?',15),
('present-continuous','Estoy pensando en ti.','I am thinking about you.',16),
('present-continuous','Ella está buscando trabajo.','She is looking for a job.',17),
('present-continuous','No estoy comiendo bien últimamente.','I am not eating well lately.',18),
('present-continuous','¿Qué están construyendo ahí?','What are they building there?',19),
('present-continuous','Él está corriendo en el parque.','He is running in the park.',20),
('present-continuous','Estoy ahorrando para un viaje.','I am saving for a trip.',21),
('present-continuous','No están respondiendo mis mensajes.','They are not answering my messages.',22),
('present-continuous','¿Estás tomando suficiente agua?','Are you drinking enough water?',23),
('present-continuous','Ella está leyendo un libro.','She is reading a book.',24),
('present-continuous','Estamos viviendo con mis padres.','We are living with my parents.',25),
('present-continuous','No está funcionando como esperaba.','It is not working as expected.',26),
('present-continuous','¿Estás bromeando?','Are you kidding?',27),
('present-continuous','El equipo está ganando.','The team is winning.',28),
('present-continuous','No estoy entendiendo nada.','I am not understanding anything.',29),
('present-continuous','¿Con quién estás hablando?','Who are you talking to?',30);

-- ============================================================
-- LEVEL 5 — Past Continuous
-- ============================================================
INSERT INTO english_tense_sentences (level_id, sentence_es, sentence_en, order_num) VALUES
('past-continuous','Estaba viendo TV cuando llamaste.','I was watching TV when you called.',1),
('past-continuous','Ella estaba durmiendo a las 10pm.','She was sleeping at 10pm.',2),
('past-continuous','No estábamos trabajando ayer en la tarde.','We weren''t working yesterday afternoon.',3),
('past-continuous','¿Qué estabas haciendo anoche?','What were you doing last night?',4),
('past-continuous','Él estaba comiendo cuando llegué.','He was eating when I arrived.',5),
('past-continuous','Estaba pensando en ti.','I was thinking about you.',6),
('past-continuous','No estaba escuchando, lo siento.','I wasn''t listening, sorry.',7),
('past-continuous','¿Estabas trabajando hasta tarde?','Were you working late?',8),
('past-continuous','Estábamos esperando el resultado.','We were waiting for the result.',9),
('past-continuous','Ella no estaba diciendo la verdad.','She wasn''t telling the truth.',10),
('past-continuous','¿Por qué estabas llorando?','Why were you crying?',11),
('past-continuous','Estaba corriendo cuando empezó a llover.','I was running when it started to rain.',12),
('past-continuous','Él estaba hablando con alguien.','He was talking to someone.',13),
('past-continuous','No estábamos planeando quedarnos.','We weren''t planning to stay.',14),
('past-continuous','¿Estaban discutiendo?','Were they arguing?',15),
('past-continuous','Me caí mientras estaba corriendo.','I fell while I was running.',16),
('past-continuous','Ella estaba trabajando en un proyecto importante.','She was working on an important project.',17),
('past-continuous','No estaba buscando eso.','I wasn''t looking for that.',18),
('past-continuous','¿Estabas durmiendo cuando llegué?','Were you sleeping when I arrived?',19),
('past-continuous','Estábamos hablando de ti.','We were talking about you.',20),
('past-continuous','Él estaba manejando demasiado rápido.','He was driving too fast.',21),
('past-continuous','No estaba prestando atención.','I wasn''t paying attention.',22),
('past-continuous','¿Qué estaban haciendo en la reunión?','What were they doing at the meeting?',23),
('past-continuous','Estaba cocinando cuando me llamaste.','I was cooking when you called me.',24),
('past-continuous','Ella estaba llorando cuando la vi.','She was crying when I saw her.',25),
('past-continuous','No estábamos esperando eso.','We weren''t expecting that.',26),
('past-continuous','¿Estabas bromeando o hablando en serio?','Were you joking or being serious?',27),
('past-continuous','Estaba leyendo cuando se fue la luz.','I was reading when the power went out.',28),
('past-continuous','Él estaba viviendo en Santiago ese año.','He was living in Santiago that year.',29),
('past-continuous','No estaba tratando de molestar.','I wasn''t trying to bother anyone.',30);

-- ============================================================
-- LEVEL 6 — Present Perfect
-- ============================================================
INSERT INTO english_tense_sentences (level_id, sentence_es, sentence_en, order_num) VALUES
('present-perfect','Ya he comido.','I have already eaten.',1),
('present-perfect','¿Alguna vez has estado en Chile?','Have you ever been to Chile?',2),
('present-perfect','Ella nunca ha visto esa película.','She has never seen that movie.',3),
('present-perfect','Hemos estado aquí por tres horas.','We have been here for three hours.',4),
('present-perfect','No he dormido bien últimamente.','I haven''t slept well lately.',5),
('present-perfect','¿Has hablado con él?','Have you spoken to him?',6),
('present-perfect','Acabo de terminar.','I have just finished.',7),
('present-perfect','Ella ha trabajado aquí por diez años.','She has worked here for ten years.',8),
('present-perfect','No hemos comido nada hoy.','We haven''t eaten anything today.',9),
('present-perfect','¿Has visto mis llaves?','Have you seen my keys?',10),
('present-perfect','He vivido en tres países diferentes.','I have lived in three different countries.',11),
('present-perfect','Ella no ha llegado todavía.','She hasn''t arrived yet.',12),
('present-perfect','¿Cuántas veces has viajado a Europa?','How many times have you traveled to Europe?',13),
('present-perfect','He perdido mi teléfono.','I have lost my phone.',14),
('present-perfect','No hemos tomado una decisión todavía.','We haven''t made a decision yet.',15),
('present-perfect','¿Ya has desayunado?','Have you had breakfast yet?',16),
('present-perfect','Él ha mejorado mucho.','He has improved a lot.',17),
('present-perfect','Nunca he probado el sushi.','I have never tried sushi.',18),
('present-perfect','¿Han llegado los invitados?','Have the guests arrived?',19),
('present-perfect','He estado pensando en eso.','I have been thinking about that.',20),
('present-perfect','Ella ha cambiado mucho.','She has changed a lot.',21),
('present-perfect','No he podido dormir.','I haven''t been able to sleep.',22),
('present-perfect','¿Has escuchado las noticias?','Have you heard the news?',23),
('present-perfect','Hemos ganado el partido.','We have won the game.',24),
('present-perfect','No he tenido tiempo.','I haven''t had time.',25),
('present-perfect','¿Has comido alguna vez comida chilena?','Have you ever eaten Chilean food?',26),
('present-perfect','Él se ha ido.','He has left.',27),
('present-perfect','No he visto esa película todavía.','I haven''t seen that movie yet.',28),
('present-perfect','¿Qué has hecho hoy?','What have you done today?',29),
('present-perfect','Hemos conocido gente increíble.','We have met amazing people.',30);

-- ============================================================
-- LEVEL 7 — Past Perfect
-- ============================================================
INSERT INTO english_tense_sentences (level_id, sentence_es, sentence_en, order_num) VALUES
('past-perfect','Ya me había ido cuando él llegó.','I had already left when he arrived.',1),
('past-perfect','Ella no había comido antes de la reunión.','She hadn''t eaten before the meeting.',2),
('past-perfect','¿Habías estado allí antes?','Had you been there before?',3),
('past-perfect','No sabía que ya habían llegado.','I didn''t know they had already arrived.',4),
('past-perfect','Él había vivido en Londres por años.','He had lived in London for years.',5),
('past-perfect','No habíamos dormido bien esa noche.','We hadn''t slept well that night.',6),
('past-perfect','¿Habías visto esa película antes?','Had you seen that movie before?',7),
('past-perfect','Ella ya había terminado cuando llegué.','She had already finished when I arrived.',8),
('past-perfect','No había entendido la pregunta.','I hadn''t understood the question.',9),
('past-perfect','¿Habías hablado con él antes?','Had you spoken to him before?',10),
('past-perfect','Cuando llegué, ya se habían ido.','When I arrived, they had already left.',11),
('past-perfect','Nunca había visto tanta gente.','I had never seen so many people.',12),
('past-perfect','¿Habías comido allí antes?','Had you eaten there before?',13),
('past-perfect','Ella había trabajado toda la noche.','She had worked all night.',14),
('past-perfect','No habíamos esperado eso.','We hadn''t expected that.',15),
('past-perfect','¿Habías intentado llamarlo?','Had you tried to call him?',16),
('past-perfect','Cuando lo encontré, ya lo había perdido todo.','When I found him, he had already lost everything.',17),
('past-perfect','No había dormido en dos días.','I hadn''t slept in two days.',18),
('past-perfect','¿Habías conocido a alguien así antes?','Had you ever met anyone like that before?',19),
('past-perfect','Ella había dicho que vendría.','She had said she would come.',20),
('past-perfect','No habíamos tenido tiempo de prepararnos.','We hadn''t had time to prepare.',21),
('past-perfect','¿Habías manejado antes en la nieve?','Had you ever driven in the snow before?',22),
('past-perfect','Cuando llegamos, ya había empezado.','When we arrived, it had already started.',23),
('past-perfect','No había pensado en eso.','I hadn''t thought about that.',24),
('past-perfect','¿Qué había pasado antes de que llegaras?','What had happened before you arrived?',25),
('past-perfect','Ella ya había tomado una decisión.','She had already made a decision.',26),
('past-perfect','No habíamos hablado en años.','We hadn''t spoken in years.',27),
('past-perfect','¿Le habías dicho la verdad?','Had you told him the truth?',28),
('past-perfect','Él había comprado el boleto semanas antes.','He had bought the ticket weeks before.',29),
('past-perfect','No habíamos terminado cuando llegó el jefe.','We hadn''t finished when the boss arrived.',30);
