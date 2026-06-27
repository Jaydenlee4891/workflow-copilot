import { useState } from "react";
import { ApprovalStep } from "../api/client";

interface Props {
  steps: ApprovalStep[];
  currentStageOrder: number;
  myActionableStepId: string | null;
  myActionKind: "decide" | "claim" | null;
  onApprove: (stepId: string, comments: string) => void;
  onReject: (stepId: string, comments: string) => void;
  onClaim: (stepId: string) => void;
}

function groupByStage(steps: ApprovalStep[]): [number, ApprovalStep[]][] {
  const groups = new Map<number, ApprovalStep[]>();
  for (const step of steps) {
    const list = groups.get(step.stage_order) ?? [];
    list.push(step);
    groups.set(step.stage_order, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b);
}

function StageIcon({ stageState }: { stageState: "completed" | "active" | "upcoming" }) {
  if (stageState === "completed") return <span className="text-approve text-sm">✓</span>;
  if (stageState === "active") return <span className="text-accent text-sm">●</span>;
  return <span className="text-muted text-sm">○</span>;
}

function ActionPanel({
  step,
  kind,
  onApprove,
  onReject,
  onClaim,
}: {
  step: ApprovalStep;
  kind: "decide" | "claim";
  onApprove: (stepId: string, comments: string) => void;
  onReject: (stepId: string, comments: string) => void;
  onClaim: (stepId: string) => void;
}) {
  const [comments, setComments] = useState("");

  if (kind === "claim") {
    return (
      <button
        onClick={() => onClaim(step.id)}
        className="mt-2 text-xs font-medium px-3 py-1.5 rounded-md border border-line hover:border-accent transition-colors"
      >
        Claim
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        placeholder="Add a comment (optional)"
        className="w-full text-xs rounded-md border border-line px-2.5 py-1.5 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onReject(step.id, comments)}
          className="flex-1 text-xs font-medium px-3 py-1.5 rounded-md border border-line hover:border-reject hover:text-reject transition-colors"
        >
          Reject
        </button>
        <button
          onClick={() => onApprove(step.id, comments)}
          className="flex-1 text-xs font-medium px-3 py-1.5 rounded-md bg-approve-soft text-approve border border-approve/30 hover:bg-approve hover:text-white transition-colors"
        >
          Approve
        </button>
      </div>
    </div>
  );
}

export function ApprovalTimeline({
  steps,
  currentStageOrder,
  myActionableStepId,
  myActionKind,
  onApprove,
  onReject,
  onClaim,
}: Props) {
  const stages = groupByStage(steps);

  return (
    <div className="space-y-4">
      {stages.map(([stageOrder, stageSteps]) => {
        const stageState =
          stageOrder < currentStageOrder ? "completed" : stageOrder === currentStageOrder ? "active" : "upcoming";

        return (
          <div key={stageOrder} className="flex gap-3" style={{ opacity: stageState === "upcoming" ? 0.55 : 1 }}>
            <div className="flex flex-col items-center flex-shrink-0 w-5 pt-2.5">
              <StageIcon stageState={stageState} />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              {stageSteps.map((step) => {
                const isMine = step.id === myActionableStepId;
                return (
                  <div
                    key={step.id}
                    className={`rounded-md border bg-white px-3.5 py-2.5 ${
                      isMine ? "border-accent" : "border-line"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {step.role_name}
                        {isMine && <span className="text-muted font-normal"> (you)</span>}
                      </span>
                      <span
                        className={`text-xs ${
                          step.status === "approved"
                            ? "text-approve"
                            : step.status === "rejected"
                            ? "text-reject"
                            : stageState === "active"
                            ? "text-accent"
                            : "text-muted"
                        }`}
                      >
                        {step.status === "pending"
                          ? stageState === "upcoming"
                            ? "Upcoming"
                            : step.assignment_mode === "pooled" && !step.assigned_to
                            ? "Unclaimed"
                            : "Pending"
                          : step.status}
                      </span>
                    </div>
                    {step.comments && <p className="text-xs text-muted mt-1">"{step.comments}"</p>}
                    {isMine && myActionKind && (
                      <ActionPanel
                        step={step}
                        kind={myActionKind}
                        onApprove={onApprove}
                        onReject={onReject}
                        onClaim={onClaim}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
