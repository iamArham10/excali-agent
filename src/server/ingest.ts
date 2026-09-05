import { existsSync, readFileSync } from "fs";
import { glob } from "glob";
import path from "path";
import matter from "gray-matter";
import { vectorIndex } from "./vector-client";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 120;

function getOverlapTail(chunk: string, targetOverlap: number): string {
    if (chunk.length <= targetOverlap) return chunk;
    const slice = chunk.slice(-targetOverlap);
    const firstNewline = slice.indexOf("\n");
    if (firstNewline !== -1 && firstNewline < slice.length - 10) {
        return slice.slice(firstNewline + 1).trim();
    }
    const firstSpace = slice.indexOf(" ");
    if (firstSpace !== -1 && firstSpace < slice.length - 5) {
        return slice.slice(firstSpace + 1).trim();
    }
    return slice.trim();
}

function chunkText(
    text: string,
    targetSize: number = CHUNK_SIZE,
    overlap: number = CHUNK_OVERLAP,
): string[] {
    if (!text || text.trim().length === 0) return [];
    if (text.length <= targetSize) return [text.trim()];

    // Split by markdown headers or double newlines(paragraphs)
    const rawSections = text.split(
        /\n(?=(?:#{1,6}\s|[A-Z0-9].*\n={3,}|[A-Z0-9].*\n-{3,}))|\n\n+/,
    );
    const sections: string[] = [];

    for (const sec of rawSections) {
        const trimmed = sec.trim();
        if (!trimmed) continue;
        if (trimmed.length > targetSize) {
            // Split long section by single lines
            const lines = trimmed.split("\n");
            let currentLineGroup = "";
            for (const line of lines) {
                if (
                    (currentLineGroup + "\n" + line).trim().length >
                        targetSize &&
                    currentLineGroup
                ) {
                    sections.push(currentLineGroup.trim());
                    currentLineGroup = line;
                } else {
                    currentLineGroup = currentLineGroup
                        ? currentLineGroup + "\n" + line
                        : line;
                }
            }
            if (currentLineGroup.trim()) {
                sections.push(currentLineGroup.trim());
            }
        } else {
            sections.push(trimmed);
        }
    }

    const chunks: string[] = [];
    let currentChunk = "";

    for (const section of sections) {
        if (!currentChunk) {
            currentChunk = section;
        } else if ((currentChunk + "\n\n" + section).length <= targetSize) {
            currentChunk += "\n\n" + section;
        } else {
            chunks.push(currentChunk.trim());
            const tail = getOverlapTail(currentChunk, overlap);
            currentChunk = tail ? tail + "\n\n" + section : section;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

function extractTitle(
    content: string,
    frontmatterTitle?: string,
    fallbackFilename?: string,
): string {
    if (
        frontmatterTitle &&
        typeof frontmatterTitle === "string" &&
        frontmatterTitle.trim()
    ) {
        return frontmatterTitle.trim();
    }
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch && headingMatch[1]) {
        return headingMatch[1].trim();
    }
    return fallbackFilename || "Untitled";
}

async function ingestFolder(folderPath: string, resetIndex: boolean = false) {
    if (resetIndex) {
        console.log("Resetting vector index...");
        await vectorIndex.reset();
        console.log("Vector index cleared.");
    }

    const files = await glob(`${folderPath}/**/*.{md,mdx,txt,ts,tsx}`);
    console.log(`Found ${files.length} files in ${folderPath}`);

    let totalChunks = 0;

    for (const file of files) {
        const rawContent = readFileSync(file, "utf-8");
        if (!rawContent.trim()) continue;

        const relativePath = path.relative(folderPath, file);
        const fileExt = path.extname(file).toLowerCase();
        const baseName = path.basename(file, fileExt);

        let body = rawContent;
        let title = baseName;
        let description: string | undefined;

        if (fileExt === ".md" || fileExt === ".mdx") {
            const parsed = matter(rawContent);
            body = parsed.content || rawContent;
            title = extractTitle(body, parsed.data?.title, baseName);
            if (typeof parsed.data?.description === "string") {
                description = parsed.data.description;
            }
        } else {
            title = extractTitle(body, undefined, baseName);
        }

        const chunks = chunkText(body, CHUNK_SIZE, CHUNK_OVERLAP);
        if (chunks.length === 0) continue;

        const vectors = chunks.map((chunk, i) => ({
            id: `${relativePath}::chunk-${i}`,
            data: chunk,
            metadata: {
                source: relativePath,
                title,
                chunkIndex: i,
                text: chunk,
                ...(description ? { description } : {}),
            },
        }));

        for (let i = 0; i < vectors.length; i += 100) {
            await vectorIndex.upsert(vectors.slice(i, i + 100));
        }

        totalChunks += chunks.length;
        console.log(
            `Ingested ${relativePath} (${title}) → ${chunks.length} chunks`,
        );
    }

    console.log(`Done. Total chunks ingested: ${totalChunks}`);
}

const args = process.argv.slice(2);
const resetFlag = args.includes("--reset") || args.includes("--clear");
const nonFlagArgs = args.filter((arg) => !arg.startsWith("--"));

const folder =
    nonFlagArgs[0] ||
    (existsSync("./docs")
        ? "./docs"
        : existsSync("./knowledge")
          ? "./knowledge"
          : null);

if (!folder) {
    console.error("Usage: npm run ingest -- <folder-path> [--reset]");
    console.error("Example: npm run ingest -- ./docs --reset");
    process.exit(1);
}

ingestFolder(folder, resetFlag).catch(console.error);
