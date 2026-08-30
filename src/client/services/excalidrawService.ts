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

export class ExcaliDrawService {
    constructor(
        private apiRef: React.RefObject<ExcalidrawImperativeAPI | null>,
    ) { }

    private get api() {
        if (!this.apiRef.current) throw new Error("apiRef is not initialized");
        return this.apiRef.current;
    }

    getCanvasState() {
        return this.api.getSceneElements() as ExcalidrawElement[];
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
            Object.entries(obj).filter(([, value]) => value !== undefined)
        ) as T;
    }

    modifyElements(
        modifiedElementsSkeletons: ({
            id: string;
            label?: { text: string };
        } & Partial<ExcalidrawElementSkeleton>)[],
    ) {
        modifiedElementsSkeletons = this.stripUndefined(modifiedElementsSkeletons)

        const elements = this.api.getSceneElements();
        const updateById = new Map(
            modifiedElementsSkeletons.map((u) => [u.id, u]),
        );

        const labelTextByContainerId = new Map<string, string>();
        for (const update of modifiedElementsSkeletons) {
            if (update.label) {
                labelTextByContainerId.set(update.id, update.label.text);
            }
        }

        const merged = elements.map((el) => {
            const update = updateById.get(el.id);

            if (update) {
                const { id, label, ...changes } = update;
                return newElementWith(
                    el,
                    changes as ElementUpdate<typeof el>,
                );
            }

            if (el.type === "text" && el.containerId) {
                const containerLabelText = labelTextByContainerId.get(
                    el.containerId,
                );

                if (containerLabelText !== undefined) {
                    return newElementWith(el, {
                        text: containerLabelText,
                        originalText: containerLabelText,
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
