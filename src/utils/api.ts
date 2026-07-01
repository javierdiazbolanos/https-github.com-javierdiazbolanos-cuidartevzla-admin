/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Hospital, Paciente, Transporte, DedupReport } from "../types";

let API_BASE = "/api";
let detectedIP = "0.0.0.0";
let volunteerCode = "";

// Initialize volunteer code from session storage if it exists
if (typeof window !== "undefined") {
  volunteerCode = sessionStorage.getItem("codigo_voluntario") || "";
}

// Fetch the IP address at startup
export async function detectIPAddress(): Promise<string> {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (res.ok) {
      const data = await res.json();
      detectedIP = data.ip || "0.0.0.0";
    }
  } catch (err) {
    console.warn("Error detectando IP, usando local/0.0.0.0:", err);
    detectedIP = "127.0.0.1";
  }
  return detectedIP;
}

export function getDetectedIP(): string {
  return detectedIP;
}

export function setVolunteerCode(code: string) {
  volunteerCode = code;
  if (typeof window !== "undefined") {
    sessionStorage.setItem("codigo_voluntario", code);
  }
}

export function getVolunteerCode(): string {
  return volunteerCode;
}

export function isAuthorized(): boolean {
  // Cualquier código no vacío es aceptado para acceso básico.
  // Las funciones de superusuario se controlan vía superuser_status.php
  return volunteerCode !== '' && volunteerCode.length >= 3;
}

// Dynamically fetch config
export async function initializeAPI(): Promise<string> {
  try {
    const res = await fetch("./config.json");
    if (res.ok) {
      const config = await res.json();
      API_BASE = config.api_base || "/api";
    }
  } catch (err) {
    console.log("No config.json found or failed to load. Defaulting to /api");
    API_BASE = "/api";
  }
  await detectIPAddress();
  return API_BASE;
}

export function getAPIBase(): string {
  return API_BASE;
}

// ==========================================
// SEED INITIAL MOCK DATA (stored in LocalStorage for demo & offline preview)
// ==========================================
const MOCK_HOSPITALES: Hospital[] = [
  { id: 1, nombre: "Hospital Universitario de Caracas (HUC)", municipio: "Libertador", estado: "Distrito Capital", telefono: "+58 212-6067111", sinonimos: ["hospital universitario de caracas", "hospital clinico universitario", "huc", "clinico universitario"] },
  { id: 2, nombre: "Hospital J.M. de los Ríos", municipio: "Libertador", estado: "Distrito Capital", telefono: "+58 212-5743511", sinonimos: ["hospital jm de los rios", "jm de los rios", "hospital de ninos jm de los rios", "hospital de ninos", "hospital de niños"] },
  { id: 3, nombre: "Hospital Dr. Domingo Luciani (El Llanito)", municipio: "Sucre", estado: "Miranda", telefono: "+58 212-2561111", sinonimos: ["hospital domingo luciani", "hospital dr domingo luciani", "domingo luciani", "el llanito", "luciani", "infosocial.luciani@gmail.com"] },
  { id: 4, nombre: "Hospital Dr. Miguel Pérez Carreño", municipio: "Libertador", estado: "Distrito Capital", telefono: "+58 212-4422311", sinonimos: ["hospital miguel perez carreno", "hospital miguel perez carreño", "perez carreno", "perez carreño", "carreño", "carreno"] },
  { id: 5, nombre: "Hospital Central de Maracay", municipio: "Girardot", estado: "Aragua", telefono: "+58 243-2465111", sinonimos: ["hospital central de maracay", "central de maracay", "maracay"] },
  { id: 6, nombre: "Hospital Central de Valencia", municipio: "Valencia", estado: "Carabobo", telefono: "+58 241-8711111", sinonimos: ["hospital central de valencia", "central de valencia", "valencia"] },
  { id: 7, nombre: "Hospital Vargas de Caracas", municipio: "Libertador", estado: "Distrito Capital", telefono: "+58 212-8608822", sinonimos: ["hospital vargas de caracas", "hospital vargas", "vargas de caracas"] },
  { id: 8, nombre: "Maternidad Concepción Palacios", municipio: "Libertador", estado: "Distrito Capital", telefono: "+58 212-5412233", sinonimos: ["maternidad concepcion palacios", "concepcion palacios"] },
  { id: 9, nombre: "Hospital Militar Dr. Carlos Arvelo", municipio: "Libertador", estado: "Distrito Capital", telefono: "+58 212-4091111", sinonimos: ["hospital militar", "hospital militar carlos arvelo", "hospital militar dr carlos arvelo", "carlos arvelo", "militar carlos arvelo"] },
  { id: 10, nombre: "Hospital General Dr. José Ignacio Baldó (El Algodonal)", municipio: "Libertador", estado: "Distrito Capital", telefono: "+58 212-4721122", sinonimos: ["el algodonal", "hospital dr jose ignacio baldo", "jose ignacio baldo", "algodonal"] },
  { id: 11, nombre: "Hospital Dr. Leopoldo Manrique Terrero (Coche)", municipio: "Libertador", estado: "Distrito Capital", telefono: "+58 212-6811212", sinonimos: ["hospital de coche", "hospital dr leopoldo manrique terrero", "coche", "leopoldo manrique terrero"] },
  { id: 12, nombre: "Hospital Dr. Francisco Antonio Rísquez", municipio: "Libertador", estado: "Distrito Capital", telefono: "+58 212-5512211", sinonimos: ["hospital dr francisco antonio risquez", "francisco antonio risquez", "risquez"] },
  { id: 13, nombre: "Hospital Ana Francisca Pérez de León II (Petare)", municipio: "Sucre", estado: "Miranda", telefono: "+58 212-2713322", sinonimos: ["perez de leon ii", "hospital ana francisca perez de leon", "perez de leon petare", "perez de leon 2", "perez de leon", "perez de leon ii petare"] },
  { id: 14, nombre: "Hospital Victorino Santaella Ruiz (Los Teques)", municipio: "Guaicaipuro", estado: "Miranda", telefono: "+58 212-3211111", sinonimos: ["hospital victorino santaella", "hospital victorino santaella ruiz", "los teques", "victorino santaella", "santaella"] },
  { id: 15, nombre: "Hospital Dr. Francisco Rafael García (Guatire)", municipio: "Zamora", estado: "Miranda", telefono: "+58 212-3442211", sinonimos: ["hospital de guatire", "dr francisco rafael garcia", "francisco rafael garcia"] },
  { id: 16, nombre: "Hospital General de los Valles del Tuy (Ocumare)", municipio: "Tomás Lander", estado: "Miranda", telefono: "+58 239-2123344", sinonimos: ["valles del tuy", "ocumare", "hospital de ocumare"] },
  { id: 17, nombre: "Hospital Dr. José María Carabaño Tosta (IVSS Maracay)", municipio: "Girardot", estado: "Aragua", telefono: "+58 243-2411122", sinonimos: ["jose maria carabano tosta", "carabaño tosta", "ivss maracay"] },
  { id: 18, nombre: "Hospital Militar Coronel Elbano Paredes Vivas", municipio: "Girardot", estado: "Aragua", telefono: "+58 243-2334455", sinonimos: ["elbano paredes vivas", "militar de maracay"] },
  { id: 19, nombre: "Ciudad Hospitalaria Dr. Enrique Tejera (CHET)", municipio: "Valencia", estado: "Carabobo", telefono: "+58 241-8401111", sinonimos: ["chet", "ciudad hospitalaria dr enrique tejera", "enrique tejera"] },
  { id: 20, nombre: "Hospital Universitario Ángel Larralde (IVSS Bárbula)", municipio: "Naguanagua", estado: "Carabobo", telefono: "+58 241-8602211", sinonimos: ["angel larralde", "ivss barbula", "barbula", "hospital de barbula"] },
  { id: 21, nombre: "Hospital Dr. Adolfo Prince Lara", municipio: "Puerto Cabello", estado: "Carabobo", telefono: "+58 242-3612233", sinonimos: ["adolfo prince lara", "prince lara", "puerto cabello"] },
  { id: 22, nombre: "Hospital Dr. Miguel Malpica", municipio: "Guacara", estado: "Carabobo", telefono: "+58 245-5641122", sinonimos: ["miguel malpica", "malpica", "guacara"] },
  { id: 23, nombre: "Hospital Universitario de Maracaibo (SAHUM)", municipio: "Maracaibo", estado: "Zulia", telefono: "+58 261-7501111", sinonimos: ["sahum", "universitario de maracaibo"] },
  { id: 24, nombre: "Hospital General del Sur Dr. Pedro Iturbe", municipio: "Maracaibo", estado: "Zulia", telefono: "+58 261-7621111", sinonimos: ["hospital del sur", "pedro iturbe"] },
  { id: 25, nombre: "Hospital Chiquinquirá de Maracaibo", municipio: "Maracaibo", estado: "Zulia", telefono: "+58 261-7221122", sinonimos: ["hospital chiquinquira", "chiquinquira de maracaibo", "chiquinquira"] },
  { id: 26, nombre: "Hospital Dr. Manuel Noriega Trigo (IVSS)", municipio: "San Francisco", estado: "Zulia", telefono: "+58 261-7643322", sinonimos: ["manuel noriega trigo", "noriega trigo"] },
  { id: 27, nombre: "Hospital Central de Maracaibo Dr. Urquinaona", municipio: "Maracaibo", estado: "Zulia", telefono: "+58 261-7212211", sinonimos: ["urquinaona", "central de maracaibo"] },
  { id: 28, nombre: "Hospital Central Universitario Antonio María Pineda", municipio: "Iribarren", estado: "Lara", telefono: "+58 251-2511122", sinonimos: ["antonio maria pineda", "central de barquisimeto"] },
  { id: 29, nombre: "Hospital de Niños Dr. Andrés Riera Zubillaga", municipio: "Iribarren", estado: "Lara", telefono: "+58 251-2514433", sinonimos: ["andres riesta zubillaga", "ninos de barquisimeto", "niños de barquisimeto"] },
  { id: 30, nombre: "Hospital Dr. Pastor Oropeza Riera (IVSS Barquisimeto)", municipio: "Iribarren", estado: "Lara", telefono: "+58 251-4421122", sinonimos: ["pastor oropeza", "ivss barquisimeto"] },
  { id: 31, nombre: "Hospital Universitario Dr. Luis Razetti", municipio: "Simón Bolívar", estado: "Anzoátegui", telefono: "+58 281-2751122", sinonimos: ["luis razetti barcelona", "luis razetti anzoategui"] },
  { id: 32, nombre: "Hospital de Niños Dr. Rafael Tobías Guevara", municipio: "Simón Bolívar", estado: "Anzoátegui", telefono: "+58 281-2752233", sinonimos: ["rafael tobias guevara"] },
  { id: 33, nombre: "Hospital Dr. Felipe Guevara Rojas", municipio: "Simón Rodríguez", estado: "Anzoátegui", telefono: "+58 283-2351122", sinonimos: ["felipe guevara rojas", "el tigre"] },
  { id: 34, nombre: "Hospital Ruiz y Páez (Ciudad Bolívar)", municipio: "Heres", estado: "Bolívar", telefono: "+58 285-6321122", sinonimos: ["ruiz y paez", "ciudad bolivar"] },
  { id: 35, nombre: "Hospital Dr. Raúl Leoni (IVSS Guaiparo)", municipio: "Caroní", estado: "Bolívar", telefono: "+58 286-9301122", sinonimos: ["raul leoni", "guaiparo", "ivss guaiparo"] },
  { id: 36, nombre: "Hospital Uyapar (Puerto Ordaz)", municipio: "Caroní", estado: "Bolívar", telefono: "+58 286-9231122", sinonimos: ["uyapar", "puerto ordaz"] },
  { id: 37, nombre: "Hospital Central de San Cristóbal", municipio: "San Cristóbal", estado: "Táchira", telefono: "+58 276-3441122", sinonimos: ["hospital central de san cristobal", "san cristobal"] },
  { id: 38, nombre: "Hospital Patrocinio Peñuela Ruiz (IVSS)", municipio: "San Cristóbal", estado: "Táchira", telefono: "+58 276-3412233", sinonimos: ["patrocinio penuela ruiz", "ivss san cristobal"] },
  { id: 39, nombre: "Instituto Autónomo Hospital Universitario de los Andes (IAHULA)", municipio: "Libertador", estado: "Mérida", telefono: "+58 274-2401111", sinonimos: ["iahula", "universitario de los andes", "universitario de merida"] },
  { id: 40, nombre: "Hospital Sor Juana Inés de la Cruz", municipio: "Libertador", estado: "Mérida", telefono: "+58 274-2631122", sinonimos: ["sor juana ines de la cruz"] },
  { id: 41, nombre: "Hospital Universitario Dr. Manuel Núñez Tovar", municipio: "Maturín", estado: "Monagas", telefono: "+58 291-6411122", sinonimos: ["manuel nunez tovar", "manuel núñez tovar", "maturin"] },
  { id: 42, nombre: "Hospital Universitario Dr. Alfredo Van Grieken", municipio: "Miranda", estado: "Falcón", telefono: "+58 268-2511122", sinonimos: ["alfredo van grieken", "coro"] },
  { id: 43, nombre: "Hospital Dr. Rafael Calles Sierra", municipio: "Carirubana", estado: "Falcón", telefono: "+58 269-2461122", sinonimos: ["rafael calles sierra", "punto fijo"] },
  { id: 44, nombre: "Hospital Universitario Antonio Patricio de Alcalá", municipio: "Sucre", estado: "Sucre", telefono: "+58 293-4311122", sinonimos: ["antonio patricio de alcala", "cumana"] },
  { id: 45, nombre: "Hospital Dr. Miguel Óraá (Guanare)", municipio: "Guanare", estado: "Portuguesa", telefono: "+58 257-2511122", sinonimos: ["miguel oraa", "guanare"] },
  { id: 46, nombre: "Hospital Dr. J. M. Casal Ramos (Acarigua-Araure)", municipio: "Páez", estado: "Portuguesa", telefono: "+58 255-6211122", sinonimos: ["casal ramos", "acarigua", "araure"] },
  { id: 47, nombre: "Hospital Central Dr. Plácido Daniel Rodríguez Rivero", municipio: "San Felipe", estado: "Yaracuy", telefono: "+58 254-2311122", sinonimos: ["placido daniel rodriguez rivero", "san felipe"] },
  { id: 48, nombre: "Hospital Pediátrico Niño Jesús", municipio: "San Felipe", estado: "Yaracuy", telefono: "+58 254-2312233", sinonimos: ["pediatrico nino jesus"] },
  { id: 49, nombre: "Hospital Dr. Luis Razetti (Barinas)", municipio: "Barinas", estado: "Barinas", telefono: "+58 273-5411122", sinonimos: ["luis razetti barinas"] },
  { id: 50, nombre: "Hospital Universitario Dr. Pedro Emilio Carrillo", municipio: "Valera", estado: "Trujillo", telefono: "+58 271-2211122", sinonimos: ["pedro emilio carrillo", "valera"] },
  { id: 51, nombre: "Hospital Dr. Luis Ortega (Porlamar)", municipio: "Mariño", estado: "Nueva Esparta", telefono: "+58 295-2611122", sinonimos: ["luis ortega", "porlamar", "margarita"] },
  { id: 52, nombre: "Hospital Israel Ranuárez Balza", municipio: "Juan Germán Roscio", estado: "Guárico", telefono: "+58 246-4311122", sinonimos: ["israel ranuarez balza", "san juan de los morros"] },
  { id: 53, nombre: "Hospital Dr. Pablo Acosta Ortiz", municipio: "San Fernando", estado: "Apure", telefono: "+58 247-3411122", sinonimos: ["pablo acosta ortiz", "san fernando de apure"] },
  { id: 54, nombre: "Hospital General de San Carlos", municipio: "Ezequiel Zamora", estado: "Cojedes", telefono: "+58 258-4331122", sinonimos: ["hospital de san carlos", "san carlos"] },
  { id: 55, nombre: "Hospital Dr. Luis Razetti (Tucupita)", municipio: "Tucupita", estado: "Delta Amacuro", telefono: "+58 287-7211122", sinonimos: ["luis razetti tucupita", "tucupita"] },
  { id: 56, nombre: "Hospital Dr. José Gregorio Hernández (Puerto Ayacucho)", municipio: "Atures", estado: "Amazonas", telefono: "+58 248-5211122", sinonimos: ["jose gregorio hernandez puerto ayacucho", "puerto ayacucho"] },
  { id: 57, nombre: "Hospital Dr. José María Vargas (La Guaira)", municipio: "Vargas", estado: "La Guaira", telefono: "+58 212-3311122", sinonimos: ["hospital dr jose maria vargas la guaira", "hospital dr jose maria vargas", "hospital jose maria vargas", "vargas la guaira", "jose maria vargas de la guaira", "los corales", "jose maria vargas los corales", "hgr dr jose maria vargas"] },
  { id: 58, nombre: "Hospital Martín Vega (Catia La Mar)", municipio: "Vargas", estado: "La Guaira", telefono: "+58 212-3511122", sinonimos: ["martin vega", "catia la mar"] },
  { id: 59, nombre: "Hospital Dr. Ricardo Baquero González (Periférico de Catia)", municipio: "Libertador", estado: "Distrito Capital", telefono: null, sinonimos: ["hospital ricardo baquero gonzalez", "hospital periferico de catia", "periferico de catia", "baquero gonzalez", "ricardo baquero gonzalez", "hospital de catia"] },
  { id: 60, nombre: "Hospital Ciudad Caribia", municipio: "Vargas", estado: "La Guaira", telefono: null, sinonimos: ["ciudad caribia", "hospital ciudad caribia", "caribia"] },
  { id: 61, nombre: "Hospital General del Oeste (Dr. José Gregorio Hernández)", municipio: "Libertador", estado: "Distrito Capital", telefono: null, sinonimos: ["hospital general del oeste", "hospital general del oeste dr jose gregorio hernandez", "los magallanes de catia", "magallanes de catia", "jose gregorio hernandez catia"] },
  { id: 62, nombre: "Hospital Refugiados Campo de Golf Playa Los Cocos", municipio: "Vargas", estado: "La Guaira", telefono: null, sinonimos: ["campo de golf", "playa los cocos", "refugiados campo de golf", "refugiados campo de golf playa los cocos"] },
  { id: 63, nombre: "Hospital de Pariata (Dr. Rafael Medina Jiménez)", municipio: "Vargas", estado: "La Guaira", telefono: null, sinonimos: ["pariata", "hospital de pariata", "hospital rafael medina jimenez", "rafael medina jimenez pariata"] },
  { id: 64, nombre: "Clínica El Ávila", municipio: "Chacao", estado: "Miranda", telefono: null, sinonimos: ["clinica el avila", "hospital clinica el avila", "el avila", "el ávila", "clínica el ávila"] },
  { id: 65, nombre: "Clínica CCCT", municipio: "Chacao", estado: "Miranda", telefono: null, sinonimos: ["clinica ccct", "ccct", "clínica ccct"] },
  { id: 66, nombre: "Grupo Médico Santa Paula", municipio: "Sucre", estado: "Miranda", telefono: null, sinonimos: ["grupo medico santa paula", "santa paula", "grupo médico santa paula"] },
  { id: 67, nombre: "Hospital Cruz Roja", municipio: "Libertador", estado: "Distrito Capital", telefono: null, sinonimos: ["cruz roja", "hospital cruz roja", "cruz roja venezolana"] },
  { id: 68, nombre: "Hospital Desconocido", municipio: "Desconocido", estado: "Desconocido", telefono: null, sinonimos: ["hospital desconocido", "desconocido", "sin especificar"] }
];

export function normalizeHospitalName(name: string): string {
  if (!name) return "";
  let clean = name.trim().replace(/\s+/g, " ");

  const abbreviations: [RegExp, string][] = [
    [/\bhosp\b/gi, "Hospital"],
    [/\bhosp\.\b/gi, "Hospital"],
    [/\buniv\b/gi, "Universitario"],
    [/\buniv\.\b/gi, "Universitario"],
    [/\bamb\b/gi, "Ambulatorio"],
    [/\bamb\.\b/gi, "Ambulatorio"],
    [/\bmilit\b/gi, "Militar"],
    [/\bmilit\.\b/gi, "Militar"],
    [/\bgral\b/gi, "General"],
    [/\bgral\.\b/gi, "General"],
    [/\bctr\b/gi, "Centro de Salud"],
    [/\bctr\.\b/gi, "Centro de Salud"],
    [/\bcentro de salud\b/gi, "Centro de Salud"],
    [/\bivss\b/gi, "IVSS"],
    [/\bi\.v\.s\.s\.\b/gi, "IVSS"],
    [/\bdr\b/gi, "Dr."],
    [/\bdr\.\b/gi, "Dr."],
    [/\bdra\b/gi, "Dra."],
    [/\bdra\.\b/gi, "Dra."]
  ];

  for (const [regex, replacement] of abbreviations) {
    clean = clean.replace(regex, replacement);
  }

  const particles = new Set(["de", "del", "la", "las", "lo", "los", "y", "e", "en", "o", "u"]);
  const words = clean.split(" ");
  const processedWords = words.map((word, index) => {
    if (word.length >= 3 && word === word.toUpperCase() && /^[A-Z]+$/.test(word)) {
      return word;
    }
    const lowerWord = word.toLowerCase();
    if (index === 0 || index === words.length - 1) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    if (particles.has(lowerWord)) {
      return lowerWord;
    }
    if (lowerWord === "dr.") return "Dr.";
    if (lowerWord === "dra.") return "Dra.";
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return processedWords.join(" ").replace(/\s+/g, " ").replace(/\.\./g, ".").trim();
}

export function formatFechaAesthetic(fechaInput: any): string {
  if (!fechaInput) return "";
  let date: Date;

  const num = Number(fechaInput);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const utcDays = num - 25569;
    const dateMs = utcDays * 86400 * 1000;
    date = new Date(dateMs);
  } else {
    if (typeof fechaInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaInput)) {
      const parts = fechaInput.split("-");
      date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      date = new Date(fechaInput);
    }
  }

  if (isNaN(date.getTime())) {
    return String(fechaInput);
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, "0");

  return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm}`;
}

const MOCK_PACIENTES: Paciente[] = [
  { id: 101, nombre: "Carlos Eduardo Mendoza", edad: 42, sexo: "Masculino", hospital: "Hospital Universitario de Caracas (HUC)", hospital_id: 1, actualizacion_fecha: "2026-06-25", estado: "hospitalizado", posible_duplicado: false, cedula_masked: "V-15.***.341", cedula: "15341256", procedencia: "La Vega, Caracas" },
  { id: 102, nombre: "María Alejandra Rivas", edad: 29, sexo: "Femenino", hospital: "Hospital Domingo Luciani", hospital_id: 3, actualizacion_fecha: "2026-06-26", estado: "hospitalizado", posible_duplicado: false, cedula_masked: "V-21.***.908", cedula: "21908332", procedencia: "Petare, Miranda" },
  { id: 103, nombre: "José Gregorio Hernández", edad: 67, sexo: "Masculino", hospital: "Hospital J.M. de los Ríos", hospital_id: 2, actualizacion_fecha: "2026-06-25", estado: "referido", posible_duplicado: false, cedula_masked: "V-8.***.112", cedula: "8112345", procedencia: "Antímano, Caracas" },
  { id: 104, nombre: "Carmen Elena Uzcátegui", edad: 75, sexo: "Femenino", hospital: "Hospital Universitario de Caracas (HUC)", hospital_id: 1, actualizacion_fecha: "2026-06-24", estado: "alta", posible_duplicado: false, cedula_masked: "V-4.***.781", cedula: "4781992", procedencia: "El Valle, Caracas" },
  { id: 105, nombre: "Luis Alejandro Blanco", edad: 16, sexo: "Masculino", hospital: "Hospital Dr. Miguel Pérez Carreño", hospital_id: 4, actualizacion_fecha: "2026-06-27", estado: "hospitalizado", posible_duplicado: true, cedula_masked: "V-30.***.554", cedula: "30554122", procedencia: "Chacao, Miranda" },
];

const MOCK_TRANSPORTE: Transporte[] = [
  { id: 1, nombre: "Juan Carlos Altuve", telefono: "0412-5551234", ciudad: "Caracas", vehiculo: "Toyota Hilux 4x4", capacidad_personas: 5, capacidad_carga: "800 kg (Pick-up)", disponible: true, notas: "Disponible para traslado rústico y zonas de difícil acceso.", cedula: "12345" },
  { id: 2, nombre: "Génesis Mireya Pérez", telefono: "0424-9987744", ciudad: "Maracay", vehiculo: "Chevrolet Silverado 1500", capacidad_personas: 3, capacidad_carga: "1000 kg (Carga pesada)", disponible: true, notas: "Apoyo con transporte de cajas de agua, insumos médicos y medicinas.", cedula: "23456" },
  { id: 3, nombre: "Pedro Rafael Castillo", telefono: "0414-3321155", ciudad: "Valencia", vehiculo: "Ford Transit Ambulancia Privada", capacidad_personas: 2, capacidad_carga: "Soportes de camilla", disponible: false, notas: "Actualmente en ruta con traslado programado. Libre en la noche.", cedula: "34567" },
  { id: 4, nombre: "Dr. Marcos Salazar", telefono: "0416-7788990", ciudad: "Caracas", vehiculo: "Ambulancia Soporte Básico", capacidad_personas: 3, capacidad_carga: "Equipos médicos", disponible: true, notas: "Equipada con oxígeno de emergencia. Zona este.", cedula: "45678" }
];

// Load local databases or seed them
function getLocalDB<T>(key: string, seed: T[]): T[] {
  if (typeof window === "undefined") return seed;
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }
  try {
    return JSON.parse(data);
  } catch {
    return seed;
  }
}

function saveLocalDB<T>(key: string, data: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

// Fetch helper that falls back to localStorage mock DB if request fails
async function fetchWithMockFallback<T>(
  url: string,
  options: RequestInit,
  mockKey: string,
  mockSeed: T[],
  mockHandler: (localData: T[]) => { ok: boolean; data?: any; id?: number; resultados?: any }
): Promise<{ ok: boolean; [key: string]: any }> {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  } as Record<string, string>;

  if (volunteerCode) {
    headers["X-Codigo-Voluntario"] = volunteerCode;
  }

  // Debug log all API calls for auditing purposes
  console.log(`[API CALL] ${options.method || "GET"} ${url}`, {
    headers,
    body: options.body ? JSON.parse(options.body as string) : null,
  });

  try {
    const res = await fetch(url, { ...options, headers });
    if (res.ok) {
      const serverData = await res.json();
      return serverData;
    }
    throw new Error(`Server returned ${res.status}`);
  } catch (err) {
    console.warn(`API ${url} failed, falling back to LocalStorage Mock DB. Error:`, err);
    const localData = getLocalDB<T>(mockKey, mockSeed);
    const result = mockHandler(localData);
    saveLocalDB(mockKey, localData);
    return result;
  }
}

// ==========================================
// API IMPLEMENTATIONS WITH LIVE/MOCK SYNC
// ==========================================

export async function getHospitales(): Promise<Hospital[]> {
  const result = await fetchWithMockFallback<Hospital>(
    `${API_BASE}/hospitales.php`,
    { method: "GET" },
    "cuidarte_hospitales",
    MOCK_HOSPITALES,
    (local) => ({ ok: true, data: local })
  );
  return result.data || [];
}

export async function searchPacientes(q: string = ""): Promise<Paciente[]> {
  const queryParam = q ? `?q=${encodeURIComponent(q)}` : "";
  const result = await fetchWithMockFallback<Paciente>(
    `${API_BASE}/pacientes.php${queryParam}`,
    { method: "GET" },
    "cuidarte_pacientes",
    MOCK_PACIENTES,
    (local) => {
      if (!q) return { ok: true, data: local };
      const lowerQ = q.toLowerCase();
      const filtered = local.filter(
        (p) =>
          p.nombre.toLowerCase().includes(lowerQ) ||
          (p.cedula && p.cedula.includes(lowerQ)) ||
          p.hospital.toLowerCase().includes(lowerQ)
      );
      return { ok: true, data: filtered };
    }
  );
  return result.data || [];
}

export async function createPaciente(payload: {
  nombre: string;
  cedula?: string;
  edad?: number;
  sexo: "Masculino" | "Femenino" | "Desconocido";
  procedencia?: string;
  hospital_id?: number | null;
  hospital_nuevo?: string;
  actualizacion_fecha?: string;
  estado?: string;
}): Promise<{ ok: boolean; id?: number; error?: string }> {
  const bodyPayload = {
    ...payload,
    ip_registro: detectedIP,
  };

  const result = await fetchWithMockFallback<Paciente>(
    `${API_BASE}/pacientes.php`,
    {
      method: "POST",
      body: JSON.stringify(bodyPayload),
    },
    "cuidarte_pacientes",
    MOCK_PACIENTES,
    (local) => {
      // Find hospital name
      const hospitals = getLocalDB<Hospital>("cuidarte_hospitales", MOCK_HOSPITALES);
      const matchedHosp = hospitals.find((h) => h.id === payload.hospital_id);
      const hospitalName = matchedHosp ? matchedHosp.nombre : (payload.hospital_nuevo ? normalizeHospitalName(payload.hospital_nuevo) : "Desconocido");

      // Check duplicate
      const isDupe = local.some(
        (p) =>
          (payload.cedula && p.cedula === payload.cedula) ||
          p.nombre.toLowerCase().trim() === payload.nombre.toLowerCase().trim()
      );

      const maskedCedula = payload.cedula
        ? `V-${payload.cedula.slice(0, Math.max(0, payload.cedula.length - 3))}.***.${payload.cedula.slice(-3)}`
        : null;

      const newId = local.length > 0 ? Math.max(...local.map((p) => p.id)) + 1 : 1000;
      const newPatient: Paciente = {
        id: newId,
        nombre: payload.nombre,
        cedula: payload.cedula,
        edad: payload.edad || null,
        sexo: payload.sexo,
        hospital: hospitalName,
        hospital_id: payload.hospital_id || null,
        actualizacion_fecha: payload.actualizacion_fecha || new Date().toISOString().split("T")[0],
        estado: payload.estado || "hospitalizado",
        posible_duplicado: isDupe,
        cedula_masked: maskedCedula,
        procedencia: payload.procedencia,
      };

      local.push(newPatient);
      return { ok: true, id: newId };
    }
  );

  return result;
}

export async function updatePaciente(
  id: number,
  payload: {
    estado?: string;
    nombre?: string;
    cedula?: string;
    edad?: number;
    sexo?: "Masculino" | "Femenino" | "Desconocido";
    procedencia?: string;
    hospital_id?: number | null;
    actualizacion_fecha?: string;
  }
): Promise<{ ok: boolean }> {
  const bodyPayload = {
    ...payload,
    ip_registro: detectedIP,
  };

  const result = await fetchWithMockFallback<Paciente>(
    `${API_BASE}/pacientes.php?id=${id}`,
    {
      method: "PUT",
      body: JSON.stringify(bodyPayload),
    },
    "cuidarte_pacientes",
    MOCK_PACIENTES,
    (local) => {
      const idx = local.findIndex((p) => p.id === id);
      if (idx !== -1) {
        const hospitals = getLocalDB<Hospital>("cuidarte_hospitales", MOCK_HOSPITALES);
        let hospitalName = local[idx].hospital;
        if (payload.hospital_id !== undefined) {
          const matchedHosp = hospitals.find((h) => h.id === payload.hospital_id);
          hospitalName = matchedHosp ? matchedHosp.nombre : "Desconocido";
        }

        const maskedCedula = payload.cedula
          ? `V-${payload.cedula.slice(0, Math.max(0, payload.cedula.length - 3))}.***.${payload.cedula.slice(-3)}`
          : local[idx].cedula_masked;

        local[idx] = {
          ...local[idx],
          ...(payload.nombre && { nombre: payload.nombre }),
          ...(payload.cedula !== undefined && { cedula: payload.cedula, cedula_masked: maskedCedula }),
          ...(payload.edad !== undefined && { edad: payload.edad }),
          ...(payload.sexo && { sexo: payload.sexo }),
          ...(payload.procedencia !== undefined && { procedencia: payload.procedencia }),
          ...(payload.hospital_id !== undefined && { hospital_id: payload.hospital_id, hospital: hospitalName }),
          ...(payload.actualizacion_fecha !== undefined && { actualizacion_fecha: payload.actualizacion_fecha }),
          ...(payload.estado !== undefined && { estado: payload.estado }),
        };
        return { ok: true };
      }
      return { ok: false };
    }
  );

  return { ok: result.ok };
}

export async function postPacientesLote(payload: {
  hospital_id?: number | null;
  hospital_nuevo?: string;
  actualizacion_fecha?: string;
  pacientes: {
    nombre: string;
    cedula?: string;
    edad?: number;
    sexo: "Masculino" | "Femenino" | "Desconocido";
    procedencia?: string;
  }[];
  updateOnDuplicate?: boolean; // Front-end custom parameter to decide overwrite/merge
}): Promise<{ ok: boolean; resultados: any[] }> {
  const bodyPayload = {
    hospital_id: payload.hospital_id,
    hospital_nuevo: payload.hospital_nuevo,
    actualizacion_fecha: payload.actualizacion_fecha,
    ip_registro: detectedIP,
    pacientes: payload.pacientes,
  };

  const result = await fetchWithMockFallback<Paciente>(
    `${API_BASE}/pacientes_lote.php`,
    {
      method: "POST",
      body: JSON.stringify(bodyPayload),
    },
    "cuidarte_pacientes",
    MOCK_PACIENTES,
    (local) => {
      const hospitals = getLocalDB<Hospital>("cuidarte_hospitales", MOCK_HOSPITALES);
      const matchedHosp = hospitals.find((h) => h.id === payload.hospital_id);
      const hospitalName = matchedHosp ? matchedHosp.nombre : (payload.hospital_nuevo ? normalizeHospitalName(payload.hospital_nuevo) : "Desconocido");

      const resultados = payload.pacientes.map((p, index) => {
        // Check duplicate in existing list
        const existingIdx = local.findIndex(
          (ep) =>
            (p.cedula && ep.cedula === p.cedula) ||
            ep.nombre.toLowerCase().trim() === p.nombre.toLowerCase().trim()
        );

        const maskedCedula = p.cedula
          ? `V-${p.cedula.slice(0, Math.max(0, p.cedula.length - 3))}.***.${p.cedula.slice(-3)}`
          : null;

        if (existingIdx !== -1) {
          if (payload.updateOnDuplicate) {
            // Overwrite/update existing record
            local[existingIdx] = {
              ...local[existingIdx],
              nombre: p.nombre,
              edad: p.edad || local[existingIdx].edad,
              sexo: p.sexo,
              procedencia: p.procedencia || local[existingIdx].procedencia,
              hospital: hospitalName,
              hospital_id: payload.hospital_id || null,
              actualizacion_fecha: payload.actualizacion_fecha || new Date().toISOString().split("T")[0],
              estado: "hospitalizado", // re-admitted or checked in
              posible_duplicado: false,
              cedula_masked: maskedCedula,
            };
            return { fila: index + 1, status: "actualizado" as const, id: local[existingIdx].id };
          } else {
            // Duplicate detected, return status duplicado
            return { fila: index + 1, status: "duplicado" as const, motivo: "Cédula o Nombre ya registrado en el hospital." };
          }
        }

        // Create new patient
        const newId = local.length > 0 ? Math.max(...local.map((lp) => lp.id)) + 1 : 1000;
        const newPatient: Paciente = {
          id: newId,
          nombre: p.nombre,
          cedula: p.cedula,
          edad: p.edad || null,
          sexo: p.sexo,
          hospital: hospitalName,
          hospital_id: payload.hospital_id || null,
          actualizacion_fecha: payload.actualizacion_fecha || new Date().toISOString().split("T")[0],
          estado: "hospitalizado",
          posible_duplicado: false,
          cedula_masked: maskedCedula,
          procedencia: p.procedencia,
        };

        local.push(newPatient);
        return { fila: index + 1, status: "creado" as const, id: newId };
      });

      return { ok: true, resultados };
    }
  );

  return {
    ok: result.ok,
    resultados: result.resultados || [],
  };
}

/**
 * Envía pacientes al motor de deduplicación (nuevo endpoint inteligente).
 * Soporta tanto paciente individual como lotes. Detecta duplicados con dos niveles:
 * cédula exacta + fuzzy (nombre/hospital/edad) y enriquece registros existentes.
 * 
 * @returns DedupReport con conteo de nuevos, mergeados, sin_cambios, errores
 */
export async function deduplicatePacientes(payload: {
  fuente?: string;
  hospital_id?: number | null;
  hospital_nuevo?: string;
  actualizacion_fecha?: string;
  pacientes: {
    nombre: string;
    cedula?: string;
    edad?: number;
    sexo: "Masculino" | "Femenino" | "Desconocido";
    procedencia?: string;
    estado?: string;
  }[];
}): Promise<DedupReport> {
  const bodyPayload = {
    fuente: payload.fuente || "admin_web",
    hospital_id: payload.hospital_id,
    hospital_nuevo: payload.hospital_nuevo,
    actualizacion_fecha: payload.actualizacion_fecha,
    pacientes: payload.pacientes,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (volunteerCode) {
    headers["X-Codigo-Voluntario"] = volunteerCode;
  }

  console.log("[API CALL] POST /sync.php", {
    pacientesCount: payload.pacientes.length,
  });

  try {
    const params = volunteerCode ? `?codigo=${encodeURIComponent(volunteerCode)}` : '';
    const res = await fetch(`${API_BASE}/sync.php${params}`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
    });

    if (res.ok) {
      const data = await res.json();
      return data as DedupReport;
    }

    const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errorData.error || `Error del servidor (${res.status})`);
  } catch (err: any) {
    console.error("[Dedup] Error:", err);
    // Fallback: retornar un reporte de error
    return {
      ok: false,
      total_recibidos: payload.pacientes.length,
      nuevos: 0,
      mergeados: 0,
      sin_cambios: 0,
      errores: payload.pacientes.length,
      detalle: payload.pacientes.map((p, i) => ({
        fila: i + 1,
        nombre: p.nombre,
        accion: "error" as const,
        id: 0,
        motivo: err.message || "Error de conexión",
      })),
    };
  }
}

export async function getTransportes(): Promise<Transporte[]> {
  const result = await fetchWithMockFallback<Transporte>(
    `${API_BASE}/transporte.php`,
    { method: "GET" },
    "cuidarte_transporte",
    MOCK_TRANSPORTE,
    (local) => ({ ok: true, data: local })
  );
  return result.data || [];
}

export async function createTransporte(payload: {
  nombre: string;
  telefono: string;
  ciudad: string;
  vehiculo: string;
  capacidad_personas: number;
  capacidad_carga: string;
  notas?: string;
  cedula: string; // PIN de seguridad
}): Promise<{ ok: boolean; data?: Transporte }> {
  const bodyPayload = {
    ...payload,
    ip_registro: detectedIP,
  };

  const result = await fetchWithMockFallback<Transporte>(
    `${API_BASE}/transporte.php`,
    {
      method: "POST",
      body: JSON.stringify(bodyPayload),
    },
    "cuidarte_transporte",
    MOCK_TRANSPORTE,
    (local) => {
      const newId = local.length > 0 ? Math.max(...local.map((t) => t.id)) + 1 : 1;
      const newT: Transporte = {
        id: newId,
        nombre: payload.nombre,
        telefono: payload.telefono,
        ciudad: payload.ciudad,
        vehiculo: payload.vehiculo,
        capacidad_personas: payload.capacidad_personas,
        capacidad_carga: payload.capacidad_carga,
        disponible: true,
        notas: payload.notas || null,
        cedula: payload.cedula,
      };
      local.push(newT);
      return { ok: true, data: newT };
    }
  );

  return {
    ok: result.ok,
    data: result.data,
  };
}

export async function updateTransporte(payload: {
  id: number;
  cedula: string;
  disponible?: boolean;
  nombre?: string;
  telefono?: string;
  ciudad?: string;
  vehiculo?: string;
  capacidad_personas?: number;
  capacidad_carga?: string;
  notas?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const bodyPayload = {
    ...payload,
    ip_registro: detectedIP,
  };

  const result = await fetchWithMockFallback<Transporte>(
    `${API_BASE}/transporte.php`,
    {
      method: "PUT",
      body: JSON.stringify(bodyPayload),
    },
    "cuidarte_transporte",
    MOCK_TRANSPORTE,
    (local) => {
      const idx = local.findIndex((t) => t.id === payload.id);
      if (idx === -1) {
        return { ok: false, error: "Recurso no encontrado" };
      }
      // Security Validation of Cédula PIN
      if (local[idx].cedula !== payload.cedula) {
        return { ok: false, error: "Cédula/PIN incorrecto. No autorizado para modificar este recurso." };
      }

      local[idx] = {
        ...local[idx],
        ...(payload.disponible !== undefined && { disponible: payload.disponible }),
        ...(payload.nombre && { nombre: payload.nombre }),
        ...(payload.telefono && { telefono: payload.telefono }),
        ...(payload.ciudad && { ciudad: payload.ciudad }),
        ...(payload.vehiculo && { vehiculo: payload.vehiculo }),
        ...(payload.capacidad_personas !== undefined && { capacidad_personas: payload.capacidad_personas }),
        ...(payload.capacidad_carga !== undefined && { capacidad_carga: payload.capacidad_carga }),
        ...(payload.notas !== undefined && { notas: payload.notas }),
      };
      return { ok: true };
    }
  );

  return {
    ok: result.ok,
    error: result.error,
  };
}

export async function deleteTransporte(id: number, cedula: string): Promise<{ ok: boolean; error?: string }> {
  const bodyPayload = {
    id,
    cedula,
    ip_registro: detectedIP,
  };

  const result = await fetchWithMockFallback<Transporte>(
    `${API_BASE}/transporte.php`,
    {
      method: "DELETE",
      body: JSON.stringify(bodyPayload),
    },
    "cuidarte_transporte",
    MOCK_TRANSPORTE,
    (local) => {
      const idx = local.findIndex((t) => t.id === id);
      if (idx === -1) {
        return { ok: false, error: "Recurso no encontrado" };
      }
      if (local[idx].cedula !== cedula) {
        return { ok: false, error: "Cédula/PIN incorrecto. No autorizado para eliminar este recurso." };
      }
      local.splice(idx, 1);
      return { ok: true };
    }
  );

  return {
    ok: result.ok,
    error: result.error,
  };
}
