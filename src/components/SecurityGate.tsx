/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { setVolunteerCode, detectIPAddress } from "../utils/api";
import { KeyRound, ShieldAlert, Wifi } from "lucide-react";

interface SecurityGateProps {
  onAuthorized: () => void;
}

export default function SecurityGate({ onAuthorized }: SecurityGateProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [ipAddress, setIpAddress] = useState("Cargando...");
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    detectIPAddress().then((ip) => setIpAddress(ip));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.trim().length < 4 || isNaN(Number(code))) {
      setError("Código de Voluntario inválido. Debe ser un número de al menos 4 dígitos.");
      return;
    }

    setLoading(true);
    // Simulate administrative verification delay
    setTimeout(() => {
      setVolunteerCode(code.trim());
      setLoading(false);
      onAuthorized();
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 selection:bg-sky-200 selection:text-sky-950 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 relative overflow-hidden transition-all duration-300">
        
        {/* Visual Soft Glow Effect */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-sky-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center">
          {/* Logo badge using the beautifully saved logo */}
          <div className="w-20 h-20 rounded-[1.5rem] bg-white shadow-md mb-4 overflow-hidden">
            <img 
              src={`${import.meta.env.BASE_URL}logo_cuidarte.svg`}
              alt="Cuídarte Venezuela" 
              className="w-full h-full object-cover rounded-[1.5rem]"
              referrerPolicy="no-referrer"
            />
          </div>

          <span className="text-xs font-mono font-semibold text-sky-700 tracking-widest uppercase mb-1">
            Control de Operaciones Sismo 2026
          </span>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight font-display">
            Cuídarte Venezuela
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-xs leading-relaxed">
            Esta aplicación es de uso <strong className="text-sky-700 font-semibold">ESTRICTAMENTE INTERNO</strong> para voluntarios autorizados de respuesta a emergencias.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="access-code" className="block text-xs font-mono font-bold text-slate-600 uppercase tracking-wider mb-2 text-center">
              usa tú cédula o teléfono celular
            </label>
            <div className="relative">
              <input
                id="access-code"
                type="password"
                maxLength={11}
                placeholder="Ej. 12345678 o 04125556677"
                value={code}
                onChange={(e) => {
                  setError("");
                  setCode(e.target.value.replace(/\D/g, ""));
                }}
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-xl px-4 py-3 text-center text-xl tracking-widest font-mono text-sky-700 placeholder:text-slate-300 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-sky-500/10 transition-all"
                disabled={loading}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              Introduzca únicamente los números de su documento o número celular para firmar sus operaciones.
            </p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start space-x-2 text-rose-800 text-xs text-left">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 rounded-xl shadow-md active:scale-[0.98] transition-all duration-150 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? "Verificando Credenciales..." : "Acceder al Panel de Control"}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center space-x-1.5">
            <Wifi className="w-3.5 h-3.5 text-sky-600" />
            <span>Auditoría de Registro IP</span>
          </div>
          <div>
            IP: <span className="text-slate-600 font-bold">{ipAddress}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
