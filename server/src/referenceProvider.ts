import {
    Position,
    ReferenceParams,
} from 'vscode-languageserver-protocol';

import {
    DocumentUri,
    Location,
} from 'vscode-languageserver-types';

import {
    isPositionInRange,
} from './parser';

import {
    EvaluatedData,
    VariableReference,
} from './evaluator';

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

        const locations: Location[] = [];

        for (const variableReference of variableReferences)
        {
            // TODO: deduplicate references in order to handle references in a 'ForEach' loop.
            if (variableReference.definition.id === variableReferenceAtPosition.definition.id) {
                locations.push({
                    uri: variableReference.range.uri,
                    range: variableReference.range
                });
            }
        }

        if (variableReferenceAtPosition.usingRange) {
            locations.push({
                uri: variableReferenceAtPosition.usingRange.uri,
                range: variableReferenceAtPosition.usingRange
            });
        }

        return locations;
    }
}