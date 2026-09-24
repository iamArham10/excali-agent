import type { SVGProps } from "react";

export type IconName =
    | "architecture"
    | "flowchart"
    | "sequence"
    | "diagram"
    | "update"
    | "trash"
    | "eraser"
    | "eye"
    | "globe"
    | "book"
    | "check"
    | "x"
    | "alert"
    | "chevron"
    | "arrow-up"
    | "stop"
    | "sun"
    | "moon"
    | "sidebar"
    | "plus"
    | "sparkle"
    | "brain"
    | "retry"
    | "external";

// 24x24 stroke icons (lucide-style) so everything shares one visual weight.
const PATHS: Record<IconName, string[]> = {
    architecture: [
        "M3 4h7v6H3z",
        "M14 4h7v6h-7z",
        "M8.5 14h7v6h-7z",
        "M6.5 10v2h11v-2",
        "M12 12v2",
    ],
    flowchart: ["M4 3h8v5H4z", "m16 10 5 4-5 4-5-4z", "M8 8v6h3", "M16 18v3", "M8 14v4"],
    sequence: ["M6 3v18", "M18 3v18", "M6 8h9", "m13 6 2 2-2 2", "M18 15H9", "m11 13-2 2 2 2"],
    diagram: ["M4 4h6v6H4z", "M14 14h6v6h-6z", "M10 7h4a3 3 0 0 1 3 3v4"],
    update: [
        "M21 12a9 9 0 0 1-15.5 6.2L3 16",
        "M3 21v-5h5",
        "M3 12a9 9 0 0 1 15.5-6.2L21 8",
        "M21 3v5h-5",
    ],
    trash: ["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6", "M10 11v6", "M14 11v6"],
    eraser: ["m7 21-4-4L14 6l7 7-8 8", "M22 21H7", "m5 11 8 8"],
    eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"],
    globe: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M3 12h18", "M12 3a14 14 0 0 1 0 18", "M12 3a14 14 0 0 0 0 18"],
    book: ["M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z", "M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"],
    check: ["m5 12.5 4.5 4.5L19 7.5"],
    x: ["M6 6l12 12", "M18 6 6 18"],
    alert: ["M12 3 2 20h20L12 3Z", "M12 10v4", "M12 17.5v.01"],
    chevron: ["m9 6 6 6-6 6"],
    "arrow-up": ["M12 19V5", "m5 12 7-7 7 7"],
    stop: ["M7 7h10v10H7z"],
    sun: [
        "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
        "M12 2v2",
        "M12 20v2",
        "m4.9 4.9 1.4 1.4",
        "m17.7 17.7 1.4 1.4",
        "M2 12h2",
        "M20 12h2",
        "m4.9 19.1 1.4-1.4",
        "m17.7 6.3 1.4-1.4",
    ],
    moon: ["M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"],
    sidebar: ["M3 4h18v16H3z", "M15 4v16"],
    plus: ["M12 5v14", "M5 12h14"],
    sparkle: ["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z", "M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"],
    brain: [
        "M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a2 2 0 0 0-3-1Z",
        "M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1",
    ],
    retry: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5"],
    external: ["M14 4h6v6", "M20 4 10 14", "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"],
};

export function Icon({
    name,
    size = 16,
    ...props
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            {PATHS[name].map((d) => (
                <path key={d} d={d} />
            ))}
        </svg>
    );
}
