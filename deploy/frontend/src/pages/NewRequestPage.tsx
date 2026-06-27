import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Header } from "../components/Header";
import { DynamicForm } from "../components/DynamicForm";
import { DocumentChecklist } from "../components/DocumentChecklist";
import { api, ApiError, WorkflowDetail } from "../api/client";

export function NewRequestPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [uploadedLabels, setUploadedLabels] = useState<Set<string>>(new Set());
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load the workflow definition and create a draft to attach documents to.
  // The draft exists from the moment the form opens; abandoned drafts are
  // cleaned up server-side after 30 days.
  useEffect(() => {
    if (!workflowId) return;
    api.getWorkflow(workflowId).then(async (wf) => {
      setWorkflow(wf);
      const { id } = await api.createDraft(wf.id, {});
      setDraftId(id);
    });
  }, [workflowId]);

  async function handleUpload(label: string, file: File) {
    if (!draftId) return;
    setUploadingLabel(label);
    setError(null);
    try {
      await api.uploadDocument(draftId, label, file);
      setUploadedLabels((prev) => new Set(prev).add(label));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploadingLabel(null);
    }
  }

  async function handleSubmit() {
    if (!workflow || !draftId) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.submitDraft(draftId, values);
      navigate(`/requests/${draftId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!workflow) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Header />
      <div className="flex items-center gap-1.5 text-xs text-muted mb-4">
        <Link to="/" className="hover:text-ink">
          Services
        </Link>
        <span>/</span>
        <span className="text-ink font-medium">{workflow.name}</span>
      </div>

      <h2 className="text-sm font-medium mb-3">Details</h2>
      <div className="mb-6">
        <DynamicForm
          fields={workflow.fields}
          values={values}
          onChange={(id, value) => setValues((v) => ({ ...v, [id]: value }))}
        />
      </div>

      <h2 className="text-sm font-medium mb-3">Required documents</h2>
      <div className="mb-6">
        <DocumentChecklist
          requiredDocuments={workflow.required_documents}
          uploadedLabels={uploadedLabels}
          onUpload={handleUpload}
          uploadingLabel={uploadingLabel}
        />
      </div>

      {error && <p className="text-xs text-reject mb-3">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting || !draftId}
        className="w-full rounded-md bg-ink text-white text-sm font-medium py-2 hover:bg-ink/90 transition-colors disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit request"}
      </button>
    </div>
  );
}
