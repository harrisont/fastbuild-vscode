import * as assert from 'assert';
import {
    Position,
} from 'vscode-languageserver-protocol';
import * as completionProvider from '../features/completionProvider';
import { evaluateInputs } from './2-evaluator.test';
import { CompletionItem, CompletionItemKind, CompletionParams } from 'vscode-languageserver';

type UriStr = string;
type FileContents = string;

function getCompletionsMultiFile(thisFbuildUriStr: UriStr, inputs: Map<UriStr, FileContents>, position: Position): CompletionItem[] {
    const evaluatedData = evaluateInputs(thisFbuildUriStr, inputs, true /*enableDiagnostics*/);
    const completionParams: CompletionParams = {
        textDocument: {
            uri: thisFbuildUriStr,
        },
        position,
    };
    return completionProvider.getCompletions(completionParams, evaluatedData);
}

function getCompletions(input: string, position: Position): CompletionItem[] {
    const thisFbuildUri = 'file:///dummy.bff';
    return getCompletionsMultiFile(thisFbuildUri, new Map<UriStr, FileContents>([[thisFbuildUri, input]]), position);
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
                    const actualCompletions = getCompletions(input, Position.create(2, 0));
                    assert.deepStrictEqual(actualCompletions, []);
                });
    
                it('the position of the body closing brace', () => {
                    const input = `
Alias('MyTargetName')
{
}
                    `;
                    const actualCompletions = getCompletions(input, Position.create(3, 1));
                    assert.deepStrictEqual(actualCompletions, []);
                });
            });
    
            const expectedCompletions: CompletionItem[] = [
                {
                    label: '.Targets',
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
                    label: '.Hidden',
                    kind: CompletionItemKind.Variable,
                    documentation: {
                        kind: 'markdown',
                        value: `**Boolean (Optional, defaults to \`false\`)**

Hide a target from -showtargets

[Function documentation website](https://www.fastbuild.org/docs/functions/alias.html)`,
                    },
                },
            ];
    
            it('single function', () => {
                // Uses `Alias` as an example, but this test isn't meant to specifically test that function.
                const input = `
Alias('MyTargetName')
{
}
                `;
    
                // The position just after the body's opening brace
                const lookupPosition1 = Position.create(2, 1);
                const actualCompletions1 = getCompletions(input, lookupPosition1);
                assert.deepStrictEqual(actualCompletions1, expectedCompletions);
    
                // The position just before the body's closing brace
                const lookupPosition2 = Position.create(3, 0);
                const actualCompletions2 = getCompletions(input, lookupPosition2);
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
                const actualCompletions1 = getCompletions(input, lookupPosition1);
                assert.deepStrictEqual(actualCompletions1, expectedCompletions);
    
                // A position inside MyTarget2's body
                const lookupPosition2 = Position.create(7, 0);
                const actualCompletions2 = getCompletions(input, lookupPosition2);
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
                const actualCompletions1 = getCompletionsMultiFile('file:///fbuild.bff', inputs, lookupPosition1);
                assert.deepStrictEqual(actualCompletions1, expectedCompletions);
    
                // Inside the body of MyTarget2
                const lookupPosition2 = Position.create(2, 1);
                const actualCompletions2 = getCompletionsMultiFile('file:///helper.bff', inputs, lookupPosition2);
                assert.deepStrictEqual(actualCompletions2, expectedCompletions);
    
                // The same position as inside the body of MyTarget1, but in a different file
                const lookupPosition3 = Position.create(4, 1);
                const actualCompletions3 = getCompletionsMultiFile('file:///helper.bff', inputs, lookupPosition3);
                assert.deepStrictEqual(actualCompletions3, []);
            });
        });
    });
});
