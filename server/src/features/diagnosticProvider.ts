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

function createDiagnosticFromParseError(error: ParseError): Diagnostic {
    let match: RegExpMatchArray | null = null;
    if (error.isNumParsesError) {
        // We don't know the location that causes the wrong number of parses, so use the whole document as the error range.
        const range = Range.create(0, 0, Number.MAX_VALUE, Number.MAX_VALUE);
        return createDiagnosticError(error.message, range);
    } else if ((match = error.message.match(/Error: (?:(?:invalid syntax)|(?:Syntax error)) at line (\d+) col (\d+):/)) !== null) {
        // Subtract 1 from the postition because VS Code positions are 0-based, but Nearly is 1-based.
        const startLine = parseInt(match[1]) - 1;
        const startCharacter = parseInt(match[2]) - 1;
        const rangeStart = Position.create(startLine, startCharacter);
        // Use the same end as the start in order to have VS Code auto-match the word.
        const range = Range.create(rangeStart, rangeStart);
        return createDiagnosticError(error.message, range);
    } else {
        const range = Range.create(0, 0, Number.MAX_VALUE, Number.MAX_VALUE);
        return createDiagnosticError(`Failed to parse error location from ParseError: ${error}`, range);
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
        const diagnostic = createDiagnosticError(error.message, error.range);
        const diagnostics = [diagnostic];
        connection.sendDiagnostics({ uri: error.range.uri, diagnostics });
    }

    clearDiagnostics(uri: UriStr, connection: Connection): void {
        connection.sendDiagnostics({ uri, diagnostics: [] });
    }
}