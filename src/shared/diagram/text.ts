import type { ShapeType } from "./theme";

// Approximate Helvetica advance widths as a fraction of the font size. We only
// need a generous estimate: Excalidraw measures the real text when rendering,
// and these numbers keep layout from under-sizing shapes.
function charWidth(char: string): number {
    if (char === " ") return 0.28;
    if ("il.,:;'|!".includes(char)) return 0.28;
    if ("fjrtI()[]/-".includes(char)) return 0.36;
    if ("mwMW@".includes(char)) return 0.86;
    if (char >= "A" && char <= "Z") return 0.68;
    if (char >= "0" && char <= "9") return 0.56;
    return 0.56;
}

export function textLineWidth(line: string, fontSize: number): number {
    let width = 0;
    for (const char of line) width += charWidth(char);
    return width * fontSize;
}

export function measureText(text: string, fontSize: number) {
    const lines = text.split("\n");
    return {
        width: Math.max(...lines.map((line) => textLineWidth(line, fontSize))),
        height: lines.length * lineHeight(fontSize),
        lines,
    };
}

export function lineHeight(fontSize: number) {
    return Math.ceil(fontSize * 1.25);
}

const roundUp = (value: number, step = 10) => Math.ceil(value / step) * step;
const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

function wrappedLineCount(lines: string[], fontSize: number, maxWidth: number) {
    return lines.reduce(
        (count, line) =>
            count + Math.max(1, Math.ceil(textLineWidth(line, fontSize) / maxWidth)),
        0,
    );
}

/** Size a labeled shape so its label fits comfortably without clipping. */
export function sizeForLabel(label: string, shape: ShapeType, fontSize: number) {
    const { width: textWidth, lines } = measureText(label, fontSize);
    const lh = lineHeight(fontSize);

    if (shape === "diamond") {
        // Excalidraw only uses roughly half of a diamond's width for its label.
        const width = clamp(roundUp(textWidth * 2 + 60), 180, 360);
        const count = wrappedLineCount(lines, fontSize, width / 2 - 10);
        return { width, height: Math.max(110, roundUp(count * lh * 2 + 50)) };
    }

    if (shape === "ellipse") {
        const width = clamp(roundUp((textWidth + 30) * 1.45), 150, 320);
        const count = wrappedLineCount(lines, fontSize, width * 0.7 - 20);
        return { width, height: Math.max(70, roundUp(count * lh * 1.45 + 36)) };
    }

    const isDivider = (l: string) => /^[─\-=_]{2,}$/.test(l.trim());
    const contentLines = lines.filter((l) => !isDivider(l));
    const width = clamp(roundUp(textWidth + 50), 160, 360);
    const count = wrappedLineCount(contentLines.length ? contentLines : lines, fontSize, width - 40);
    const minHeight = lines.length > 1 ? Math.max(80, 36 + contentLines.length * 20 + 20) : 70;
    return { width, height: Math.max(minHeight, roundUp(count * lh + 40)) };
}
