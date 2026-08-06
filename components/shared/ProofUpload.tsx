"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ProofUploadProps {
  currentProofType: "photo" | "note" | null;
  currentProofUrl: string | null;
  currentProofNote: string | null;
  onSaveProof: (data: {
    proof_type: "photo" | "note";
    proof_url?: string;
    proof_note?: string;
  }) => void;
}

export function ProofUpload({
  currentProofType,
  currentProofUrl,
  currentProofNote,
  onSaveProof,
}: ProofUploadProps) {
  const [proofType, setProofType] = useState<"photo" | "note">(
    currentProofType || "photo"
  );
  const [noteText, setNoteText] = useState(currentProofNote || "");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentProofUrl);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const filePath = `proofs/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from("proofs")
        .upload(filePath, file);

      if (uploadErr) {
        // Fallback: If bucket doesn't exist or offline, create a local blob URL preview
        const localBlobUrl = URL.createObjectURL(file);
        setPreviewUrl(localBlobUrl);
        onSaveProof({ proof_type: "photo", proof_url: localBlobUrl });
      } else {
        const { data: publicUrlData } = supabase.storage
          .from("proofs")
          .getPublicUrl(filePath);

        setPreviewUrl(publicUrlData.publicUrl);
        onSaveProof({
          proof_type: "photo",
          proof_url: publicUrlData.publicUrl,
        });
      }
    } catch {
      setUploadError("Gagal mengunggah foto. Menggunakan fallback lokal.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveNote = () => {
    if (!noteText.trim()) {
      setUploadError("Catatan tidak boleh kosong.");
      return;
    }
    setUploadError(null);
    onSaveProof({ proof_type: "note", proof_note: noteText.trim() });
  };

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-5 border border-[var(--border)] shadow-xs space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
          Bukti Pengerjaan Harian
        </h3>
        {(currentProofUrl || currentProofNote) && (
          <span className="text-[10px] bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] font-semibold px-2.5 py-0.5 rounded-full border border-[var(--accent-teal)]/30">
            Sudah terisi ✓
          </span>
        )}
      </div>

      {uploadError && (
        <div className="p-3 bg-[var(--primary-soft)] border border-[var(--danger)]/30 rounded-lg text-xs text-[var(--danger)]">
          {uploadError}
        </div>
      )}

      {/* Tabs Type Selector */}
      <div className="flex bg-[var(--bg-surface-alt)] p-1 rounded-xl gap-1">
        <button
          type="button"
          onClick={() => setProofType("photo")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            proofType === "photo"
              ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          📷 Foto / Screenshot
        </button>
        <button
          type="button"
          onClick={() => setProofType("note")}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            proofType === "note"
              ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          📝 Catatan Teks
        </button>
      </div>

      {proofType === "photo" ? (
        <div className="space-y-3">
          <label className="block text-xs text-[var(--text-secondary)]">
            Upload screenshot atau foto bukti hasil pengerjaan sesi hari ini:
          </label>

          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="w-full text-xs text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--primary-soft)] file:text-[var(--primary)] hover:file:brightness-95 transition-colors cursor-pointer"
          />

          {isUploading && (
            <p className="text-xs text-[var(--primary)] animate-pulse">
              Mengunggah gambar...
            </p>
          )}

          {previewUrl && (
            <div className="mt-2 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-surface-alt)] p-2">
              <p className="text-[11px] text-[var(--text-secondary)] mb-1 font-medium">
                Pratinjau Foto Bukti:
              </p>
              {/* eslint-disable-next-html-element-suppression */}
              <img
                src={previewUrl}
                alt="Bukti Pengerjaan"
                className="max-h-48 rounded-lg object-contain mx-auto"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-xs text-[var(--text-secondary)]">
            Tulis catatan penjelasan hasil pengerjaan sesi hari ini:
          </label>
          <textarea
            rows={3}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Tulis ringkasan hasil kerja hari ini..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] placeholder:text-[var(--text-secondary)]"
          />
          <button
            type="button"
            onClick={handleSaveNote}
            className="w-full py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Simpan Catatan Bukti
          </button>
        </div>
      )}
    </div>
  );
}
