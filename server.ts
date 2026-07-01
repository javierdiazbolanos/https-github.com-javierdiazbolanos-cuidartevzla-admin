import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  const EXHAUSTIVE_HOSPITALES = [
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

  function normalizeHospitalName(name: string): string {
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

  // JSON request body parser with generous limit for large image/PDF uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ==========================================
  // SERVER PERSISTENT DATABASE ENGINE (MOCK DB)
  // ==========================================
  const DB_FILE = path.join(process.cwd(), "cuidarte_db.json");

  function loadDb() {
    const defaultDb = {
      cargas: [
        { id: 1001, timestamp: "2026-06-25 14:32:10", ip_hex: "c0a80101", codigo: "15731877", num_registros: 5 },
      ],
      pacientes: [
        { id: 101, nombre: "Carlos Eduardo Mendoza", edad: 42, sexo: "Masculino", hospital: "Hospital Universitario de Caracas (HUC)", hospital_id: 1, actualizacion_fecha: "2026-06-25", estado: "hospitalizado", posible_duplicado: false, cedula: "15341256", procedencia: "La Vega, Caracas", carga_id: 1001 },
        { id: 102, nombre: "María Alejandra Rivas", edad: 29, sexo: "Femenino", hospital: "Hospital Domingo Luciani", hospital_id: 3, actualizacion_fecha: "2026-06-26", estado: "hospitalizado", posible_duplicado: false, cedula: "21908332", procedencia: "Petare, Miranda", carga_id: 1001 },
        { id: 103, nombre: "José Gregorio Hernández", edad: 67, sexo: "Masculino", hospital: "Hospital J.M. de los Ríos", hospital_id: 2, actualizacion_fecha: "2026-06-25", estado: "referido", posible_duplicado: false, cedula: "8112345", procedencia: "Antímano, Caracas", carga_id: 1001 },
        { id: 104, nombre: "Carmen Elena Uzcátegui", edad: 75, sexo: "Femenino", hospital: "Hospital Universitario de Caracas (HUC)", hospital_id: 1, actualizacion_fecha: "2026-06-24", estado: "alta", posible_duplicado: false, cedula: "4781992", procedencia: "El Valle, Caracas", carga_id: 1001 },
        { id: 105, nombre: "Luis Alejandro Blanco", edad: 16, sexo: "Masculino", hospital: "Hospital Dr. Miguel Pérez Carreño", hospital_id: 4, actualizacion_fecha: "2026-06-27", estado: "hospitalizado", posible_duplicado: true, cedula: "30554122", procedencia: "Chacao, Miranda", carga_id: 1001 },
      ],
      hospitales: EXHAUSTIVE_HOSPITALES
    };

    if (fs.existsSync(DB_FILE)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(fileContent);
        return {
          cargas: parsed.cargas || defaultDb.cargas,
          pacientes: parsed.pacientes || defaultDb.pacientes,
          hospitales: EXHAUSTIVE_HOSPITALES // Always enforce the latest exhaustive hospital list
        };
      } catch (e) {
        console.error("Error leyendo cuidarte_db.json, re-inicializando", e);
      }
    }
    return defaultDb;
  }

  function saveDb(data: any) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error("Error guardando cuidarte_db.json", e);
    }
  }

  // Pre-seed database on server start
  const initialDb = loadDb();
  saveDb(initialDb);

  // API Route: superuser_status.php
  app.get("/api/superuser_status.php", (req, res) => {
    const codigo = req.query.codigo as string;
    const is_superuser = ["15731877", "9999", "admin", "123456"].includes(codigo?.trim());
    res.json({ is_superuser });
  });

  // API Route: hospital_list.php or hospitales.php
  app.get("/api/hospitales.php", (req, res) => {
    const db = loadDb();
    res.json({ ok: true, data: db.hospitales });
  });

  // API Route: carga_log.php
  app.get("/api/carga_log.php", (req, res) => {
    const db = loadDb();
    res.json({ ok: true, cargas: db.cargas });
  });

  app.delete("/api/carga_log.php", (req, res) => {
    const id = parseInt(req.query.id as string, 10);
    const code = (req.query.codigo as string) || (req.headers["x-codigo-voluntario"] as string);
    console.log(`[Cargas Server] Solicitud de eliminación de carga #${id} por código ${code}`);
    
    const isSuperuser = ["15731877", "9999", "admin", "123456"].includes(code?.trim());
    if (!isSuperuser) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }

    const db = loadDb();
    const initialCargasLength = db.cargas.length;
    db.cargas = db.cargas.filter((c: any) => c.id !== id);
    
    const initialPacientesLength = db.pacientes.length;
    db.pacientes = db.pacientes.filter((p: any) => p.carga_id !== id);
    const pacientesEliminados = initialPacientesLength - db.pacientes.length;

    saveDb(db);
    res.json({ ok: true, pacientes_eliminados: pacientesEliminados });
  });

  // API Route: sync.php (Deduplication engine)
  app.post("/api/sync.php", (req, res) => {
    console.log("[Sync Server] Iniciando proceso de deduplicación de lote...");
    const db = loadDb();
    const payload = req.body;
    
    if (!payload || !payload.pacientes || !Array.isArray(payload.pacientes)) {
      return res.status(450).json({ ok: false, error: "Formato de payload inválido" });
    }

    const volunteerCodeValue = (req.query.codigo as string) || (req.headers["x-codigo-voluntario"] as string) || "15731877";

    // Create a new load identifier
    const newCargaId = db.cargas.length > 0 ? Math.max(...db.cargas.map((c: any) => c.id)) + 1 : 1001;
    const newCarga = {
      id: newCargaId,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      ip_hex: "7f000001",
      codigo: volunteerCodeValue,
      num_registros: payload.pacientes.length,
    };
    db.cargas.push(newCarga);

    let nuevos = 0;
    let mergeados = 0;
    let sin_cambios = 0;
    let errores = 0;

    const details = payload.pacientes.map((p: any, idx: number) => {
      if (!p.nombre || p.nombre.trim().length < 3) {
        errores++;
        return {
          fila: idx + 1,
          nombre: p.nombre || "Sin nombre",
          accion: "error",
          id: 0,
          motivo: "Nombre demasiado corto o inválido",
        };
      }

      // Check if patient exists by Cédula
      let matchedPatient = null;
      if (p.cedula && p.cedula.trim()) {
        matchedPatient = db.pacientes.find((dp: any) => dp.cedula === p.cedula.trim());
      }

      // Check if exists by name (exact or very similar start)
      if (!matchedPatient) {
        matchedPatient = db.pacientes.find((dp: any) => 
          dp.nombre.toLowerCase().trim() === p.nombre.toLowerCase().trim()
        );
      }

      if (matchedPatient) {
        // Merge or sin_cambios
        let changed = false;
        
        if (p.edad !== undefined && p.edad !== matchedPatient.edad) {
          matchedPatient.edad = p.edad;
          changed = true;
        }
        if (p.sexo && p.sexo !== "Desconocido" && p.sexo !== matchedPatient.sexo) {
          matchedPatient.sexo = p.sexo;
          changed = true;
        }
        if (p.procedencia && p.procedencia.trim() && p.procedencia !== matchedPatient.procedencia) {
          matchedPatient.procedencia = p.procedencia;
          changed = true;
        }
        if (p.estado && p.estado !== "desconocido" && p.estado !== matchedPatient.estado) {
          matchedPatient.estado = p.estado;
          changed = true;
        }
        if (p.hospital_id !== undefined && p.hospital_id !== null && p.hospital_id !== matchedPatient.hospital_id) {
          matchedPatient.hospital_id = p.hospital_id;
          matchedPatient.hospital = db.hospitales.find((h: any) => h.id === p.hospital_id)?.nombre || matchedPatient.hospital;
          changed = true;
        } else if (p.hospital_nuevo && p.hospital_nuevo !== matchedPatient.hospital) {
          matchedPatient.hospital = normalizeHospitalName(p.hospital_nuevo);
          matchedPatient.hospital_id = undefined;
          changed = true;
        }
        if (p.actualizacion_fecha && p.actualizacion_fecha !== matchedPatient.actualizacion_fecha) {
          matchedPatient.actualizacion_fecha = p.actualizacion_fecha;
          changed = true;
        }

        if (changed) {
          mergeados++;
          return {
            fila: idx + 1,
            nombre: p.nombre,
            accion: "merge",
            id: matchedPatient.id,
            motivo: "Se encontraron coincidencias parciales. Datos actualizados.",
          };
        } else {
          sin_cambios++;
          return {
            fila: idx + 1,
            nombre: p.nombre,
            accion: "sin_cambios",
            id: matchedPatient.id,
            motivo: "El paciente ya está registrado con la misma información.",
          };
        }
      } else {
        // Create new patient
        nuevos++;
        const newPatientId = db.pacientes.length > 0 ? Math.max(...db.pacientes.map((pa: any) => pa.id)) + 1 : 101;
        
        const newPatient = {
          id: newPatientId,
          nombre: p.nombre.trim(),
          cedula: p.cedula?.trim() || undefined,
          edad: p.edad,
          sexo: p.sexo || "Desconocido",
          hospital: p.hospital_id ? db.hospitales.find((h: any) => h.id === p.hospital_id)?.nombre : (p.hospital_nuevo ? normalizeHospitalName(p.hospital_nuevo) : "Ambulatorio Temporal / Desconocido"),
          hospital_id: p.hospital_id || undefined,
          actualizacion_fecha: p.actualizacion_fecha || new Date().toISOString().split("T")[0],
          estado: p.estado || "hospitalizado",
          procedencia: p.procedencia?.trim() || undefined,
          carga_id: newCargaId,
        };

        db.pacientes.push(newPatient);
        return {
          fila: idx + 1,
          nombre: p.nombre,
          accion: "nuevo",
          id: newPatientId,
          motivo: "Paciente registrado como ingreso nuevo.",
        };
      }
    });

    saveDb(db);
    console.log(`[Sync Server] Sincronización finalizada. Nuevos: ${nuevos}, Mergeados: ${mergeados}, Sin cambios: ${sin_cambios}`);
    
    res.json({
      ok: true,
      total_recibidos: payload.pacientes.length,
      nuevos,
      mergeados,
      sin_cambios,
      errores,
      detalle: details,
    });
  });

  // API Route: procesar_con_llm.php
  app.post("/api/procesar_con_llm.php", async (req, res) => {
    console.log("[LLM Server Proxy] Recibida petición de procesamiento OCR");
    
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("[LLM Server Proxy] OPENROUTER_API_KEY no definida en .env");
      return res.status(400).json({
        ok: false,
        error: "La API key de OpenRouter no está configurada en el servidor (.env)"
      });
    }

    const { image, page_num } = req.body;
    if (!image) {
      console.error("[LLM Server Proxy] Petición rechazada: Falta la imagen");
      return res.status(400).json({
        ok: false,
        error: "No se proporcionó el payload de la imagen en formato base64"
      });
    }

    try {
      let modelToUse = "google/gemini-2.5-flash";
      let response;
      let fallbackAttempted = false;

      const systemPrompt = `Analiza la imagen que representa un listado de pacientes de hospitalización, traslados o ingresos médicos en una contingencia sísmica.
Extrae la información de cada paciente que aparezca en la imagen de forma estructurada.

Formato requerido (JSON estricto):
{
  "ok": true,
  "pacientes": [
    {
      "nombre": "NOMBRE COMPLETO",
      "cedula": "CÉDULA DE IDENTIDAD (solo números, sin puntos ni letras, ej: '12345678')",
      "edad": EDAD_NÚMERO,
      "sexo": "Masculino" | "Femenino",
      "procedencia": "PROCEDENCIA O DIRECCIÓN"
    }
  ]
}

Reglas importantes:
1. El campo "sexo" solo debe ser "Masculino" o "Femenino".
2. El campo "cedula" debe contener únicamente caracteres numéricos. Si no es legible o no está, omítelo o déjalo vacío.
3. Si la edad es ilegible o no se indica, déjala vacía u omítela.
4. Responde ÚNICAMENTE con el objeto JSON válido. No incluyas explicaciones, comentarios, ni bloques de código de markdown. Evita usar triple comillas o texto explicativo.`;

      console.log(`[LLM Server Proxy] Intentando con modelo primario: ${modelToUse} para página: ${page_num || 1}`);
      
      try {
        response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ais-pre-kqmqotk5fjkoh6fqv47oht-199281048515.us-west1.run.app",
            "X-Title": "Cuidarte Venezuela Admin"
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: systemPrompt
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: image
                    }
                  }
                ]
              }
            ],
            response_format: {
              type: "json_object"
            }
          })
        });
      } catch (fetchError: any) {
        console.error("[LLM Server Proxy] Error de red con modelo primario, gatillando fallback:", fetchError.message);
      }

      // Si la petición al modelo de pago falló o no dio ok, intentamos con el modelo de visión gratuito
      if (!response || !response.ok) {
        const errText = response ? await response.text() : "Fallo de conexión";
        console.warn(`[LLM Server Proxy] Modelo primario (${modelToUse}) falló. Error: ${errText}. Iniciando fallback automático con nvidia/nemotron-nano-12b-v2-vl:free...`);
        
        fallbackAttempted = true;
        modelToUse = "nvidia/nemotron-nano-12b-v2-vl:free";

        response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ais-pre-kqmqotk5fjkoh6fqv47oht-199281048515.us-west1.run.app",
            "X-Title": "Cuidarte Venezuela Admin"
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: systemPrompt
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: image
                    }
                  }
                ]
              }
            ],
            response_format: {
              type: "json_object"
            }
          })
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[LLM Server Proxy] Error final de OpenRouter API con ${modelToUse}:`, errText);
        
        let customMessage = "Error en el servidor de IA (OpenRouter)";
        try {
          const parsedErr = JSON.parse(errText);
          if (parsedErr?.error?.message) {
            const msg = parsedErr.error.message;
            if (response.status === 402 || msg.toLowerCase().includes("credits") || msg.toLowerCase().includes("balance")) {
              customMessage = "Créditos insuficientes en la cuenta de OpenRouter (Error 402). Por favor, añade fondos en OpenRouter o configura una clave activa en tu .env.";
            } else {
              customMessage = `OpenRouter (${modelToUse}): ${msg}`;
            }
          }
        } catch (_) {
          if (errText.toLowerCase().includes("credits") || errText.toLowerCase().includes("insufficient")) {
            customMessage = "Créditos insuficientes en la cuenta de OpenRouter (Error 402). Por favor, añade fondos en OpenRouter o configura una clave activa en tu .env.";
          } else {
            customMessage = `Error de OpenRouter (${modelToUse}): ${errText}`;
          }
        }

        return res.status(response.status).json({
          ok: false,
          error: customMessage
        });
      }

      const data: any = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        console.error(`[LLM Server Proxy] Respuesta de OpenRouter (${modelToUse}) no tiene contenido`);
        return res.status(500).json({
          ok: false,
          error: `No se recibió respuesta del modelo de IA (${modelToUse})`
        });
      }

      console.log(`[LLM Server Proxy] Respuesta cruda recibida de ${modelToUse}:`, content);

      // Limpieza de posibles bloques markdown ```json ... ```
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      // Reemplazo robusto para corregir errores de estructura de arrays malformados (ej. :][ por :[ o : )
      cleanedContent = cleanedContent.replace(/:\s*\]\s*\[/g, ": [");
      cleanedContent = cleanedContent.replace(/:\s*\]/g, ": ");

      let parsedJSON: any;
      try {
        parsedJSON = JSON.parse(cleanedContent);
      } catch (parseError: any) {
        console.warn("[LLM Server Proxy] Standard JSON.parse falló, intentando reparar/extraer bloques:", parseError.message);
        
        // Función interna de extracción ultra-robusta de pacientes a partir de bloques malformados
        const extractPatientsFromMalformedText = (text: string): any[] => {
          const patients: any[] = [];
          // Encontrar cualquier bloque entre llaves que parezca un objeto de paciente
          const blocks = text.match(/\{[^{}]*"(?:nombre|name)"[^{}]*\}/gi);
          if (blocks) {
            for (const block of blocks) {
              try {
                const nombreMatch = block.match(/"(?:nombre|name)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
                const cedulaMatch = block.match(/"(?:cedula|documento|ci|identificacion)"\s*:\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|(\d+))/i);
                const edadMatch = block.match(/"(?:edad|anos|years)"\s*:\s*(\d+)/i);
                const sexoMatch = block.match(/"(?:sexo|genero)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
                const procedenciaMatch = block.match(/"(?:procedencia|cedencia|direccion|proceden)"\s*:\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|\[\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*\])/i);

                if (nombreMatch) {
                  const nombre = nombreMatch[1];
                  let cedula = "";
                  if (cedulaMatch) {
                    cedula = (cedulaMatch[1] || cedulaMatch[2] || "").replace(/\D/g, "");
                  }
                  const edad = edadMatch ? parseInt(edadMatch[1], 10) : undefined;
                  const sexo = sexoMatch ? sexoMatch[1] : "Desconocido";
                  const procedencia = procedenciaMatch ? (procedenciaMatch[1] || procedenciaMatch[2] || "") : "";

                  patients.push({
                    nombre,
                    cedula,
                    edad,
                    sexo,
                    procedencia
                  });
                }
              } catch (singleErr) {
                console.warn("[LLM Server Proxy] Error al parsear bloque de paciente individual:", singleErr);
              }
            }
          }
          return patients;
        };

        const salvagedPatients = extractPatientsFromMalformedText(cleanedContent);
        if (salvagedPatients.length > 0) {
          parsedJSON = {
            ok: true,
            pacientes: salvagedPatients
          };
          console.log(`[LLM Server Proxy] Se recuperaron ${salvagedPatients.length} pacientes usando extracción por bloques`);
        } else {
          // Si no se puede salvar nada, lanzamos el error original
          throw parseError;
        }
      }

      console.log(`[LLM Server Proxy] Pacientes extraídos exitosamente usando ${modelToUse}: ${parsedJSON?.pacientes?.length || 0}`);
      
      // Indicamos al cliente si se usó el fallback transparente
      return res.json({
        ...parsedJSON,
        _fallback_used: fallbackAttempted,
        _model_used: modelToUse
      });
    } catch (error: any) {
      console.error("[LLM Server Proxy] Error procesando la petición:", error);
      return res.status(500).json({
        ok: false,
        error: error.message || "Error interno del proxy LLM OCR"
      });
    }
  });

  // Serve Vite in dev mode or static files in production mode
  if (process.env.NODE_ENV !== "production") {
    console.log("[LLM Server Proxy] Iniciando Vite en modo de desarrollo middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[LLM Server Proxy] Iniciando en modo producción para servir activos estáticos...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[LLM Server Proxy] Servidor full-stack escuchando en http://localhost:${PORT}`);
  });
}

startServer();
