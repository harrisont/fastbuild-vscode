import {
    DocumentSymbolParams,
    ReferenceParams,
    WorkspaceSymbolParams,
} from 'vscode-languageserver-protocol';

import {
    DocumentSymbol,
    Location,
    Position,
    SymbolInformation,
    SymbolKind,
} from 'vscode-languageserver-types';

import {
    isPositionInRange,
} from '../parser';

import {
    EvaluatedData,
} from '../evaluator';

import * as fuzzy from 'fuzzy';

export class ReferenceProvider {
    getReferences(params: ReferenceParams, evaluatedData: EvaluatedData): Location[] {
        const uri = params.textDocument.uri;
        const position = params.position;

        const references = this.getTargetReferences(uri, position, evaluatedData);
        references.push(...this.getVariableReferences(uri, position, evaluatedData));
        return references;
    }

    getTargetReferences(uri: string, position: Position, evaluatedData: EvaluatedData): Location[] {
        const references = evaluatedData.targetReferences;

        const referenceAtPosition = references.find(ref => (ref.range.uri == uri && isPositionInRange(position, ref.range)));
        if (referenceAtPosition === undefined) {
            return [];
        }

        // Search algorithm: for each references, check if the definition is the same as this one.
        // This is not very optimized.

        // Map JSON.stringify(Location) to Location in order to deduplicate referencs in a 'ForEach' loop.
        const locations = new Map<string, Location>();

        for (const reference of references)
        {
            if (reference.definition.id === referenceAtPosition.definition.id) {
                const location: Location = {
                    uri: reference.range.uri,
                    range: reference.range
                };
                locations.set(JSON.stringify(location), location);
            }
        }

        return [...locations.values()];
    }

    getVariableReferences(uri: string, position: Position, evaluatedData: EvaluatedData): Location[] {
        const references = evaluatedData.variableReferences;

        const referenceAtPosition = references.find(ref => (ref.range.uri == uri && isPositionInRange(position, ref.range)));
        if (referenceAtPosition === undefined) {
            return [];
        }

        // Search algorithm: for each references, check if the definition is the same as this one.
        // This is not very optimized.

        // Map JSON.stringify(Location) to Location in order to deduplicate referencs in a 'ForEach' loop.
        const locations = new Map<string, Location>();

        for (const reference of references)
        {
            if (reference.definition.id === referenceAtPosition.definition.id) {
                const location: Location = {
                    uri: reference.range.uri,
                    range: reference.range
                };
                locations.set(JSON.stringify(location), location);
            }
        }

        return [...locations.values()];
    }

    getDocumentSymbols(params: DocumentSymbolParams, evaluatedData: EvaluatedData): DocumentSymbol[] | null {
        const uri = params.textDocument.uri;
        const symbols: DocumentSymbol[] = [];

        // Add targets
        for (const definition of evaluatedData.targetDefinitions) {
            if (definition.range.uri !== uri) {
                continue;
            }

            const symbol: DocumentSymbol = {
                name: definition.name,
                kind: SymbolKind.Function,
                range: definition.range,
                selectionRange: definition.range,
            };
            symbols.push(symbol);
        }

        // Add variables
        for (const definition of evaluatedData.variableDefinitions) {
            if (definition.range.uri !== uri) {
                continue;
            }

            const symbol: DocumentSymbol = {
                name: definition.name,
                kind: SymbolKind.Variable,
                range: definition.range,
                selectionRange: definition.range,
            };
            symbols.push(symbol);
        }

        return symbols;
    }

    getWorkspaceSymbols(params: WorkspaceSymbolParams, evaluatedDatas: IterableIterator<EvaluatedData>): SymbolInformation[] | null {
        const symbols: SymbolInformation[] = [];
        for (const evaluatedData of evaluatedDatas) {
            // Add targets
            for (const definition of evaluatedData.targetDefinitions) {
                if (!fuzzy.test(params.query, definition.name)) {
                    continue;
                }

                const symbol: SymbolInformation = {
                    name: definition.name,
                    kind: SymbolKind.Function,
                    location: {
                        uri: definition.range.uri,
                        range: definition.range,
                    },
                };
                symbols.push(symbol);
            }

            // Add variables
            for (const definition of evaluatedData.variableDefinitions) {
                if (!fuzzy.test(params.query, definition.name)) {
                    continue;
                }

                const symbol: SymbolInformation = {
                    name: definition.name,
                    kind: SymbolKind.Variable,
                    location: {
                        uri: definition.range.uri,
                        range: definition.range,
                    },
                };
                symbols.push(symbol);
            }
        }

        return symbols;
    }
}