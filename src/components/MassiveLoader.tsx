/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { ParsedPaciente } from "../types";
import { getTesseractWorker, preprocessImage, parseOCRWords, loadOpenCV, isOpenCVLoaded } from "../utils/ocr";
import { Upload, Clipboard, Camera, Image as ImageIcon, Sparkles, RefreshCw, Eye, AlertCircle, Trash2 } from "lucide-react";

interface MassiveLoaderProps {
  onBatchLoaded: (patients: ParsedPaciente[]) => void;
}

export default function MassiveLoader({ onBatchLoaded }: MassiveLoaderProps) {
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
  const [opencvLoaded, setOpencvLoaded] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  const handleFile = (file: File) => {
    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      // Parse Excel (.xlsx) locally
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          processParsedMatrix(jsonData);
        } catch (err) {
          alert("Error leyendo archivo de Excel. Asegúrese de que no esté corrupto.");
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
    };

    const firstRow = matrix[0].map((h) => String(h).toLowerCase().trim());
    
    // Check if first row looks like header keywords
    const isHeaderRow = firstRow.some((h) =>
      /nombre|completo|cedula|cédula|edad|sexo|genero|procedencia|origen|municipio/.test(h)
    );

    let startRow = 0;
    if (isHeaderRow) {
      startRow = 1;
      firstRow.forEach((h, index) => {
        if (/nombre|completo|paciente|name/.test(h)) headersIndexMap.nombre = index;
        else if (/cedula|cédula|id|identificacion|documento|v-/.test(h)) headersIndexMap.cedula = index;
        else if (/edad|años|anos|age/.test(h)) headersIndexMap.edad = index;
        else if (/sexo|genero|género|sex/.test(h)) headersIndexMap.sexo = index;
        else if (/procedencia|origen|municipio|sector|direccion|dirección/.test(h)) headersIndexMap.procedencia = index;
      });
    }

    // Fallback index mapping if headers are absent
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
      };
    }

    const parsedPatients: ParsedPaciente[] = [];

    for (let r = startRow; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.length === 0) continue;

      const rawNombre = headersIndexMap.nombre !== -1 ? String(row[headersIndexMap.nombre] || "") : "";
      if (!rawNombre || rawNombre.trim().length < 3) continue; // Skip header noise or empty lines

      const rawCedula = headersIndexMap.cedula !== -1 ? String(row[headersIndexMap.cedula] || "").replace(/\D/g, "") : "";
      const rawEdad = headersIndexMap.edad !== -1 ? parseInt(String(row[headersIndexMap.edad] || ""), 10) : undefined;
      const rawSexoRaw = headersIndexMap.sexo !== -1 ? String(row[headersIndexMap.sexo] || "").toLowerCase().trim() : "";
      const rawProcedencia = headersIndexMap.procedencia !== -1 ? String(row[headersIndexMap.procedencia] || "") : "";

      let mappedSexo: "Masculino" | "Femenino" | "Desconocido" = "Desconocido";
      if (/^m(asc)?(ulino)?|h(ombre)?/i.test(rawSexoRaw)) mappedSexo = "Masculino";
      else if (/^f(em)?(enino)?|m(ujer)?/i.test(rawSexoRaw)) mappedSexo = "Femenino";

      parsedPatients.push({
        id_temporal: Math.random().toString(36).substring(2, 9),
        nombre: rawNombre.trim(),
        cedula: rawCedula || undefined,
        edad: isNaN(Number(rawEdad)) ? undefined : rawEdad,
        sexo: mappedSexo,
        procedencia: rawProcedencia.trim() || undefined,
        confianza_ocr: 100, // Imputed from file/manual upload
        status_verificacion: "pendiente",
      });
    }

    if (parsedPatients.length > 0) {
      onBatchLoaded(parsedPatients);
    } else {
      alert("No se detectaron pacientes válidos. Por favor verifique el formato de las columnas.");
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
      alert("Error al iniciar cámara. Se requiere permiso o dispositivo de captura.");
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

  const processOCRImage = async (canvas: HTMLCanvasElement) => {
    setOcrLoading(true);
    setOcrProgress(0);
    setOcrStep("Procesando imagen local con OpenCV.js...");

    try {
      // 1. Preprocess with OpenCV (grayscale, binarize, threshold)
      // Pass the canvas and let preprocess draw back onto the same canvas
      const dummyImg = new Image();
      dummyImg.onload = async () => {
        preprocessImage(dummyImg, canvas);
        setOcrProgress(15);

        // Update the captured image preview with the high-contrast preprocessed view!
        setCapturedImage(canvas.toDataURL("image/png"));

        // 2. Load Tesseract.js Worker
        setOcrStep("Iniciando motor de reconocimiento OCR en Español...");
        const worker = await getTesseractWorker((progressPct) => {
          setOcrProgress(30 + Math.round(progressPct * 0.7)); // Scale progress mapping
        });

        setOcrStep("Ejecutando reconocimiento de caracteres (OCR)...");
        const { data } = await worker.recognize(canvas);
        
        setOcrStep("Agrupando coordenadas espaciales y analizando campos...");
        const parsedPatients = parseOCRWords(data.words);

        if (parsedPatients.length > 0) {
          onBatchLoaded(parsedPatients);
        } else {
          alert("No se pudieron extraer datos de la imagen. Por favor intente con una foto más nítida o ingrese manualmente.");
        }
        setOcrLoading(false);
        setOcrStep("");
      };
      dummyImg.src = canvas.toDataURL();

    } catch (err) {
      console.error(err);
      alert("Error durante el procesamiento OCR. Fallando a ingreso de texto.");
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
                Copie y pegue filas desde Excel, Google Sheets, WhatsApp, o arrastre directamente un archivo Excel (.xlsx) o CSV.
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
                accept=".csv, .xlsx, .xls"
                className="hidden"
              />
              <Upload className="w-10 h-10 text-slate-400 mb-2" />
              <span className="text-sm font-semibold text-slate-700">Arrastre su archivo aquí</span>
              <span className="text-xs text-slate-400 mt-1">Soporta hojas de cálculo de Excel (.xlsx) y archivos .csv</span>
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
                    100% Local WASM
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Utilice la cámara de su teléfono o cargue una foto para extraer la tabla mediante algoritmos de inteligencia visual integrados.
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
                <div className="relative w-full md:max-h-[350px] flex flex-col items-center">
                  <img
                    src={capturedImage}
                    alt="Scanned raw"
                    className="max-h-[280px] w-auto object-contain rounded-lg border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                  <div className="mt-4 flex items-center space-x-3 pb-4">
                    <button
                      onClick={startCamera}
                      className="bg-white hover:bg-slate-50 text-sky-700 font-semibold px-4 py-2 rounded-lg text-xs border border-slate-200 cursor-pointer"
                    >
                      Tomar Nueva Foto
                    </button>
                    <button
                      onClick={() => setCapturedImage(null)}
                      className="bg-white hover:bg-slate-50 text-rose-600 font-semibold px-4 py-2 rounded-lg text-xs border border-slate-200 cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              ) : (
                /* INACTIVE PLACEHOLDER GRID */
                <div className="p-8 text-center flex flex-col items-center">
                  <div className="flex space-x-4 mb-4">
                    <button
                      onClick={startCamera}
                      id="btn-open-camera"
                      className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-5 py-3 rounded-xl shadow-md transition-colors flex items-center space-x-1.5 text-sm cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Activar Cámara</span>
                    </button>
                    <label className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 font-semibold px-5 py-3 rounded-xl transition-colors flex items-center space-x-1.5 text-sm cursor-pointer shadow-sm">
                      <ImageIcon className="w-4 h-4 text-sky-600" />
                      <span>Subir Imagen</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-400">
                    Soporta formatos PNG, JPG o capturas directas en vivo.
                  </p>
                </div>
              )}

              {/* ACTIVE PROCESSING PANEL OVERLAY */}
              {ocrLoading && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-fadeIn z-30">
                  <RefreshCw className="w-10 h-10 text-sky-600 animate-spin mb-4" />
                  <span className="text-sm font-semibold text-slate-800">{ocrStep}</span>
                  
                  {/* Progress bar */}
                  <div className="w-64 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-3">
                    <div
                      className="bg-sky-500 h-full transition-all duration-200"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-1">{ocrProgress}% completado</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
