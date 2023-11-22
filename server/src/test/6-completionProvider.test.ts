import * as assert from 'assert';
import {
    Position,
} from 'vscode-languageserver-protocol';
import * as completionProvider from '../features/completionProvider';
import { evaluateInputs } from './2-evaluator.test';
import { CompletionItem, CompletionItemKind, CompletionParams, MarkupKind } from 'vscode-languageserver';

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
            const expectedCompletions: CompletionItem[] = [
                {
                    label: '.Targets',
                    kind: CompletionItemKind.Variable,
                    detail: 'Required: true',
                    documentation: {
                        kind: MarkupKind.Markdown,
                        value: '# heading\n* value 1\n* value 2',
                    },
                },
            ];
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
            const expectedCompletions1: CompletionItem[] = [
                {
                    label: '.Targets',
                    kind: CompletionItemKind.Variable,
                    detail: 'Required: true',
                    documentation: {
                        kind: MarkupKind.Markdown,
                        value: '# heading\n* value 1\n* value 2',
                    },
                },
            ];
            assert.deepStrictEqual(actualCompletions1, expectedCompletions1);

            // A position inside MyTarget2's body
            const lookupPosition2 = Position.create(7, 0);
            const actualCompletions2 = getCompletions(input, lookupPosition2);
            const expectedCompletions2: CompletionItem[] = [
                {
                    label: '.Targets',
                    kind: CompletionItemKind.Variable,
                    detail: 'Required: true',
                    documentation: {
                        kind: MarkupKind.Markdown,
                        value: '# heading\n* value 1\n* value 2',
                    },
                },
            ];
            assert.deepStrictEqual(actualCompletions2, expectedCompletions2);
        });

        it('multiple files', () => {
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
            const actualCompletions = getCompletionsMultiFile('file:///fbuild.bff', inputs, lookupPosition);

            const expectedCompletions: CompletionItem[] = [
            ];

            assert.deepStrictEqual(actualCompletions, expectedCompletions);
        });
    });
});
