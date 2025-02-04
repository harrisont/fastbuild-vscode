import {
    Connection,
    Diagnostic,
    DiagnosticRelatedInformation,
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
    ErrorRelatedInformation,
    EvaluationError,
    InternalEvaluationError,
} from '../evaluator';

import {
    SettingsError
} from '../settings';

const SOURCE_NAME = 'FASTBuild';

type UriStr = string;

function createDiagnosticError(message: string, range: Range, relatedInformation: DiagnosticRelatedInformation[]): Diagnostic {
    const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range,
        message: message,
        source: SOURCE_NAME
    };

    if (relatedInformation.length !== 0) {
        diagnostic.relatedInformation = relatedInformation;
    }

    return diagnostic;
}

function convertErrorRelatedInformation(info: ErrorRelatedInformation): DiagnosticRelatedInformation {
    return {
        location: {
            uri: info.range.uri,
            range: {
                start: info.range.start,
                end: info.range.end,
            }
        },
        message: info.message,
    };
}

// The settings are not a URI that we know, so just use a made-up URI.
const SETTINGS_URI = "Settings";

export class DiagnosticProvider {
    hasDiagnosticRelatedInformationCapability = false;
    readonly _documentRootToDocumentsWithDiagnosticsMap = new Map<UriStr, Set<UriStr>>();

    setSettingsErrorDiagnostic(errors: SettingsError[], connection: Connection): void {
        const range: Range = Range.create(0, 0, 0, 0);
        const relatedInformation: DiagnosticRelatedInformation[] = [];
        const diagnostics = errors.map(error => createDiagnosticError(error.message, range, relatedInformation));
        connection.sendDiagnostics({ uri: SETTINGS_URI, diagnostics });
    }

    setParseErrorDiagnostic(rootUri: UriStr, error: ParseError, connection: Connection): void {
        const relatedInformation: DiagnosticRelatedInformation[] = [];
        const diagnostic = createDiagnosticError(error.message, error.range, relatedInformation);
        this._setFileDiagnostic(rootUri, error.fileUri, [diagnostic], connection);
    }

    setEvaluationErrorDiagnostic(rootUri: UriStr, errors: EvaluationError[], connection: Connection): void {
        // Create diagnostics for the errors, grouping them by URI.
        const uriToDiagnostics = new Map<UriStr, Diagnostic[]>();
        for (const error of errors) {
            const isInternalError = error instanceof InternalEvaluationError;
            const message = isInternalError ? `Internal error: ${error.stack}` : error.message;
            const relatedInformation = this.hasDiagnosticRelatedInformationCapability
                ? error.relatedInformation.map(info => convertErrorRelatedInformation(info))
                : [];
            const diagnostic = createDiagnosticError(message, error.range, relatedInformation);

            const existingDiagnostics = uriToDiagnostics.get(error.range.uri);
            if (existingDiagnostics === undefined) {
                uriToDiagnostics.set(error.range.uri, [diagnostic]);
            } else {
                existingDiagnostics.push(diagnostic);
            }
        }

        for (const [uri, diagnostics] of uriToDiagnostics) {
            this._setFileDiagnostic(rootUri, uri, diagnostics, connection);
        }
    }

    setUnknownErrorDiagnostic(rootUri: UriStr, error: Error, connection: Connection): void {
        // We do not know which URI caused the error, so use a dummy error range.
        const uri = '';
        const message = `Internal error: ${error.stack ?? error.message}`;
        const relatedInformation: DiagnosticRelatedInformation[] = [];
        const diagnostic = createDiagnosticError(message, Range.create(0, 0, 0, 0), relatedInformation);
        this._setFileDiagnostic(rootUri, uri, [diagnostic], connection);
    }

    private _setFileDiagnostic(rootUri: UriStr, uri: UriStr, diagnostics: Diagnostic[], connection: Connection): void {
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
        this.clearSettingsDiagnostics(connection);

        for (const documentsForRoot of this._documentRootToDocumentsWithDiagnosticsMap.values()) {
            for (const uri of documentsForRoot) {
                connection.sendDiagnostics({ uri, diagnostics: [] });
            }
        }
    }

    clearSettingsDiagnostics(connection: Connection): void {
        connection.sendDiagnostics({ uri: SETTINGS_URI, diagnostics: [] });
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
