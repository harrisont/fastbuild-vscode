import {
    Connection,
    Diagnostic,
    DiagnosticSeverity,
    PublishDiagnosticsParams,
} from 'vscode-languageserver';

import {
    Range,
} from 'vscode-languageserver-types';

import {
    ParseError,
} from '../parser';

import {
    EvaluationError,
    InternalEvaluationError,
} from '../evaluator';

const SOURCE_NAME = 'FASTBuild';

type UriStr = string;

function createDiagnosticError(message: string, range: Range): Diagnostic {
    return {
        severity: DiagnosticSeverity.Error,
        range,
        message: message,
        source: SOURCE_NAME
    };
}

export class DiagnosticProvider {
    hasDiagnosticRelatedInformationCapability = false;
    readonly _documentRootToDocumentsWithDiagnosticsMap = new Map<UriStr, Set<UriStr>>();

    setParseErrorDiagnostic(rootUri: UriStr, error: ParseError, connection: Connection): void {
        const diagnostic = createDiagnosticError(error.message, error.range);
        this._setDiagnostic(rootUri, error.fileUri, diagnostic, connection);
    }

    setEvaluationErrorDiagnostic(rootUri: UriStr, error: EvaluationError, connection: Connection): void {
        const isInternalError = error instanceof InternalEvaluationError;
        const message = isInternalError ? `Internal error: ${error.stack}` : error.message;
        const diagnostic = createDiagnosticError(message, error.range);
        this._setDiagnostic(rootUri, error.range.uri, diagnostic, connection);
    }

    setUnknownErrorDiagnostic(rootUri: UriStr, error: Error, connection: Connection): void {
        // We do not know which URI caused the error, so use a dummy error range.
        const uri = '';
        const message = `Internal error: ${error.stack ?? error.message}`;
        const diagnostic = createDiagnosticError(message, Range.create(0, 0, 0, 0));
        this._setDiagnostic(rootUri, uri, diagnostic, connection);
    }

    // This currently only supports setting a single diagnostic.
    // Ideally it would support setting multiple.
    private _setDiagnostic(rootUri: UriStr, uri: UriStr, diagnostic: Diagnostic, connection: Connection): void {
        const diagnostics = [diagnostic];
        const publishDiagnosticsParams: PublishDiagnosticsParams = { uri, diagnostics };
        connection.sendDiagnostics(publishDiagnosticsParams);
        const documentsForRoot = this._documentRootToDocumentsWithDiagnosticsMap.get(rootUri);
        if (documentsForRoot === undefined) {
            this._documentRootToDocumentsWithDiagnosticsMap.set(rootUri, new Set<UriStr>([uri]));
        } else {
            documentsForRoot.add(uri);
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