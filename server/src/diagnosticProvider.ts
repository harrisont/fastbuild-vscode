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
		// The validator creates diagnostics for all uppercase words length 2 and more
		let text = textDocument.getText();
		let pattern = /\b[A-Z]{2,}\b/g;
		let m: RegExpExecArray | null;
	
		let problems = 0;
		let diagnostics: Diagnostic[] = [];
		while ((m = pattern.exec(text))) {
			problems++;
			let diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Warning,
				range: {
					start: textDocument.positionAt(m.index),
					end: textDocument.positionAt(m.index + m[0].length)
				},
				message: `${m[0]} is all uppercase.`,
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