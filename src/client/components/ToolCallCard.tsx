import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icons";
import {
    getDiagramSummary,
    getSearchSources,
    getToolPresentation,
    parseToolReport,
} from "./ToolPresentation";

export type ToolStatus =
    | "streaming"
    | "running"
    | "done"
    | "warning"
    | "rejected"
    | "error"
    | "denied";

type ToolCallCardProps = {
    toolName: string;
    status: ToolStatus;
    input?: unknown;
    output?: unknown;
    errorText?: string;
};

const DIAGRAM_ICONS: Record<string, IconName> = {
    architecture: "architecture",
    flowchart: "flowchart",
    sequence: "sequence",
};

const MAX_CHIPS = 10;

export function deriveToolStatus(
    state: string,
    output: unknown,
    decision: boolean | undefined,
): ToolStatus {
    if (decision === false || state === "output-denied") return "denied";
    if (state === "output-error") return "error";
    if (state === "output-available") {
        const report = parseToolReport(output);
        if (report && !report.ok)
            return report.errors.length ? "rejected" : "error";
        if (report?.warnings.length) return "warning";
        if (output && typeof output === "object" && "error" in output)
            return "error";
        return "done";
    }
    if (state === "input-streaming") return "streaming";
    return "running";
}

function completedTitle(toolName: string, input: unknown, fallback: string) {
    const diagram = getDiagramSummary(input);
    const kind = diagram ? `${diagram.type} diagram` : "diagram";
    switch (toolName) {
        case "createDiagram":
            return `Created ${kind}`;
        case "updateDiagram":
            return `Updated ${kind}`;
        case "deleteDiagram":
            return "Deleted diagram";
        case "clearCanvas":
            return "Cleared canvas";
        case "getCanvasState":
            return "Read canvas";
        case "webSearchTool":
            return "Searched the web";
        case "knowledgeSearchTool":
            return "Searched knowledge base";
        default:
            return fallback;
    }
}

export default function ToolCallCard({
    toolName,
    status,
    input,
    output,
    errorText,
}: ToolCallCardProps) {
    const presentation = getToolPresentation(toolName);
    const diagram = getDiagramSummary(input);
    const report =
        status === "streaming" || status === "running"
            ? null
            : parseToolReport(output);
    const sources = status === "done" ? getSearchSources(output) : null;
    const query =
        input &&
        typeof input === "object" &&
        typeof (input as { query?: unknown }).query === "string"
            ? (input as { query: string }).query
            : null;
    const deletedId =
        input &&
        typeof input === "object" &&
        typeof (input as { diagramId?: unknown }).diagramId === "string"
            ? (input as { diagramId: string }).diagramId
            : null;

    const [open, setOpen] = useState(
        status === "rejected" || status === "error",
    );
    useEffect(() => {
        if (status === "rejected" || status === "error") setOpen(true);
    }, [status]);

    const title = (() => {
        switch (status) {
            case "streaming":
                return diagram?.type
                    ? `Planning ${diagram.type} diagram`
                    : `${presentation.runningText}`;
            case "running":
                return presentation.runningText;
            case "rejected":
                return `${presentation.title} · needs a fix`;
            case "error":
                return `${presentation.title} failed`;
            case "denied":
                return `${presentation.title} · skipped`;
            default:
                return completedTitle(toolName, input, presentation.title);
        }
    })();

    const meta = [
        diagram?.title ?? diagram?.diagramId,
        ...(diagram?.counts ?? []),
        query ? `“${query}”` : null,
        !diagram && deletedId ? deletedId : null,
        sources
            ? `${sources.length} result${sources.length === 1 ? "" : "s"}`
            : null,
    ].filter(Boolean) as string[];

    const issues = [
        ...(report?.errors ?? []).map((text) => ({
            kind: "error" as const,
            text,
        })),
        ...(report?.warnings ?? []).map((text) => ({
            kind: "warning" as const,
            text,
        })),
        ...(status === "error" && !report?.errors.length
            ? [
                  {
                      kind: "error" as const,
                      text:
                          errorText ??
                          report?.message ??
                          "The tool did not complete.",
                  },
              ]
            : []),
    ];
    const chips = diagram?.labels ?? [];
    const hasDetails =
        status !== "streaming" &&
        (chips.length > 0 || issues.length > 0 || (sources?.length ?? 0) > 0);

    const icon: IconName = diagram
        ? (DIAGRAM_ICONS[diagram.type] ?? presentation.icon)
        : presentation.icon;
    const busy = status === "streaming" || status === "running";

    return (
        <div
            className={`tool-card tool-card--${status}`}
            data-open={open && hasDetails}
        >
            <button
                type="button"
                className="tool-card__header"
                onClick={() => hasDetails && setOpen((value) => !value)}
                aria-expanded={hasDetails ? open : undefined}
                disabled={!hasDetails}
            >
                <span className="tool-card__icon">
                    <Icon name={icon} size={15} />
                </span>
                <span className="tool-card__text">
                    <span
                        className={`tool-card__title ${busy ? "shimmer" : ""}`}
                    >
                        {title}
                    </span>
                    {meta.length > 0 && (
                        <span className="tool-card__meta">
                            {meta.map((item, index) => (
                                <span key={index}>{item}</span>
                            ))}
                        </span>
                    )}
                </span>
                <span className="tool-card__status" aria-label={status}>
                    {busy ? (
                        <span className="spinner" />
                    ) : status === "done" ? (
                        <Icon name="check" size={14} />
                    ) : status === "denied" ? (
                        <Icon name="x" size={14} />
                    ) : (
                        <Icon name="alert" size={14} />
                    )}
                </span>
                {hasDetails && (
                    <span className="tool-card__chevron">
                        <Icon name="chevron" size={14} />
                    </span>
                )}
            </button>

            {hasDetails && open && (
                <div className="tool-card__body">
                    {issues.length > 0 && (
                        <ul className="tool-issues">
                            {issues.map((issue, index) => (
                                <li
                                    key={index}
                                    className={`tool-issue tool-issue--${issue.kind}`}
                                >
                                    <Icon name="alert" size={12} />
                                    <span>{issue.text}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {status === "rejected" && (
                        <p className="tool-card__hint">
                            The assistant will correct the spec and retry.
                        </p>
                    )}
                    {chips.length > 0 && (
                        <div className="tool-chips">
                            {chips.slice(0, MAX_CHIPS).map((label, index) => (
                                <span key={index} className="tool-chip">
                                    {label}
                                </span>
                            ))}
                            {chips.length > MAX_CHIPS && (
                                <span className="tool-chip tool-chip--more">
                                    +{chips.length - MAX_CHIPS} more
                                </span>
                            )}
                        </div>
                    )}
                    {sources && sources.length > 0 && (
                        <ul className="tool-sources">
                            {sources.map((source, index) => (
                                <li key={index}>
                                    {source.url ? (
                                        <a
                                            href={source.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <span>{source.title}</span>
                                            <Icon name="external" size={12} />
                                        </a>
                                    ) : (
                                        <span>{source.title}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
