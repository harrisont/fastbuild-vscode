import {
    DefinitionLink,
    DefinitionParams,
} from 'vscode-languageserver-protocol';

import {
    createRange,
    isPositionInRange,
} from '../parser';

import {
    EvaluatedData,
} from '../evaluator';

export class DefinitionProvider {
    getDefinition(params: DefinitionParams, evaluatedData: EvaluatedData): DefinitionLink[] | null {
        const uri = params.textDocument.uri;
        const position = params.position;

        // Check for a matching target definition.
        for (let i = 0; i < evaluatedData.targetReferences.length; i++) {
            const reference = evaluatedData.targetReferences[i];
            if (uri == reference.range.uri
                && isPositionInRange(position, reference.range))
            {
                const definition = reference.definition;

                const definitionLink: DefinitionLink = {
                    originSelectionRange: reference.range,
                    targetUri: definition.range.uri,
                    targetRange: definition.range,
                    targetSelectionRange: definition.range,
                };
                return [definitionLink];
            }
        }

        // Check for a matching #include definition.
        for (let i = 0; i < evaluatedData.includeReferences.length; i++) {
            const reference = evaluatedData.includeReferences[i];
            if (uri == reference.range.uri
                && isPositionInRange(position, reference.range))
            {
                const includeRange = createRange(0, 0, 0, 0);
                const definitionLink: DefinitionLink = {
                    originSelectionRange: reference.range,
                    targetUri: reference.includeUri,
                    targetRange: includeRange,
                    targetSelectionRange: includeRange,
                };
                return [definitionLink];
            }
        }

        // Check for a matching variable definition.
        for (let i = 0; i < evaluatedData.variableReferences.length; i++) {
            const reference = evaluatedData.variableReferences[i];
            if (uri == reference.range.uri
                && isPositionInRange(position, reference.range))
            {
                const definition = reference.definition;

                const definitionLink: DefinitionLink = {
                    originSelectionRange: reference.range,
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
