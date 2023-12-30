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

function getCompletionsMultiFile(thisFbuildUriStr: UriStr, inputs: Map<UriStr, FileContents>, position: Position, triggerCharacter: string | undefined): CompletionItem[] {
    const untilPosition = new SourcePositionWithUri(thisFbuildUriStr, position);
    const evaluationContext = evaluateInputsFullUntilPosition(thisFbuildUriStr, inputs, true /*enableDiagnostics*/, untilPosition);
    const completionParams: CompletionParams = {
        textDocument: {
            uri: thisFbuildUriStr,
        },
        position,
        context: {
            triggerKind: (triggerCharacter === undefined) ? CompletionTriggerKind.Invoked : CompletionTriggerKind.TriggerCharacter,
            triggerCharacter,
        },
    };
    return completionProvider.getCompletions(completionParams, evaluationContext, false /*isTriggerCharacterInContent*/);
}

function getCompletions(input: string, position: Position, triggerCharacter: string | undefined): CompletionItem[] {
    const thisFbuildUri = 'file:///dummy.bff';
    return getCompletionsMultiFile(thisFbuildUri, new Map<UriStr, FileContents>([[thisFbuildUri, input]]), position, triggerCharacter);
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
                const actualCompletions1 = getCompletionsMultiFile('file:///fbuild.bff', inputs, lookupPosition1, undefined /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions1, [...getExpectedCompletions('.'), ...getBuiltinCompletions('.')]);

                // Inside the body of MyTarget2
                const lookupPosition2 = Position.create(2, 1);
                const actualCompletions2 = getCompletionsMultiFile('file:///helper.bff', inputs, lookupPosition2, undefined /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions2, [...getExpectedCompletions('.'), ...getBuiltinCompletions('.')]);

                // The same position as inside the body of MyTarget1, but in a different file
                const lookupPosition3 = Position.create(4, 1);
                const actualCompletions3 = getCompletionsMultiFile('file:///helper.bff', inputs, lookupPosition3, undefined /*triggerCharacter*/);
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
                    assert.deepStrictEqual(actualCompletions, getBuiltinCompletions(''));
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
                const actualCompletions = getCompletionsMultiFile('file:///fbuild.bff', inputs, lookupPosition, undefined /*triggerCharacter*/);
                assert.deepStrictEqual(actualCompletions, expectedCompletions);
            });

            describe('ForEach', () => {
                // TODO
            });

            describe('User function', () => {
                // TODO
                // Note: user functions cannot access variables in the parent scope, so verify that.
            });
        });
    });
});
