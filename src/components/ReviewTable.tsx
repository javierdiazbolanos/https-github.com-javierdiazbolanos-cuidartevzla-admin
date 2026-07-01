/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Hospital, Paciente, ParsedPaciente, DedupReport } from "../types";
import { deduplicatePacientes, formatFechaAesthetic, normalizeHospitalName } from "../utils/api";
import { Trash2, Plus, Download, Send, CheckSquare, Square, AlertTriangle, HelpCircle, Sparkles, GitMerge, UserPlus, Eye, ZoomIn, ZoomOut, RotateCw, Maximize2, X, Layers, Info } from "lucide-react";

interface ReviewTableProps {
  initialPatients: ParsedPaciente[];
  hospitales: Hospital[];
  existingPatients: Paciente[];
  onClearBatch: () => void;
  onBatchSubmitted: (resultsSummary: string, synchronizedCount?: number) => void;
  processedPages?: { pageNum: number; dataUrl: string; originalDataUrl?: string }[];
}

export default function ReviewTable({
  initialPatients,
  hospitales,
  existingPatients,
  onClearBatch,
  onBatchSubmitted,
  processedPages = [],
}: ReviewTableProps) {
  const [patients, setPatients] = useState<ParsedPaciente[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Document Viewer Modal State
  const [isOpenViewer, setIsOpenViewer] = useState(false);
  const [viewerPageIdx, setViewerPageIdx] = useState(0);
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerMode, setViewerMode] = useState<"original" | "optimized">("optimized");
  const [viewerOffsetX, setViewerOffsetX] = useState(0);
  const [viewerOffsetY, setViewerOffsetY] = useState(0);
  const [viewerRotation, setViewerRotation] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Reset viewer controls to default view
  const resetViewer = () => {
    setViewerScale(1);
    setViewerOffsetX(0);
    setViewerOffsetY(0);
    setViewerRotation(0);
  };

  // Global override fields
  const [globalHospitalId, setGlobalHospitalId] = useState<string>("");
  const [globalActualizacionFecha, setGlobalActualizacionFecha] = useState(new Date().toISOString().split("T")[0]);
  
  // State for upload process
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [lastReport, setLastReport] = useState<DedupReport | null>(null);

  // Sync state with incoming loader lists
  useEffect(() => {
    if (initialPatients.length > 0) {
      setPatients(initialPatients);
      // Auto-select all by default for efficient flow
      setSelectedIds(new Set(initialPatients.map((p) => p.id_temporal)));
    }
  }, [initialPatients]);

  // Keyboard shortcut listener: Ctrl + Enter to submit batch
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        if (patients.length > 0 && selectedIds.size > 0 && !isUploading) {
          e.preventDefault();
          handleSubmitBatch();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [patients, selectedIds, isUploading, globalHospitalId, globalActualizacionFecha]);

  // Inline grid cell mutation
  const handleCellChange = (id: string, field: keyof ParsedPaciente, value: any) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id_temporal === id) {
          return { ...p, [field]: value };
        }
        return p;
      })
    );
  };

  // Select / deselect row
  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === patients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(patients.map((p) => p.id_temporal)));
    }
  };

  // Add a blank row manually for fast power-entry
  const handleAddRow = () => {
    const newRow: ParsedPaciente = {
      id_temporal: Math.random().toString(36).substring(2, 9),
      nombre: "",
      cedula: "",
      edad: undefined,
      sexo: "Desconocido",
      procedencia: "",
      confianza_ocr: 100,
      status_verificacion: "pendiente",
    };
    setPatients((prev) => [...prev, newRow]);
    setSelectedIds((prev) => new Set([...Array.from(prev), newRow.id_temporal]));
  };

  // Delete selected rows from list
  const handleDeleteSelected = () => {
    const remaining = patients.filter((p) => !selectedIds.has(p.id_temporal));
    setPatients(remaining);
    setSelectedIds(new Set());
  };

  const handleDeleteRow = (id: string) => {
    setPatients((prev) => prev.filter((p) => p.id_temporal !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Apply Global Overrides
  const handleApplyGlobalOverrides = () => {
    if (selectedIds.size === 0) return;
    // Just alert user, updates happen inside submission payload or we can mutate local state
    // Let's mutate local state to give physical feedback to volunteers!
    setPatients((prev) =>
      prev.map((p) => {
        if (selectedIds.has(p.id_temporal)) {
          // Mutate properties if required
        }
        return p;
      })
    );
  };

  // Smart duplicate analyzer: Check if a name or cedula matches existing DB records
  const getDuplicateStatus = (p: ParsedPaciente) => {
    if (!p.nombre.trim()) return null;

    // Check by Cédula
    if (p.cedula) {
      const matchCedula = existingPatients.find(
        (ep) => ep.cedula && ep.cedula === p.cedula?.trim()
      );
      if (matchCedula) {
        return {
          type: "cedula" as const,
          reason: `Sincronización: Cédula asignada a ${matchCedula.nombre} (${matchCedula.hospital})`,
        };
      }
    }

    // Check by exact Name match
    const matchName = existingPatients.find(
      (ep) => ep.nombre.toLowerCase().trim() === p.nombre.toLowerCase().trim()
    );
    if (matchName) {
      return {
        type: "nombre" as const,
        reason: `Sincronización: Nombre exacto ya registrado en ${matchName.hospital}`,
      };
    }

    return null;
  };

  // Local Safety Backup Download as Excel (.XLSX)
  const handleDownloadExcel = () => {
    if (patients.length === 0) return;

    const titleRow = ["SISTEMA DE ASISTENCIA CUIDARTE - INFORME DE REGISTRO DE PACIENTES"];
    const subtitleRow = [`Generado de forma segura el: ${formatFechaAesthetic(new Date())}`, "", "", "", "", "", "", "", ""];
    const emptyRow = [""];
    const headerRow = [
      "Num",
      "Nombre Completo",
      "Cédula",
      "Edad",
      "Sexo",
      "Procedencia / Municipio",
      "Hospital / Ubicación",
      "Fecha de Actualización",
      "Estado / Motivo"
    ];

    const dataRows = patients.map((p, idx) => [
      idx + 1,
      p.nombre,
      p.cedula ? p.cedula : "Sin Registrar",
      p.edad !== undefined ? p.edad : "Desconocida",
      p.sexo,
      p.procedencia || "No Registrada",
      p.hospital_nombre || (globalHospitalId ? hospitales.find(h => h.id === parseInt(globalHospitalId, 10))?.nombre || "" : "No Asignado"),
      formatFechaAesthetic(p.actualizacion_fecha || globalActualizacionFecha),
      p.estado ? p.estado.toUpperCase() : "HOSPITALIZADO"
    ]);

    const aoa = [
      titleRow,
      subtitleRow,
      emptyRow,
      headerRow,
      ...dataRows
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();

    // Merges for a beautiful professional header layout
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Pacientes_Revisión");

    // Auto-fit column widths professionally
    const maxLens = headerRow.map((colName, colIdx) => {
      let maxL = colName.length;
      dataRows.forEach(row => {
        const val = String(row[colIdx] || "");
        if (val.length > maxL) maxL = val.length;
      });
      return { wch: Math.min(Math.max(maxL + 4, 10), 50) };
    });
    worksheet["!cols"] = maxLens;

    XLSX.writeFile(workbook, `CUIDARTE_Pacientes_Revision_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Local Safety Backup Download as OpenDocument Spreadsheet (.ODS)
  const handleDownloadODS = () => {
    if (patients.length === 0) return;

    const titleRow = ["SISTEMA DE ASISTENCIA CUIDARTE - INFORME DE REGISTRO DE PACIENTES"];
    const subtitleRow = [`Generado de forma segura el: ${formatFechaAesthetic(new Date())}`, "", "", "", "", "", "", "", ""];
    const emptyRow = [""];
    const headerRow = [
      "Num",
      "Nombre Completo",
      "Cédula",
      "Edad",
      "Sexo",
      "Procedencia / Municipio",
      "Hospital / Ubicación",
      "Fecha de Actualización",
      "Estado / Motivo"
    ];

    const dataRows = patients.map((p, idx) => [
      idx + 1,
      p.nombre,
      p.cedula ? p.cedula : "Sin Registrar",
      p.edad !== undefined ? p.edad : "Desconocida",
      p.sexo,
      p.procedencia || "No Registrada",
      p.hospital_nombre || (globalHospitalId ? hospitales.find(h => h.id === parseInt(globalHospitalId, 10))?.nombre || "" : "No Asignado"),
      formatFechaAesthetic(p.actualizacion_fecha || globalActualizacionFecha),
      p.estado ? p.estado.toUpperCase() : "HOSPITALIZADO"
    ]);

    const aoa = [
      titleRow,
      subtitleRow,
      emptyRow,
      headerRow,
      ...dataRows
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();

    // Merges for a beautiful professional header layout
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Pacientes_Revisión");

    // Auto-fit column widths professionally
    const maxLens = headerRow.map((colName, colIdx) => {
      let maxL = colName.length;
      dataRows.forEach(row => {
        const val = String(row[colIdx] || "");
        if (val.length > maxL) maxL = val.length;
      });
      return { wch: Math.min(Math.max(maxL + 4, 10), 50) };
    });
    worksheet["!cols"] = maxLens;

    XLSX.writeFile(workbook, `CUIDARTE_Pacientes_Revision_${new Date().toISOString().slice(0, 10)}.ods`, { bookType: "ods" });
  };

  // Local Safety Backup Download as CSV
  const handleDownloadBackup = () => {
    if (patients.length === 0) return;

    const headers = ["Nombre Completo", "Cédula", "Edad", "Sexo", "Procedencia/Municipio", "Hospital/Ubicación", "Fecha de Actualización", "Estado/Motivo", "Confianza OCR"];
    const rows = patients.map((p) => [
      p.nombre,
      p.cedula || "",
      p.edad || "",
      p.sexo,
      p.procedencia || "",
      p.hospital_nombre || "",
      p.actualizacion_fecha || "",
      p.estado || "",
      `${p.confianza_ocr}%`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CUIDARTE_Respaldo_Pacientes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit selected batch rows to PHP Dedup Engine
  const handleSubmitBatch = async () => {
    if (selectedIds.size === 0) {
      setUploadError("Debe seleccionar al menos un paciente para realizar la carga masiva.");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setLastReport(null);

    // Prepare list of patients to upload
    const selectedPatients = patients.filter((p) => selectedIds.has(p.id_temporal));
    
    // Validation
    const invalidRow = selectedPatients.find((p) => !p.nombre.trim());
    if (invalidRow) {
      setUploadError("Todos los registros seleccionados deben tener un Nombre Completo válido.");
      setIsUploading(false);
      return;
    }

    try {
      const payload = {
        fuente: "carga_masiva_admin",
        hospital_id: globalHospitalId ? parseInt(globalHospitalId, 10) : null,
        hospital_nuevo: globalHospitalId === "" ? "Ambulatorio Temporal / Desconocido" : undefined,
        actualizacion_fecha: globalActualizacionFecha,
        pacientes: selectedPatients.map((p) => {
          const rowHospitalId = p.hospital_id !== undefined && p.hospital_id !== null ? p.hospital_id : (globalHospitalId ? parseInt(globalHospitalId, 10) : null);
          const rowHospitalNuevo = p.hospital_id === null && p.hospital_nombre ? p.hospital_nombre : (globalHospitalId === "" ? "Ambulatorio Temporal / Desconocido" : undefined);
          const rowActualizacionFecha = p.actualizacion_fecha || globalActualizacionFecha;

          return {
            nombre: p.nombre.trim(),
            cedula: p.cedula?.trim() || undefined,
            edad: p.edad,
            sexo: p.sexo,
            procedencia: p.procedencia?.trim() || undefined,
            estado: p.estado || "hospitalizado",
            hospital_id: rowHospitalId,
            hospital_nuevo: rowHospitalNuevo,
            actualizacion_fecha: rowActualizacionFecha,
          };
        }),
      };

      const report = await deduplicatePacientes(payload);
      console.log("[Dedup] Report completo:", report);
      setLastReport(report);

      if (report.ok) {
        // Remove successfully processed patients from the review grid
        const successRowsMap = new Set(
          report.detalle
            .filter((r) => r.accion === "nuevo" || r.accion === "merge")
            .map((r) => selectedPatients[r.fila - 1]?.id_temporal)
            .filter(Boolean)
        );

        const remaining = patients.filter((p) => !successRowsMap.has(p.id_temporal));
        setPatients(remaining);
        setSelectedIds(new Set());

        const summaryText = [
          `✅ ${report.nuevos} nuevos`,
          report.mergeados > 0 ? `🔄 ${report.mergeados} fusionados` : null,
          report.sin_cambios > 0 ? `ℹ️ ${report.sin_cambios} sin cambios` : null,
          report.errores > 0 ? `⚠️ ${report.errores} errores` : null,
        ].filter(Boolean).join(" · ");

        const synchronizedCount = report.nuevos + report.mergeados;
        onBatchSubmitted(`Lote procesado: ${summaryText} (${report.total_recibidos} total)`, synchronizedCount);
      } else {
        setUploadError("Error en la respuesta del motor de deduplicación.");
      }
    } catch (err: any) {
      setUploadError(err.message || "Error de conexión con el backend.");
    } finally {
      setIsUploading(false);
    }
  };

  if (patients.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 font-sans text-left space-y-6">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2 font-display">
            <Sparkles className="w-5 h-5 text-sky-600" />
            <span>Workspace: Tabla de Revisión e Integración</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Revise los datos procesados antes de sincronizar con el registro central de Venezuela.
          </p>
        </div>

        {/* Shortcuts / backup */}
        <div className="flex flex-wrap items-center gap-2">
          {processedPages && processedPages.length > 0 && (
            <button
              onClick={() => {
                setViewerPageIdx(0);
                resetViewer();
                setIsOpenViewer(true);
              }}
              className="bg-sky-55 text-sky-700 hover:bg-sky-100 font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer border border-sky-200 shadow-sm animate-pulse"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver Documento Escaneado ({processedPages.length})</span>
            </button>
          )}
          <button
            onClick={handleDownloadExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Excel (.XLSX)</span>
          </button>
          <button
            onClick={handleDownloadODS}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar ODS (.ODS)</span>
          </button>
          <button
            onClick={handleDownloadBackup}
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-xl text-xs border border-slate-200 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <span>Respaldo .CSV</span>
          </button>
          <button
            onClick={handleAddRow}
            className="bg-white hover:bg-slate-50 text-sky-700 font-bold px-4 py-2 rounded-xl text-xs border border-slate-200 flex items-center space-x-1 transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar Fila</span>
          </button>
        </div>
      </div>

      {/* GLOBAL OVERRIDES BAR */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 items-end shadow-inner">
        <div>
          <label className="block text-[10px] font-mono text-slate-500 font-semibold uppercase tracking-wider mb-1">
            Hospital para Todo el Lote (Por Defecto)
          </label>
          <select
            value={globalHospitalId}
            onChange={(e) => setGlobalHospitalId(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500 shadow-sm"
          >
            <option value="">Otros / Externos (Campamento Temporal)</option>
            {hospitales.map((h) => (
              <option key={h.id} value={h.id}>
                {h.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-slate-500 font-semibold uppercase tracking-wider mb-1">
            Fecha de Actualización Común (Por Defecto)
          </label>
          <input
            type="date"
            value={globalActualizacionFecha}
            onChange={(e) => setGlobalActualizacionFecha(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500 font-mono shadow-sm"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-sans italic">
            Se aplicará a {selectedIds.size} pacientes seleccionados.
          </span>
        </div>
      </div>

      {/* INTERACTIVE WORKSPACE GRID */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-sm scrollbar-thin">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm border-b border-slate-200">
            <tr className="text-slate-500 text-xs font-mono uppercase tracking-wider">
              <th className="p-3 text-center w-12 bg-slate-50">
                <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                  {selectedIds.size === patients.length ? (
                    <CheckSquare className="w-4 h-4 text-sky-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              {/* Cell: ID consecutivo */}
              <th className="p-2 text-center font-mono text-xs text-slate-400/70 w-10 bg-slate-50">#</th>
              <th className="p-3 min-w-[180px] bg-slate-50">Nombre Completo <span className="text-rose-600 font-bold">*</span></th>
              <th className="p-3 w-28 bg-slate-50">Cédula</th>
              <th className="p-3 w-14 bg-slate-50">Edad</th>
              <th className="p-3 w-20 bg-slate-50">Sexo</th>
              <th className="p-3 w-28 bg-slate-50">Procedencia</th>
              <th className="p-3 min-w-[180px] bg-slate-50">Hospital / Ubicación</th>
              <th className="p-3 w-32 bg-slate-50">Fecha Actualización</th>
              <th className="p-3 w-24 bg-slate-50">Estado</th>
              <th className="p-3 w-24 text-center bg-slate-50">OCR Conf.</th>
              <th className="p-3 text-center w-16 bg-slate-50">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {patients.map((p) => {
              const isLowConfidence = p.confianza_ocr !== undefined && p.confianza_ocr < 70;
              const duplicateInfo = getDuplicateStatus(p);
              const isSelected = selectedIds.has(p.id_temporal);

              return (
                <tr
                  key={p.id_temporal}
                  className={`transition-colors ${
                    isSelected ? "bg-sky-50/30" : "hover:bg-slate-50/50"
                  }`}
                >
                  {/* Row Checkbox */}
                  <td className="p-3 text-center">
                    <button
                      onClick={() => toggleSelectRow(p.id_temporal)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-sky-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </td>

                  {/* Cell: ID consecutivo */}
                  <td className="p-2 text-center font-mono text-xs text-slate-400/50">
                    {patients.indexOf(p) + 1}
                  </td>

                  {/* Cell: Full Name */}
                  <td className="p-2">
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={p.nombre}
                        onChange={(e) => handleCellChange(p.id_temporal, "nombre", e.target.value)}
                        placeholder="Sin nombre"
                        className={`w-full bg-slate-50/50 focus:bg-white border border-transparent hover:border-slate-250 focus:border-sky-500 rounded px-2.5 py-1 text-sm text-slate-800 ${
                          isLowConfidence && !p.nombre ? "bg-rose-50 border-rose-200 text-rose-800" : ""
                        }`}
                      />
                      {duplicateInfo && (
                        <div className="flex items-center space-x-1 text-[10px] text-yellow-600 font-medium px-2.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="line-clamp-1">{duplicateInfo.reason}</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Cell: Cédula */}
                  <td className="p-2">
                    <input
                      type="text"
                      maxLength={9}
                      value={p.cedula || ""}
                      onChange={(e) =>
                        handleCellChange(p.id_temporal, "cedula", e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="N/A"
                      className={`w-full bg-slate-50/50 focus:bg-white border border-transparent focus:border-sky-500 rounded px-2 py-1 text-sm font-mono text-slate-800 text-center ${
                        isLowConfidence && !p.cedula ? "bg-yellow-50 border-yellow-200 text-yellow-800" : ""
                      }`}
                    />
                  </td>

                  {/* Cell: Age */}
                  <td className="p-2">
                    <input
                      type="text"
                      maxLength={3}
                      value={p.edad !== undefined ? String(p.edad) : ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        handleCellChange(p.id_temporal, "edad", val ? parseInt(val, 10) : undefined);
                      }}
                      placeholder="-"
                      className="w-full bg-slate-50/50 focus:bg-white border border-transparent focus:border-sky-500 rounded px-2 py-1 text-sm font-mono text-slate-850 text-center"
                    />
                  </td>

                  {/* Cell: Sex */}
                  <td className="p-2">
                    <select
                      value={p.sexo}
                      onChange={(e) => handleCellChange(p.id_temporal, "sexo", e.target.value as any)}
                      className="w-full bg-slate-50/50 focus:bg-white border border-transparent focus:border-sky-500 rounded px-2 py-1.5 text-xs text-slate-800"
                    >
                      <option value="Desconocido">Desconocido</option>
                      <option value="Masculino">M</option>
                      <option value="Femenino">F</option>
                    </select>
                  </td>

                  {/* Cell: Origin / Sector */}
                  <td className="p-2">
                    <input
                      type="text"
                      value={p.procedencia || ""}
                      onChange={(e) => handleCellChange(p.id_temporal, "procedencia", e.target.value)}
                      placeholder="-"
                      className="w-full bg-slate-50/50 focus:bg-white border border-transparent focus:border-sky-500 rounded px-1.5 py-1 text-xs text-slate-800"
                    />
                  </td>

                  {/* Cell: Hospital / Ubicación */}
                  <td className="p-2">
                    <select
                      value={p.hospital_id || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const selectedHosp = hospitales.find(h => h.id === parseInt(val, 10));
                        handleCellChange(p.id_temporal, "hospital_id", val ? parseInt(val, 10) : null);
                        handleCellChange(p.id_temporal, "hospital_nombre", selectedHosp ? selectedHosp.nombre : "");
                      }}
                      className="w-full bg-slate-50/50 focus:bg-white border border-transparent focus:border-sky-500 rounded px-2 py-1.5 text-xs text-slate-800"
                    >
                      <option value="">(Usar global o registrar nuevo)</option>
                      {hospitales.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.nombre}
                        </option>
                      ))}
                    </select>
                    {p.hospital_nombre && !p.hospital_id && (
                      <div className="text-[10px] text-sky-700 font-bold px-1.5 mt-0.5 italic line-clamp-1" title={p.hospital_nombre}>
                        Nuevo: {p.hospital_nombre}
                      </div>
                    )}
                  </td>

                  {/* Cell: Fecha de Actualización */}
                  <td className="p-2">
                    <input
                      type="date"
                      value={p.actualizacion_fecha || globalActualizacionFecha}
                      onChange={(e) => handleCellChange(p.id_temporal, "actualizacion_fecha", e.target.value)}
                      className="w-full bg-slate-50/50 focus:bg-white border border-transparent focus:border-sky-500 rounded px-1.5 py-1 text-xs font-mono text-slate-800 text-center"
                    />
                  </td>

                  {/* Cell: Estado / Motivo */}
                  <td className="p-2">
                    <select
                      value={p.estado || "desconocido"}
                      onChange={(e) => handleCellChange(p.id_temporal, "estado", e.target.value as any)}
                      className={`w-full bg-slate-50/50 focus:bg-white border border-transparent focus:border-sky-500 rounded px-1.5 py-1.5 text-xs ${
                        p.estado === "fallecido" ? "text-rose-700 font-semibold" :
                        p.estado === "alta" ? "text-emerald-700 font-semibold" :
                        p.estado === "referido" ? "text-amber-700 font-semibold" :
                        p.estado === "hospitalizado" ? "text-sky-700 font-semibold" :
                        p.estado === "recluido" ? "text-purple-700 font-semibold" :
                        "text-slate-500"
                      }`}
                    >
                      <option value="desconocido">Desconocido</option>
                      <option value="hospitalizado">Hospitalizado</option>
                      <option value="alta">Alta</option>
                      <option value="referido">Referido</option>
                      <option value="fallecido">Fallecido</option>
                      <option value="recluido">Recluido</option>
                    </select>
                  </td>

                  {/* Cell: OCR Confidence level */}
                  <td className="p-3 text-center font-mono text-xs">
                    <span
                      className={`font-semibold ${
                        isLowConfidence
                          ? "text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                          : p.confianza_ocr === 100
                          ? "text-slate-400"
                          : "text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200"
                      }`}
                    >
                      {p.confianza_ocr}%
                    </span>
                  </td>

                  {/* Actions Column */}
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(p.id_temporal)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Quitar Fila"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* FOOTER: LIVE SYNCHRONIZATION STATS & BULK TRIGGER */}
      {(() => {
        // Compute live statistics for selected rows
        let dbDuplicatesSameCount = 0;
        let dbUpdatesDiffCount = 0;
        let newRecordsCount = 0;
        let erroredCount = 0;

        patients.forEach((p) => {
          const isSelected = selectedIds.has(p.id_temporal);
          if (!isSelected) return;

          if (!p.nombre || !p.nombre.trim()) {
            erroredCount++;
            return;
          }

          const dup = getDuplicateStatus(p);
          if (dup) {
            // Check if same or different motivo/estado
            const matchPaciente = existingPatients.find(
              (ep) =>
                ep.nombre.toLowerCase().trim() === p.nombre.toLowerCase().trim() ||
                (p.cedula && ep.cedula === p.cedula.trim())
            );
            if (matchPaciente && matchPaciente.estado === p.estado) {
              dbDuplicatesSameCount++;
            } else {
              dbUpdatesDiffCount++;
            }
          } else {
            newRecordsCount++;
          }
        });

        return (
          <div className="pt-4 border-t border-slate-200 space-y-4">
            {/* Live Statistics Panel */}
            <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/60 grid grid-cols-2 md:grid-cols-5 gap-3.5 text-center select-none">
              <div className="space-y-0.5">
                <div className="text-[10px] font-mono text-slate-500 font-semibold uppercase tracking-wider">Total Revisión</div>
                <div className="text-lg font-bold text-slate-800">{patients.length}</div>
              </div>
              <div className="space-y-0.5 border-l border-slate-200">
                <div className="text-[10px] font-mono text-slate-500 font-semibold uppercase tracking-wider">Seleccionados</div>
                <div className="text-lg font-bold text-sky-700">{selectedIds.size}</div>
              </div>
              <div className="space-y-0.5 border-l border-slate-200">
                <div className="text-[10px] font-mono text-rose-600 font-semibold uppercase tracking-wider">Repetidos (Mismo Motivo)</div>
                <div className="text-lg font-bold text-rose-600">{dbDuplicatesSameCount}</div>
              </div>
              <div className="space-y-0.5 border-l border-slate-200">
                <div className="text-[10px] font-mono text-amber-600 font-semibold uppercase tracking-wider">Actualizaciones (Por Sincronizar)</div>
                <div className="text-lg font-bold text-amber-600">{dbUpdatesDiffCount}</div>
              </div>
              <div className="space-y-0.5 border-l border-slate-200 col-span-2 md:col-span-1">
                <div className="text-[10px] font-mono text-emerald-600 font-semibold uppercase tracking-wider">Nuevos Registros</div>
                <div className="text-lg font-bold text-emerald-600">{newRecordsCount}</div>
              </div>
            </div>

            {erroredCount > 0 && (
              <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs rounded-xl p-3 flex items-center space-x-2 shadow-sm">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Hay <strong>{erroredCount} registros seleccionados con errores</strong> (falta Nombre Completo) que no se sincronizarán hasta corregirlos.</span>
              </div>
            )}

            {/* Actions Footer */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Dedup Report Summary (appears after submission) */}
              {lastReport && lastReport.ok && (
                <div className="flex items-center space-x-4 text-xs text-slate-600 flex-wrap gap-y-1">
                  <span className="flex items-center space-x-1 font-semibold text-sky-700">
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{lastReport.nuevos} nuevos</span>
                  </span>
                  {lastReport.mergeados > 0 && (
                    <span className="flex items-center space-x-1 font-semibold text-amber-700">
                      <GitMerge className="w-3.5 h-3.5" />
                      <span>{lastReport.mergeados} fusionados</span>
                    </span>
                  )}
                  {lastReport.sin_cambios > 0 && (
                    <span className="flex items-center space-x-1 text-slate-500">
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{lastReport.sin_cambios} sin cambios</span>
                    </span>
                  )}
                  {lastReport.errores > 0 && (
                    <span className="flex items-center space-x-1 text-rose-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{lastReport.errores} errores</span>
                    </span>
                  )}
                  <span className="text-slate-400">· {lastReport.total_recibidos} total</span>
                </div>
              )}
              {!lastReport && (
                <div className="text-xs text-slate-400 italic max-w-lg">
                  El motor de deduplicación analiza duplicados por cédula exacta y similitud fonética ≥85%.
                  Los pacientes existentes se actualizan con nuevas fechas o se fusionan sus motivos automáticamente.
                </div>
              )}

              {/* Sync Trigger and stats */}
              <div className="flex items-center space-x-3 self-end lg:self-auto">
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 px-3 py-2 cursor-pointer"
                  >
                    Borrar seleccionados ({selectedIds.size})
                  </button>
                )}

                <button
                  onClick={handleSubmitBatch}
                  disabled={isUploading || selectedIds.size === 0 || erroredCount > 0}
                  id="btn-upload-batch"
                  className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all text-sm flex items-center space-x-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isUploading
                      ? "Transmitiendo Lote..."
                      : `Sincronizar Lote (${selectedIds.size} Pacientes)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {uploadError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg p-3 flex items-start space-x-2 shadow-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Shortcuts Legend */}
      <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between select-none">
        <span>[Ctrl + Enter]: Enviar lote seleccionado</span>
        <span>[Tab]: Avanzar celda | Flechas: Navegación rápida</span>
      </div>

      {/* INTERACTIVE DOCUMENT VIEWER MODAL */}
      {isOpenViewer && processedPages.length > 0 && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm text-white select-none animate-fadeIn">
          {/* HEADER BAR */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
            <div className="flex items-center space-x-3">
              <Layers className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="font-semibold text-sm">Visualizador de Documentos Escaneados</h3>
                <p className="text-[10px] text-slate-400">
                  Página {viewerPageIdx + 1} de {processedPages.length} · Arrastre para desplazar, Ruede mouse para zoom
                </p>
              </div>
            </div>

            {/* View Mode Toggle (Original vs Optimized) */}
            <div className="hidden md:flex bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs gap-1">
              <button
                onClick={() => setViewerMode("original")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewerMode === "original"
                    ? "bg-slate-800 text-white shadow-md border border-slate-700"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Imagen Original
              </button>
              <button
                onClick={() => setViewerMode("optimized")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewerMode === "optimized"
                    ? "bg-sky-600 text-white shadow-md border border-sky-500"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Imagen Optimizada (Procesada)
              </button>
            </div>
            
            {/* Toolbar controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewerScale(s => Math.min(s * 1.25, 6))}
                className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-xs flex items-center space-x-1 cursor-pointer"
                title="Aumentar Zoom (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewerScale(s => Math.max(s / 1.25, 0.5))}
                className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-xs flex items-center space-x-1 cursor-pointer"
                title="Disminuir Zoom (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewerRotation(r => (r + 90) % 360)}
                className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-xs flex items-center space-x-1 cursor-pointer"
                title="Rotar 90°"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                onClick={resetViewer}
                className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-2 rounded-lg cursor-pointer"
              >
                Restaurar Vista
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={() => setIsOpenViewer(false)}
                className="bg-rose-600 hover:bg-rose-500 p-2 rounded-lg cursor-pointer"
                title="Cerrar Visualizador (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* MAIN MODAL WORKSPACE */}
          <div className="flex-1 flex overflow-hidden">
            {/* Multi-page Navigation Sidebar (if applicable) */}
            {processedPages.length > 1 && (
              <div className="w-48 bg-slate-950/40 border-r border-slate-800 p-4 space-y-3 overflow-y-auto shrink-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold mb-1">Páginas del Lote</div>
                <div className="grid grid-cols-1 gap-2">
                  {processedPages.map((page, idx) => (
                    <button
                      key={page.pageNum}
                      onClick={() => {
                        setViewerPageIdx(idx);
                        resetViewer();
                      }}
                      className={`relative aspect-[3/4] border rounded-lg overflow-hidden transition-all text-left group ${
                        viewerPageIdx === idx
                          ? "border-sky-500 ring-2 ring-sky-500/20"
                          : "border-slate-800 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={viewerMode === "original" ? (page.originalDataUrl || page.dataUrl) : page.dataUrl}
                        alt={`Pág ${page.pageNum}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-slate-950/80 px-2 py-1 text-[9px] font-mono flex items-center justify-between">
                        <span>Pág {page.pageNum}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Stage Canvas Container */}
            <div
              className={`flex-1 relative flex items-center justify-center overflow-hidden bg-slate-950/80 p-6 ${
                isPanning ? "cursor-grabbing" : "cursor-grab"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsPanning(true);
                setPanStart({ x: e.clientX - viewerOffsetX, y: e.clientY - viewerOffsetY });
              }}
              onMouseMove={(e) => {
                if (!isPanning) return;
                setViewerOffsetX(e.clientX - panStart.x);
                setViewerOffsetY(e.clientY - panStart.y);
              }}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
              onWheel={(e) => {
                e.preventDefault();
                const zoomFactor = 1.15;
                if (e.deltaY < 0) {
                  setViewerScale(s => Math.min(s * zoomFactor, 6));
                } else {
                  setViewerScale(s => Math.max(s / zoomFactor, 0.4));
                }
              }}
            >
              <div
                style={{
                  transform: `translate(${viewerOffsetX}px, ${viewerOffsetY}px) scale(${viewerScale}) rotate(${viewerRotation}deg)`,
                  transition: isPanning ? "none" : "transform 0.15s ease-out",
                }}
                className="max-w-[90%] max-h-[90%] flex items-center justify-center select-none shadow-2xl bg-white p-4 rounded"
              >
                <img
                  src={viewerMode === "original" ? (processedPages[viewerPageIdx]?.originalDataUrl || processedPages[viewerPageIdx]?.dataUrl) : processedPages[viewerPageIdx]?.dataUrl}
                  alt={`Documento página ${viewerPageIdx + 1}`}
                  className="max-w-full max-h-[75vh] object-contain select-none pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Instructions banner */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 px-4 py-1.5 rounded-full border border-slate-800 text-[10px] text-slate-400 font-mono flex items-center space-x-2">
                <Info className="w-3.5 h-3.5 text-sky-400" />
                <span>Ruede el mouse para hacer zoom · Arrastre para mover · Teclado: +/- para zoom</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
