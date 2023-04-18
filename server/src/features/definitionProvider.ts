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

export function getDefinition(params: DefinitionParams, evaluatedData: EvaluatedData): DefinitionLink[] | null {
    const uri = params.textDocument.uri;
    const position = params.position;

    //
    // Check for a matching #include definition.
    //
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

    //
    // Check for a matching variable definition.
    //

    // Map JSON.stringify(SourceRange) to the definition in order to deduplicate definitions.
    const results = new Map<string, DefinitionLink>();

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
            results.set(JSON.stringify(definition.range), definitionLink);
        }
    }

    if (results.size > 0) {
        return [...results.values()];
    } else {
        return null;
    }
}
