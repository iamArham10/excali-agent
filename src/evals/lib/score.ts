export type ScoreResult = {
    name: string;
    score: number;
    metadata?: Record<string, unknown>;
};

export function ratio(passed: number, total: number): number {
    return total === 0 ? 1 : passed / total;
}

export function clampScore(score: number): number {
    return Math.max(0, Math.min(1, score));
}
