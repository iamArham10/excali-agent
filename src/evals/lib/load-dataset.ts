import { readFileSync } from "node:fs";
import { evalDatasetSchema, type EvalCase } from "../types";

export function loadDataset(fileName: string): EvalCase[] {
    const datasetUrl = new URL(`../datasets/${fileName}`, import.meta.url);
    const parsed: unknown = JSON.parse(readFileSync(datasetUrl, "utf8"));
    const dataset = evalDatasetSchema.parse(parsed);

    const duplicateIds = dataset
        .map((testCase) => testCase.id)
        .filter((id, index, ids) => ids.indexOf(id) !== index);

    if (duplicateIds.length > 0) {
        throw new Error(
            `Duplicate eval case ids in ${fileName}: ${[...new Set(duplicateIds)].join(", ")}`,
        );
    }

    return dataset;
}
