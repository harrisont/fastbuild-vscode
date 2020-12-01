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
    private evaluatedData: EvaluatedData | null = null;
    private uri: DocumentUri | null = null;

    onEvaluatedDataChanged(uri: DocumentUri, newEvaluatedData: EvaluatedData): void {
        this.evaluatedData = newEvaluatedData;
        this.uri = uri;
    }

    onReferences(params: ReferenceParams): Location[] | null {
        if (!this.uri) {
            return null;
        }

        // TODO: also match params.textDocument.uri
        const variableReferenceAtPosition = this.getVariableReferenceAtPosition(params.position);
        if (variableReferenceAtPosition === null) {
            return null;
        }

        // Search algorithm: for each variable references, check if the variable definition is the same as this one.
        // This is not very optimized.

        const locations: Location[] = [];

        const variableReferences = this.evaluatedData?.variableReferences ?? [];
        for (const variableReference of variableReferences)
        {
            if (variableReference.definition.id === variableReferenceAtPosition.definition.id) {
                locations.push({
                    uri: this.uri,
                    range: variableReference.range
                });
            }
        }

        if (variableReferenceAtPosition.usingRange) {
            locations.push({
                uri: this.uri,
                range: variableReferenceAtPosition.usingRange
            });
        }

        return locations;
    }

    private getVariableReferenceAtPosition(position: Position): VariableReference | null {
        const variableReferences = this.evaluatedData?.variableReferences ?? [];
    
        for (let i = 0; i < variableReferences.length; i++)
        {
            const variableReference = variableReferences[i];
            if (isPositionInRange(position, variableReference.range))
            {
                return variableReference;
            }
        }

        return null;
    }
}