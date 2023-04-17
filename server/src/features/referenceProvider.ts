import {
    ReferenceParams,
} from 'vscode-languageserver-protocol';

import {
    Location,
    Position,
} from 'vscode-languageserver-types';

import {
    isPositionInRange,
} from '../parser';

import {
    EvaluatedData,
} from '../evaluator';

export class ReferenceProvider {
    getReferences(params: ReferenceParams, evaluatedData: EvaluatedData): Location[] {
        const uri = params.textDocument.uri;
        const position = params.position;

        const references = this.getTargetReferences(uri, position, evaluatedData);
        references.push(...this.getIncludeReferences(uri, position, evaluatedData));
        references.push(...this.getVariableReferences(uri, position, evaluatedData));
        return references;
    }

    getTargetReferences(uri: string, position: Position, evaluatedData: EvaluatedData): Location[] {
        const references = evaluatedData.targetReferences;

        const referenceAtPosition = references.find(ref => (ref.range.uri == uri && isPositionInRange(position, ref.range)));
        if (referenceAtPosition === undefined) {
            return [];
        }

        // Search algorithm: for each references, check if the definition is the same as this one.
        // This is not very optimized.

        // Map JSON.stringify(Location) to Location in order to deduplicate referencs in a 'ForEach' loop.
        const locations = new Map<string, Location>();

        for (const reference of references)
        {
            if (reference.definition.id === referenceAtPosition.definition.id) {
                const location: Location = {
                    uri: reference.range.uri,
                    range: reference.range
                };
                locations.set(JSON.stringify(location), location);
            }
        }

        return [...locations.values()];
    }

    getIncludeReferences(uri: string, position: Position, evaluatedData: EvaluatedData): Location[] {
        const references = evaluatedData.includeReferences;

        const referenceAtPosition = references.find(ref => (ref.range.uri == uri && isPositionInRange(position, ref.range)));
        if (referenceAtPosition === undefined) {
            return [];
        }

        // Search algorithm: for each references, check if the URI matches.
        // This is not very optimized.

        // Map JSON.stringify(Location) to Location in order to deduplicate referencs in a 'ForEach' loop.
        const locations = new Map<string, Location>();

        for (const reference of references)
        {
            if (reference.includeUri === referenceAtPosition.includeUri) {
                const location: Location = {
                    uri: reference.range.uri,
                    range: reference.range
                };
                locations.set(JSON.stringify(location), location);
            }
        }

        return [...locations.values()];
    }

    getVariableReferences(uri: string, position: Position, evaluatedData: EvaluatedData): Location[] {
        const references = evaluatedData.variableReferences;

        const definitionIdsAtPosition = references
            .filter(ref => (ref.range.uri == uri && isPositionInRange(position, ref.range)))
            .map(ref => ref.definition.id);
        if (definitionIdsAtPosition.length === 0) {
            return [];
        }

        // Search algorithm: for each references, check if the definition is the same as this one.
        // This is not very optimized.

        // Map JSON.stringify(reference.range) to Location in order to deduplicate referencs in a 'ForEach' loop.
        const locations = new Map<string, Location>();

        for (const reference of references)
        {
            if (definitionIdsAtPosition.some(defnIdAtPos => (reference.definition.id === defnIdAtPos))) {
                const location: Location = {
                    uri: reference.range.uri,
                    range: reference.range
                };
                const key = JSON.stringify(reference.range);
                locations.set(key, location);
            }
        }

        return [...locations.values()];
    }
}
