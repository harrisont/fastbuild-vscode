import {
    DefinitionLink,
    DefinitionParams,
} from 'vscode-languageserver-protocol';

import {
    DocumentUri,
} from 'vscode-languageserver-types';

import {
    isPositionInRange,
} from './parser';

import {
    EvaluatedData,
} from './evaluator';

export class DefinitionProvider {
    private evaluatedData = new Map<DocumentUri, EvaluatedData>();

    onEvaluatedDataChanged(uri: DocumentUri, newEvaluatedData: EvaluatedData): void {
        this.evaluatedData.set(uri, newEvaluatedData);
    }

    onDefinition(params: DefinitionParams): DefinitionLink[] | null {
        const uri = params.textDocument.uri;
        const position = params.position;
        const evaluatedData = this.evaluatedData.get(uri);
        if (evaluatedData === undefined) {
            return null;
        }
        const variableReferences = evaluatedData.variableReferences;
    
        for (let i = 0; i < variableReferences.length; i++) {
            const variableReference = variableReferences[i];
            if (uri == variableReference.range.uri
                && isPositionInRange(position, variableReference.range))
            {
                const definition = variableReference.definition;

                const definitionLink: DefinitionLink = {
                    originSelectionRange: variableReference.range,
                    targetUri: definition.range.uri,
                    targetRange: definition.range,
                    targetSelectionRange: definition.range,
                };
                return [definitionLink];
            }
        }
    
        return null;
    }
}