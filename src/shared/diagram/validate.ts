import type {
    DiagramSpec,
    EdgeSpec,
    GraphSpec,
} from "../schemas/diagram-schema";

export type ResolvedEdge = EdgeSpec & { id: string };

/** Give every edge a stable id, derived from its endpoints when omitted. */
export function resolveEdges(spec: GraphSpec): ResolvedEdge[] {
    const used = new Set(
        (spec.edges ?? []).flatMap((edge) => (edge.id ? [edge.id] : [])),
    );
    return (spec.edges ?? []).map((edge) => {
        if (edge.id) return { ...edge, id: edge.id };
        const base = `${edge.from}-${edge.to}`;
        let id = base;
        for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
        used.add(id);
        return { ...edge, id };
    });
}

export type ValidationResult = { errors: string[]; warnings: string[] };

function findDuplicates(ids: string[]) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const id of ids) {
        if (seen.has(id)) duplicates.add(id);
        seen.add(id);
    }
    return [...duplicates];
}

/**
 * Semantic checks the Zod schema can't express. Errors reject the call so the
 * model can fix it; warnings are reported back but the diagram is still drawn.
 */
export function validateDiagramSpec(spec: DiagramSpec): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (spec.type === "sequence") {
        const ids = spec.participants.map((p) => p.id);
        for (const id of findDuplicates(ids)) {
            errors.push(`duplicate participant id '${id}'`);
        }
        const known = new Set(ids);
        spec.messages.forEach((message, index) => {
            for (const end of [message.from, message.to]) {
                if (!known.has(end)) {
                    errors.push(
                        `messages[${index}] references unknown participant '${end}'. Known participants: ${ids.join(", ")}`,
                    );
                }
            }
        });
        return { errors, warnings };
    }

    const nodeIds = spec.nodes.map((node) => node.id);
    for (const id of findDuplicates(nodeIds)) errors.push(`duplicate node id '${id}'`);
    const knownNodes = new Set(nodeIds);

    const edges = resolveEdges(spec);
    for (const id of findDuplicates(edges.map((edge) => edge.id))) {
        errors.push(`duplicate edge id '${id}'`);
    }
    for (const edge of edges) {
        for (const end of [edge.from, edge.to]) {
            if (!knownNodes.has(end)) {
                errors.push(
                    `edge '${edge.id}' references unknown node '${end}'. Known nodes: ${nodeIds.join(", ")}`,
                );
            }
        }
    }

    if (spec.type === "architecture") {
        const groups = spec.groups ?? [];
        const groupIds = groups.map((group) => group.id);
        for (const id of findDuplicates(groupIds)) errors.push(`duplicate group id '${id}'`);
        const knownGroups = new Map(groups.map((group) => [group.id, group]));

        for (const node of spec.nodes) {
            if (node.group && !knownGroups.has(node.group)) {
                errors.push(`node '${node.id}' references unknown group '${node.group}'`);
            }
        }
        for (const group of groups) {
            if (group.parent && !knownGroups.has(group.parent)) {
                errors.push(`group '${group.id}' references unknown parent '${group.parent}'`);
            }
            // walk up the parent chain to detect cycles
            const visited = new Set<string>([group.id]);
            let parent = group.parent;
            while (parent && knownGroups.has(parent)) {
                if (visited.has(parent)) {
                    errors.push(`group '${group.id}' has a cyclic parent chain`);
                    break;
                }
                visited.add(parent);
                parent = knownGroups.get(parent)!.parent;
            }
        }

        const nonEmpty = new Set<string>();
        for (const node of spec.nodes) {
            let group = node.group;
            while (group && !nonEmpty.has(group)) {
                nonEmpty.add(group);
                group = knownGroups.get(group)?.parent;
            }
        }
        for (const group of groups) {
            if (!nonEmpty.has(group.id)) {
                warnings.push(`group '${group.id}' contains no nodes and was not drawn`);
            }
        }
    }

    if (spec.type === "flowchart") {
        for (const node of spec.nodes) {
            if (node.kind !== "decision") continue;
            const outgoing = edges.filter((edge) => edge.from === node.id);
            if (outgoing.length < 2) {
                warnings.push(`decision '${node.id}' has fewer than 2 outgoing edges`);
            }
            if (outgoing.some((edge) => !edge.label)) {
                warnings.push(
                    `decision '${node.id}' has unlabeled outgoing edges; label branches (e.g. yes/no)`,
                );
            }
        }
    }

    return { errors, warnings };
}
