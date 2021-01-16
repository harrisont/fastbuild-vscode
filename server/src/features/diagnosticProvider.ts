import {
    Connection,
    Diagnostic,
    DiagnosticSeverity,
} from 'vscode-languageserver';

import {
    Position,
    Range,
} from 'vscode-languageserver-types';

import {
    ParseError
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
    let match: RegExpMatchArray | null = null;
    if (error.isNumParsesError) {
        // We don't know the location that causes the wrong number of parses, so use the whole document as the error range.
        return createDiagnosticError(error.message, createWholeDocumentRange());
    } else if ((match = error.message.match(/Error: (?:(?:invalid syntax)|(?:Syntax error)) at line (\d+) col (\d+):/)) !== null) {
        // Subtract 1 from the postition because VS Code positions are 0-based, but Nearly is 1-based.
        const startLine = parseInt(match[1]) - 1;
        const startCharacter = parseInt(match[2]) - 1;
        const rangeStart = Position.create(startLine, startCharacter);
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

    addParseErrorDiagnostic(error: ParseError, connection: Connection): void {
        const diagnostic = createDiagnosticFromParseError(error);
        const diagnostics = [diagnostic];
        connection.sendDiagnostics({ uri: error.fileUri, diagnostics });
    }

    addEvaluationErrorDiagnostic(error: EvaluationError, connection: Connection): void {
        const isInternalError = error instanceof InternalEvaluationError;
        const message = isInternalError ? `Internal error: ${error.message}` : error.message;
        const diagnostic = createDiagnosticError(message, error.range);
        const diagnostics = [diagnostic];
        connection.sendDiagnostics({ uri: error.range.uri, diagnostics });
    }

    addUnknownErrorDiagnostic(error: Error, connection: Connection): void {
        // We do not know which URI caused the error, so use a dummy error range.
        const uri = '';
        const message = `Internal error: ${error.message}`;
        const diagnostic = createDiagnosticError(message, Range.create(0, 0, 0, 0));
        const diagnostics = [diagnostic];
        connection.sendDiagnostics({ uri, diagnostics });
    }

    clearDiagnostics(uri: UriStr, connection: Connection): void {
        connection.sendDiagnostics({ uri, diagnostics: [] });
    }
}