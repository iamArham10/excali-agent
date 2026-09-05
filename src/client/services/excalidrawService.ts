import {
    convertToExcalidrawElements,
    newElementWith,
    restoreElements,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { ElementUpdate } from "@excalidraw/excalidraw/element/mutateElement";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { normalizeArrowSkeletons } from "./normalizeArrowSkeletons";
import { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

type LabelUpdate = {
    text?: string;
    fontSize?: number;
    fontFamily?: number;
    textAlign?: "left" | "center" | "right";
    verticalAlign?: "top" | "middle" | "bottom";
};

export class ExcaliDrawService {
    constructor(
        private apiRef: React.RefObject<ExcalidrawImperativeAPI | null>,
    ) {}

    private get api() {
        if (!this.apiRef.current) throw new Error("apiRef is not initialized");
        return this.apiRef.current;
    }

    getCanvasState() {
        return this.api.getSceneElements() as ExcalidrawElement[];
    }

    clearCanvas() {
        try {
            this.api.resetScene();
            return true;
        } catch {
            return false;
        }
    }

    createElements(skeletons: ExcalidrawElementSkeleton[]) {
        const normalizedSkeletons = normalizeArrowSkeletons(
            skeletons,
            this.api.getSceneElements(),
        );
        const newElements = restoreElements(
            convertToExcalidrawElements(normalizedSkeletons, {
                regenerateIds: false,
            }),
            null,
        );

        const elements = [...this.api.getSceneElements(), ...newElements];
        this.api.updateScene({ elements });
        this.api.scrollToContent(elements, { fitToContent: true });
    }

    private stripUndefined<T extends object>(obj: T): T {
        return Object.fromEntries(
            Object.entries(obj).filter(([, value]) => value !== undefined),
        ) as T;
    }

    modifyElements(
        modifiedElementsSkeletons: ({
            id: string;
            label?: LabelUpdate;
        } & Partial<ExcalidrawElementSkeleton>)[],
    ) {
        modifiedElementsSkeletons = this.stripUndefined(
            modifiedElementsSkeletons,
        );

        const elements = this.api.getSceneElements();
        const updateById = new Map(
            modifiedElementsSkeletons.map((u) => [u.id, u]),
        );

        const labelUpdateByContainerId = new Map<string, LabelUpdate>();
        for (const update of modifiedElementsSkeletons) {
            if (update.label) {
                labelUpdateByContainerId.set(update.id, update.label);
            }
        }

        const merged = elements.map((el) => {
            const update = updateById.get(el.id);

            if (update) {
                const { id, label, ...changes } = update;
                return newElementWith(el, changes as ElementUpdate<typeof el>);
            }

            if (el.type === "text" && el.containerId) {
                const labelUpdate = labelUpdateByContainerId.get(
                    el.containerId,
                );

                if (labelUpdate !== undefined) {
                    const {
                        text,
                        fontSize,
                        fontFamily,
                        textAlign,
                        verticalAlign,
                    } = labelUpdate;
                    return newElementWith(el, {
                        ...(text === undefined
                            ? {}
                            : { text, originalText: text }),
                        ...(fontSize === undefined ? {} : { fontSize }),
                        ...(fontFamily === undefined ? {} : { fontFamily }),
                        ...(textAlign === undefined ? {} : { textAlign }),
                        ...(verticalAlign === undefined
                            ? {}
                            : { verticalAlign }),
                    });
                }
            }

            return el;
        });

        this.api.updateScene({ elements: merged });
    }

    deleteElements(elementsToDelete: { id: string }[]) {
        const elements = this.api.getSceneElements();

        const dependents = new Map<string, string[]>();
        for (const el of elements) {
            const referencedIds = [
                ...(el.type === "text" && el.containerId
                    ? [el.containerId]
                    : []),
                ...(el.type === "arrow"
                    ? [
                          el.startBinding?.elementId,
                          el.endBinding?.elementId,
                      ].filter((id): id is string => id != null)
                    : []),
            ];
            for (const referencedId of referencedIds) {
                const deps = dependents.get(referencedId);
                if (deps) {
                    deps.push(el.id);
                } else {
                    dependents.set(referencedId, [el.id]);
                }
            }
        }

        const toDelete = new Set(elementsToDelete.map(({ id }) => id));
        const queue = [...toDelete];
        while (queue.length) {
            const id = queue.pop();
            for (const dependentId of dependents.get(id!) ?? []) {
                if (!toDelete.has(dependentId)) {
                    toDelete.add(dependentId);
                    queue.push(dependentId);
                }
            }
        }

        const updated = elements.map((el) =>
            toDelete.has(el.id) ? newElementWith(el, { isDeleted: true }) : el,
        );

        this.api.updateScene({ elements: updated });
        return { deletedIds: [...toDelete] };
    }
}
