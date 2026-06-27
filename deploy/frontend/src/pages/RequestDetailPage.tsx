import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Header } from "../components/Header";
import { ApprovalTimeline } from "../components/ApprovalTimeline";
import { StatusBadge } from "../components/RequestListItem";
import { useAuth } from "../auth/AuthContext";
import { api, RequestDetail, PendingApproval } from "../api/client";

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [myApprovals, setMyApprovals] = useState<PendingApproval[]>([]);

  const refresh = useCallback(() => {
    if (!id) return;
    Promise.all([api.getRequest(id), api.myApprovals()]).then(([r, a]) => {
      setRequest(r);
      setMyApprovals(a);
    });
  }, [id]);

  useEffect(refresh, [refresh]);

  if (!request || !user) return null;

  // The one step (if any) at the active stage that this viewer can act
  // on. A step assigned directly to me is decidable. A pooled,
  // still-unclaimed step is claimable only if /me/approvals says I'm
  // eligible for it — that endpoint already does the eligibility join
  // server-side, so this reuses it rather than re-deriving eligibility
  // client-side with no source of truth for it.
  const activeStep = request.steps.find(
    (s) => s.stage_order === request.current_stage_order && s.status === "pending"
  );
  let myActionableStepId: string | null = null;
  let myActionKind: "decide" | "claim" | null = null;

  if (activeStep) {
    if (activeStep.assigned_to === user.userId) {
      myActionableStepId = activeStep.id;
      myActionKind = "decide";
    } else if (
      activeStep.assignment_mode === "pooled" &&
      !activeStep.assigned_to &&
      myApprovals.some((a) => a.step_id === activeStep.id)
    ) {
      myActionableStepId = activeStep.id;
      myActionKind = "claim";
    }
  }

  async function handleApprove(stepId: string, comments: string) {
    await api.approveStep(request!.id, stepId, comments);
    refresh();
  }
  async function handleReject(stepId: string, comments: string) {
    await api.rejectStep(request!.id, stepId, comments);
    refresh();
  }
  async function handleClaim(stepId: string) {
    await api.claimStep(request!.id, stepId);
    refresh();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Header />

      <div className="rounded-lg border border-line bg-white p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium text-sm">{request.workflow_name}</p>
          <StatusBadge status={request.status} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm border-t border-line pt-3">
          {Object.entries(request.field_values).map(([key, value]) => (
            <div key={key}>
              <span className="text-xs text-muted block">{key}</span>
              {String(value)}
            </div>
          ))}
        </div>
      </div>

      <h2 className="text-sm font-medium mb-3">Approval timeline</h2>
      <ApprovalTimeline
        steps={request.steps}
        currentStageOrder={request.current_stage_order}
        myActionableStepId={myActionableStepId}
        myActionKind={myActionKind}
        onApprove={handleApprove}
        onReject={handleReject}
        onClaim={handleClaim}
      />
    </div>
  );
}
