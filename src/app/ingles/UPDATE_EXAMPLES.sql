-- ============================================================
-- Agregar example_en y example_es a tarjetas cortas
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- Palabras sueltas y expresiones cortas que necesitan contexto
UPDATE english_cards SET
  example_en = 'We went through a really tough time together',
  example_es = 'Pasamos por un momento muy difícil juntos'
WHERE phrase_en = 'through';

UPDATE english_cards SET
  example_en = 'Take some acetaminophen and get some rest',
  example_es = 'Toma acetaminofén y descansa un poco'
WHERE phrase_en = 'acetaminophen';

UPDATE english_cards SET
  example_en = 'Learning a language requires a lot of patience',
  example_es = 'Aprender un idioma requiere mucha paciencia'
WHERE phrase_en = 'patience';

UPDATE english_cards SET
  example_en = 'I trust you completely, so just tell me the truth',
  example_es = 'Confío en ti completamente, así que solo dime la verdad'
WHERE phrase_en = 'trust';

UPDATE english_cards SET
  example_en = 'I really appreciate everything you''ve done for me',
  example_es = 'Realmente aprecio todo lo que has hecho por mí'
WHERE phrase_en = 'appreciate';

UPDATE english_cards SET
  example_en = 'She speaks two foreign languages fluently',
  example_es = 'Ella habla dos idiomas extranjeros con fluidez'
WHERE phrase_en = 'foreign';

UPDATE english_cards SET
  example_en = 'I''m so grateful for the life I have',
  example_es = 'Estoy muy agradecido por la vida que tengo'
WHERE phrase_en = 'grateful';

UPDATE english_cards SET
  example_en = 'The firefighters came to rescue the people',
  example_es = 'Los bomberos vinieron a rescatar a las personas'
WHERE phrase_en = 'rescue';

UPDATE english_cards SET
  example_en = 'There were many talented women at the conference',
  example_es = 'Había muchas mujeres talentosas en la conferencia'
WHERE phrase_en = 'women';

UPDATE english_cards SET
  example_en = 'How did you discover this place? I love it',
  example_es = '¿Cómo descubriste este lugar? Me encanta'
WHERE phrase_en = 'discover';

UPDATE english_cards SET
  example_en = 'I already uploaded the video to the site',
  example_es = 'Ya subí el video al sitio'
WHERE phrase_en = 'uploaded';

UPDATE english_cards SET
  example_en = 'She bought a beautiful jewel for the ceremony',
  example_es = 'Ella compró una joya hermosa para la ceremonia'
WHERE phrase_en = 'jewel';

UPDATE english_cards SET
  example_en = 'This opportunity is huge for our business',
  example_es = 'Esta oportunidad es enorme para nuestro negocio'
WHERE phrase_en = 'huge';

UPDATE english_cards SET
  example_en = 'Are you ready yet? We''re going to be late',
  example_es = '¿Ya estás listo? Vamos a llegar tarde'
WHERE phrase_en = 'yet';

UPDATE english_cards SET
  example_en = 'I already finished the report this morning',
  example_es = 'Ya terminé el reporte esta mañana'
WHERE phrase_en = 'already';

UPDATE english_cards SET
  example_en = 'I''m not yet ready to make that decision',
  example_es = 'Todavía no estoy listo para tomar esa decisión'
WHERE phrase_en = 'not yet';

UPDATE english_cards SET
  example_en = 'She didn''t even say goodbye when she left',
  example_es = 'Ni siquiera dijo adiós cuando se fue'
WHERE phrase_en = 'even';

UPDATE english_cards SET
  example_en = 'I can''t not even remember his name right now',
  example_es = 'Ni siquiera puedo recordar su nombre ahora mismo'
WHERE phrase_en = 'not even';

UPDATE english_cards SET
  example_en = 'I''ll make dinner while you take a shower',
  example_es = 'Voy a preparar la cena mientras te duchas'
WHERE phrase_en = 'while';

UPDATE english_cards SET
  example_en = 'Did the payment go through? I need to confirm',
  example_es = '¿Se procesó el pago? Necesito confirmar'
WHERE phrase_en = 'go through';

UPDATE english_cards SET
  example_en = 'I finally got through to customer support',
  example_es = 'Finalmente me pude comunicar con soporte al cliente'
WHERE phrase_en = 'get through';

UPDATE english_cards SET
  example_en = 'Don''t worry, she always comes through for us',
  example_es = 'No te preocupes, ella siempre cumple con nosotros'
WHERE phrase_en = 'come through';

UPDATE english_cards SET
  example_en = 'He was very sick but managed to pull through',
  example_es = 'Estaba muy enfermo pero logró recuperarse'
WHERE phrase_en = 'pull through';

UPDATE english_cards SET
  example_en = 'Can you look through these documents for me?',
  example_es = '¿Puedes revisar estos documentos para mí?'
WHERE phrase_en = 'look through';

UPDATE english_cards SET
  example_en = 'Can you put away the groceries when you''re done?',
  example_es = '¿Puedes guardar las compras cuando termines?'
WHERE phrase_en = 'put away';

UPDATE english_cards SET
  example_en = 'I need to get up early tomorrow for the meeting',
  example_es = 'Necesito levantarme temprano mañana para la reunión'
WHERE phrase_en = 'get up';

UPDATE english_cards SET
  example_en = 'I wake up at 7 every day without an alarm',
  example_es = 'Me despierto a las 7 todos los días sin alarma'
WHERE phrase_en = 'wake up';

UPDATE english_cards SET
  example_en = 'Please send me those files ASAP',
  example_es = 'Por favor envíame esos archivos lo antes posible'
WHERE phrase_en = 'ASAP';

UPDATE english_cards SET
  example_en = 'As soon as I arrive, I''ll give you a call',
  example_es = 'Apenas llegue, te llamo'
WHERE phrase_en = 'as soon as';

UPDATE english_cards SET
  example_en = 'You owe me a coffee from last week, remember?',
  example_es = 'Me debes un café de la semana pasada, ¿recuerdas?'
WHERE phrase_en = 'You owe me';

UPDATE english_cards SET
  example_en = 'I owe you one for covering my shift last night',
  example_es = 'Te debo una por cubrir mi turno anoche'
WHERE phrase_en = 'I owe you';

UPDATE english_cards SET
  example_en = 'I was tired, that''s why I left the party early',
  example_es = 'Estaba cansado, por eso me fui de la fiesta temprano'
WHERE phrase_en = 'That''s why';

UPDATE english_cards SET
  example_en = 'I always make sure everything is ready before the meeting',
  example_es = 'Siempre me aseguro de que todo esté listo antes de la reunión'
WHERE phrase_en = 'I make sure';

UPDATE english_cards SET
  example_en = 'The client canceled last minute — we''re screwed',
  example_es = 'El cliente canceló a último momento — estamos jodidos'
WHERE phrase_en = 'We''re screwed';

UPDATE english_cards SET
  example_en = 'There are a lot of people here tonight',
  example_es = 'Hay mucha gente aquí esta noche'
WHERE phrase_en = 'a lot of';

UPDATE english_cards SET
  example_en = 'Put the dishes on the dish rack to dry',
  example_es = 'Pon los platos en el escurridor para que se sequen'
WHERE phrase_en = 'dish rack';

UPDATE english_cards SET
  example_en = 'I was gonna call you but I totally forgot',
  example_es = 'Iba a llamarte pero se me olvidó por completo'
WHERE phrase_en = 'I was gonna';

-- ============================================================
-- Nuevas frases — candidatos que faltaban
-- ============================================================

INSERT INTO english_cards (phrase_en, phrase_es, pronunciation_hint, notes, example_en, example_es) VALUES

('by the way',
 'por cierto / a propósito',
 null,
 'Se usa para cambiar de tema o agregar info casual',
 'By the way, did you hear about the new restaurant downtown?',
 'Por cierto, ¿escuchaste sobre el nuevo restaurante del centro?'),

('actually',
 'en realidad / de hecho',
 'AK-choo-uh-lee',
 'Corrige una suposición o agrega algo sorpresivo',
 'I thought it was closed, but actually it opens at noon',
 'Pensé que estaba cerrado, pero en realidad abre al mediodía'),

('never mind',
 'no importa / olvídalo / déjalo',
 null,
 'Para cancelar lo que dijiste o quitarle importancia',
 'Can you help me with— never mind, I figured it out',
 '¿Puedes ayudarme con— no importa, ya lo resolví'),

('kind of',
 'más o menos / algo así / un poco',
 null,
 'Suaviza lo que dices, como "medio" en español informal',
 'It''s kind of hard to explain, but I''ll try',
 'Es medio difícil de explicar, pero voy a intentarlo'),

('worth it',
 'vale la pena',
 null,
 'Algo que justifica el esfuerzo, el costo o el tiempo',
 'The trip was expensive but totally worth it',
 'El viaje fue caro pero totalmente valió la pena'),

('end up',
 'terminar haciendo / acabar',
 null,
 'Resultado inesperado o cómo termina una situación',
 'We ended up staying there until midnight',
 'Terminamos quedándonos ahí hasta la medianoche'),

('give up',
 'rendirse / darse por vencido',
 null,
 'Dejar de intentar algo',
 'Don''t give up — you''re almost there',
 'No te rindas, ya casi llegas'),

('figure out',
 'entender / resolver / darse cuenta',
 null,
 'Entender algo que no era obvio, o encontrar la solución',
 'I finally figured out how to fix the problem',
 'Finalmente entendí cómo resolver el problema'),

('deal with',
 'lidiar con / ocuparse de / manejar',
 null,
 'Manejar una situación difícil o una persona complicada',
 'I don''t know how you deal with that every day',
 'No sé cómo lidias con eso todos los días'),

('used to',
 'solía / acostumbraba / antes + verbo',
 'YOOST-to',
 'Algo que hacías regularmente en el pasado pero ya no',
 'I used to wake up at 5 AM when I was training',
 'Solía levantarme a las 5 AM cuando estaba entrenando'),

('supposed to',
 'se supone que / debería / tenía que',
 null,
 'Lo que se espera que ocurra o lo que alguien debe hacer',
 'You''re supposed to be here at 9, not 10',
 'Se supone que deberías estar aquí a las 9, no a las 10'),

('unless',
 'a menos que / salvo que',
 null,
 'Condición negativa: introduce la única excepción',
 'I won''t go unless you come with me',
 'No voy a ir a menos que vengas conmigo'),

('instead',
 'en cambio / en lugar de eso',
 null,
 'Alternativa a algo que no se hizo o no se quiere hacer',
 'I didn''t feel like coffee, so I had tea instead',
 'No me apetecía café, así que tomé té en cambio'),

('afford',
 'poder pagar / permitirse / tener el presupuesto',
 'uh-FORD',
 'Tener el dinero, tiempo o posibilidad para algo',
 'I can''t afford to travel right now',
 'No puedo darme el lujo de viajar ahora mismo'),

('catch up',
 'ponerse al día / alcanzar / actualizarse',
 null,
 'Ponerse al día con alguien o con algo que se atrasó',
 'Let''s grab lunch and catch up — it''s been a while',
 'Almorcemos y pongámonos al día, hace tiempo que no nos vemos'),

('turn out',
 'resultar / salir (de cierta manera) / terminar siendo',
 null,
 'Cómo termina o resulta algo, generalmente inesperado',
 'It turned out to be a great night after all',
 'Resultó ser una gran noche al final');
