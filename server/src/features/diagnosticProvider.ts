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

export class DiagnosticProvider {
    hasDiagnosticRelatedInformationCapability = false;

    addParseErrorDiagnostic(error: ParseError, connection: Connection): void {
        let range: Range;
        if (error.isNumParsesError) {
            // We don't know the location that causes the wrong number of parses, so use the whole document as the error range.
            range = Range.create(0, 0, Number.MAX_VALUE, Number.MAX_VALUE);
        } else {
            const match = error.message.match(/Error: invalid syntax at line (\d+) col (\d+):/);
            if (match === null) {
                throw new Error(`Failed to parse error location from ParseError: ${error}`);
            }
            // Subtract 1 from the postition because VS Code positions are 0-based, but Nearly is 1-based.
            const startLine = parseInt(match[1]) - 1;
            const startCharacter = parseInt(match[2]) - 1;
            const rangeStart = Position.create(startLine, startCharacter);
            // Use the same end as the start in order to have VS Code auto-match the word.
            range = Range.create(rangeStart, rangeStart);
        }

        const diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Error,
            range,
            message: error.message,
            source: SOURCE_NAME
        };

        const diagnostics = [diagnostic];
        connection.sendDiagnostics({ uri: error.fileUri, diagnostics });
    }

    addEvaluationErrorDiagnostic(error: EvaluationError, connection: Connection): void {
        const diagnostic: Diagnostic = {
            severity: DiagnosticSeverity.Error,
            // TODO: store the range on the EvaluationError and get it here.
            range: Range.create(0, 0, Number.MAX_VALUE, Number.MAX_VALUE),
            message: error.message,
            source: SOURCE_NAME
        };

        const diagnostics = [diagnostic];
        connection.sendDiagnostics({ uri: error.fileUri, diagnostics });
    }

    clearDiagnostics(uri: UriStr, connection: Connection): void {
        connection.sendDiagnostics({ uri, diagnostics: [] });
    }
}