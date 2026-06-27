import { WorkflowField } from "../api/client";

interface Props {
  fields: WorkflowField[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
}

/**
 * type -> <input> mapping. text/number/date are the only types anything
 * in the seeded data actually uses; anything unrecognized falls back to
 * a plain text input rather than failing, since the full set of field
 * types a workflow can declare was never formally enumerated (see the
 * end-user portal frontend map's open questions).
 */
function inputTypeFor(fieldType: string): string {
  if (fieldType === "number" || fieldType === "date") return fieldType;
  return "text";
}

export function DynamicForm({ fields, values, onChange }: Props) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 space-y-3.5">
      {fields.map((field) => (
        <div key={field.id}>
          <label className="block text-xs text-muted mb-1" htmlFor={field.id}>
            {field.label}
            {field.required && <span className="text-reject ml-0.5">*</span>}
          </label>
          <input
            id={field.id}
            type={inputTypeFor(field.type)}
            value={values[field.id] ?? ""}
            onChange={(e) => onChange(field.id, e.target.value)}
            className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          />
        </div>
      ))}
    </div>
  );
}
