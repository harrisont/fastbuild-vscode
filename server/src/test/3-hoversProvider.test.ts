import * as assert from 'assert';

import {
    createRange as createParseRange,
} from '../parser';

import {
    ArrayItem,
    SourceRange,
    Struct,
    StructMember,
    Value,
    ValueWithRange,
    VariableDefinition,
} from '../evaluator';

import {
    getHoverText,
    valueToString,
} from '../features/hoversProvider';

type UriStr = string;

function createRange(uri: UriStr, startLine: number, startCharacter: number, endLine: number, endCharacter: number): SourceRange {
    return new SourceRange(
        uri,
        {
            start: {
                line: startLine,
                character: startCharacter
            },
            end: {
                line: endLine,
                character: endCharacter
            }
        }
    );
}

function createDummyRange(): SourceRange {
    return createRange('file:///dummy.bff', 0, 0, 0, 0);
}

function convertValueWithDummyRange(value: Value): ValueWithRange {
    if (value instanceof Array) {
        return value.map(item => new ArrayItem(
            convertValueWithDummyRange(item),
            createParseRange(0, 0, 0, 0)
        ));
    } else {
        return value;
    }
}

// Convenience to avoid needing to create ranges for each test.
function valueWithoutRangeToString(value: Value): string {
    const valueWithRange = convertValueWithDummyRange(value);
    return valueToString(valueWithRange);
}

// Convenience to avoid needing to create ranges for each test.
function getHoverTextWithoutRange(possibleValues: Value[]): string {
    const possibleValuesWithRange = possibleValues.map(value => convertValueWithDummyRange(value));
    return getHoverText(possibleValuesWithRange);
}

describe('hoversProvider', () => {
    describe('valueToString', () => {
        it('works for an integer', () => {
            const str = valueWithoutRangeToString(1);
            assert.strictEqual('1', str);
        });

        it('works for a boolean', () => {
            const str = valueWithoutRangeToString(true);
            assert.strictEqual('true', str);
        });

        it('works for a string', () => {
            const str = valueWithoutRangeToString('Hello world');
            assert.strictEqual("'Hello world'", str);
        });

        it('works for a string with quotes', () => {
            const str = valueWithoutRangeToString('\'Hello\' "world"');
            assert.strictEqual("'^'Hello^' \"world\"'", str);
        });

        it('works for a string with backslash characters', () => {
            const str = valueWithoutRangeToString('a \\ b');
            assert.strictEqual("'a \\ b'", str);
        });

        it('works for an empty array', () => {
            const value: Value = [];
            const str = valueWithoutRangeToString(value);
            assert.strictEqual(
                `{}`,
                str);
        });

        it('works for an array of primitives', () => {
            const value = ['Hello', 'world'];
            const str = valueWithoutRangeToString(value);
            assert.strictEqual(
                `{
    'Hello'
    'world'
}`,
                str);
        });

        it('works for an array of arrays', () => {
            const value = [
                [
                    'a',
                    'b',
                ],
                [
                    'hi',
                    'bye',
                ]
            ];
            const str = valueWithoutRangeToString(value);
            assert.strictEqual(`{
    {
        'a'
        'b'
    }
    {
        'hi'
        'bye'
    }
}`, str);
        });

        it('works for an empty struct', () => {
            const value = new Struct();
            const str = valueWithoutRangeToString(value);
            assert.strictEqual(
                `[]`,
                str);
        });

        it('works for a struct', () => {
            const dummyDefinition: VariableDefinition = { id: 1, range: createDummyRange(), name: '' };
            const value = Struct.from(Object.entries({
                A: new StructMember(1, [dummyDefinition]),
                B: new StructMember(2, [dummyDefinition]),
            }));
            const str = valueWithoutRangeToString(value);
            assert.strictEqual(
                `[
    .A = 1
    .B = 2
]`,
                str);
        });

        it('works for a struct of structs', () => {
            const dummyDefinition: VariableDefinition = { id: 1, range: createDummyRange(), name: '' };
            const value = Struct.from(Object.entries({
                A: new StructMember(Struct.from(Object.entries({
                    A1: new StructMember(1, [dummyDefinition]),
                    A2: new StructMember(2, [dummyDefinition]),
                })), [dummyDefinition]),
                B: new StructMember(Struct.from(Object.entries({
                    B1: new StructMember(1, [dummyDefinition]),
                    B2: new StructMember(2, [dummyDefinition]),
                })), [dummyDefinition]),
            }));
            const str = valueWithoutRangeToString(value);
            assert.strictEqual(
                `[
    .A = [
        .A1 = 1
        .A2 = 2
    ]
    .B = [
        .B1 = 1
        .B2 = 2
    ]
]`,
                str);
        });
    });

    describe('getHoverTextWithoutRange', () => {
        it('works for a single value', () => {
            const possibleValues = [
                'a',
            ];
            const actualHoverText = getHoverTextWithoutRange(possibleValues);
            const expectedHoverText = `\`\`\`fastbuild
'a'
\`\`\``;
            assert.strictEqual(actualHoverText, expectedHoverText);
        });

        it('works for multiple values', () => {
            const possibleValues = [
                'a',
                'b',
            ];
            const actualHoverText = getHoverTextWithoutRange(possibleValues);
            const expectedHoverText = `\`\`\`fastbuild
Values:
'a'
'b'
\`\`\``;
            assert.strictEqual(actualHoverText, expectedHoverText);
        });

        it('deduplicates identical basic values', () => {
            const possibleValues = [
                'a',
                'a',
            ];
            const actualHoverText = getHoverTextWithoutRange(possibleValues);
            const expectedHoverText = `\`\`\`fastbuild
'a'
\`\`\``;
            assert.strictEqual(actualHoverText, expectedHoverText);
        });

        it('deduplicates identical array values', () => {
            const possibleValues = [
                ['a', 'b'],
                ['a', 'b'],
            ];
            const actualHoverText = getHoverTextWithoutRange(possibleValues);
            const expectedHoverText = `\`\`\`fastbuild
{
    'a'
    'b'
}
\`\`\``;
            assert.strictEqual(actualHoverText, expectedHoverText);
        });

        it('deduplicates identical struct values', () => {
            const dummyDefinition: VariableDefinition = { id: 1, range: createDummyRange(), name: '' };
            const value = Struct.from(Object.entries({
                A: new StructMember(1, [dummyDefinition]),
            }));

            const possibleValues = [
                value,
                value,
            ];
            const actualHoverText = getHoverTextWithoutRange(possibleValues);
            const expectedHoverText = `\`\`\`fastbuild
[
    .A = 1
]
\`\`\``;
            assert.strictEqual(actualHoverText, expectedHoverText);
        });

        it('works for a single value that is longer than VS Code supports (>100,000 characters), by truncating the result', () => {
            const strWithLengthOverLimit = 'a'.repeat(200000);
            const possibleValues = [
                strWithLengthOverLimit,
            ];
            const actualHoverText = getHoverTextWithoutRange(possibleValues);

            // Need extra characters for the prefix, ellipsis, and the suffix.
            const expectedHoverTextWithoutValue = `\`\`\`fastbuild
"…
\`\`\``;
            const expectedValueStrLenth = 100000 - expectedHoverTextWithoutValue.length;
            const expectedTruncatedStr = 'a'.repeat(expectedValueStrLenth);
            const expectedHoverText = `\`\`\`fastbuild
'${expectedTruncatedStr}…
\`\`\``;
            assert.strictEqual(actualHoverText.length <= 100000, true);
            assert.strictEqual(actualHoverText.length, expectedHoverText.length);
            assert.strictEqual(actualHoverText, expectedHoverText);
        });

        it('works for multiple values that combined are longer than VS Code supports (>100,000 characters), by skipping the possible value that would push over the limit', () => {
            const strWithLengthHalfOfLimit1 = 'a'.repeat(50000);
            const strWithLengthHalfOfLimit2 = 'b'.repeat(50000);
            const possibleValues = [
                strWithLengthHalfOfLimit1,
                strWithLengthHalfOfLimit2,
            ];
            const actualHoverText = getHoverTextWithoutRange(possibleValues);
            const expectedHoverText = `\`\`\`fastbuild
Values:
'${strWithLengthHalfOfLimit1}'
…
\`\`\``;
            assert.strictEqual(actualHoverText.length <= 100000, true);
            assert.strictEqual(actualHoverText.length, expectedHoverText.length);
            assert.strictEqual(actualHoverText, expectedHoverText);
        });
    });
});
