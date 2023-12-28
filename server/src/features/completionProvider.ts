import {
    isPositionInRange,
} from '../parser';

import {
    EvaluatedData,
} from '../evaluator';

import {
    GENERIC_FUNCTION_METADATA_BY_NAME,
    ValueType,
} from '../genericFunctions';

import {
    CompletionItem,
    CompletionItemKind,
    CompletionParams,
    MarkupKind,
} from 'vscode-languageserver';

export function getCompletions(params: CompletionParams, evaluatedData: EvaluatedData): CompletionItem[] {
    const uri = params.textDocument.uri;

    // If a trigger character was used, then the evaluated data will be out of date because the uncompleted item will have evaluation errors.
    // Account for this by adjusting the position left one, as if the trigger character were not used.
    const position = params.position;
    if (params.context?.triggerCharacter !== undefined) {
        position.character -= 1;
    }

    // If a scope was specified, use it instead of including a scope in the completion.
    // Otherwise, use '.' as the scope.
    const scopeCharacter = (params.context?.triggerCharacter !== undefined) ? '' : '.';

    //
    // Add variable completions for definitions in scope.
    //
    const completions: CompletionItem[] = [];
    for (const definition of evaluatedData.variableDefinitions) {
        if (definition.range.uri == uri
            && ((definition.range.start.line == position.line && definition.range.start.character >= position.character)
                || (definition.range.start.line > position.line)))
        {
            break;
        }

        const completion: CompletionItem = {
            label: `${scopeCharacter}${definition.name}`,
            kind: CompletionItemKind.Variable,
            documentation: {
                kind: MarkupKind.Markdown,
                value: `TODO: documentation`,
            },
        };
        completions.push(completion);
    }

    //
    // Check for a function that encloses this position.
    // Return the possible function properties (i.e. the parameter variables).
    //
    const functionsForFile = evaluatedData.genericFunctions.get(uri) || [];
    for (const genericFunction of functionsForFile) {
        if (isPositionInRange(position, genericFunction.bodyRangeWithoutBraces))
        {
            const metadata = GENERIC_FUNCTION_METADATA_BY_NAME.get(genericFunction.functionName);
            if (metadata === undefined) {
                return [];
            }

            for (const [propertyName, propertyAttributes] of metadata.properties) {
                const requiredHeader = propertyAttributes.isRequired ?
                    'Required'
                    : `Optional${propertyAttributes.defaultDescription ? ', defaults to `' + propertyAttributes.defaultDescription + '`' : ''}`;

                const typeHeader = Array.from(propertyAttributes.types.values()).map(type => ValueType[type]).join('/');

                const completion: CompletionItem = {
                    label: `${scopeCharacter}${propertyName}`,
                    kind: CompletionItemKind.Variable,
                    documentation: {
                        kind: MarkupKind.Markdown,
                        value: `**${typeHeader} (${requiredHeader})**\n\n${propertyAttributes.documentation}

[Function documentation website](${metadata.documentationUrl})`,
                    },
                };
                completions.push(completion);
            }
            break;
        }
    }

    return completions;
}
