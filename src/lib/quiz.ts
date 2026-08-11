/**
 * Question bank and scoring for the quiz.
 *
 * Everything is baked in rather than fetched, so a round costs nothing and
 * works with no signal at all. Answers are always four, in the fixed order
 * the shapes are drawn in, with `answer` naming the right one.
 */

export interface Question {
  q: string;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  questions: Question[];
}

export const CATEGORIES: Category[] = [
  {
    id: "geografia",
    name: "Geografía",
    emoji: "🌍",
    color: "#2c9c6a",
    questions: [
      { q: "¿Cuál es el río más largo de la península ibérica?", options: ["Ebro", "Duero", "Tajo", "Guadalquivir"], answer: 2 },
      { q: "¿Cuál es la capital de Australia?", options: ["Sídney", "Canberra", "Melbourne", "Perth"], answer: 1 },
      { q: "¿En qué país está Machu Picchu?", options: ["Bolivia", "Perú", "Chile", "Ecuador"], answer: 1 },
      { q: "¿Cuál es el desierto cálido más grande del mundo?", options: ["Gobi", "Kalahari", "Atacama", "Sahara"], answer: 3 },
      { q: "¿Cuántas comunidades autónomas tiene España?", options: ["15", "17", "19", "21"], answer: 1 },
      { q: "¿Qué océano baña la costa este de Estados Unidos?", options: ["Pacífico", "Índico", "Atlántico", "Ártico"], answer: 2 },
      { q: "¿Cuál es la montaña más alta de España?", options: ["Mulhacén", "Aneto", "Teide", "Veleta"], answer: 2 },
      { q: "¿Cuál es el país más grande del mundo en superficie?", options: ["China", "Canadá", "Estados Unidos", "Rusia"], answer: 3 },
      { q: "¿Qué estrecho separa España de Marruecos?", options: ["Gibraltar", "Bósforo", "Ormuz", "Magallanes"], answer: 0 },
      { q: "¿Cuál es la capital de Canadá?", options: ["Toronto", "Vancouver", "Ottawa", "Montreal"], answer: 2 },
      { q: "¿En qué país está la ciudad de Marrakech?", options: ["Túnez", "Argelia", "Egipto", "Marruecos"], answer: 3 },
      { q: "¿Qué cordillera separa España de Francia?", options: ["Los Alpes", "Los Pirineos", "Los Cárpatos", "Sierra Nevada"], answer: 1 },
    ],
  },
  {
    id: "historia",
    name: "Historia",
    emoji: "📜",
    color: "#a9752c",
    questions: [
      { q: "¿En qué año llegó Colón a América?", options: ["1492", "1512", "1453", "1521"], answer: 0 },
      { q: "¿Quién fue el primer hombre en pisar la Luna?", options: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "Michael Collins"], answer: 2 },
      { q: "¿En qué año cayó el Muro de Berlín?", options: ["1979", "1985", "1989", "1991"], answer: 2 },
      { q: "¿Qué civilización construyó las pirámides de Giza?", options: ["Los mayas", "Los egipcios", "Los persas", "Los sumerios"], answer: 1 },
      { q: "¿En qué año terminó la Segunda Guerra Mundial?", options: ["1943", "1944", "1945", "1946"], answer: 2 },
      { q: "¿Cómo se llamaba el primer emperador romano?", options: ["Julio César", "Augusto", "Nerón", "Trajano"], answer: 1 },
      { q: "¿De qué año es la Constitución Española vigente?", options: ["1931", "1975", "1978", "1982"], answer: 2 },
      { q: "¿Qué imperio construyó Machu Picchu?", options: ["El azteca", "El maya", "El inca", "El olmeca"], answer: 2 },
      { q: "¿En qué siglo ocurrió la Revolución Francesa?", options: ["Siglo XVII", "Siglo XVIII", "Siglo XIX", "Siglo XVI"], answer: 1 },
      { q: "¿Qué barco se hundió en 1912 en su viaje inaugural?", options: ["Lusitania", "Britannic", "Titanic", "Olympic"], answer: 2 },
      { q: "¿En qué año empezó la Primera Guerra Mundial?", options: ["1912", "1914", "1918", "1920"], answer: 1 },
      { q: "¿Qué reina apoyó el viaje de Colón?", options: ["Isabel I de Castilla", "Juana la Loca", "María Cristina", "Isabel II"], answer: 0 },
    ],
  },
  {
    id: "arte",
    name: "Arte y letras",
    emoji: "🎨",
    color: "#b4477e",
    questions: [
      { q: '¿Quién pintó "La noche estrellada"?', options: ["Monet", "Van Gogh", "Cézanne", "Gauguin"], answer: 1 },
      { q: '¿Quién escribió "Don Quijote de la Mancha"?', options: ["Lope de Vega", "Quevedo", "Cervantes", "Góngora"], answer: 2 },
      { q: '¿Quién pintó "Las meninas"?', options: ["Goya", "El Greco", "Velázquez", "Murillo"], answer: 2 },
      { q: '¿En qué museo está "La Gioconda"?', options: ["El Prado", "El Louvre", "Los Uffizi", "El Hermitage"], answer: 1 },
      { q: '¿Quién esculpió el "David" de Florencia?', options: ["Donatello", "Bernini", "Miguel Ángel", "Rodin"], answer: 2 },
      { q: '¿Quién escribió "Cien años de soledad"?', options: ["Vargas Llosa", "Borges", "Cortázar", "García Márquez"], answer: 3 },
      { q: "¿Qué pintor español pintaba relojes derretidos?", options: ["Miró", "Dalí", "Picasso", "Sorolla"], answer: 1 },
      { q: '¿Quién pintó el "Guernica"?', options: ["Picasso", "Dalí", "Miró", "Juan Gris"], answer: 0 },
      { q: '¿Quién escribió "Romeo y Julieta"?', options: ["Dickens", "Shakespeare", "Molière", "Goethe"], answer: 1 },
      { q: "¿Qué arquitecto diseñó la Sagrada Familia?", options: ["Calatrava", "Gaudí", "Le Corbusier", "Gehry"], answer: 1 },
      { q: '¿Quién escribió "La casa de Bernarda Alba"?', options: ["Machado", "Unamuno", "García Lorca", "Alberti"], answer: 2 },
      { q: "¿De qué país era la pintora Frida Kahlo?", options: ["Colombia", "México", "Argentina", "España"], answer: 1 },
    ],
  },
  {
    id: "ciencia",
    name: "Ciencia",
    emoji: "🔬",
    color: "#2f6fb0",
    questions: [
      { q: "¿Cuál es el planeta más grande del sistema solar?", options: ["Saturno", "Neptuno", "Júpiter", "Urano"], answer: 2 },
      { q: "¿Cuál es el símbolo químico del oro?", options: ["Ag", "Au", "Or", "Go"], answer: 1 },
      { q: "¿Cuántos huesos tiene un adulto?", options: ["186", "206", "226", "246"], answer: 1 },
      { q: "¿Qué gas es el más abundante en el aire que respiramos?", options: ["Oxígeno", "Nitrógeno", "Dióxido de carbono", "Hidrógeno"], answer: 1 },
      { q: "¿Cuál es el planeta más cercano al Sol?", options: ["Venus", "Marte", "Mercurio", "La Tierra"], answer: 2 },
      { q: "¿Aproximadamente a qué velocidad viaja la luz?", options: ["300.000 km/s", "30.000 km/s", "3.000 km/s", "3 millones km/s"], answer: 0 },
      { q: "¿Qué científico formuló la teoría de la relatividad?", options: ["Newton", "Einstein", "Bohr", "Galileo"], answer: 1 },
      { q: "¿Cuántos cromosomas tiene una persona?", options: ["23", "44", "46", "48"], answer: 2 },
      { q: "¿Qué metal es líquido a temperatura ambiente?", options: ["Plomo", "Mercurio", "Estaño", "Sodio"], answer: 1 },
      { q: "¿Qué vitamina produce el cuerpo con el sol?", options: ["Vitamina A", "Vitamina C", "Vitamina D", "Vitamina K"], answer: 2 },
      { q: "¿Cuál es el hueso más largo del cuerpo?", options: ["El húmero", "La tibia", "El fémur", "El peroné"], answer: 2 },
      { q: "¿Qué órgano produce la insulina?", options: ["El hígado", "El páncreas", "El riñón", "El bazo"], answer: 1 },
    ],
  },
  {
    id: "deportes",
    name: "Deportes",
    emoji: "⚽",
    color: "#d1622a",
    questions: [
      { q: "¿Cada cuántos años se celebran los Juegos Olímpicos de verano?", options: ["2", "3", "4", "5"], answer: 2 },
      { q: "¿Cuántos jugadores tiene un equipo de fútbol en el campo?", options: ["9", "10", "11", "12"], answer: 2 },
      { q: "¿En qué deporte se usa un volante en vez de pelota?", options: ["Bádminton", "Squash", "Pádel", "Ping-pong"], answer: 0 },
      { q: "¿Qué país ganó el Mundial de fútbol de 2010?", options: ["Alemania", "España", "Países Bajos", "Brasil"], answer: 1 },
      { q: "¿Cuántos puntos vale un triple en baloncesto?", options: ["2", "3", "4", "5"], answer: 1 },
      { q: "¿Cuántos anillos tiene el símbolo olímpico?", options: ["4", "5", "6", "7"], answer: 1 },
      { q: "¿Qué país ganó el Mundial de fútbol de 2022?", options: ["Francia", "Brasil", "Argentina", "Croacia"], answer: 2 },
      { q: "¿Cuánto dura un partido de fútbol sin prórroga?", options: ["80 minutos", "90 minutos", "100 minutos", "120 minutos"], answer: 1 },
      { q: '¿En qué deporte se hace un "pleno"?', options: ["Petanca", "Bolos", "Dardos", "Curling"], answer: 1 },
      { q: "¿Cuántos jugadores tiene un equipo de baloncesto en pista?", options: ["4", "5", "6", "7"], answer: 1 },
      { q: "¿Qué vuelta ciclista se corre en Francia cada julio?", options: ["El Giro", "La Vuelta", "El Tour", "La París-Roubaix"], answer: 2 },
      { q: "¿En qué deporte destacó Rafa Nadal?", options: ["Pádel", "Tenis", "Golf", "Bádminton"], answer: 1 },
    ],
  },
  {
    id: "ocio",
    name: "Cine y música",
    emoji: "🎬",
    color: "#7c4dea",
    questions: [
      { q: "¿Cómo se llama el mago protagonista de la saga de J.K. Rowling?", options: ["Ron Weasley", "Harry Potter", "Frodo", "Percy Jackson"], answer: 1 },
      { q: '¿Quién dirigió "Jurassic Park"?', options: ["George Lucas", "Steven Spielberg", "James Cameron", "Ridley Scott"], answer: 1 },
      { q: '¿Cómo se llama el león protagonista de "El Rey León"?', options: ["Mufasa", "Simba", "Scar", "Nala"], answer: 1 },
      { q: '¿Qué grupo británico compuso "Hey Jude"?', options: ["The Rolling Stones", "Queen", "The Beatles", "Pink Floyd"], answer: 2 },
      { q: "¿En qué serie aparece Walter White?", options: ["The Wire", "Breaking Bad", "Los Soprano", "Dexter"], answer: 1 },
      { q: "¿Cómo se llama el droide azul y blanco de Star Wars?", options: ["C-3PO", "BB-8", "R2-D2", "K-2SO"], answer: 2 },
      { q: "¿Qué cantante es conocida como la reina del pop?", options: ["Beyoncé", "Madonna", "Britney Spears", "Lady Gaga"], answer: 1 },
      { q: "¿De qué país es originario el K-pop?", options: ["Japón", "China", "Corea del Sur", "Tailandia"], answer: 2 },
      { q: "¿En qué ciudad viven Los Simpson?", options: ["Shelbyville", "Springfield", "Quahog", "South Park"], answer: 1 },
      { q: '¿En qué película de Disney aparece Elsa?', options: ["Enredados", "Frozen", "Moana", "Encanto"], answer: 1 },
      { q: '¿Qué artista canta "Shape of You"?', options: ["Justin Bieber", "Ed Sheeran", "Shawn Mendes", "Bruno Mars"], answer: 1 },
      { q: '¿Qué película ganó el Óscar a mejor película en 2020?', options: ["1917", "Joker", "Parásitos", "Érase una vez en Hollywood"], answer: 2 },
    ],
  },
];

export function categoryById(id: string) {
  return CATEGORIES.find((c) => c.id === id);
}

/** The four answer buttons, in the order they're always drawn. */
export const SHAPES = [
  { shape: "triangle", color: "#e2413c" },
  { shape: "diamond", color: "#2f6fb0" },
  { shape: "circle", color: "#e6a419" },
  { shape: "square", color: "#2c9c6a" },
] as const;

export const ANSWER_MS = 20000;
const BASE = 600;
const SPEED_BONUS = 400;

/**
 * Right answers are worth more the sooner they land, so a race to the button
 * beats a slow certainty. Wrong ones are worth nothing whenever they arrive.
 */
export function scoreAnswer(correct: boolean, msTaken: number) {
  if (!correct) return 0;
  const left = Math.max(1 - Math.min(msTaken, ANSWER_MS) / ANSWER_MS, 0);
  return Math.round((BASE + SPEED_BONUS * left) / 10) * 10;
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The answers are re-ordered on the way out, so which shape is right doesn't
 * depend on the order they happen to be written in — otherwise the same
 * button would be right far more often than the others and you could just
 * hammer it.
 */
function shuffleOptions(q: Question): Question {
  const order = shuffled([0, 1, 2, 3]);
  return {
    q: q.q,
    options: order.map((i) => q.options[i]) as [string, string, string, string],
    answer: order.indexOf(q.answer) as 0 | 1 | 2 | 3,
  };
}

/** Picks `count` questions, shuffled, from one category or from all of them. */
export function drawRound(categoryId: string | null, count: number): Question[] {
  const pool = categoryId ? categoryById(categoryId)?.questions ?? [] : CATEGORIES.flatMap((c) => c.questions);
  return shuffled(pool)
    .slice(0, Math.min(count, pool.length))
    .map(shuffleOptions);
}
