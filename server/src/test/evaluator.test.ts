import * as assert from 'assert';

// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

import * as os from 'os';
import * as path from 'path';

import {
    evaluate,
    EvaluatedData,
    EvaluatedVariable,
    SourceRange,
    Struct,
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

    getFileContents(uri: vscodeUri.URI): FileContents {
        const contents = this.fileContents.get(uri.toString());
        if (contents === undefined) {
            throw new Error(`MockFileSystem has no data for URI '${uri}'`);
        }
        return contents;
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
    const parseData = parseDataProvider.getParseData(thisFbuildUri);
    return evaluate(parseData, thisFbuildUriStr, fileSystem, parseDataProvider);
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
        
        it('should be able to read a variable in a grandparent scope', () => {
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
                    message: 'Referencing variable "Var1" that is undefined in the current scope or any of the parent scopes.',
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

        it('should not be able to write a non-existant variable in a parent scope', () => {
            const input = `
                {
                    ^Var1 = 1
                }
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot update variable "Var1" in parent scope because the variable does not exist in the parent scope.',
                    range: createRange(2, 20, 2, 25)
                }
            );
        });

        it('should not be able to write a variable in a grandparent scope', () => {
            const input = `
                .Var1 = 1
                {
                    {
                        ^Var1 = 2
                    }
                }
            `;
            assert.throws(
                () => evaluateInput(input),
                {
                    name: 'EvaluationError',
                    message: 'Cannot update variable "Var1" in parent scope because the variable does not exist in the parent scope.',
                    range: createRange(4, 24, 4, 29)
                }
            );
        });

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
                    message: 'Referencing varable "MyMessage" that is undefined in the current scope.',
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
                    message: 'Referencing varable "MyMessage" that is undefined in the parent scope.',
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
            assertEvaluatedVariablesValueEqual(input, [
                new Struct(Object.entries({
                    A: 0,
                    B: 2,
                })),
                new Struct(Object.entries({
                    A: 1,
                    C: 3
                })),
                new Struct(Object.entries({
                    A: 1,
                    B: 2,
                    C: 3
                }))
            ]);
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
            assertEvaluatedVariablesValueEqual(input, [
                new Struct(Object.entries({
                    MyBool: true,
                    MyInt: 123,
                    MyStr: 'Hello world!'
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
            assertEvaluatedVariablesValueEqual(input, [
                1,
                new Struct(Object.entries({
                    A: 1
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
            assertEvaluatedVariablesValueEqual(input, [
                1,
                2,
                new Struct(Object.entries({
                    A1: 1,
                    A2: 2
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
            assertEvaluatedVariablesValueEqual(input, [
                new Struct(Object.entries({
                    MyArray: [1, 2, 3]
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
            assertEvaluatedVariablesValueEqual(input, [
                new Struct(Object.entries({
                    MyStruct: new Struct(Object.entries({
                        MyInt: 1
                    }))
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
            assertEvaluatedVariablesValueEqual(input, [
                new Struct(Object.entries({
                    MyInt: 1,
                })),
                new Struct(Object.entries({
                    MyInt: 2,
                })),
                [
                    new Struct(Object.entries({
                        MyInt: 1,
                    })),
                    new Struct(Object.entries({
                        MyInt: 2,
                    }))
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
                    usingRange: null,
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
                    usingRange: null,
                },
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 22),
                    },
                    range: createRange(2, 16, 2, 22),
                    usingRange: null,
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
                    usingRange: null,
                },
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 23),
                    },
                    range: createRange(2, 26, 2, 33),
                    usingRange: null,
                },
                {
                    definition: {
                        id: 2,
                        range: createRange(2, 16, 2, 23),
                    },
                    range: createRange(2, 16, 2, 23),
                    usingRange: null,
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
                    usingRange: null,
                },
                {
                    definition: {
                        id: 1,
                        range: createRange(1, 16, 1, 23),
                    },
                    range: createRange(2, 27, 2, 35),
                    usingRange: null,
                },
                {
                    definition: {
                        id: 2,
                        range: createRange(2, 16, 2, 23),
                    },
                    range: createRange(2, 16, 2, 23),
                    usingRange: null,
                }
            ];
            assert.deepStrictEqual(result.variableReferences, expectedReferences);
        });

        it('should be detected in an evaluated variable from a Using', () => {
            const input = `
                .MyStruct = [
                    .StructVar = 1
                ]
                
                Using( .MyStruct )
                .Copy = .StructVar
            `;
            const result = evaluateInput(input);
            const expectedReferences: VariableReference[] = [
                // .StructVar = 1
                {
                    definition: {
                        id: 1,
                        range: createRange(2, 20, 2, 30),
                    },
                    range: createRange(2, 20, 2, 30),
                    usingRange: null,
                },
                // .MyStruct = [...]
                {
                    definition: {
                        id: 2,
                        range: createRange(1, 16, 1, 25),
                    },
                    range: createRange(1, 16, 1, 25),
                    usingRange: null,
                },
                // Using( .MyStruct )
                {
                    definition: {
                        id: 2,
                        range: createRange(1, 16, 1, 25),
                    },
                    range: createRange(5, 23, 5, 32),
                    usingRange: null,
                },
                // .Copy = .StructVar (RHS)
                {
                    // .StructVar = 1
                    definition: {
                        id: 1,
                        range: createRange(2, 20, 2, 30),
                    },
                    range: createRange(6, 24, 6, 34),
                    // "Using( .MyStruct )"
                    usingRange: createRange(5, 16, 5, 34),
                },
                // .Copy = .StructVar (LHS)
                {
                    definition: {
                        id: 3,
                        range: createRange(6, 16, 6, 21),
                    },
                    range: createRange(6, 16, 6, 21),
                    usingRange: null,
                }
            ];
            assert.deepStrictEqual(result.variableReferences, expectedReferences);
        });
    });

    describe('Using', () => {
        it('Call Using outside a struct', () => {
            const input = `
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
            assertEvaluatedVariablesValueEqual(input, [
                new Struct(Object.entries({
                    MyBool: true,
                    MyInt: 1,
                    MyString: 'hello'
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
            assertEvaluatedVariablesValueEqual(input, [
                'fun',
                new Struct(Object.entries({
                    MyBool: true,
                    MyInt: 1,
                    MyString: 'hello',
                    MyEvaluatedVar: 'fun'
                })),
                new Struct(Object.entries({
                    MyBool: true,
                    MyInt: 1,
                    MyString: 'hello',
                    MyEvaluatedVar: 'fun'
                }))
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
            assertEvaluatedVariablesValueEqual(input, [
                [
                    new Struct(Object.entries({
                        Value: 1
                    })),
                    new Struct(Object.entries({
                        Value: 2
                    }))
                ],
                new Struct(Object.entries({
                    Value: 1
                })),
                new Struct(Object.entries({
                    Value: 2
                }))
            ]);
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
        it('Error', () => {
            const input = `
                .Value = 1
                Error('Value is $Value$')
            `;
            assertEvaluatedVariablesValueEqual(input, [1]);
        });
        
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
        
        it('Settings', () => {
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
    
            assert.deepStrictEqual(result.variableDefinitions, new Map<string, VariableDefinition>([
                ['FromHelper', definitionFromHelper],
                ['Copy', definitionCopy],
            ]));
    
            assert.deepStrictEqual(result.variableReferences, [
                // helper.bff ".FromHelper = 1" LHS
                {
                    definition: definitionFromHelper,
                    range: createFileRange('file:///helper.bff', 1, 24, 1, 35),
                    usingRange: null,
                },
                // helper.bff ".Copy = .FromHelper" RHS
                {
                    definition: definitionFromHelper,
                    range: createFileRange('file:///helper.bff', 2, 32, 2, 43),
                    usingRange: null,
                },
                // helper.bff ".Copy = .FromHelper" LHS
                {
                    definition: definitionCopy,
                    range: createFileRange('file:///helper.bff', 2, 24, 2, 29),
                    usingRange: null,
                },
                // fbuild.bff ".Copy = .FromHelper" RHS
                {
                    definition: definitionFromHelper,
                    range: createFileRange('file:///fbuild.bff', 2, 32, 2, 43),
                    usingRange: null,
                },
                // fbuild.bff ".Copy = .FromHelper" LHS
                {
                    definition: definitionCopy,
                    range: createFileRange('file:///fbuild.bff', 2, 24, 2, 29),
                    usingRange: null,
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