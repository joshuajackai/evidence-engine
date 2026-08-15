/* Español. Typed against `Strings`, so a missing key fails the build.
   Voice matches the English: direct, plain, no filler. */
import type { Strings } from "./strings";

export const es: Strings = {
  appName: "Evidence Engine",
  tagline: "Nada en tu currículum está inventado",
  connectAi: "Conectar IA",
  aiConnected: "IA conectada",
  unlock: "Desbloquear versión completa",
  planFree: "Gratis",
  planFull: "Completa",
  stepsLabel: "Pasos de la solicitud",
  skipToContent: "Ir al contenido",
  languageLabel: "Idioma",
  privacyTerms: "Privacidad y condiciones",
  dataNeverLeaves: "Tus datos nunca salen de este navegador",
  partiallyTranslated:
    "Este panel sigue en inglés por ahora. Los pasos principales están traducidos; los paneles avanzados todavía no.",

  step1: "Evidencia",
  step2: "Puesto objetivo",
  step3: "Coincidencia",
  step4: "Currículum",
  step5: "Enviar",

  evidenceTitle: "Todo lo que has hecho, una cosa a la vez",
  evidenceBlurb:
    "Añade cada cosa por separado. Junto a cada una verás la nota que un responsable de contratación ya le está poniendo en su cabeza. Verla primero es la ventaja.",
  targetTitle: "Los puestos que buscas",
  targetBlurb:
    "Busca ofertas en portales reales que encajen con tu evidencia, o añade una tú mismo. Cada puesto conserva su propio currículum adaptado.",
  matchTitle: "Qué se gana un sitio en la página",
  matchBlurb:
    "Las entradas se ordenan según cuánto responden a esta oferta. Todo lo que queda por debajo permanece en tu inventario y fuera de este currículum.",
  resumeTitle: "Tu currículum",
  resumeBlurb:
    "Cada línea de abajo se ha montado con palabras que escribiste tú. Ningún modelo ha escrito una afirmación en tu nombre, y por eso no hay nada aquí que no puedas explicar en una entrevista.",
  applyTitle: "Envíalo y lleva la cuenta de lo que enviaste",
  applyBlurb:
    "Todo lo que pide un formulario de solicitud, escrito una vez y reutilizado. El seguimiento está aquí porque el mensaje posterior es de donde salen la mayoría de las entrevistas, y es la parte que todo el mundo abandona.",

  gradeProven: "Comprobado",
  gradeEstimate: "Estimación propia",
  gradeVolume: "Volumen",
  gradeNoNumber: "Aún sin cifra",
  gradeProvenHelp: "Tu cifra, y puedes decir de dónde salió.",
  gradeEstimateHelp: "Tu cifra, calculada por ti. Dilo en voz alta en la entrevista.",
  gradeVolumeHelp: "Cuánto hiciste. Más débil que un resultado, mejor que nada.",
  gradeNoNumberHelp: "Perfectamente válido. Déjalo sin cifra antes que inventarte una.",
  gradesTitle: "Cómo funcionan las notas",
  gradesRule: "Apunta tan alto como permita la verdad, y ahí párate.",

  pasteMyResume: "Pegar mi currículum",
  cleanUpFirst: "Limpiar mi currículum primero",
  addByHand: "Añadir uno a mano",
  seeExample: "Ver un ejemplo",
  openSavedFile: "Abrir archivo guardado",
  saveToFile: "Guardar en archivo",
  noEntriesYet: "Aún no hay entradas",
  noEntriesBlurb: "Añade la primera, o carga el ejemplo para ver cómo funcionan las notas.",
  resumeStrength: "Solidez del currículum",
  editEntry: "Editar entrada",
  deleteEntry: "Eliminar entrada",
  entrySource: "Fuente",
  quarantinedNote: "Dato del sector en cuarentena, solo para preparar la entrevista",

  fieldOrg: "Empresa o cliente",
  fieldRole: "Tu puesto",
  fieldDates: "Fechas",
  fieldAction: "Qué hiciste",
  fieldActionHint:
    "Empieza con un verbo que puedas defender. Reconstruí, migré, programé, diagnostiqué, negocié. Evita palabras que esconden tus manos, como optimicé o aproveché.",
  fieldType: "¿Hay alguna cifra asociada a esto?",
  fieldTypeHint:
    "Sé honesto. Esta nota es lo importante, y es la pregunta que hará quien te entreviste.",
  typeNone: "Todavía no, o no hay cifra",
  typeAudited: "Sí, y puedo mostrar de dónde salió",
  typeEstimated: "Sí, pero es una estimación mía",
  typeActivity: "Solo un recuento de volumen, como cuántos hice",
  fieldMetric: "La cifra",
  fieldConstraint: "Qué se mantuvo igual",
  fieldConstraintHint: "Esto convierte una afirmación en evidencia.",
  fieldEvidence: "De dónde salió la cifra",
  fieldTags: "Habilidades y herramientas",
  fieldTagsHint: "Separadas por comas. Son las que se comparan con la oferta de empleo.",
  quarantineTitle: "Cuarentena: datos del sector",
  quarantineBody:
    "Lo que escribas aquí se guarda para preparar la entrevista y queda bloqueado de tu currículum de forma permanente. Un dato del sector junto a tu nombre se lee como si fuera tu resultado. Ese es exactamente el error que esta herramienta existe para evitar.",
  saveEntry: "Guardar entrada",
  cancel: "Cancelar",

  errOrg: "Añade la empresa o el cliente.",
  errAction: "Describe qué hiciste.",
  errMetric:
    "Has elegido un tipo con nota, así que la cifra es obligatoria. Cambia a Sin cifra si no existe.",
  errEvidenceAudited:
    "Comprobado significa que puedes nombrar la fuente. Añádela, o baja a Estimación propia.",
  errEvidenceEstimated: "Estimación propia necesita tu razonamiento, para poder defenderlo en voz alta.",

  close: "Cerrar",
  copy: "Copiar",
  copied: "Copiado",
  restore: "Restaurar",
  download: "Descargar todo",
  search: "Buscar en portales de empleo",
  save: "Guardar",
  remove: "Quitar",

  welcomeTag: "Gratis. Sin cuenta. Nada sale de tu navegador.",
  welcomeHeadline:
    "Todas las demás herramientas de currículum con IA escriben tus logros por ti. Esta no puede.",
  welcomeBody:
    "Aquí dentro no hay ningún modelo. Tú escribes las palabras, y la herramienta califica hasta qué punto aguantaría cada afirmación si alguien te preguntara por ella en una entrevista. Esa es toda la idea, y por eso nada de tu currículum puede estar inventado.",
  welcomeStep1: "Añade lo que has hecho",
  welcomeStep2: "Pega el puesto que quieres",
  welcomeStep3: "Obtén un currículum dirigido a él",
  welcomeTime:
    "Unos diez minutos si tienes tu currículum antiguo a mano. Puedes parar y volver: tu trabajo se guarda en este dispositivo.",
  welcomePaste: "Pegar mi currículum para empezar",
  welcomePrep: "Mi currículum necesita limpieza primero",
  welcomeBlank: "Empezar desde cero",
  welcomeDemo: "Muéstrame un ejemplo",

  importNonEnglish:
    "Este currículum no parece estar en inglés. El importador lee encabezados de sección y nombres de meses en inglés, así que lo dividirá mal. Usa «Limpiar mi currículum primero»: te da un texto para tu propia IA, que funciona en cualquier idioma, y luego pegas el resultado aquí.",

  perHour: "/h",
  perDay: "/día",
  perMonth: "/mes",
  perYear: "",
};
