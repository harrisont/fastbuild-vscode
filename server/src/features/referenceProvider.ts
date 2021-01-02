import {
    ReferenceParams,
} from 'vscode-languageserver-protocol';

import {
    DocumentUri,
    Location,
} from 'vscode-languageserver-types';

import {
    isPositionInRange,
} from '../parser';

import {
    EvaluatedData,
} from '../evaluator';

export class ReferenceProvider {
    private evaluatedData = new Map<DocumentUri, EvaluatedData>();

    onEvaluatedDataChanged(uri: DocumentUri, newEvaluatedData: EvaluatedData): void {
        this.evaluatedData.set(uri, newEvaluatedData);
    }

    onReferences(params: ReferenceParams): Location[] | null {
        const uri = params.textDocument.uri;
        const position = params.position;
        const evaluatedData = this.evaluatedData.get(uri);
        if (evaluatedData === undefined) {
            return null;
        }
        const variableReferences = evaluatedData.variableReferences;

        const variableReferenceAtPosition = variableReferences.find(ref => (ref.range.uri == uri && isPositionInRange(position, ref.range)));
        if (variableReferenceAtPosition === undefined) {
            return null;
        }

        // Search algorithm: for each variable references, check if the variable definition is the same as this one.
        // This is not very optimized.

        // Map JSON.stringify(Location) to Location in order to deduplicate referencs in a 'ForEach' loop.
        const locations = new Map<string, Location>();

        for (const variableReference of variableReferences)
        {
            if (variableReference.definition.id === variableReferenceAtPosition.definition.id) {
                const location: Location = {
                    uri: variableReference.range.uri,
                    range: variableReference.range
                };
                locations.set(JSON.stringify(location), location);
            }
        }

        if (variableReferenceAtPosition.usingRange) {
            const location: Location = {
                uri: variableReferenceAtPosition.usingRange.uri,
                range: variableReferenceAtPosition.usingRange
            };
            locations.set(JSON.stringify(location), location);
        }

        return [...locations.values()];
    }
}