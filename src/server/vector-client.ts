import { Index } from "@upstash/vector";

let clientInstance: Index | null = null;

export function getVectorIndex(): Index {
    if (!clientInstance) {
        const url = process.env.UPSTASH_VECTOR_REST_URL;
        const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
        if (!url || !token) {
            throw new Error(
                "Missing Upstash Vector credentials. Please set UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN in your environment or .dev.vars."
            );
        }
        clientInstance = new Index({ url, token });
    }
    return clientInstance;
}

export const vectorIndex: Index = new Proxy({} as Index, {
    get(_target, prop) {
        const instance = getVectorIndex();
        const value = (instance as any)[prop];
        return typeof value === "function" ? value.bind(instance) : value;
    },
});
