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
        it('no definition', () => {
            const input = `
                .A = 1
            `;
            // The position of the `1` in `.A = 1`
            const lookupPosition = Position.create(1, 21);
            const actualReferences = getDefinition(input, lookupPosition);

            const expectedDefinitions = null;

            assert.deepStrictEqual(actualReferences, expectedDefinitions);
        });

        it('basic variable definition', () => {
            const input = `
                .A = 1
                Print( .A )
            `;
            // The position of the `.` in `Print( .A )`
            const lookupPosition = Position.create(2, 23);
            const actualReferences = getDefinition(input, lookupPosition);

            const expectedDefinitions: DefinitionLink[] = [
                // Reference: the `.A` in `Print( .A )`
                // Definition: the `.A` in `.A = 1`
                createDefinition(createRange(2, 23, 25), createRange(1, 16, 18)),
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
            const lookupPosition = Position.create(4, 27);
            const actualReferences = getDefinition(input, lookupPosition);

            const expectedDefinitions: DefinitionLink[] = [
                // Reference: the `.A` in `Print( .A )`
                // Definition: the `.A` in `ForEach( .A in .Items )`
                createDefinition(createRange(4, 27, 29), createRange(2, 25, 27)),
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
            const lookupPosition = Position.create(3, 27);
            const actualReferences = getDefinition(input, lookupPosition);

            const expectedDefinitions: DefinitionLink[] = [
                // Reference: the `$Middle$` in `Print( ."A_$Middle$_C" )`
                // Definition: the `.Middle` in `.Middle = 'B'`
                createDefinition(createRange(3, 27, 35), createRange(2, 16, 23)),
                // Reference: the `."A_$Middle$_C"` in `Print( ."A_$Middle$_C" )`
                // Definition: the `.A_B_C` in `.A_B_C = 'foo'`
                createDefinition(createRange(3, 23, 38), createRange(1, 16, 22)),
            ];

            assert.deepStrictEqual(actualReferences, expectedDefinitions);
        });

        it('struct field variable defined from a `Using`', () => {
            const input = `
                .MyStruct = [
                    .A = 1
                ]
                Using( .MyStruct )
                Print( .A )
            `;
            // The position of the `.` in `Print( .A )`
            const lookupPosition = Position.create(5, 23);
            const actualReferences = getDefinition(input, lookupPosition);

            const expectedDefinitions: DefinitionLink[] = [
                // Reference: the `.A` in `Print( .A )`
                // Definition: `Using( .MyStruct )`
                createDefinition(createRange(5, 23, 25), createRange(4, 16, 34)),
                // Reference: the `.A` in `Print( .A )`
                // Definition: the `.A` in `.A = 1`
                createDefinition(createRange(5, 23, 25), createRange(2, 20, 22)),
            ];

            assert.deepStrictEqual(actualReferences, expectedDefinitions);
        });

        it('struct field variable defined from a `Using` in a `ForEach`', () => {
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
            const lookupPosition = Position.create(17, 27);
            const actualReferences = getDefinition(input, lookupPosition);

            const expectedDefinitions: DefinitionLink[] = [
                // Reference: the `.A` in `Print( .A )`
                // Definition: `Using( .MyStruct )`
                createDefinition(createRange(17, 27, 29), createRange(16, 20, 38)),
                // Reference: the `.A` in `Print( .A )`
                // Definition: the `.A` in `.A = 1`
                createDefinition(createRange(17, 27, 29), createRange(2, 21, 22)),
                // Reference: the `.A` in `Print( .A )`
                // Definition: the `.A` in `.A = 2`
                createDefinition(createRange(17, 27, 29), createRange(6, 21, 22)),
            ];

            assert.deepStrictEqual(actualReferences, expectedDefinitions);
        });

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
            const lookupPosition = Position.create(1, 33);
            const actualReferences = getDefinitionMultiFile('file:///fbuild.bff', inputs, lookupPosition);

            const expectedDefinitions: DefinitionLink[] = [
                // Reference: the `'helper.bff'` in `#include 'helper.bff'`
                // Definition: helper.bff
                createDefinition(createRange(1, 33, 45), createRange(0, 0, 0), 'file:///helper.bff'),
            ];

            assert.deepStrictEqual(actualReferences, expectedDefinitions);
        });
    });
});
