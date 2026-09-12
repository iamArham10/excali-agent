import type { ToolPresentation } from "./ToolPresentation";

type ToolApprovalCardProps = {
    presentation: ToolPresentation;
    detail: string | null;
    isSubmitting: boolean;
    onDeny: () => void;
    onApprove: () => void;
};

export default function ToolApprovalCard({
    presentation,
    detail,
    isSubmitting,
    onDeny,
    onApprove,
}: ToolApprovalCardProps) {
    return (
        <section
            className={`approval-card ${presentation.destructive ? "approval-card-danger" : ""}`}
            aria-label={`${presentation.title} approval`}
        >
            <div className="approval-heading">
                <span className="tool-icon" aria-hidden="true">
                    {presentation.icon}
                </span>
                <div>
                    <span className="approval-eyebrow">Permission requested</span>
                    <h3>{presentation.title}</h3>
                </div>
            </div>
            <p>{presentation.description}</p>
            {detail && <div className="tool-detail">{detail}</div>}
            <div className="approval-actions">
                <button
                    type="button"
                    className="button-secondary"
                    disabled={isSubmitting}
                    onClick={onDeny}
                >
                    Deny
                </button>
                <button
                    type="button"
                    className={
                        presentation.destructive ? "button-danger" : "button-primary"
                    }
                    disabled={isSubmitting}
                    onClick={onApprove}
                >
                    {isSubmitting ? "Submitting…" : "Allow once"}
                </button>
            </div>
        </section>
    );
}
