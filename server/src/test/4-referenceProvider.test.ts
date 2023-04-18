import * as assert from 'assert';
import * as referenceProvider from '../features/referenceProvider';
import { evaluateInput } from './2-evaluator.test';
import {
    Location,
    ReferenceParams,
} from 'vscode-languageserver-protocol';

describe('referenceProvider', () => {
    describe('getReferences', () => {
        it('assigning a new variable creates a definition, but assigning an existing variable does not', () => {
            const input = `
                TODO
            `;
            const evaluatedData = evaluateInput(input, true /*enableDiagnostics*/);
            const referenceParams: ReferenceParams = {
                context: {
                    includeDeclaration: true,
                },
                textDocument: {
                    uri: 'TODO',
                },
                position: {
                    line: 0,
                    character: 0,
                },
            };
            const actualReferences = referenceProvider.getReferences(referenceParams, evaluatedData);

            const expectedReferences: Location[] = [
            ];
            assert.deepStrictEqual(actualReferences, expectedReferences);
        });
    });
});