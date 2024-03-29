import * as assert from 'assert';
import {
    Location,
    Position,
    ReferenceParams,
} from 'vscode-languageserver-protocol';
import * as referenceProvider from '../features/referenceProvider';
import { evaluateInput } from './2-evaluator.test';

function createLocation(startLine: number, startCharacter: number, endCharacter: number): Location {
    return {
        uri: 'file:///dummy.bff',
        range: {
            start: {
                line: startLine,
                character: startCharacter,
            },
            end: {
                line: startLine,
                character: endCharacter,
            },
        }
    };
}

function getReferences(input: string, position: Position): Location[] {
    const evaluatedData = evaluateInput(input, true /*enableDiagnostics*/);
    const referenceParams: ReferenceParams = {
        context: {
            includeDeclaration: true,
        },
        textDocument: {
            uri: 'file:///dummy.bff',
        },
        position,
    };
    return referenceProvider.getReferences(referenceParams, evaluatedData);
}

describe('referenceProvider', () => {
    describe('getReferences', () => {
        describe('variable', () => {
            it('no references', () => {
                const input = `
.A = 1
                `;
                // The position of the `1` in `.A = 1`
                const lookupPosition = Position.create(1, 5);
                const actualReferences = getReferences(input, lookupPosition);

                const expectedReferences: Location[] = [];

                assert.deepStrictEqual(actualReferences, expectedReferences);
            });

            it('basic reference', () => {
                const input = `
.A = 1
Print( .A )
                `;
                // The position of the `.` in `Print( .A )`
                const lookupPosition = Position.create(2, 7);
                const actualReferences = getReferences(input, lookupPosition);

                const expectedReferences: Location[] = [
                    // The `.A` in `.A = 1`
                    createLocation(1, 0, 2),
                    // The `.A` in `Print( .A )`
                    createLocation(2, 7, 9),
                ];

                assert.deepStrictEqual(actualReferences, expectedReferences);
            });

            it('struct field defined from a `Using`', () => {
                const input = `
.MyStruct = [
    .A = 1
]
Using( .MyStruct )
Print( .A )
                `;
                // The position of the `.` in `Print( .A )`
                const lookupPosition = Position.create(5, 7);
                const actualReferences = getReferences(input, lookupPosition);

                const expectedReferences: Location[] = [
                    // The `.A` in `.A = 1`
                    createLocation(2, 4, 6),
                    // The definition of A in `Using( .MyStruct )`
                    createLocation(4, 0, 18),
                    // The `.A` in `Print( .A )`
                    createLocation(5, 7, 9),
                ];

                assert.deepStrictEqual(actualReferences, expectedReferences);
            });

            it('struct field defined from a `Using` that overwrites an existing variable', () => {
                const input = `
.MyStruct = [
    .A = 1
]
.A = 2
Using( .MyStruct )
Print( .A )
                `;
                // The position of the `.` in `Print( .A )`
                const lookupPosition = Position.create(6, 7);
                const actualReferences = getReferences(input, lookupPosition);

                const expectedReferences: Location[] = [
                    // The `.A` in `.A = 2`
                    createLocation(4, 0, 2),
                    // The definition of A in `Using( .MyStruct )`
                    createLocation(5, 0, 18),
                    // The `.A` in `.A = 1`
                    createLocation(2, 4, 6),
                    // The `.A` in `Print( .A )`
                    createLocation(6, 7, 9),
                ];

                assert.deepStrictEqual(actualReferences, expectedReferences);
            });

            it('struct used by a `Using`', () => {
                const input = `
.MyStruct = [
    .A = 1
]
Using( .MyStruct )
Print( .A )
                `;
                // The position of the `.` in `Using( .MyStruct )`
                const lookupPosition = Position.create(4, 7);
                const actualReferences = getReferences(input, lookupPosition);

                // The position overlaps:
                //  * the visible reference to MyStruct
                //  * the invisible definition and reference to the struct's fields (A).
                // So getting references gets the references to both, and not just references to MyStruct.
                const expectedReferences: Location[] = [
                    // The `.A` in `.A = 1`
                    createLocation(2, 4, 6),
                    // The `.MyStruct` in `.MyStruct = [`
                    createLocation(1, 0, 9),
                    // The `.MyStruct` in `Using( .MyStruct )`
                    createLocation(4, 7, 16),
                    // The definition of A in `Using( .MyStruct )`
                    createLocation(4, 0, 18),
                    // The `.A` in `Print( .A )`
                    createLocation(5, 7, 9),
                ];

                assert.deepStrictEqual(actualReferences, expectedReferences);
            });

            it('struct field defined from a `Using` in a `ForEach`', () => {
                const input = `
.MyStruct1 = [
    .A = 1
]

.MyStruct2 = [
    .A = 2
]

.MyStructs = {
    .MyStruct1
    .MyStruct2
}

ForEach( .MyStruct in .MyStructs )
{
    Using( .MyStruct )
    Print( .A )
}
                `;
                // The position of the `.` in `Print( .A )`
                const lookupPosition = Position.create(17, 11);
                const actualReferences = getReferences(input, lookupPosition);

                const expectedReferences: Location[] = [
                    // The `.A` in `.A = 1`
                    createLocation(2, 4, 6),
                    // The `.A` in `.A = 2`
                    createLocation(6, 4, 6),
                    // The definition of A in `Using( .MyStruct )`
                    createLocation(16, 4, 22),
                    // The `.A` in `Print( .A )`
                    createLocation(17, 11, 13),
                ];

                assert.deepStrictEqual(actualReferences, expectedReferences);
            });

            it('struct used by a `Using` in a `ForEach`', () => {
                const input = `
.MyStruct1 = [
    .A = 1
]

.MyStruct2 = [
    .A = 2
]

.MyStructs = {
    .MyStruct1
    .MyStruct2
}

ForEach( .MyStruct in .MyStructs )
{
    Using( .MyStruct )
    Print( .A )
}
                `;
                // The position of the `.` in `Using( .MyStruct )`
                const lookupPosition = Position.create(16, 11);
                const actualReferences = getReferences(input, lookupPosition);

                // The position overlaps:
                //  * the visible reference to MyStruct
                //  * the invisible definition and reference to the struct's fields (A).
                // So getting references gets the references to both, and not just references to MyStruct.
                const expectedReferences: Location[] = [
                    // The `.A` in `.A = 1`
                    createLocation(2, 4, 6),
                    // The `.A` in `.A = 2`
                    createLocation(6, 4, 6),
                    // The `.MyStruct` in `ForEach( .MyStruct in .MyStructs )`
                    createLocation(14, 9, 18),
                    // The `.MyStruct` in `Using( .MyStruct )`
                    createLocation(16, 11, 20),
                    // The definition of A in `Using( .MyStruct )`
                    createLocation(16, 4, 22),
                    // The `.A` in `Print( .A )`
                    createLocation(17, 11, 13),
                ];

                assert.deepStrictEqual(actualReferences, expectedReferences);
            });
        });
    });
});
