/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Hospital, Paciente, ParsedPaciente } from "./types";
import { initializeAPI, getHospitales, searchPacientes, getVolunteerCode, isAuthorized, setVolunteerCode, getDetectedIP } from "./utils/api";
import SecurityGate from "./components/SecurityGate";
import TickerBar from "./components/TickerBar";
import MassiveLoader from "./components/MassiveLoader";
import ReviewTable from "./components/ReviewTable";
import { homologateName } from "./utils/ocr";
import IndividualPatient from "./components/IndividualPatient";
import TransportManager from "./components/TransportManager";
import CargaManager from "./components/CargaManager";
import { Activity, Users, Truck, Heart, FileSpreadsheet, PlusCircle, LogOut, ShieldCheck, HelpCircle, AlertCircle, Database, Share2 } from "lucide-react";

export default function App() {
  const [authorized, setAuthorized] = useState(false);
  const [activeTag, setActiveTag] = useState<"carga" | "individual" | "transporte" | "gestion">("carga");
  const [hospitales, setHospitales] = useState<Hospital[]>([]);
  const [existingPatients, setExistingPatients] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);

  // Consolidated batch list in the review workspace
  const [reviewBatch, setReviewBatch] = useState<ParsedPaciente[]>([]);
  const [processedPages, setProcessedPages] = useState<{ pageNum: number; dataUrl: string; originalDataUrl?: string }[]>([]);
  const [batchSummaryMessage, setBatchSummaryMessage] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isSuperuser, setIsSuperuser] = useState(false);

  // Helper para Toasts rápidos
  const triggerToast = (msg: string, type: "success" | "error" = "error") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast((current) => current?.message === msg ? null : current), 5000);
  };

  // Initialize API and load database resources
  useEffect(() => {
    initializeAPI().then(() => {
      setAuthorized(isAuthorized());
      if (isAuthorized()) {
        loadDataResources();
        checkSuperUser();
      } else {
        setLoading(false);
      }
    });
  }, [authorized]);

  const checkSuperUser = async () => {
    try {
      const code = getVolunteerCode();
      const res = await fetch(`/api/superuser_status.php?codigo=${encodeURIComponent(code)}`, {
        headers: { "X-Codigo-Voluntario": code }
      });
      if (res.ok) {
        const data = await res.json();
        setIsSuperuser(data.is_superuser || false);
      }
    } catch (err) {
      console.warn("[App] Error checking superuser:", err);
      setIsSuperuser(false);
    }
  };

  const loadDataResources = async () => {
    setLoading(true);
    try {
      const [hospList, patList] = await Promise.all([
        getHospitales(),
        searchPacientes(""),
      ]);
      setHospitales(hospList);
      setExistingPatients(patList);
    } catch (err) {
      console.error("Error cargando recursos de base de datos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchLoaded = (newPatients: ParsedPaciente[], pages?: { pageNum: number; dataUrl: string; originalDataUrl?: string }[]) => {
    if (pages && pages.length > 0) {
      setProcessedPages(pages);
    }
    // Append or overwrite current batch with fully normalized names
    setReviewBatch((prev) => {
      const next = [...prev];
      newPatients.forEach((np) => {
        const normalized = homologateName(np.nombre);
        if (!normalized) return;
        
        // Check if already exists in the current batch list (prevent in-batch duplicates)
        const inBatchDup = next.find((p) => p.nombre.toLowerCase().trim() === normalized.toLowerCase().trim());
        if (!inBatchDup) {
          next.push({
            ...np,
            nombre: normalized,
          });
        } else {
          // If already in batch but has more details (like a cedula), enrich it
          if (!inBatchDup.cedula && np.cedula) inBatchDup.cedula = np.cedula;
          if (!inBatchDup.edad && np.edad) inBatchDup.edad = np.edad;
          if (inBatchDup.sexo === "Desconocido" && np.sexo !== "Desconocido") inBatchDup.sexo = np.sexo;
          if (!inBatchDup.procedencia && np.procedencia) inBatchDup.procedencia = np.procedencia;
          if ((!inBatchDup.estado || inBatchDup.estado === "desconocido") && np.estado) inBatchDup.estado = np.estado;
        }
      });
      return next;
    });
    setBatchSummaryMessage("");
  };

  const handleBatchSubmitted = (summaryText: string, synchronizedCount?: number) => {
    setBatchSummaryMessage(summaryText);
    setReviewBatch([]); // Clear active batch
    setProcessedPages([]); // Clear active images
    loadDataResources(); // Refresh central lists
    
    // Trigger green success toast
    if (synchronizedCount !== undefined) {
      triggerToast(`¡Sincronización exitosa! Se sincronizaron ${synchronizedCount} pacientes correctamente.`, "success");
    } else {
      triggerToast("¡Sincronización de lote completada exitosamente!", "success");
    }
  };

  const handleLogout = () => {
    setVolunteerCode("");
    setAuthorized(false);
    setReviewBatch([]);
    setBatchSummaryMessage("");
    setShowLogoutConfirm(false);
  };

  // Guard Clause: Security Check
  if (!authorized) {
    return <SecurityGate onAuthorized={() => setAuthorized(true)} />;
  }

  // Active statistics calculation
  const totalHospitalized = existingPatients.filter((p) => p.estado === "hospitalizado").length;
  const totalDischarged = existingPatients.filter((p) => p.estado === "alta").length;
  const totalReferrals = existingPatients.filter((p) => p.estado === "referido").length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-sky-200 selection:text-sky-950">
      {/* Header with high legibility, clean spacing, solid background on mobile, and sticky behavior on tablet/desktop */}
      <header className="bg-white border-b border-slate-200 px-3 py-2.5 sm:px-6 sm:py-3 relative sm:sticky sm:top-0 z-40 shadow-sm sm:bg-white/95 sm:backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col gap-2 sm:gap-3">
          {/* Row 1: Identity & Volunteer Status */}
          <div className="flex flex-row items-center justify-between gap-3 w-full">
            {/* Logo Brand / Identity */}
            <div className="flex items-center space-x-2 sm:space-x-3 text-left min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden shrink-0">
                <img
                  src={`${import.meta.env.BASE_URL}logo_cuidarte.svg`}
                  alt="Cuídarte Venezuela"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                  <span className="text-[7px] sm:text-[9px] font-mono font-black tracking-wider text-sky-800 uppercase bg-sky-50 border border-sky-100 px-1 sm:px-1.5 py-0.5 rounded leading-none">
                    OPERATIVO INTERNO
                  </span>
                  <span className="text-[7px] sm:text-[9px] font-mono text-slate-400 font-medium bg-slate-50 border border-slate-100 px-1 sm:px-1.5 py-0.5 rounded leading-none">
                    Sismo Jun-2026
                  </span>
                </div>
                <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-slate-800 tracking-tight font-display leading-tight truncate">
                  Carga de Pacientes — Voluntarios
                </h1>
                <p className="text-[8px] sm:text-[11px] text-slate-500 font-sans flex flex-wrap items-center gap-x-1.5 sm:gap-x-2 gap-y-0.5 leading-none">
                  <span className="truncate max-w-[120px] sm:max-w-none">Panel Admin • <strong className="text-slate-700 font-semibold">Cuídarte</strong></span>
                  <span className="text-slate-300 hidden sm:inline">|</span>
                  <a
                    href="/"
                    className="text-sky-600 hover:text-sky-800 font-bold hover:underline inline-flex items-center gap-1 transition-colors"
                  >
                    Ir a búsqueda
                  </a>
                </p>
              </div>
            </div>

            {/* Session verification identity */}
            <div className="flex items-center space-x-1.5 sm:space-x-3 bg-slate-50 border border-slate-200/60 px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl text-left shrink-0 shadow-xs relative">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse shrink-0" />
              <div className="min-w-0">
                <span className="text-[6px] sm:text-[8px] font-mono text-slate-500 block uppercase leading-none">Código Voluntario</span>
                <span className="text-[9px] sm:text-xs font-mono font-bold text-slate-700">{getVolunteerCode()}</span>
              </div>
              {!showLogoutConfirm ? (
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="text-slate-400 hover:text-rose-600 ml-1 sm:ml-1.5 p-0.5 sm:p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
                  title="Cerrar sesión temporal"
                >
                  <LogOut className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
              ) : (
                <div className="flex items-center space-x-0.5 ml-1 sm:ml-1.5 bg-white border border-slate-200 px-1 py-0.5 rounded shadow-sm z-50">
                  <span className="text-[7px] sm:text-[8px] text-slate-500 font-semibold font-mono">¿Cerrar?</span>
                  <button
                    onClick={handleLogout}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[7px] sm:text-[8px] px-1 py-0.5 rounded transition-colors cursor-pointer"
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[7px] sm:text-[8px] px-1 py-0.5 rounded transition-colors cursor-pointer"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Quick Real-Time Analytics Dashboard Banner & Extra info (Separated Row to avoid distortion) */}
          <div className="grid grid-cols-3 gap-2 w-full bg-slate-50/80 p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-200/50 text-left shadow-xs">
            <div className="px-1 sm:px-2 py-0.5">
              <span className="text-[6px] sm:text-[8px] font-mono text-slate-500 uppercase tracking-wider block font-semibold leading-tight">Hospitalizados</span>
              <span className="text-[10px] sm:text-base font-bold text-[#002f87] font-mono tracking-tight leading-none block mt-0.5">
                {loading ? "..." : totalHospitalized}
              </span>
            </div>
            <div className="px-1 sm:px-2 py-0.5 border-l border-slate-200/60 pl-2 sm:pl-4">
              <span className="text-[6px] sm:text-[8px] font-mono text-slate-500 uppercase tracking-wider block font-semibold leading-tight">Traslados/Ref</span>
              <span className="text-[10px] sm:text-base font-bold text-sky-600 font-mono tracking-tight leading-none block mt-0.5">
                {loading ? "..." : totalReferrals}
              </span>
            </div>
            <div className="px-1 sm:px-2 py-0.5 border-l border-slate-200/60 pl-2 sm:pl-4">
              <span className="text-[6px] sm:text-[8px] font-mono text-slate-500 uppercase tracking-wider block font-semibold leading-tight">De Alta Médica</span>
              <span className="text-[10px] sm:text-base font-bold text-emerald-600 font-mono tracking-tight leading-none block mt-0.5">
                {loading ? "..." : totalDischarged}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main navigation tabs (sliding pills on mobile, sticky clean grid on desktop) */}
      <nav className="bg-white border-b border-slate-200 relative sm:sticky sm:top-[112px] md:top-[126px] z-30 py-2 shadow-xs">
        <div className="max-w-4xl mx-auto px-4">
          <div className={`flex overflow-x-auto pb-1 md:pb-0 md:grid ${isSuperuser ? "md:grid-cols-4" : "md:grid-cols-3"} gap-2 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
            <button
              onClick={() => setActiveTag("carga")}
              className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold tracking-wide flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all duration-200 cursor-pointer shrink-0 flex-1 md:flex-initial ${
                activeTag === "carga"
                  ? "bg-[#002f87] text-white shadow-md shadow-[#002f87]/10"
                  : "bg-[#f4f6fa] hover:bg-[#e9ecf4] text-slate-600 hover:text-slate-800"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>INGRESO MASIVO (CSV)</span>
              {reviewBatch.length > 0 && (
                <span className="bg-rose-500 text-white font-bold text-[8px] px-1.5 py-0.5 rounded-full font-mono animate-bounce ml-1">
                  {reviewBatch.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTag("individual")}
              className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold tracking-wide flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all duration-200 cursor-pointer shrink-0 flex-1 md:flex-initial ${
                activeTag === "individual"
                  ? "bg-[#002f87] text-white shadow-md shadow-[#002f87]/10"
                  : "bg-[#f4f6fa] hover:bg-[#e9ecf4] text-slate-600 hover:text-slate-800"
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5 shrink-0" />
              <span>ADMISIÓN INDIVIDUAL</span>
            </button>
            <button
              onClick={() => setActiveTag("transporte")}
              className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold tracking-wide flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all duration-200 cursor-pointer shrink-0 flex-1 md:flex-initial ${
                activeTag === "transporte"
                  ? "bg-[#002f87] text-white shadow-md shadow-[#002f87]/10"
                  : "bg-[#f4f6fa] hover:bg-[#e9ecf4] text-slate-600 hover:text-slate-800"
              }`}
            >
              <Truck className="w-3.5 h-3.5 shrink-0" />
              <span>TRANSPORTE VOLUNTARIO</span>
            </button>
            {isSuperuser && (
              <button
                onClick={() => setActiveTag("gestion")}
                className={`py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold tracking-wide flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all duration-200 cursor-pointer shrink-0 flex-1 md:flex-initial ${
                  activeTag === "gestion"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                    : "bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-200"
                }`}
              >
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span>GESTIÓN DE CARGAS</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main container with clean top spacing that fits perfectly under sticky bars */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 pt-3 sm:pt-6 space-y-4 sm:space-y-6 lg:space-y-8">
        {/* OPERATIONAL ALERTS BAR */}
        <TickerBar />

        {/* BATCH UPLOAD OUTCOMES BANNER */}
        {batchSummaryMessage && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start space-x-3 text-sky-800 text-sm text-left animate-fadeIn shadow-sm">
            <ShieldCheck className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
            <div>
              <span className="font-bold text-sky-800">¡Sincronización Operacional Exitosa!</span>
              <p className="text-xs text-sky-600 mt-0.5">{batchSummaryMessage}</p>
            </div>
            <button
              onClick={() => setBatchSummaryMessage("")}
              className="text-sky-700 hover:text-sky-950 text-xs font-bold font-mono uppercase shrink-0 ml-auto"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* TAB CONTENTS SWITCHER WITH ENTRY TRANSITIONS */}
        <div className="animate-fadeIn">
          {/* TAB A: BATCH CARGA MASIVA */}
          {activeTag === "carga" && (
            <div className="space-y-8">
              {/* Massive loader input workspace */}
              <MassiveLoader onBatchLoaded={handleBatchLoaded} onToast={triggerToast} />

              {/* In-memory interactive review table */}
              <ReviewTable
                initialPatients={reviewBatch}
                hospitales={hospitales}
                existingPatients={existingPatients}
                onClearBatch={() => {
                  setReviewBatch([]);
                  setProcessedPages([]);
                }}
                onBatchSubmitted={handleBatchSubmitted}
                processedPages={processedPages}
              />

              {/* Fallback info when review table is empty */}
              {reviewBatch.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-lg mx-auto shadow-sm">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-2 animate-pulse">
                    <FileSpreadsheet className="w-4 h-4 text-sky-600" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">Tabla de Revisión Inactiva</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    La tabla de revisión se activará una vez que pegue una lista de texto, suba un documento CSV/Excel, o realice un escaneo de cámara.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB B: ADMISIÓN INDIVIDUAL Y BUSCADOR */}
          {activeTag === "individual" && (
            <IndividualPatient
              hospitales={hospitales}
              onPatientMutated={loadDataResources}
              authorized={authorized}
            />
          )}

          {/* TAB C: DIRECTORY DE TRANSPORTE */}
          {activeTag === "transporte" && (
            <TransportManager />
          )}

          {/* TAB D: GESTIÓN DE CARGAS (solo superusuario) */}
          {activeTag === "gestion" && isSuperuser && (
            <CargaManager />
          )}
        </div>
      </main>

      {/* System footer & auditing data */}
      <footer className="bg-white border-t border-slate-200 px-4 py-4 text-xs text-slate-500 font-sans mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Legal / Accountability statement */}
          <div className="text-center sm:text-left space-y-1">
            <p className="font-semibold text-slate-700">
              Carga de Pacientes — Voluntarios (Cuídarte Venezuela)
            </p>
            <p className="max-w-xl text-[9px] leading-relaxed text-slate-400">
              De acuerdo con las normativas operativas internas de ayuda humanitaria para contingencias de sismo 2026, todos los registros realizados por voluntarios autorizados quedan guardados con firma y traza de responsabilidad técnica.
            </p>
          </div>

          {/* Security details & configuration connection */}
          <div className="flex flex-col items-center sm:items-end text-center sm:text-right font-mono text-[8px] text-slate-500 space-y-1">
            <div>
              Auditoría IP: <strong className="text-slate-700">{getDetectedIP()}</strong>
            </div>
            <div>
              Firma Voluntario: <strong className="text-slate-700">{getVolunteerCode()}</strong>
            </div>
            <div>
              Sincronización API: <span className="text-sky-600 font-medium">Same-Origin (Rest)</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Share Button (FAB) */}
      <button
        onClick={() => {
          if (navigator.share) {
            navigator.share({
              title: "Cuídarte Venezuela",
              text: "Revisa la última actualización de la situación del sismo en Venezuela.",
              url: window.location.href,
            }).catch(err => console.warn("Web Share failed:", err));
          } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(window.location.href).then(() => {
              alert("Enlace copiado al portapapeles");
            });
          }
        }}
        className="
          fixed bottom-4 right-4
          z-50
          h-10 w-10
          rounded-full
          bg-sky-600 hover:bg-sky-700
          text-white
          shadow-lg
          flex items-center justify-center
          transition-transform duration-200
          hover:scale-105
        "
        aria-label="Compartir"
      >
        <Share2 className="h-5 w-5" />
      </button>

      {/* Toast notification system */}
      {toast && (
        <div
          id="toast-message"
          className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-2xl text-xs font-semibold shadow-2xl flex items-center gap-2 z-50 animate-bounce max-w-sm w-[90vw] text-center border ${
            toast.type === "success"
              ? "bg-emerald-600 text-white border-emerald-400"
              : "bg-rose-600 text-white border-rose-400"
          }`}
        >
          {toast.type === "success" ? (
            <ShieldCheck className="w-3.5 h-3.5 text-white shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
        </div>
      )}
    </div>
  );
}