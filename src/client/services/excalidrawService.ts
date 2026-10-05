import {
    CaptureUpdateAction,
    convertToExcalidrawElements,
    mutateElement,
    newElementWith,
    restoreElements,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type {
    ExcalidrawArrowElement,
    ExcalidrawElement,
} from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import type { DiagramSpec } from "../../shared/schemas/diagram-schema";
import {
    layoutGraph,
    layoutSequence,
    type Box,
    type Point,
} from "../../shared/diagram/layout";
import { sizeForLabel } from "../../shared/diagram/text";
import { NODE_FONT_SIZE, nodeStyle } from "../../shared/diagram/theme";
import {
    resolveEdges,
    validateDiagramSpec,
} from "../../shared/diagram/validate";
import {
    TITLE_OFFSET,
    getMeta,
    readDiagrams,
    renderGraph,
    renderSequence,
    type CanvasDiagram,
    type PreservedStyle,
    type RenderResult,
    type ReusedArrow,
} from "./diagramRenderer";

export type ToolReport = {
    ok: boolean;
    message: string;
    errors?: string[];
    warnings?: string[];
};

const DIAGRAM_GAP = 200;

const USER_STYLE_KEYS = [
    "strokeColor",
    "backgroundColor",
    "fillStyle",
    "strokeWidth",
    "strokeStyle",
    "roughness",
    "opacity",
    "roundness",
] as const;

const sameBox = (a: Box | undefined, b: Box | undefined) =>
    !!a &&
    !!b &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height;

export class ExcaliDrawService {
    constructor(
        private apiRef: React.RefObject<ExcalidrawImperativeAPI | null>,
    ) {}

    private get api() {
        if (!this.apiRef.current) throw new Error("apiRef is not initialized");
        return this.apiRef.current;
    }

    private sceneElements() {
        return this.api.getSceneElements() as readonly ExcalidrawElement[];
    }

    getCanvasState(): string {
        const { diagrams, otherElements } = readDiagrams(this.sceneElements());
        if (diagrams.size === 0 && otherElements === 0)
            return "canvas is empty";
        return JSON.stringify({
            diagrams: [...diagrams.values()].map((diagram) => diagram.spec),
            ...(otherElements
                ? {
                      otherElements: `${otherElements} hand-drawn element(s) not managed by the agent`,
                  }
                : {}),
        });
    }

    clearCanvas() {
        this.api.resetScene();
    }

    async createDiagram(spec: DiagramSpec): Promise<ToolReport> {
        const { errors, warnings } = validateDiagramSpec(spec);
        if (errors.length) return this.rejected(errors);

        const { diagrams } = readDiagrams(this.sceneElements());
        if (diagrams.has(spec.diagramId)) {
            return this.rejected([
                `diagram '${spec.diagramId}' already exists; use updateDiagram to change it or pick a new diagramId`,
            ]);
        }

        const origin = this.freeOrigin(spec);
        const rendered = await this.render(spec, { origin });
        warnings.push(...rendered.warnings);
        const created = this.commit(rendered.result, []);
        this.api.scrollToContent(created, {
            fitToContent: true,
            animate: true,
        });

        return {
            ok: true,
            message: `created ${spec.type} diagram '${spec.diagramId}' (${this.describe(spec)})`,
            ...(warnings.length ? { warnings } : {}),
        };
    }

    async updateDiagram(
        spec: DiagramSpec,
        relayout = false,
    ): Promise<ToolReport> {
        const { errors, warnings } = validateDiagramSpec(spec);
        if (errors.length) return this.rejected(errors);

        const { diagrams } = readDiagrams(this.sceneElements());
        const existing = diagrams.get(spec.diagramId);
        if (!existing) {
            const known = [...diagrams.keys()];
            return this.rejected([
                `diagram '${spec.diagramId}' does not exist. ${known.length ? `Existing diagrams: ${known.join(", ")}` : "The canvas has no diagrams"}; use createDiagram for new diagrams`,
            ]);
        }

        const origin = existing.contentBounds
            ? { x: existing.contentBounds.x, y: existing.contentBounds.y }
            : this.freeOrigin(spec);
        const keepPositions =
            !relayout &&
            spec.type !== "sequence" &&
            existing.spec.type === spec.type;

        const rendered = await this.render(spec, {
            origin,
            existing: keepPositions ? existing : undefined,
        });
        warnings.push(...rendered.warnings);
        this.commit(rendered.result, existing.elements);

        return {
            ok: true,
            message: `updated ${spec.type} diagram '${spec.diagramId}' (${this.describe(spec)})${keepPositions ? "; existing node positions were kept" : "; layout recomputed"}`,
            ...(warnings.length ? { warnings } : {}),
        };
    }

    deleteDiagram(diagramId: string): ToolReport {
        const { diagrams } = readDiagrams(this.sceneElements());
        const existing = diagrams.get(diagramId);
        if (!existing) {
            return this.rejected([
                `diagram '${diagramId}' does not exist. Existing diagrams: ${[...diagrams.keys()].join(", ") || "none"}`,
            ]);
        }
        const doomed = this.withBoundText(existing.elements);
        this.api.updateScene({
            elements: this.api
                .getSceneElementsIncludingDeleted()
                .map((element) =>
                    doomed.has(element.id)
                        ? newElementWith(element, { isDeleted: true })
                        : element,
                ),
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
        return { ok: true, message: `deleted diagram '${diagramId}'` };
    }

    // ------------------------------------------------------------------

    private rejected(errors: string[]): ToolReport {
        return {
            ok: false,
            message:
                "nothing was drawn; fix the errors and call the tool again",
            errors,
        };
    }

    private describe(spec: DiagramSpec) {
        if (spec.type === "sequence") {
            return `${spec.participants.length} participants, ${spec.messages.length} messages`;
        }
        const groups =
            spec.type === "architecture" ? (spec.groups?.length ?? 0) : 0;
        const nodeName =
            spec.type === "er" ? "entities"
            : spec.type === "class" ? "classes"
            : "nodes";
        const edgeName =
            spec.type === "er" || spec.type === "class" ? "relationships" : "edges";
        return `${spec.nodes.length} ${nodeName}, ${spec.edges?.length ?? 0} ${edgeName}${groups ? `, ${groups} groups` : ""}`;
    }

    /** Top-left position to the right of everything already on the canvas. */
    private freeOrigin(spec: DiagramSpec) {
        const others = this.sceneElements().filter(
            (element) =>
                !element.isDeleted &&
                getMeta(element)?.diagramId !== spec.diagramId,
        );
        const titleSpace = spec.title ? TITLE_OFFSET : 0;
        if (others.length === 0) return { x: 100, y: 100 + titleSpace };
        const maxX = Math.max(
            ...others.map((element) => element.x + element.width),
        );
        const minY = Math.min(...others.map((element) => element.y));
        return {
            x: Math.round(maxX + DIAGRAM_GAP),
            y: Math.round(minY + titleSpace),
        };
    }

    private async render(
        spec: DiagramSpec,
        options: { origin: { x: number; y: number }; existing?: CanvasDiagram },
    ): Promise<{ result: RenderResult; warnings: string[] }> {
        if (spec.type === "sequence") {
            return {
                result: renderSequence(
                    spec,
                    layoutSequence(spec, options.origin),
                ),
                warnings: [],
            };
        }

        const existing = options.existing;
        const pinned = new Map<string, Box>();
        const preservedStyles = new Map<string, PreservedStyle>();
        const reusedArrows = new Map<string, ReusedArrow>();

        if (existing && existing.spec.type !== "sequence") {
            const fallbackKind =
                spec.type === "architecture" ? "service"
                : spec.type === "er" ? "entity"
                : spec.type === "class" ? "class"
                : "process";
            const oldNodes = new Map(
                existing.spec.nodes.map((node) => [node.id, node]),
            );

            for (const node of spec.nodes) {
                const old = oldNodes.get(node.id);
                const box = existing.boxes.get(node.id);
                if (!old || !box) continue;
                const shapeChanged =
                    nodeStyle(old.kind, fallbackKind).shape !==
                    nodeStyle(node.kind, fallbackKind).shape;
                if (old.label === node.label && !shapeChanged) {
                    pinned.set(node.id, box);
                } else {
                    // keep the position, re-size for the new label/shape
                    const size = sizeForLabel(
                        node.label,
                        nodeStyle(node.kind, fallbackKind).shape,
                        NODE_FONT_SIZE,
                    );
                    pinned.set(node.id, { x: box.x, y: box.y, ...size });
                }
                // keep manual styling unless the model changed kind or color
                const element = existing.byRoleKey.get(`node:${node.id}`);
                if (
                    element &&
                    old.kind === node.kind &&
                    old.color === node.color &&
                    !shapeChanged
                ) {
                    preservedStyles.set(
                        node.id,
                        pick(element, USER_STYLE_KEYS),
                    );
                }
            }

            const oldEdges = new Map(
                resolveEdges(existing.spec).map((edge) => [edge.id, edge]),
            );
            for (const edge of resolveEdges(spec)) {
                const old = oldEdges.get(edge.id);
                const element = existing.byRoleKey.get(`edge:${edge.id}`) as
                    ExcalidrawArrowElement | undefined;
                if (
                    !old ||
                    !element ||
                    old.from !== edge.from ||
                    old.to !== edge.to
                )
                    continue;
                const endpointsUnchanged = [edge.from, edge.to].every((id) =>
                    sameBox(existing.boxes.get(id), pinned.get(id)),
                );
                if (endpointsUnchanged && element.elbowed) {
                    reusedArrows.set(edge.id, {
                        x: element.x,
                        y: element.y,
                        points: element.points.map(([px, py]): Point => [
                            px,
                            py,
                        ]),
                        fixedSegments:
                            "fixedSegments" in element
                                ? element.fixedSegments
                                : null,
                    });
                }
                if (old.style === edge.style && old.arrow === edge.arrow) {
                    preservedStyles.set(
                        `edge:${edge.id}`,
                        pick(element, [
                            "strokeColor",
                            "strokeWidth",
                            "opacity",
                        ] as const),
                    );
                }
            }
        }

        const layout = await layoutGraph(spec, {
            origin: options.origin,
            pinned,
        });
        return {
            result: renderGraph(spec, layout, {
                reusedArrows,
                preservedStyles,
            }),
            warnings: layout.warnings,
        };
    }

    /** Replace `previous` elements with the rendered diagram in one undoable step. */
    private commit(
        result: RenderResult,
        previous: readonly ExcalidrawElement[],
    ) {
        const converted = convertToExcalidrawElements(
            result.skeletons as unknown as ExcalidrawElementSkeleton[],
            { regenerateIds: false },
        ).map((element) => {
            const exact = result.exactPoints.get(element.id);
            if (
                exact &&
                (element.type === "arrow" || element.type === "line")
            ) {
                // convertToExcalidrawElements nudges endpoints by 0.5px; restore the exact route
                const xs = exact.points.map(([x]) => x);
                const ys = exact.points.map(([, y]) => y);
                return newElementWith(element, {
                    x: exact.x,
                    y: exact.y,
                    points: exact.points as never,
                    width: Math.max(...xs) - Math.min(...xs),
                    height: Math.max(...ys) - Math.min(...ys),
                } as never);
            }
            const centerX = result.centerTextOn.get(element.id);
            if (centerX !== undefined) {
                return newElementWith(element, {
                    x: centerX - element.width / 2,
                } as never);
            }
            return element;
        });
        const doomed = this.withBoundText(previous);
        const scene = this.api.getSceneElementsIncludingDeleted();
        const oldById = new Map(scene.map((element) => [element.id, element]));

        // Re-created ids must out-version the elements they replace so the
        // undo history records a proper change instead of ignoring it.
        const created = restoreElements(converted, null).map((element) => {
            const old = oldById.get(element.id);
            return old
                ? ({
                      ...element,
                      version: old.version + 1,
                      versionNonce: Math.floor(Math.random() * 2 ** 31),
                  } as ExcalidrawElement)
                : element;
        });
        const createdIds = new Set(created.map((element) => element.id));

        const kept = scene.filter(
            (element) => !doomed.has(element.id) && !createdIds.has(element.id),
        );
        const removed = scene
            .filter(
                (element) =>
                    doomed.has(element.id) && !createdIds.has(element.id),
            )
            .map((element) => newElementWith(element, { isDeleted: true }));

        // The whole diagram goes on top, in render order (groups behind nodes behind arrows).
        this.api.updateScene({
            elements: [...kept, ...removed, ...created],
            captureUpdate: CaptureUpdateAction.EVENTUALLY,
        });

        // Let Excalidraw compute orthogonal routes for arrows without a precomputed path.
        const byId = new Map(
            this.sceneElements().map((element) => [element.id, element]),
        );
        for (const id of result.routeLater) {
            const arrow = byId.get(id) as ExcalidrawArrowElement | undefined;
            if (!arrow?.startBinding || !arrow.endBinding) continue;
            mutateElement(arrow, {
                startBinding: { ...arrow.startBinding },
                endBinding: { ...arrow.endBinding },
            });
        }

        this.api.updateScene({
            elements: [...this.api.getSceneElementsIncludingDeleted()],
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        return this.sceneElements().filter((element) =>
            createdIds.has(element.id),
        );
    }

    /** Ids of the given elements plus any text bound to them. */
    private withBoundText(elements: readonly ExcalidrawElement[]) {
        const ids = new Set(elements.map((element) => element.id));
        for (const element of this.sceneElements()) {
            if (
                element.type === "text" &&
                element.containerId &&
                ids.has(element.containerId)
            ) {
                ids.add(element.id);
            }
        }
        return ids;
    }
}

function pick<T extends object, K extends readonly (keyof T)[]>(
    source: T,
    keys: K,
) {
    return Object.fromEntries(keys.map((key) => [key, source[key]])) as Record<
        string,
        unknown
    >;
}
