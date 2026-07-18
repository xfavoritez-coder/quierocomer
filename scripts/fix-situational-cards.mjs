import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/)[1];
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/) ?.[1] || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY="([^"]+)"/)[1];
const sb = createClient(url, key);

// ── 1. DELETE: junk and duplicates ────────────────────────

// Cards to delete by their exact scenario example_es (old bad versions of dupes)
const deleteByExampleEs = [
  "Estás tratando de armar un mueble nuevo pero las instrucciones están confusas. Después de una hora, finalmente logras entender cómo va cada pieza.",
  "Llevas semanas intentando aprender a cocinar un plato complicado, pero cada intento sale mal. Finalmente decides que no vale la pena seguir intentando.",
  "Tu jefe te pide que resuelvas un problema con un cliente molesto. Sabes que será difícil, pero tienes que enfrentarlo.",
  "No has visto a tu amigo en meses. Cuando se encuentran, ambos quieren saber qué ha pasado en sus vidas durante todo ese tiempo.",
  "Había mucho tráfico camino a tu cita, así que pensabas que llegarías tarde. Sin embargo, todo resultó bien y llegaste a tiempo.",
  "Estabas a punto de hacer una pregunta pero decides que no es relevante en ese momento, así que cambias de idea.",
  "Tu colega te pregunta si entendiste la presentación técnica de hoy. La explicación fue confusa, así que tu respuesta es parcialmente afirmativa.",
];

// Cards to delete by phrase_en
const deleteByPhrase = [
  "I cooked a lot of food",
  "        Have you ever been to Japan?",  // leading spaces
  "I owe you one",                          // duplicate of "I owe you"
  "What do you mean?",                      // duplicate (uppercase)
];

console.log("Deleting bad versions...");
for (const ex of deleteByExampleEs) {
  const { error } = await sb.from('english_cards').delete().eq('example_es', ex);
  if (error) console.log('FAIL example_es:', ex.slice(0,40), error.message);
  else console.log('  deleted by example_es:', ex.slice(0, 40) + '...');
}
for (const ph of deleteByPhrase) {
  const { error } = await sb.from('english_cards').delete().eq('phrase_en', ph);
  if (error) console.log('FAIL phrase:', ph, error.message);
  else console.log('  deleted:', ph);
}

// ── 2. UPDATE: fix remaining cards with scenario example_es ────────────────

const fixes = [
  { phrase_en: 'show up',            phrase_es: 'aparecer / llegar / presentarse',          example_en: "He said he'd come but never showed up",         example_es: "Dijo que vendría pero nunca apareció" },
  { phrase_en: 'run out of',         phrase_es: 'quedarse sin',                              example_en: "We ran out of coffee this morning",               example_es: "Se nos acabó el café esta mañana" },
  { phrase_en: 'bring up',           phrase_es: 'mencionar / sacar un tema',                 example_en: "Why did you bring up that topic now?",            example_es: "¿Por qué sacaste ese tema ahora?" },
  { phrase_en: 'work out',           phrase_es: 'funcionar / resolverse / hacer ejercicio',  example_en: "We had a disagreement but worked it out",         example_es: "Tuvimos un desacuerdo pero lo resolvimos" },
  { phrase_en: 'come up with',       phrase_es: 'ocurrirse / idear / proponer',              example_en: "Can you come up with a better plan?",            example_es: "¿Se te puede ocurrir un plan mejor?" },
  { phrase_en: 'go ahead',           phrase_es: 'adelante / procede / hazlo',                example_en: "Go ahead, I'm listening",                        example_es: "Adelante, te escucho" },
  { phrase_en: 'hold on',            phrase_es: 'espera un momento / aguanta',               example_en: "Hold on, I'll be right back",                    example_es: "Espera, ya vuelvo" },
  { phrase_en: 'pick up',            phrase_es: 'recoger / levantar / buscar',               example_en: "Can you pick me up at the airport?",             example_es: "¿Puedes recogerme en el aeropuerto?" },
  { phrase_en: 'hang out',           phrase_es: 'pasar el rato / juntarse sin planes',       example_en: "Do you want to hang out this weekend?",          example_es: "¿Quieres pasar el rato este fin de semana?" },
  { phrase_en: 'make it',            phrase_es: 'lograrlo / llegar / poder ir',              example_en: "I don't think I can make it tonight",            example_es: "No creo que pueda ir esta noche" },
  { phrase_en: 'no worries',         phrase_es: 'no hay problema / tranquilo',               example_en: "Thanks for waiting — no worries at all",         example_es: "Gracias por esperar, no hay ningún problema" },
  { phrase_en: 'fair enough',        phrase_es: 'es razonable / tiene sentido',              example_en: "Fair enough, I understand your point",           example_es: "Es razonable, entiendo tu punto" },
  { phrase_en: 'that makes sense',   phrase_es: 'tiene sentido / lo entiendo',               example_en: "Oh, that makes sense now, thanks",               example_es: "Ah, ahora tiene sentido, gracias" },
  { phrase_en: "I'll get back to you", phrase_es: 'te respondo después / me comunico',       example_en: "I'll get back to you after the meeting",         example_es: "Te respondo después de la reunión" },
  { phrase_en: 'my bad',             phrase_es: 'fue mi culpa / la cagué',                   example_en: "My bad, I totally forgot to call you",           example_es: "Fue mi culpa, se me olvidó llamarte" },
  { phrase_en: "it's on me",         phrase_es: 'yo invito / corro con los gastos',          example_en: "Don't worry about the bill, it's on me",         example_es: "No te preocupes por la cuenta, yo invito" },
  { phrase_en: "I'm down",           phrase_es: 'me apunto / estoy / me copa',               example_en: "A movie tonight? I'm down",                      example_es: "¿Una peli esta noche? Me apunto" },
  { phrase_en: 'for real?',          phrase_es: '¿en serio? / ¿de verdad?',                  example_en: "You got the job? For real?",                     example_es: "¿Conseguiste el trabajo? ¿En serio?" },
  { phrase_en: 'I guess so',         phrase_es: 'supongo que sí / creo que sí',              example_en: "Is it a good idea? I guess so",                  example_es: "¿Es buena idea? Supongo que sí" },
  { phrase_en: 'to be honest',       phrase_es: 'para ser honesto / la verdad es que',       example_en: "To be honest, I didn't like the movie",          example_es: "Para ser honesto, la película no me gustó" },
  { phrase_en: 'long story short',   phrase_es: 'en resumen / para no hacer el cuento largo', example_en: "Long story short, we missed the flight",        example_es: "En resumen, perdimos el vuelo" },
  { phrase_en: 'at the end of the day', phrase_es: 'al final del día / en definitiva',       example_en: "At the end of the day, it's your decision",      example_es: "Al final del día, es tu decisión" },
  { phrase_en: 'no big deal',        phrase_es: 'no es para tanto / no importa',             example_en: "It's no big deal, don't worry about it",         example_es: "No es para tanto, no te preocupes" },
  { phrase_en: "I can't make it",    phrase_es: 'no voy a poder ir / no puedo llegar',       example_en: "I can't make it to dinner tonight",              example_es: "No voy a poder ir a cenar esta noche" },
  { phrase_en: 'what do you mean?',  phrase_es: '¿qué quieres decir? / ¿cómo así?',         example_en: "What do you mean it's already closed?",          example_es: "¿Qué quieres decir con que ya está cerrado?" },
  { phrase_en: "I'm not sure",       phrase_es: 'no estoy seguro / no sé bien',              example_en: "I'm not sure what time it opens",                example_es: "No estoy seguro a qué hora abre" },
  { phrase_en: 'hang on',            phrase_es: 'espera / aguanta un momento',               example_en: "Hang on, let me check that for you",             example_es: "Espera, déjame revisar eso para ti" },
  { phrase_en: 'heads up',           phrase_es: 'aviso / advertencia / te cuento antes',     example_en: "Just a heads up — the meeting starts early",     example_es: "Solo un aviso: la reunión empieza temprano" },
  { phrase_en: 'it depends',         phrase_es: 'depende',                                   example_en: "Will it rain? It depends on the forecast",       example_es: "¿Va a llover? Depende del pronóstico" },
  { phrase_en: 'good point',         phrase_es: 'buen punto / tienes razón en eso',          example_en: "Good point, I hadn't thought of that",           example_es: "Buen punto, no lo había pensado" },
  { phrase_en: 'I see what you mean', phrase_es: 'entiendo lo que dices / ya veo',           example_en: "I see what you mean, that does sound tricky",    example_es: "Entiendo lo que dices, sí suena complicado" },
  { phrase_en: 'let me know',        phrase_es: 'avisame / dime / comunícame',               example_en: "Let me know if you need anything",               example_es: "Avisame si necesitas algo" },
  { phrase_en: 'feel free to',       phrase_es: 'siéntete libre de / no dudes en',           example_en: "Feel free to ask me anything",                   example_es: "No dudes en preguntarme lo que quieras" },
  { phrase_en: 'on my way',          phrase_es: 'voy para allá / ya salí',                   example_en: "I just left the office, I'm on my way",          example_es: "Acabo de salir de la oficina, voy para allá" },
  { phrase_en: "you're telling me",  phrase_es: 'me lo dices a mí / ya lo sé / claro que sí', example_en: "This traffic is insane! You're telling me!",   example_es: "¡Este tráfico es una locura! ¡Me lo dices a mí!" },
  { phrase_en: 'same here',          phrase_es: 'yo también / igualmente / lo mismo',        example_en: "I'm exhausted — same here",                      example_es: "Estoy agotado — yo también" },
  { phrase_en: 'either way',         phrase_es: 'de cualquier forma / de todas formas',      example_en: "Either way, let me know what you decide",        example_es: "De cualquier forma, avisame qué decides" },
  { phrase_en: "I've had enough",    phrase_es: 'ya estoy harto / no aguanto más',           example_en: "I've had enough of waiting, let's go",           example_es: "Ya estoy harto de esperar, vámonos" },
  { phrase_en: "I owe you",          phrase_es: 'te debo / estoy en deuda contigo',          example_en: "Thanks for covering for me — I owe you",         example_es: "Gracias por cubrirme, te debo una" },
];

console.log("\nUpdating example sentences...");
let ok = 0, fail = 0;
for (const f of fixes) {
  const { error } = await sb.from('english_cards')
    .update({ phrase_es: f.phrase_es, example_en: f.example_en, example_es: f.example_es })
    .eq('phrase_en', f.phrase_en);
  if (error) { console.log('FAIL:', f.phrase_en, error.message); fail++; }
  else { ok++; }
}
console.log(`Updated: ${ok} ok, ${fail} failed`);
