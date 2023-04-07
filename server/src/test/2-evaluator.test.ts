import * as assert from 'assert';

// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

import * as os from 'os';
import * as path from 'path';

import {
    Maybe,
} from '../coreTypes';

import {
    ParseSourceRange,
    createRange as createParseRange,
} from '../parser';

import {
    evaluate,
    EvaluatedData,
    EvaluatedVariable,
    SourceRange,
    Struct,
    StructMember,
    TargetDefinition,
    TargetReference,
    Value,
    VariableDefinition,
    VariableReference,
} from '../evaluator';

import { IFileSystem } from '../fileSystem';
import { ParseDataProvider } from '../parseDataProvider';

type UriStr = string;
type FileContents = string;

class MockFileSystem implements IFileSystem {
    constructor(private readonly fileContents: Map<UriStr, FileContents>) {
    }

    fileExists(uri: vscodeUri.URI): boolean
    {
        return this.fileContents.has(uri.toString());
    }

    getFileContents(uri: vscodeUri.URI): Maybe<FileContents> {
        const contents = this.fileContents.get(uri.toString());
        if (contents === undefined) {
            return Maybe.error(new Error(`MockFileSystem has no data for URI '${uri}'`));
        }
        return Maybe.ok(contents);
    }
}

function createRange(startLine: number, startCharacter: number, endLine: number, endCharacter: number): SourceRange {
    return createFileRange('file:///dummy.bff', startLine, startCharacter, endLine, endCharacter);
}

function createFileRange(uri: UriStr, startLine: number, startCharacter: number, endLine: number, endCharacter: number): SourceRange {
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

function evaluateInputs(thisFbuildUriStr: UriStr, inputs: Map<UriStr, FileContents>, enableDiagnostics: boolean): EvaluatedData {
    const fileSystem = new MockFileSystem(inputs);
    const parseDataProvider = new ParseDataProvider(
        fileSystem,
        { enableDiagnostics, includeCodeLocationInError: true }
    );
    const thisFbuildUri = vscodeUri.URI.parse(thisFbuildUriStr);
    const maybeParseData = parseDataProvider.getParseData(thisFbuildUri);
    if (maybeParseData.hasError) {
        throw maybeParseData.getError();
    }
    const parseData = maybeParseData.getValue();
    const evaluatedStatementsAndMaybeError = evaluate(parseData, thisFbuildUriStr, fileSystem, parseDataProvider);
    if (evaluatedStatementsAndMaybeError.error !== null) {
        throw evaluatedStatementsAndMaybeError.error;
    }
    return evaluatedStatementsAndMaybeError.data;
}

function evaluateInput(input: FileContents, enableDiagnostics: boolean): EvaluatedData {
    const thisFbuildUri = 'file:///dummy.bff';
    return evaluateInputs(thisFbuildUri, new Map<UriStr, FileContents>([[thisFbuildUri, input]]), enableDiagnostics);
}

// Compares the parsed evaluatedVariables, but only the value, not the range.
function assertEvaluatedVariablesValueEqual(input: FileContents, expectedValues: Value[]): void {
    const result = evaluateInput(input, true /*enableDiagnostics*/);
    const actualValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
    assert.deepStrictEqual(actualValues, expectedValues);
}

function getParseSourceRangeString(range: ParseSourceRange): string {
    return `${range.start.line}:${range.start.character} - ${range.end.line}:${range.end.character}`;
}

function assertParseSyntaxError(input: string, expectedErrorMessage: string, expectedRange: ParseSourceRange): void {
    // Disable diagnostics because we expect it to error so it's not helpful to get the diagnostic logs.
    const enableDiagnostics = false;

    assert.throws(
        () => evaluateInput(input, enableDiagnostics),
        actualError => {
            assert.strictEqual(actualError.name, 'ParseSyntaxError', `Expected a ParseSyntaxError exception but got ${actualError}:\n\n${actualError.stack}`);
            assert(actualError.message === expectedErrorMessage, `Got error message <${actualError.message}> but expected <${expectedErrorMessage}>`);
            assert.deepStrictEqual(actualError.range, expectedRange, `Expected the error range to be ${getParseSourceRangeString(expectedRange)} but it is ${getParseSourceRangeString(actualError.range)}`);
            return true;
        }
    );
}

function assertEvaluationError(input: string, expectedErrorMessage: string, expectedRange: ParseSourceRange): void {
    // Disable diagnostics because we expect it to error so it's not helpful to get the diagnostic logs.
    const enableDiagnostics = false;

    assert.throws(
        () => evaluateInput(input, enableDiagnostics),
        actualError => {
            assert.strictEqual(actualError.name, 'EvaluationError', `Expected an EvaluationError exception but got ${actualError}:\n\n${actualError.stack}`);
            assert.strictEqual(actualError.message, expectedErrorMessage, `Error message was different than expected`);
            // Create a `ParseSourceRange` out of the `SourceRange` in order to drop the file URI.
            const actualRange = createParseRange(actualError.range.start.line, actualError.range.start.character, actualError.range.end.line, actualError.range.end.character);
            assert.deepStrictEqual(actualRange, expectedRange, `Expected the error range to be ${getParseSourceRangeString(expectedRange)} but it is ${getParseSourceRangeString(actualRange)}`);
            return true;
        }
    );
}

describe('evaluator', () => {
    describe('evaluatedVariables value', () => {
        it('should be detected in a string with a variable', () => {
            const input = `
                .MyVar = 'MyValue'
                Print('pre-$MyVar$-post')
            `;
            assertEvaluatedVariablesValueEqual(input, ['MyValue', 'MyValue']);
        });

        it('should be detected in a string with multiple variables', () => {
            const input = `
                .MyVar1 = 'MyValue1'
                .MyVar2 = 'MyValue2'
                Print('pre-$MyVar1$-$MyVar2$-post')
            `;
            assertEvaluatedVariablesValueEqual(input, ['MyValue1', 'MyValue2', 'MyValue1', 'MyValue2']);
        });

        it('should be detected in the RHS when assigning the value of another variable', () => {
            const input = `
                .MyVar = 1
                .Copy = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [1, 1, 1]);
        });

        it('should be detected in the RHS when assigning the value of another variable in the parent scope', () => {
            const input = `
                .MyVar = 1
                { // Start scope
                    Print(^MyVar)
                } // End scope
            `;
            assertEvaluatedVariablesValueEqual(input, [1, 1]);
        });

        it('should be able to read a variable in a direct parent scope', () => {
            const input = `
                .Var1 = 1
                {// Start scope
                    Print(.Var1)
                }// End scope
            `;
            assertEvaluatedVariablesValueEqual(input, [1, 1]);
        });

        it('should be able to read a variable in a grandparent scope (current scope reference)', () => {
            const input = `
                .Var1 = 1
                {
                    {
                        Print(.Var1)
                    }
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [1, 1]);
        });

        it('should be able to read a variable in a grandparent scope (parent scope reference)', () => {
            const input = `
                .Var1 = 1
                {
                    {
                        Print(^Var1)
                    }
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [1, 1]);
        });

        it('should allow variables with the same name in different scopes', () => {
            const input = `
                {
                    .Var1 = 1
                    Print(.Var1)
                }
                {
                    .Var1 = 2
                    Print(.Var1)
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [1, 1, 2, 2]);
        });

        it('should allow a variable to shadow a variable with the same name in a parent scope', () => {
            const input = `
                .Var = 1
                {
                    .Var = 2
                    Print(.Var)
                }
                Print(.Var)
            `;
            assertEvaluatedVariablesValueEqual(input, [1, 2, 2, 1]);
        });

        it('should not be able to read a variable in a child scope', () => {
            const input = `
                {
                    .Var1 = 1
                }
                Print(.Var1)
            `;
            const expectedErrorMessage = 'Referencing variable "Var1" that is not defined in the current scope or any of the parent scopes.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(4, 22, 4, 27));
        });

        it('should be able to write an existing variable in a direct parent scope', () => {
            const input = `
                .Var1 = 1
                {
                    ^Var1 = 2
                }
                Print(.Var1)
            `;
            assertEvaluatedVariablesValueEqual(input, [1, 2, 2]);
        });

        it('should be able to write an existing variable in a grandparent scope', () => {
            const input = `
                .Var1 = 1
                {
                    {
                        ^Var1 = 2
                    }
                }
                Print(.Var1)
            `;
            assertEvaluatedVariablesValueEqual(input, [1, 2, 2]);
        });

        it('should not be able to read a non-existant variable in a parent scope', () => {
            const input = `
                {
                    .Var1 = 0
                    Print(^Var1)
                }
            `;
            const expectedErrorMessage = 'Referencing variable "Var1" in a parent scope that is not defined in any parent scope.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 26, 3, 31));
        });

        it('should not be able to write a non-existant variable in a parent scope', () => {
            const input = `
                {
                    .Var1 = 0
                    ^Var1 = 1
                }
            `;
            const expectedErrorMessage = 'Referencing variable "Var1" in a parent scope that is not defined in any parent scope.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 20, 3, 25));
        });

        it('should not be able to read a non-existant variable from the parent of the root scope ', () => {
            const input = `
                .Var1 = 0
                Print(^Var1)
            `;
            const expectedErrorMessage = 'Cannot access parent scope because there is no parent scope.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 22, 2, 27));
        });

        it('should not be able to write a non-existant variable from the parent of the root scope ', () => {
            const input = `
                .Var1 = 0
                ^Var1 = 1
            `;
            const expectedErrorMessage = 'Cannot access parent scope because there is no parent scope.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 21));
        });

        it(`writing to a parent variable that has the same name as a variable in its parent's scope should only update the shadowing variable`, () => {
            const input = `
                .Var1 = 1
                {
                    .Var1 = 2
                    {
                        Print( .Var1)
                        ^Var1 = 3
                    }
                    Print( .Var1)
                }
                Print( .Var1)
            `;
            assertEvaluatedVariablesValueEqual(input, [1, 2, 2, 3, 3, 1]);
        });

        it('should correctly evaulate an empty string literal', () => {
            const input = `
                .MyVar = ''
                Print(.MyVar)
            `;
            assertEvaluatedVariablesValueEqual(input, ['', '']);
        });

        it('should evaluate an empty array', () => {
            const input = `
                .MyVar = {}
                Print(.MyVar)
            `;
            assertEvaluatedVariablesValueEqual(input, [
                [],
                [],
            ]);
        });

        it('should evaluate an array of string literals', () => {
            const input = `
                .MyVar = {
                    'thing1'
                    'thing2'
                }
                Print(.MyVar)
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['thing1', 'thing2'],
                ['thing1', 'thing2'],
            ]);
        });

        it('assigning a String to an ArrayOfStrings in the current scope results in an ArrayOfStrings with a single item: the RHS String', () => {
            const input = `
                .MyVar = { 'old1', 'old2' }
                .MyVar = 'new'
                Print(.MyVar)
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['old1', 'old2'],
                ['new'],
                ['new'],
            ]);
        });

        it('assigning a String to an ArrayOfStrings in a parent scope results in an ArrayOfStrings with a single item: the RHS String', () => {
            const input = `
                .MyVar = { 'old1', 'old2' }
                {
                    ^MyVar = 'new'
                }
                Print(.MyVar)
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['old1', 'old2'],
                ['new'],
                ['new'],
            ]);
        });

        it('assigning a String to an empty Array results in an ArrayOfStrings with a single item: the RHS String', () => {
            const input = `
                .MyVar = {}
                .MyVar = 'new'
                Print(.MyVar)
            `;
            assertEvaluatedVariablesValueEqual(input, [
                [],
                ['new'],
                ['new'],
            ]);
        });

        it('assigning an ArrayOfStrings to an empty Array results in an ArrayOfStrings with the RHS ArrayOfStrings', () => {
            const input = `
                .MyVar = {}
                .MyVar = { 'new' }
                Print(.MyVar)
            `;
            assertEvaluatedVariablesValueEqual(input, [
                [],
                ['new'],
                ['new'],
            ]);
        });

        it('assigning an empty Array to an empty Array results in an ArrayOfStrings with the RHS ArrayOfStrings', () => {
            const input = `
                .MyVar = {}
                .MyVar = {}
                Print(.MyVar)
            `;
            assertEvaluatedVariablesValueEqual(input, [
                [],
                [],
                [],
            ]);
        });

        it('assigning a Number to an empty Array errors', () => {
            const input = `
                .MyVar = {}
                .MyVar = 1
            `;
            const expectedErrorMessage = 'Cannot assign an Integer to an Array. Arrays can only contain Strings or Structs.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 25, 2, 26));
        });

        it('assigning a String an ArrayOfStructs errors', () => {
            const input = `
                .MyStruct = []
                .MyVar = { .MyStruct }
                .MyVar = 'new'
            `;
            const expectedErrorMessage = 'Cannot assign a String to an Array of Structs.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 25, 3, 30));
        });

        it('should evaluate an array of string templates', () => {
            const input = `
                .Type = 'thing'
                .MyVar = {
                    '$Type$1'
                    '$Type$2'
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'thing',
                'thing',
                'thing',
                ['thing1', 'thing2'],
            ]);
        });

        it('should evaluate an array of evaluated variables', () => {
            const input = `
                .Var1 = 'thing1'
                .Var2 = 'thing2'
                .MyVar = {
                    .Var1
                    .Var2
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'thing1',
                'thing2',
                'thing1',
                'thing2',
                ['thing1', 'thing2'],
            ]);
        });

        it('should error on an array of booleans', () => {
            const input = `
                .MyVar = { true }
            `;
            const expectedErrorMessage = 'Cannot have an Array of Booleans. Only Arrays of Strings and Arrays of Structs are allowed.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 27, 1, 31));
        });

        it('should error on an array of integers', () => {
            const input = `
                .MyVar = { 123 }
            `;
            const expectedErrorMessage = 'Cannot have an Array of Integers. Only Arrays of Strings and Arrays of Structs are allowed.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 27, 1, 30));
        });

        it('should error on heterogenous arrays (variation 1: string first)', () => {
            const input = `
                .MyStruct = [ .Value = 1 ]
                .MyVar = { 'a', .MyStruct }
            `;
            const expectedErrorMessage = 'All values in an Array must have the same type, but the first item is a String and this item is a Struct';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 32, 2, 41));
        });

        it('should error on heterogenous arrays (variation 1: struct first)', () => {
            const input = `
                .MyStruct = [ .Value = 1 ]
                .MyVar = { .MyStruct, 'a' }
            `;
            const expectedErrorMessage = 'All values in an Array must have the same type, but the first item is a Struct and this item is a String';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 38, 2, 41));
        });

        it('an array in an array should expand its items', () => {
            const input = `
                .Parts1 = { 'thing1', 'thing2' }
                .Parts2 = 'thing3'
                .Parts3 = { 'thing4' }
                .Combined = {
                    .Parts1
                    .Parts2
                    .Parts3
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['thing1', 'thing2'],
                'thing3',
                ['thing4'],
                ['thing1', 'thing2'],
                'thing3',
                ['thing4'],
                ['thing1', 'thing2', 'thing3', 'thing4'],
            ]);
        });

        it('should evaluate an empty struct', () => {
            const input = `
                .MyVar = []
            `;
            assertEvaluatedVariablesValueEqual(input, [
                new Struct(),
            ]);
        });

        it('should evaluate a basic struct', () => {
            const input = `
                .MyVar = [
                    .MyBool = true
                    .MyInt = 123
                    .MyStr = 'Hello world!'
                ]
            `;
            const myVarMyBoolDefinition: VariableDefinition = { id: 1, range: createRange(2, 20, 2, 27), name: 'MyBool' };
            const myVarMyIntDefinition: VariableDefinition = { id: 2, range: createRange(3, 20, 3, 26), name: 'MyInt' };
            const myVarMyStrDefinition: VariableDefinition = { id: 3, range: createRange(4, 20, 4, 26), name: 'MyStr' };
            assertEvaluatedVariablesValueEqual(input, [
                true,
                123,
                'Hello world!',
                Struct.from(Object.entries({
                    MyBool: new StructMember(true, myVarMyBoolDefinition),
                    MyInt: new StructMember(123, myVarMyIntDefinition),
                    MyStr: new StructMember('Hello world!', myVarMyStrDefinition),
                }))
            ]);
        });

        it('should evaluate a struct with an evaluated variable', () => {
            const input = `
                .B = 1
                .MyVar = [
                    .A = .B
                ]
            `;
            const myVarADefinition: VariableDefinition = { id: 2, range: createRange(3, 20, 3, 22), name: 'A' };
            assertEvaluatedVariablesValueEqual(input, [
                1,
                1,
                1,
                Struct.from(Object.entries({
                    A: new StructMember(1, myVarADefinition),
                }))
            ]);
        });

        it('should evaluate a struct with multiple evaluated variables', () => {
            const input = `
                .B1 = 1
                .B2 = 2
                .MyVar = [
                    .A1 = .B1
                    .A2 = .B2
                ]
            `;
            const myVarA1Definition: VariableDefinition = { id: 3, range: createRange(4, 20, 4, 23), name: 'A1' };
            const myVarA2Definition: VariableDefinition = { id: 4, range: createRange(5, 20, 5, 23), name: 'A2' };
            assertEvaluatedVariablesValueEqual(input, [
                1,
                2,
                1,
                1,
                2,
                2,
                Struct.from(Object.entries({
                    A1: new StructMember(1, myVarA1Definition),
                    A2: new StructMember(2, myVarA2Definition),
                }))
            ]);
        });

        it('should evaluate a struct containing an array', () => {
            const input = `
                .MyVar = [
                    .MyArray = {'a', 'b', 'c'}
                ]
            `;
            const myVarMyArrayDefinition: VariableDefinition = { id: 1, range: createRange(2, 20, 2, 28), name: 'MyArray' };
            assertEvaluatedVariablesValueEqual(input, [
                ['a', 'b', 'c'],
                Struct.from(Object.entries({
                    MyArray: new StructMember(['a', 'b', 'c'], myVarMyArrayDefinition),
                }))
            ]);
        });

        it('should evaluate a struct containing a struct', () => {
            const input = `
                .MyVar = [
                    .MyStruct = [
                        .MyInt = 1
                    ]
                ]
            `;
            const myVarMyStructMyIntDefinition: VariableDefinition = { id: 1, range: createRange(3, 24, 3, 30), name: 'MyInt' };
            const myVarMyStructDefinition: VariableDefinition = { id: 2, range: createRange(2, 20, 2, 29), name: 'MyStruct' };
            const expectedMyStructValue = Struct.from(Object.entries({
                MyInt: new StructMember(1, myVarMyStructMyIntDefinition),
            }));
            assertEvaluatedVariablesValueEqual(input, [
                1,
                expectedMyStructValue,
                Struct.from(Object.entries({
                    MyStruct: new StructMember(expectedMyStructValue, myVarMyStructDefinition),
                }))
            ]);
        });

        it('should evaluate an array of structs', () => {
            const input = `
                .Struct1 = [.MyInt = 1]
                .Struct2 = [.MyInt = 2]
                .MyVar = {
                    .Struct1
                    .Struct2
                }
            `;
            const struct1MyIntDefinition: VariableDefinition = { id: 1, range: createRange(1, 28, 1, 34), name: 'MyInt' };
            const struct2MyIntDefinition: VariableDefinition = { id: 3, range: createRange(2, 28, 2, 34), name: 'MyInt' };
            assertEvaluatedVariablesValueEqual(input, [
                1,
                Struct.from(Object.entries({
                    MyInt: new StructMember(1, struct1MyIntDefinition),
                })),
                2,
                Struct.from(Object.entries({
                    MyInt: new StructMember(2, struct2MyIntDefinition),
                })),
                Struct.from(Object.entries({
                    MyInt: new StructMember(1, struct1MyIntDefinition),
                })),
                Struct.from(Object.entries({
                    MyInt: new StructMember(2, struct2MyIntDefinition),
                })),
                [
                    Struct.from(Object.entries({
                        MyInt: new StructMember(1, struct1MyIntDefinition),
                    })),
                    Struct.from(Object.entries({
                        MyInt: new StructMember(2, struct2MyIntDefinition),
                    })),
                ]
            ]);
        });

        it('should error an an array of struct literals', () => {
            const input = `
                .MyVar = { [.MyInt = 1] }
            `;
            const expectedErrorMessage = 'Cannot have an Array of literal Structs. Use an Array of evaluated variables instead.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 27, 1, 39));
        });

        it('should evaluate dynamic variable names on the RHS in the current scope', () => {
            const input = `
                .A_B_C = 'foo'
                .Middle = 'B'
                .MyVar = ."A_$Middle$_C"
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'foo',
                'B',
                'B',
                'foo',
                'foo',
            ]);
        });

        it('should evaluate dynamic variable names on the RHS in the parent scope', () => {
            const input = `
                .A_B_C = 'foo'
                .Middle = 'B'
                {
                    .MyVar = ^"A_$Middle$_C"
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'foo',
                'B',
                'B',
                'foo',
                'foo',
            ]);
        });

        it('should evaluate dynamic variable names on the LHS in the current scope', () => {
            const input = `
                .Middle = 'B'
                ."A_$Middle$_C" = 'foo'
                Print(.A_B_C)
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'B',
                'B',
                'foo',
                'foo',
            ]);
        });

        it('should evaluate dynamic variable names on the LHS in the parent scope', () => {
            const input = `
                .A_B_C = ''
                .Middle = 'B'
                {
                    ^"A_$Middle$_C" = 'foo'
                }
                Print(.A_B_C)
            `;
            assertEvaluatedVariablesValueEqual(input, [
                '',
                'B',
                'B',
                'foo',
                'foo',
            ]);
        });

        it('_CURRENT_BFF_DIR_ is a builtin variable that evaluates to the relative path to the directory containing the current bff file being parsed', () => {
            const result = evaluateInputs('file:///some/path/fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///some/path/fbuild.bff',
                    `
                        Print( ._CURRENT_BFF_DIR_ )
                        #include 'animals.bff'
                        Print( ._CURRENT_BFF_DIR_ )
                    `
                ],
                [
                    'file:///some/path/animals.bff',
                    `
                        Print( ._CURRENT_BFF_DIR_ )
                        #include 'animals/mammals/dog.bff'
                        Print( ._CURRENT_BFF_DIR_ )
                    `
                ],
                [
                    'file:///some/path/animals/mammals/dog.bff',
                    `
                        Print( ._CURRENT_BFF_DIR_ )
                    `
                ],
            ]), true /*enableDiagnostics*/);

            assert.deepStrictEqual(result.evaluatedVariables, [
                {
                    value: '',
                    range: createFileRange('file:///some/path/fbuild.bff', 1, 31, 1, 49),
                },
                {
                    value: '',
                    range: createFileRange('file:///some/path/animals.bff', 1, 31, 1, 49),
                },
                {
                    value: `animals${path.sep}mammals`,
                    range: createFileRange('file:///some/path/animals/mammals/dog.bff', 1, 31, 1, 49),
                },
                {
                    value: '',
                    range: createFileRange('file:///some/path/animals.bff', 3, 31, 3, 49),
                },
                {
                    value: '',
                    range: createFileRange('file:///some/path/fbuild.bff', 3, 31, 3, 49),
                },
            ]);
        });

        // _WORKING_DIR_ is supposed to evaluate to the working directory when fbuild was launched, but since we cannot know that,
        // we use the directory of the root bff file as a likely proxy.
        it('_WORKING_DIR_ is a builtin variable that evaluates to the absolute path to the directory of the root bff file', () => {
            const result = evaluateInputs('file:///some/path/fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///some/path/fbuild.bff',
                    `
                        Print( ._WORKING_DIR_ )
                        #include 'animals.bff'
                        Print( ._WORKING_DIR_ )
                    `
                ],
                [
                    'file:///some/path/animals.bff',
                    `
                        Print( ._WORKING_DIR_ )
                    `
                ],
            ]), true /*enableDiagnostics*/);

            const root_fbuild_dir = `${path.sep}some${path.sep}path`;

            assert.deepStrictEqual(result.evaluatedVariables, [
                {
                    value: root_fbuild_dir,
                    range: createFileRange('file:///some/path/fbuild.bff', 1, 31, 1, 45),
                },
                {
                    value: root_fbuild_dir,
                    range: createFileRange('file:///some/path/animals.bff', 1, 31, 1, 45),
                },
                {
                    value: root_fbuild_dir,
                    range: createFileRange('file:///some/path/fbuild.bff', 3, 31, 3, 45),
                },
            ]);
        });

        // We need to use a placeholder because we don't know the actual version of FASTBuild being run.
        it('_FASTBUILD_VERSION_STRING_ is a builtin variable that evaluates to (a placeholder for) the current FASTBuild version as a string', () => {
            const input = `
                Print( ._FASTBUILD_VERSION_STRING_ )
            `;
            assertEvaluatedVariablesValueEqual(input, ['vPlaceholderFastBuildVersionString']);
        });

        // We need to use a placeholder because we don't know the actual version of FASTBuild being run.
        it('_FASTBUILD_VERSION_ is a builtin variable that evaluates to (a placeholder for) the current FASTBuild version as an integer', () => {
            const input = `
                Print( ._FASTBUILD_VERSION_ )
            `;
            assertEvaluatedVariablesValueEqual(input, [-1]);
        });
    });

    describe('addition', () => {
        it('should work on adding an integer', () => {
            const input = `
                .MySum = 1
                .MySum + 2
            `;
            assertEvaluatedVariablesValueEqual(input, [
                1,
                3,
            ]);
        });

        it('should work on adding a string literal', () => {
            const input = `
                .MyMessage = 'hello'
                .MyMessage + ' world'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'hello',
                'hello world'
            ]);
        });

        it('should work on adding a string literal to a variable in the parent scope', () => {
            const input = `
                .MyMessage = 'hello'
                {
                    ^MyMessage + ' world'
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'hello',
                'hello world',
            ]);
        });

        it('should work on adding a string with a variable', () => {
            const input = `
                .MyName = 'Bobo'
                .MyMessage = 'hello'
                .MyMessage + .MyName
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Bobo',
                'hello',
                'Bobo',
                'helloBobo',
            ]);
        });

        it('should work on adding a string with a string template', () => {
            const input = `
                .MyName = 'Bobo'
                .MyMessage = 'hello'
                .MyMessage + ' $MyName$'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Bobo',
                'hello',
                'Bobo',
                'hello Bobo'
            ]);
        });

        it('adding a string literal should use the last referenced variable if none is specified', () => {
            const input = `
                .MyMessage = 'hello'
                            + ' world'
            `;
            assertEvaluatedVariablesValueEqual(input, ['hello world']);
        });

        it('adding a string literal should use the last referenced variable if none is specified ("+" on same line)', () => {
            const input = `
                .MyMessage = 'hello' +
                                ' world'
            `;
            assertEvaluatedVariablesValueEqual(input, ['hello world']);
        });

        it('adding mulitple string literals should use the last referenced variable if none is specified', () => {
            const input = `
                .MyMessage = 'hello'
                            + ' world'
                            + '!'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'hello world!',
            ]);
        });

        it('adding an evaluated variable should use the last referenced variable if none is specified', () => {
            const input = `
                .MyVar = 'world'
                .MyMessage = 'hello '
                            + .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'world',
                'hello world',
                'world',
            ]);
        });

        it('adding mulitple evaluated variables should use the last referenced variable if none is specified', () => {
            const input = `
                .MyVar1 = 'world'
                .MyVar2 = '!'
                .MyMessage = 'hello '
                            + .MyVar1
                            + .MyVar2
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'world',
                '!',
                'hello world!',
                'world',
                '!',
            ]);
        });

        it('should work on adding a string literal to a variable in the parent scope', () => {
            const input = `
                .MyMessage = 'hello'
                {
                    ^MyMessage + ' world'
                }
                Print(.MyMessage)
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'hello',
                'hello world',
                'hello world'
            ]);
        });

        it('should fail when adding to a non-existent, current-scope variable', () => {
            const input = `
                {
                    .MyMessage + ' world'
                }
            `;
            const expectedErrorMessage = 'Referencing varable "MyMessage" that is not defined in the current scope.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 20, 2, 30));
        });

        it('should fail when adding to a non-existent, parent-scope variable', () => {
            const input = `
                {
                    .MyMessage = 'hello'
                    ^MyMessage + ' world'
                }
            `;
            const expectedErrorMessage = 'Referencing variable "MyMessage" in a parent scope that is not defined in any parent scope.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 20, 3, 30));
        });

        it('adding to a current-scope non-existant, parent-scope existant, current-scope variable defines it in the current scope to be the sum', () => {
            const input = `
                .MyMessage = 'hello'
                {
                    .MyMessage + ' world'
                }
                Print( .MyMessage )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'hello',
                'hello world',
                'hello',
            ]);
        });

        // Similar to the above test, but in a loop
        it('in a loop, adding to a current-scope non-existant, parent-scope existant, current-scope variable redefines it each time in the current scope to be the sum', () => {
            const input = `
                .MyArray = {'a', 'b', 'c'}
                .MyMessage = 'Base'
                ForEach( .Item in .MyArray )
                {
                    .MyMessage + '-$Item$'
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['a', 'b', 'c'],
                'Base',
                ['a', 'b', 'c'],
                'a', 'a', 'Base-a',
                'b', 'b', 'Base-b',
                'c', 'c', 'Base-c',
            ]);
        });

        it('adding to a current-scope non-existant, parent-scope existant, current-scope struct variable defines it in the current scope to be the sum', () => {
            const input = `
                .MyMessage = 'hello'
                .MyStruct = [
                    .MyMessage + ' world'
                ]
                Print( .MyMessage )
            `;
            const myStructMyMessageDefinition: VariableDefinition = { id: 2, range: createRange(3, 20, 3, 30), name: 'MyMessage' };
            assertEvaluatedVariablesValueEqual(input, [
                'hello',
                'hello world',
                Struct.from(Object.entries({
                    MyMessage: new StructMember('hello world', myStructMyMessageDefinition),
                })),
                'hello',
            ]);
        });

        it('should work on adding an item to an array', () => {
            const input = `
                .MyVar = {}
                .MyVar + 'cow'
                .MyVar + 'moo'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                [],
                ['cow'],
                ['cow', 'moo'],
            ]);
        });

        it('should work on inline adding an item to an array', () => {
            const input = `
                .MyVar = {} + 'cow'
            `;
            assertEvaluatedVariablesValueEqual(input, [['cow']]);
        });

        it('should work on adding an array to an array', () => {
            const input = `
                .MyVar = {'a'}
                .MyVar + {'b'}
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['a'],
                ['a', 'b']
            ]);
        });

        it('should work on inline adding an array to an array', () => {
            const input = `
                .MyVar = {'a'} + {'b'} + {'c'}
            `;
            assertEvaluatedVariablesValueEqual(input, [['a', 'b', 'c']]);
        });

        it('should work on adding an array with an evaluated variable to an array', () => {
            const input = `
                .B = 'b'
                .MyVar = {'a'}
                .MyVar + {.B, 'c'}
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'b',
                ['a'],
                'b',
                ['a', 'b', 'c']
            ]);
        });

        it('should work on inline adding an array with an evaluated variable to an array', () => {
            const input = `
                .B = 'b'
                .MyVar = {'a'} + { .B , 'c'}
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'b',
                'b',
                ['a', 'b', 'c']
            ]);
        });

        it('should work on adding a struct to a struct', () => {
            const input = `
                .Struct1 = [
                    .A=0
                    .B=2
                ]
                .Struct2 = [
                    .A=1
                    .C=3
                ]
                .MyVar = .Struct1 + .Struct2
            `;
            const struct1ADefinition: VariableDefinition = { id: 1, range: createRange(2, 20, 2, 22), name: 'A' };
            const struct1BDefinition: VariableDefinition = { id: 2, range: createRange(3, 20, 3, 22), name: 'B' };
            const struct1 = Struct.from(Object.entries({
                A: new StructMember(0, struct1ADefinition),
                B: new StructMember(2, struct1BDefinition),
            }));
            const struct2ADefinition: VariableDefinition = { id: 4, range: createRange(6, 20, 6, 22), name: 'A' };
            const struct2CDefinition: VariableDefinition = { id: 5, range: createRange(7, 20, 7, 22), name: 'C' };
            const struct2 = Struct.from(Object.entries({
                A: new StructMember(1, struct2ADefinition),
                C: new StructMember(3, struct2CDefinition),
            }));
            assertEvaluatedVariablesValueEqual(input, [
                0,
                2,
                struct1,
                1,
                3,
                struct2,
                struct1,
                struct2,
                Struct.from(Object.entries({
                    A: new StructMember(1, struct2ADefinition),
                    B: new StructMember(2, struct1BDefinition),
                    C: new StructMember(3, struct2CDefinition),
                }))
            ]);
        });

        it('should error on adding anything other than an integer (string) to an integer', () => {
            const input = `
                .LHS = 123
                .LHS + 'hi'
            `;
            const expectedErrorMessage = 'Cannot add a String to an Integer. Can only add an Integer.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 27));
        });

        it('should error on adding anything other than an integer (boolean) to an integer', () => {
            const input = `
                .LHS = 123
                .LHS + true
            `;
            const expectedErrorMessage = 'Cannot add a Boolean to an Integer. Can only add an Integer.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 27));
        });

        it('should error on adding anything other than an integer (struct) to an integer (via evaluated variable)', () => {
            const input = `
                .LHS = 123
                .RHS = [ .A = 1 ]
                .LHS + .RHS
            `;
            const expectedErrorMessage = 'Cannot add a Struct to an Integer. Can only add an Integer.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 16, 3, 27));
        });

        it('should error on inline adding anything other than an integer (boolean) to an integer', () => {
            const input = `
                .LHS = 123
                     + true
            `;
            const expectedErrorMessage = 'Cannot add a Boolean to an Integer. Can only add an Integer.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 21, 2, 27));
        });

        it('should error on inline adding anything other than an integer (string) to an integer (via evaluated variable)', () => {
            const input = `
                .LHS = 123
                .RHS = 'hi'
                .MyVar = .LHS + .RHS
            `;
            const expectedErrorMessage = 'Cannot add a String to an Integer. Can only add an Integer.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 25, 3, 36));
        });

        it('should error on inline adding anything other than an integer (boolean) to an integer (via evaluated variable)', () => {
            const input = `
                .LHS = 123
                .RHS = true
                .MyVar = .LHS + .RHS
            `;
            const expectedErrorMessage = 'Cannot add a Boolean to an Integer. Can only add an Integer.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 25, 3, 36));
        });

        it('should error on inline adding anything other than an integer (struct) to an integer (via evaluated variable)', () => {
            const input = `
                .LHS = 123
                .RHS = [ .A = 1 ]
                .MyVar = .LHS + .RHS
            `;
            const expectedErrorMessage = 'Cannot add a Struct to an Integer. Can only add an Integer.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 25, 3, 36));
        });

        it('should error on adding anything other than a string to a string', () => {
            const input = `
                .LHS = 'hi'
                .LHS + 123
            `;
            const expectedErrorMessage = 'Cannot add an Integer to a String. Can only add a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 26));
        });

        it('should error on inline adding anything other than a string (Integer) to a string (via direct value)', () => {
            const input = `
                .MyVar = 'hi' + 123
            `;
            const expectedErrorMessage = 'Cannot add an Integer to a String. Can only add a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 25, 1, 35));
        });

        it('should error on inline adding anything other than a string (Boolean) to a string (via direct value)', () => {
            const input = `
                .MyVar = 'hi' + true
            `;
            const expectedErrorMessage = 'Cannot add a Boolean to a String. Can only add a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 25, 1, 36));
        });

        it('should error on inline adding anything other than a string (array) to a string (via direct value)', () => {
            const input = `
                .MyVar = 'hi' + {}
            `;
            const expectedErrorMessage = 'Cannot add an Array to a String. Can only add a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 25, 1, 34));
        });

        it('should error on inline adding anything other than a string to a string (via evaluated variable)', () => {
            const input = `
                .LHS = 'hi'
                .RHS = 123
                .MyVar = .LHS + .RHS
            `;
            const expectedErrorMessage = 'Cannot add an Integer to a String. Can only add a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 25, 3, 36));
        });

        it('should error on adding anything to a boolean', () => {
            const input = `
                .LHS = true
                .LHS + 'hi'
            `;
            const expectedErrorMessage = 'Cannot add to a Boolean.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 27));
        });

        it('should error on inline adding anything (string) to a boolean (via direct value)', () => {
            const input = `
                .LHS = true
                     + 'hi'
            `;
            const expectedErrorMessage = 'Cannot add to a Boolean.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 21, 2, 27));
        });

        it('should error on inline adding anything to a boolean (via evaluated variable)', () => {
            const input = `
                .LHS = true
                .RHS = 'hi'
                .MyVar = .LHS + .RHS
            `;
            const expectedErrorMessage = 'Cannot add to a Boolean.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 25, 3, 36));
        });

        it('should error on adding anything other than a struct to a struct', () => {
            const input = `
                .Struct = [ .A = 1 ]
                .Struct + "hi"
            `;
            const expectedErrorMessage = 'Cannot add a String to a Struct. Can only add a Struct.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 30));
        });
    });

    describe('subtraction', () => {
        it('integer subtraction', () => {
            const input = `
                .Value = 3
                .Value - 2
            `;
            assertEvaluatedVariablesValueEqual(input, [
                3,
                1
            ]);
        });

        it('inline integer subtraction', () => {
            const input = `
                .Value = 3
                       - 2
            `;
            assertEvaluatedVariablesValueEqual(input, [
                1
            ]);
        });

        it('Substring removal', () => {
            const input = `
                .String = 'Good Bad Good'
                .String - 'Bad'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Good Bad Good',
                'Good  Good',
            ]);
        });

        it('Substring with special (regex) characters removal', () => {
            const input = `
                .String = 'Java C++ Python'
                .String - 'C++'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Java C++ Python',
                'Java  Python',
            ]);
        });

        it('Substring removal using variable', () => {
            const input = `
                .String = 'Good Bad Good'
                .Bad = 'Bad'
                .String - .Bad
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Good Bad Good',
                'Bad',
                'Bad',
                'Good  Good',
            ]);
        });

        it('Multiple string removals', () => {
            const input = `
                .String = 'Good Bad Good Bad Bad Good'
                .String - 'Bad'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Good Bad Good Bad Bad Good',
                'Good  Good   Good',
            ]);
        });

        it('Multiple string removals using variable', () => {
            const input = `
                .String = 'Good Bad Good Bad Bad Good'
                .Bad = 'Bad'
                .String - .Bad
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Good Bad Good Bad Bad Good',
                'Bad',
                'Bad',
                'Good  Good   Good',
            ]);
        });

        it('String remove not found', () => {
            const input = `
                .String = 'Good'
                .String - 'NotFound'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Good',
                'Good',
            ]);
        });

        it('String remove from empty string', () => {
            const input = `
                .String = ''
                .String - 'NotFound'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                '',
                '',
            ]);
        });

        it('Inline string subtraction', () => {
            const input = `
                .String = 'Good Bad'
                        - 'Bad'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Good ',
            ]);
        });

        it('Inline string subtraction within words', () => {
            const input = `
                .String = 'GoBADod'
                        - 'BAD'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Good',
            ]);
        });

        it('Inline string subtraction must match case', () => {
            const input = `
                .String = 'Good'
                        - 'GOOD'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Good',
            ]);
        });

        it('Inline string addition then subtraction', () => {
            const input = `
                .String = '1 2'
                        + ' 3'
                        - ' 2'
                        + ' 4'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                '1 3 4',
            ]);
        });

        it('Inline string subtraction then addition', () => {
            const input = `
                .String = '1 2'
                        - ' 2'
                        + ' 3'
                        - '1 '
            `;
            assertEvaluatedVariablesValueEqual(input, [
                '3',
            ]);
        });

        it('Remove from array of strings', () => {
            const input = `
                .Strings = { 'Good', 'Bad', 'Good' }
                .Strings - 'Bad'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['Good', 'Bad', 'Good'],
                ['Good', 'Good'],
            ]);
        });

        it('Remove from array of strings inline', () => {
            const input = `
                .Strings = { 'Good', 'Bad', 'Good' }
                         - 'Bad'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['Good', 'Good'],
            ]);
        });

        it('Remove from array of strings using variable', () => {
            const input = `
                .Bad = 'Bad'
                .Strings = { 'Good', 'Bad', 'Good' }
                .Strings - .Bad
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Bad',
                ['Good', 'Bad', 'Good'],
                'Bad',
                ['Good', 'Good'],
            ]);
        });

        it('Remove from array of strings inline using variable', () => {
            const input = `
                .Bad = 'Bad'
                .Strings = { 'Good', 'Bad', 'Good' }
                         - .Bad
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Bad',
                ['Good', 'Good'],
                'Bad',
            ]);
        });

        it('Remove from empty array of strings', () => {
            const input = `
                .Strings = {}
                .Strings - 'NotFound'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                [],
                [],
            ]);
        });

        it('should error on subtracting anything other than an integer from an integer', () => {
            const input = `
                .LHS = 123
                .LHS - 'hi'
            `;
            const expectedErrorMessage = 'Cannot subtract a String from an Integer. Can only subtract an Integer.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 27));
        });

        it('should error on inline subtracting anything other than an integer from an integer (via direct value)', () => {
            const input = `
                .LHS = 123
                     - 'hi'
            `;
            const expectedErrorMessage = 'Cannot subtract a String from an Integer. Can only subtract an Integer.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 21, 2, 27));
        });

        it('should error on inline subtracting anything other than an integer from an integer (via evaluated variable)', () => {
            const input = `
                .LHS = 123
                .RHS = 'hi'
                .MyVar = .LHS - .RHS
            `;
            const expectedErrorMessage = 'Cannot subtract a String from an Integer. Can only subtract an Integer.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 25, 3, 36));
        });

        it('should error on subtracting anything other than a string from a string', () => {
            const input = `
                .LHS = 'hi'
                .LHS - 123
            `;
            const expectedErrorMessage = 'Cannot subtract an Integer from a String. Can only subtract a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 26));
        });

        it('should error on inline subtracting anything other than a string (Integer) from a string (via direct value)', () => {
            const input = `
                .MyVar = 'hi' - 123
            `;
            const expectedErrorMessage = 'Cannot subtract an Integer from a String. Can only subtract a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 25, 1, 35));
        });

        it('should error on inline subtracting anything other than a string (Boolean) from a string (via direct value)', () => {
            const input = `
                .MyVar = 'hi' - true
            `;
            const expectedErrorMessage = 'Cannot subtract a Boolean from a String. Can only subtract a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 25, 1, 36));
        });

        it('should error on inline subtracting anything other than a string (Array) from a string (via direct value)', () => {
            const input = `
                .MyVar = 'hi' - {}
            `;
            const expectedErrorMessage = 'Cannot subtract an Array from a String. Can only subtract a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 25, 1, 34));
        });

        it('should error on inline subtracting anything other than a string from a string (via evaluated variable)', () => {
            const input = `
                .LHS = 'hi'
                .RHS = 123
                .MyVar = .LHS - .RHS
            `;
            const expectedErrorMessage = 'Cannot subtract an Integer from a String. Can only subtract a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 25, 3, 36));
        });

        it('should error on subtracting anything other than a string (boolean) from an array of strings', () => {
            const input = `
                .LHS = { 'a' }
                .LHS - true
            `;
            const expectedErrorMessage = 'Cannot subtract a Boolean from an Array of Strings. Can only subtract a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 27));
        });

        it('should error on subtracting anything other than a string (integer) from an array of strings', () => {
            const input = `
                .LHS = { 'a' }
                .LHS - 123
            `;
            const expectedErrorMessage = 'Cannot subtract an Integer from an Array of Strings. Can only subtract a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 26));
        });

        it('should error on subtracting anything other than a string (array) from an array of strings', () => {
            const input = `
                .LHS = { 'a' }
                .LHS - { 'b' }
            `;
            const expectedErrorMessage = 'Cannot subtract an Array from an Array of Strings. Can only subtract a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 30));
        });

        it('should error on subtracting anything other than a string (struct) from an array of strings', () => {
            const input = `
                .LHS = { 'a' }
                .LHS - [.A=1]
            `;
            const expectedErrorMessage = 'Cannot subtract a Struct from an Array of Strings. Can only subtract a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 29));
        });

        it('should error on inline subtracting anything other than a string from an array of strings', () => {
            const input = `
                .LHS = { 'a' }
                     - true
            `;
            const expectedErrorMessage = 'Cannot subtract a Boolean from an Array of Strings. Can only subtract a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 21, 2, 27));
        });

        it('should error on inline subtracting anything other than a string (via evaluated variable) from an array of strings', () => {
            const input = `
                .RHS = true
                .LHS = { 'a' }
                     - .RHS
            `;
            const expectedErrorMessage = 'Cannot subtract a Boolean from an Array of Strings. Can only subtract a String.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 21, 3, 27));
        });

        // The only type of array that can be subtracted from is an array of strings.
        it('should error on subtracting anything from an array of structs', () => {
            const input = `
                .MyStruct = [.A=1]
                .LHS = { .MyStruct }
                     - 'a'
            `;
            const expectedErrorMessage = 'Cannot subtract from an Array of Structs. Can only subtract from an Array if it is an Array of Strings.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 21, 3, 26));
        });

        it('should error on subtracting anything from a boolean', () => {
            const input = `
                .LHS = true
                .LHS - 'hi'
            `;
            const expectedErrorMessage = 'Cannot subtract from a Boolean.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 27));
        });

        it('should error on inline subtracting anything from a boolean (via evaluated variable)', () => {
            const input = `
                .LHS = true
                .RHS = 'hi'
                .MyVar = .LHS - .RHS
            `;
            const expectedErrorMessage = 'Cannot subtract from a Boolean.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 25, 3, 36));
        });

        it('should error on subtracting anything from a struct', () => {
            const input = `
                .Struct1 = [ .A = 1 ]
                .Struct2 = []
                .Struct1 - .Struct2
            `;
            const expectedErrorMessage = 'Cannot subtract from a Struct.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 16, 3, 35));
        });
    });

    describe('adding to an existing value', () => {
        it('should work if there is an existing string value', () => {
            const input = `
                .MyStr
                    = '1'
                    + ' 2'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                '1 2',
            ]);
        });

        it('should work if there is an existing array evaluated variable value', () => {
            const input = `
                .MyArray = { 'a' }
                .MyAugmentedArray
                    = .MyArray
                    + 'b'
                Print( .MyArray )
                Print( .MyAugmentedArray )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['a'],
                ['a'],
                ['a', 'b'],
                ['a'],
                ['a', 'b'],
            ]);
        });

        it('should work if there is an existing value (with #if)', () => {
            const builtInDefine = getPlatformSpecificDefineSymbol();
            const input = `
                .MyStr
                    = '1'
                #if ${builtInDefine}
                    + ' 2'
                #endif
                Print( .MyStr )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                '1 2',
                '1 2',
            ]);
        });

        it('should error if there is no existing value that can be added to (1)', () => {
            const input = `
                + 1
            `;
            const expectedErrorMessage = 'Unnamed modification must follow a variable assignment in the same scope.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 16, 1, 16));
        });

        it('should error if there is no existing value that can be added to (2)', () => {
            const input = `
                Print('hi')
                + 1
            `;
            const expectedErrorMessage = 'Unnamed modification must follow a variable assignment in the same scope.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 16));
        });
    });

    describe('subtracting from an existing value', () => {
        it('should work if there is an existing string value', () => {
            const input = `
                .MyStr
                    = '123'
                    - '2'
            `;
            assertEvaluatedVariablesValueEqual(input, [
                '13'
            ]);
        });

        it('should work if there is an existing array evaluated variable value', () => {
            const input = `
                .MyArray = { 'a', 'b' }
                .MyAugmentedArray
                    = .MyArray
                    - 'b'
                Print( .MyArray )
                Print( .MyAugmentedArray )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['a', 'b'],
                ['a', 'b'],
                ['a'],
                ['a', 'b'],
                ['a'],
            ]);
        });

        it('should work if there is an existing value (with #if)', () => {
            const builtInDefine = getPlatformSpecificDefineSymbol();
            const input = `
                .MyStr
                    = '123'
                #if ${builtInDefine}
                    - '2'
                #endif
                Print( .MyStr )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                '13',
                '13',
            ]);
        });

        it('should error if there is no existing value that can be added to (1)', () => {
            const input = `
                - 1
            `;
            const expectedErrorMessage = 'Unnamed modification must follow a variable assignment in the same scope.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 16, 1, 16));
        });

        it('should error if there is no existing value that can be added to (2)', () => {
            const input = `
                Print('hi')
                - 1
            `;
            const expectedErrorMessage = 'Unnamed modification must follow a variable assignment in the same scope.';
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 16));
        });
    });

    describe('evaluatedVariables range', () => {
        it('should be detected in a string with multiple variables', () => {
            const input = `
                .MyVar1 = 'MyValue1'
                .MyVar2 = 'MyValue2'
                Print( 'pre-$MyVar1$-$MyVar2$-post' )
            `;
            const result = evaluateInput(input, true /*enableDiagnostics*/);
            const expectedEvaluatedVariables: EvaluatedVariable[] = [
                // MyValue1 definition
                {
                    value: 'MyValue1',
                    range: createRange(1, 16, 1, 23),
                },
                // MyValue2 definition
                {
                    value: 'MyValue2',
                    range: createRange(2, 16, 2, 23),
                },
                // MyValue1 reference
                {
                    value: 'MyValue1',
                    range: createRange(3, 28, 3, 36),
                },
                // MyValue2 reference
                {
                    value: 'MyValue2',
                    range: createRange(3, 37, 3, 45),
                }
            ];
            assert.deepStrictEqual(result.evaluatedVariables, expectedEvaluatedVariables);
        });

        it('should be detected when assigning the value of another variable', () => {
            const input = `
                .MyVar = 'MyValue'
                Print( .MyVar )
            `;
            const result = evaluateInput(input, true /*enableDiagnostics*/);
            const expectedEvaluatedVariables: EvaluatedVariable[] = [
                // MyValue definition
                {
                    value: 'MyValue',
                    range: createRange(1, 16, 1, 22),
                },
                // MyValue reference
                {
                    value: 'MyValue',
                    range: createRange(2, 23, 2, 29),
                }
            ];
            assert.deepStrictEqual(result.evaluatedVariables, expectedEvaluatedVariables);
        });
    });

    describe('variableDefinitions', () => {
        it('assigning a new variable creates a definition, but assigning an existing variable does not', () => {
            const input = `
                .MyVar = 1
                .MyVar = 2
            `;
            const result = evaluateInput(input, true /*enableDiagnostics*/);
            const expectedDefinitions: VariableDefinition[] = [
                {
                    id: 1,
                    range: createRange(1, 16, 1, 22),
                    name: 'MyVar'
                }
            ];
            assert.deepStrictEqual(result.variableDefinitions, expectedDefinitions);
        });
    });

    describe('variableReferences', () => {
        it('should be detected in a variable definition LHS', () => {
            const input = `
                .MyVar = 1
            `;
            const result = evaluateInput(input, true /*enableDiagnostics*/);
            const expectedReferences: VariableReference[] = [
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 22),
                        name: 'MyVar',
                    },
                    range: createRange(1, 16, 1, 22),
                }
            ];
            assert.deepStrictEqual(result.variableReferences, expectedReferences);
        });

        it('should be detected in a variable addition LHS', () => {
            const input = `
                .MyVar = 1
                .MyVar + 2
            `;
            const result = evaluateInput(input, true /*enableDiagnostics*/);
            const expectedReferences: VariableReference[] = [
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 22),
                        name: 'MyVar',
                    },
                    range: createRange(1, 16, 1, 22),
                },
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 22),
                        name: 'MyVar',
                    },
                    range: createRange(2, 16, 2, 22),
                }
            ];
            assert.deepStrictEqual(result.variableReferences, expectedReferences);
        });

        it('should be detected in an evaluated variable (standalone)', () => {
            const input = `
                .MyVar1 = 1
                .MyVar2 = .MyVar1
            `;
            const result = evaluateInput(input, true /*enableDiagnostics*/);
            const expectedReferences: VariableReference[] = [
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 23),
                        name: 'MyVar1',
                    },
                    range: createRange(1, 16, 1, 23),
                },
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 23),
                        name: 'MyVar1',
                    },
                    range: createRange(2, 26, 2, 33),
                },
                {
                    definition: {
                        id: 2,
                        range: createRange(2, 16, 2, 23),
                        name: 'MyVar2',
                    },
                    range: createRange(2, 16, 2, 23),
                }
            ];
            assert.deepStrictEqual(result.variableReferences, expectedReferences);
        });

        it('should be detected in an evaluated variable (string template)', () => {
            const input = `
                .MyVar1 = 'hello'
                .MyVar2 = '$MyVar1$ world'
            `;
            const result = evaluateInput(input, true /*enableDiagnostics*/);
            const expectedReferences: VariableReference[] = [
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 23),
                        name: 'MyVar1',
                    },
                    range: createRange(1, 16, 1, 23),
                },
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 23),
                        name: 'MyVar1',
                    },
                    range: createRange(2, 27, 2, 35),
                },
                {
                    definition: {
                        id: 2,
                        range: createRange(2, 16, 2, 23),
                        name: 'MyVar2',
                    },
                    range: createRange(2, 16, 2, 23),
                }
            ];
            assert.deepStrictEqual(result.variableReferences, expectedReferences);
        });
    });

    describe('Using', () => {
        it('Call Using outside a struct', () => {
            const input = `
                .MyBool = false
                .MyStruct = [
                    .MyBool = true
                    .MyInt = 1
                    .MyString = 'hello'
                ]
                Using(.MyStruct)
                Print( .MyBool )
                Print( .MyInt )
                Print( .MyString )
            `;
            const myStructMyBoolDefinition: VariableDefinition = { id: 2, range: createRange(3, 20, 3, 27), name: 'MyBool' };
            const myStructMyIntDefinition: VariableDefinition = { id: 3, range: createRange(4, 20, 4, 26), name: 'MyInt' };
            const myStructMyStringDefinition: VariableDefinition = { id: 4, range: createRange(5, 20, 5, 29), name: 'MyString' };
            const myStruct = Struct.from(Object.entries({
                MyBool: new StructMember(true, myStructMyBoolDefinition),
                MyInt: new StructMember(1, myStructMyIntDefinition),
                MyString: new StructMember('hello', myStructMyStringDefinition)
            }));
            assertEvaluatedVariablesValueEqual(input, [
                false,
                true,
                1,
                'hello',
                myStruct,
                myStruct,
                true,
                1,
                'hello',
            ]);
        });

        it('Call Using inside a struct', () => {
            const input = `
                .MyVar = 'fun'
                .MyStruct = [
                    .MyBool = true
                    .MyInt = 1
                    .MyString = 'hello'
                    .MyEvaluatedVar = .MyVar
                ]
                .Other = [
                    Using(.MyStruct)
                ]
            `;
            const myStructMyBoolDefinition: VariableDefinition = { id: 2, range: createRange(3, 20, 3, 27), name: 'MyBool' };
            const myStructMyIntDefinition: VariableDefinition = { id: 3, range: createRange(4, 20, 4, 26), name: 'MyInt' };
            const myStructMyStringDefinition: VariableDefinition = { id: 4, range: createRange(5, 20, 5, 29), name: 'MyString' };
            const myStructMyEvaluatedVarDefinition: VariableDefinition = { id: 5, range: createRange(6, 20, 6, 35), name: 'MyEvaluatedVar' };
            const usingMyStructRange = createRange(9, 20, 9, 36);
            const usingMyStructMyBoolDefinition: VariableDefinition = { id: 7, range: usingMyStructRange, name: 'MyBool' };
            const usingMyStructMyIntDefinition: VariableDefinition = { id: 8, range: usingMyStructRange, name: 'MyInt' };
            const usingMyStructMyStringDefinition: VariableDefinition = { id: 9, range: usingMyStructRange, name: 'MyString' };
            const usingMyStructMyEvaluatedVarDefinition: VariableDefinition = { id: 10, range: usingMyStructRange, name: 'MyEvaluatedVar' };
            const myStruct = Struct.from(Object.entries({
                MyBool: new StructMember(true, myStructMyBoolDefinition),
                MyInt: new StructMember(1, myStructMyIntDefinition),
                MyString: new StructMember('hello', myStructMyStringDefinition),
                MyEvaluatedVar: new StructMember('fun', myStructMyEvaluatedVarDefinition)
            }));
            const other = Struct.from(Object.entries({
                MyBool: new StructMember(true, usingMyStructMyBoolDefinition),
                MyInt: new StructMember(1, usingMyStructMyIntDefinition),
                MyString: new StructMember('hello', usingMyStructMyStringDefinition),
                MyEvaluatedVar: new StructMember('fun', usingMyStructMyEvaluatedVarDefinition)
            }));
            assertEvaluatedVariablesValueEqual(input, [
                'fun',
                true,
                1,
                'hello',
                'fun',
                'fun',
                // .MyStruct = ...
                myStruct,
                // Using(.MyStruct)
                myStruct,
                // .Other = ...
                other,
            ]);
        });

        // 'Using' defines the struct variables if they do not already exist,
        // references the previous defintion if it does already exist,
        // and references the struct variables.
        it('Using has correct definitions and references', () => {
            const input = `
                .MyVar1 = 0
                .MyStruct = [
                    .MyVar1 = 1
                    .MyVar2 = 1
                ]
                Using( .MyStruct )
            `;

            const result = evaluateInput(input, true /*enableDiagnostics*/);

            const rangeMyVar1 = createFileRange('file:///dummy.bff', 1, 16, 1, 23);
            const rangeMyStructMyVar1 = createFileRange('file:///dummy.bff', 3, 20, 3, 27);
            const rangeMyStructMyVar2 = createFileRange('file:///dummy.bff', 4, 20, 4, 27);
            const rangeMyStruct = createFileRange('file:///dummy.bff', 2, 16, 2, 25);
            const rangeUsingStatement = createFileRange('file:///dummy.bff', 6, 16, 6, 34);
            const rangeUsingStructVar = createFileRange('file:///dummy.bff', 6, 23, 6, 32);

            const definitionMyVar1 = { id: 1, range:  rangeMyVar1, name: 'MyVar1' };  // MyVar1
            const definitionMyStructMyVar1 = { id: 2, range: rangeMyStructMyVar1, name: 'MyVar1' };  // MyStruct's MyVar1
            const definitionMyStructMyVar2 = { id: 3, range: rangeMyStructMyVar2, name: 'MyVar2' };  // MyStruct's MyVar2
            const definitionMyStruct = { id: 4, range: rangeMyStruct, name: 'MyStruct' };  // MyStruct
            const definitionMyVar2 = { id: 5, range: rangeUsingStatement, name: 'MyVar2' };  // MyVar2
            const expectedDefinitions = [
                // .MyVar1 = 0
                definitionMyVar1,
                // MyStruct's .MyVar1 = 1
                definitionMyStructMyVar1,
                // MyStruct's .MyVar2 = 1
                definitionMyStructMyVar2,
                // .MyStruct = ...
                definitionMyStruct,
                // Using( .MyStruct )
                definitionMyVar2,
            ];
            assert.deepStrictEqual(result.variableDefinitions, expectedDefinitions);

            const expectedReferences = [
                // .MyVar1 = 0
                { definition: definitionMyVar1, range: rangeMyVar1 },
                // MyStruct's .MyVar1 = 1
                { definition: definitionMyStructMyVar1, range: rangeMyStructMyVar1 },
                // MyStruct's .MyVar2 = 1
                { definition: definitionMyStructMyVar2, range: rangeMyStructMyVar2 },
                // .MyStruct = ...
                { definition: definitionMyStruct, range: rangeMyStruct },
                // Using( .MyStruct )
                { definition: definitionMyStruct, range: rangeUsingStructVar },
                { definition: definitionMyVar1, range: rangeUsingStatement },
                { definition: definitionMyStructMyVar1, range: rangeUsingStatement },
                { definition: definitionMyVar1, range: rangeMyStructMyVar1 },
                { definition: definitionMyVar2, range: rangeUsingStatement },
                { definition: definitionMyStructMyVar2, range: rangeUsingStatement },
                { definition: definitionMyVar2, range: rangeMyStructMyVar2 },
            ];
            assert.deepStrictEqual(result.variableReferences, expectedReferences);
        });

        it('Using chain', () => {
            const input = `
                .MyStruct1 = [
                    .MyInt = 1
                ]
                .MyStruct2 = [
                    Using( .MyStruct1 )
                ]
                .MyStruct3 = [
                    Using( .MyStruct2 )
                ]
            `;
            const myStruct1MyIntDefinition: VariableDefinition = { id: 1, range: createRange(2, 20, 2, 26), name: 'MyInt' };
            const usingMyStruct1MyIntDefinition: VariableDefinition = { id: 3, range: createRange(5, 20, 5, 39), name: 'MyInt' };
            const usingMyStruct2MyIntDefinition: VariableDefinition = { id: 5, range: createRange(8, 20, 8, 39), name: 'MyInt' };
            const myStruct1 = Struct.from(Object.entries({
                MyInt: new StructMember(1, myStruct1MyIntDefinition),
            }));
            const myStruct2 = Struct.from(Object.entries({
                MyInt: new StructMember(1, usingMyStruct1MyIntDefinition),
            }));
            assertEvaluatedVariablesValueEqual(input, [
                1,
                // .MyStruct1 = ...
                myStruct1,
                // Using( .MyStruct1 )
                myStruct1,
                // .MyStruct2 = ...
                myStruct2,
                // Using( .MyStruct2 )
                myStruct2,
                // .MyStruct3 = ...
                Struct.from(Object.entries({
                    MyInt: new StructMember(1, usingMyStruct2MyIntDefinition),
                }))
            ]);
        });

        it('Using errors if its parameter is not a struct', () => {
            const input = `
                .MyVar = 1
                Using( .MyVar )
            `;
            const expectedErrorMessage = `'Using' parameter must be a Struct, but instead is an Integer`;
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 23, 2, 29));
        });

        it('Using struct with a scoped variable', () => {
            const input = `
                .MyStruct =
                [
                    .StructVar1 = 1
                    {
                        .InnerStructVar = 3
                    }
                ]

                Using( .MyStruct )
            `;
            const myStructStructVar1Definition: VariableDefinition = { id: 1, range: createRange(3, 20, 3, 31), name: 'StructVar1' };
            const myStruct = Struct.from(Object.entries({
                StructVar1: new StructMember(1, myStructStructVar1Definition)
            }));
            assertEvaluatedVariablesValueEqual(input, [
                1,
                3,
                myStruct,
                myStruct,
            ]);
        });
    });

    describe('ForEach', () => {
        it('iterates over an array of strings', () => {
            const input = `
                .MyArray = {'a', 'b', 'c'}
                ForEach( .Item in .MyArray )
                {
                    Print( .Item )
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['a', 'b', 'c'],
                ['a', 'b', 'c'],
                'a', 'a',
                'b', 'b',
                'c', 'c',
            ]);
        });

        it('iterates over an empty array', () => {
            const input = `
                .MyArray = {}
                ForEach( .Item in .MyArray )
                {
                    Print( .Item )
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [
                [],
                [],
            ]);
        });

        it('iterates over an array of strings in a parent scope', () => {
            const input = `
                .MyArray = {'a', 'b', 'c'}
                {
                    ForEach( .Item in .MyArray )
                    {
                        Print( .Item )
                    }
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['a', 'b', 'c'],
                ['a', 'b', 'c'],
                'a', 'a',
                'b', 'b',
                'c', 'c',
            ]);
        });

        it('iterates over an array of structs', () => {
            const input = `
                .MyStruct1 = [ .Value = 1 ]
                .MyStruct2 = [ .Value = 2 ]
                .MyArray = {
                    .MyStruct1
                    .MyStruct2
                }
                ForEach( .Item in .MyArray )
                {
                    Print( .Item )
                }
            `;
            const myStruct1ValueDefinition: VariableDefinition = { id: 1, range: createRange(1, 31, 1, 37), name: 'Value' };
            const myStruct2ValueDefinition: VariableDefinition = { id: 3, range: createRange(2, 31, 2, 37), name: 'Value' };
            const myStruct1 = Struct.from(Object.entries({
                Value: new StructMember(1, myStruct1ValueDefinition)
            }));
            const myStruct2 = Struct.from(Object.entries({
                Value: new StructMember(2, myStruct2ValueDefinition)
            }));
            assertEvaluatedVariablesValueEqual(input, [
                // .Value = 1
                1,
                // .MyStruct1 = ...
                myStruct1,
                // .Value = 2
                2,
                // .MyStruct2 = ...
                myStruct2,
                // .MyArray = ...
                myStruct1,
                myStruct2,
                [myStruct1, myStruct2],
                // in .MyArray )
                [myStruct1, myStruct2],
                // `ForEach( .Item...` iteration 1
                myStruct1,
                // `Print( .Item )` iteration 1
                myStruct1,
                // `ForEach( .Item...` iteration 2
                myStruct2,
                // `Print( .Item )` iteration 2
                myStruct2,
            ]);
        });

        it('iterates over multiple arrays (separated by commas) at a time', () => {
            const input = `
                .MyArray1 = {'a1', 'b1', 'c1'}
                .MyArray2 = {'a2', 'b2', 'c2'}
                .MyArray3 = {'a3', 'b3', 'c3'}
                ForEach( .Item1 in .MyArray1,.Item2 in .MyArray2,
                         .Item3 in .MyArray3 )
                {
                    Print( '$Item1$-$Item2$-$Item3$' )
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [
                // .MyArray1 = ...
                ['a1', 'b1', 'c1'],
                // .MyArray3 = ...
                ['a2', 'b2', 'c2'],
                // .MyArray3 = ...
                ['a3', 'b3', 'c3'],
                // ForEach( ... )
                ['a1', 'b1', 'c1'],
                ['a2', 'b2', 'c2'],
                ['a3', 'b3', 'c3'],
                // Loop variables iteration 1
                'a1', 'a2', 'a3',
                // `Print( '$Item1$-$Item2$-$Item3$' )` iteration 1
                'a1', 'a2', 'a3',
                // Loop variables iteration 2
                'b1', 'b2', 'b3',
                // `Print( '$Item1$-$Item2$-$Item3$' )` iteration 2
                'b1', 'b2', 'b3',
                // Loop variables iteration 3
                'c1', 'c2', 'c3',
                // `Print( '$Item1$-$Item2$-$Item3$' )` iteration 3
                'c1', 'c2', 'c3',
            ]);
        });

        it('iterates over multiple arrays (separated by whitespace) at a time', () => {
            const input = `
                .MyArray1 = {'a1', 'b1', 'c1'}
                .MyArray2 = {'a2', 'b2', 'c2'}
                .MyArray3 = {'a3', 'b3', 'c3'}
                ForEach( .Item1 in .MyArray1
                         .Item2 in .MyArray2
                         .Item3 in .MyArray3 )
                {
                    Print( '$Item1$-$Item2$-$Item3$' )
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [
                // .MyArray1 = ...
                ['a1', 'b1', 'c1'],
                // .MyArray3 = ...
                ['a2', 'b2', 'c2'],
                // .MyArray3 = ...
                ['a3', 'b3', 'c3'],
                // ForEach( ... )
                ['a1', 'b1', 'c1'],
                ['a2', 'b2', 'c2'],
                ['a3', 'b3', 'c3'],
                // Loop variables iteration 1
                'a1', 'a2', 'a3',
                // `Print( '$Item1$-$Item2$-$Item3$' )` iteration 1
                'a1', 'a2', 'a3',
                // Loop variables iteration 2
                'b1', 'b2', 'b3',
                // `Print( '$Item1$-$Item2$-$Item3$' )` iteration 2
                'b1', 'b2', 'b3',
                // Loop variables iteration 3
                'c1', 'c2', 'c3',
                // `Print( '$Item1$-$Item2$-$Item3$' )` iteration 3
                'c1', 'c2', 'c3',
            ]);
        });

        it('errors when iterating over multiple arrays with different sizes', () => {
            const input = `
                .MyArray1 = {'a1'}
                .MyArray2 = {'a2', 'b2'}
                ForEach( .Item1 in .MyArray1, .Item2 in .MyArray2 )
                {
                    .Combined = '$Item1$-$Item2$'
                }
            `;
            const expectedErrorMessage = `'ForEach' Array variable to loop over contains 2 elements, but the loop is for 1 elements.`;
            assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 56, 3, 65));
        });

        it('body is on the same line', () => {
            const input = `
                .MyArray = {'a', 'b', 'c'}
                ForEach( .Item in .MyArray ) { Print( .Item ) }
            `;
            assertEvaluatedVariablesValueEqual(input, [
                // .MyArray = ...
                ['a', 'b', 'c'],
                // ForEach( ... )
                ['a', 'b', 'c'],
                // Print( .Item )
                'a', 'a',
                'b', 'b',
                'c', 'c',
            ]);
        });

        it('errors if the loop variable is not an array', () => {
            const input = `
                .MyArray = 123
                ForEach( .Item in .MyArray )
                {
                }
            `;
            const expectedErrorMessage = `'ForEach' variable to loop over must be an Array, but instead is an Integer`;
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 34, 2, 42));
        });

        it('has the expected variable definitions and references', () => {
            const input = `
                .MyArray = {'a', 'b'}
                ForEach( .Item in .MyArray )
                {
                    Print( .Item )
                }
            `;

            const result = evaluateInput(input, true /*enableDiagnostics*/);

            // `.MyArray = {'a', 'b'}`
            const expectedDefinitionMyArray: VariableDefinition = {
                id: 1,
                range: createRange(1, 16, 1, 24),
                name: 'MyArray',
            };

            // `ForEach( .Item...`
            const expectedDefinitionItem: VariableDefinition = {
                id: 2,
                range: createRange(2, 25, 2, 30),
                name: 'Item',
            };

            assert.deepStrictEqual(result.variableDefinitions, [
                expectedDefinitionMyArray,
                expectedDefinitionItem,
            ]);

            const expectedReferences: VariableReference[] = [
                // `.MyArray = {'a', 'b'}`
                {
                    definition: expectedDefinitionMyArray,
                    range: expectedDefinitionMyArray.range,
                },
                // `...in .MyArray`
                {
                    definition: expectedDefinitionMyArray,
                    range: createRange(2, 34, 2, 42),
                },
                // // `ForEach( .Item...`
                {
                    definition: expectedDefinitionItem,
                    range: expectedDefinitionItem.range,
                },
                // `Print( .Item )` for the 1st loop iteration
                {
                    definition: expectedDefinitionItem,
                    range: createRange(4, 27, 4, 32),
                },
                // `Print( .Item )` for the 2nd loop iteration
                {
                    definition: expectedDefinitionItem,
                    range: createRange(4, 27, 4, 32),
                },
            ];
            assert.deepStrictEqual(result.variableReferences, expectedReferences);
        });
    });

    // Functions that all we handle are registering their target and evaluating their statements.
    describe('Generic functions declaring targets', () => {
        const genericFunctionNames = [
            'Alias',
            'Compiler',
            'Copy',
            'CopyDir',
            'CSAssembly',
            'DLL',
            'Exec',
            'Executable',
            'Library',
            'ListDependencies',
            'ObjectList',
            'RemoveDir',
            'Test',
            'TextFile',
            'Unity',
            'VCXProject',
            'VSProjectExternal',
            'VSSolution',
            'XCodeProject',
        ];

        for (const functionName of genericFunctionNames) {
            describe(functionName, () => {
                it('handles a literal target name', () => {
                    const input = `
                        ${functionName}('MyTargetName')
                        {
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, []);
                });

                it('handles an evaluated variable target name', () => {
                    const input = `
                        .MyTargetName = 'SomeName'
                        ${functionName}(.MyTargetName)
                        {
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [
                        'SomeName',
                        'SomeName',
                    ]);
                });

                it('handles a dynamic-variable target name', () => {
                    const input = `
                        .MyTargetName = 'SomeName'
                        .TargetNameVariable = 'MyTargetName'
                        ${functionName}(.'$TargetNameVariable$')
                        {
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [
                        // .MyTargetName = ...
                        'SomeName',
                        // .TargetNameVariable = ...
                        'MyTargetName',
                        // $TargetNameVariable$
                        'MyTargetName',
                        // .'$TargetNameVariable$'
                        'SomeName',
                    ]);
                });

                it('creates a definition for the target name that can be referenced', () => {
                    const input = `
                        {
                            ${functionName}('MyTarget1')
                            {
                            }

                            Alias('MyTarget2')
                            {
                                .Targets = { 'MyTarget1' }
                            }
                        }

                        // The target reference does not need to be in the same or child scope as the target definition.
                        {
                            Alias('MyTarget3')
                            {
                                .Targets = { 'MyTarget1' }
                            }
                        }
                    `;

                    const result = evaluateInput(input, true /*enableDiagnostics*/);

                    const expectedDefinitionMyTarget1: TargetDefinition = {
                        id: 1,
                        range: createRange(2, 29 + functionName.length, 2, 40 + functionName.length),
                    };
                    const expectedDefinitionMyTarget2: TargetDefinition = {
                        id: 2,
                        range: createRange(6, 34, 6, 45),
                    };
                    const expectedDefinitionMyTarget3: TargetDefinition = {
                        id: 4,
                        range: createRange(14, 34, 14, 45),
                    };

                    const expectedTargetDefinitions = new Map<string, TargetDefinition>([
                        ['MyTarget1', expectedDefinitionMyTarget1],
                        ['MyTarget2', expectedDefinitionMyTarget2],
                        ['MyTarget3', expectedDefinitionMyTarget3],
                    ]);
                    assert.deepStrictEqual(result.targetDefinitions, expectedTargetDefinitions);

                    const expectedReferences: TargetReference[] = [
                        // MyTarget1's definition's reference
                        {
                            definition: expectedDefinitionMyTarget1,
                            range: createRange(2, 29 + functionName.length, 2, 40 + functionName.length),
                        },
                        // MyTarget2's definition's reference
                        {
                            definition: expectedDefinitionMyTarget2,
                            range: createRange(6, 34, 6, 45),
                        },
                        // MyTarget2's reference to MyTarget1
                        {
                            definition: expectedDefinitionMyTarget1,
                            range: createRange(8, 32, 8, 40),
                        },
                        // MyTarget3's definition's reference
                        {
                            definition: expectedDefinitionMyTarget3,
                            range: createRange(14, 34, 14, 45),
                        },
                        // MyTarget3's reference to MyTarget1
                        {
                            definition: expectedDefinitionMyTarget1,
                            range: createRange(16, 32, 16, 40),
                        },
                    ];
                    assert.deepStrictEqual(result.targetReferences, expectedReferences);
                });

                it('body on the same line', () => {
                    const input = `
                        ${functionName}('MyTargetName'){}
                    `;
                    assertEvaluatedVariablesValueEqual(input, []);
                });

                it('errors if the evaluated variable target name is not a string', () => {
                    const input = `
                        .MyTargetName = 123
                        ${functionName}( .MyTargetName )
                        {
                        }
                    `;
                    const expectedErrorMessage = `Target name must evaluate to a String, but instead evaluates to an Integer`;
                    assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 26 + functionName.length, 2, 39 + functionName.length));
                });

                it('evaluates body statements', () => {
                    const input = `
                        .MyVar = 1
                        ${functionName}('MyTargetName')
                        {
                            Print( .MyVar )
                            Print( ^MyVar )
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [
                        // .MyVar = ...
                        1,
                        // Print( .MyVar )
                        1,
                        // Print( ^MyVar )
                        1,
                    ]);
                });
            });
        }
    });

    describe('Functions with no effect for our evaluation', () => {
        describe('Error', () => {
            it('Basic', () => {
                const input = `
                    .Value = 1
                    Error( 'Value is $Value$' )
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    1,
                    1,
                ]);
            });

            it('The message being just an evaluated variable', () => {
                const input = `
                    .Value = 1
                    Error( '$Value$' )
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    1,
                    1,
                ]);
            });
        });

        describe('Print', () => {
            it('Print string', () => {
                const input = `
                    .Value = 1
                    Print('Value is $Value$')
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    1,
                    1,
                ]);
            });

            it('Print string variable', () => {
                const input = `
                    .Value = 'hello'
                    Print(.Value)
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    'hello',
                    'hello',
                ]);
            });

            it('Print integer variable', () => {
                const input = `
                    .Value = 123
                    Print(.Value)
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    123,
                    123,
                ]);
            });
        });

        describe('Settings', () => {
            it('Basic', () => {
                const input = `
                    .Value = 1
                    Settings
                    {
                        .MyVar = .Value
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    // .Value = ...
                    1,
                    // .Value
                    1,
                    // .MyVar = ...
                    1,
                ]);
            });
        });
    });

    describe('If', () => {
        describe('Boolean expression', () => {
            it('evaluates a literal true to true', () => {
                const input = `
                    .Result = false
                    If( true )
                    {
                        ^Result = true
                    }
                    Print( .Result )
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    // .Result = ...
                    false,
                    // ^Result = true
                    true,
                    // Print( .Result )
                    true,
                ]);
            });

            it('evaluates a literal false to false', () => {
                const input = `
                    .Result = false
                    If( false )
                    {
                        ^Result = true
                    }
                    Print( .Result )
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    // .Result = ...
                    false,
                    // Print( .Result )
                    false,
                ]);
            });

            it('evaluates "! literal true" to false', () => {
                const input = `
                    .Result = false
                    If( !true )
                    {
                        ^Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [false]);
            });

            it('evaluates "! literal false" to true', () => {
                const input = `
                    .Result = false
                    If( !false )
                    {
                        ^Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [false, true]);
            });

            it('evaluates a true boolean variable to true', () => {
                const input = `
                    .Value = true
                    .Result = false
                    If( .Value )
                    {
                        ^Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    // .Value = ...
                    true,
                    // .Result = ...
                    false,
                    // If( .Value )
                    true,
                    // ^Result = ...
                    true,
                ]);
            });

            it('evaluates a false boolean variable to false', () => {
                const input = `
                    .Value = false
                    .Result = false
                    If( .Value )
                    {
                        ^Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    // .Value = ...
                    false,
                    // .Result = ...
                    false,
                    // If( .Value )
                    false,
                ]);
            });

            it('evaluates the inversion of a true boolean variable to false', () => {
                const input = `
                    .Value = true
                    .Result = false
                    If( !.Value )
                    {
                        ^Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [true, false, true]);
            });

            it('evaluates the inversion of a false boolean variable to true', () => {
                const input = `
                    .Value = false
                    .Result = false
                    If( !.Value )
                    {
                        ^Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [false, false, false, true]);
            });

            it('errors on using a non-boolean variable for the condition', () => {
                const input = `
                    .Value = 123
                    If( .Value )
                    {
                    }
                `;
                const expectedErrorMessage = `Condition must evaluate to a Boolean, but instead evaluates to an Integer`;
                assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 24, 2, 30));
            });

            it('Body on the same line', () => {
                const input = `
                    .Result = false
                    If( true ) { ^Result = true }
                `;
                assertEvaluatedVariablesValueEqual(input, [false, true]);
            });
        });

        describe('Comparison', () => {
            describe('boolean', () => {
                it('"{true-literal} == {true-literal}" evaluates to true', () => {
                    const input = `
                        If( true == true )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [true]);
                });

                it('"{true-literal} == {false-literal}" evaluates to false', () => {
                    const input = `
                        If( true == false )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, []);
                });

                it('"true == {true-literal}" evaluates to true', () => {
                    const input = `
                        .Value1 = true
                        If( .Value1 == true )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [true, true, true]);
                });

                it('"{true-literal} == true" evaluates to true', () => {
                    const input = `
                        .Value1 = true
                        If( true == .Value1 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [true, true, true]);
                });

                it('"true == true" evaluates to true', () => {
                    const input = `
                        .Value1 = true
                        .Value2 = true
                        If( .Value1 == .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [true, true, true, true, true]);
                });

                it('"false == false" evaluates to true', () => {
                    const input = `
                        .Value1 = false
                        .Value2 = false
                        If( .Value1 == .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [false, false, false, false, true]);
                });

                it('"true == false" evaluates to false', () => {
                    const input = `
                        .Value1 = true
                        .Value2 = false
                        If( .Value1 == .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [true, false, true, false]);
                });

                it('"false == true" evaluates to false', () => {
                    const input = `
                        .Value1 = false
                        .Value2 = true
                        If( .Value1 == .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [false, true, false, true]);
                });

                it('"true != true" evaluates to false', () => {
                    const input = `
                        .Value1 = true
                        .Value2 = true
                        If( .Value1 != .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [true, true, true, true]);
                });

                it('"false != false" evaluates to false', () => {
                    const input = `
                        .Value1 = false
                        .Value2 = false
                        If( .Value1 != .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [false, false, false, false]);
                });

                it('"true != false" evaluates to true', () => {
                    const input = `
                        .Value1 = true
                        .Value2 = false
                        If( .Value1 != .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [true, false, true, false, true]);
                });

                it('"false != true" evaluates to true', () => {
                    const input = `
                        .Value1 = false
                        .Value2 = true
                        If( .Value1 != .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [false, true, false, true, true]);
                });

                const illegalComparisonOperators = [
                    '<',
                    '<=',
                    '>',
                    '>='
                ];
                for (const operator of illegalComparisonOperators) {
                    it(`booleans cannot be compared with ${operator}`, () => {
                        const input = `
                            .Value1 = true
                            .Value2 = true
                            If( .Value1 ${operator} .Value2 )
                            {
                            }
                        `;
                        const expectedErrorMessage = `'If' comparison using '${operator}' only supports comparing Strings and Integers, but a Boolean is used`;
                        assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 40, 3, 40 + operator.length));
                    });
                }
            });

            describe('integer', () => {
                it('"{1-literal} == {1-literal}" evaluates to true', () => {
                    const input = `
                        If( 1 == 1 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [true]);
                });

                it('"{1-literal} == {0-literal}" evaluates to false', () => {
                    const input = `
                        If( 1 == 0 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, []);
                });

                it('"1 == {1-literal}" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        If( .Value1 == 1 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, true]);
                });

                it('"{1-literal} == 1" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        If( 1 == .Value1 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, true]);
                });

                it('"1 == 1" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 1
                        If( .Value1 == .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, 1, 1, true]);
                });

                it('"1 == 0" evaluates to false', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 0
                        If( .Value1 == .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 0, 1, 0]);
                });

                it('"1 != 1" evaluates to false', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 1
                        If( .Value1 != .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, 1, 1]);
                });

                it('"1 != 0" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 0
                        If( .Value1 != .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 0, 1, 0, true]);
                });

                it('"0 < 1" evaluates to true', () => {
                    const input = `
                        .Value1 = 0
                        .Value2 = 1
                        If( .Value1 < .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [0, 1, 0, 1, true]);
                });

                it('"1 < 0" evaluates to false', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 0
                        If( .Value1 < .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 0, 1, 0]);
                });

                it('"1 < 1" evaluates to false', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 1
                        If( .Value1 < .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, 1, 1]);
                });

                it('"0 <= 1" evaluates to true', () => {
                    const input = `
                        .Value1 = 0
                        .Value2 = 1
                        If( .Value1 <= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [0, 1, 0, 1, true]);
                });

                it('"1 <= 0" evaluates to false', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 0
                        If( .Value1 <= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 0, 1, 0]);
                });

                it('"1 <= 1" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 1
                        If( .Value1 <= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, 1, 1, true]);
                });

                it('"0 > 1" evaluates to false', () => {
                    const input = `
                        .Value1 = 0
                        .Value2 = 1
                        If( .Value1 > .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [0, 1, 0, 1]);
                });

                it('"1 > 0" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 0
                        If( .Value1 > .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 0, 1, 0, true]);
                });

                it('"1 > 1" evaluates to false', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 1
                        If( .Value1 > .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, 1, 1]);
                });

                it('"0 >= 1" evaluates to false', () => {
                    const input = `
                        .Value1 = 0
                        .Value2 = 1
                        If( .Value1 >= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [0, 1, 0, 1]);
                });

                it('"1 >= 0" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 0
                        If( .Value1 >= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 0, 1, 0, true]);
                });

                it('"1 >= 1" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 1
                        If( .Value1 >= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, 1, 1, true]);
                });
            });

            describe('string', () => {
                it('"{cat-literal} == {cat-literal}" evaluates to true', () => {
                    const input = `
                        If( 'cat' == 'cat' )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [true]);
                });

                it('"{cat-literal} == {dog-literal}" evaluates to false', () => {
                    const input = `
                        If( 'cat' == 'dog' )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, []);
                });

                it('"cat == {cat-literal}" evaluates to true', () => {
                    const input = `
                        .Value1 = 'cat'
                        If( .Value1 == 'cat' )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'cat', true]);
                });

                it('"{cat-literal} = cat" evaluates to true', () => {
                    const input = `
                        .Value1 = 'cat'
                        If( 'cat' == .Value1 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'cat', true]);
                });

                it('"cat == cat" evaluates to true', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'cat'
                        If( .Value1 == .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'cat', 'cat', 'cat', true]);
                });

                it('"cat == Cat" (different case) evaluates to false', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'Cat'
                        If( .Value1 == .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'Cat', 'cat', 'Cat']);
                });

                it('"cat == dog" evaluates to false', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'dog'
                        If( .Value1 == .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'dog', 'cat', 'dog']);
                });

                it('"cat != cat" evaluates to false', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'cat'
                        If( .Value1 != .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'cat', 'cat', 'cat']);
                });

                it('"cat != Cat" (different case) evaluates to true', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'Cat'
                        If( .Value1 != .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'Cat', 'cat', 'Cat', true]);
                });

                it('"cat != dog" evaluates to true', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'dog'
                        If( .Value1 != .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'dog', 'cat', 'dog', true]);
                });

                it('"cat < dog" evaluates to true', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'dog'
                        If( .Value1 < .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'dog', 'cat', 'dog', true]);
                });

                it('"dog < cat" evaluates to false', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'cat'
                        If( .Value1 < .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'cat', 'dog', 'cat']);
                });

                it('"dog < dog" evaluates to false', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'dog'
                        If( .Value1 < .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'dog', 'dog', 'dog']);
                });

                it('"Dog < dog" (different case) evaluates to true', () => {
                    const input = `
                        .Value1 = 'Dog'
                        .Value2 = 'dog'
                        If( .Value1 < .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['Dog', 'dog', 'Dog', 'dog', true]);
                });

                it('"dog < Dog" (different case) evaluates to false', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'Dog'
                        If( .Value1 < .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'Dog', 'dog', 'Dog']);
                });

                it('"cat <= dog" evaluates to true', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'dog'
                        If( .Value1 <= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'dog', 'cat', 'dog', true]);
                });

                it('"dog <= cat" evaluates to false', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'cat'
                        If( .Value1 <= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'cat', 'dog', 'cat']);
                });

                it('"dog <= dog" evaluates to true', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'dog'
                        If( .Value1 <= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'dog', 'dog', 'dog', true]);
                });

                it('"Dog <= dog" (different case) evaluates to true', () => {
                    const input = `
                        .Value1 = 'Dog'
                        .Value2 = 'dog'
                        If( .Value1 <= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['Dog', 'dog', 'Dog', 'dog', true]);
                });

                it('"dog <= Dog" (different case) evaluates to false', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'Dog'
                        If( .Value1 <= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'Dog', 'dog', 'Dog']);
                });

                it('"cat > dog" evaluates to false', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'dog'
                        If( .Value1 > .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'dog', 'cat', 'dog']);
                });

                it('"dog > cat" evaluates to true', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'cat'
                        If( .Value1 > .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'cat', 'dog', 'cat', true]);
                });

                it('"dog > dog" evaluates to false', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'dog'
                        If( .Value1 > .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'dog', 'dog', 'dog']);
                });

                it('"Dog > dog" (different case) evaluates to false', () => {
                    const input = `
                        .Value1 = 'Dog'
                        .Value2 = 'dog'
                        If( .Value1 > .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['Dog', 'dog', 'Dog', 'dog']);
                });

                it('"dog > Dog" (different case) evaluates to true', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'Dog'
                        If( .Value1 > .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'Dog', 'dog', 'Dog', true]);
                });

                it('"cat >= dog" evaluates to false', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'dog'
                        If( .Value1 >= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'dog', 'cat', 'dog']);
                });

                it('"dog >= cat" evaluates to true', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'cat'
                        If( .Value1 >= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'cat', 'dog', 'cat', true]);
                });

                it('"dog >= dog" evaluates to true', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'dog'
                        If( .Value1 >= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'dog', 'dog', 'dog', true]);
                });

                it('"Dog >= dog" (different case) evaluates to false', () => {
                    const input = `
                        .Value1 = 'Dog'
                        .Value2 = 'dog'
                        If( .Value1 >= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['Dog', 'dog', 'Dog', 'dog']);
                });

                it('"dog >= Dog" (different case) evaluates to true', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'Dog'
                        If( .Value1 >= .Value2 )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'Dog', 'dog', 'Dog', true]);
                });
            });

            it('comparing different types errors', () => {
                const input = `
                    .Value1 = 'dog'
                    .Value2 = 123
                    If( .Value1 == .Value2 )
                    {
                    }
                `;
                const expectedErrorMessage = `'If' condition comparison must compare variables of the same type, but LHS is a String and RHS is an Integer`;
                assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 24, 3, 42));
            });
        });

        describe('Presence in ArrayOfStrings', () => {
            it('present-literal-string "in" array of strings evaluates to true', () => {
                const input = `
                    .Haystack = {'a', 'b', 'c'}
                    If( 'b' in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    ['a', 'b', 'c'],
                    ['a', 'b', 'c'],
                    true,
                ]);
            });

            it('present-string "in" array of strings evaluates to true', () => {
                const input = `
                    .Needle = 'b'
                    .Haystack = {'a', 'b', 'c'}
                    If( .Needle in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    'b',
                    ['a', 'b', 'c'],
                    'b',
                    ['a', 'b', 'c'],
                    true
                ]);
            });

            it('not-present-string "in" array of strings evaluates to false', () => {
                const input = `
                    .Needle = 'd'
                    .Haystack = {'a', 'b', 'c'}
                    If( .Needle in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    'd',
                    ['a', 'b', 'c'],
                    'd',
                    ['a', 'b', 'c'],
                ]);
            });

            it('string "in" empty array evaluates to false', () => {
                const input = `
                    .Needle = 'b'
                    .Haystack = {}
                    If( .Needle in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    'b',
                    [],
                    'b',
                    [],
                ]);
            });

            it('present-string "not in" array of strings evaluates to false', () => {
                const input = `
                    .Needle = 'b'
                    .Haystack = {'a', 'b', 'c'}
                    If( .Needle not in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    'b',
                    ['a', 'b', 'c'],
                    'b',
                    ['a', 'b', 'c'],
                ]);
            });

            it('not-present-string "not in" array of strings evaluates to true', () => {
                const input = `
                    .Needle = 'd'
                    .Haystack = {'a', 'b', 'c'}
                    If( .Needle not in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    'd',
                    ['a', 'b', 'c'],
                    'd',
                    ['a', 'b', 'c'],
                    true
                ]);
            });

            it('string "not in" empty array evaluates to true', () => {
                const input = `
                    .Needle = 'b'
                    .Haystack = {}
                    If( .Needle not in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    'b',
                    [],
                    'b',
                    [],
                    true
                ]);
            });

            it('present-array-of-strings "in" array of strings evaluates to true', () => {
                const input = `
                    .Needle = {'d', 'b'}
                    .Haystack = {'a', 'b', 'c'}
                    If( .Needle in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    ['d', 'b'],
                    ['a', 'b', 'c'],
                    ['d', 'b'],
                    ['a', 'b', 'c'],
                    true
                ]);
            });

            it('not-present-array-of-strings "in" array of strings evaluates to false', () => {
                const input = `
                    .Needle = {'d'}
                    .Haystack = {'a', 'b', 'c'}
                    If( .Needle in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    ['d'],
                    ['a', 'b', 'c'],
                    ['d'],
                    ['a', 'b', 'c'],
                ]);
            });

            it('array of strings "in" empty array evaluates to false', () => {
                const input = `
                    .Needle = {'b'}
                    .Haystack = {}
                    If( .Needle in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    ['b'],
                    [],
                    ['b'],
                    [],
                ]);
            });

            it('empty array "in" empty array evaluates to false', () => {
                const input = `
                    .Needle = {}
                    .Haystack = {}
                    If( .Needle in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    [],
                    [],
                    [],
                    [],
                ]);
            });

            it('present-array-of-strings "not in" array of strings evaluates to false', () => {
                const input = `
                    .Needle = {'d', 'b'}
                    .Haystack = {'a', 'b', 'c'}
                    If( .Needle not in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    ['d', 'b'],
                    ['a', 'b', 'c'],
                    ['d', 'b'],
                    ['a', 'b', 'c'],
                ]);
            });

            it('not-present-array-of-strings "not in" array of strings evaluates to true', () => {
                const input = `
                    .Needle = {'d'}
                    .Haystack = {'a', 'b', 'c'}
                    If( .Needle not in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    ['d'],
                    ['a', 'b', 'c'],
                    ['d'],
                    ['a', 'b', 'c'],
                    true
                ]);
            });

            it('array of strings "not in" empty array evaluates to true', () => {
                const input = `
                    .Needle = {'b'}
                    .Haystack = {}
                    If( .Needle not in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    ['b'],
                    [],
                    ['b'],
                    [],
                    true
                ]);
            });

            it('empty array "not in" empty array evaluates to true', () => {
                const input = `
                    .Needle = {}
                    .Haystack = {}
                    If( .Needle not in .Haystack )
                    {
                        .Result = true
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    [],
                    [],
                    [],
                    [],
                    true
                ]);
            });

            it('errors if LHS is not a string or an array of strings (variation 1: array of non-strings)', () => {
                const input = `
                    .MyStruct = [ .A = 1 ]
                    .Needle = { .MyStruct }
                    .Haystack = { '123' }
                    If( .Needle in .Haystack )
                    {
                    }
                `;
                const expectedErrorMessage = `'If' 'in' condition left-hand-side value must be either a String or an Array of Strings, but instead is an Array of Structs`;
                assertEvaluationError(input, expectedErrorMessage, createParseRange(4, 24, 4, 31));
            });

            it('errors if LHS is not a string or an array of strings (variation 2: non-string, non-array)', () => {
                const input = `
                    .Needle = 123
                    .Haystack = { '123' }
                    If( .Needle in .Haystack )
                    {
                    }
                `;
                const expectedErrorMessage = `'If' 'in' condition left-hand-side value must be either a String or an Array of Strings, but instead is an Integer`;
                assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 24, 3, 31));
            });

            it('errors if LHS is not a string or an array of strings (variation 3: literal array of strings)', () => {
                const input = `
                    .Haystack = {'a'}
                    If( {'d'} in .Haystack )
                    {
                    }
                `;
                const expectedErrorMessage = `'If' 'in' condition left-hand-side value cannot be a literal Array Of Strings. Instead use an evaluated variable.`;
                assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 24, 2, 29));
            });

            it('errors if RHS is not an array of strings (variation 1: array of non-strings)', () => {
                const input = `
                    .Needle = {}
                    .MyStruct = [ .A = 1 ]
                    .Haystack = { .MyStruct }
                    If( .Needle in .Haystack )
                    {
                    }
                `;
                const expectedErrorMessage = `'If' 'in' condition right-hand-side value must be an Array of Strings, but instead is an Array of Structs`;
                assertEvaluationError(input, expectedErrorMessage, createParseRange(4, 35, 4, 44));
            });

            it('errors if RHS is not an array of strings (variation 2: non-array)', () => {
                const input = `
                    .Needle = {}
                    .Haystack = 123
                    If( .Needle in .Haystack )
                    {
                    }
                `;
                const expectedErrorMessage = `'If' 'in' condition right-hand-side value must be an Array of Strings, but instead is an Integer`;
                assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 35, 3, 44));
            });

            it('errors if RHS is not an array of strings (variation 3: literal array of strings)', () => {
                const input = `
                    If( 'a' in {'b'} )
                    {
                    }
                `;
                const expectedErrorMessage = `'If' 'in' condition right-hand-side value cannot be a literal Array Of Strings. Instead use an evaluated variable.`;
                assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 31, 1, 36));
            });
        });

        describe('Compound expression', () => {
            describe('Boolean compound expression', () => {
                class Comparison {
                    constructor(
                        readonly name: string,
                        readonly condition: string,
                        readonly compare: (values: boolean[]) => boolean
                    )
                    {
                    }
                }

                for (const value1 of [true, false]) {
                    for (const value2 of [true, false]) {
                        const comparisons2Values = [
                            new Comparison(` ${value1} &&  ${value2}`, ' .Value1 &&  .Value2', v => ( v[0] &&  v[1])),
                            new Comparison(`!${value1} &&  ${value2}`, '!.Value1 &&  .Value2', v => (!v[0] &&  v[1])),
                            new Comparison(` ${value1} && !${value2}`, ' .Value1 && !.Value2', v => ( v[0] && !v[1])),
                            new Comparison(`!${value1} && !${value2}`, '!.Value1 && !.Value2', v => (!v[0] && !v[1])),
                            new Comparison(` ${value1} ||  ${value2}`, ' .Value1 ||  .Value2', v => ( v[0] ||  v[1])),
                            new Comparison(`!${value1} ||  ${value2}`, '!.Value1 ||  .Value2', v => (!v[0] ||  v[1])),
                            new Comparison(` ${value1} || !${value2}`, ' .Value1 || !.Value2', v => ( v[0] || !v[1])),
                            new Comparison(`!${value1} || !${value2}`, '!.Value1 || !.Value2', v => (!v[0] || !v[1])),
                        ];
                        for (const comparison of comparisons2Values) {
                            it(comparison.name, () => {
                                const result = comparison.compare([value1, value2]);
                                const input = `
                                    .Value1 = ${value1}
                                    .Value2 = ${value2}
                                    If( ${comparison.condition} )
                                    {
                                        .Result = ${result}
                                    }
                                `;

                                const expectedEvaluatedVariables = [
                                    value1,
                                    value2,
                                    value1,
                                    value2,
                                ];
                                if (result) {
                                    expectedEvaluatedVariables.push(result);
                                }

                                assertEvaluatedVariablesValueEqual(input, expectedEvaluatedVariables);
                            });
                        }
                    }
                }

                for (const value1 of [true, false]) {
                    for (const value2 of [true, false]) {
                        for (const value3 of [true, false]) {
                            const comparisons3Values = [
                                new Comparison(`${value1} && ${value2} && ${value3}`, '.Value1 && .Value2 && .Value3', v => (v[0] && v[1] && v[2])),
                                new Comparison(`${value1} || ${value2} || ${value3}`, '.Value1 || .Value2 || .Value3', v => (v[0] || v[1] || v[2])),
                                new Comparison(`${value1} && ${value2} || ${value3}`, '.Value1 && .Value2 || .Value3', v => (v[0] && v[1] || v[2])),
                                new Comparison(`${value1} || ${value2} && ${value3}`, '.Value1 || .Value2 && .Value3', v => (v[0] || v[1] && v[2])),
                                new Comparison(`(${value1} && ${value2}) || ${value3}`, '(.Value1 && .Value2) || .Value3', v => ((v[0] && v[1]) || v[2])),
                                new Comparison(`${value1} && (${value2} || ${value3})`, '.Value1 && (.Value2 || .Value3)', v => (v[0] && (v[1] || v[2]))),
                                new Comparison(`(${value1} || ${value2}) && ${value3}`, '(.Value1 || .Value2) && .Value3', v => ((v[0] || v[1]) && v[2])),
                                new Comparison(`${value1} || (${value2} && ${value3})`, '.Value1 || (.Value2 && .Value3)', v => (v[0] || (v[1] && v[2]))),
                            ];
                            for (const comparison of comparisons3Values) {
                                it(comparison.name, () => {
                                    const result = comparison.compare([value1, value2, value3]);
                                    const input = `
                                        .Value1 = ${value1}
                                        .Value2 = ${value2}
                                        .Value3 = ${value3}
                                        If( ${comparison.condition} )
                                        {
                                            .Result = ${result}
                                        }
                                    `;

                                    const expectedEvaluatedVariables = [
                                        value1,
                                        value2,
                                        value3,
                                        value1,
                                        value2,
                                        value3,
                                    ];
                                    if (result) {
                                        expectedEvaluatedVariables.push(result);
                                    }

                                    assertEvaluatedVariablesValueEqual(input, expectedEvaluatedVariables);
                                });
                            }
                        }
                    }
                }
            });

            describe('Comparison compound expression', () => {
                it('"(0 < 1) && (0 > 1)" evaluates to false', () => {
                    const input = `
                        .Value1 = 0
                        .Value2 = 1
                        If( (.Value1 < .Value2) && (.Value1 > .Value2) )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [0, 1, 0, 1, 0, 1]);
                });

                it('"(0 < 1) || (0 > 1)" evaluates to true', () => {
                    const input = `
                        .Value1 = 0
                        .Value2 = 1
                        If( (.Value1 < .Value2) || (.Value1 > .Value2) )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [0, 1, 0, 1, 0, 1, true]);
                });

                it('"(0 > 1) || (0 < 1)" evaluates to true', () => {
                    const input = `
                        .Value1 = 0
                        .Value2 = 1
                        If( (.Value1 > .Value2) || (.Value1 < .Value2) )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [0, 1, 0, 1, 0, 1, true]);
                });
            });

            describe('Presence-in-ArrayOfStrings compound expression', () => {
                it('"(present-string in array of strings) && true" evaluates to true', () => {
                    const input = `
                        .Needle = 'b'
                        .Haystack = {'a', 'b', 'c'}
                        If( (.Needle in .Haystack) && true )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [
                        'b',
                        ['a', 'b', 'c'],
                        'b',
                        ['a', 'b', 'c'],
                        true
                    ]);
                });

                it('"(present-string in array of strings) && false" evaluates to false', () => {
                    const input = `
                        .Needle = 'b'
                        .Haystack = {'a', 'b', 'c'}
                        If( (.Needle in .Haystack) && false )
                        {
                            .Result = true
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [
                        'b',
                        ['a', 'b', 'c'],
                        'b',
                        ['a', 'b', 'c'],
                    ]);
                });
            });
        });
    });

    describe('User functions', () => {
        describe('Declare function without arguments', () => {
            //
            // Success cases: Basic no-arguments functions
            //

            it('Empty body', () => {
                const input = `
                    function Func(){
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, []);
            });

            it('Simple body', () => {
                const input = `
                    function Func()
                    {
                        Print( 'X' )
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, []);
            });

            it('Body on the same line', () => {
                const input = `
                    function Func(){ Print( 'X' ) }
                `;
                assertEvaluatedVariablesValueEqual(input, []);
            });

            //
            // Error cases: Malformed functions
            //

            it('Missing function name', () => {
                const input = `
                    function
                `;
                const expectedErrorMessage =
`Syntax error: Unexpected end of file.
Expecting to see the following:
 • function-name (example: "MyFunctionName")`;
                assertParseSyntaxError(input, expectedErrorMessage, createParseRange(3, 0, 3, 1));
            });

            it('Missing declaration of arguments (variation 1)', () => {
                const input = `
                    function Func
                `;
                const expectedErrorMessage =
`Syntax error: Unexpected end of file.
Expecting to see the following:
 • parameters-start: "("`;
                assertParseSyntaxError(input, expectedErrorMessage, createParseRange(3, 0, 3, 1));
            });

            it('Missing declaration of arguments (variation 2)', () => {
                const input = `
                    function Func{}
                `;
                const expectedErrorMessage =
`Syntax error: Unexpected input.
| function Func{}
|              ^
Expecting to see one of the following:
 • optional-whitespace-and-mandatory-newline (example: "<newline>")
 • parameters-start: "("
 • whitespace (example: " ")`;
                assertParseSyntaxError(input, expectedErrorMessage, createParseRange(1, 33, 1, 34));
            });

            it('Missing body', () => {
                const input = `
                    function Func()
                `;
                const expectedErrorMessage =
`Syntax error: Unexpected end of file.
Expecting to see the following:
 • scope-or-Array-start: "{"`;
                assertParseSyntaxError(input, expectedErrorMessage, createParseRange(3, 0, 3, 1));
            });

            it('Function name that is reserved', () => {
                const input = `
                    function true() {
                    }
                `;
                const expectedErrorMessage = 'Cannot use function name "true" because it is reserved.';
                assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 29, 1, 33));
            });

            // Error case: Duplicate definition. Functions must be uniquely named.
            it('Duplicate definition', () => {
                const input = `
                    function Func(){
                    }
                    function Func(){
                    }
                `;
                const expectedErrorMessage = 'Cannot use function name "Func" because it is already used by another user function. Functions must be uniquely named.';
                assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 29, 3, 33));
            });
        });

        describe('Declare function with arguments', () => {
            it('Single argument', () => {
                const input = `
                    function Func( .Arg ){
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, []);
            });

            it('Multiple arguments separated by spaces', () => {
                const input = `
                    function Func( .Arg1 .Arg2 .Arg3 ){
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, []);
            });

            it('Multiple arguments separated by commas', () => {
                const input = `
                    function Func( .Arg1, .Arg2, .Arg3 ){
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, []);
            });

            it('Arguments can have a trailing comma', () => {
                const input = `
                    function Func( .Arg1, ){
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, []);
            });

            it('Arguments must start with "."', () => {
                const input = `
                    function Func( Arg ){
                    }
                `;
                const expectedErrorMessage =
`Syntax error: Unexpected function-name: "Arg".
| function Func( Arg ){
|                ^^^
Expecting to see one of the following:
 • parameter-name (example: ".MyParameterName")
 • parameters-end: ")"`;
                assertParseSyntaxError(input, expectedErrorMessage, createParseRange(1, 35, 1, 36));
            });

            it('Argument names must be unique', () => {
                const input = `
                    function Func( .Arg .Arg ){
                    }
                `;
                const expectedErrorMessage = 'User-function argument names must be unique.';
                assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 40, 1, 44));
            });

            it('Body on the same line', () => {
                const input = `
                    function Func( .Arg ){ Print( .Arg ) }
                `;
                assertEvaluatedVariablesValueEqual(input, []);
            });
        });

        describe('Call function without arguments', () => {
            it('Empty body', () => {
                const input = `
                    function Func(){
                    }
                    Func()
                `;
                assertEvaluatedVariablesValueEqual(input, []);
            });

            it('Simple body', () => {
                const input = `
                    function Func()
                    {
                        .Value = 1
                        Print(.Value)
                    }
                    Func()
                `;
                assertEvaluatedVariablesValueEqual(input, [1, 1]);
            });

            it('Body on the same line', () => {
                const input = `
                    function Func(){ Print( 'X' ) }
                    Func()
                `;
                assertEvaluatedVariablesValueEqual(input, []);
            });

            it('Non-existent function', () => {
                const input = `
                    Func()
                `;
                const expectedErrorMessage = 'No function exists with the name "Func".';
                assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 20, 1, 24));
            });

            it('Missing arguments block', () => {
                const input = `
                    function Func(){
                    }
                    Func
                `;
                const expectedErrorMessage =
`Syntax error: Unexpected end of file.
Expecting to see the following:
 • function-parameters-start: "("`;
                assertParseSyntaxError(input, expectedErrorMessage, createParseRange(5, 0, 5, 1));
            });
        });

        describe('Call function with arguments', () => {
            it('Single literal argument', () => {
                const input = `
                    function Func(.Arg){
                        Print(.Arg)
                    }
                    Func(1)
                `;
                assertEvaluatedVariablesValueEqual(input, [1]);
            });

            it('Single evaluated argument', () => {
                const input = `
                    .MyVar = 1
                    function Func(.Arg){
                        Print(.Arg)
                    }
                    Func(.MyVar)
                `;
                assertEvaluatedVariablesValueEqual(input, [1, 1, 1]);
            });

            it('Body on the same line', () => {
                const input = `
                    function Func(.Arg){ Print(.Arg) }
                    Func(1)
                `;
                assertEvaluatedVariablesValueEqual(input, [1]);
            });

            it('Multiple arguments separated by spaces', () => {
                const input = `
                    function Func(.Arg1 .Arg2){
                        Print(.Arg1)
                        Print(.Arg2)
                    }
                    Func(1 2)
                `;
                assertEvaluatedVariablesValueEqual(input, [1, 2]);
            });

            it('Multiple arguments separated by commas', () => {
                const input = `
                    function Func(.Arg1, .Arg2){
                        Print(.Arg1)
                        Print(.Arg2)
                    }
                    Func(1, 2)
                `;
                assertEvaluatedVariablesValueEqual(input, [1, 2]);
            });

            it('Wrong number of arguments (takes 0, passing 1)', () => {
                const input = `
                    function Func(){
                    }
                    Func(1)
                `;
                const expectedErrorMessage = 'User function "Func" takes 0 arguments but passing 1.';
                assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 20, 3, 27));
            });

            it('Wrong number of arguments (takes 1, passing 0)', () => {
                const input = `
                    function Func(.Arg){
                    }
                    Func()
                `;
                const expectedErrorMessage = 'User function "Func" takes 1 argument but passing 0.';
                assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 20, 3, 26));
            });

            it('Wrong number of arguments (takes 2, passing 1)', () => {
                const input = `
                    function Func(.Arg1, .Arg2){
                    }
                    Func(1)
                `;
                const expectedErrorMessage = 'User function "Func" takes 2 arguments but passing 1.';
                assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 20, 3, 27));
            });
        });

        describe('Scope', () => {
            it('Functions cannot access variable defined outside the function (using current-scope access)', () => {
                const input = `
                    .MyVar = 'X'
                    function MyFunc(){
                        Print( .MyVar )
                    }
                    MyFunc()
                `;
                const expectedErrorMessage = 'Referencing variable "MyVar" that is not defined in the current scope or any of the parent scopes.';
                assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 31, 3, 37));
            });

            it('Functions cannot access variable defined outside the function (using parent-scope access)', () => {
                const input = `
                    .MyVar = 'X'
                    function MyFunc(){
                        Print( ^MyVar )
                    }
                    MyFunc()
                `;
                const expectedErrorMessage = 'Referencing variable "MyVar" in a parent scope that is not defined in any parent scope.';
                assertEvaluationError(input, expectedErrorMessage, createParseRange(3, 31, 3, 37));
            });
        });

        describe('Deferred evaluation', () => {
            it('Function evaluation is deferred until the call - Declaration works', () => {
                const input = `
                    function MyFunc(){
                        Print( .MyVar )
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, []);
            });

            it('Function evaluation is deferred until the call - Error occurs on invocation', () => {
                const input = `
                    function MyFunc(){
                        Print( .MyVar )
                    }
                    MyFunc()
                `;
                const expectedErrorMessage = 'Referencing variable "MyVar" that is not defined in the current scope or any of the parent scopes.';
                assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 31, 2, 37));
            });
        });

        describe('Nested functions', () => {
            it('Functions may call other functions', () => {
                const input = `
                    function FuncA() {
                        .MyVar = 1
                    }

                    function FuncB() {
                        FuncA()
                    }

                    FuncB()
                `;
                assertEvaluatedVariablesValueEqual(input, [1]);
            });
        });

        describe('Recursion', () => {
            it('Recursion is supported, and a general cap on depth complexity prevents stack overflows', () => {
                const input = `
                    function Func(){
                        Func()
                    }
                    Func()
                `;
                const expectedErrorMessage = 'Excessive scope depth. Possible infinite recursion from user function calls.';
                assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 24, 2, 30));
            });
        });
    });

    describe('#include', () => {
        it('basic include', () => {
            const result = evaluateInputs('file:///fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///fbuild.bff',
                    `
                        #include 'helper.bff'
                        Print( .FromHelper )
                    `
                ],
                [
                    'file:///helper.bff',
                    `
                        .FromHelper = 1
                    `
                ]
            ]), true /*enableDiagnostics*/);

            assert.deepStrictEqual(result.evaluatedVariables, [
                {
                    value: 1,
                    range: createFileRange('file:///helper.bff', 1, 24, 1, 35),
                },
                {
                    value: 1,
                    range: createFileRange('file:///fbuild.bff', 2, 31, 2, 42),
                }
            ]);

            const definitionFromHelper: VariableDefinition = {
                id: 1,
                range: createFileRange('file:///helper.bff', 1, 24, 1, 35),
                name: 'FromHelper',
            };

            assert.deepStrictEqual(result.variableDefinitions, [
                definitionFromHelper,  // FromHelper
            ]);

            assert.deepStrictEqual(result.variableReferences, [
                // helper.bff ".FromHelper = 1" LHS
                {
                    definition: definitionFromHelper,
                    range: createFileRange('file:///helper.bff', 1, 24, 1, 35),
                },
                // fbuild.bff "Print( .FromHelper )"
                {
                    definition: definitionFromHelper,
                    range: createFileRange('file:///fbuild.bff', 2, 31, 2, 42),
                },
            ]);
        });

        it('include the same file multiple times in a row', () => {
            const result = evaluateInputs('file:///some/path/fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///some/path/fbuild.bff',
                    `
                        .Name = 'Bobo'
                        #include 'greetings.bff'
                        #include 'greetings.bff'
                    `
                ],
                [
                    'file:///some/path/greetings.bff',
                    `
                        Print( 'Hello $Name$' )
                    `
                ],
            ]), true /*enableDiagnostics*/);

            assert.deepStrictEqual(result.evaluatedVariables, [
                {
                    value: 'Bobo',
                    range: createFileRange('file:///some/path/fbuild.bff', 1, 24, 1, 29),
                },
                {
                    value: 'Bobo',
                    range: createFileRange('file:///some/path/greetings.bff', 1, 38, 1, 44),
                },
                {
                    value: 'Bobo',
                    range: createFileRange('file:///some/path/greetings.bff', 1, 38, 1, 44),
                },
            ]);
        });

        it('include with ".."', () => {
            const result = evaluateInputs('file:///some/path/fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///some/path/fbuild.bff',
                    `
                        #include 'animals/dog.bff'
                        #include 'animals/cat.bff'
                    `
                ],
                [
                    'file:///some/path/greetings.bff',
                    `
                        .Message = 'Hello $Name$'
                    `
                ],
                [
                    'file:///some/path/animals/dog.bff',
                    `
                        .Name = 'dog'
                        #include '../greetings.bff'
                        Print( .Message )
                    `
                ],
                [
                    'file:///some/path/animals/cat.bff',
                    `
                        .Name = 'cat'
                        #include '../greetings.bff'
                        Print( .Message )
                    `
                ]
            ]), true /*enableDiagnostics*/);

            assert.deepStrictEqual(result.evaluatedVariables, [
                {
                    value: 'dog',
                    range: createFileRange('file:///some/path/animals/dog.bff', 1, 24, 1, 29),
                },
                {
                    value: 'dog',
                    range: createFileRange('file:///some/path/greetings.bff', 1, 42, 1, 48),
                },
                {
                    value: 'Hello dog',
                    range: createFileRange('file:///some/path/greetings.bff', 1, 24, 1, 32),
                },
                {
                    value: 'Hello dog',
                    range: createFileRange('file:///some/path/animals/dog.bff', 3, 31, 3, 39),
                },
                {
                    value: 'cat',
                    range: createFileRange('file:///some/path/animals/cat.bff', 1, 24, 1, 29),
                },
                {
                    value: 'cat',
                    range: createFileRange('file:///some/path/greetings.bff', 1, 42, 1, 48),
                },
                {
                    value: 'Hello cat',
                    range: createFileRange('file:///some/path/greetings.bff', 1, 24, 1, 32),
                },
                {
                    value: 'Hello cat',
                    range: createFileRange('file:///some/path/animals/cat.bff', 3, 31, 3, 39),
                },
            ]);
        });
    });

    describe('#once', () => {
        it('include the same file-with-#once multiple times from the same file', () => {
            const result = evaluateInputs('file:///some/path/fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///some/path/fbuild.bff',
                    `
                        .Name = 'Bobo'
                        #include 'greetings.bff'
                        #include 'greetings.bff'
                    `
                ],
                [
                    'file:///some/path/greetings.bff',
                    `
                        #once
                        Print( 'Hello $Name$' )
                    `
                ],
            ]), true /*enableDiagnostics*/);

            assert.deepStrictEqual(result.evaluatedVariables, [
                {
                    value: 'Bobo',
                    range: createFileRange('file:///some/path/fbuild.bff', 1, 24, 1, 29),
                },
                {
                    value: 'Bobo',
                    range: createFileRange('file:///some/path/greetings.bff', 2, 38, 2, 44),
                },
            ]);
        });

        it('include the same file-with-#once multiple times from different files', () => {
            const result = evaluateInputs('file:///some/path/fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///some/path/fbuild.bff',
                    `
                        #include 'animals/dog.bff'
                        #include 'animals/cat.bff'
                    `
                ],
                [
                    'file:///some/path/greetings.bff',
                    `
                        #once
                        Print( 'Hello $Name$' )
                    `
                ],
                [
                    'file:///some/path/animals/dog.bff',
                    `
                        .Name = 'dog'
                        #include '../greetings.bff'
                    `
                ],
                [
                    'file:///some/path/animals/cat.bff',
                    `
                        .Name = 'cat'
                        #include '../greetings.bff'
                    `
                ]
            ]), true /*enableDiagnostics*/);

            assert.deepStrictEqual(result.evaluatedVariables, [
                {
                    value: 'dog',
                    range: createFileRange('file:///some/path/animals/dog.bff', 1, 24, 1, 29),
                },
                {
                    value: 'dog',
                    range: createFileRange('file:///some/path/greetings.bff', 2, 38, 2, 44),
                },
                {
                    value: 'cat',
                    range: createFileRange('file:///some/path/animals/cat.bff', 1, 24, 1, 29),
                },
            ]);
        });

    });

    describe('#if / #else / #endif', () => {
        const builtInDefine = getPlatformSpecificDefineSymbol();

        it('A platform-specific symbol is defined', () => {
            const input = `
                #if ${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('"!DEFINE" on a defined symbol evaluates to false', () => {
            const input = `
                #if !${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, []);
        });

        it('"!DEFINE" on an undefined symbol evaluates to true', () => {
            const input = `
                #if ! NON_EXISTENT_SYMBOL
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('true && true evaulates to true', () => {
            const input = `
                #if ${builtInDefine} && ${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('true && false evaulates to false', () => {
            const input = `
                #if ${builtInDefine} && !${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, []);
        });

        it('false && true evaulates to false', () => {
            const input = `
                #if !${builtInDefine} && ${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, []);
        });

        it('false && false evaulates to false', () => {
            const input = `
                #if !${builtInDefine} && !${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, []);
        });

        it('true || true evaulates to true', () => {
            const input = `
                #if ${builtInDefine} || ${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('true || false evaulates to true', () => {
            const input = `
                #if ${builtInDefine} || !${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('false || true evaulates to true', () => {
            const input = `
                #if !${builtInDefine} || ${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('false || false evaulates to false', () => {
            const input = `
                #if !${builtInDefine} || !${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, []);
        });

        it('false && false || true evaulates to true (&& takes precedence over ||) variation 1', () => {
            const input = `
                #if !${builtInDefine} && !${builtInDefine} || ${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('true || false && false evaulates to true (&& takes precedence over ||) variation 1', () => {
            const input = `
                #if ${builtInDefine} || !${builtInDefine} && !${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('#else body is evaluated when the #if condition is false', () => {
            const input = `
                #if !${builtInDefine}
                    .Value = 'if'
                #else
                    .Value = 'else'
                #endif
            `;

            assertEvaluatedVariablesValueEqual(input, ['else']);
        });

        it('#if can be used inline in an assignment expression', () => {
            const input = `
                .Value
                    = 'A'
                #if ${builtInDefine}
                    + 'B'
                #endif
                    + 'C'
            `;

            assertEvaluatedVariablesValueEqual(input, ['ABC']);
        });

        it('#if / #else can be used inline in a String-assignment expression', () => {
            const input = `
                .Value
                    = 'A'
                #if !${builtInDefine}
                    + 'B'
                #else
                    + 'b'
                #endif
                    + 'C'
            `;

            assertEvaluatedVariablesValueEqual(input, ['AbC']);
        });

        it('#if / #else can be used inline in a StringArray-assignment expression', () => {
            const input = `
                .Value = {
                    'A'
                    #if ${builtInDefine}
                        'B'
                    #else
                        'b'
                    #endif
                    'C'
                }
            `;

            assertEvaluatedVariablesValueEqual(input, [['A', 'B', 'C']]);
        });

        it('#if / #else can be used inline in a Struct-assignment expression', () => {
            const input = `
                .Value = [
                    .A = 1
                    #if ${builtInDefine}
                        .B = 2
                    #else
                        .B = 22
                    #endif
                    .C = 3
                ]
            `;

            const myVarADefinition: VariableDefinition = { id: 1, range: createRange(2, 20, 2, 22), name: 'A' };
            const myVarBDefinition: VariableDefinition = { id: 2, range: createRange(4, 24, 4, 26), name: 'B' };
            const myVarCDefinition: VariableDefinition = { id: 3, range: createRange(8, 20, 8, 22), name: 'C' };
            assertEvaluatedVariablesValueEqual(input, [
                1,
                2,
                3,
                Struct.from(Object.entries({
                    A: new StructMember(1, myVarADefinition),
                    B: new StructMember(2, myVarBDefinition),
                    C: new StructMember(3, myVarCDefinition),
                }))
            ]);
        });
    });

    describe('#if exists', () => {
        const builtInDefine = getPlatformSpecificDefineSymbol();
        const builtInEnvVar = getPlatformSpecificEnvironmentVariable();

        it('"exists" evaluates to true if the environment variable exists', () => {
            const input = `
                #if exists(${builtInEnvVar})
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('"exists" evaluates to false if the environment variable does not exist', () => {
            const input = `
                #if exists(UNSET_ENV_VAR)
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, []);
        });

        it('Negating an existent result evaluates to false', () => {
            const input = `
                #if !exists( ${builtInEnvVar} )
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, []);
        });

        it('Negating a non-existent result evaluates to true', () => {
            const input = `
                #if !exists( UNSET_ENV_VAR )
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('"exists" can be combined with ||', () => {
            const input = `
                #if exists(UNSET_ENV_VAR) || ${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('"exists" can be combined with &&', () => {
            const input = `
                #if ${builtInDefine} && !exists(UNSET_ENV_VAR)
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });
    });

    describe('#if file_exists', () => {
        const builtInDefine = getPlatformSpecificDefineSymbol();

        it('"#if file_exists(...)" evaluates to true for a relative path that exists', () => {
            const result = evaluateInputs('file:///base/fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///base/fbuild.bff',
                    `
                        #if file_exists('sibling.txt')
                            .Value = true
                        #endif
                    `
                ],
                [
                    'file:///base/sibling.txt',
                    ''
                ],
            ]), true /*enableDiagnostics*/);
            const actualValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
            assert.deepStrictEqual(actualValues, [true]);
        });

        it('"#if file_exists(...)" evaluates to true for a relative path above the root FASTBuild file that exists', () => {
            const result = evaluateInputs('file:///base/fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///base/fbuild.bff',
                    `
                        #if file_exists('../uncle.txt')
                            .Value = true
                        #endif
                    `
                ],
                [
                    'file:///uncle.txt',
                    ''
                ],
            ]), true /*enableDiagnostics*/);
            const actualValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
            assert.deepStrictEqual(actualValues, [true]);
        });

        it('"#if file_exists(...)" evaluates to true for an absolute path that exists', () => {
            const result = evaluateInputs('file:///base/fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///base/fbuild.bff',
                    `
                        #if file_exists('/base/sibling.txt')
                            .Value = true
                        #endif
                    `
                ],
                [
                    'file:///base/sibling.txt',
                    ''
                ],
            ]), true /*enableDiagnostics*/);
            const actualValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
            assert.deepStrictEqual(actualValues, [true]);
        });

        it('"#if file_exists(...)" evaluates to false for a path that does not exist', () => {
            const input = `
                #if file_exists('path/that/does/not/exist.txt')
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, []);
        });

        it('"#if !file_exists(...)" evaluates to false for a path that exists', () => {
            const result = evaluateInputs('file:///base/fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///base/fbuild.bff',
                    `
                        #if !file_exists('sibling.txt')
                            .Value = true
                        #endif
                    `
                ],
                [
                    'file:///base/sibling.txt',
                    ''
                ],
            ]), true /*enableDiagnostics*/);
            const actualValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
            assert.deepStrictEqual(actualValues, []);
        });

        it('"#if !file_exists(...)" evaluates to true for a path that does not exist', () => {
            const input = `
                #if !file_exists('path/that/does/not/exist.txt')
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('"file_exists" can be combined with ||', () => {
            const input = `
                #if file_exists('path/that/does/not/exist.txt') || ${builtInDefine}
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('"file_exists" can be combined with &&', () => {
            const input = `
                #if ${builtInDefine} && file_exists('path/that/does/not/exist.txt')
                    .Value = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, []);
        });
    });

    describe('#define', () => {
        it('basic', () => {
            const input = `
                #define MY_DEFINE
                #if MY_DEFINE
                    .Result = true
                #endif
            `;

            const result = evaluateInput(input, true /*enableDiagnostics*/);
            const actualEvaluatedValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
            assert.deepStrictEqual(actualEvaluatedValues, [true]);

            // #define MY_DEFINE
            const expectedDefinitionMyDefine: VariableDefinition = {
                id: 1,
                range: createRange(1, 16, 1, 33),
                name: 'MY_DEFINE'
            };

            // .Result = true
            const expectedDefinitionResult: VariableDefinition = {
                id: 2,
                range: createRange(3, 20, 3, 27),
                name: 'Result'
            };

            assert.deepStrictEqual(result.variableDefinitions, [
                expectedDefinitionMyDefine,
                expectedDefinitionResult,
            ]);

            const expectedReferences: VariableReference[] = [
                // #define MY_DEFINE
                {
                    definition: expectedDefinitionMyDefine,
                    range: expectedDefinitionMyDefine.range,
                },
                // #if MY_DEFINE
                {
                    definition: expectedDefinitionMyDefine,
                    range: createRange(2, 20, 2, 29),
                },
                // .Result = true
                {
                    definition: expectedDefinitionResult,
                    range: expectedDefinitionResult.range,
                },
            ];
            assert.deepStrictEqual(result.variableReferences, expectedReferences);
        });

        it('defining an already defined symbol is an error', () => {
            const input = `
                #define MY_DEFINE
                #define MY_DEFINE
            `;
            const expectedErrorMessage = `Cannot #define already defined symbol "MY_DEFINE".`;
            assertEvaluationError(input, expectedErrorMessage, createParseRange(2, 16, 2, 33));
        });
    });

    describe('#undef', () => {
        it('basic', () => {
            const input = `
                #define MY_DEFINE
                #undef MY_DEFINE
                #if MY_DEFINE
                    .Result = true
                #endif
            `;
            assertEvaluatedVariablesValueEqual(input, []);

            const result = evaluateInput(input, true /*enableDiagnostics*/);
            const actualEvaluatedValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
            assert.deepStrictEqual(actualEvaluatedValues, []);

            //
            // The `#if MY_DEFINE` does not reference `MY_DEFINE` because it's already undefined
            //

            // #define MY_DEFINE
            const expectedDefinitionMyDefine: VariableDefinition = {
                id: 1,
                range: createRange(1, 16, 1, 33),
                name: 'MY_DEFINE'
            };

            assert.deepStrictEqual(result.variableDefinitions, [
                expectedDefinitionMyDefine,
            ]);

            const expectedReferences: VariableReference[] = [
                // #define MY_DEFINE
                {
                    definition: expectedDefinitionMyDefine,
                    range: createRange(1, 16, 1, 33),
                },
            ];
            assert.deepStrictEqual(result.variableReferences, expectedReferences);
        });

        it('undefining an undefined symbol is an error', () => {
            const input = `
                #undef MY_UNDEFINED_DEFINE
            `;
            const expectedErrorMessage = `Cannot #undef undefined symbol "MY_UNDEFINED_DEFINE".`;
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 16, 1, 42));
        });

        it('undefining a built-in symbol is an error', () => {
            const builtInDefine = getPlatformSpecificDefineSymbol();
            const input = `
                #undef ${builtInDefine}
            `;
            const expectedErrorMessage = `Cannot #undef built-in symbol "${builtInDefine}".`;
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 16, 1, 23 + builtInDefine.length));
        });
    });

    describe('#import', () => {
        it('#import of an environment variable that exists', () => {
            const builtInEnvVar = getPlatformSpecificEnvironmentVariable();
            const input = `
                #import ${builtInEnvVar}
                Print( .${builtInEnvVar} )
            `;
            const result = evaluateInput(input, true /*enableDiagnostics*/);

            const expectedDefinition: VariableDefinition =
            {
                id: 1,
                range: createRange(1, 16, 1, 24 + builtInEnvVar.length),
                name: builtInEnvVar
            };
            assert.deepStrictEqual(result.variableDefinitions, [expectedDefinition]);

            const expectedReferences: VariableReference[] = [
                // #import ${builtInEnvVar}
                {
                    definition: expectedDefinition,
                    range: createRange(1, 16, 1, 24 + builtInEnvVar.length),
                },
                // Print( .${builtInEnvVar} )
                {
                    definition: expectedDefinition,
                    range: createRange(2, 23, 2, 24 + builtInEnvVar.length),
                },
            ];
            assert.deepStrictEqual(result.variableReferences, expectedReferences);

            assert.strictEqual(result.evaluatedVariables.length, 1);
            assert.strictEqual(typeof result.evaluatedVariables[0].value, 'string');
        });

        it('#import of a non-existent environment variable', () => {
            const input = `
                #import UNSET_ENV_VAR
            `;
            const expectedErrorMessage = `Cannot import environment variable "UNSET_ENV_VAR" because it does not exist.`;
            assertEvaluationError(input, expectedErrorMessage, createParseRange(1, 16, 1, 37));
        });
    });
});

function getPlatformSpecificDefineSymbol(): string {
    const platform = os.platform();
    switch(platform) {
        case 'linux':
            return '__LINUX__';
        case 'darwin':
            return '__OSX__';
        case 'win32':
            return '__WINDOWS__';
        default:
            throw new Error(`Unsupported platform '${platform}`);
    }
}

// Returns an environment variable that is defined for the current platform.
function getPlatformSpecificEnvironmentVariable(): string {
    const platform = os.platform();
    switch(platform) {
        case 'linux':
            return 'HOME';
        case 'darwin':
            return 'HOME';
        case 'win32':
            return 'TMP';
        default:
            throw new Error(`Unsupported platform '${platform}`);
    }
}
