import {
    Connection,
    Diagnostic,
    DiagnosticSeverity,
} from 'vscode-languageserver';

import {
    TextDocument
} from 'vscode-languageserver-textdocument';

const SOURCE_NAME = 'FASTBuild';

export class DiagnosticProvider {
    constructor(readonly hasDiagnosticRelatedInformationCapability: boolean) {
    }

    // Sends diagnostics about the document through the connection.
    async onContentChanged(textDocument: TextDocument, connection: Connection): Promise<void> {
        // Placeholder diagnostic.

        // The validator creates diagnostics for all uppercase words length 2 and more
        const text = textDocument.getText();
        const pattern = /\b[A-Z]{2,}\b/g;
        let m: RegExpExecArray | null;
    
        const diagnostics: Diagnostic[] = [];
        while ((m = pattern.exec(text))) {
            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Warning,
                range: {
                    start: textDocument.positionAt(m.index),
                    end: textDocument.positionAt(m.index + m[0].length)
                },
                message: `[Placeholder Diagnostic] ${m[0]} is all uppercase.`,
                source: SOURCE_NAME
            };
            if (this.hasDiagnosticRelatedInformationCapability) {
                diagnostic.relatedInformation = [
                    {
                        location: {
                            uri: textDocument.uri,
                            range: Object.assign({}, diagnostic.range)
                        },
                        message: 'Spelling matters'
                    }
                ];
            }
            diagnostics.push(diagnostic);
        }
    
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    }
}