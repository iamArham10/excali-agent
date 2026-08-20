import z from "zod";

const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

const categorySchema = z.enum(["create", "modify", "delete"]);
export type Category = z.infer<typeof categorySchema>;

const testCaseSchema = z.object({
    id: z.string().min(1),
    input: z.string(),
    expectedCharacteristics: z.array(z.string()),
    difficulty: difficultySchema,
    category: categorySchema,
});

export type TestCase = z.infer<typeof testCaseSchema>;

const evalResultSchema = z.object({
    testCaseId: z.string().min(1),
    input: z.string(),
    response: z.string(),
    elements: z.array(z.unknown()),
    durationMs: z.number(),
    error: z.string().optional(),
});

export type EvalResult = z.infer<typeof evalResultSchema>;

const scoredResultSchema = evalResultSchema.extend({
    score: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
    ]),
    notes: z.string().optional(),
});

export type ScoredResult = z.infer<typeof scoredResultSchema>;
