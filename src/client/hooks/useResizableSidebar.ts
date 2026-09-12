import { useState, type CSSProperties } from "react";

export function useResizableSidebar() {
    const [assistantWidth, setAssistantWidth] = useState(400);

    const workspaceStyle = {
        "--assistant-width": `${assistantWidth}px`,
    } as CSSProperties;

    const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        const onPointerMove = (pointerEvent: PointerEvent) => {
            setAssistantWidth(
                Math.min(
                    560,
                    Math.max(340, window.innerWidth - pointerEvent.clientX),
                ),
            );
        };
        const stopResize = () => {
            document.body.classList.remove("is-resizing");
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", stopResize);
        };

        document.body.classList.add("is-resizing");
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", stopResize);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
            return;
        event.preventDefault();
        const direction = event.key === "ArrowLeft" ? 16 : -16;
        setAssistantWidth((width) =>
            Math.min(560, Math.max(340, width + direction)),
        );
    };

    return {
        assistantWidth,
        workspaceStyle,
        beginResize,
        handleKeyDown,
    };
}
