import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { platformApi, WorkflowSummary, WorkflowField, PlatformApiError } from "../../api/client";

const FIELD_TYPES = ["text", "number", "date"];

export function StepWorkflows({ tenantId }: { tenantId: string }) {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  // form state for adding a new workflow
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<WorkflowField[]>([]);
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldRequired, setNewFieldRequired] = useState(true);
  const [newDoc, setNewDoc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    platformApi.listWorkflows(tenantId).then(setWorkflows);
  }

  useEffect(reload, [tenantId]);

  function addField() {
    if (!newFieldLabel.trim()) return;
    const id = newFieldLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    setFields((f) => [...f, { id, label: newFieldLabel.trim(), type: newFieldType, required: newFieldRequired }]);
    setNewFieldLabel("");
  }

  function addDoc() {
    if (!newDoc.trim()) return;
    setRequiredDocs((d) => [...d, newDoc.trim()]);
    setNewDoc("");
  }

  async function saveWorkflow() {
    if (!name.trim() || fields.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await platformApi.createWorkflow(tenantId, { name: name.trim(), description, fields, requiredDocuments: requiredDocs });
      setName(""); setDescription(""); setFields([]); setRequiredDocs([]);
      reload();
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="font-display font-semibold text-sm mb-1">Workflows</h2>
      <p className="text-xs text-muted mb-4">
        Define the services available in this organisation. Each becomes a tile on the requester's dashboard.
      </p>

      {workflows.length > 0 && (
        <div className="rounded-lg border border-line bg-white mb-4">
          {workflows.map((w, i) => (
            <div key={w.id}
              className={`px-4 py-2.5 ${i < workflows.length - 1 ? "border-b border-line" : ""}`}>
              <p className="text-sm font-medium">{w.name}</p>
              {w.description && <p className="text-xs text-muted">{w.description}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-line bg-white p-4 mb-6 space-y-4">
        <p className="text-xs text-muted font-medium">New workflow</p>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Service name (e.g. CHCR Request)" value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
          <input placeholder="Short description" value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
        </div>

        <div>
          <p className="text-xs text-muted mb-1.5">Form fields</p>
          {fields.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-line last:border-0">
              <span>{f.label} <span className="text-muted">({f.type})</span></span>
              <div className="flex items-center gap-2">
                {f.required && <span className="text-accent text-[10px]">required</span>}
                <button onClick={() => setFields((ff) => ff.filter((_, j) => j !== i))}
                  className="text-muted hover:text-reject">×</button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input placeholder="Field label" value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              className="flex-1 rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
            <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)}
              className="w-24 rounded-md border border-line px-2 py-1.5 text-sm bg-white">
              {FIELD_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs text-muted flex-shrink-0">
              <input type="checkbox" checked={newFieldRequired}
                onChange={(e) => setNewFieldRequired(e.target.checked)} />
              Required
            </label>
            <button onClick={addField} disabled={!newFieldLabel.trim()}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-line hover:border-accent transition-colors disabled:opacity-50">
              + Field
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-muted mb-1.5">Required documents</p>
          {requiredDocs.map((d, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-line last:border-0">
              <span>{d}</span>
              <button onClick={() => setRequiredDocs((dd) => dd.filter((_, j) => j !== i))}
                className="text-muted hover:text-reject">×</button>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input placeholder="Document name (e.g. Mission Memo)" value={newDoc}
              onChange={(e) => setNewDoc(e.target.value)}
              className="flex-1 rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
            <button onClick={addDoc} disabled={!newDoc.trim()}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-line hover:border-accent transition-colors disabled:opacity-50">
              + Doc
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-reject">{error}</p>}
        <button onClick={saveWorkflow} disabled={saving || !name.trim() || fields.length === 0}
          className="w-full rounded-md border border-line text-sm font-medium py-1.5 hover:border-accent transition-colors disabled:opacity-50">
          {saving ? "Saving…" : "Save workflow"}
        </button>
      </div>

      <button onClick={() => navigate(`/admin/tenants/${tenantId}/onboarding/5`)}
        disabled={workflows.length === 0}
        className="w-full rounded-md bg-ink text-white text-sm font-medium py-2 hover:bg-ink/90 transition-colors disabled:opacity-50">
        Continue →
      </button>
    </div>
  );
}
