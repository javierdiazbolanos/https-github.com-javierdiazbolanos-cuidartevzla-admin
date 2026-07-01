/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { ParsedPaciente, Hospital } from "../types";
import { getHospitales, normalizeHospitalName } from "../utils/api";
import { getTesseractWorker, preprocessImage, parseOCRWords, loadOpenCV, isOpenCVLoaded, homologateName } from "../utils/ocr";
import { llmOCRPage, avgBatchConfidence, shouldUseLLMFallback } from "../utils/llm-ocr";
import { Upload, Clipboard, Camera, Image as ImageIcon, Sparkles, RefreshCw, Eye, AlertCircle, Trash2, FileText, Bot, ZoomIn, ZoomOut, RotateCw, Move } from "lucide-react";

interface MassiveLoaderProps {
  onBatchLoaded: (patients: ParsedPaciente[], pages?: { pageNum: number; dataUrl: string; originalDataUrl?: string }[]) => void;
  onToast?: (msg: string) => void;
}

export default function MassiveLoader({ onBatchLoaded, onToast }: MassiveLoaderProps) {
  const [hospitales, setHospitales] = useState<Hospital[]>([]);

  useEffect(() => {
    getHospitales().then((list) => {
      setHospitales(list);
    }).catch((err) => {
      console.error("[MassiveLoader] Error fetching hospitals:", err);
    });
  }, []);

  const [activeTab, setActiveTab] = useState<"paste" | "ocr">("paste");
  
  // --- TAB 1: PASTE / CSV / EXCEL STATE ---
  const [pasteText, setPasteText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- TAB 2: OCR SCANNER STATE ---
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStep, setOcrStep] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [processedPages, setProcessedPages] = useState<{ pageNum: number; dataUrl: string; originalDataUrl?: string }[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  
  // --- INTERACTIVE PREVIEW ZOOM & PAN ---
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewOffsetX, setPreviewOffsetX] = useState(0);
  const [previewOffsetY, setPreviewOffsetY] = useState(0);
  const [previewPanning, setPreviewPanning] = useState(false);
  const [previewPanStart, setPreviewPanStart] = useState({ x: 0, y: 0 });
  const previewTouchStartDistRef = useRef<number>(0);
  const previewTouchStartZoomRef = useRef<number>(1);

  // Reset zoom & pan when switching page or image
  useEffect(() => {
    setPreviewZoom(1);
    setPreviewOffsetX(0);
    setPreviewOffsetY(0);
    setPreviewPanning(false);
  }, [selectedPageIndex, capturedImage]);
  const [opencvLoaded, setOpencvLoaded] = useState(false);
  const [usingLLM, setUsingLLM] = useState(false);          // Si está usando fallback LLM
  const [llmPagesDone, setLlmPagesDone] = useState(0);      // Páginas procesadas por LLM
  const [llmPagesTotal, setLlmPagesTotal] = useState(0);    // Total páginas a procesar por LLM
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Pre-load OpenCV in the background when active tab changes to OCR
  useEffect(() => {
    if (activeTab === "ocr") {
      setOcrStep("Iniciando motor de binarización OpenCV.js...");
      loadOpenCV().then((success) => {
        setOpencvLoaded(success);
        setOcrStep("");
      });
    }
  }, [activeTab]);

  // Clean up camera stream
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // ==========================================
  // PARSING & IMPORT LOGIC FOR TEXT / CSV / EXCEL
  // ==========================================

  const handleTextPasteParse = () => {
    if (!pasteText.trim()) return;

    // Detect delimiter
    const lines = pasteText.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;

    // Sample first line to detect delimiter (tab, semicolon, comma)
    const sample = lines[0];
    let delimiter = ",";
    if (sample.includes("\t")) delimiter = "\t";
    else if (sample.includes(";")) delimiter = ";";

    const parsedRows = lines.map((line) => {
      // Split line keeping quoted fields intact or simple split
      const columns = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""));
      return columns;
    });

    processParsedMatrix(parsedRows);
    setPasteText("");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".pdf")) {
      // === PDF HANDLING via pdf.js ===
      setActiveTab("ocr");
      setOcrLoading(true);
      setOcrStep("Analizando PDF...");
      setOcrProgress(0);
      
      try {
        const arrayBuf = await file.arrayBuffer();
        const pdfjsLib = await import("pdfjs-dist");
        const pdfVersion = pdfjsLib.version || "6.1.200";
        if (pdfVersion.startsWith("6.")) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfVersion}/build/pdf.worker.min.mjs`;
        } else {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfVersion}/pdf.worker.min.mjs`;
        }
        
        const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
        const totalPages = pdf.numPages;
        setOcrProgress(5);

        // === FASE 1: Intentar extraer texto directamente (PDF estructurado) ===
        let allTextLines: string[] = [];
        
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          setOcrStep(`Leyendo texto página ${pageNum} de ${totalPages}...`);
          setOcrProgress(5 + Math.round((pageNum / totalPages) * 10));
          
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Agrupar items de texto por línea (basado en coordenada Y)
          const lineMap = new Map<number, string[]>();
          for (const item of textContent.items) {
            if (!("str" in item)) continue;
            const txt = (item as any).str?.trim();
            if (!txt) continue;
            const y = Math.round((item as any).transform?.[5] || 0);
            if (!lineMap.has(y)) lineMap.set(y, []);
            lineMap.get(y)!.push(txt);
          }
          
          // Ordenar líneas de arriba hacia abajo
          const sortedYs = [...lineMap.keys()].sort((a, b) => b - a); // Y crece hacia abajo en PDF
          for (const y of sortedYs) {
            allTextLines.push(lineMap.get(y)!.join(" "));
          }
        }

        // === DECISIÓN INTELIGENTE: ¿PDF estructurado o imagen? ===
        const allText = allTextLines.join(" ");
        const totalTextChars = allText.replace(/\s/g, "").length;

        // Heurística: no basta con tener >50 chars — el texto debe contener
        // palabras que parezcan nombres reales o números tipo cédula.
        const words = allText.split(/\s+/).filter((w: string) => w.length > 2);
        const validNameWords = words.filter((w: string) => {
          const cleaned = w.replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/g, "");
          if (cleaned.length < 3) return false;
          const vowels = (cleaned.match(/[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]/g) || []).length;
          return vowels / cleaned.length > 0.25; // al menos 25% vocales = palabra real
        });
        const cedulaLike = words.filter((w: string) => {
          const digits = w.replace(/\D/g, "");
          return digits.length >= 6 && digits.length <= 9;
        });

        const isStructured =
          totalTextChars > 50 &&
          (validNameWords.length >= 3 || cedulaLike.length >= 2);

        console.log(
          `[PDF Detect] chars=${totalTextChars} words=${words.length} ` +
          `validNames=${validNameWords.length} cedulas=${cedulaLike.length} ` +
          `→ isStructured=${isStructured}`
        );
        
        if (isStructured) {
          // ✅ PDF ESTRUCTURADO — parse directo como texto
          setOcrStep("PDF estructurado detectado. Parseando columnas...");
          setOcrProgress(80);
          
          const matrix = allTextLines
            .filter(l => l.trim().length > 0)
            .map(line => {
              // Detectar delimitador (tab o múltiples espacios)
              const delimiter = line.includes("\t") ? "\t" : /\s{2,}/;
              return line.split(delimiter).map(c => c.trim()).filter(c => c.length > 0);
            })
            .filter(row => row.length >= 2); // Mínimo 2 columnas
          
          processParsedMatrix(matrix);
        } else {
          // ❌ PDF IMAGEN — pipeline OCR
          setOcrStep("PDF es imagen escaneada. Activando OCR...");
          setOcrProgress(15);
          setProcessedPages([]);
          setSelectedPageIndex(0);
          
          const allPatients: ParsedPaciente[] = [];
          const tempPages: { pageNum: number; dataUrl: string; originalDataUrl?: string }[] = [];

          for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            setOcrStep(`Renderizando página ${pageNum} de ${totalPages} para OCR...`);
            setOcrProgress(15 + Math.round((pageNum / totalPages) * 15));

            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 3.0 });

            const offCanvas = document.createElement("canvas");
            offCanvas.width = viewport.width;
            offCanvas.height = viewport.height;
            const offCtx = offCanvas.getContext("2d")!;

            await page.render({
              canvasContext: offCtx,
              viewport: viewport,
            } as any).promise;

            const pageResult = await processOCRCanvasPage(offCanvas, pageNum, totalPages, true);
            console.log(`[PDF PROCESS] Página ${pageNum}/${totalPages}: ${pageResult.patients.length} pacientes extraídos`);
            allPatients.push(...pageResult.patients);
            
            tempPages.push({ pageNum, dataUrl: pageResult.dataUrl, originalDataUrl: pageResult.originalDataUrl });
            setProcessedPages([...tempPages]);
            setCapturedImage(pageResult.dataUrl);
            setSelectedPageIndex(tempPages.length - 1);
          }
          
          if (allPatients.length > 0) {
            onBatchLoaded(allPatients, tempPages);
          } else {
            onToast?.("No se pudieron extraer pacientes del PDF. La imagen es muy borrosa — active la cámara o use un PDF de mejor calidad.");
          }
        }
        
        setOcrLoading(false);
        setOcrStep("");
        setUsingLLM(false);
      } catch (err) {
        console.error("Error procesando PDF:", err);
        onToast?.("Error al procesar el PDF. Verifique que no esté corrupto o protegido.");
        setOcrLoading(false);
        setOcrStep("");
        setUsingLLM(false);
      }
      return;
    }

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".ods")) {
      // Parse Excel (.xlsx/.xls) or OpenDocument (.ods) locally
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          processParsedMatrix(jsonData);
        } catch (err) {
          onToast?.("Error leyendo archivo de Excel u ODS. Asegúrese de que no esté corrupto.");
        }
      };
      reader.readAsBinaryString(file);
    } else {
      // Parse CSV or Text
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        
        // Detect delimiter
        const sample = lines[0] || "";
        let delimiter = ",";
        if (sample.includes("\t")) delimiter = "\t";
        else if (sample.includes(";")) delimiter = ";";

        const rows = lines.map((l) => l.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, "")));
        processParsedMatrix(rows);
      };
      reader.readAsText(file);
    }
  };

  const findFuzzyHospital = (rawName: string): Hospital | null => {
    if (!rawName) return null;
    
    // Clean and normalize the raw input before any destructive filtering
    let cleanRaw = rawName.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
      .trim();

    // Strip common prefixes/phrases aggressively, keeping any trailing content intact
    cleanRaw = cleanRaw
      .replace(/^(ingresado|ingresada|ingresados|trasladado|trasladada|trasladados)\s+(al|a|en|el|la|x\s+sismo\s+a)[\s:]+/i, "")
      .replace(/^(hospitalized in|admitted to|admitted|hospitalized)[\s:]+/i, "")
      .replace(/^[:\-\s]+/, "")
      .trim();

    // Strip trailing CI/C.I. or Cedula information if it got appended to the hospital cell
    cleanRaw = cleanRaw.replace(/\bci[\s:]*\d+.*$/i, "").replace(/\bc\.i\.?[\s:]*\d+.*$/i, "").trim();

    // Now remove non-alphanumeric for matching, but keep words separated
    cleanRaw = cleanRaw.replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
      
    if (!cleanRaw) return null;

    // Hardcoded shortcuts for very common patterns in this application
    if (cleanRaw.includes("perez carreno") || cleanRaw.includes("perez carreño")) {
      const h = hospitales.find(x => x.id === 4);
      if (h) return h;
    }
    if (cleanRaw.includes("domingo luciani") || cleanRaw.includes("luciani")) {
      const h = hospitales.find(x => x.id === 3);
      if (h) return h;
    }
    if (cleanRaw.includes("universitario") || cleanRaw.includes("huc")) {
      const h = hospitales.find(x => x.id === 1);
      if (h) return h;
    }
    if (cleanRaw.includes("j m de los rios") || cleanRaw.includes("jm de los rios") || cleanRaw.includes("rios")) {
      const h = hospitales.find(x => x.id === 2);
      if (h) return h;
    }
    if (cleanRaw.includes("maracay")) {
      const h = hospitales.find(x => x.id === 5);
      if (h) return h;
    }
    if (cleanRaw.includes("valencia")) {
      const h = hospitales.find(x => x.id === 6);
      if (h) return h;
    }

    // Try normal substring matches first (including name + all synonyms!)
    for (const h of hospitales) {
      const namesToTry = [h.nombre, ...(h.sinonimos || [])];
      for (const name of namesToTry) {
        const cleanHosp = name.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, " ")
          .trim();
        if (cleanRaw.includes(cleanHosp) || cleanHosp.includes(cleanRaw)) {
          return h;
        }
      }
    }

    // Keyword-overlap/intersection scoring (fuzzy keyword matching) with synonyms support
    const userWords = cleanRaw.split(/\s+/).filter(w => w.length > 0);
    const stopWords = new Set([
      "hospital", "dr", "dra", "de", "del", "la", "las", "lo", "los", "y", "e", "en", "o", "u", "el", "al", 
      "general", "regional", "estado", "ingresado", "ingresada", "ingresados", "sismo", "v", "ci", "cedula", "cédula", 
      "con", "para", "por", "un", "una", "unos", "unas"
    ]);

    // Filter user words to keep only specific keywords
    const userKeywords = userWords.filter(w => !stopWords.has(w));
    if (userKeywords.length === 0) return null;

    let bestMatch: Hospital | null = null;
    let highestScore = 0;
    let bestMatchKeywordCount = 0;

    for (const h of hospitales) {
      const namesToTry = [h.nombre, ...(h.sinonimos || [])];
      for (const name of namesToTry) {
        const cleanHospName = name.toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, " ")
          .trim();

        const hospWords = cleanHospName.split(/\s+/).filter(w => w.length > 0);
        const hospKeywords = hospWords.filter(w => !stopWords.has(w));

        if (hospKeywords.length === 0) continue;

        // Count how many of the hospital's specific keywords are found in the user keywords
        const matchingKeywords = hospKeywords.filter(w => userKeywords.includes(w));
        const score = matchingKeywords.length;

        // Require a minimum match to avoid false positives
        const requiredMatch = hospKeywords.length <= 2 ? 1 : 2;

        if (score >= requiredMatch) {
          // Calculate the percentage match relative to the hospital's own keyword count
          const pctMatch = score / hospKeywords.length;
          if (pctMatch > highestScore) {
            highestScore = pctMatch;
            bestMatch = h;
            bestMatchKeywordCount = score;
          } else if (pctMatch === highestScore && score > bestMatchKeywordCount) {
            // Tie-breaker: choose the one with more absolute matching keywords
            bestMatch = h;
            bestMatchKeywordCount = score;
          }
        }
      }
    }

    return bestMatch;
  };

  const normalizeDate = (raw: string): string => {
    if (!raw) return new Date().toISOString().split("T")[0];
    const trimmed = raw.trim();
    if (!trimmed) return new Date().toISOString().split("T")[0];
    
    // Check if it is a numeric serial date (e.g., from Excel)
    const num = Number(trimmed);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      // Excel serial date to JS Date
      const utcDays = num - 25569;
      const dateMs = utcDays * 86400 * 1000;
      const d = new Date(dateMs);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }

    // Check if it's already in YYYY-MM-DD format (including possible time suffix)
    const mIso = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(T|\s|$)/);
    if (mIso) {
      const year = mIso[1];
      const month = mIso[2].padStart(2, "0");
      const day = mIso[3].padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    // MM/DD/YY or MM/DD/YYYY or DD/MM/YY or DD/MM/YYYY
    const m1 = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s|$)/);
    if (m1) {
      const first = parseInt(m1[1], 10);
      const second = parseInt(m1[2], 10);
      let year = m1[3];
      if (year.length === 2) year = "20" + year;

      let month = second;
      let day = first;

      // If the first is > 12 and second <= 12, then it's DD/MM/YYYY
      if (first > 12 && second <= 12) {
        day = first;
        month = second;
      }
      // If the second is > 12 and first <= 12, then it's MM/DD/YYYY
      else if (second > 12 && first <= 12) {
        day = second;
        month = first;
      }
      // Default fallback: assume DD/MM/YYYY
      else {
        day = first;
        month = second;
      }

      // Safeguard month and day ranges
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    // Standard JS Date parsing as fallback
    const parsedMs = Date.parse(trimmed);
    if (!isNaN(parsedMs)) {
      const d = new Date(parsedMs);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    
    return trimmed;
  };

  /**
   * Processes a grid matrix of text cells.
   * Maps headers dynamically or defaults to standard order.
   */
  const processParsedMatrix = (matrix: any[][]) => {
    if (matrix.length === 0) return;

    let headersIndexMap = {
      nombre: -1,
      cedula: -1,
      edad: -1,
      sexo: -1,
      procedencia: -1,
      estado: -1,
      hospital: -1,
      fecha: -1,
    };

    let startRow = 0;
    let headerRowIndex = -1;
    
    // Scan up to the first 10 rows of the matrix to identify the actual header row
    const maxScanRows = Math.min(matrix.length, 10);
    for (let i = 0; i < maxScanRows; i++) {
      const row = matrix[i];
      if (!row || !Array.isArray(row)) continue;
      
      const cleanRow = row.map((cell) => String(cell || "").toLowerCase().trim());
      
      let keywordCount = 0;
      cleanRow.forEach((cell) => {
        if (/nombre|completo|paciente|name/i.test(cell)) keywordCount++;
        else if (/c[eé]dula|\bc\.?i\.?\b|\bid\b|identificaci/i.test(cell)) keywordCount++;
        else if (/edad|a[ñn]o|age/i.test(cell)) keywordCount++;
        else if (/sexo|g[eé]nero|sex|gen/i.test(cell)) keywordCount++;
        else if (/procedencia|proceden|origen|municipio|sector/i.test(cell)) keywordCount++;
        else if (/hospital|centro|cl[ií]nica|asistencial/i.test(cell)) keywordCount++;
        else if (/fecha|actuali|actua|\bact\b|date/i.test(cell)) keywordCount++;
      });
      
      if (keywordCount >= 2) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex !== -1) {
      startRow = headerRowIndex + 1;
      const headerRow = matrix[headerRowIndex].map((h) => String(h || "").toLowerCase().trim());
      
      headerRow.forEach((h, index) => {
        if (/nombre|completo|paciente|name/i.test(h)) headersIndexMap.nombre = index;
        else if (/c[eé]dula|\bc\.?i\.?\b|\bid\b|identificaci[oó]n|documento|v-|nro[ _]doc|n[o°][ _]doc/i.test(h)) headersIndexMap.cedula = index;
        else if (/edad|a[ñn]o|age|años|anos/i.test(h)) headersIndexMap.edad = index;
        else if (/sexo|g[eé]nero|sex|gen/i.test(h)) headersIndexMap.sexo = index;
        else if (/procedencia|proceden|origen|municipio|sector|direcci[oó]n|residencia/i.test(h)) headersIndexMap.procedencia = index;
        else if (/motivo|estado|condici[oó]n|status|observaci[oó]n|diagn[oó]stico|situaci[oó]n|actual/i.test(h)) headersIndexMap.estado = index;
        else if (/hospital|ingresados x sismo|centro|cl[ií]nica|clinica|centro asistencial|asistencia|centro de salud|establecimiento/i.test(h)) headersIndexMap.hospital = index;
        else if (/fecha|actuali|actua|\bact\b|date|registro|creado/i.test(h)) headersIndexMap.fecha = index;
      });
    }

    // Fallback index mapping if headers are absent or incomplete
    if (
      headersIndexMap.nombre === -1 &&
      headersIndexMap.cedula === -1 &&
      headersIndexMap.edad === -1
    ) {
      headersIndexMap = {
        nombre: 0,
        cedula: 1,
        edad: 2,
        sexo: 3,
        procedencia: 4,
        estado: 5,
        hospital: -1,
        fecha: -1,
      };
      startRow = 0;
    }

    const parsedPatients: ParsedPaciente[] = [];

    for (let r = startRow; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.length === 0) continue;

      let rawNombre = headersIndexMap.nombre !== -1 ? String(row[headersIndexMap.nombre] || "") : "";
      const rawCedula = headersIndexMap.cedula !== -1 ? String(row[headersIndexMap.cedula] || "").replace(/\D/g, "") : "";

      // Skip empty or noisy lines
      if ((!rawNombre || rawNombre.trim().length < 2) && (!rawCedula || rawCedula.length < 4)) {
        continue;
      }

      // If we have a Cédula but name is missing or too short, assign a placeholder
      if (!rawNombre || rawNombre.trim().length < 2) {
        rawNombre = "Paciente S/N (" + (rawCedula || "S/C") + ")";
      }
      const rawEdad = headersIndexMap.edad !== -1 ? parseInt(String(row[headersIndexMap.edad] || ""), 10) : undefined;
      const rawSexoRaw = headersIndexMap.sexo !== -1 ? String(row[headersIndexMap.sexo] || "").toLowerCase().trim() : "";
      const rawProcedencia = headersIndexMap.procedencia !== -1 ? String(row[headersIndexMap.procedencia] || "") : "";
      const rawEstado = headersIndexMap.estado !== -1 ? String(row[headersIndexMap.estado] || "").toLowerCase().trim() : "";
      const rawHospital = headersIndexMap.hospital !== -1 ? String(row[headersIndexMap.hospital] || "").trim() : "";
      const rawFecha = headersIndexMap.fecha !== -1 ? String(row[headersIndexMap.fecha] || "").trim() : "";

      let mappedSexo: "Masculino" | "Femenino" | "Desconocido" = "Desconocido";
      if (/^m(asc)?(ulino)?|h(ombre)?/i.test(rawSexoRaw)) mappedSexo = "Masculino";
      else if (/^f(em)?(enino)?|m(ujer)?/i.test(rawSexoRaw)) mappedSexo = "Femenino";

      // Mapear estado/motivo a valores canónicos, default is "hospitalizado"
      let mappedEstado = "hospitalizado";
      if (rawEstado) {
        if (/hospitalizado|hospital|ingresado|internado|recluido|activo|en tratamiento|tratamiento|estable|observacion|observación|moderado/i.test(rawEstado))
          mappedEstado = "hospitalizado";
        else if (/alta|egreso|egresado|curado|recuperado|sano|saludable/i.test(rawEstado))
          mappedEstado = "alta";
        else if (/referido|trasladado|derivado|remitido|transferido|enviado/i.test(rawEstado))
          mappedEstado = "referido";
        else if (/fallecido|muerto|deceso|difunto|falleci|óbito|obito|finado|fatal/i.test(rawEstado))
          mappedEstado = "fallecido";
        else if (/critico|crítico|grave|uci|intensivo|emergencia|urgencia/i.test(rawEstado))
          mappedEstado = "hospitalizado"; // crítico = hospitalizado
        else if (/leve|ambulatorio|consulta|externo/i.test(rawEstado))
          mappedEstado = "hospitalizado"; // ambulatorio = hospitalizado
        else
          mappedEstado = rawEstado; // Conservar valor original si no mapea
      } else {
        mappedEstado = "hospitalizado"; // Default explicitly to "hospitalizado" when empty
      }

      // Fuzzy search mapping for the center
      let hospId: number | null = null;
      let hospNombre: string | undefined = undefined;

      if (rawHospital) {
        const fuzzyHosp = findFuzzyHospital(rawHospital);
        if (fuzzyHosp) {
          hospId = fuzzyHosp.id;
          hospNombre = fuzzyHosp.nombre;
        } else {
          hospNombre = normalizeHospitalName(rawHospital); // Store as dynamic/new hospital (normalized)
        }
      }

      const normalizedFecha = rawFecha ? normalizeDate(rawFecha) : new Date().toISOString().split("T")[0];

      parsedPatients.push({
        id_temporal: Math.random().toString(36).substring(2, 9),
        nombre: homologateName(rawNombre),
        cedula: rawCedula || undefined,
        edad: isNaN(Number(rawEdad)) ? undefined : rawEdad,
        sexo: mappedSexo,
        procedencia: rawProcedencia.trim() || undefined,
        estado: mappedEstado,
        confianza_ocr: 100, // Imputed from file/manual upload
        status_verificacion: "pendiente",
        hospital_id: hospId,
        hospital_nombre: hospNombre,
        actualizacion_fecha: normalizedFecha,
      });
    }

    if (parsedPatients.length > 0) {
      onBatchLoaded(parsedPatients);
    } else {
      onToast?.("No se detectaron pacientes válidos. Verifique el formato de las columnas (Nombre, Cédula, Edad, Sexo, Procedencia).");
    }
  };

  // ==========================================
  // CAMERA & OCR SCANNER LOGIC
  // ==========================================

  const startCamera = async () => {
    setCapturedImage(null);
    setCameraActive(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("No se pudo iniciar la cámara:", err);
      onToast?.("Error al iniciar cámara. Verifique permisos del navegador o use un dispositivo con cámara.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/png");
    setCapturedImage(dataUrl);
    stopCamera();
    
    // Automatically trigger processing
    processOCRImage(canvas);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);

        setCapturedImage(canvas.toDataURL("image/png"));
        processOCRImage(canvas);
      };
      img.src = URL.createObjectURL(file);
    }
  };

  /**
   * Pipeline híbrido: Tesseract.js → si confianza < 70% → LLM fallback
   * @param canvas Canvas con la imagen a procesar
   * @param pageNum Número de página (para logs y UI)
   * @param totalPages Total de páginas (para progreso)
   * @param isPDF Indica si la fuente es un PDF (afecta mensajes)
   */
  const handlePDFUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const processOCRCanvasPage = async (
    canvas: HTMLCanvasElement,
    pageNum: number,
    totalPages: number,
    isPDF: boolean = false
  ): Promise<{ patients: ParsedPaciente[]; dataUrl: string; originalDataUrl: string }> => {
    // Keep a copy of the original raw image before processing
    const originalDataUrl = canvas.toDataURL("image/png");

    // 1. Preprocess with OpenCV (grayscale, binarize, threshold)
    const tempImg = new Image();
    return new Promise((resolve) => {
      tempImg.onload = async () => {
        const procCanvas = document.createElement("canvas");
        procCanvas.width = canvas.width;
        procCanvas.height = canvas.height;
        const procCtx = procCanvas.getContext("2d")!;
        procCtx.drawImage(tempImg, 0, 0);
        
        preprocessImage(tempImg, procCanvas);
        
        const progressBase = 25 + (isPDF ? 0 : 0);
        setOcrProgress(progressBase);
        
        const preprocessedDataUrl = procCanvas.toDataURL("image/png");
        // Update preview with preprocessed image
        setCapturedImage(preprocessedDataUrl);

        // 2. Tesseract OCR
        setOcrStep(isPDF 
          ? `OCR página ${pageNum}/${totalPages} con Tesseract.js...`
          : "Iniciando motor de reconocimiento OCR en Español...");
        const worker = await getTesseractWorker((progressPct) => {
          setOcrProgress(progressBase + Math.round(progressPct * 0.5));
        });

        setOcrStep("Ejecutando reconocimiento de caracteres (OCR)...");
        const { data } = await worker.recognize(procCanvas);
        const words = data?.words || [];
        
        console.log(`[Tesseract] Palabras detectadas: ${words.length}`);

        setOcrStep("Agrupando coordenadas espaciales y analizando campos...");
        const parsedPatients = parseOCRWords(words);
        
        // Diagnóstico
        const tesseractConf = parsedPatients.length > 0
          ? parsedPatients.reduce((s: number, p: any) => s + (p.confianza_ocr || 0), 0) / parsedPatients.length
          : 0;
        console.log(
          `[OCR] Página ${pageNum}: ${words.length} palabras → ` +
          `${parsedPatients.length} pacientes (conf avg=${Math.round(tesseractConf)}%)`
        );

        // 3. Decidir si usar LLM fallback
        const useLLM = shouldUseLLMFallback(parsedPatients);
        console.log(`[LLM Decision] shouldUseLLM=${useLLM} patients=${parsedPatients.length}`);
        
        if (useLLM) {
          setOcrProgress(75);
          setUsingLLM(true);
          
          if (isPDF) {
            setLlmPagesTotal(totalPages);
            setLlmPagesDone(pageNum);
          }
          
          setOcrStep(isPDF
            ? `Tesseract baja confianza → IA página ${pageNum}/${totalPages}...`
            : "Tesseract baja confianza → Mejorando con IA (Gemini Flash)...");
          
          try {
            const llmPatients = await llmOCRPage(procCanvas, pageNum, (msg) => {
              setOcrStep(msg);
            });
            
            if (llmPatients.length > 0) {
              setOcrProgress(95);
              setUsingLLM(false);
              resolve({ patients: llmPatients, dataUrl: preprocessedDataUrl, originalDataUrl });
              return;
            }
            setOcrStep("La IA no identificó ningún paciente nuevo.");
          } catch (llmErr: any) {
            console.error("[MassiveLoader] Error al llamar a la IA de OCR:", llmErr);
            onToast?.(`⚠️ Falló la mejora con IA: ${llmErr.message || llmErr}`);
            setOcrStep(`Error de IA: ${llmErr.message || "Error desconocido"}`);
          }
          // Si LLM también falla, usar resultado de Tesseract
          setOcrStep("IA no pudo procesar. Usando resultado local de Tesseract.");
        }
        
        setOcrProgress(95);
        setUsingLLM(false);
        resolve({ patients: parsedPatients, dataUrl: preprocessedDataUrl, originalDataUrl });
      };
      tempImg.src = canvas.toDataURL();
    });
  };

  const processOCRImage = async (canvas: HTMLCanvasElement) => {
    setOcrLoading(true);
    setOcrProgress(0);
    setProcessedPages([]);
    setSelectedPageIndex(0);

    try {
      const result = await processOCRCanvasPage(canvas, 1, 1, false);
      
      if (result.patients.length > 0) {
        onBatchLoaded(result.patients, [{ pageNum: 1, dataUrl: result.dataUrl, originalDataUrl: result.originalDataUrl }]);
      } else {
        onToast?.("No se pudieron extraer datos de la imagen. Intente con una foto más nítida o ingrese los datos manualmente.");
      }
      setProcessedPages([{ pageNum: 1, dataUrl: result.dataUrl, originalDataUrl: result.originalDataUrl }]);
      setSelectedPageIndex(0);
      setCapturedImage(result.dataUrl);
      setOcrLoading(false);
      setOcrStep("");
    } catch (err) {
      console.error(err);
      onToast?.("Error durante el procesamiento OCR. Revise la consola para más detalles.");
      setOcrLoading(false);
      setOcrStep("");
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden font-sans">
      {/* TABS HEADER */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setActiveTab("paste")}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "paste"
              ? "border-sky-600 text-sky-700 bg-white"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:bg-slate-100/30"
          }`}
        >
          <Clipboard className="w-4 h-4" />
          <span>Pegar Lista o Archivos (CSV / Excel)</span>
        </button>
        <button
          onClick={() => setActiveTab("ocr")}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeTab === "ocr"
              ? "border-sky-600 text-sky-700 bg-white"
              : "border-transparent text-slate-500 hover:text-slate-850 hover:bg-slate-100/30"
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Escanear Foto Listado (OCR Local)</span>
        </button>
      </div>

      <div className="p-6">
        {/* TAB 1: CLIPBOARD AND FILE DRAG DROP */}
        {activeTab === "paste" && (
          <div className="space-y-6">
            <div className="text-left">
              <h3 className="text-sm font-bold text-slate-800">Importar por Texto o Archivos</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Copie y pegue filas desde Excel, Google Sheets, WhatsApp, o arrastre directamente un archivo Excel (.xlsx), ODS (.ods) o CSV.
              </p>
            </div>

            {/* Paste Textarea */}
            <div className="space-y-2">
              <textarea
                rows={4}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Pegue aquí el texto tabulado... (Ejemplo: Juan Pérez [Tab] 19284758 [Tab] 34 [Tab] Masculino [Tab] La Vega)"
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none font-mono"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleTextPasteParse}
                  disabled={!pasteText.trim()}
                  className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors flex items-center space-x-1 cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Procesar Texto Pegado</span>
                </button>
              </div>
            </div>

            {/* Separator */}
            <div className="relative flex items-center justify-center">
              <hr className="w-full border-slate-200" />
              <span className="absolute bg-white px-3 text-xs text-slate-400 font-mono">O TAMBIÉN</span>
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                dragActive
                  ? "border-sky-500 bg-sky-500/5"
                  : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv, .xlsx, .xls, .ods, .pdf"
                className="hidden"
              />
              <Upload className="w-10 h-10 text-slate-400 mb-2" />
              <span className="text-sm font-semibold text-slate-700">Arrastre su archivo aquí</span>
              <span className="text-xs text-slate-400 mt-1">Soporta Excel (.xlsx), ODS (.ods), CSV, y PDFs con listados escaneados</span>
            </div>
          </div>
        )}

        {/* TAB 2: IMAGE OCR SCANNER */}
        {activeTab === "ocr" && (
          <div className="space-y-6">
            <div className="text-left flex justify-between items-start">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                  <span>Escanear Listado Escrito / Impreso</span>
                  <span className="bg-sky-50 text-sky-700 border border-sky-200 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase">
                    Local + IA
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cargue una foto o PDF escaneado. Si la imagen es borrosa, la IA (Gemini Flash) se activa automáticamente.
                </p>
              </div>

              {/* Status Indicator */}
              <div className="text-right">
                <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full ${
                  opencvLoaded ? "bg-sky-50 text-sky-700 border border-sky-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}>
                  OpenCV: {opencvLoaded ? "Listo" : "Cargando..."}
                </span>
              </div>
            </div>

            {/* Warning banner */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start space-x-2 text-yellow-800 text-xs text-left font-sans shadow-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-600" />
              <span>
                <strong>Nota Importante:</strong> El resultado del OCR es aproximado y puede variar según la nitidez e iluminación. Por favor verifique cada celda en la <strong>Tabla de Revisión</strong> antes de guardar.
              </span>
            </div>

            {/* CAMERA STAGE / PREVIEW */}
            <div className="relative min-h-[250px] bg-slate-50 rounded-xl overflow-hidden border border-slate-200 flex flex-col items-center justify-center shadow-inner">
              {/* HIDDEN WORKING CANVAS FOR PROCESSING */}
              <canvas ref={canvasRef} className="hidden" />

              {cameraActive ? (
                /* LIVE VIDEO VIEW */
                <div className="relative w-full aspect-video md:aspect-auto md:h-[350px]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {/* Camera overlays - bracket guide lines */}
                  <div className="absolute inset-4 border-2 border-dashed border-sky-500/40 rounded-lg pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] font-mono uppercase bg-slate-900/95 text-sky-400 px-3 py-1.5 rounded-md tracking-wider border border-sky-500">
                      Alinee el listado aquí
                    </span>
                  </div>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-3">
                    <button
                      onClick={capturePhoto}
                      className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg flex items-center space-x-1.5 text-sm transition-all cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Capturar Foto</span>
                    </button>
                    <button
                      onClick={stopCamera}
                      className="bg-white hover:bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors border border-slate-200 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : capturedImage ? (
                /* PHOTO PREVIEW STAGE */
                <div className="relative w-full flex flex-col items-center p-4">
                  {/* INTERACTIVE ZOOM & PAN PREVIEW CONTAINER */}
                  <div
                    className={`relative w-full max-w-lg aspect-[4/3] h-[320px] overflow-hidden bg-slate-950 rounded-xl border border-slate-200 flex items-center justify-center select-none shadow-inner ${
                      previewPanning ? "cursor-grabbing" : "cursor-grab"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setPreviewPanning(true);
                      setPreviewPanStart({ x: e.clientX - previewOffsetX, y: e.clientY - previewOffsetY });
                    }}
                    onMouseMove={(e) => {
                      if (!previewPanning) return;
                      setPreviewOffsetX(e.clientX - previewPanStart.x);
                      setPreviewOffsetY(e.clientY - previewPanStart.y);
                    }}
                    onMouseUp={() => setPreviewPanning(false)}
                    onMouseLeave={() => setPreviewPanning(false)}
                    onWheel={(e) => {
                      e.preventDefault();
                      const zoomFactor = 1.15;
                      if (e.deltaY < 0) {
                        setPreviewZoom(s => Math.min(s * zoomFactor, 6));
                      } else {
                        setPreviewZoom(s => Math.max(s / zoomFactor, 1));
                      }
                    }}
                    onTouchStart={(e) => {
                      if (e.touches.length === 1) {
                        setPreviewPanning(true);
                        setPreviewPanStart({
                          x: e.touches[0].clientX - previewOffsetX,
                          y: e.touches[0].clientY - previewOffsetY,
                        });
                      } else if (e.touches.length === 2) {
                        setPreviewPanning(false);
                        const dx = e.touches[0].clientX - e.touches[1].clientX;
                        const dy = e.touches[0].clientY - e.touches[1].clientY;
                        previewTouchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
                        previewTouchStartZoomRef.current = previewZoom;
                      }
                    }}
                    onTouchMove={(e) => {
                      if (e.touches.length === 1 && previewPanning) {
                        setPreviewOffsetX(e.touches[0].clientX - previewPanStart.x);
                        setPreviewOffsetY(e.touches[0].clientY - previewPanStart.y);
                      } else if (e.touches.length === 2) {
                        const dx = e.touches[0].clientX - e.touches[1].clientX;
                        const dy = e.touches[0].clientY - e.touches[1].clientY;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (previewTouchStartDistRef.current > 0) {
                          const ratio = dist / previewTouchStartDistRef.current;
                          setPreviewZoom(Math.max(1, Math.min(previewTouchStartZoomRef.current * ratio, 6)));
                        }
                      }
                    }}
                    onTouchEnd={() => {
                      setPreviewPanning(false);
                      previewTouchStartDistRef.current = 0;
                    }}
                  >
                    {/* Inner container that receives transforms */}
                    <div
                      style={{
                        transform: `translate(${previewOffsetX}px, ${previewOffsetY}px) scale(${previewZoom})`,
                        transition: previewPanning ? "none" : "transform 0.1s ease-out",
                      }}
                      className="max-w-[90%] max-h-[90%] flex items-center justify-center select-none"
                    >
                      <img
                        src={processedPages[selectedPageIndex]?.dataUrl || capturedImage}
                        alt={`Página ${selectedPageIndex + 1}`}
                        className="max-h-[280px] w-auto object-contain select-none pointer-events-none rounded"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Quick overlay controls */}
                    <div className="absolute top-2 right-2 flex items-center space-x-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewZoom(s => Math.min(s * 1.25, 6));
                        }}
                        className="p-1 hover:bg-slate-800 text-white rounded transition-colors cursor-pointer"
                        title="Aumentar Zoom (+)"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewZoom(s => Math.max(s / 1.25, 1));
                        }}
                        className="p-1 hover:bg-slate-800 text-white rounded transition-colors cursor-pointer"
                        title="Disminuir Zoom (-)"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewZoom(1);
                          setPreviewOffsetX(0);
                          setPreviewOffsetY(0);
                        }}
                        className="px-1.5 py-0.5 text-[9px] font-mono hover:bg-slate-800 text-white rounded transition-colors cursor-pointer"
                        title="Restaurar Vista"
                      >
                        Restablecer
                      </button>
                    </div>

                    {processedPages.length > 1 && (
                      <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-mono px-2 py-1 rounded shadow-md font-bold">
                        Pág. {selectedPageIndex + 1} / {processedPages.length}
                      </div>
                    )}

                    {/* Instruction helper text */}
                    <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none">
                      <span className="bg-slate-950/80 text-slate-300 border border-slate-800/50 text-[9px] font-mono px-2.5 py-1 rounded-full">
                        Rueda/Pellizca para zoom · Arrastra para mover
                      </span>
                    </div>
                  </div>

                  {/* Thumbnail list to inspect optimization quality for all pages */}
                  {processedPages.length > 0 && (
                    <div className="w-full mt-4 border-t border-slate-100 pt-3">
                      <label className="block text-[10px] font-mono text-slate-400 font-semibold uppercase tracking-wider mb-2 text-left">
                        Inspección de Páginas Procesadas ({processedPages.length} pág.)
                      </label>
                      <div className="flex items-center space-x-2.5 overflow-x-auto pb-2 scrollbar-thin">
                        {processedPages.map((page, idx) => {
                          const isActive = idx === selectedPageIndex;
                          return (
                            <button
                              key={page.pageNum}
                              onClick={() => setSelectedPageIndex(idx)}
                              className={`relative flex-shrink-0 w-14 h-18 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                isActive
                                  ? "border-sky-600 ring-2 ring-sky-500/10 shadow-md scale-105"
                                  : "border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100"
                              }`}
                            >
                              <img
                                src={page.dataUrl}
                                alt={`TMB Pág ${page.pageNum}`}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute bottom-0 inset-x-0 bg-slate-950/70 text-white text-[9px] font-mono py-0.5 text-center font-bold">
                                Pág. {page.pageNum}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Navigation controls for multi-page PDF documents */}
                  {processedPages.length > 1 && (
                    <div className="flex items-center space-x-3 mt-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                      <button
                        onClick={() => setSelectedPageIndex(prev => Math.max(0, prev - 1))}
                        disabled={selectedPageIndex === 0}
                        className="bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-xs border border-slate-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <span className="text-xs font-mono font-semibold text-slate-600">
                        Página {selectedPageIndex + 1} de {processedPages.length}
                      </span>
                      <button
                        onClick={() => setSelectedPageIndex(prev => Math.min(processedPages.length - 1, prev + 1))}
                        disabled={selectedPageIndex === processedPages.length - 1}
                        className="bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-xs border border-slate-200 transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        Siguiente
                      </button>
                    </div>
                  )}

                  <div className="mt-4 flex items-center space-x-3">
                    <button
                      onClick={startCamera}
                      className="bg-white hover:bg-slate-50 text-sky-700 font-semibold px-4 py-2 rounded-lg text-xs border border-slate-200 cursor-pointer"
                    >
                      Tomar Nueva Foto
                    </button>
                    <button
                      onClick={() => {
                        setCapturedImage(null);
                        setProcessedPages([]);
                        setSelectedPageIndex(0);
                      }}
                      className="bg-white hover:bg-slate-50 text-rose-600 font-semibold px-4 py-2 rounded-lg text-xs border border-slate-200 cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              ) : (
                /* INACTIVE PLACEHOLDER GRID */
                <div className="p-4 sm:p-8 text-center flex flex-col items-center">
                  <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3 mb-4 w-full max-w-xs sm:max-w-none">
                    <button
                      onClick={startCamera}
                      id="btn-open-camera"
                      className="w-full sm:w-auto bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 py-3 rounded-xl shadow-md transition-colors flex items-center justify-center space-x-2 text-sm cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>📷 Activar Cámara</span>
                    </button>
                    <label className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 font-semibold px-5 py-3 rounded-xl transition-colors flex items-center justify-center space-x-2 text-sm cursor-pointer shadow-sm">
                      <ImageIcon className="w-4 h-4 text-sky-600" />
                      <span>🖼️ Subir Imagen</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                    <label className="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-400 font-bold px-5 py-3 rounded-xl transition-colors flex items-center justify-center space-x-2 text-sm cursor-pointer shadow-sm">
                      <FileText className="w-4 h-4 text-rose-600" />
                      <span>📄 Subir PDF</span>
                      <input type="file" ref={pdfInputRef} accept=".pdf" onChange={handlePDFUpload} className="hidden" />
                    </label>
                  </div>
                  <p className="text-xs text-slate-400">
                    Cámara, imágenes (PNG/JPG), o PDFs escaneados. El pipeline OCR + IA se activa automáticamente.
                  </p>
                </div>
              )}

              {/* ACTIVE PROCESSING PANEL OVERLAY */}
              {ocrLoading && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-fadeIn z-30">
                  {usingLLM ? (
                    <Bot className="w-10 h-10 text-purple-600 animate-pulse mb-4" />
                  ) : (
                    <RefreshCw className="w-10 h-10 text-sky-600 animate-spin mb-4" />
                  )}
                  <span className="text-sm font-semibold text-slate-800">{ocrStep}</span>
                  
                  {/* Progress bar */}
                  <div className="w-64 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-3">
                    <div
                      className={`h-full transition-all duration-200 ${usingLLM ? "bg-purple-500" : "bg-sky-500"}`}
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-1">{ocrProgress}% completado</span>
                  {usingLLM && (
                    <span className="text-[10px] font-mono text-purple-600 mt-2 bg-purple-50 px-2 py-0.5 rounded-full">
                      🤖 Usando IA para mejorar precisión
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
