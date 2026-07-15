-- Eliminar palabras sueltas redundantes (ya cubiertas por frases completas)
-- Ejecutar en Supabase Dashboard → SQL Editor

delete from english_cards where phrase_en in (
  -- Cubiertas por frases de "go/get/come/pull/look through"
  'through',

  -- Cubiertas por frases de "patience" y "trust"
  'patience',
  'trust',

  -- Cubiertas por múltiples frases de "appreciate"
  'appreciate',

  -- Cubierta por "I feel very grateful for the life I have"
  'grateful',

  -- Cubierta por "She bought a beautiful jewel"
  'jewel',

  -- Cubierta por "This house is huge!"
  'huge',

  -- Cubierta por "On the beach I saw a lot of beautiful women"
  'women',

  -- Cubierta por "How did you discover it?"
  'discover',

  -- Palabra suelta sin frase que la contextualice
  'rescue',

  -- "while" ya está explicada en contexto pero como conectora vale dejarla
  -- si quieres borrarla descomenta:
  -- 'while',

  -- Cubiertas por frases completas de ASAP y "as soon as"
  -- "ASAP" tiene valor de pronunciación, se mantiene
  -- "as soon as" tiene valor gramatical, se mantiene

  -- Cubierta por "You owe me ten dollars" / "I owe you ten dollars"
  -- (estas se mantienen porque son par gramatical importante)

  -- Esta es suelta sin contexto
  'uploaded'
);

-- Verificar qué quedó:
select phrase_en, phrase_es from english_cards order by created_at;
