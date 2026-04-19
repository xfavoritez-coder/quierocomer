// Common Spanish/Latin first names for gender detection
const MALE_NAMES = new Set([
  "jaime","pedro","juan","jose","jorge","carlos","diego","andres","sebastian","matias",
  "felipe","alejandro","daniel","gabriel","nicolas","pablo","rodrigo","francisco","miguel","antonio",
  "luis","rafael","fernando","gustavo","ricardo","eduardo","mario","victor","oscar","marco",
  "martin","tomas","ignacio","benjamin","vicente","gonzalo","alvaro","emilio","raul","hector",
  "sergio","arturo","enrique","hernan","claudio","cristian","mauricio","patricio","camilo","joaquin",
  "maximiliano","santiago","agustin","luciano","bruno","ivan","esteban","leonel","marcelo","hugo",
  "cesar","fabian","gerardo","alexis","bastian","renato","alonso","gaspar","lorenzo","manuel",
  "david","christian","javier","angel","roberto","ramon","ruben","adrian","ernesto","guillermo",
  "alfredo","boris","rene","nelson","ariel","rolando","danilo","hans","karl","stefan",
]);

const FEMALE_NAMES = new Set([
  "maria","ana","carmen","rosa","paula","catalina","valentina","camila","javiera","francisca",
  "constanza","daniela","fernanda","gabriela","carolina","andrea","claudia","marcela","patricia","teresa",
  "veronica","monica","sandra","lorena","alejandra","natalia","silvia","susana","cecilia","isabel",
  "sofia","florencia","antonia","isidora","emilia","josefa","martina","renata","agustina","amanda",
  "barbara","belen","victoria","macarena","pilar","rocio","elena","lucia","laura","marta",
  "mariana","julieta","alicia","beatriz","carla","diana","eva","irene","julia","karen",
  "magdalena","nicole","olivia","paloma","raquel","soledad","tamara","ximena","yasna","maite",
]);

export function detectGender(name: string): "male" | "female" | "neutral" {
  const first = name.trim().split(/\s+/)[0].toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove accents

  if (MALE_NAMES.has(first)) return "male";
  if (FEMALE_NAMES.has(first)) return "female";

  // Heuristic for Spanish names: ending in -a is usually female
  if (first.endsWith("a") && !first.endsWith("ia") && first.length > 3) return "female";
  // Common male endings
  if (first.endsWith("o") || first.endsWith("os") || first.endsWith("el") || first.endsWith("an")) return "male";

  return "neutral";
}
