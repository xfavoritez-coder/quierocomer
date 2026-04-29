"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface Props {
  onUpload: (url: string) => void;
  folder?: string;
  label?: string;
  preview?: string | null;
  circular?: boolean;
  height?: string;
}

export default function SubirFoto({ onUpload, folder = "general", label = "Subir foto", preview, circular = false, height = "120px" }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState(preview || "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync preview when prop changes (e.g. data loads from API)
  useEffect(() => {
    if (preview) setPreviewUrl(preview);
  }, [preview]);

  const compressImage = (file: File): Promise<File> => {
    // Only downscale if file exceeds upload limit — server does quality optimization
    return new Promise((resolve) => {
      if (file.size < 4 * 1024 * 1024) { resolve(file); return; }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxWidth = 2400;
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // WebP 0.99 = near-lossless, much smaller than PNG for large photos
        canvas.toBlob((blob) => {
          if (blob && blob.size < file.size) {
            resolve(new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" }));
          } else {
            resolve(file);
          }
        }, "image/webp", 0.99);
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFile = async (rawFile: File) => {
    if (!rawFile) return;
    if (!rawFile.type.startsWith("image/")) { setError("Solo se permiten imágenes"); return; }
    if (rawFile.size > 10 * 1024 * 1024) { setError("Máximo 10MB por imagen"); return; }
    setUploading(true);
    setError(null);
    const file = await compressImage(rawFile);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      if (supabase) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        console.log("[SubirFoto] Subiendo:", filename);

        const { data, error: upErr } = await supabase.storage.from("fotos").upload(filename, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

        if (upErr) {
          console.error("[SubirFoto] Error Supabase:", upErr);
          throw upErr;
        }

        console.log("[SubirFoto] Subido OK:", data.path);

        const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(data.path);

        console.log("[SubirFoto] URL pública:", urlData.publicUrl);

        onUpload(urlData.publicUrl);
        setPreviewUrl(urlData.publicUrl);
        setError(null);
      } else {
        // Fallback: use /api/upload
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) { setPreviewUrl(data.url); onUpload(data.url); }
        else throw new Error("No URL");
      }
    } catch (err: unknown) {
      console.error("[SubirFoto] Error:", err);
      setError((err as { message?: string })?.message ?? "Error al subir. Intenta de nuevo.");
      setPreviewUrl(preview || "");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginBottom: "4px" }}>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
      <div onClick={() => !uploading && inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }} style={{ height, borderRadius: circular ? "50%" : "12px", border: "2px dashed rgba(232,168,76,0.25)", background: previewUrl ? "transparent" : "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center", cursor: uploading ? "wait" : "pointer", overflow: "hidden", position: "relative", width: circular ? height : "100%" }}>
        {previewUrl ? (
          <img src={previewUrl} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : uploading ? (
          <span style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "rgba(240,234,214,0.5)" }}>Subiendo...</span>
        ) : (
          <div style={{ textAlign: "center", padding: "12px" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "6px" }}>📷</div>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.78rem", color: "rgba(240,234,214,0.4)" }}>{label}</span>
          </div>
        )}
      </div>
      {error && <p style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "#ff6b6b", marginTop: "6px" }}>{error}</p>}
    </div>
  );
}
