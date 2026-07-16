import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/)[1];
const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/) ?.[1];
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY="([^"]+)"/)[1];

const supabase = createClient(url, serviceKey || anonKey);

const updates = [
  { phrase_en: 'through', example_en: 'We went through a really tough time together', example_es: 'Pasamos por un momento muy difícil juntos' },
  { phrase_en: 'acetaminophen', example_en: 'Take some acetaminophen and get some rest', example_es: 'Toma acetaminofén y descansa un poco' },
  { phrase_en: 'patience', example_en: 'Learning a language requires a lot of patience', example_es: 'Aprender un idioma requiere mucha paciencia' },
  { phrase_en: 'trust', example_en: 'I trust you completely, so just tell me the truth', example_es: 'Confío en ti completamente, así que solo dime la verdad' },
  { phrase_en: 'appreciate', example_en: "I really appreciate everything you've done for me", example_es: 'Realmente aprecio todo lo que has hecho por mí' },
  { phrase_en: 'foreign', example_en: 'She speaks two foreign languages fluently', example_es: 'Ella habla dos idiomas extranjeros con fluidez' },
  { phrase_en: 'grateful', example_en: "I'm so grateful for the life I have", example_es: 'Estoy muy agradecido por la vida que tengo' },
  { phrase_en: 'rescue', example_en: 'The firefighters came to rescue the people', example_es: 'Los bomberos vinieron a rescatar a las personas' },
  { phrase_en: 'women', example_en: 'There were many talented women at the conference', example_es: 'Había muchas mujeres talentosas en la conferencia' },
  { phrase_en: 'discover', example_en: 'How did you discover this place? I love it', example_es: '¿Cómo descubriste este lugar? Me encanta' },
  { phrase_en: 'uploaded', example_en: 'I already uploaded the video to the site', example_es: 'Ya subí el video al sitio' },
  { phrase_en: 'jewel', example_en: 'She bought a beautiful jewel for the ceremony', example_es: 'Ella compró una joya hermosa para la ceremonia' },
  { phrase_en: 'huge', example_en: 'This opportunity is huge for our business', example_es: 'Esta oportunidad es enorme para nuestro negocio' },
  { phrase_en: 'yet', example_en: "Are you ready yet? We're going to be late", example_es: '¿Ya estás listo? Vamos a llegar tarde' },
  { phrase_en: 'already', example_en: 'I already finished the report this morning', example_es: 'Ya terminé el reporte esta mañana' },
  { phrase_en: 'not yet', example_en: "I'm not yet ready to make that decision", example_es: 'Todavía no estoy listo para tomar esa decisión' },
  { phrase_en: 'even', example_en: "She didn't even say goodbye when she left", example_es: 'Ni siquiera dijo adiós cuando se fue' },
  { phrase_en: 'not even', example_en: "I can't not even remember his name right now", example_es: 'Ni siquiera puedo recordar su nombre ahora mismo' },
  { phrase_en: 'while', example_en: "I'll make dinner while you take a shower", example_es: 'Voy a preparar la cena mientras te duchas' },
  { phrase_en: 'go through', example_en: 'Did the payment go through? I need to confirm', example_es: '¿Se procesó el pago? Necesito confirmar' },
  { phrase_en: 'get through', example_en: 'I finally got through to customer support', example_es: 'Finalmente me pude comunicar con soporte al cliente' },
  { phrase_en: 'come through', example_en: "Don't worry, she always comes through for us", example_es: 'No te preocupes, ella siempre cumple con nosotros' },
  { phrase_en: 'pull through', example_en: 'He was very sick but managed to pull through', example_es: 'Estaba muy enfermo pero logró recuperarse' },
  { phrase_en: 'look through', example_en: 'Can you look through these documents for me?', example_es: '¿Puedes revisar estos documentos para mí?' },
  { phrase_en: 'put away', example_en: "Can you put away the groceries when you're done?", example_es: '¿Puedes guardar las compras cuando termines?' },
  { phrase_en: 'get up', example_en: 'I need to get up early tomorrow for the meeting', example_es: 'Necesito levantarme temprano mañana para la reunión' },
  { phrase_en: 'wake up', example_en: 'I wake up at 7 every day without an alarm', example_es: 'Me despierto a las 7 todos los días sin alarma' },
  { phrase_en: 'ASAP', example_en: 'Please send me those files ASAP', example_es: 'Por favor envíame esos archivos lo antes posible' },
  { phrase_en: 'as soon as', example_en: "As soon as I arrive, I'll give you a call", example_es: 'Apenas llegue, te llamo' },
  { phrase_en: 'You owe me', example_en: 'You owe me a coffee from last week, remember?', example_es: 'Me debes un café de la semana pasada, ¿recuerdas?' },
  { phrase_en: 'I owe you', example_en: 'I owe you one for covering my shift last night', example_es: 'Te debo una por cubrir mi turno anoche' },
  { phrase_en: "That's why", example_en: "I was tired, that's why I left the party early", example_es: 'Estaba cansado, por eso me fui de la fiesta temprano' },
  { phrase_en: 'I make sure', example_en: 'I always make sure everything is ready before the meeting', example_es: 'Siempre me aseguro de que todo esté listo antes de la reunión' },
  { phrase_en: "We're screwed", example_en: "The client canceled last minute — we're screwed", example_es: 'El cliente canceló a último momento — estamos jodidos' },
  { phrase_en: 'a lot of', example_en: 'There are a lot of people here tonight', example_es: 'Hay mucha gente aquí esta noche' },
  { phrase_en: 'dish rack', example_en: 'Put the dishes on the dish rack to dry', example_es: 'Pon los platos en el escurridor para que se sequen' },
  { phrase_en: 'I was gonna', example_en: 'I was gonna call you but I totally forgot', example_es: 'Iba a llamarte pero se me olvidó por completo' },
];

const newCards = [
  { phrase_en: 'by the way', phrase_es: 'por cierto / a propósito', notes: 'Se usa para cambiar de tema o agregar info casual', example_en: 'By the way, did you hear about the new restaurant downtown?', example_es: 'Por cierto, ¿escuchaste sobre el nuevo restaurante del centro?' },
  { phrase_en: 'actually', phrase_es: 'en realidad / de hecho', pronunciation_hint: 'AK-choo-uh-lee', notes: 'Corrige una suposición o agrega algo sorpresivo', example_en: 'I thought it was closed, but actually it opens at noon', example_es: 'Pensé que estaba cerrado, pero en realidad abre al mediodía' },
  { phrase_en: 'never mind', phrase_es: 'no importa / olvídalo / déjalo', notes: 'Para cancelar lo que dijiste o quitarle importancia', example_en: "Can you help me with— never mind, I figured it out", example_es: '¿Puedes ayudarme con— no importa, ya lo resolví' },
  { phrase_en: 'kind of', phrase_es: 'más o menos / algo así / un poco', notes: 'Suaviza lo que dices, como "medio" en español informal', example_en: "It's kind of hard to explain, but I'll try", example_es: 'Es medio difícil de explicar, pero voy a intentarlo' },
  { phrase_en: 'worth it', phrase_es: 'vale la pena', notes: 'Algo que justifica el esfuerzo, el costo o el tiempo', example_en: 'The trip was expensive but totally worth it', example_es: 'El viaje fue caro pero totalmente valió la pena' },
  { phrase_en: 'end up', phrase_es: 'terminar haciendo / acabar', notes: 'Resultado inesperado o cómo termina una situación', example_en: 'We ended up staying there until midnight', example_es: 'Terminamos quedándonos ahí hasta la medianoche' },
  { phrase_en: 'give up', phrase_es: 'rendirse / darse por vencido', notes: 'Dejar de intentar algo', example_en: "Don't give up — you're almost there", example_es: 'No te rindas, ya casi llegas' },
  { phrase_en: 'figure out', phrase_es: 'entender / resolver / darse cuenta', notes: 'Entender algo que no era obvio, o encontrar la solución', example_en: 'I finally figured out how to fix the problem', example_es: 'Finalmente entendí cómo resolver el problema' },
  { phrase_en: 'deal with', phrase_es: 'lidiar con / ocuparse de / manejar', notes: 'Manejar una situación difícil o una persona complicada', example_en: "I don't know how you deal with that every day", example_es: 'No sé cómo lidias con eso todos los días' },
  { phrase_en: 'used to', phrase_es: 'solía / acostumbraba / antes + verbo', pronunciation_hint: 'YOOST-to', notes: 'Algo que hacías regularmente en el pasado pero ya no', example_en: 'I used to wake up at 5 AM when I was training', example_es: 'Solía levantarme a las 5 AM cuando estaba entrenando' },
  { phrase_en: 'supposed to', phrase_es: 'se supone que / debería / tenía que', notes: 'Lo que se espera que ocurra o lo que alguien debe hacer', example_en: "You're supposed to be here at 9, not 10", example_es: 'Se supone que deberías estar aquí a las 9, no a las 10' },
  { phrase_en: 'unless', phrase_es: 'a menos que / salvo que', notes: 'Condición negativa: introduce la única excepción', example_en: "I won't go unless you come with me", example_es: 'No voy a ir a menos que vengas conmigo' },
  { phrase_en: 'instead', phrase_es: 'en cambio / en lugar de eso', notes: 'Alternativa a algo que no se hizo o no se quiere hacer', example_en: "I didn't feel like coffee, so I had tea instead", example_es: 'No me apetecía café, así que tomé té en cambio' },
  { phrase_en: 'afford', phrase_es: 'poder pagar / permitirse / tener el presupuesto', pronunciation_hint: 'uh-FORD', notes: 'Tener el dinero, tiempo o posibilidad para algo', example_en: "I can't afford to travel right now", example_es: 'No puedo darme el lujo de viajar ahora mismo' },
  { phrase_en: 'catch up', phrase_es: 'ponerse al día / alcanzar / actualizarse', notes: 'Ponerse al día con alguien o con algo que se atrasó', example_en: "Let's grab lunch and catch up — it's been a while", example_es: 'Almorcemos y pongámonos al día, hace tiempo que no nos vemos' },
  { phrase_en: 'turn out', phrase_es: 'resultar / salir (de cierta manera) / terminar siendo', notes: 'Cómo termina o resulta algo, generalmente inesperado', example_en: 'It turned out to be a great night after all', example_es: 'Resultó ser una gran noche al final' },
];

let ok = 0, fail = 0;
for (const u of updates) {
  const { error } = await supabase.from('english_cards')
    .update({ example_en: u.example_en, example_es: u.example_es })
    .eq('phrase_en', u.phrase_en);
  if (error) { console.log('FAIL update:', u.phrase_en, error.message); fail++; }
  else ok++;
}
console.log(`Updates: ${ok} ok, ${fail} failed`);

const { error: insErr } = await supabase.from('english_cards').insert(newCards);
if (insErr) console.log('INSERT error:', insErr.message);
else console.log(`Inserted ${newCards.length} new cards`);
