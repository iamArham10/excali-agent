import {
    convertToExcalidrawElements,
    newElementWith,
    restoreElements,
} from "@excalidraw/excalidraw";
import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/data/transform";
import type { ElementUpdate } from "@excalidraw/excalidraw/element/mutateElement";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export class ExcaliDrawService {
    constructor(
        private apiRef: React.RefObject<ExcalidrawImperativeAPI | null>,
    ) { }

    private get api() {
        if (!this.apiRef.current) throw new Error("apiRef is not initialized");
        return this.apiRef.current;
    }

    createElements(skeletons: ExcalidrawElementSkeleton[]) {
        const newElements = restoreElements(
            convertToExcalidrawElements(skeletons, { regenerateIds: false }),
            null,
        );

        const elements = [...this.api.getSceneElements(), ...newElements]
        this.api.updateScene({ elements });
        this.api.scrollToContent(elements, { fitToContent: true })
    }

    modifyElements(modifiedElementsSkeletons: ({ id: string, label?: { text: string } } & Partial<ExcalidrawElementSkeleton>)[]) {
        const elements = this.api.getSceneElements()
        const updateById = new Map(modifiedElementsSkeletons.map(u => [u.id, u]))

        const merged = elements.map(el => {
            const update = updateById.get(el.id)
            if (update) {
                const { id, label, ...changes } = update;
                return newElementWith(el, changes as ElementUpdate<typeof el>)
            }
            return el
        })

        this.api.updateScene({ elements: merged })
    }
}
