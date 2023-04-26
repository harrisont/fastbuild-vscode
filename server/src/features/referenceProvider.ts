import {
    ReferenceParams,
} from 'vscode-languageserver-protocol';

import {
    Location,
    Position,
    Range,
} from 'vscode-languageserver-types';

import {
    isPositionInRange,
} from '../parser';

import {
    EvaluatedData,
    SourceRange,
    VariableDefinition,
} from '../evaluator';

function createLocationFromSourceRange(sourceRange: SourceRange): Location {
    return {
        uri: sourceRange.uri,
        range: Range.create(sourceRange.start, sourceRange.end),
    };
}

export function getReferences(params: ReferenceParams, evaluatedData: EvaluatedData): Location[] {
    const uri = params.textDocument.uri;
    const position = params.position;

    const references = getTargetReferences(uri, position, evaluatedData);
    references.push(...getIncludeReferences(uri, position, evaluatedData));
    references.push(...getVariableReferences(uri, position, evaluatedData));
    return references;
}

function getTargetReferences(uri: string, position: Position, evaluatedData: EvaluatedData): Location[] {
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
            const location = createLocationFromSourceRange(reference.range);
            locations.set(JSON.stringify(location), location);
        }
    }

    return [...locations.values()];
}

function getIncludeReferences(uri: string, position: Position, evaluatedData: EvaluatedData): Location[] {
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
            const location = createLocationFromSourceRange(reference.range);
            locations.set(JSON.stringify(location), location);
        }
    }

    return [...locations.values()];
}

function getVariableReferences(uri: string, position: Position, evaluatedData: EvaluatedData): Location[] {
    const references = evaluatedData.variableReferences;

    const definitionIdsAtPosition = references
        .filter(ref => (ref.range.uri == uri && isPositionInRange(position, ref.range)))
        .map(ref => ref.definitions as VariableDefinition[])
        .reduce((accumulator, currentValue) => accumulator.concat(currentValue), [])
        .map(definition => definition.id);
    if (definitionIdsAtPosition.length === 0) {
        return [];
    }

    // Search algorithm: for each references, check if the definition is the same as this one.
    // This is not very optimized.

    // Map JSON.stringify(Location) to Location in order to deduplicate referencs in a 'ForEach' loop.
    const locations = new Map<string, Location>();

    for (const reference of references)
    {
        if (definitionIdsAtPosition.some(defnIdAtPos => (reference.definitions.some(refDef => (refDef.id === defnIdAtPos))))) {
            const location = createLocationFromSourceRange(reference.range);
            const key = JSON.stringify(location);
            locations.set(key, location);
        }
    }

    return [...locations.values()];
}
