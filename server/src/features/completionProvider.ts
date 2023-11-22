import {
    isPositionInRange,
} from '../parser';

import {
    EvaluatedData,
} from '../evaluator';

import {
    GENERIC_FUNCTION_METADATA_BY_NAME,
} from '../genericFunctions';

import {
    CompletionItem,
    CompletionItemKind,
    CompletionParams,
    MarkupKind,
} from 'vscode-languageserver';

export function getCompletions(params: CompletionParams, evaluatedData: EvaluatedData): CompletionItem[] {
    const uri = params.textDocument.uri;
    const position = params.position;

    //
    // Check for a function that encloses this position.
    // Return the possible function properties (i.e. the parameter variables).
    //
    const functionsForFile = evaluatedData.genericFunctions.get(uri) || [];
    // TODO: replace this linear search with a binary search, since the array is sorted.
    for (const genericFunction of functionsForFile) {
        if (isPositionInRange(position, genericFunction.bodyRangeWithoutBraces))
        {
            const metadata = GENERIC_FUNCTION_METADATA_BY_NAME.get(genericFunction.functionName);
            if (metadata === undefined) {
                return [];
            }

            const completions: CompletionItem[] = [];
            for (const [propertyName, propertyAttributes] of metadata.properties) {
                const completion: CompletionItem = {
                    label: `.${propertyName}`,
                    kind: CompletionItemKind.Variable,
                    detail: `Required: ${propertyAttributes.isRequired ? 'true' : 'false'}`,
                    documentation: {
                        kind: MarkupKind.Markdown,
                        value: '# heading\n* value 1\n* value 2',
                    },
                };
                completions.push(completion);
            }
            return completions;
        }
    }

    // TODO: Also lookup the possible variable completions based on the URI and position in the AST.
    //       This will require adding support for tracking the AST, which we don't currently have.

    return [];
}
