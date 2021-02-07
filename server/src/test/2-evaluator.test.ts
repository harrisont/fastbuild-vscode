import * as assert from 'assert';

// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

import * as os from 'os';
import * as path from 'path';

import {
    Maybe,
} from '../coreTypes';

import {
    evaluate,
    EvaluatedData,
    EvaluatedVariable,
    SourceRange,
    Struct,
    StructMember,
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
    
function evaluateInputs(thisFbuildUriStr: UriStr, inputs: Map<UriStr, FileContents>): EvaluatedData {
    const fileSystem = new MockFileSystem(inputs);
    const parseDataProvider = new ParseDataProvider(
        fileSystem,
        { enableDiagnostics: true }
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

function evaluateInput(input: FileContents): EvaluatedData {
    const thisFbuildUri = 'file:///dummy.bff';
    return evaluateInputs(thisFbuildUri, new Map<UriStr, FileContents>([[thisFbuildUri, input]]));
}

// Compares the parsed evaluatedVariables, but only the value, not the range.
function assertEvaluatedVariablesValueEqual(input: FileContents, expectedValues: Value[]): void {
    const result = evaluateInput(input);
    const actualValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
    assert.deepStrictEqual(actualValues, expectedValues);
}

describe('evaluator', () => {
    describe('evaluatedVariables value', () => {
        it('should be detected in a string with a variable', () => {
            const input = `
                .MyVar = 'MyValue'
                .Evaluated = 'pre-$MyVar$-post'
            `;
            assertEvaluatedVariablesValueEqual(input, ['MyValue']);
        });

        it('should be detected in a string with multiple variables', () => {
            const input = `
                .MyVar1 = 'MyValue1'
                .MyVar2 = 'MyValue2'
                .Evaluated = 'pre-$MyVar1$-$MyVar2$-post'
            `;
            assertEvaluatedVariablesValueEqual(input, ['MyValue1', 'MyValue2']);
        });

        it('should be detected in the RHS when assigning the value of another variable', () => {
            const input = `
                .MyVar = 1
                .Copy = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [1]);
        });

        it('should be detected in the RHS when assigning the value of another variable in the parent scope', () => {
            const input = `
                .MyVar = 1
                { // Start scope
                    .Copy = ^MyVar
                } // End scope
            `;
            assertEvaluatedVariablesValueEqual(input, [1]);
        });

        it('should be able to read a variable in a direct parent scope', () => {
            const input = `
                .Var1 = 1
                {// Start scope
                    .Var2 = .Var1
                }// End scope
            `;
            assertEvaluatedVariablesValueEqual(input, [1]);
        });
        
        it('should be able to read a variable in a grandparent scope (current scope reference)', () => {
            const input = `
                .Var1 = 1
                {
                    {
                        .Var2 = .Var1
                    }
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [1]);
        });
        
        it('should be able to read a variable in a grandparent scope (parent scope reference)', () => {
            const input = `
                .Var1 = 1
                {
                    {
                        .Var2 = ^Var1
                    }
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [1]);
        });

        it('should allow variables with the same name in different scopes', () => {
            const input = `
                {
                    .Var1 = 1
                    .Var2 = .Var1
                }
                {
                    .Var1 = 2
                    .Var2 = .Var1
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [1, 2]);
        });

        it('should allow a variable to shadow a variable with the same name in a parent scope', () => {
            const input = `
                .Var = 1
                {
                    .Var = 2
                    .Inner = .Var
                }
                .Outer = .Var
            `;
            assertEvaluatedVariablesValueEqual(input, [2, 1]);
        });

        it('should not be able to read a variable in a child scope', () => {
            const input = `
                {
                    .Var1 = 1
                }
                .Var2 = .Var1
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Referencing variable "Var1" that is not defined in the current scope or any of the parent scopes.',
                    range: createRange(4, 24, 4, 29)
                }
            );
        });

        it('should be able to write an existing variable in a direct parent scope', () => {
            const input = `
                .Var1 = 1
                {
                    ^Var1 = 2
                }
                .Var2 = .Var1
            `;
            assertEvaluatedVariablesValueEqual(input, [2]);
        });

        it('should be able to write an existing variable in a grandparent scope', () => {
            const input = `
                .Var1 = 1
                {
                    {
                        ^Var1 = 2
                    }
                }
                .Var2 = .Var1
            `;
            assertEvaluatedVariablesValueEqual(input, [2]);
        });

        it('should not be able to read a non-existant variable in a parent scope', () => {
            const input = `
                {
                    .Var1 = 0
                    .Var2 = ^Var1
                }
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Referencing variable "Var1" in a parent scope that is not defined in any parent scope.',
                    range: createRange(3, 28, 3, 33)
                }
            );
        });

        it('should not be able to write a non-existant variable in a parent scope', () => {
            const input = `
                {
                    .Var1 = 0
                    ^Var1 = 1
                }
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Referencing variable "Var1" in a parent scope that is not defined in any parent scope.',
                    range: createRange(3, 20, 3, 25)
                }
            );
        });

        it('should not be able to read a non-existant variable from the parent of the root scope ', () => {
            const input = `
                .Var1 = 0
                .Var2 = ^Var1
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot access parent scope because there is no parent scope.',
                    range: createRange(2, 24, 2, 29)
                }
            );
        });

        it('should not be able to write a non-existant variable from the parent of the root scope ', () => {
            const input = `
                .Var1 = 0
                ^Var1 = 1
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot access parent scope because there is no parent scope.',
                    range: createRange(2, 16, 2, 21)
                }
            );
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
            assertEvaluatedVariablesValueEqual(input, [2, 3, 1]);
        });

        it('should correctly evaulate an empty string literal', () => {
            const input = `
                .MyVar = ''
                .Result = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, ['']);
        });
    
        it('should evaluate an empty array', () => {
            const input = `
                .MyVar = {}
                .Copy = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [
                []
            ]);
        });
    
        it('should evaluate an array of string literals', () => {
            const input = `
                .MyVar = {
                    'thing1'
                    'thing2'
                }
                .Copy = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['thing1', 'thing2']
            ]);
        });
    
        it('should evaluate an array of string templates', () => {
            const input = `
                .Type = 'thing'
                .MyVar = {
                    '$Type$1'
                    '$Type$2'
                }
                .Copy = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'thing',
                'thing',
                ['thing1', 'thing2']
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
                .Copy = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'thing1',
                'thing2',
                ['thing1', 'thing2']
            ]);
        });
    
        it('should evaluate an array with just comments', () => {
            const input = `
                .MyVar = {
                    // Some comment
                }
                .Copy = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [
                []
            ]);
        });
    
        it('should evaluate an array with comments and items', () => {
            const input = `
                .MyVar = {
                    'a'
                    // 2nd letter
                    'b'
                    // ...and so on...
                }
                .Copy = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['a', 'b']
            ]);
        });

        it('should evaluate an empty struct', () => {
            const input = `
                .MyVar = []
                .Copy = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [
                new Struct()
            ]);
        });
    
        it('should evaluate a basic struct', () => {
            const input = `
                .MyVar = [
                    .MyBool = true
                    .MyInt = 123
                    .MyStr = 'Hello world!'
                ]
                .Copy = .MyVar
            `;
            const myVarMyBoolDefinition: VariableDefinition = { id: 1, range: createRange(2, 20, 2, 27) };
            const myVarMyIntDefinition: VariableDefinition = { id: 2, range: createRange(3, 20, 3, 26) };
            const myVarMyStrDefinition: VariableDefinition = { id: 3, range: createRange(4, 20, 4, 26) };
            assertEvaluatedVariablesValueEqual(input, [
                Struct.from(Object.entries({
                    MyBool: new StructMember(true, myVarMyBoolDefinition),
                    MyInt: new StructMember(123, myVarMyIntDefinition),
                    MyStr: new StructMember('Hello world!', myVarMyStrDefinition),
                }))
            ]);
        });
    
        it('should evaluate a basic struct with comments', () => {
            const input = `
                .MyVar = [ // Comment 1
                    .MyBool = true // Comment 2
                    // Comment 3
                    // Comment 4
                    .MyInt = 123
                ] // Comment 5
                .Copy = .MyVar
            `;
            const myVarMyBoolDefinition: VariableDefinition = { id: 1, range: createRange(2, 20, 2, 27) };
            const myVarMyIntDefinition: VariableDefinition = { id: 2, range: createRange(5, 20, 5, 26) };
            assertEvaluatedVariablesValueEqual(input, [
                Struct.from(Object.entries({
                    MyBool: new StructMember(true, myVarMyBoolDefinition),
                    MyInt: new StructMember(123, myVarMyIntDefinition),
                }))
            ]);
        });

        it('should evaluate a struct with an evaluated variable', () => {
            const input = `
                .B = 1
                .MyVar = [
                    .A = .B
                ]
                .Copy = .MyVar
            `;
            const myVarADefinition: VariableDefinition = { id: 2, range: createRange(3, 20, 3, 22) };
            assertEvaluatedVariablesValueEqual(input, [
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
                .Copy = .MyVar
            `;
            const myVarA1Definition: VariableDefinition = { id: 3, range: createRange(4, 20, 4, 23) };
            const myVarA2Definition: VariableDefinition = { id: 4, range: createRange(5, 20, 5, 23) };
            assertEvaluatedVariablesValueEqual(input, [
                1,
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
                    .MyArray = {1, 2, 3}
                ]
                .Copy = .MyVar
            `;
            const myVarMyArrayDefinition: VariableDefinition = { id: 1, range: createRange(2, 20, 2, 28) };
            assertEvaluatedVariablesValueEqual(input, [
                Struct.from(Object.entries({
                    MyArray: new StructMember([1, 2, 3], myVarMyArrayDefinition),
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
                .Copy = .MyVar
            `;
            const myVarMyStructMyIntDefinition: VariableDefinition = { id: 1, range: createRange(3, 24, 3, 30) };
            const myVarMyStructDefinition: VariableDefinition = { id: 2, range: createRange(2, 20, 2, 29) };
            const expectedMyStructValue = Struct.from(Object.entries({
                MyInt: new StructMember(1, myVarMyStructMyIntDefinition),
            }));
            assertEvaluatedVariablesValueEqual(input, [
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
                .Copy = .MyVar
            `;
            const struct1MyIntDefinition: VariableDefinition = { id: 1, range: createRange(1, 28, 1, 34) };
            const struct2MyIntDefinition: VariableDefinition = { id: 3, range: createRange(2, 28, 2, 34) };
            assertEvaluatedVariablesValueEqual(input, [
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

        it('should evaluate dynamic variable names on the RHS in the current scope', () => {
            const input = `
                .A_B_C = 'foo'
                .Middle = 'B'
                .MyVar = ."A_$Middle$_C"
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'B',
                'foo'
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
                'B',
                'foo'
            ]);
        });

        it('should evaluate dynamic variable names on the LHS in the current scope', () => {
            const input = `
                .Middle = 'B'
                ."A_$Middle$_C" = 'foo'
                .Copy = .A_B_C
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'B',
                'foo'
            ]);
        });

        it('should evaluate dynamic variable names on the LHS in the parent scope', () => {
            const input = `
                .A_B_C = ''
                .Middle = 'B'
                {
                    ^"A_$Middle$_C" = 'foo'
                }
                .Copy = .A_B_C
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'B',
                'foo'
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
            ]));
    
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
            ]));

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
                .Evaluated = .MySum
            `;
            assertEvaluatedVariablesValueEqual(input, [
                1,
                3
            ]);
        });

        it('should work on adding a string literal', () => {
            const input = `
                .MyMessage = 'hello'
                .MyMessage + ' world'
                .Evaluated = .MyMessage
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
                .Evaluated = .MyMessage
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'hello',
                'hello world'
            ]);
        });

        it('should work on adding a string with a variable', () => {
            const input = `
                .MyName = 'Bobo'
                .MyMessage = 'hello'
                .MyMessage + .MyName
                .Evaluated = .MyMessage
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Bobo',
                'hello',
                'helloBobo'
            ]);
        });

        it('should work on adding a string with a string template', () => {
            const input = `
                .MyName = 'Bobo'
                .MyMessage = 'hello'
                .MyMessage + ' $MyName$'
                .Evaluated = .MyMessage
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Bobo',
                'hello',
                'hello Bobo'
            ]);
        });

        it('adding a string literal should use the last referenced variable if none is specified', () => {
            const input = `
                .MyMessage = 'hello'
                            + ' world'
                .Evaluated = .MyMessage
            `;
            assertEvaluatedVariablesValueEqual(input, ['hello world']);
        });

        it('adding a string literal should use the last referenced variable if none is specified ("+" on same line)', () => {
            const input = `
                .MyMessage = 'hello' +
                                ' world'
                .Evaluated = .MyMessage
            `;
            assertEvaluatedVariablesValueEqual(input, ['hello world']);
        });

        it('adding a string literal should use the last referenced variable if none is specified (with comments)', () => {
            const input = `
                .MyMessage = 'hello' // Comment 1
                            // Comment 2
                            + ' world'
                .Evaluated = .MyMessage
            `;
            assertEvaluatedVariablesValueEqual(input, ['hello world']);
        });

        it('adding a string literal should use the last referenced variable if none is specified ("+" on same line, with comments)', () => {
            const input = `
                .MyMessage = 'hello' + // Comment 1
                                // Comment 2
                                ' world'
                .Evaluated = .MyMessage
            `;
            assertEvaluatedVariablesValueEqual(input, ['hello world']);
        });

        it('adding mulitple string literals should use the last referenced variable if none is specified', () => {
            const input = `
                .MyMessage = 'hello'
                            + ' world'
                            + '!'
                .Evaluated = .MyMessage
            `;
            assertEvaluatedVariablesValueEqual(input, ['hello world!']);
        });

        it('adding an evaluated variable should use the last referenced variable if none is specified', () => {
            const input = `
                .MyVar = 'world'
                .MyMessage = 'hello '
                            + .MyVar
                .Evaluated = .MyMessage
            `;
            assertEvaluatedVariablesValueEqual(input, ['world', 'hello world']);
        });

        it('adding mulitple evaluated variables should use the last referenced variable if none is specified', () => {
            const input = `
                .MyVar1 = 'world'
                .MyVar2 = '!'
                .MyMessage = 'hello '
                            + .MyVar1
                            + .MyVar2
                .Evaluated = .MyMessage
            `;
            assertEvaluatedVariablesValueEqual(input, ['world', '!', 'hello world!']);
        });

        it('adding mulitple evaluated variables should use the last referenced variable if none is specified (with comments)', () => {
            const input = `
                .MyVar1 = 'world'
                .MyVar2 = '!'
                .MyMessage = 'hello ' // Comment 1
                            + .MyVar1  // Comment 2
                            + .MyVar2
                .Evaluated = .MyMessage
            `;
            assertEvaluatedVariablesValueEqual(input, ['world', '!', 'hello world!']);
        });

        it('should work on adding a string literal to a variable in the parent scope', () => {
            const input = `
                .MyMessage = 'hello'
                {
                    ^MyMessage + ' world'
                    .Evaluated1 = .MyMessage
                }
                .Evaluated2 = .MyMessage
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'hello',
                'hello world',
                'hello world'
            ]);
        });

        it('should fail when adding a string to a variable not in scope (current scope)', () => {
            const input = `
                .MyMessage = 'hello'
                {
                    .MyMessage + ' world'
                }
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Referencing varable "MyMessage" that is not defined in the current scope.',
                    range: createRange(3, 20, 3, 30)
                }
            );
        });

        it('should fail when adding a string to a variable not in scope (parent scope)', () => {
            const input = `
                {
                    ^MyMessage + ' world'
                }
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Referencing variable "MyMessage" in a parent scope that is not defined in any parent scope.',
                    range: createRange(2, 20, 2, 30)
                }
            );
        });

        it('should work on adding an item to an array', () => {
            const input = `
                .MyVar = {}
                .MyVar + 'cow'
                .Result = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [
                [],
                ['cow']
            ]);
        });

        it('should work on inline adding an item to an array', () => {
            const input = `
                .MyVar = {} + 'cow'
                .Result = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [['cow']]);
        });

        it('should work on adding an array to an array', () => {
            const input = `
                .MyVar = {'a'}
                .MyVar + {'b'}
                .Result = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['a'],
                ['a', 'b']
            ]);
        });

        it('should work on inline adding an array to an array', () => {
            const input = `
                .MyVar = {'a'} + {'b'} + {'c'}
                .Result = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [['a', 'b', 'c']]);
        });

        it('should work on adding an array with an evaluated variable to an array', () => {
            const input = `
                .B = 'b'
                .MyVar = {'a'}
                .MyVar + {.B, 'c'}
                .Result = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'b',
                ['a'],
                ['a', 'b', 'c']
            ]);
        });

        it('should work on inline adding an array with an evaluated variable to an array', () => {
            const input = `
                .B = 'b'
                .MyVar = {'a'} + { .B , 'c'}
                .Result = .MyVar
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'b',
                ['a', 'b', 'c']
            ]);
        });

        it('should work on adding a struct to a struct', () => {
            const input = `
                .Struct1 = [ .A=0, .B=2 ]
                .Struct2 = [ .A=1, .C=3 ]
                .MyVar = .Struct1 + .Struct2
                .Result = .MyVar
            `;
            const struct1ADefinition: VariableDefinition = { id: 1, range: createRange(1, 29, 1, 31) };
            const struct1BDefinition: VariableDefinition = { id: 2, range: createRange(1, 35, 1, 37) };
            const struct2ADefinition: VariableDefinition = { id: 4, range: createRange(2, 29, 2, 31) };
            const struct2CDefinition: VariableDefinition = { id: 5, range: createRange(2, 35, 2, 37) };
            assertEvaluatedVariablesValueEqual(input, [
                Struct.from(Object.entries({
                    A: new StructMember(0, struct1ADefinition),
                    B: new StructMember(2, struct1BDefinition),
                })),
                Struct.from(Object.entries({
                    A: new StructMember(1, struct2ADefinition),
                    C: new StructMember(3, struct2CDefinition),
                })),
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
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add a String to an Integer. Can only add an Integer.',
                    range: createRange(2, 16, 2, 27)
                }
            );
        });

        it('should error on adding anything other than an integer (boolean) to an integer', () => {
            const input = `
                .LHS = 123
                .LHS + true
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add a Boolean to an Integer. Can only add an Integer.',
                    range: createRange(2, 16, 2, 27)
                }
            );
        });

        it('should error on adding anything other than an integer (struct) to an integer (via evaluated variable)', () => {
            const input = `
                .LHS = 123
                .RHS = [ .A = 1 ]
                .LHS + .RHS
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add a Struct to an Integer. Can only add an Integer.',
                    range: createRange(3, 16, 3, 27)
                }
            );
        });

        it('should error on inline adding anything other than an integer (boolean) to an integer', () => {
            const input = `
                .LHS = 123
                     + true
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add a Boolean to an Integer. Can only add an Integer.',
                    range: createRange(1, 23, 2, 27)
                }
            );
        });

        it('should error on inline adding anything other than an integer (string) to an integer (via evaluated variable)', () => {
            const input = `
                .LHS = 123
                .RHS = 'hi'
                .MyVar = .LHS + .RHS
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add a String to an Integer. Can only add an Integer.',
                    range: createRange(3, 25, 3, 36)
                }
            );
        });

        it('should error on inline adding anything other than an integer (boolean) to an integer (via evaluated variable)', () => {
            const input = `
                .LHS = 123
                .RHS = true
                .MyVar = .LHS + .RHS
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add a Boolean to an Integer. Can only add an Integer.',
                    range: createRange(3, 25, 3, 36)
                }
            );
        });

        it('should error on inline adding anything other than an integer (struct) to an integer (via evaluated variable)', () => {
            const input = `
                .LHS = 123
                .RHS = [ .A = 1 ]
                .MyVar = .LHS + .RHS
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add a Struct to an Integer. Can only add an Integer.',
                    range: createRange(3, 25, 3, 36)
                }
            );
        });

        it('should error on adding anything other than a string to a string', () => {
            const input = `
                .LHS = 'hi'
                .LHS + 123
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add an Integer to a String. Can only add a String.',
                    range: createRange(2, 16, 2, 26)
                }
            );
        });

        it('should error on inline adding anything other than a string (Integer) to a string (via direct value)', () => {
            const input = `
                .MyVar = 'hi' + 123
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add an Integer to a String. Can only add a String.',
                    range: createRange(1, 25, 1, 35)
                }
            );
        });

        it('should error on inline adding anything other than a string (Boolean) to a string (via direct value)', () => {
            const input = `
                .MyVar = 'hi' + true
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add a Boolean to a String. Can only add a String.',
                    range: createRange(1, 25, 1, 36)
                }
            );
        });

        it('should error on inline adding anything other than a string (array) to a string (via direct value)', () => {
            const input = `
                .MyVar = 'hi' + {}
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add an Array to a String. Can only add a String.',
                    range: createRange(1, 25, 1, 34)
                }
            );
        });

        it('should error on inline adding anything other than a string to a string (via evaluated variable)', () => {
            const input = `
                .LHS = 'hi'
                .RHS = 123
                .MyVar = .LHS + .RHS
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add an Integer to a String. Can only add a String.',
                    range: createRange(3, 25, 3, 36)
                }
            );
        });

        it('should error on adding anything to a boolean', () => {
            const input = `
                .LHS = true
                .LHS + 'hi'
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add to a Boolean.',
                    range: createRange(2, 16, 2, 27)
                }
            );
        });

        it('should error on inline adding anything (string) to a boolean (via direct value)', () => {
            const input = `
                .LHS = true
                     + 'hi'
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add to a Boolean.',
                    range: createRange(1, 23, 2, 27)
                }
            );
        });

        it('should error on inline adding anything to a boolean (via evaluated variable)', () => {
            const input = `
                .LHS = true
                .RHS = 'hi'
                .MyVar = .LHS + .RHS
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add to a Boolean.',
                    range: createRange(3, 25, 3, 36)
                }
            );
        });

        it('should error on adding anything other than a struct to a struct', () => {
            const input = `
                .Struct = [ .A = 1 ]
                .Struct + "hi"
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot add a String to a Struct. Can only add a Struct.',
                    range: createRange(2, 16, 2, 30)
                }
            );
        });
    });

    describe('subtraction', () => {
        it('integer subtraction', () => {
            const input = `
                .Value = 3
                .Value - 2
                Print( .Value )
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
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                1
            ]);
        });

        it('Substring removal', () => {
            const input = `
                .String = 'Good Bad Good'
                .String - 'Bad'
                Print( .String )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Good Bad Good',
                'Good  Good',
            ]);
        });

        it('Substring removal using variable', () => {
            const input = `
                .String = 'Good Bad Good'
                .Bad = 'Bad'
                .String - .Bad
                Print( .String )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Bad',
                'Good Bad Good',
                'Good  Good',
            ]);
        });
        
        it('Multiple string removals', () => {
            const input = `
                .String = 'Good Bad Good Bad Bad Good'
                .String - 'Bad'
                Print( .String )
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
                Print( .String )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Bad',
                'Good Bad Good Bad Bad Good',
                'Good  Good   Good',
            ]);
        });
        
        it('String remove not found', () => {
            const input = `
                .String = 'Good'
                .String - 'NotFound'
                Print( .String )
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
                Print( .String )
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
                Print( .String )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Good ',
            ]);
        });
        
        it('Inline string subtraction within words', () => {
            const input = `
                .String = 'GoBADod'
                        - 'BAD'
                Print( .String )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Good',
            ]);
        });
        
        it('Inline string subtraction must match case', () => {
            const input = `
                .String = 'Good'
                        - 'GOOD'
                Print( .String )
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
                Print( .String )
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
                Print( .String )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                '3',
            ]);
        });
        
        it('Remove from array of strings', () => {
            const input = `
                .Strings = { 'Good', 'Bad', 'Good' }
                .Strings - 'Bad'
                Print( .Strings )
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
                Print( .Strings )
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
                Print( .Strings )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Bad',
                ['Good', 'Bad', 'Good'],
                ['Good', 'Good'],
            ]);
        });
        
        it('Remove from array of strings inline using variable', () => {
            const input = `
                .Bad = 'Bad'
                .Strings = { 'Good', 'Bad', 'Good' }
                         - .Bad
                Print( .Strings )
            `;
            assertEvaluatedVariablesValueEqual(input, [
                'Bad',
                ['Good', 'Good'],
            ]);
        });
        
        it('Remove from empty array of strings', () => {
            const input = `
                .Strings = {}
                .Strings - 'NotFound'
                Print( .Strings )
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
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract a String from an Integer. Can only subtract an Integer.',
                    range: createRange(2, 16, 2, 27)
                }
            );
        });

        it('should error on inline subtracting anything other than an integer from an integer (via direct value)', () => {
            const input = `
                .LHS = 123
                     - 'hi'
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract a String from an Integer. Can only subtract an Integer.',
                    range: createRange(1, 23, 2, 27)
                }
            );
        });

        it('should error on inline subtracting anything other than an integer from an integer (via evaluated variable)', () => {
            const input = `
                .LHS = 123
                .RHS = 'hi'
                .MyVar = .LHS - .RHS
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract a String from an Integer. Can only subtract an Integer.',
                    range: createRange(3, 25, 3, 36)
                }
            );
        });

        it('should error on subtracting anything other than a string from a string', () => {
            const input = `
                .LHS = 'hi'
                .LHS - 123
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract an Integer from a String. Can only subtract a String.',
                    range: createRange(2, 16, 2, 26)
                }
            );
        });

        it('should error on inline subtracting anything other than a string (Integer) from a string (via direct value)', () => {
            const input = `
                .MyVar = 'hi' - 123
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract an Integer from a String. Can only subtract a String.',
                    range: createRange(1, 25, 1, 35)
                }
            );
        });

        it('should error on inline subtracting anything other than a string (Boolean) from a string (via direct value)', () => {
            const input = `
                .MyVar = 'hi' - true
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract a Boolean from a String. Can only subtract a String.',
                    range: createRange(1, 25, 1, 36)
                }
            );
        });

        it('should error on inline subtracting anything other than a string (Array) from a string (via direct value)', () => {
            const input = `
                .MyVar = 'hi' - {}
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract an Array from a String. Can only subtract a String.',
                    range: createRange(1, 25, 1, 34)
                }
            );
        });

        it('should error on inline subtracting anything other than a string from a string (via evaluated variable)', () => {
            const input = `
                .LHS = 'hi'
                .RHS = 123
                .MyVar = .LHS - .RHS
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract an Integer from a String. Can only subtract a String.',
                    range: createRange(3, 25, 3, 36)
                }
            );
        });

        it('should error on subtracting anything other than a string (boolean) from an array of strings', () => {
            const input = `
                .LHS = { 'a' }
                .LHS - true
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract a Boolean from an Array of Strings. Can only subtract a String.',
                    range: createRange(2, 16, 2, 27)
                }
            );
        });

        it('should error on subtracting anything other than a string (integer) from an array of strings', () => {
            const input = `
                .LHS = { 'a' }
                .LHS - 123
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract an Integer from an Array of Strings. Can only subtract a String.',
                    range: createRange(2, 16, 2, 26)
                }
            );
        });

        it('should error on subtracting anything other than a string (array) from an array of strings', () => {
            const input = `
                .LHS = { 'a' }
                .LHS - { 'b' }
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract an Array from an Array of Strings. Can only subtract a String.',
                    range: createRange(2, 16, 2, 30)
                }
            );
        });

        it('should error on subtracting anything other than a string (struct) from an array of strings', () => {
            const input = `
                .LHS = { 'a' }
                .LHS - [.A=1]
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract a Struct from an Array of Strings. Can only subtract a String.',
                    range: createRange(2, 16, 2, 29)
                }
            );
        });

        it('should error on inline subtracting anything other than a string from an array of strings', () => {
            const input = `
                .LHS = { 'a' }
                     - true
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract a Boolean from an Array of Strings. Can only subtract a String.',
                    range: createRange(1, 23, 2, 27)
                }
            );
        });

        it('should error on inline subtracting anything other than a string (via evaluated variable) from an array of strings', () => {
            const input = `
                .RHS = true
                .LHS = { 'a' }
                     - .RHS
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract a Boolean from an Array of Strings. Can only subtract a String.',
                    range: createRange(2, 23, 3, 27)
                }
            );
        });

        // The only type of array that can be subtracted from is an array of strings.
        it('should error on subtracting anything from an array of structs', () => {
            const input = `
                .LHS = { [.A=1] }
                     - 'a'
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract from an Array of Structs. Can only subtract from an Array if it is an Array of Strings.',
                    range: createRange(1, 23, 2, 26)
                }
            );
        });

        it('should error on subtracting anything from a boolean', () => {
            const input = `
                .LHS = true
                .LHS - 'hi'
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract from a Boolean.',
                    range: createRange(2, 16, 2, 27)
                }
            );
        });

        it('should error on inline subtracting anything from a boolean (via evaluated variable)', () => {
            const input = `
                .LHS = true
                .RHS = 'hi'
                .MyVar = .LHS - .RHS
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract from a Boolean.',
                    range: createRange(3, 25, 3, 36)
                }
            );
        });

        it('should error on subtracting anything from a struct', () => {
            const input = `
                .Struct1 = [ .A = 1 ]
                .Struct2 = []
                .Struct1 - .Struct2
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot subtract from a Struct.',
                    range: createRange(3, 16, 3, 35)
                }
            );
        });
    });

    describe('evaluatedVariables range', () => {
        it('should be detected in a string with multiple variables', () => {
            const input = `
                .MyVar1 = 'MyValue1'
                .MyVar2 = 'MyValue2'
                .Evaluated = 'pre-$MyVar1$-$MyVar2$-post'
            `;
            const result = evaluateInput(input);
            const expectedEvaluatedVariables: EvaluatedVariable[] = [
                {
                    value: 'MyValue1',
                    range: createRange(3, 34, 3, 42),
                },
                {
                    value: 'MyValue2',
                    range: createRange(3, 43, 3, 51),
                }
            ];
            assert.deepStrictEqual(result.evaluatedVariables, expectedEvaluatedVariables);
        });

        it('should be detected when assigning the value of another variable', () => {
            const input = `
                .MyVar = 'MyValue'
                .Copy = .MyVar
            `;
            const result = evaluateInput(input);
            const expectedEvaluatedVariables: EvaluatedVariable[] = [
                {
                    value: 'MyValue',
                    range: createRange(2, 24, 2, 30),
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
            const result = evaluateInput(input);
            const expectedDefinitions: VariableDefinition[] = [
                {
                    id: 1,
                    range: createRange(1, 16, 1, 22),
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
            const result = evaluateInput(input);
            const expectedReferences: VariableReference[] = [
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 22),
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
            const result = evaluateInput(input);
            const expectedReferences: VariableReference[] = [
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 22),
                    },
                    range: createRange(1, 16, 1, 22),
                },
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 22),
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
            const result = evaluateInput(input);
            const expectedReferences: VariableReference[] = [
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 23),
                    },
                    range: createRange(1, 16, 1, 23),
                },
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 23),
                    },
                    range: createRange(2, 26, 2, 33),
                },
                {
                    definition: {
                        id: 2,
                        range: createRange(2, 16, 2, 23),
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
            const result = evaluateInput(input);
            const expectedReferences: VariableReference[] = [
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 23),
                    },
                    range: createRange(1, 16, 1, 23),
                },
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 23),
                    },
                    range: createRange(2, 27, 2, 35),
                },
                {
                    definition: {
                        id: 2,
                        range: createRange(2, 16, 2, 23),
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
                .MyBoolCopy = .MyBool
                .MyIntCopy = .MyInt
                .MyStringCopy = .MyString
            `;
            const myStructMyBoolDefinition: VariableDefinition = { id: 2, range: createRange(3, 20, 3, 27) };
            const myStructMyIntDefinition: VariableDefinition = { id: 3, range: createRange(4, 20, 4, 26) };
            const myStructMyStringDefinition: VariableDefinition = { id: 4, range: createRange(5, 20, 5, 29) };
            assertEvaluatedVariablesValueEqual(input, [
                Struct.from(Object.entries({
                    MyBool: new StructMember(true, myStructMyBoolDefinition),
                    MyInt: new StructMember(1, myStructMyIntDefinition),
                    MyString: new StructMember('hello', myStructMyStringDefinition)
                })),
                true,
                1,
                'hello'
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
                .Copy = .Other
            `;
            const myStructMyBoolDefinition: VariableDefinition = { id: 2, range: createRange(3, 20, 3, 27) };
            const myStructMyIntDefinition: VariableDefinition = { id: 3, range: createRange(4, 20, 4, 26) };
            const myStructMyStringDefinition: VariableDefinition = { id: 4, range: createRange(5, 20, 5, 29) };
            const myStructMyEvaluatedVarDefinition: VariableDefinition = { id: 5, range: createRange(6, 20, 6, 35) };
            const usingMyStructRange = createRange(9, 20, 9, 36);
            const usingMyStructMyBoolDefinition: VariableDefinition = { id: 7, range: usingMyStructRange };
            const usingMyStructMyIntDefinition: VariableDefinition = { id: 8, range: usingMyStructRange };
            const usingMyStructMyStringDefinition: VariableDefinition = { id: 9, range: usingMyStructRange };
            const usingMyStructMyEvaluatedVarDefinition: VariableDefinition = { id: 10, range: usingMyStructRange };
            assertEvaluatedVariablesValueEqual(input, [
                'fun',
                // Using(.MyStruct)
                Struct.from(Object.entries({
                    MyBool: new StructMember(true, myStructMyBoolDefinition),
                    MyInt: new StructMember(1, myStructMyIntDefinition),
                    MyString: new StructMember('hello', myStructMyStringDefinition),
                    MyEvaluatedVar: new StructMember('fun', myStructMyEvaluatedVarDefinition)
                })),
                // .Copy = .Other
                Struct.from(Object.entries({
                    MyBool: new StructMember(true, usingMyStructMyBoolDefinition),
                    MyInt: new StructMember(1, usingMyStructMyIntDefinition),
                    MyString: new StructMember('hello', usingMyStructMyStringDefinition),
                    MyEvaluatedVar: new StructMember('fun', usingMyStructMyEvaluatedVarDefinition)
                }))
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
            
            const result = evaluateInput(input);

            const rangeMyVar1 = createFileRange('file:///dummy.bff', 1, 16, 1, 23);
            const rangeMyStructMyVar1 = createFileRange('file:///dummy.bff', 3, 20, 3, 27);
            const rangeMyStructMyVar2 = createFileRange('file:///dummy.bff', 4, 20, 4, 27);
            const rangeMyStruct = createFileRange('file:///dummy.bff', 2, 16, 2, 25);
            const rangeUsingStatement = createFileRange('file:///dummy.bff', 6, 16, 6, 34);
            const rangeUsingStructVar = createFileRange('file:///dummy.bff', 6, 23, 6, 32);

            const definitionMyVar1 = { id: 1, range:  rangeMyVar1 };  // MyVar1
            const definitionMyStructMyVar1 = { id: 2, range: rangeMyStructMyVar1 };  // MyStruct's MyVar1
            const definitionMyStructMyVar2 = { id: 3, range: rangeMyStructMyVar2 };  // MyStruct's MyVar2
            const definitionMyStruct = { id: 4, range: rangeMyStruct };  // MyStruct
            const definitionMyVar2 = { id: 5, range: rangeUsingStatement };  // MyVar2
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
                Print( .MyStruct3 )
            `;
            const myStruct1MyIntDefinition: VariableDefinition = { id: 1, range: createRange(2, 20, 2, 26) };
            const usingMyStruct1MyIntDefinition: VariableDefinition = { id: 3, range: createRange(5, 20, 5, 39) };
            const usingMyStruct2MyIntDefinition: VariableDefinition = { id: 5, range: createRange(8, 20, 8, 39) };
            assertEvaluatedVariablesValueEqual(input, [
                // Using( .MyStruct1 )
                Struct.from(Object.entries({
                    MyInt: new StructMember(1, myStruct1MyIntDefinition),
                })),
                // Using( .MyStruct2 )
                Struct.from(Object.entries({
                    MyInt: new StructMember(1, usingMyStruct1MyIntDefinition),
                })),
                // Print( .MyStruct3 )
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
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: `'Using' parameter must be a Struct, but instead is an Integer`,
                    range: createRange(2, 23, 2, 29)
                }
            );
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
            const myStructStructVar1Definition: VariableDefinition = { id: 1, range: createRange(3, 20, 3, 31) };
            assertEvaluatedVariablesValueEqual(input, [
                Struct.from(Object.entries({
                    StructVar1: new StructMember(1, myStructStructVar1Definition)
                })),
            ]);
        });
    });

    describe('ForEach', () => {
        it('iterates over an array of strings', () => {
            const input = `
                .MyArray = {'a', 'b', 'c'}
                ForEach( .Item in .MyArray ) // Comment 1
                { // Comment 2
                    .Copy = .Item
                } // Comment 3
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['a', 'b', 'c'],
                'a',
                'b',
                'c'
            ]);
        });

        it('iterates over an empty array', () => {
            const input = `
                .MyArray = {}
                ForEach( .Item in .MyArray )// Comment 1
                {// Comment 2
                    .Copy = .Item
                }// Comment 3
            `;
            assertEvaluatedVariablesValueEqual(input, [
                []
            ]);
        });

        it('iterates over an array of strings in a parent scope', () => {
            const input = `
                .MyArray = {'a', 'b', 'c'}
                {
                    ForEach( .Item in .MyArray )
                    {
                        .Copy = .Item
                    }
                }
            `;
            assertEvaluatedVariablesValueEqual(input, [
                ['a', 'b', 'c'],
                'a',
                'b',
                'c'
            ]);
        });

        it('iterates over an array of structs', () => {
            const input = `
                .MyArray = {
                    [ .Value = 1 ]
                    [ .Value = 2 ]
                }
                ForEach( .Item in .MyArray )
                {
                    .Copy = .Item
                }
            `;
            const myArray1ValueDefinition: VariableDefinition = { id: 1, range: createRange(2, 22, 2, 28) };
            const myArray2ValueDefinition: VariableDefinition = { id: 2, range: createRange(3, 22, 3, 28) };
            assertEvaluatedVariablesValueEqual(input, [
                [
                    Struct.from(Object.entries({
                        Value: new StructMember(1, myArray1ValueDefinition)
                    })),
                    Struct.from(Object.entries({
                        Value: new StructMember(2, myArray2ValueDefinition)
                    }))
                ],
                Struct.from(Object.entries({
                    Value: new StructMember(1, myArray1ValueDefinition)
                })),
                Struct.from(Object.entries({
                    Value: new StructMember(2, myArray2ValueDefinition)
                }))
            ]);
        });

        it('Loop variable must be an array', () => {
            const input = `
                .MyArray = 123
                ForEach( .Item in .MyArray )
                {
                }
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: `'ForEach' variable to loop over must be an Array, but instead is an Integer`,
                    range: createRange(2, 34, 2, 42)
                }
            );
        });
    });

    // Functions that we don't care about handling, but we just need to make sure that their statements are evaluated.
    describe('Generic functions', () => {
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
                it('handles a literal alias name', () => {
                    const input = `
                        ${functionName}('MyAliasName') // Comment 1
                        { // Comment 2
                        } // Comment 3
                    `;
                    assertEvaluatedVariablesValueEqual(input, []);
                });
        
                it('handles an evaluated variable alias name', () => {
                    const input = `
                        .MyAliasName = 'SomeName'
                        ${functionName}(.MyAliasName)// Comment 1
                        {// Comment 2
                        }// Comment 3
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['SomeName']);
                });
        
                it('handles a dynamic-variable alias name', () => {
                    const input = `
                        .MyAliasName = 'SomeName'
                        .AliasNameVariable = 'MyAliasName'
                        ${functionName}(.'$AliasNameVariable$')
                        {
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [
                        'MyAliasName',
                        'SomeName'
                    ]);
                });
        
                it('errors if the evaluated variable alias name is not a string', () => {
                    const input = `
                        .MyAliasName = 123
                        ${functionName}( .MyAliasName )
                        {
                        }
                    `;
                    assert.throws(
                        () => evaluateInput(input),
                        {
                            name: 'EvaluationError',
                            message: `Alias must evaluate to a String, but instead evaluates to an Integer`,
                            range: createRange(2, 26 + functionName.length, 2, 38 + functionName.length)
                        }
                    );
                });
        
                it('evaluates body statements', () => {
                    const input = `
                        .MyVar = 1
                        ${functionName}('MyAliasName')
                        {
                            .Copy = .MyVar
                            .Copy = ^MyVar
                        }
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1]);
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
                assertEvaluatedVariablesValueEqual(input, [1]);
            });
        });
        
        describe('Print', () => {
            it('Print string', () => {
                const input = `
                    .Value = 1
                    Print('Value is $Value$')
                `;
                assertEvaluatedVariablesValueEqual(input, [1]);
            });
            
            it('Print string variable', () => {
                const input = `
                    .Value = 'hello'
                    Print(.Value)
                `;
                assertEvaluatedVariablesValueEqual(input, ['hello']);
            });
            
            it('Print integer variable', () => {
                const input = `
                    .Value = 123
                    Print(.Value)
                `;
                assertEvaluatedVariablesValueEqual(input, [123]);
            });
        });

        describe('Settings', () => {
            it('Basic', () => {
                const input = `
                    .Value = 1
                    Settings
                    {
                        .Copy = .Value
                    }
                `;
                assertEvaluatedVariablesValueEqual(input, [1]);
            });
            
            it('Settings with comments', () => {
                const input = `
                    .Value = 1
                    Settings // Comment 1
                    { // Comment 2
                        .Copy = .Value
                    } // Comment 3
                `;
                assertEvaluatedVariablesValueEqual(input, [1]);
            });
        });
    });

    describe('If', () => {
        describe('Boolean expression', () => {
            it('evaluates a true boolean variable to true', () => {
                const input = `
                    .Value = true
                    .Result = false
                    If( .Value ) // Comment 1
                    { // Comment 2
                        ^Result = true
                    } // Comment 3
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [true, true]);
            });
            
            it('evaluates a false boolean variable to false', () => {
                const input = `
                    .Value = false
                    .Result = false
                    If( .Value )// Comment 1
                    {// Comment 2
                        ^Result = true
                    }// Comment 3
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [false, false]);
            });

            it('evaluates the inversion of a true boolean variable to false', () => {
                const input = `
                    .Value = true
                    .Result = false
                    If( !.Value )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [true, false]);
            });
            
            it('evaluates the inversion of a false boolean variable to true', () => {
                const input = `
                    .Value = false
                    .Result = false
                    If( !.Value )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [false, true]);
            });
            
            it('errors on using a non-boolean variable for the condition', () => {
                const input = `
                    .Value = 123
                    If( .Value )
                    {
                    }
                `;
                assert.throws(
                    () => evaluateInput(input),
                    {
                        name: 'EvaluationError',
                        message: `Condition must evaluate to a Boolean, but instead evaluates to an Integer`,
                        range: createRange(2, 24, 2, 30)
                    }
                );
            });
        });
        
        describe('Comparison', () => {
            describe('boolean', () => {
                it('"true == true" evaluates to true', () => {
                    const input = `
                        .Value1 = true
                        .Value2 = true
                        .Result = false
                        If( .Value1 == .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [true, true, true]);
                });

                it('"false == false" evaluates to true', () => {
                    const input = `
                        .Value1 = false
                        .Value2 = false
                        .Result = false
                        If( .Value1 == .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [false, false, true]);
                });
                
                it('"true == false" evaluates to false', () => {
                    const input = `
                        .Value1 = true
                        .Value2 = false
                        .Result = false
                        If( .Value1 == .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [true, false, false]);
                });
                
                it('"false == true" evaluates to false', () => {
                    const input = `
                        .Value1 = false
                        .Value2 = true
                        .Result = false
                        If( .Value1 == .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [false, true, false]);
                });

                it('"true != true" evaluates to false', () => {
                    const input = `
                        .Value1 = true
                        .Value2 = true
                        .Result = false
                        If( .Value1 != .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [true, true, false]);
                });
                
                it('"false != false" evaluates to false', () => {
                    const input = `
                        .Value1 = false
                        .Value2 = false
                        .Result = false
                        If( .Value1 != .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [false, false, false]);
                });
                
                it('"true != false" evaluates to true', () => {
                    const input = `
                        .Value1 = true
                        .Value2 = false
                        .Result = false
                        If( .Value1 != .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [true, false, true]);
                });
                
                it('"false != true" evaluates to true', () => {
                    const input = `
                        .Value1 = false
                        .Value2 = true
                        .Result = false
                        If( .Value1 != .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [false, true, true]);
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
                        assert.throws(
                            () => evaluateInput(input),
                            {
                                name: 'EvaluationError',
                                message: `'If' comparison of booleans only supports '==' and '!=', but instead is '${operator}'`,
                                range: createRange(3, 40, 3, 40 + operator.length)
                            }
                        );
                    });
                }
            });

            describe('integer', () => {
                it('"1 == 1" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 1
                        .Result = false
                        If( .Value1 == .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, true]);
                });
                
                it('"1 == 0" evaluates to false', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 0
                        .Result = false
                        If( .Value1 == .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 0, false]);
                });
                
                it('"1 != 1" evaluates to false', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 1
                        .Result = false
                        If( .Value1 != .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, false]);
                });
                
                it('"1 != 0" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 0
                        .Result = false
                        If( .Value1 != .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 0, true]);
                });

                it('"0 < 1" evaluates to true', () => {
                    const input = `
                        .Value1 = 0
                        .Value2 = 1
                        .Result = false
                        If( .Value1 < .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [0, 1, true]);
                });

                it('"1 < 0" evaluates to false', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 0
                        .Result = false
                        If( .Value1 < .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 0, false]);
                });

                it('"1 < 1" evaluates to false', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 1
                        .Result = false
                        If( .Value1 < .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, false]);
                });

                it('"0 <= 1" evaluates to true', () => {
                    const input = `
                        .Value1 = 0
                        .Value2 = 1
                        .Result = false
                        If( .Value1 <= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [0, 1, true]);
                });

                it('"1 <= 0" evaluates to false', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 0
                        .Result = false
                        If( .Value1 <= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 0, false]);
                });

                it('"1 <= 1" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 1
                        .Result = false
                        If( .Value1 <= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, true]);
                });

                it('"0 > 1" evaluates to false', () => {
                    const input = `
                        .Value1 = 0
                        .Value2 = 1
                        .Result = false
                        If( .Value1 > .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [0, 1, false]);
                });

                it('"1 > 0" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 0
                        .Result = false
                        If( .Value1 > .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 0, true]);
                });

                it('"1 > 1" evaluates to false', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 1
                        .Result = false
                        If( .Value1 > .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, false]);
                });

                it('"0 >= 1" evaluates to false', () => {
                    const input = `
                        .Value1 = 0
                        .Value2 = 1
                        .Result = false
                        If( .Value1 >= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [0, 1, false]);
                });

                it('"1 >= 0" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 0
                        .Result = false
                        If( .Value1 >= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 0, true]);
                });

                it('"1 >= 1" evaluates to true', () => {
                    const input = `
                        .Value1 = 1
                        .Value2 = 1
                        .Result = false
                        If( .Value1 >= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, [1, 1, true]);
                });
            });

            describe('string', () => {
                it('"cat == cat" evaluates to true', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'cat'
                        .Result = false
                        If( .Value1 == .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'cat', true]);
                });

                it('"cat == Cat" (different case) evaluates to false', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'Cat'
                        .Result = false
                        If( .Value1 == .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'Cat', false]);
                });
                
                it('"cat == dog" evaluates to false', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 == .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'dog', false]);
                });
                
                it('"cat != cat" evaluates to false', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'cat'
                        .Result = false
                        If( .Value1 != .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'cat', false]);
                });
                
                it('"cat != Cat" (different case) evaluates to true', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'Cat'
                        .Result = false
                        If( .Value1 != .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'Cat', true]);
                });
                
                it('"cat != dog" evaluates to true', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 != .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'dog', true]);
                });

                it('"cat < dog" evaluates to true', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 < .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'dog', true]);
                });

                it('"dog < cat" evaluates to false', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'cat'
                        .Result = false
                        If( .Value1 < .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'cat', false]);
                });

                it('"dog < dog" evaluates to false', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 < .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'dog', false]);
                });

                it('"Dog < dog" (different case) evaluates to true', () => {
                    const input = `
                        .Value1 = 'Dog'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 < .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['Dog', 'dog', true]);
                });

                it('"dog < Dog" (different case) evaluates to false', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'Dog'
                        .Result = false
                        If( .Value1 < .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'Dog', false]);
                });

                it('"cat <= dog" evaluates to true', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 <= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'dog', true]);
                });

                it('"dog <= cat" evaluates to false', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'cat'
                        .Result = false
                        If( .Value1 <= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'cat', false]);
                });

                it('"dog <= dog" evaluates to true', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 <= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'dog', true]);
                });

                it('"Dog <= dog" (different case) evaluates to true', () => {
                    const input = `
                        .Value1 = 'Dog'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 <= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['Dog', 'dog', true]);
                });

                it('"dog <= Dog" (different case) evaluates to false', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'Dog'
                        .Result = false
                        If( .Value1 <= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'Dog', false]);
                });

                it('"cat > dog" evaluates to false', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 > .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'dog', false]);
                });

                it('"dog > cat" evaluates to true', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'cat'
                        .Result = false
                        If( .Value1 > .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'cat', true]);
                });

                it('"dog > dog" evaluates to false', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 > .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'dog', false]);
                });

                it('"Dog > dog" (different case) evaluates to false', () => {
                    const input = `
                        .Value1 = 'Dog'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 > .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['Dog', 'dog', false]);
                });

                it('"dog > Dog" (different case) evaluates to true', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'Dog'
                        .Result = false
                        If( .Value1 > .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'Dog', true]);
                });

                it('"cat >= dog" evaluates to false', () => {
                    const input = `
                        .Value1 = 'cat'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 >= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['cat', 'dog', false]);
                });

                it('"dog >= cat" evaluates to true', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'cat'
                        .Result = false
                        If( .Value1 >= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'cat', true]);
                });

                it('"dog >= dog" evaluates to true', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 >= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'dog', true]);
                });

                it('"Dog >= dog" (different case) evaluates to false', () => {
                    const input = `
                        .Value1 = 'Dog'
                        .Value2 = 'dog'
                        .Result = false
                        If( .Value1 >= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['Dog', 'dog', false]);
                });

                it('"dog >= Dog" (different case) evaluates to true', () => {
                    const input = `
                        .Value1 = 'dog'
                        .Value2 = 'Dog'
                        .Result = false
                        If( .Value1 >= .Value2 )
                        {
                            ^Result = true
                        }
                        .Copy = .Result
                    `;
                    assertEvaluatedVariablesValueEqual(input, ['dog', 'Dog', true]);
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
                assert.throws(
                    () => evaluateInput(input),
                    {
                        name: 'EvaluationError',
                        message: `'If' condition comparison must compare variables of the same type, but LHS is a String and RHS is an Integer`,
                        range: createRange(3, 24, 3, 42)
                    }
                );
            });
        });
        
        describe('Presence in ArrayOfStrings', () => {
            it('present-string "in" array of strings evaluates to true', () => {
                const input = `
                    .Needle = 'b'
                    .Haystack = {'a', 'b', 'c'}
                    .Result = false
                    If( .Needle in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    'b',
                    ['a', 'b', 'c'],
                    true
                ]);
            });

            it('not-present-string "in" array of strings evaluates to false', () => {
                const input = `
                    .Needle = 'd'
                    .Haystack = {'a', 'b', 'c'}
                    .Result = false
                    If( .Needle in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    'd',
                    ['a', 'b', 'c'],
                    false
                ]);
            });

            it('string "in" empty array evaluates to false', () => {
                const input = `
                    .Needle = 'b'
                    .Haystack = {}
                    .Result = false
                    If( .Needle in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    'b',
                    [],
                    false
                ]);
            });
            
            it('present-string "not in" array of strings evaluates to false', () => {
                const input = `
                    .Needle = 'b'
                    .Haystack = {'a', 'b', 'c'}
                    .Result = false
                    If( .Needle not in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    'b',
                    ['a', 'b', 'c'],
                    false
                ]);
            });

            it('not-present-string "not in" array of strings evaluates to true', () => {
                const input = `
                    .Needle = 'd'
                    .Haystack = {'a', 'b', 'c'}
                    .Result = false
                    If( .Needle not in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    'd',
                    ['a', 'b', 'c'],
                    true
                ]);
            });

            it('string "not in" empty array evaluates to true', () => {
                const input = `
                    .Needle = 'b'
                    .Haystack = {}
                    .Result = false
                    If( .Needle not in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    'b',
                    [],
                    true
                ]);
            });
            
            it('present-array-of-strings "in" array of strings evaluates to true', () => {
                const input = `
                    .Needle = {'d', 'b'}
                    .Haystack = {'a', 'b', 'c'}
                    .Result = false
                    If( .Needle in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    ['d', 'b'],
                    ['a', 'b', 'c'],
                    true
                ]);
            });

            it('not-present-array-of-strings "in" array of strings evaluates to false', () => {
                const input = `
                    .Needle = {'d'}
                    .Haystack = {'a', 'b', 'c'}
                    .Result = false
                    If( .Needle in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    ['d'],
                    ['a', 'b', 'c'],
                    false
                ]);
            });
            
            it('array of strings "in" empty array evaluates to false', () => {
                const input = `
                    .Needle = {'b'}
                    .Haystack = {}
                    .Result = false
                    If( .Needle in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    ['b'],
                    [],
                    false
                ]);
            });
            
            it('empty array "in" empty array evaluates to false', () => {
                const input = `
                    .Needle = {}
                    .Haystack = {}
                    .Result = false
                    If( .Needle in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    [],
                    [],
                    false
                ]);
            });
            
            it('present-array-of-strings "not in" array of strings evaluates to false', () => {
                const input = `
                    .Needle = {'d', 'b'}
                    .Haystack = {'a', 'b', 'c'}
                    .Result = false
                    If( .Needle not in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    ['d', 'b'],
                    ['a', 'b', 'c'],
                    false
                ]);
            });

            it('not-present-array-of-strings "not in" array of strings evaluates to true', () => {
                const input = `
                    .Needle = {'d'}
                    .Haystack = {'a', 'b', 'c'}
                    .Result = false
                    If( .Needle not in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    ['d'],
                    ['a', 'b', 'c'],
                    true
                ]);
            });
            
            it('array of strings "not in" empty array evaluates to true', () => {
                const input = `
                    .Needle = {'b'}
                    .Haystack = {}
                    .Result = false
                    If( .Needle not in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    ['b'],
                    [],
                    true
                ]);
            });
            
            it('empty array "not in" empty array evaluates to true', () => {
                const input = `
                    .Needle = {}
                    .Haystack = {}
                    .Result = false
                    If( .Needle not in .Haystack )
                    {
                        ^Result = true
                    }
                    .Copy = .Result
                `;
                assertEvaluatedVariablesValueEqual(input, [
                    [],
                    [],
                    true
                ]);
            });
            
            it('errors if LHS is not a string or an array of strings (variation 1: array of non-strings)', () => {
                const input = `
                    .Needle = { 123 }
                    .Haystack = { '123' }
                    If( .Needle in .Haystack )
                    {
                    }
                `;
                assert.throws(
                    () => evaluateInput(input),
                    {
                        name: 'EvaluationError',
                        message: `'If' 'in' condition left-hand-side variable must be either a String or an Array of Strings, but instead is an Array of Integers`,
                        range: createRange(3, 24, 3, 31)
                    }
                );
            });
            
            it('errors if LHS is not a string or an array of strings (variation 2: non-string, non-array)', () => {
                const input = `
                    .Needle = 123
                    .Haystack = { '123' }
                    If( .Needle in .Haystack )
                    {
                    }
                `;
                assert.throws(
                    () => evaluateInput(input),
                    {
                        name: 'EvaluationError',
                        message: `'If' 'in' condition left-hand-side variable must be either a String or an Array of Strings, but instead is an Integer`,
                        range: createRange(3, 24, 3, 31)
                    }
                );
            });
            
            it('errors if RHS is not an array of strings (variation 1: array of non-strings)', () => {
                const input = `
                    .Needle = {}
                    .Haystack = { 123 }
                    If( .Needle in .Haystack )
                    {
                    }
                `;
                assert.throws(
                    () => evaluateInput(input),
                    {
                        name: 'EvaluationError',
                        message: `'If' 'in' condition right-hand-side variable must be an Array of Strings, but instead is an Array of Integers`,
                        range: createRange(3, 35, 3, 44)
                    }
                );
            });
            
            it('errors if RHS is not an array of strings (variation 2: non-array)', () => {
                const input = `
                    .Needle = {}
                    .Haystack = 123
                    If( .Needle in .Haystack )
                    {
                    }
                `;
                assert.throws(
                    () => evaluateInput(input),
                    {
                        name: 'EvaluationError',
                        message: `'If' 'in' condition right-hand-side variable must be an Array of Strings, but instead is an Integer`,
                        range: createRange(3, 35, 3, 44)
                    }
                );
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
                        .Copy = .FromHelper
                    `
                ],
                [
                    'file:///helper.bff',
                    `
                        .FromHelper = 1
                        .Copy = .FromHelper
                    `
                ]
            ]));
    
            assert.deepStrictEqual(result.evaluatedVariables, [
                {
                    value: 1,
                    range: createFileRange('file:///helper.bff', 2, 32, 2, 43),
                },
                {
                    value: 1,
                    range: createFileRange('file:///fbuild.bff', 2, 32, 2, 43),
                }
            ]);
    
            const definitionFromHelper: VariableDefinition = {
                id: 1,
                range: createFileRange('file:///helper.bff', 1, 24, 1, 35),
            };
    
            const definitionCopy: VariableDefinition = {
                id: 2,
                range: createFileRange('file:///helper.bff', 2, 24, 2, 29),
            };
    
            assert.deepStrictEqual(result.variableDefinitions, [
                definitionFromHelper,  // FromHelper
                definitionCopy,  // Copy
            ]);
    
            assert.deepStrictEqual(result.variableReferences, [
                // helper.bff ".FromHelper = 1" LHS
                {
                    definition: definitionFromHelper,
                    range: createFileRange('file:///helper.bff', 1, 24, 1, 35),
                },
                // helper.bff ".Copy = .FromHelper" RHS
                {
                    definition: definitionFromHelper,
                    range: createFileRange('file:///helper.bff', 2, 32, 2, 43),
                },
                // helper.bff ".Copy = .FromHelper" LHS
                {
                    definition: definitionCopy,
                    range: createFileRange('file:///helper.bff', 2, 24, 2, 29),
                },
                // fbuild.bff ".Copy = .FromHelper" RHS
                {
                    definition: definitionFromHelper,
                    range: createFileRange('file:///fbuild.bff', 2, 32, 2, 43),
                },
                // fbuild.bff ".Copy = .FromHelper" LHS
                {
                    definition: definitionCopy,
                    range: createFileRange('file:///fbuild.bff', 2, 24, 2, 29),
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
            ]));
    
            assert.deepStrictEqual(result.evaluatedVariables, [
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
            ]));
    
            assert.deepStrictEqual(result.evaluatedVariables, [
                {
                    value: 'dog',
                    range: createFileRange('file:///some/path/greetings.bff', 1, 42, 1, 48),
                },
                {
                    value: 'Hello dog',
                    range: createFileRange('file:///some/path/animals/dog.bff', 3, 31, 3, 39),
                },
                {
                    value: 'cat',
                    range: createFileRange('file:///some/path/greetings.bff', 1, 42, 1, 48),
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
            ]));
    
            assert.deepStrictEqual(result.evaluatedVariables, [
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
                        .Message = 'Hello $Name$'
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
            ]));
    
            assert.deepStrictEqual(result.evaluatedVariables, [
                {
                    value: 'dog',
                    range: createFileRange('file:///some/path/greetings.bff', 2, 42, 2, 48),
                },
            ]);
        });

    });

    describe('#if / #else / #endif', () => {
        const builtInDefine = getPlatformSpecificDefineSymbol();

        it('A platform-specific symbol is defined', () => {
            const input = `
                .Value = false
                #if ${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('"!DEFINE" on a defined symbol evaluates to false', () => {
            const input = `
                .Value = false
                #if !${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [false]);
        });

        it('"!DEFINE" on an undefined symbol evaluates to true', () => {
            const input = `
                .Value = false
                #if ! NON_EXISTENT_SYMBOL
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('true && true evaulates to true', () => {
            const input = `
                .Value = false
                #if ${builtInDefine} && ${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('true && false evaulates to false', () => {
            const input = `
                .Value = false
                #if ${builtInDefine} && !${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [false]);
        });

        it('false && true evaulates to false', () => {
            const input = `
                .Value = false
                #if !${builtInDefine} && ${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [false]);
        });

        it('false && false evaulates to false', () => {
            const input = `
                .Value = false
                #if !${builtInDefine} && !${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [false]);
        });

        it('true || true evaulates to true', () => {
            const input = `
                .Value = false
                #if ${builtInDefine} || ${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('true || false evaulates to true', () => {
            const input = `
                .Value = false
                #if ${builtInDefine} || !${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('false || true evaulates to true', () => {
            const input = `
                .Value = false
                #if !${builtInDefine} || ${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('false || false evaulates to false', () => {
            const input = `
                .Value = false
                #if !${builtInDefine} || !${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [false]);
        });

        it('false && false || true evaulates to true (&& takes precedence over ||) variation 1', () => {
            const input = `
                .Value = false
                #if !${builtInDefine} && !${builtInDefine} || ${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('true || false && false evaulates to true (&& takes precedence over ||) variation 1', () => {
            const input = `
                .Value = false
                #if ${builtInDefine} || !${builtInDefine} && !${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('#else body is evaluated when the #if condition is false', () => {
            const input = `
                .Value = ''
                #if !${builtInDefine}
                    .Value = 'if'
                #else
                    .Value = 'else'
                #endif
                Print( .Value )
            `;
            
            assertEvaluatedVariablesValueEqual(input, ['else']);
        });

        it('#if with comments', () => {
            const input = `
                .Value = ''
                #if ${builtInDefine} // My comment 1
                    .Value = 'if' // My comment 2
                #else // My comment 3
                    .Value = 'else' // My comment 4
                #endif// My comment 5
                Print( .Value )
            `;
            
            assertEvaluatedVariablesValueEqual(input, ['if']);
        });
    });

    describe('#if exists', () => {
        const builtInDefine = getPlatformSpecificDefineSymbol();

        it('"#if exists(...)" always evaluates to false', () => {
            const input = `
                .Value = false
                #if exists(MY_ENV_VAR)
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [false]);
        });

        it('"#if !exists(...)" always evaluates to true', () => {
            const input = `
                .Value = false
                #if !exists( MY_ENV_VAR )
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('"exists" can be combined with ||', () => {
            const input = `
                .Value = false
                #if exists(MY_ENV_VAR) || ${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('"exists" can be combined with &&', () => {
            const input = `
                .Value = false
                #if ${builtInDefine} && !exists(MY_ENV_VAR)
                    .Value = true
                #endif
                Print( .Value )
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
                        .Value = false
                        #if file_exists('sibling.txt')
                            .Value = true
                        #endif
                        Print( .Value )
                    `
                ],
                [
                    'file:///base/sibling.txt',
                    ''
                ],
            ]));
            const actualValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
            assert.deepStrictEqual(actualValues, [true]);
        });

        it('"#if file_exists(...)" evaluates to true for a relative path above the root FASTBuild file that exists', () => {
            const result = evaluateInputs('file:///base/fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///base/fbuild.bff',
                    `
                        .Value = false
                        #if file_exists('../uncle.txt')
                            .Value = true
                        #endif
                        Print( .Value )
                    `
                ],
                [
                    'file:///uncle.txt',
                    ''
                ],
            ]));
            const actualValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
            assert.deepStrictEqual(actualValues, [true]);
        });

        it('"#if file_exists(...)" evaluates to true for an absolute path that exists', () => {
            const result = evaluateInputs('file:///base/fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///base/fbuild.bff',
                    `
                        .Value = false
                        #if file_exists('/base/sibling.txt')
                            .Value = true
                        #endif
                        Print( .Value )
                    `
                ],
                [
                    'file:///base/sibling.txt',
                    ''
                ],
            ]));
            const actualValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
            assert.deepStrictEqual(actualValues, [true]);
        });

        it('"#if file_exists(...)" evaluates to false for a path that does not exist', () => {
            const input = `
                .Value = false
                #if file_exists('path/that/does/not/exist.txt')
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [false]);
        });

        it('"#if !file_exists(...)" evaluates to false for a path that exists', () => {
            const result = evaluateInputs('file:///base/fbuild.bff', new Map<UriStr, FileContents>([
                [
                    'file:///base/fbuild.bff',
                    `
                        .Value = false
                        #if !file_exists('sibling.txt')
                            .Value = true
                        #endif
                        Print( .Value )
                    `
                ],
                [
                    'file:///base/sibling.txt',
                    ''
                ],
            ]));
            const actualValues = result.evaluatedVariables.map(evaluatedVariable => evaluatedVariable.value);
            assert.deepStrictEqual(actualValues, [false]);
        });

        it('"#if !file_exists(...)" evaluates to true for a path that does not exist', () => {
            const input = `
                .Value = false
                #if !file_exists('path/that/does/not/exist.txt')
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('"file_exists" can be combined with ||', () => {
            const input = `
                .Value = false
                #if file_exists('path/that/does/not/exist.txt') || ${builtInDefine}
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('"file_exists" can be combined with &&', () => {
            const input = `
                .Value = false
                #if ${builtInDefine} && file_exists('path/that/does/not/exist.txt')
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [false]);
        });
    });

    describe('#define', () => {
        it('basic', () => {
            const input = `
                #define MY_DEFINE
                .Value = false
                #if MY_DEFINE
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [true]);
        });

        it('defining an already defined symbol is an error', () => {
            const input = `
                #define MY_DEFINE
                #define MY_DEFINE
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: `Cannot #define already defined symbol "MY_DEFINE".`,
                    range: createRange(2, 24, 2, 33)
                }
            );
        });
    });

    describe('#undef', () => {
        it('basic', () => {
            const input = `
                #define MY_DEFINE
                #undef MY_DEFINE
                .Value = false
                #if MY_DEFINE
                    .Value = true
                #endif
                Print( .Value )
            `;
            assertEvaluatedVariablesValueEqual(input, [false]);
        });

        it('undefining an undefined symbol is an error', () => {
            const input = `
                #undef MY_UNDEFINED_DEFINE
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: `Cannot #undef undefined symbol "MY_UNDEFINED_DEFINE".`,
                    range: createRange(1, 23, 1, 42)
                }
            );
        });

        it('undefining a built-in symbol is an error', () => {
            const builtInDefine = getPlatformSpecificDefineSymbol();
            const input = `
                #undef ${builtInDefine}
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: `Cannot #undef built-in symbol "${builtInDefine}".`,
                    range: createRange(1, 23, 1, 23 + builtInDefine.length)
                }
            );
        });
    });

    describe('#import', () => {
        // The language server cannot know what environment variables will exist when FASTBuild is run,
        // since they might be different than the environment variables that exist when the language server runs.
        // So '#import' uses a placeholder value instead of reading the actual environement variable value.
        it('#import uses a placeholder value', () => {
            const input = `
                #import MY_ENV_VAR
                Print( .MY_ENV_VAR )
            `;
            assertEvaluatedVariablesValueEqual(input, ['placeholder-MY_ENV_VAR-value']);
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