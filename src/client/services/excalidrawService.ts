import {
    convertToExcalidrawElements,
    newElementWith,
    restoreElements,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { ElementUpdate } from "@excalidraw/excalidraw/element/mutateElement";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { normalizeArrowSkeletons } from "./normalizeArrowSkeletons";

function downloadJSON(data: unknown, filename = "result.json") {
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

export class ExcaliDrawService {
    constructor(
        private apiRef: React.RefObject<ExcalidrawImperativeAPI | null>,
    ) {}

    private get api() {
        if (!this.apiRef.current) throw new Error("apiRef is not initialized");
        return this.apiRef.current;
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

    modifyElements(
        modifiedElementsSkeletons: ({
            id: string;
            label?: { text: string };
        } & Partial<ExcalidrawElementSkeleton>)[],
    ) {
        const elements = this.api.getSceneElements();
        const updateById = new Map(
            modifiedElementsSkeletons.map((u) => [u.id, u]),
        );

        const merged = elements.map((el) => {
            const update = updateById.get(el.id);
            if (update) {
                const { id, label, ...changes } = update;
                return newElementWith(el, changes as ElementUpdate<typeof el>);
            }
            return el;
        });

        this.api.updateScene({ elements: merged });
    }

    deleteElements(elementsToDelete: { id: string }[]) {
        const elements = this.api.getSceneElements();
        const toDelete = new Set(elementsToDelete.map(({ id }) => id));

        for (const el of elements) {
            if (
                el.type === "text" &&
                el.containerId &&
                toDelete.has(el.containerId)
            ) {
                toDelete.add(el.id);
            }
        }

        const updated = elements.map((el) => {
            if (toDelete.has(el.id)) {
                return newElementWith(el, { isDeleted: true });
            }
            if (el.type === "arrow") {
                const changes = {
                    ...(el.startBinding &&
                    toDelete.has(el.startBinding.elementId)
                        ? { startBinding: null }
                        : {}),
                    ...(el.endBinding && toDelete.has(el.endBinding.elementId)
                        ? { endBinding: null }
                        : {}),
                };
                return Object.keys(changes).length
                    ? newElementWith(el, changes)
                    : el;
            }
            return el;
        });

        this.api.updateScene({ elements: updated });
        return { deletedIds: [...toDelete] };
    }
}
