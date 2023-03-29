import * as assert from 'assert';

import {
    SourceRange,
    Struct,
    StructMember,
    Value,
    VariableDefinition,
} from '../evaluator';

import {
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

describe('hoversProvider', () => {
    describe('valueToString', () => {
        it('works for an integer', () => {
            const str = valueToString(1);
            assert.strictEqual('1', str);
        });

        it('works for a boolean', () => {
            const str = valueToString(true);
            assert.strictEqual('true', str);
        });

        it('works for a string', () => {
            const str = valueToString('Hello world');
            assert.strictEqual('"Hello world"', str);
        });

        it('works for a string with escape characters', () => {
            const str = valueToString('a \\ b');
            assert.strictEqual('"a \\ b"', str);
        });

        it('works for an empty array', () => {
            const value: Value = [];
            const str = valueToString(value);
            assert.strictEqual(
                `{}`,
                str);
        });

        it('works for an array of primitives', () => {
            const value = ['Hello', 'world'];
            const str = valueToString(value);
            assert.strictEqual(
                `{
    "Hello"
    "world"
}`,
                str);
        });

        it('works for an array of arrays', () => {
            const value = [
                [
                    0,
                    1,
                ],
                [
                    10,
                    11,
                ]
            ];
            const str = valueToString(value);
            assert.strictEqual(
                `{
    {
        0
        1
    }
    {
        10
        11
    }
}`,
                str);
        });

        it('works for an empty struct', () => {
            const value = new Struct();
            const str = valueToString(value);
            assert.strictEqual(
                `[]`,
                str);
        });

        it('works for a struct', () => {
            const dummyDefinition: VariableDefinition = { id: 1, range: createRange('file:///dummy.bff', 0, 0, 0, 0), name: '' };
            const value = Struct.from(Object.entries({
                A: new StructMember(1, dummyDefinition),
                B: new StructMember(2, dummyDefinition)
            }));
            const str = valueToString(value);
            assert.strictEqual(
                `[
    .A = 1
    .B = 2
]`,
                str);
        });

        it('works for a struct of structs', () => {
            const dummyDefinition: VariableDefinition = { id: 1, range: createRange('file:///dummy.bff', 0, 0, 0, 0), name: '' };
            const value = Struct.from(Object.entries({
                A: new StructMember(Struct.from(Object.entries({
                    A1: new StructMember(1, dummyDefinition),
                    A2: new StructMember(2, dummyDefinition)
                })), dummyDefinition),
                B: new StructMember(Struct.from(Object.entries({
                    B1: new StructMember(1, dummyDefinition),
                    B2: new StructMember(2, dummyDefinition)
                })), dummyDefinition)
            }));
            const str = valueToString(value);
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
});