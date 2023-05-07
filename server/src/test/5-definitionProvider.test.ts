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
                const actualDefinitions = getDefinition(input, lookupPosition);

                const expectedDefinitions = null;

                assert.deepStrictEqual(actualDefinitions, expectedDefinitions);
            });

            it('basic definition', () => {
                const input = `
.A = 1
Print( .A )
                `;
                // The position of the `.` in `Print( .A )`
                const lookupPosition = Position.create(2, 7);
                const actualDefinitions = getDefinition(input, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the `.A` in `Print( .A )`
                    // Definition: the `.A` in `.A = 1`
                    createDefinition(createRange(2, 7, 9), createRange(1, 0, 2)),
                ];

                assert.deepStrictEqual(actualDefinitions, expectedDefinitions);
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
                const actualDefinitions = getDefinition(input, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the `.A` in `Print( .A )`
                    // Definition: the `.A` in `ForEach( .A in .Items )`
                    createDefinition(createRange(4, 11, 13), createRange(2, 9, 11)),
                ];

                assert.deepStrictEqual(actualDefinitions, expectedDefinitions);
            });

            it('multiple variables at the same position', () => {
                const input = `
.A_B_C = 'foo'
.Middle = 'B'
Print( ."A_$Middle$_C" )
                `;
                // The position of the first `$` in `Print( ."A_$Middle$_C" )`
                const lookupPosition = Position.create(3, 11);
                const actualDefinitions = getDefinition(input, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the `$Middle$` in `Print( ."A_$Middle$_C" )`
                    // Definition: the `.Middle` in `.Middle = 'B'`
                    createDefinition(createRange(3, 11, 19), createRange(2, 0, 7)),
                    // Reference: the `."A_$Middle$_C"` in `Print( ."A_$Middle$_C" )`
                    // Definition: the `.A_B_C` in `.A_B_C = 'foo'`
                    createDefinition(createRange(3, 7, 22), createRange(1, 0, 6)),
                ];

                assert.deepStrictEqual(actualDefinitions, expectedDefinitions);
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
                const actualDefinitions = getDefinition(input, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the `.A` in `Print( .A )`
                    // Definition: the `.A` in `.A = 1`
                    createDefinition(createRange(5, 7, 9), createRange(2, 4, 6)),
                    // Reference: the `.A` in `Print( .A )`
                    // Definition: `Using( .MyStruct )`
                    createDefinition(createRange(5, 7, 9), createRange(4, 0, 18)),
                ];

                assert.deepStrictEqual(actualDefinitions, expectedDefinitions);
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
                const actualDefinitions = getDefinition(input, lookupPosition);

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

                assert.deepStrictEqual(actualDefinitions, expectedDefinitions);
            });
        });

        describe('include', () => {
            it('basic definition', () => {
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
                const actualDefinitions = getDefinitionMultiFile('file:///fbuild.bff', inputs, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the `'helper.bff'` in `#include 'helper.bff'`
                    // Definition: helper.bff
                    createDefinition(createRange(1, 9, 21), createRange(0, 0, 0), 'file:///helper.bff'),
                ];

                assert.deepStrictEqual(actualDefinitions, expectedDefinitions);
            });
        });

        describe('target', () => {
            it('basic definition', () => {
                const input = `
TextFile('MyTarget1')
{
}

TextFile('MyTarget2')
{
}

Alias('MyTarget3')
{
    .Targets = { 'MyTarget1', 'MyTarget2' }
}
                `;

                // The position of the `M` of 'MyTarget2' in `.Targets = { 'MyTarget1', 'MyTarget2' }`
                const lookupPosition = Position.create(11, 31);
                const actualDefinitions = getDefinition(input, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the 'MyTarget2' in `.Targets = { 'MyTarget1', 'MyTarget2' }`
                    // Definition: the `'MyTarget2'` in `TextFile('MyTarget2')`
                    createDefinition(createRange(11, 30, 41), createRange(5, 9, 20)),
                ];

                assert.deepStrictEqual(actualDefinitions, expectedDefinitions);
            });

            it('multiple definitions', () => {
                const input = `
TextFile('MyTarget1')
{
}

TextFile('MyTarget2')
{
}

.TargetSuffixes = {'1', '2'}

Alias('MyTarget3')
{
    .Targets = {}
    ForEach(.Suffix in .TargetSuffixes)
    {
        ^Targets + 'MyTarget$Suffix$'
    }
}
                `;

                // The position of the `M` of 'MyTarget$Suffix$' in `^Targets + 'MyTarget$Suffix$'`
                const lookupPosition = Position.create(16, 20);
                const actualDefinitions = getDefinition(input, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the 'MyTarget$Suffix$' in `^Targets + 'MyTarget$Suffix$'`
                    // Definition: the `'MyTarget1'` in `TextFile('MyTarget1')`
                    createDefinition(createRange(16, 19, 37), createRange(1, 9, 20)),
                    // Reference: the 'MyTarget$Suffix$' in `^Targets + 'MyTarget$Suffix$'`
                    // Definition: the `'MyTarget2'` in `TextFile('MyTarget2')`
                    createDefinition(createRange(16, 19, 37), createRange(5, 9, 20)),
                ];

                assert.deepStrictEqual(actualDefinitions, expectedDefinitions);
            });

            it('duplicate definitions', () => {
                const input = `
TextFile('MyTarget1')
{
}

.DummyArray = {'1', '2'}

Alias('MyTarget2')
{
    .Targets = {}
    ForEach(.Suffix in .DummyArray)
    {
        ^Targets + 'MyTarget1'
    }
}
                `;

                // The position of the `M` of 'MyTarget1' in `^Targets + 'MyTarget1'`
                const lookupPosition = Position.create(12, 20);
                const actualDefinitions = getDefinition(input, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the 'MyTarget1' in `^Targets + 'MyTarget1'`
                    // Definition: the `'MyTarget1'` in `TextFile('MyTarget1')`
                    createDefinition(createRange(12, 19, 30), createRange(1, 9, 20)),
                ];

                assert.deepStrictEqual(actualDefinitions, expectedDefinitions);
            });

            it('reference in non-sibling, non-child scope', () => {
                const input = `
// Scope 1
{
    TextFile('MyTarget1')
    {
    }
}

// Scope 2 (non-sibling, non-child scope)
{
    Alias('MyTarget2')
    {
        .Targets = { 'MyTarget1' }
    }
}
                `;

                // The position of the `M` in `.Targets = { 'MyTarget1' }`
                const lookupPosition = Position.create(12, 22);
                const actualDefinitions = getDefinition(input, lookupPosition);

                const expectedDefinitions: DefinitionLink[] = [
                    // Reference: the `'MyTarget1'` in `.Targets = { 'MyTarget1' }`
                    // Definition: the `'MyTarget1'` in `TextFile('MyTarget1')`
                    createDefinition(createRange(12, 21, 32), createRange(3, 13, 24)),
                ];

                assert.deepStrictEqual(actualDefinitions, expectedDefinitions);
            });
        });
    });
});
