import {
    DocumentSymbolParams,
    WorkspaceSymbolParams,
} from 'vscode-languageserver-protocol';

import {
    DocumentSymbol,
    SymbolInformation,
    SymbolKind,
} from 'vscode-languageserver-types';

import {
    EvaluatedData,
} from '../evaluator';

import * as fuzzy from 'fuzzy';

export function getDocumentSymbols(params: DocumentSymbolParams, evaluatedData: EvaluatedData): DocumentSymbol[] | null {
    const uri = params.textDocument.uri;
    const symbols: DocumentSymbol[] = [];

    //
    // Add targets
    //

    for (const [name, definition] of evaluatedData.targetDefinitions) {
        if (definition.range.uri !== uri) {
            continue;
        }

        const symbol: DocumentSymbol = {
            name,
            kind: SymbolKind.Function,
            range: definition.range,
            selectionRange: definition.range,
        };
        symbols.push(symbol);
    }

    //
    // Add variables
    //

    // Set of hashed symbols, to deduplicate results.
    //
    // These occur when a variable is defined with the same place multiple times.
    // For example, from a loop or from a file being `#include`d multiple times.
    //
    // This is not necessary for targets, since there cannot be duplicate target names.
    const ranges = new Set<string>();

    for (const definition of evaluatedData.variableDefinitions) {
        if (definition.range.uri !== uri) {
            continue;
        }

        // Avoid returning multiple of the same symbol.
        // This assumes that symbols with the same range are the same.
        const symbolHash = JSON.stringify(definition.range);
        if (ranges.has(symbolHash)) {
            continue;
        }
        ranges.add(symbolHash);

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

export function getWorkspaceSymbols(params: WorkspaceSymbolParams, evaluatedDatas: IterableIterator<EvaluatedData>): SymbolInformation[] | null {
    const symbols: SymbolInformation[] = [];
    for (const evaluatedData of evaluatedDatas) {
        //
        // Add targets
        //

        for (const [name, definition] of evaluatedData.targetDefinitions) {
            if (!fuzzy.test(params.query, name)) {
                continue;
            }

            const symbol: SymbolInformation = {
                name: name,
                kind: SymbolKind.Function,
                location: {
                    uri: definition.range.uri,
                    range: definition.range,
                },
            };
            symbols.push(symbol);
        }


        //
        // Add variables
        //

        // Set of hashed symbols, to deduplicate results.
        //
        // These occur when a variable is defined with the same place multiple times.
        // For example, from a loop or from a file being `#include`d multiple times.
        //
        // This is not necessary for targets, since there cannot be duplicate target names.
        const ranges = new Set<string>();

        for (const definition of evaluatedData.variableDefinitions) {
            if (!fuzzy.test(params.query, definition.name)) {
                continue;
            }

            // Avoid returning multiple of the same symbol.
            // This assumes that symbols with the same range are the same.
            const symbolHash = JSON.stringify(definition.range);
            if (ranges.has(symbolHash)) {
                continue;
            }
            ranges.add(symbolHash);

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
