/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createWorker, Word } from "tesseract.js";
import { ParsedPaciente } from "../types";

/**
 * Normalizes patient names in Spanish, removing multiple spaces,
 * standardizing casing, and handling common lower-case grammatical particles
 * like "de", "del", "la", "las", "los", "y", "e".
 */
export function homologateName(name: string): string {
  if (!name) return "";
  const lowercaseParticles = ["de", "del", "la", "las", "los", "y", "e"];
  return name
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((word, index, arr) => {
      if (!word) return "";
      if (index > 0 && index < arr.length - 1 && lowercaseParticles.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

let tesseractWorker: any = null;
let isOpenCVLoading = false;
let isOpenCVReady = false;

// Dynamic script loader for OpenCV.js
export function loadOpenCV(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if ((window as any).cv) {
    isOpenCVReady = true;
    return Promise.resolve(true);
  }
  if (isOpenCVLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if ((window as any).cv) {
          clearInterval(check);
          isOpenCVReady = true;
          resolve(true);
        }
      }, 100);
    });
  }

  isOpenCVLoading = true;
  console.log("Lazy-loading OpenCV.js WASM via CDN...");

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.9.0/opencv.js";
    script.async = true;
    script.defer = true;
    
    // OpenCV triggers onRuntimeInitialized when WASM compilation is complete
    (window as any).Module = {
      onRuntimeInitialized: () => {
        console.log("OpenCV.js WASM loaded successfully.");
        isOpenCVReady = true;
        isOpenCVLoading = false;
        resolve(true);
      },
    };

    script.onload = () => {
      // In case onRuntimeInitialized doesn't trigger or is missing, fall back to polling
      setTimeout(() => {
        if ((window as any).cv) {
          isOpenCVReady = true;
          isOpenCVLoading = false;
          resolve(true);
        }
      }, 1000);
    };

    script.onerror = (err) => {
      console.warn("Failed to load OpenCV.js from 4.9.0, trying fallback 4.5.5...", err);
      // Fallback script loading
      const fallbackScript = document.createElement("script");
      fallbackScript.src = "https://docs.opencv.org/4.5.5/opencv.js";
      fallbackScript.async = true;
      fallbackScript.defer = true;

      fallbackScript.onload = () => {
        setTimeout(() => {
          if ((window as any).cv) {
            isOpenCVReady = true;
            isOpenCVLoading = false;
            resolve(true);
          }
        }, 1000);
      };

      fallbackScript.onerror = (fallbackErr) => {
        console.error("Failed to load fallback OpenCV.js as well:", fallbackErr);
        isOpenCVLoading = false;
        resolve(false);
      };

      document.body.appendChild(fallbackScript);
    };

    document.body.appendChild(script);
  });
}

export function isOpenCVLoaded(): boolean {
  return isOpenCVReady && !!(window as any).cv;
}

// Lazy load Spanish Tesseract Worker with local caching
export async function getTesseractWorker(onProgress?: (pct: number) => void): Promise<any> {
  if (tesseractWorker) return tesseractWorker;

  console.log("Initializing Spanish Tesseract.js Worker...");
  try {
    const worker = await createWorker("spa", 1, {
      logger: (m) => {
        if (m.status === "recognizing text" && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
      cacheMethod: "write", // Enable local caching
    });

    tesseractWorker = worker;
    return worker;
  } catch (err) {
    console.error("Error initializing Tesseract.js:", err);
    throw err;
  }
}

/**
 * Preprocess image with OpenCV.js (upscale → grayscale)
 * Falls back to HTML5 Canvas 2D if OpenCV is not loaded.
 *
 * Pipeline (when OpenCV available):
 *   1. Optional upscale 4× if image < 1200px (using LANCZOS4 or CUBIC interpolation)
 *   2. Grayscale
 *
 * Pipeline (when OpenCV not available - Canvas 2D fallback):
 *   1. Optional upscale 4× if image < 1200px (using CSS imageSmoothingQuality)
 *   2. Grayscale (via luminance)
 *   3. No additional filtering (we rely on Tesseract's internal preprocessing)
 */
export function preprocessImage(
  imageEl: HTMLImageElement | HTMLVideoElement,
  outputCanvas: HTMLCanvasElement
): boolean {
  const ctx = outputCanvas.getContext("2d");
  if (!ctx) return false;

  // Set canvas size to match image/video source
  const origWidth = imageEl instanceof HTMLVideoElement ? imageEl.videoWidth : imageEl.naturalWidth;
  const origHeight = imageEl instanceof HTMLVideoElement ? imageEl.videoHeight : imageEl.naturalHeight;

  if (origWidth === 0 || origHeight === 0) return false;

  // ---------- OPTIONAL UPSCALE TO OPTIMAL DIMENSION ----------
  // El usuario aclaró que quería decir 4X (multiplicar por 4) cuando el tamaño original fuera pequeño, no necesariamente 4K (4000px)
  let scaleFactor = 1.0;
  const maxDim = Math.max(origWidth, origHeight);
  if (maxDim < 1000) {
    // Si la imagen es pequeña (dimensión máxima < 1000px), aplicamos un reescalado directo de 4X (4.0)
    scaleFactor = 4.0;
  } else if (maxDim < 2000) {
    // Si tiene un tamaño intermedio, reescalamos por 2X (2.0)
    scaleFactor = 2.0;
  } else {
    // Para imágenes que ya son grandes, no hace falta reescalar
    scaleFactor = 1.0;
  }

  const width = Math.round(origWidth * scaleFactor);
  const height = Math.round(origHeight * scaleFactor);
  const needsUpscale = scaleFactor > 1.0;

  outputCanvas.width = width;
  outputCanvas.height = height;

  // Draw original onto canvas. If needsUpscale is true, the canvas 2D scaling acts as a smooth starter resize.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imageEl, 0, 0, width, height);

  // ---------- OPENCV PROCESSING ----------
  if (isOpenCVLoaded()) {
    try {
      const cv = (window as any).cv;
      const src = cv.imread(outputCanvas); // RGBA Mat

      // 1. Grayscale
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // 2. Soft Edge-Preserving Smoothing & Anti-aliasing
      // A smaller filter diameter and lower sigma ensures high-fidelity text lines and eliminates blurriness
      const smoothed = new cv.Mat();
      try {
        cv.bilateralFilter(gray, smoothed, 3, 20, 20, cv.BORDER_DEFAULT);
      } catch (e) {
        try {
          // Fallback to gentle GaussianBlur
          cv.GaussianBlur(gray, smoothed, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
        } catch (ee) {
          gray.copyTo(smoothed);
        }
      }

      // 3. Contrast adjustment and White Background Normalization
      // Maps values to [15, 245] range to maximize paper whiteness while preserving smooth letter edges.
      const finalGray = new cv.Mat();
      try {
        if (typeof cv.CLAHE !== 'undefined') {
          // CLAHE with modest clip limit (1.5) to keep contrast crisp and text sharp
          const clahe = new cv.CLAHE(1.5, new cv.Size(8, 8));
          const tempClahe = new cv.Mat();
          clahe.apply(smoothed, tempClahe);
          cv.normalize(tempClahe, finalGray, 15, 245, cv.NORM_MINMAX);
          tempClahe.delete();
          clahe.delete();
        } else {
          cv.normalize(smoothed, finalGray, 15, 245, cv.NORM_MINMAX);
        }
      } catch (e) {
        try {
          cv.normalize(smoothed, finalGray, 15, 245, cv.NORM_MINMAX);
        } catch (ee) {
          smoothed.copyTo(finalGray);
        }
      }

      // Show result
      cv.imshow(outputCanvas, finalGray);

      // Clean up Mats
      src.delete();
      gray.delete();
      smoothed.delete();
      finalGray.delete();

      console.log(
        `Image processed with OpenCV.js — upscale=${needsUpscale ? scaleFactor.toFixed(1) + '×' : '1×'} → ` +
        `Grayscale + Crisper Bilateral antialiasing + High Contrast Fondo Blanco [15, 245] (${width}x${height})`
      );
      return true;
    } catch (err) {
      console.error("OpenCV processing failed, falling back to Canvas 2D:", err);
    }
  }

  // ---------- FALLBACK: Pure Canvas 2D ----------
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Grayscale conversion
    let min = 255;
    let max = 0;
    const grays = new Uint8Array(data.length / 4);

    for (let i = 0; i < data.length; i += 4) {
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      grays[i / 4] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }

    const range = max - min || 1;

    for (let i = 0; i < data.length; i += 4) {
      const g = grays[i / 4];
      // Normalize to 0-255
      let norm = ((g - min) / range) * 255;

      // Piecewise sigmoid-like mapping for soft paper whitening & dark text enhancement
      let soft;
      if (norm > 160) {
        // Light grey/high values go to clean off-white paper [210, 252]
        soft = 210 + ((norm - 160) / (255 - 160)) * (252 - 210);
      } else if (norm < 90) {
        // Dark pixels kept dark and legible [25, 75]
        soft = 25 + (norm / 90) * (75 - 25);
      } else {
        // Smooth transitions [75, 210]
        soft = 75 + ((norm - 90) / (160 - 90)) * (210 - 75);
      }

      data[i] = soft;
      data[i + 1] = soft;
      data[i + 2] = soft;
    }

    ctx.putImageData(imgData, 0, 0);
    console.log(
      `Image processed with Canvas 2D fallback — upscale=${needsUpscale ? scaleFactor.toFixed(1) + '×' : '1×'} → ` +
      `Smooth paper-white contrast curve (${width}x${height})`
    );
    return true;
  } catch (err) {
    console.error("Canvas grayscale fallback failed:", err);
    return false;
  }
}

/**
 * Coordinate Clustering and Smart Parsing:
 * Group words into text lines based on bounding boxes, sort them horizontally,
 * and parse rows using Venezuelan clinical-field heuristic rules.
 */
export function parseOCRWords(words: Word[]): ParsedPaciente[] {
  if (!words || words.length === 0) return [];

  // 1. Cluster words into horizontal rows based on vertical midpoint overlap
  const rows: Word[][] = [];
  const sortedWords = [...words].sort((a, b) => {
    const aMidY = (a.bbox.y0 + a.bbox.y1) / 2;
    const bMidY = (b.bbox.y0 + b.bbox.y1) / 2;
    return aMidY - bMidY;
  });

  for (const word of sortedWords) {
    const wordMidY = (word.bbox.y0 + word.bbox.y1) / 2;
    const wordHeight = word.bbox.y1 - word.bbox.y0;
    // Tolerance threshold is 60% of the word height
    const tolerance = Math.max(12, wordHeight * 0.6);

    let placed = false;
    for (const r of rows) {
      // Compare with the average midY of words currently in this row
      const rowMidYSum = r.reduce((sum, w) => sum + (w.bbox.y0 + w.bbox.y1) / 2, 0);
      const rowAvgMidY = rowMidYSum / r.length;

      if (Math.abs(wordMidY - rowAvgMidY) < tolerance) {
        r.push(word);
        placed = true;
        break;
      }
    }

    if (!placed) {
      rows.push([word]);
    }
  }

  const parsedPatients: ParsedPaciente[] = [];

  // Helper cleanups for common OCR noise in medical sheets
  const cleanToken = (text: string) => {
    return text.replace(/[.,:;()_#\-'"\s]/g, "");
  };

  for (const r of rows) {
    // Sort words in the same row horizontally (left-to-right)
    r.sort((a, b) => a.bbox.x0 - b.bbox.x0);

    // Filter out very short noise tokens (e.g. single symbols or very low confidence single-letter tokens)
    const activeWords = r.filter(w => {
      const clean = cleanToken(w.text);
      if (clean.length === 0) return false;
      if (clean.length === 1 && w.confidence < 50) return false;
      return true;
    });

    if (activeWords.length === 0) continue;

    // Calculate average row confidence
    const avgConfidence = Math.round(
      activeWords.reduce((sum, w) => sum + w.confidence, 0) / activeWords.length
    );

    // Heuristic Smart Parser:
    // Identify words based on specific rules:
    // - Number with 6-8 digits as "cédula" (Venezuelan ID ranges)
    // - Numeric value <= 120 as "edad"
    // - Word starting with F/f or M/m as "sexo" (Femenino / Masculino)
    // - Remainder strings form the "nombre" and "procedencia" (origin)

    let parsedCedula = "";
    let parsedEdad: number | undefined = undefined;
    let parsedSexo: "Masculino" | "Femenino" | "Desconocido" = "Desconocido";
    const nameTokens: string[] = [];
    const originTokens: string[] = [];

    // Tracks if we have already assigned these values in the row
    let hasCedula = false;
    let hasEdad = false;
    let hasSexo = false;

    for (const word of activeWords) {
      const clean = cleanToken(word.text);
      const lowerText = word.text.toLowerCase().trim();

      // Check if it's a Cédula (typically 6 to 8 digits, sometimes prepended by V/E or with extra characters)
      const digitsOnly = clean.replace(/\D/g, "");
      if (!hasCedula && digitsOnly.length >= 6 && digitsOnly.length <= 9) {
        parsedCedula = digitsOnly;
        hasCedula = true;
        continue;
      }

      // Check if it's a Sex token
      const isM = /^(m(asc)?(ulino)?|h(ombre)?)$/i.test(clean);
      const isF = /^(f(em)?(enino)?|m(ujer)?)$/i.test(clean);
      if (!hasSexo && (isM || isF)) {
        parsedSexo = isM ? "Masculino" : "Femenino";
        hasSexo = true;
        continue;
      }

      // Check if it's an Age (numeric <= 120, not part of a Cédula)
      const numVal = parseInt(clean, 10);
      if (!hasEdad && !isNaN(numVal) && numVal > 0 && numVal <= 120 && clean.length <= 3) {
        parsedEdad = numVal;
        hasEdad = true;
        continue;
      }

      // If it's none of the above, we map it as text tokens
      // Words before numbers are usually part of the patient's name
      // Words after numbers or other metadata are often parsed as origin/procedencia
      if (!hasCedula && !hasEdad) {
        nameTokens.push(word.text);
      } else {
        originTokens.push(word.text);
      }
    }

    const fullname = nameTokens.join(" ").trim();
    
    // Skip row if name is empty or too short (could be just header noise like "Nombre", "Cedula", etc.)
    if (!fullname || fullname.length < 3 || /^(nombre|cedula|edad|sexo|hospital|fecha|ingreso)$/i.test(fullname)) {
      continue;
    }

    // Compose parsed object
    parsedPatients.push({
      id_temporal: Math.random().toString(36).substring(2, 9),
      nombre: fullname,
      cedula: parsedCedula || undefined,
      edad: parsedEdad,
      sexo: parsedSexo,
      procedencia: originTokens.join(" ").trim() || undefined,
      confianza_ocr: avgConfidence,
      status_verificacion: "pendiente",
    });
  }

  return parsedPatients;
}
