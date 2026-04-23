export type Lang = "es" | "en" | "pt";

export const SUPPORTED_LANGS: Lang[] = ["es", "en", "pt"];

export const LANG_LABELS: Record<Lang, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
};

export const LANG_FLAGS: Record<Lang, string> = {
  es: "ES",
  en: "EN",
  pt: "PT",
};

const dict = {
  es: {
    search: "Buscar plato...",
    recommended: "Recomendado",
    callWaiter: "Llamar garzón",
    filters: "Filtros",
    plates: "platos",
    plate: "plato",
    theMenu: "LA CARTA",
    aTourThrough: "Un recorrido por",
    sections: "secciones",
    slideToStart: "Desliza para comenzar",
    start: "Comenzar",
    section: "Sección",
    slideRight: "Desliza →",
    seeMore: "ver más",
    seeLess: "ver menos",
    cantDecide: "¿No te decides",
    whatToOrder: "qué pedir",
    genieCanHelp: "El Genio te puede ayudar a elegir.",
    askGenie: "Preguntar al Genio ✦",
    dontKnowWhat: "¿No sabes qué pedir en",
    genieKnows: "El Genio conoce cada plato y puede ayudarte",
    askGenieShort: "Preguntar al Genio",
    language: "Idioma",
    // Chapter words
    chapterOne: "uno", chapterTwo: "dos", chapterThree: "tres",
    chapterFour: "cuatro", chapterFive: "cinco", chapterSix: "seis",
    chapterSeven: "siete", chapterEight: "ocho", chapterNine: "nueve",
    chapterTen: "diez", chapterEleven: "once", chapterTwelve: "doce",
  },
  en: {
    search: "Search dish...",
    recommended: "Recommended",
    callWaiter: "Call waiter",
    filters: "Filters",
    plates: "dishes",
    plate: "dish",
    theMenu: "THE MENU",
    aTourThrough: "A tour through",
    sections: "sections",
    slideToStart: "Swipe to begin",
    start: "Begin",
    section: "Section",
    slideRight: "Swipe →",
    seeMore: "see more",
    seeLess: "see less",
    cantDecide: "Can't decide",
    whatToOrder: "what to order",
    genieCanHelp: "The Genie can help you choose.",
    askGenie: "Ask the Genie ✦",
    dontKnowWhat: "Don't know what to order at",
    genieKnows: "The Genie knows every dish and can help you",
    askGenieShort: "Ask the Genie",
    language: "Language",
    chapterOne: "one", chapterTwo: "two", chapterThree: "three",
    chapterFour: "four", chapterFive: "five", chapterSix: "six",
    chapterSeven: "seven", chapterEight: "eight", chapterNine: "nine",
    chapterTen: "ten", chapterEleven: "eleven", chapterTwelve: "twelve",
  },
  pt: {
    search: "Buscar prato...",
    recommended: "Recomendado",
    callWaiter: "Chamar garçom",
    filters: "Filtros",
    plates: "pratos",
    plate: "prato",
    theMenu: "O CARDÁPIO",
    aTourThrough: "Um passeio por",
    sections: "seções",
    slideToStart: "Deslize para começar",
    start: "Começar",
    section: "Seção",
    slideRight: "Deslize →",
    seeMore: "ver mais",
    seeLess: "ver menos",
    cantDecide: "Não consegue decidir",
    whatToOrder: "o que pedir",
    genieCanHelp: "O Gênio pode ajudar você a escolher.",
    askGenie: "Perguntar ao Gênio ✦",
    dontKnowWhat: "Não sabe o que pedir em",
    genieKnows: "O Gênio conhece cada prato e pode ajudar você",
    askGenieShort: "Perguntar ao Gênio",
    language: "Idioma",
    chapterOne: "um", chapterTwo: "dois", chapterThree: "três",
    chapterFour: "quatro", chapterFive: "cinco", chapterSix: "seis",
    chapterSeven: "sete", chapterEight: "oito", chapterNine: "nove",
    chapterTen: "dez", chapterEleven: "onze", chapterTwelve: "doze",
  },
} as const;

export type I18nKey = keyof (typeof dict)["es"];

export function t(lang: Lang, key: I18nKey): string {
  return dict[lang]?.[key] || dict.es[key];
}

const CHAPTER_KEYS: I18nKey[] = [
  "chapterOne", "chapterTwo", "chapterThree", "chapterFour",
  "chapterFive", "chapterSix", "chapterSeven", "chapterEight",
  "chapterNine", "chapterTen", "chapterEleven", "chapterTwelve",
];

export function chapterWord(lang: Lang, index: number): string {
  const key = CHAPTER_KEYS[index];
  return key ? t(lang, key) : String(index + 1);
}

export function isValidLang(v: string | null | undefined): v is Lang {
  return !!v && SUPPORTED_LANGS.includes(v as Lang);
}

/** Parse Accept-Language header → first supported lang */
export function parseLangHeader(header: string | null): Lang {
  if (!header) return "es";
  const preferred = header.split(",").map((s) => s.split(";")[0].trim().slice(0, 2));
  return (preferred.find((l) => SUPPORTED_LANGS.includes(l as Lang)) as Lang) || "es";
}
