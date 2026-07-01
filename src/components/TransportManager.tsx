/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Transporte } from "../types";
import { getTransportes, createTransporte, updateTransporte, deleteTransporte } from "../utils/api";
import { Truck, Search, Phone, ShieldCheck, Check, Trash2, X, AlertTriangle, UserPlus, ToggleLeft, ToggleRight, Filter, RefreshCw } from "lucide-react";

const VENEZUELAN_CITIES = [
  "Caracas (Distrito Capital)",
  "Maracay (Aragua)",
  "Valencia (Carabobo)",
  "Barquisimeto (Lara)",
  "Maracaibo (Zulia)",
  "San Cristóbal (Táchira)",
  "Los Teques (Miranda)",
  "Guarenas/Guatire (Miranda)",
  "La Guaira (Vargas)",
  "Puerto La Cruz (Anzoátegui)",
  "Mérida (Mérida)"
];

const VEHICLE_TYPES = [
  "Ambulancia Soporte Básico",
  "Ambulancia Soporte Avanzado",
  "Toyota Hilux / Pick-up 4x4",
  "Camión 350 / Carga Ligera",
  "Camión de Carga Pesada (750 / Gandola)",
  "Rústico SUV / Machito 4x4",
  "Vehículo Sedán / Familiar"
];

export default function TransportManager() {
  const [transportList, setTransportList] = useState<Transporte[]>([]);
  const [loading, setLoading] = useState(false);

  // --- FILTERS STATE ---
  const [filterSearch, setFilterSearch] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterDisponible, setFilterDisponible] = useState<boolean | null>(null); // null = todos, true = disponible, false = inactivo

  // --- REGISTRATION FORM STATE ---
  const [regNombre, setRegNombre] = useState("");
  const [regTelefono, setRegTelefono] = useState("");
  const [regCiudad, setRegCiudad] = useState("");
  const [regVehiculo, setRegVehiculo] = useState("");
  const [regCapPersonas, setRegCapPersonas] = useState(2);
  const [regCapCarga, setRegCapCarga] = useState("");
  const [regNotas, setRegNotas] = useState("");
  const [regCedula, setRegCedula] = useState(""); // PIN

  const [regSuccess, setRegSuccess] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");

  // --- MANAGEMENT PORTAL STATE ---
  const [managingItem, setManagingItem] = useState<Transporte | null>(null);
  const [authCedula, setAuthCedula] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  
  // Management actions
  const [manageNotes, setManageNotes] = useState("");
  const [manageDisponible, setManageDisponible] = useState(true);
  const [manageLoading, setManageLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    setLoading(true);
    try {
      const data = await getTransportes();
      setTransportList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNombre || !regTelefono || !regCiudad || !regVehiculo || !regCedula) {
      setRegError("Todos los campos marcados con asterisco (*) son obligatorios.");
      return;
    }

    setRegLoading(true);
    setRegError("");
    setRegSuccess(false);

    try {
      const payload = {
        nombre: regNombre.trim(),
        telefono: regTelefono.trim(),
        ciudad: regCiudad,
        vehiculo: regVehiculo,
        capacidad_personas: regCapPersonas,
        capacidad_carga: regCapCarga.trim() || "N/A",
        notas: regNotas.trim() || undefined,
        cedula: regCedula.trim(),
      };

      const res = await createTransporte(payload);
      if (res.ok) {
        setRegSuccess(true);
        setRegNombre("");
        setRegTelefono("");
        setRegCiudad("");
        setRegVehiculo("");
        setRegCapPersonas(2);
        setRegCapCarga("");
        setRegNotas("");
        setRegCedula("");
        loadResources();
        setTimeout(() => setRegSuccess(false), 4000);
      } else {
        setRegError("Error en servidor al dar de alta conductor.");
      }
    } catch (err: any) {
      setRegError(err.message || "Error al conectar con la API.");
    } finally {
      setRegLoading(false);
    }
  };

  // --- MANAGEMENT PORTAL HANDLERS ---
  const handleOpenManage = (t: Transporte) => {
    setManagingItem(t);
    setAuthCedula("");
    setIsAuthed(false);
    setAuthError("");
    setManageNotes(t.notas || "");
    setManageDisponible(t.disponible);
    setShowDeleteConfirm(false);
  };

  const handleVerifyPIN = () => {
    if (!managingItem) return;
    setAuthError("");

    // Simulate validation - in real same-origin API, the backend does this validation.
    // In our mock, we compare with the stored PIN/Cédula inside mockDB.
    if (managingItem.cedula && managingItem.cedula !== authCedula.trim()) {
      setAuthError("La Cédula/PIN ingresada no coincide con el registro original de este conductor.");
      return;
    }
    
    setIsAuthed(true);
  };

  const handleUpdateStatus = async () => {
    if (!managingItem) return;
    setManageLoading(true);
    setAuthError("");

    try {
      const res = await updateTransporte({
        id: managingItem.id,
        cedula: authCedula.trim(),
        disponible: manageDisponible,
        notas: manageNotes.trim(),
      });

      if (res.ok) {
        setManagingItem(null);
        loadResources();
      } else {
        setAuthError(res.error || "No se pudo actualizar el recurso.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Error de red.");
    } finally {
      setManageLoading(false);
    }
  };

  const handleDeleteResource = async () => {
    if (!managingItem) return;
    
    setManageLoading(true);
    setAuthError("");

    try {
      const res = await deleteTransporte(managingItem.id, authCedula.trim());
      if (res.ok) {
        setManagingItem(null);
        loadResources();
      } else {
        setAuthError(res.error || "No se pudo dar de baja el recurso.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Error de red.");
    } finally {
      setManageLoading(false);
    }
  };

  // Filter lists dynamically
  const filteredList = transportList.filter((t) => {
    const matchesSearch =
      t.nombre.toLowerCase().includes(filterSearch.toLowerCase()) ||
      t.vehiculo.toLowerCase().includes(filterSearch.toLowerCase());
    
    const matchesCity = filterCity === "" || t.ciudad.includes(filterCity);
    
    const matchesDisponible =
      filterDisponible === null || t.disponible === filterDisponible;

    return matchesSearch && matchesCity && matchesDisponible;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans text-left">
      
      {/* LEFT COLUMN: SELF REGISTRATION FORM */}
      <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-fit text-slate-800">
        <div className="flex items-center space-x-2.5 mb-5 font-sans">
          <div className="w-10 h-10 bg-sky-50 border border-sky-200 text-sky-700 rounded-xl flex items-center justify-center">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 font-display">Registrar Recurso de Transporte</h2>
            <p className="text-xs text-slate-500">Inscriba su vehículo de apoyo para la red de ayuda</p>
          </div>
        </div>

        <form onSubmit={handleRegisterDriver} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Nombre Completo Conductor <span className="text-sky-600 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Pedro Rafael González"
                value={regNombre}
                onChange={(e) => setRegNombre(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Teléfono de Contacto <span className="text-sky-600 font-bold">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="Ej. 0412-5556677"
                value={regTelefono}
                onChange={(e) => setRegTelefono(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Cédula / PIN Seguridad <span className="text-sky-600 font-bold">*</span>
              </label>
              <input
                type="password"
                required
                maxLength={9}
                placeholder="PIN para gestionar"
                value={regCedula}
                onChange={(e) => setRegCedula(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">Cédula numérica utilizada como llave para editar o remover su vehículo.</p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Ciudad Base de Operación <span className="text-sky-600 font-bold">*</span>
              </label>
              <select
                value={regCiudad}
                onChange={(e) => setRegCiudad(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none"
              >
                <option value="">-- Seleccionar Ciudad --</option>
                {VENEZUELAN_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Tipo de Vehículo <span className="text-sky-600 font-bold">*</span>
              </label>
              <select
                value={regVehiculo}
                onChange={(e) => setRegVehiculo(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none"
              >
                <option value="">-- Seleccionar Categoría --</option>
                {VEHICLE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Capacidad Pasajeros
              </label>
              <input
                type="number"
                min={1}
                max={40}
                value={regCapPersonas}
                onChange={(e) => setRegCapPersonas(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Límite Carga Pesada
              </label>
              <input
                type="text"
                placeholder="Ej: 800 kg o 2 paletas"
                value={regCapCarga}
                onChange={(e) => setRegCapCarga(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                Notas Adicionales, Equipamiento o Rutas Frecuentes
              </label>
              <textarea
                rows={3}
                placeholder="Ej: Cuenta con mecánicos aliados. Ruta frecuente Maracay - Valencia."
                value={regNotas}
                onChange={(e) => setRegNotas(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none font-sans"
              />
            </div>
          </div>

          {regError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg p-3">
              {regError}
            </div>
          )}

          {regSuccess && (
            <div className="bg-sky-50 border border-sky-200 text-sky-800 text-xs rounded-lg p-3 flex items-center space-x-2">
              <Check className="w-4 h-4 text-sky-600" />
              <span>¡Vehículo registrado con éxito! Activo en el directorio.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={regLoading}
            id="btn-register-transport"
            className="w-full bg-[#002f87] hover:bg-[#00246b] disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-colors text-sm flex items-center justify-center space-x-1 cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>{regLoading ? "Registrando Vehículo..." : "Dar de Alta Vehículo de Apoyo"}</span>
          </button>
        </form>
      </div>

      {/* RIGHT COLUMN: SEARCHABLE RESOURCE DIRECTORY */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col h-full min-h-[500px] text-slate-800">
        <div className="flex items-center justify-between mb-5 font-sans">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 bg-sky-50 border border-sky-200 text-sky-700 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-display">Directorio de Transporte Voluntario</h2>
              <p className="text-xs text-slate-500">Recursos logísticos y humanitarios activos para movilización médica</p>
            </div>
          </div>

          <button
            onClick={loadResources}
            className="text-sky-700 hover:text-sky-800 text-xs font-mono font-bold hover:underline"
          >
            Sincronizar
          </button>
        </div>

        {/* FILTERS TOOLBAR */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5 space-y-3">
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center space-x-1">
            <Filter className="w-3 h-3" />
            <span>Herramientas de Filtrado Operativo</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Name/Vehicle Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Conductor o vehículo..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* City selection */}
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
            >
              <option value="">Todas las ciudades</option>
              {VENEZUELAN_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c.split(" (")[0]}
                </option>
              ))}
            </select>

            {/* Availability selector */}
            <select
              value={filterDisponible === null ? "todos" : String(filterDisponible)}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "todos") setFilterDisponible(null);
                else setFilterDisponible(val === "true");
              }}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
            >
              <option value="todos">Todos los estados</option>
              <option value="true">Disponible Ahora</option>
              <option value="false">Ocupado / Inactivo</option>
            </select>
          </div>
        </div>

        {/* DRIVERS DIRECTORY CONTAINER */}
        <div className="flex-1 overflow-y-auto max-h-[400px] space-y-3 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-6 h-6 text-sky-600 animate-spin" />
            </div>
          ) : filteredList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredList.map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between text-left h-full"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-sm tracking-tight">{t.nombre}</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        t.disponible ? "bg-sky-600 animate-pulse" : "bg-slate-400"
                      }`} title={t.disponible ? "Disponible" : "Ocupado"} />
                    </div>

                    <p className="text-[11px] font-mono font-bold text-sky-700 mt-1">{t.vehiculo}</p>
                    
                    <div className="text-xs text-slate-600 space-y-1 mt-3">
                      <div>Ciudad: <span className="text-slate-800 font-medium">{t.ciudad.split(" (")[0]}</span></div>
                      <div>Capacidad: <span className="text-slate-800 font-medium">{t.capacidad_personas} pers / {t.capacidad_carga}</span></div>
                      {t.notes && <p className="text-[11px] text-slate-500 italic mt-1 line-clamp-2">"{t.notes}"</p>}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                    <a
                      href={`tel:${t.telefono}`}
                      className="bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 flex items-center space-x-1 transition-all cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-sky-600" />
                      <span>{t.telefono}</span>
                    </a>
                    
                    <button
                      onClick={() => handleOpenManage(t)}
                      className="bg-sky-50 hover:bg-[#002f87] text-sky-700 hover:text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border border-sky-200 hover:border-[#002f87]"
                    >
                      Gestionar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm font-medium text-slate-500">No se encontraron transportes activos</p>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Ajuste los filtros o use el panel izquierdo para registrar un nuevo conductor de apoyo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* REGISTRY MANAGEMENT PORTAL DIALOG/MODAL */}
      {managingItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn font-sans text-left">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 shadow-2xl relative text-slate-800">
            <button
              onClick={() => setManagingItem(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-slate-800 flex items-center space-x-1.5 mb-2 font-display">
              <ShieldCheck className="w-5 h-5 text-sky-700" />
              <span>Gestionar Recurso de Apoyo</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Conductor: <strong className="text-slate-800 font-bold">{managingItem.nombre}</strong> ({managingItem.vehiculo})
            </p>

            {!isAuthed ? (
              /* PIN VERIFICATION SCREEN */
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                    Ingrese su Cédula / PIN de Seguridad
                  </label>
                  <input
                    type="password"
                    maxLength={9}
                    placeholder="Ingrese Cédula del conductor..."
                    value={authCedula}
                    onChange={(e) => {
                      setAuthError("");
                      setAuthCedula(e.target.value.replace(/\D/g, ""));
                    }}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-lg px-4 py-2.5 text-center text-lg font-mono text-sky-700 focus:outline-none"
                  />
                </div>

                {authError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg p-3">
                    {authError}
                  </div>
                )}

                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={() => setManagingItem(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 rounded-lg cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={handleVerifyPIN}
                    className="flex-1 bg-[#002f87] hover:bg-[#00246b] text-white text-xs font-bold py-2 rounded-lg cursor-pointer"
                  >
                    Verificar PIN
                  </button>
                </div>
              </div>
            ) : (
              /* VERIFIED EDIT PORTAL */
              <div className="space-y-4">
                {/* Active status switcher */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Disponibilidad en Tiempo Real</span>
                    <p className="text-[10px] text-slate-400">¿Se encuentra disponible para traslados inmediatos?</p>
                  </div>
                  <button
                    onClick={() => setManageDisponible(!manageDisponible)}
                    className="text-sky-600 hover:text-sky-700 transition-colors cursor-pointer animate-fadeIn"
                  >
                    {manageDisponible ? (
                      <ToggleRight className="w-9 h-9 text-sky-600" />
                    ) : (
                      <ToggleLeft className="w-9 h-9 text-slate-400" />
                    )}
                  </button>
                </div>

                {/* Edit notes */}
                <div>
                  <label className="block text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                    Actualizar Notas o Equipamiento
                  </label>
                  <textarea
                    rows={3}
                    value={manageNotes}
                    onChange={(e) => setManageNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                {authError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg p-3">
                    {authError}
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setIsAuthed(false)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 rounded-lg cursor-pointer"
                    >
                      Volver
                    </button>
                    <button
                      onClick={handleUpdateStatus}
                      disabled={manageLoading}
                      className="flex-2 bg-[#002f87] hover:bg-[#00246b] text-white text-xs font-bold py-2 rounded-lg cursor-pointer"
                    >
                      {manageLoading ? "Guardando..." : "Guardar Cambios"}
                    </button>
                  </div>

                  {!showDeleteConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={manageLoading}
                      className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold py-2 rounded-lg transition-all flex items-center justify-center space-x-1 cursor-pointer border border-rose-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Dar de Baja Recurso Permanentemente</span>
                    </button>
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-center flex flex-col space-y-2">
                      <p className="text-xs text-rose-800 font-semibold leading-tight">
                        ¿Confirma dar de baja este recurso de transporte permanentemente?
                      </p>
                      <div className="flex space-x-2 justify-center">
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-3 py-1 bg-white border border-slate-200 text-slate-700 text-[11px] rounded hover:bg-slate-50 font-bold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteResource}
                          disabled={manageLoading}
                          className="px-3 py-1 bg-rose-600 text-white text-[11px] rounded hover:bg-rose-700 font-bold flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Sí, dar de baja</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
