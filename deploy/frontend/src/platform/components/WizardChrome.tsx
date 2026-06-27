import { Link } from "react-router-dom";
import { usePlatformAuth } from "../auth/PlatformAuthContext";

const STEPS = [
  "Basics",
  "Roles",
  "Users",
  "Workflows",
  "Approval chains",
  "Launch",
];

export function PlatformHeader() {
  const { logout } = usePlatformAuth();
  return (
    <div className="flex items-center justify-between mb-6">
      <Link to="/admin" className="font-display font-semibold text-sm text-muted hover:text-ink">
        ← All tenants
      </Link>
      <button onClick={logout} className="text-xs text-muted hover:text-ink">
        Log out
      </button>
    </div>
  );
}

export function WizardStepper({
  currentStep,
  tenantId,
}: {
  currentStep: number;
  tenantId: string;
}) {
  return (
    <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const done = stepNum < currentStep;
        const active = stepNum === currentStep;
        return (
          <div key={stepNum} className="flex items-center gap-1 flex-shrink-0">
            {i > 0 && <div className="w-5 h-px bg-line flex-shrink-0" />}
            <Link
              to={`/admin/tenants/${tenantId}/onboarding/${stepNum}`}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                active
                  ? "bg-ink text-white"
                  : done
                  ? "text-approve"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${
                  active ? "bg-white/20" : done ? "bg-approve-soft" : "bg-line"
                }`}
              >
                {done ? "✓" : stepNum}
              </span>
              {label}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
