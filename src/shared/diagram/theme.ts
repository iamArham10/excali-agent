import type { ColorName } from "../schemas/diagram-schema";

export type ShapeType = "rectangle" | "ellipse" | "diamond";

export type Palette = { stroke: string; fill: string };

export const PALETTE: Record<ColorName, Palette> = {
    blue: { stroke: "#1971c2", fill: "#d0ebff" },
    green: { stroke: "#2f9e44", fill: "#d3f9d8" },
    red: { stroke: "#e03131", fill: "#ffe3e3" },
    orange: { stroke: "#e8590c", fill: "#ffe8cc" },
    yellow: { stroke: "#f08c00", fill: "#fff3bf" },
    purple: { stroke: "#6741d9", fill: "#e5dbff" },
    teal: { stroke: "#0c8599", fill: "#c5f6fa" },
    gray: { stroke: "#495057", fill: "#f1f3f5" },
};

export type NodeStyle = {
    shape: ShapeType;
    color: ColorName;
    strokeStyle?: "solid" | "dashed";
    strokeWidth?: number;
};

const NODE_STYLES: Record<string, NodeStyle> = {
    // architecture
    service: { shape: "rectangle", color: "blue" },
    database: { shape: "rectangle", color: "green", strokeWidth: 2 },
    cache: { shape: "rectangle", color: "orange" },
    queue: { shape: "rectangle", color: "yellow" },
    storage: { shape: "rectangle", color: "teal" },
    gateway: { shape: "rectangle", color: "purple", strokeWidth: 2 },
    client: { shape: "rectangle", color: "gray" },
    user: { shape: "ellipse", color: "purple" },
    external: { shape: "rectangle", color: "gray", strokeStyle: "dashed" },
    // flowchart
    start: { shape: "ellipse", color: "green" },
    end: { shape: "ellipse", color: "red" },
    process: { shape: "rectangle", color: "blue" },
    decision: { shape: "diamond", color: "yellow" },
    io: { shape: "rectangle", color: "purple" },
    subprocess: { shape: "rectangle", color: "teal", strokeWidth: 2 },
    // sequence
    actor: { shape: "rectangle", color: "purple" },
    // er
    entity: { shape: "rectangle", color: "green", strokeWidth: 2 },
    "weak-entity": { shape: "rectangle", color: "green", strokeStyle: "dashed", strokeWidth: 2 },
    // class
    class: { shape: "rectangle", color: "blue" },
    abstract: { shape: "rectangle", color: "blue", strokeStyle: "dashed" },
    interface: { shape: "rectangle", color: "teal", strokeStyle: "dashed" },
    enum: { shape: "rectangle", color: "purple" },
};

export function nodeStyle(kind: string | undefined, fallback: string): NodeStyle {
    return NODE_STYLES[kind ?? fallback] ?? NODE_STYLES[fallback];
}

export const FONT_FAMILY_CLEAN = 2; // Helvetica
export const NODE_FONT_SIZE = 16;
export const EDGE_FONT_SIZE = 14;
export const GROUP_FONT_SIZE = 16;
export const TITLE_FONT_SIZE = 28;

export const INK = "#1e1e1e";
export const EDGE_COLOR = "#495057";
export const GROUP_STROKE = "#868e96";
