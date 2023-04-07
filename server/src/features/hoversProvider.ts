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

const HOVER_TEXT_PREFIX = '```' + FASTBUILD_LANGUAGE_ID + '\n';
const HOVER_TEXT_SUFFIX = '\n```';

// Visual Studio Code truncates hover texts longer than 100,000 characters.
const MAX_HOVER_TEXT_LENGTH = 100000;
const MAX_HOVER_TEXT_VALUE_LENGTH = MAX_HOVER_TEXT_LENGTH - HOVER_TEXT_PREFIX.length - HOVER_TEXT_SUFFIX.length - '…'.length;

export function valueToString(value: Value, indentation = ''): string {
    if (value instanceof Struct) {
        if (value.members.size === 0) {
            return '[]';
        } else {
            const itemIndentation = indentation + INDENTATION;
            const items = Array.from(value.members,
                ([structMemberName, structMember]) => `${itemIndentation}.${structMemberName} = ${valueToString(structMember.value, itemIndentation)}`
            );
            const lines = [
                '[',
                ...items,
                indentation + ']'
            ];
            return lines.join('\n');
        }
    } else if (value instanceof Array) {
        if (value.length === 0) {
            return '{}';
        } else {
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
        }
    } else {
        // Handle JSON.stringify doubling raw escape characters.
        return JSON.stringify(value).replace(/\\\\/g, '\\');
    }
}

export function getHoverText(possibleValues: Set<Value>): string {
    let valueStr = '';
    if (possibleValues.size === 1) {
        const value = possibleValues.values().next().value;
        valueStr = valueToString(value);
        if (valueStr.length > MAX_HOVER_TEXT_VALUE_LENGTH) {
            valueStr = valueStr.substring(0, MAX_HOVER_TEXT_VALUE_LENGTH) + '…';
        }
    } else {
        valueStr = 'Values:';
        for (const value of possibleValues) {
            const additionalValueStr = '\n' + valueToString(value);
            if (valueStr.length + additionalValueStr.length > MAX_HOVER_TEXT_VALUE_LENGTH) {
                valueStr += '\n…';
                break;
            } else {
                valueStr += additionalValueStr;
            }
        }
    }

    const hoverText = HOVER_TEXT_PREFIX + valueStr + HOVER_TEXT_SUFFIX;
    return hoverText;
}

export class HoverProvider {
    getHover(params: HoverParams, evaluatedData: EvaluatedData): Hover | null {
        const uri = params.textDocument.uri;
        const position = params.position;

        const possibleValues = new Set<Value>();
        let firstEvaluatedVariable: EvaluatedVariable | null = null;

        // Potential optmization: use a different data structure to allow for a more efficient search.
        for (const evaluatedVariable of evaluatedData.evaluatedVariables) {
            if (uri == evaluatedVariable.range.uri
                && isPositionInRange(position, evaluatedVariable.range))
            {
                if (firstEvaluatedVariable === null) {
                    firstEvaluatedVariable = evaluatedVariable;
                }
                possibleValues.add(evaluatedVariable.value);
            }
        }

        if (possibleValues.size === 0) {
            return null;
        } else {
            const hoverText = getHoverText(possibleValues);
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