export interface Condition {
  field: string;
  operator: ">" | ">=" | "<" | "<=" | "==" | "!=";
  value: unknown;
}

/**
 * Single-clause only, deliberately — no AND/OR. Real approval routing is
 * about making an already-known, fixed hierarchy visible and automatic,
 * not dynamic compound business rules (spec Section 10). If that
 * assumption ever turns out wrong for a real client, this is the one
 * place that needs to change.
 */
export function evaluateCondition(
  condition: Condition | null,
  fieldValues: Record<string, unknown>
): boolean {
  if (!condition) return true;
  const actual = fieldValues[condition.field] as any;
  const expected = condition.value as any;
  switch (condition.operator) {
    case ">": return actual > expected;
    case ">=": return actual >= expected;
    case "<": return actual < expected;
    case "<=": return actual <= expected;
    case "==": return actual === expected;
    case "!=": return actual !== expected;
    default:
      throw new Error(`Unsupported condition operator: ${condition.operator}`);
  }
}
