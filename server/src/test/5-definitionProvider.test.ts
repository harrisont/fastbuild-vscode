import * as assert from 'assert';
import {
    DefinitionLink,
    DefinitionParams,
    Position,
    Range,
} from 'vscode-languageserver-protocol';
import * as definitionProvider from '../features/definitionProvider';
import { evaluateInputs } from './2-evaluator.test';

type UriStr = string;
type FileContents = string;

function createRange(startLine: number, startCharacter: number, endCharacter: number): Range {
    return {
        start: {
            line: startLine,
            character: startCharacter,
        },
        end: {
            line: startLine,
            character: endCharacter,
        },
    };
}

function createDefinition(referenceRange: Range, definitionRange: Range, definitionUri='file:///dummy.bff'): DefinitionLink {
    const definition: DefinitionLink = {
        originSelectionRange: referenceRange,
        targetUri: definitionUri,
        targetRange: definitionRange,
        targetSelectionRange: definitionRange,
    };
    return definition;
}

function getDefinitionMultiFile(thisFbuildUriStr: UriStr, inputs: Map<UriStr, FileContents>, position: Position): DefinitionLink[] | null {
    const evaluatedData = evaluateInputs(thisFbuildUriStr, inputs, true /*enableDiagnostics*/);
    const definitionParams: DefinitionParams = {
        textDocument: {
            uri: thisFbuildUriStr,
        },
        position,
    };
    return definitionProvider.getDefinition(definitionParams, evaluatedData);
}

function getDefinition(input: string, position: Position): DefinitionLink[] | null {
    const thisFbuildUri = 'file:///dummy.bff';
    return getDefinitionMultiFile(thisFbuildUri, new Map<UriStr, FileContents>([[thisFbuildUri, input]]), position);
}

describe('definitionProvider', () => {
    describe('getDefinition', () => {
        describe('variable', () => {
            it('no definition', () => {
                const input = `
.A = 1
                `;
                // The position of the `1` in `.A = 1`
                const lookupPosition = Position.create(1, 5);
                const actualReferences = getDefinition(input, lookupPosition);

                const expectedDefinitions = null;

                assert.deepStrictEqual(actualReferences, expectedDefinitions);
            });

            it('basic definition', () => {
                const input = `
.A = 1
Print( .A )
                `;
                // The position of the `.` in `Print( .A )`
                const lookupPosition = Position.create(2, 7);
                const actualReferences = getDefinition(input, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the `.A` in `Print( .A )`
                    // Definition: the `.A` in `.A = 1`
                    createDefinition(createRange(2, 7, 9), createRange(1, 0, 2)),
                ];

                assert.deepStrictEqual(actualReferences, expectedDefinitions);
            });

            it('variable defined in a loop', () => {
                const input = `
.Items = { 'a', 'b' }
ForEach( .A in .Items )
{
    Print( .A )
}
                `;
                // The position of the `.` in `Print( .A )`
                const lookupPosition = Position.create(4, 11);
                const actualReferences = getDefinition(input, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the `.A` in `Print( .A )`
                    // Definition: the `.A` in `ForEach( .A in .Items )`
                    createDefinition(createRange(4, 11, 13), createRange(2, 9, 11)),
                ];

                assert.deepStrictEqual(actualReferences, expectedDefinitions);
            });

            it('multiple variables at the same position', () => {
                const input = `
.A_B_C = 'foo'
.Middle = 'B'
Print( ."A_$Middle$_C" )
                `;
                // The position of the first `$` in `Print( ."A_$Middle$_C" )`
                const lookupPosition = Position.create(3, 11);
                const actualReferences = getDefinition(input, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the `$Middle$` in `Print( ."A_$Middle$_C" )`
                    // Definition: the `.Middle` in `.Middle = 'B'`
                    createDefinition(createRange(3, 11, 19), createRange(2, 0, 7)),
                    // Reference: the `."A_$Middle$_C"` in `Print( ."A_$Middle$_C" )`
                    // Definition: the `.A_B_C` in `.A_B_C = 'foo'`
                    createDefinition(createRange(3, 7, 22), createRange(1, 0, 6)),
                ];

                assert.deepStrictEqual(actualReferences, expectedDefinitions);
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
                const actualReferences = getDefinition(input, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the `.A` in `Print( .A )`
                    // Definition: the `.A` in `.A = 1`
                    createDefinition(createRange(5, 7, 9), createRange(2, 4, 6)),
                    // Reference: the `.A` in `Print( .A )`
                    // Definition: `Using( .MyStruct )`
                    createDefinition(createRange(5, 7, 9), createRange(4, 0, 18)),
                ];

                assert.deepStrictEqual(actualReferences, expectedDefinitions);
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
                const actualReferences = getDefinition(input, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the `.A` in `Print( .A )`
                    // Definition: the `.A` in `.A = 1`
                    createDefinition(createRange(17, 11, 13), createRange(2, 4, 6)),
                    // Reference: the `.A` in `Print( .A )`
                    // Definition: `Using( .MyStruct )`
                    createDefinition(createRange(17, 11, 13), createRange(16, 4, 22)),
                    // Reference: the `.A` in `Print( .A )`
                    // Definition: the `.A` in `.A = 2`
                    createDefinition(createRange(17, 11, 13), createRange(6, 4, 6)),
                ];

                assert.deepStrictEqual(actualReferences, expectedDefinitions);
            });
        });

        describe('include', () => {
            it('include definition', () => {
                const inputs =  new Map<UriStr, FileContents>([
                    [
                        'file:///fbuild.bff',
                        `
#include 'helper.bff'
                        `
                    ],
                    [
                        'file:///helper.bff',
                        `
                        `
                    ]
                ]);
                // The position of the first `'` in `#include 'helper.bff'`
                const lookupPosition = Position.create(1, 17);
                const actualReferences = getDefinitionMultiFile('file:///fbuild.bff', inputs, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the `'helper.bff'` in `#include 'helper.bff'`
                    // Definition: helper.bff
                    createDefinition(createRange(1, 9, 21), createRange(0, 0, 0), 'file:///helper.bff'),
                ];

                assert.deepStrictEqual(actualReferences, expectedDefinitions);
            });
        });
    });
});
