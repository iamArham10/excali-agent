import {
    convertToExcalidrawElements,
    newElementWith,
    restoreElements,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ElementUpdate } from "@excalidraw/excalidraw/element/mutateElement";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
    ARROW_GAP,
    isArrowSkeleton,
    positionArrowSkeletons,
    type AgentElementSkeleton,
    type ArrowBindingSpec,
} from "./normalizeArrowSkeletons";

export class ExcaliDrawService {
    constructor(
        private apiRef: React.RefObject<ExcalidrawImperativeAPI | null>,
    ) {}

    private get api() {
        if (!this.apiRef.current) throw new Error("apiRef is not initialized");
        return this.apiRef.current;
    }

    createElements(skeletons: AgentElementSkeleton[]) {
        const existingElements = this.api.getSceneElements();
        const shapeSkeletons = skeletons.filter(
            (skeleton) => !isArrowSkeleton(skeleton),
        ) as ExcalidrawElementSkeleton[];
        const arrowSkeletons = skeletons.filter(isArrowSkeleton);

        // Convert shapes first so arrow geometry uses their actual dimensions,
        // including dimensions calculated by Excalidraw for bound labels.
        const newShapeElements = restoreElements(
            convertToExcalidrawElements(shapeSkeletons, {
                regenerateIds: false,
            }),
            null,
        );
        const targets = [...existingElements, ...newShapeElements].filter(
            (element) =>
                element.type === "rectangle" ||
                element.type === "ellipse" ||
                element.type === "diamond",
        );
        const positionedArrows = positionArrowSkeletons(
            arrowSkeletons,
            targets,
            existingElements,
        );
        const newArrowElements = restoreElements(
            convertToExcalidrawElements(
                positionedArrows.map(({ skeleton }) => skeleton),
                { regenerateIds: false },
            ),
            null,
        );

        const elements = this.applyArrowBindings(
            [...existingElements, ...newShapeElements, ...newArrowElements],
            positionedArrows.map(({ binding }) => binding),
        );
        this.api.updateScene({ elements });
        this.api.scrollToContent(elements, { fitToContent: true });
    }

    private applyArrowBindings(
        elements: readonly ExcalidrawElement[],
        bindings: readonly ArrowBindingSpec[],
    ) {
        const bindingByArrowId = new Map(
            bindings.map((binding) => [binding.arrowId, binding]),
        );
        const arrowsByTargetId = new Map<string, string[]>();

        for (const binding of bindings) {
            for (const targetId of [binding.startId, binding.endId]) {
                const arrowIds = arrowsByTargetId.get(targetId) ?? [];
                arrowIds.push(binding.arrowId);
                arrowsByTargetId.set(targetId, arrowIds);
            }
        }

        return elements.map((element) => {
            const binding = bindingByArrowId.get(element.id);
            if (element.type === "arrow" && binding) {
                return newElementWith(element, {
                    startBinding: {
                        elementId: binding.startId,
                        focus: binding.startFocus,
                        gap: ARROW_GAP,
                    },
                    endBinding: {
                        elementId: binding.endId,
                        focus: binding.endFocus,
                        gap: ARROW_GAP,
                    },
                });
            }

            const arrowIds = arrowsByTargetId.get(element.id);
            if (!arrowIds) return element;

            const boundElements = [...(element.boundElements ?? [])];
            for (const arrowId of arrowIds) {
                if (!boundElements.some(({ id }) => id === arrowId)) {
                    boundElements.push({ id: arrowId, type: "arrow" });
                }
            }
            return newElementWith(element, { boundElements });
        });
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
