import * as assert from 'assert';
import {
    Position,
} from 'vscode-languageserver-protocol';
import * as completionProvider from '../features/completionProvider';
import { evaluateInputsFullUntilPosition } from './2-evaluator.test';
import { CompletionItem, CompletionItemKind, CompletionParams, CompletionTriggerKind } from 'vscode-languageserver';
import { SourcePositionWithUri } from '../evaluator';

type UriStr = string;
type FileContents = string;

function getCompletionsMultiFile(inputs: Map<UriStr, FileContents>, completionFile: UriStr, completionPosition: Position, triggerCharacter: string | undefined): CompletionItem[] {
    const rootFbuildUriStr = 'file:///fbuild.bff';
    const completionFileAndPosition = new SourcePositionWithUri(completionFile, completionPosition);
    const evaluationContext = evaluateInputsFullUntilPosition(rootFbuildUriStr, inputs, true /*enableDiagnostics*/, completionFileAndPosition);
    const completionParams: CompletionParams = {
        textDocument: {
            uri: completionFile,
        },
        position: completionPosition,
        context: {
            triggerKind: (triggerCharacter === undefined) ? CompletionTriggerKind.Invoked : CompletionTriggerKind.TriggerCharacter,
            triggerCharacter,
        },
    };
    return completionProvider.getCompletions(completionParams, evaluationContext, false /*isTriggerCharacterInContent*/);
}

function getCompletions(input: string, completionPosition: Position, triggerCharacter: string | undefined): CompletionItem[] {
    const rootFbuildUriStr = 'file:///fbuild.bff';
    const completionFile = rootFbuildUriStr;
    return getCompletionsMultiFile(new Map<UriStr, FileContents>([[rootFbuildUriStr, input]]), completionFile, completionPosition, triggerCharacter);
}

// Completions for the builtin variables.
function getBuiltinCompletions(prefix: string): CompletionItem[] {
    const builtinCompletions: CompletionItem[] = [
        {
            label: `${prefix}_WORKING_DIR_`,
            kind: CompletionItemKind.Variable,
        },
        {
            label: `${prefix}_CURRENT_BFF_DIR_`,
            kind: CompletionItemKind.Variable,
        },
        {
            label: `${prefix}_FASTBUILD_VERSION_STRING_`,
            kind: CompletionItemKind.Variable,
        },
        {
            label: `${prefix}_FASTBUILD_VERSION_`,
            kind: CompletionItemKind.Variable,
        },
        {
            label: `${prefix}_FASTBUILD_EXE_PATH_`,
            kind: CompletionItemKind.Variable,
        },
    ];
    return builtinCompletions;
}

describe('completionProvider', () => {
    describe('getCompletions', () => {
        describe('function property completions', () => {
            describe('no completions', () => {
                it('the position of the body opening brace', () => {
                    const input = `
Alias('MyTargetName')
{
}
                    `;
                    const actualCompletions = getCompletions(input, Position.create(2, 0), undefined /*triggerCharacter*/);
                    assert.deepStrictEqual(actualCompletions, getBuiltinCompletions('.'));
                });

                it('the position of the body closing brace', () => {
                    const input = `
Alias('MyTargetName')
{
}
                    `;
                    const actualCompletions = getCompletions(input, Position.create(3, 1), undefined /*triggerCharacter*/);
                    assert.deepStrictEqual(actualCompletions, getBuiltinCompletions('.'));
                });
            });

            function getExpectedCompletions(prefix: string): CompletionItem[] {
                const expectedCompletions: CompletionItem[] = [
                    {
                        label: `${prefix}Targets`,
                        kind: CompletionItemKind.Variable,
                        documentation: {
                            kind: 'markdown',
                            // cSpell:ignore libcmt
                            value: `**String/ArrayOfStrings (Required)**

One or more targets must be provided, either as a string or an array of strings. Targets can be previously
defined nodes, or files external to the build process.

Example:
\`\`\`FASTBuild
.Targets = { 'Library-Alias'                         // A previously defined Alias()
        'tmp/Libraries/X64/Release/Core.dll'    // A previously defined DLL()
        'External/SDK/VS2012/libs/libcmt.lib' } // An external DLL import library
\`\`\`

[Function documentation website](https://www.fastbuild.org/docs/functions/alias.html)`,
                        },
                    },
                    {
                        label: `${prefix}Hidden`,
                        kind: CompletionItemKind.Variable,
                        documentation: {
                            kind: 'markdown',
                            // cSpell:ignore showtargets
                            value: `**Boolean (Optional, defaults to \`false\`)**

Hide a target from -showtargets

[Function documentation website](https://www.fastbuild.org/docs/functions/alias.html)`,
                        },
                    },
                ];
                return expectedCompletions;
            }

            it('single function - no trigger character', () => {
                // Uses `Alias` as an example, but this test isn't meant to specifically test that function.
                const input = `
Alias('MyTargetName')
{
}
                `;

                // The position just after the body's opening brace
                const lookupPosition1 = Position.create(2, 1);
                const actualCompletions1 = getCompletions(input, lookupPosition1, undefined /*triggerCharacter*/);
                const expectedCompletions = [...getExpectedCompletions('.'), ...getBuiltinCompletions('.')];
                assert.deepStrictEqual(actualCompletions1, expectedCompletions);

                // The position just before the body's closing brace
                const lookupPosition2 = Position.create(3, 0);
                const actualCompletions2 = getCompletions(input, lookupPosition2, undefined /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions2, expectedCompletions);
            });

            it('single function - "." trigger character', () => {
                // Uses `Alias` as an example, but this test isn't meant to specifically test that function.
                const input = `
Alias('MyTargetName')
{
}
                `;

                // The position just after the body's opening brace
                const lookupPosition1 = Position.create(2, 1);
                const actualCompletions1 = getCompletions(input, lookupPosition1, '.' /*triggerCharacter*/);
                const expectedCompletions = [...getExpectedCompletions(''), ...getBuiltinCompletions('')];
                assert.deepStrictEqual(actualCompletions1, expectedCompletions);

                // The position just before the body's closing brace
                const lookupPosition2 = Position.create(3, 0);
                const actualCompletions2 = getCompletions(input, lookupPosition2, '.' /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions2, expectedCompletions);
            });

            it('single function - "^" trigger character', () => {
                // Uses `Alias` as an example, but this test isn't meant to specifically test that function.
                const input = `
Alias('MyTargetName')
{
}
                `;

                // The position just after the body's opening brace
                const lookupPosition1 = Position.create(2, 1);
                const actualCompletions1 = getCompletions(input, lookupPosition1, '^' /*triggerCharacter*/);
                // Function property completions do not trigger on parent scope.
                const expectedCompletions: CompletionItem[] = getBuiltinCompletions('');
                assert.deepStrictEqual(actualCompletions1, expectedCompletions);

                // The position just before the body's closing brace
                const lookupPosition2 = Position.create(3, 0);
                const actualCompletions2 = getCompletions(input, lookupPosition2, '^' /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions2, expectedCompletions);
            });

            it('Multiple functions in the same file', () => {
                const input = `
Alias('MyTarget1')
{
}

Alias('MyTarget2')
{
}
                `;

                // A position inside MyTarget1's body
                const lookupPosition1 = Position.create(2, 1);
                const actualCompletions1 = getCompletions(input, lookupPosition1, undefined /*triggerCharacter*/);
                const expectedCompletions = [...getExpectedCompletions('.'), ...getBuiltinCompletions('.')];
                assert.deepStrictEqual(actualCompletions1, expectedCompletions);

                // A position inside MyTarget2's body
                const lookupPosition2 = Position.create(7, 0);
                const actualCompletions2 = getCompletions(input, lookupPosition2, undefined /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions2, expectedCompletions);
            });

            it('multiple files', () => {
                const inputs =  new Map<UriStr, FileContents>([
                    [
                        'file:///fbuild.bff',
                        `
#include 'helper.bff'

Alias('MyTarget1')
{
}
                        `
                    ],
                    [
                        'file:///helper.bff',
                        `
Alias('MyTarget2')
{
}
                        `
                    ]
                ]);

                // Inside the body of MyTarget1
                const lookupPosition1 = Position.create(4, 1);
                const actualCompletions1 = getCompletionsMultiFile(inputs, 'file:///fbuild.bff', lookupPosition1, undefined /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions1, [...getExpectedCompletions('.'), ...getBuiltinCompletions('.')]);

                // Inside the body of MyTarget2
                const lookupPosition2 = Position.create(2, 1);
                const actualCompletions2 = getCompletionsMultiFile(inputs, 'file:///helper.bff', lookupPosition2, undefined /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions2, [...getExpectedCompletions('.'), ...getBuiltinCompletions('.')]);

                // The same position as inside the body of MyTarget1, but in a different file
                const lookupPosition3 = Position.create(4, 1);
                const actualCompletions3 = getCompletionsMultiFile(inputs, 'file:///helper.bff', lookupPosition3, undefined /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions3, getBuiltinCompletions('.'));
            });
        });

        describe('variable completions', () => {
            describe('no completions', () => {
                it('before variable definitions - no trigger character', () => {
                    const input = `
.Var1 = 1
                    `;
                    const actualCompletions = getCompletions(input, Position.create(0, 0), undefined /*triggerCharacter*/);
                    assert.deepStrictEqual(actualCompletions, getBuiltinCompletions('.'));
                });

                it('before variable definitions - "." trigger character', () => {
                    const input = `
.Var1 = 1
                    `;
                    const actualCompletions = getCompletions(input, Position.create(0, 0), '.' /*triggerCharacter*/);
                    assert.deepStrictEqual(actualCompletions, getBuiltinCompletions(''));
                });

                it('before variable definitions - "^" trigger character', () => {
                    const input = `
.Var1 = 1
                    `;
                    const actualCompletions = getCompletions(input, Position.create(0, 0), '^' /*triggerCharacter*/);
                    assert.deepStrictEqual(actualCompletions, []);
                });

                it('after definitions in a different scope', () => {
                    const input = `
{
    .Var1 = 1
}
                    `;
                    const actualCompletions = getCompletions(input, Position.create(4, 0), undefined /*triggerCharacter*/);
                    assert.deepStrictEqual(actualCompletions, getBuiltinCompletions('.'));
                });
            });

            it('current scope - no trigger character', () => {
                const input = `
.Var1 = 1
.Var2 = 2

.Var3 = 3
                `;

                const expectedCompletions: CompletionItem[] = [
                    ...getBuiltinCompletions('.'),
                    {
                        label: '.Var1',
                        kind: CompletionItemKind.Variable,
                    },
                    {
                        label: '.Var2',
                        kind: CompletionItemKind.Variable,
                    },
                ];

                // Lookup after `Var1` and `Var2`, but before `Var3`.
                const lookupPosition = Position.create(3, 0);
                const actualCompletions = getCompletions(input, lookupPosition, undefined /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions, expectedCompletions);
            });

            it('current scope - "." trigger character', () => {
                const input = `
.Var1 = 1
.Var2 = 2

.Var3 = 3
                `;

                const expectedCompletions: CompletionItem[] = [
                    ...getBuiltinCompletions(''),
                    {
                        label: 'Var1',
                        kind: CompletionItemKind.Variable,
                    },
                    {
                        label: 'Var2',
                        kind: CompletionItemKind.Variable,
                    },
                ];

                // Lookup after `Var1` and `Var2`, but before `Var3`.
                const lookupPosition = Position.create(3, 0);
                const actualCompletions = getCompletions(input, lookupPosition, '.' /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions, expectedCompletions);
            });

            it('parent scope - "^" trigger character - no variables after', () => {
                const input = `
.Var1 = 1
.Var2 = 2
{

}
                `;

                const expectedCompletions: CompletionItem[] = [
                    ...getBuiltinCompletions(''),
                    {
                        label: 'Var1',
                        kind: CompletionItemKind.Variable,
                    },
                    {
                        label: 'Var2',
                        kind: CompletionItemKind.Variable,
                    },
                ];

                // Lookup inside a nested scope.
                const lookupPosition = Position.create(4, 0);
                const actualCompletions = getCompletions(input, lookupPosition, '^' /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions, expectedCompletions);
            });

            it('parent scope - "^" trigger character - variables after', () => {
                const input = `
.Var1 = 1
.Var2 = 2
{

    .Var3 = 3
}
                `;

                const expectedCompletions: CompletionItem[] = [
                    ...getBuiltinCompletions(''),
                    {
                        label: 'Var1',
                        kind: CompletionItemKind.Variable,
                    },
                    {
                        label: 'Var2',
                        kind: CompletionItemKind.Variable,
                    },
                ];

                // Lookup inside a nested scope, before other variables are defined.
                const lookupPosition = Position.create(4, 0);
                const actualCompletions = getCompletions(input, lookupPosition, '^' /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions, expectedCompletions);
            });

            it('variables from #include after completion position are not included', () => {
                const inputs =  new Map<UriStr, FileContents>([
                    [
                        'file:///fbuild.bff',
                        `
.Var1 = 1

#include 'helper.bff'
                        `
                    ],
                    [
                        'file:///helper.bff',
                        `
.Var2 = 2
                        `
                    ]
                ]);

                const expectedCompletions: CompletionItem[] = [
                    ...getBuiltinCompletions('.'),
                    {
                        label: '.Var1',
                        kind: CompletionItemKind.Variable,
                    },
                ];

                // After `Var1` but before the `#include`.
                const lookupPosition = Position.create(2, 0);
                const actualCompletions = getCompletionsMultiFile(inputs, 'file:///fbuild.bff', lookupPosition, undefined /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions, expectedCompletions);
            });

            it('multiple files', () => {
                const inputs =  new Map<UriStr, FileContents>([
                    [
                        'file:///fbuild.bff',
                        `
.OuterFileBeforeIncludeVar = 1

#include 'helper.bff'

.OuterFileAfterIncludeVar = 2
                        `
                    ],
                    [
                        'file:///helper.bff',
                        `
.IncludedFileOuterVar = 3

{
    .IncludedFileInnerVar = 4
}
                        `
                    ]
                ]);

                // fbuild.bff after the #include but before .OuterFileAfterIncludeVar
                const lookupPosition1 = Position.create(4, 0);
                const actualCompletions1 = getCompletionsMultiFile(inputs, 'file:///fbuild.bff', lookupPosition1, undefined /*triggerCharacter*/);
                const expectedCompletions1: CompletionItem[] = [
                    ...getBuiltinCompletions('.'),
                    {
                        label: '.OuterFileBeforeIncludeVar',
                        kind: CompletionItemKind.Variable,
                    },
                    {
                        label: '.IncludedFileOuterVar',
                        kind: CompletionItemKind.Variable,
                    },
                ];
                assert.deepStrictEqual(actualCompletions1, expectedCompletions1);

                // At the start of helper.bff
                const lookupPosition2 = Position.create(0, 0);
                const actualCompletions2 = getCompletionsMultiFile(inputs, 'file:///helper.bff', lookupPosition2, undefined /*triggerCharacter*/);
                const expectedCompletions2: CompletionItem[] = [
                    ...getBuiltinCompletions('.'),
                    {
                        label: '.OuterFileBeforeIncludeVar',
                        kind: CompletionItemKind.Variable,
                    },
                ];
                assert.deepStrictEqual(actualCompletions2, expectedCompletions2);

                // helper.bff after .IncludedFileOuterVar but before .IncludedFileInnerVar
                const lookupPosition3 = Position.create(2, 0);
                const actualCompletions3 = getCompletionsMultiFile(inputs, 'file:///helper.bff', lookupPosition3, undefined /*triggerCharacter*/);
                const expectedCompletions3: CompletionItem[] = [
                    ...getBuiltinCompletions('.'),
                    {
                        label: '.OuterFileBeforeIncludeVar',
                        kind: CompletionItemKind.Variable,
                    },
                    {
                        label: '.IncludedFileOuterVar',
                        kind: CompletionItemKind.Variable,
                    },
                ];
                assert.deepStrictEqual(actualCompletions3, expectedCompletions3);
            });

            describe('ForEach', () => {
                it('no statements', () => {
                    const input = `
.Items = { '1', '2' }
ForEach(.Item in .Items)
{

}
                    `;

                    const expectedCompletions: CompletionItem[] = [
                        ...getBuiltinCompletions('.'),
                        {
                            label: '.Items',
                            kind: CompletionItemKind.Variable,
                        },
                        {
                            label: '.Item',
                            kind: CompletionItemKind.Variable,
                        },
                    ];

                    // Lookup inside the loop body.
                    const lookupPosition = Position.create(4, 0);
                    const actualCompletions = getCompletions(input, lookupPosition, undefined /*triggerCharacter*/);
                    assert.deepStrictEqual(actualCompletions, expectedCompletions);
                });

                it('with statements', () => {
                    const input = `
.Items = { '1', '2' }
ForEach(.Item in .Items)
{
    .InnerVar1 = 1

    .InnerVar2 = 2
}
                    `;

                    const expectedCompletions: CompletionItem[] = [
                        ...getBuiltinCompletions('.'),
                        {
                            label: '.Items',
                            kind: CompletionItemKind.Variable,
                        },
                        {
                            label: '.Item',
                            kind: CompletionItemKind.Variable,
                        },
                        {
                            label: '.InnerVar1',
                            kind: CompletionItemKind.Variable,
                        },
                    ];

                    // Lookup inside the loop body, after .InnerVar1, but before .InnerVar2.
                    const lookupPosition = Position.create(5, 0);
                    const actualCompletions = getCompletions(input, lookupPosition, undefined /*triggerCharacter*/);
                    assert.deepStrictEqual(actualCompletions, expectedCompletions);
                });
            });

            describe.skip('User function', () => {
                it('uncalled function - current scope - can access parameters and variables inside but not outside', () => {
                    const input = `
.OuterVar = 'hi'

function Func( .Arg ){
    .InnerVar1 = 1

    .InnerVar2 = 2
}
                    `;

                    const expectedCompletions: CompletionItem[] = [
                        ...getBuiltinCompletions('.'),
                        {
                            label: '.Arg',
                            kind: CompletionItemKind.Variable,
                        },
                        {
                            label: '.InnerVar',
                            kind: CompletionItemKind.Variable,
                        },
                    ];

                    // Lookup inside the function body, after .InnerVar1, but before .InnerVar2.
                    const lookupPosition = Position.create(5, 0);
                    const actualCompletions = getCompletions(input, lookupPosition, undefined /*triggerCharacter*/);
                    assert.deepStrictEqual(actualCompletions, expectedCompletions);
                });

                it('uncalled function - parent scope - no access', () => {
                    const input = `
.OuterVar = 'hi'

function Func( .Arg ){
    .InnerVar1 = 1

    .InnerVar2 = 2
}
                    `;

                    // Lookup inside the function body, after .InnerVar1, but before .InnerVar2.
                    const lookupPosition = Position.create(5, 0);
                    const actualCompletions = getCompletions(input, lookupPosition, '^' /*triggerCharacter*/);
                    assert.deepStrictEqual(actualCompletions, []);
                });

                it('called function - current scope - can access parameters and variables inside but not outside', () => {
                    const input = `
.OuterVar = 'hi'

function Func( .Arg ){
    .InnerVar1 = 1

    .InnerVar2 = 2
}

Func(3)
                    `;

                    const expectedCompletions: CompletionItem[] = [
                        ...getBuiltinCompletions('.'),
                        {
                            label: '.Arg',
                            kind: CompletionItemKind.Variable,
                        },
                        {
                            label: '.InnerVar',
                            kind: CompletionItemKind.Variable,
                        },
                    ];

                    // Lookup inside the function body, after .InnerVar1, but before .InnerVar2.
                    const lookupPosition = Position.create(5, 0);
                    const actualCompletions = getCompletions(input, lookupPosition, undefined /*triggerCharacter*/);
                    assert.deepStrictEqual(actualCompletions, expectedCompletions);
                });

                it('called function - parent scope - no access', () => {
                    const input = `
.OuterVar = 'hi'

function Func( .Arg ){
    .InnerVar1 = 1

    .InnerVar2 = 2
}

Func(3)
                    `;

                    // Lookup inside the function body, after .InnerVar1, but before .InnerVar2.
                    const lookupPosition = Position.create(5, 0);
                    const actualCompletions = getCompletions(input, lookupPosition, '^' /*triggerCharacter*/);
                    assert.deepStrictEqual(actualCompletions, []);
                });
            });
        });
    });
});
