import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { ServiceCard } from "../components/ServiceCard";
import { RequestListItem } from "../components/RequestListItem";
import { api, WorkflowSummary, RequestSummary, PendingApproval } from "../api/client";

export function DashboardPage() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [myRequests, setMyRequests] = useState<RequestSummary[]>([]);
  const [myApprovals, setMyApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listWorkflows(), api.myRequests(), api.myApprovals()])
      .then(([w, r, a]) => {
        setWorkflows(w);
        setMyRequests(r);
        setMyApprovals(a);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Centered>Loading…</Centered>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Header />

      <h2 className="text-sm font-medium mb-3">Available services</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-8">
        {workflows.map((w) => (
          <ServiceCard key={w.id} workflow={w} />
        ))}
        {workflows.length === 0 && <p className="text-sm text-muted col-span-full">No services configured yet.</p>}
      </div>

      <div className="grid sm:grid-cols-2 gap-7">
        <div>
          <h2 className="text-sm font-medium mb-3">My requests</h2>
          <div className="space-y-2">
            {myRequests.map((r) => (
              <RequestListItem
                key={r.id}
                title={r.workflow_name}
                subtitle={`Stage ${r.current_stage_order}`}
                status={r.status}
                to={`/requests/${r.id}`}
              />
            ))}
            {myRequests.length === 0 && <p className="text-sm text-muted">No requests yet.</p>}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium mb-3">My approvals</h2>
          <div className="space-y-2">
            {myApprovals.map((a) => (
              <RequestListItem
                key={a.step_id}
                title={a.workflow_name}
                subtitle={a.assignment_mode === "pooled" && !a.assigned_to ? "Unclaimed pool item" : "Assigned to you"}
                status="in_review"
                to={`/requests/${a.request_id}`}
              />
            ))}
            {myApprovals.length === 0 && <p className="text-sm text-muted">Nothing pending.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center text-sm text-muted">{children}</div>;
}
