import {
    DefinitionLink,
    DefinitionParams,
    Range,
} from 'vscode-languageserver-protocol';

import {
    createRange,
    isPositionInRange,
} from '../parser';

import {
    EvaluatedData,
    SourceRange,
} from '../evaluator';

function createRangeFromSourceRange(sourceRange: SourceRange): Range {
    return Range.create(sourceRange.start, sourceRange.end);
}

export function getDefinition(params: DefinitionParams, evaluatedData: EvaluatedData): DefinitionLink[] | null {
    const uri = params.textDocument.uri;
    const position = params.position;

    //
    // Check for a matching target definition.
    //
    for (let i = 0; i < evaluatedData.targetReferences.length; i++) {
        const reference = evaluatedData.targetReferences[i];
        if (uri == reference.range.uri
            && isPositionInRange(position, reference.range))
        {
            const definition = reference.definition;
            const definitionRange = createRangeFromSourceRange(definition.range);

            const definitionLink: DefinitionLink = {
                originSelectionRange: createRangeFromSourceRange(reference.range),
                targetUri: definition.range.uri,
                targetRange: definitionRange,
                targetSelectionRange: definitionRange,
            };
            return [definitionLink];
        }
    }

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
                originSelectionRange: createRangeFromSourceRange(reference.range),
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
            for (const definition of reference.definitions) {
                const definitionRange = createRangeFromSourceRange(definition.range);
                const definitionLink: DefinitionLink = {
                    originSelectionRange: createRangeFromSourceRange(reference.range),
                    targetUri: definition.range.uri,
                    targetRange: definitionRange,
                    targetSelectionRange: definitionRange,
                };
                results.set(JSON.stringify(definition.range), definitionLink);
            }
        }
    }

    if (results.size > 0) {
        return [...results.values()];
    } else {
        return null;
    }
}
