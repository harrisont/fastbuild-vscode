import {
    isPositionInRange,
} from '../parser';

import {
    EvaluationContext,
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

// `isTriggerCharacterInContent` should normally be true.
// It should only be false in tests.
export function getCompletions(params: CompletionParams, evaluationContext: EvaluationContext, isTriggerCharacterInContent: boolean): CompletionItem[] {
    const uri = params.textDocument.uri;

    // If a trigger character was used, then the evaluated data will be out of date because the uncompleted item will have evaluation errors.
    // Account for this by adjusting the position left one, as if the trigger character were not used.
    const position = params.position;
    if (params.context?.triggerCharacter !== undefined && isTriggerCharacterInContent) {
        position.character -= 1;
    }

    // If a scope was specified, use it instead of including a scope in the completion.
    // Otherwise, use '.' as the scope.
    const scopeCharacter = (params.context?.triggerCharacter !== undefined) ? '' : '.';

    const completions: CompletionItem[] = [];
    let isInFunction = false;

    //
    // Check for a function that encloses this position.
    // Return the possible function properties (i.e. the parameter variables).
    //
    const functionsForFile = evaluationContext.evaluatedData.genericFunctions.get(uri) || [];
    for (const genericFunction of functionsForFile) {
        if (isPositionInRange(position, genericFunction.bodyRangeWithoutBraces))
        {
            isInFunction = true;

            // Function property completions do not trigger on parent scope.
            if (params.context?.triggerCharacter !== '^') {
                const metadata = GENERIC_FUNCTION_METADATA_BY_NAME.get(genericFunction.functionName);
                if (metadata === undefined) {
                    break;
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
    }

    //
    // Add variable completions for definitions in scope.
    //

    // If in a function, then search starting from the current scope because the evaluation might have terminated late, outside the function scope.
    const variables = (params.context?.triggerCharacter === '^' && !isInFunction)
        ? evaluationContext.scopeStack.getVariablesStartingFromParentScope()
        : evaluationContext.scopeStack.getVariablesStartingFromCurrentScope();

    for (const variableName of variables.keys()) {
        const completion: CompletionItem = {
            label: `${scopeCharacter}${variableName}`,
            kind: CompletionItemKind.Variable,
            // Future opportunity: make the auto-completion show the evaluated values, similar to the hover values.
            // documentation: {
            //     kind: MarkupKind.Markdown,
            //     value: `...`,
            // },
        };
        completions.push(completion);
    }

    return completions;
}
