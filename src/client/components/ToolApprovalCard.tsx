import { Icon } from "./Icons";
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
            className={`approval-card ${presentation.destructive ? "approval-card--danger" : ""}`}
            aria-label={`${presentation.title} approval`}
        >
            <div className="approval-card__heading">
                <span className="approval-card__icon">
                    <Icon name={presentation.icon} size={16} />
                </span>
                <div className="approval-card__copy">
                    <span className="approval-card__eyebrow">
                        Approval needed
                    </span>
                    <h3>{presentation.title}</h3>
                </div>
            </div>
            <p>{presentation.description}</p>
            {detail && <div className="approval-card__detail">{detail}</div>}
            <div className="approval-card__actions">
                <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={isSubmitting}
                    onClick={onDeny}
                >
                    Skip
                </button>
                <button
                    type="button"
                    className={`btn ${presentation.destructive ? "btn--danger" : "btn--primary"}`}
                    disabled={isSubmitting}
                    onClick={onApprove}
                >
                    {isSubmitting
                        ? "Submitting…"
                        : presentation.destructive
                          ? "Yes, continue"
                          : "Allow"}
                </button>
            </div>
        </section>
    );
}
