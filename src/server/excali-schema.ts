import { z } from "zod";

const fontFamilySchema = z
    .union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(5),
        z.literal(6),
        z.literal(7),
        z.literal(8),
        z.literal(9),
    ])
    .describe(
        "font family: 1 Virgil, 2 Helvetica, 3 Cascadia, 5 Excalifont, 6 Nunito, 7 Lilita One, 8 Comic Shanns, 9 Liberation Sans",
    );

const typographyFields = {
    fontSize: z.number().min(1).optional().describe("font size in pixels"),
    fontFamily: fontFamilySchema.optional(),
    textAlign: z
        .enum(["left", "center", "right"])
        .optional()
        .describe("horizontal text alignment"),
    verticalAlign: z
        .enum(["top", "middle", "bottom"])
        .optional()
        .describe("vertical text alignment"),
};

const styleFields = {
    strokeColor: z
        .string()
        .optional()
        .describe("stroke or text color as a hex color"),
    backgroundColor: z
        .string()
        .optional()
        .describe("fill color as a hex color or transparent"),
    fillStyle: z
        .enum(["solid", "hachure", "cross-hatch", "zigzag"])
        .optional()
        .describe("shape fill pattern"),
    strokeWidth: z.number().min(0).optional().describe("stroke width in pixels"),
    strokeStyle: z
        .enum(["solid", "dashed", "dotted"])
        .optional()
        .describe("stroke pattern"),
    roughness: z
        .union([z.literal(0), z.literal(1), z.literal(2)])
        .optional()
        .describe("0 clean, 1 sketchy, 2 very sketchy"),
    opacity: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("element opacity from 0 to 100"),
    angle: z.number().optional().describe("clockwise rotation in radians"),
};

const label = z.object({
    text: z.string().describe("text of the label"),
    ...typographyFields,
});

const drawShapeElementSchema = z.object({
    id: z
        .string()
        .describe(
            "id of the element, choose unique id so you can later refer to the element",
        ),
    type: z
        .enum(["rectangle", "ellipse", "diamond"])
        .describe("type of shape to draw"),
    x: z.number().describe("top left x coordinate of the shape"),
    y: z.number().describe("top left y coordinate of the shape"),
    width: z.number().min(1).optional().describe("width of the shape"),
    height: z.number().min(1).optional().describe("height of the shape"),
    label: label.optional().describe("label to attach to the shape"),
    ...styleFields,
});

const drawTextElementSchema = z.object({
    type: z.literal("text"),
    id: z
        .string()
        .describe(
            "id of the text element, choose unique id so you can later refer to the element",
        ),
    text: z.string().min(1).describe("the text content to draw on the canvas"),
    x: z.number().describe("top left x coordinate of the text"),
    y: z.number().describe("top left y coordinate of the text"),
    ...typographyFields,
    ...styleFields,
});

const pointSchema = z
    .array(z.tuple([z.number(), z.number()]))
    .min(2).max(2)
    .describe(
        "An ordered list of [x, y] coordinate points that defines the path of the line or arrow. " +
        "Coordinates MUST be relative to the element's x and y, never absolute canvas coordinates. " +
        "The first point MUST be [0, 0]. The last point is the offset from the start to the end. " +
        "Do not create bends; always create straight lines with only a start and end point. " +
        "For a straight 200px rightward arrow use x/y for its canvas start and points [[0, 0], [200, 0]].",
    );

const arrowheadSchema = z
    .enum([
        "arrow",
        "bar",
        "dot",
        "circle",
        "circle_outline",
        "triangle",
        "triangle_outline",
        "diamond",
        "diamond_outline",
        "crowfoot_one",
        "crowfoot_many",
        "crowfoot_one_or_many",
    ])
    .nullable()
    .describe("arrowhead shape, or null for no arrowhead");

const drawArrowElementSchema = z.object({
    type: z.literal("arrow"),
    id: z
        .string()
        .describe(
            "id of the arrow element, choose unique id so you can later refer to the element",
        ),
    x: z
        .number()
        .describe("canvas x coordinate of the arrow's first path point"),
    y: z
        .number()
        .describe("canvas y coordinate of the arrow's first path point"),
    label: label.optional().describe("label to attach to the arrow"),
    points: pointSchema.optional(),
    startArrowhead: arrowheadSchema,
    endArrowhead: arrowheadSchema,
    start: z
        .object({
            id: z
                .string()
                .describe("id of the shape from which to start the arrow"),
        })
        .optional()
        .describe(
            "shape at the first path point; points must travel away from this shape",
        ),
    end: z
        .object({
            id: z
                .string()
                .describe("id of the shape to which to connect the arrow"),
        })
        .optional()
        .describe(
            "shape at the last path point; points must travel toward this shape",
        ),
    ...styleFields,
});

const drawLineElementSchema = z.object({
    type: z.literal("line"),
    id: z
        .string()
        .describe(
            "id of the line element, choose unique id so you can later refer to the element",
        ),
    x: z.number().describe("canvas x coordinate of the line's first point"),
    y: z.number().describe("canvas y coordinate of the line's first point"),
    points: pointSchema,
    label: label.optional().describe("label to attach to the line"),
    ...styleFields,
});

const modifyLabel = label.partial();

const modifyShapeElementSchema = drawShapeElementSchema
    .partial()
    .required({
        id: true,
        type: true,
    })
    .extend({ label: modifyLabel.optional() });

const modifyTextElementSchema = drawTextElementSchema.partial().required({
    id: true,
    type: true,
});

const modifyArrowElementSchema = drawArrowElementSchema
    .partial()
    .required({
        id: true,
        type: true,
    })
    .extend({ label: modifyLabel.optional() });

const modifyLineElementSchema = drawLineElementSchema
    .partial()
    .required({
        id: true,
        type: true,
    })
    .extend({ label: modifyLabel.optional() });

const deleteElementSchema = z.object({
    id: z.string().describe("id of the element to delete"),
});

const DrawElementsToolSchema = z.object({
    elements: z
        .array(
            z.discriminatedUnion("type", [
                drawShapeElementSchema,
                drawTextElementSchema,
                drawArrowElementSchema,
                drawLineElementSchema,
            ]),
        )
        .min(1)
        .describe("elements to draw"),
});

const ModifyElementsToolSchema = z.object({
    elements: z
        .array(
            z.discriminatedUnion("type", [
                modifyShapeElementSchema,
                modifyTextElementSchema,
                modifyArrowElementSchema,
                modifyLineElementSchema,
            ]),
        )
        .min(1)
        .describe("elements to modify"),
});

const DeleteElementsToolSchema = z.object({
    elements: z
        .array(deleteElementSchema)
        .min(1)
        .describe("elements to delete"),
});

export {
    DrawElementsToolSchema,
    ModifyElementsToolSchema,
    DeleteElementsToolSchema,
};
