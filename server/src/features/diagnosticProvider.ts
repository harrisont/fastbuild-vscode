import {
    Connection,
    Diagnostic,
    DiagnosticSeverity,
} from 'vscode-languageserver';

import {
    Range,
} from 'vscode-languageserver-types';

import {
    ParseError,
    ParseSyntaxError,
    ParseNumParsesError,
} from '../parser';

import {
    EvaluationError,
    InternalEvaluationError,
} from '../evaluator';

const SOURCE_NAME = 'FASTBuild';

type UriStr = string;

function createWholeDocumentRange(): Range {
    return Range.create(0, 0, Number.MAX_VALUE, Number.MAX_VALUE);
}

function createDiagnosticError(message: string, range: Range): Diagnostic {
    return {
        severity: DiagnosticSeverity.Error,
        range,
        message: message,
        source: SOURCE_NAME
    };
}

function createDiagnosticFromParseError(error: ParseError): Diagnostic {
    if (error instanceof ParseNumParsesError) {
        // We don't know the location that causes the wrong number of parses, so use the whole document as the error range.
        return createDiagnosticError(error.message, createWholeDocumentRange());
    } else if (error instanceof ParseSyntaxError) {
        const rangeStart = error.position;
        // Use the same end as the start in order to have VS Code auto-match the word.
        const range = Range.create(rangeStart, rangeStart);
        return createDiagnosticError(error.message, range);
    } else {
        // We were unable to parse the location from the error, so use the whole document as the error range.
        return createDiagnosticError(`Failed to parse error location from ParseError: ${error}`, createWholeDocumentRange());
    }
}

export class DiagnosticProvider {
    hasDiagnosticRelatedInformationCapability = false;
    readonly _documentRootToDocumentsWithDiagnosticsMap = new Map<UriStr, Set<UriStr>>();

    addParseErrorDiagnostic(rootUri: UriStr, error: ParseError, connection: Connection): void {
        const diagnostic = createDiagnosticFromParseError(error);
        const diagnostics = [diagnostic];
        this._addDiagnostics(rootUri, error.fileUri, diagnostics, connection);
    }

    addEvaluationErrorDiagnostic(rootUri: UriStr, error: EvaluationError, connection: Connection): void {
        const isInternalError = error instanceof InternalEvaluationError;
        const message = isInternalError ? `Internal error: ${error.message}` : error.message;
        const diagnostic = createDiagnosticError(message, error.range);
        const diagnostics = [diagnostic];
        this._addDiagnostics(rootUri, error.range.uri, diagnostics, connection);
    }

    addUnknownErrorDiagnostic(rootUri: UriStr, error: Error, connection: Connection): void {
        // We do not know which URI caused the error, so use a dummy error range.
        const uri = '';
        const message = `Internal error: ${error.message}`;
        const diagnostic = createDiagnosticError(message, Range.create(0, 0, 0, 0));
        const diagnostics = [diagnostic];
        this._addDiagnostics(rootUri, uri, diagnostics, connection);
    }

    private _addDiagnostics(rootUri: UriStr, uri: UriStr, diagnostics: Diagnostic[], connection: Connection): void {
        connection.sendDiagnostics({ uri, diagnostics });
        if (diagnostics.length > 0) {
            const documentsForRoot = this._documentRootToDocumentsWithDiagnosticsMap.get(rootUri);
            if (documentsForRoot === undefined) {
                this._documentRootToDocumentsWithDiagnosticsMap.set(rootUri, new Set<UriStr>([uri]));
            } else {
                documentsForRoot.add(uri);
            }
        }
    }

    clearDiagnostics(connection: Connection): void {
        for (const documentsForRoot of this._documentRootToDocumentsWithDiagnosticsMap.values()) {
            for (const uri of documentsForRoot) {
                connection.sendDiagnostics({ uri, diagnostics: [] });
            }
        }
    }

    clearDiagnosticsForRoot(rootUri: UriStr, connection: Connection): void {
        const documentsForRoot = this._documentRootToDocumentsWithDiagnosticsMap.get(rootUri);
        if (documentsForRoot === undefined) {
            return;
        }
        for (const uri of documentsForRoot) {
            connection.sendDiagnostics({ uri, diagnostics: [] });
        }
    }
}