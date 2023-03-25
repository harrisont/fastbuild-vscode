import {
    DocumentSymbolParams,
    ReferenceParams,
    WorkspaceSymbolParams,
} from 'vscode-languageserver-protocol';

import {
    DocumentSymbol,
    DocumentUri,
    Location,
    SymbolInformation,
    SymbolKind,
} from 'vscode-languageserver-types';

import {
    isPositionInRange,
} from '../parser';

import {
    EvaluatedData,
} from '../evaluator';

export class ReferenceProvider {
    private evaluatedData = new Map<DocumentUri, EvaluatedData>();

    getReferences(params: ReferenceParams, evaluatedData: EvaluatedData): Location[] | null {
        const uri = params.textDocument.uri;
        const position = params.position;
        if (evaluatedData === undefined) {
            return null;
        }
        const variableReferences = evaluatedData.variableReferences;

        const variableReferenceAtPosition = variableReferences.find(ref => (ref.range.uri == uri && isPositionInRange(position, ref.range)));
        if (variableReferenceAtPosition === undefined) {
            return null;
        }

        // Search algorithm: for each variable references, check if the variable definition is the same as this one.
        // This is not very optimized.

        // Map JSON.stringify(Location) to Location in order to deduplicate referencs in a 'ForEach' loop.
        const locations = new Map<string, Location>();

        for (const variableReference of variableReferences)
        {
            if (variableReference.definition.id === variableReferenceAtPosition.definition.id) {
                const location: Location = {
                    uri: variableReference.range.uri,
                    range: variableReference.range
                };
                locations.set(JSON.stringify(location), location);
            }
        }

        return [...locations.values()];
    }

    getDocumentSymbols(params: DocumentSymbolParams, evaluatedData: EvaluatedData): DocumentSymbol[] | null {
        const uri = params.textDocument.uri;
        if (evaluatedData === undefined) {
            return null;
        }
        return evaluatedData.variableDefinitions
            .filter(variableDefinition => variableDefinition.range.uri == uri)
            .map(variableDefinition => {
                const symbol: DocumentSymbol = {
                    name: `TODO:name - ID=${variableDefinition.id}`,
                    detail: 'TODO: detail',
                    kind: SymbolKind.Variable,
                    range: variableDefinition.range,
                    selectionRange: variableDefinition.range,
                };
                return symbol;
            });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getWorkspaceSymbols(params: WorkspaceSymbolParams, evaluatedDatas: IterableIterator<EvaluatedData>): SymbolInformation[] | null {
        //TODO: filter on params.query

        const symbols: SymbolInformation[] = [];
        for (const evaluatedData of evaluatedDatas) {
            // Pre-allocate the number array length as an optimization.
            symbols.length += evaluatedData.variableDefinitions.length;

            for (const variableDefinition of evaluatedData.variableDefinitions) {
                const symbol: SymbolInformation = {
                    name: `TODO:name - ID=${variableDefinition.id}`,
                    kind: SymbolKind.Variable,
                    location: {
                        uri: variableDefinition.range.uri,
                        range: variableDefinition.range,
                    },
                    containerName: 'TODO:containerName',
                };
                symbols.push(symbol);
            }
        }

        return symbols;
    }
}