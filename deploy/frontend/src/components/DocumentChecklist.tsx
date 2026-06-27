import { useRef } from "react";

/**
 * Renders each required document with an upload control. Uploaded docs show
 * a check; not-yet-uploaded show an Upload button. Upload is not required to
 * submit (the backend only enforces required fields), so this is a checklist
 * aid, not a gate.
 */
export function DocumentChecklist({
  requiredDocuments,
  uploadedLabels,
  onUpload,
  uploadingLabel,
}: {
  requiredDocuments: string[];
  uploadedLabels: Set<string>;
  onUpload: (label: string, file: File) => void;
  uploadingLabel: string | null;
}) {
  if (requiredDocuments.length === 0) return null;

  return (
    <div className="rounded-lg border border-line bg-white px-4 py-1">
      {requiredDocuments.map((doc) => (
        <DocRow
          key={doc}
          label={doc}
          uploaded={uploadedLabels.has(doc)}
          uploading={uploadingLabel === doc}
          onUpload={(file) => onUpload(doc, file)}
        />
      ))}
    </div>
  );
}

function DocRow({
  label,
  uploaded,
  uploading,
  onUpload,
}: {
  label: string;
  uploaded: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-line last:border-b-0">
      <span className="text-sm flex items-center gap-2">
        <span className={uploaded ? "text-approve" : "text-muted"}>
          {uploaded ? "✓" : "○"}
        </span>
        <span className={uploaded ? "" : "text-muted"}>{label}</span>
      </span>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs font-medium px-2.5 py-1 rounded-md border border-line hover:border-accent transition-colors disabled:opacity-50"
      >
        {uploading ? "Uploading…" : uploaded ? "Replace" : "Upload"}
      </button>
    </div>
  );
}
