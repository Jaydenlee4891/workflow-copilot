const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  in_review: "bg-blue-50 text-blue-700",
  approved: "bg-approve-soft text-approve",
  rejected: "bg-reject-soft text-reject",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${style}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export function RequestListItem({
  title,
  subtitle,
  status,
  to,
}: {
  title: string;
  subtitle: string;
  status: string;
  to: string;
}) {
  return (
    <a
      href={to}
      className="block rounded-md border border-line bg-white px-3 py-2.5 hover:border-accent transition-colors"
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-sm font-medium">{title}</span>
        <StatusBadge status={status} />
      </div>
      <p className="text-xs text-muted">{subtitle}</p>
    </a>
  );
}
