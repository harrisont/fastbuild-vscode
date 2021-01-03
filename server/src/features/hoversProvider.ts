import {
    Hover,
    HoverParams,
    MarkupKind,
} from 'vscode-languageserver';

import {
    isPositionInRange,
} from '../parser';

import {
    EvaluatedData,
    EvaluatedVariable,
    Struct,
    Value,
} from '../evaluator';

const FASTBUILD_LANGUAGE_ID = 'fastbuild';
const INDENTATION = ' '.repeat(4);

export function valueToString(value: Value, indentation = ''): string {
    if (value instanceof Struct) {
        const itemIndentation = indentation + INDENTATION;
        const items = Array.from(value.entries()).map(
            ([varName, varValue]) => `${itemIndentation}.${varName} = ${valueToString(varValue, itemIndentation)}`
        );
        const lines = [
            '[',
            ...items,
            indentation + ']'
        ];
        return lines.join('\n');
    } else if (value instanceof Array) {
        const itemIndentation = indentation + INDENTATION;
        const items = value.map(
            (itemValue) => `${itemIndentation}${valueToString(itemValue, itemIndentation)}`
        );
        const lines = [
            '{',
            ...items,
            indentation + '}'
        ];
        return lines.join('\n');
    } else {
        return JSON.stringify(value);
    }
}

export class HoverProvider {
    private evaluatedData: EvaluatedData | null = null;

    onEvaluatedDataChanged(newEvaluatedData: EvaluatedData): void {
        this.evaluatedData = newEvaluatedData;
    }
    
    onHover(params: HoverParams): Hover | null {
        const uri = params.textDocument.uri;
        const position = params.position;
        const evaluatedVariables = this.evaluatedData?.evaluatedVariables ?? [];

        const possibleValues: Set<Value> = new Set();
        let firstEvaluatedVariable: EvaluatedVariable | null = null;
    
        // Potential optmization: use a different data structure to allow for a more efficient search.
        for (const evaluatedVariable of evaluatedVariables) {
            if (uri == evaluatedVariable.range.uri
                && isPositionInRange(position, evaluatedVariable.range))
            {
                if (firstEvaluatedVariable === null) {
                    firstEvaluatedVariable = evaluatedVariable;
                }
                possibleValues.add(evaluatedVariable.value);
            }
        }

        let valueStr = '';
        if (possibleValues.size === 0) {
            return null;
        } else {
            if (possibleValues.size === 1) {
                const value = possibleValues.values().next().value;
                valueStr = valueToString(value);
            } else {
                valueStr = 'Loop values:';
                for (const value of possibleValues) {
                    valueStr += '\n' + valueToString(value);
                }
            }
    
            const hoverText = '```' + FASTBUILD_LANGUAGE_ID + '\n' + valueStr + '\n```';
    
            const hover: Hover = {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: hoverText
                },
                range: firstEvaluatedVariable?.range
            };
            return hover;
        }
    }
}