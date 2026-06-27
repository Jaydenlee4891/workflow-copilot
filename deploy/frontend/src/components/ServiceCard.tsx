import { Link } from "react-router-dom";
import { WorkflowSummary } from "../api/client";

export function ServiceCard({ workflow }: { workflow: WorkflowSummary }) {
  return (
    <Link
      to={`/requests/new/${workflow.id}`}
      className="block rounded-lg border border-line bg-white p-4 hover:border-accent transition-colors"
    >
      <p className="font-medium text-sm">{workflow.name}</p>
      <p className="text-xs text-muted mt-1">{workflow.description}</p>
    </Link>
  );
}
