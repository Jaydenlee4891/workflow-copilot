import { useParams } from "react-router-dom";
import { PlatformHeader, WizardStepper } from "../components/WizardChrome";
import { StepBasics } from "./steps/StepBasics";
import { StepRoles } from "./steps/StepRoles";
import { StepUsers } from "./steps/StepUsers";
import { StepWorkflows } from "./steps/StepWorkflows";
import { StepChains } from "./steps/StepChains";
import { StepLaunch } from "./steps/StepLaunch";

export function OnboardingWizardPage() {
  const { tenantId = "new", step = "1" } = useParams<{ tenantId: string; step: string }>();
  const stepNum = parseInt(step);

  const stepComponent =
    stepNum === 1 ? <StepBasics tenantId={tenantId} /> :
    stepNum === 2 ? <StepRoles tenantId={tenantId} /> :
    stepNum === 3 ? <StepUsers tenantId={tenantId} /> :
    stepNum === 4 ? <StepWorkflows tenantId={tenantId} /> :
    stepNum === 5 ? <StepChains tenantId={tenantId} /> :
    stepNum === 6 ? <StepLaunch tenantId={tenantId} /> :
    <p className="text-sm text-muted">Unknown step.</p>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <PlatformHeader />
      {tenantId !== "new" && <WizardStepper currentStep={stepNum} tenantId={tenantId} />}
      {stepComponent}
    </div>
  );
}
