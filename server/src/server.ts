import {
	createConnection,
	Diagnostic,
	DiagnosticSeverity,
	Hover,
	HoverParams,
	InitializeParams,
	InitializeResult,
	MarkupKind,
	ProposedFeatures,
	TextDocuments,
	TextDocumentSyncKind
} from 'vscode-languageserver';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

interface ParsedRange
{
	line: number,
	characterStart: number,
	characterEnd: number
}

interface ParsedString
{
	range: ParsedRange

	// The value of the string after evaluation variables.
	evaluated: string
}

interface ParsedData {
	strings: ParsedString[]
}

function parse(textDocument: TextDocument): ParsedData {
	let strings: ParsedString[] = [];

	const text = textDocument.getText();
	const chars = [...text];
	let line = 0;
	let lineCharIndex = 0;
	let isInString = false;
	let valueIndexStart = 0;
	chars.forEach(char => {
		if (char == "\n") {
			++line;
			// -1 because we always add 1 at the end of the loop.
			lineCharIndex = -1;
		} else if (char == "'") {
			if (isInString) {
				// Ending a string
				const valueIndexEnd = lineCharIndex;
				const parsedString: ParsedString = {
					evaluated: "TODO-evaluated",
					range: {
						line: line,
						characterStart: valueIndexStart,
						characterEnd: valueIndexEnd
					}
				};
				strings.push(parsedString);
				connection.console.log(JSON.stringify(parsedString));
			} else {
				// Starting a string
				valueIndexStart = lineCharIndex + 1;
			}
			
			isInString = !isInString;
		}

		++lineCharIndex;
	});

	return {
		strings: strings
	};
}

const SOURCE_NAME = 'FASTBuild';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasDiagnosticRelatedInformationCapability: boolean = false;

let parsedData: ParsedData | null = null;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			hoverProvider: true
		}
	};

	return result;
});

// The content of a file has changed. This event is emitted when the file first opened or when its content has changed.
documents.onDidChangeContent(change => {
	parsedData = parse(change.document);

	validateFile(change.document);
});

async function validateFile(textDocument: TextDocument): Promise<void> {
	// The validator creates diagnostics for all uppercase words length 2 and more
	let text = textDocument.getText();
	let pattern = /\b[A-Z]{2,}\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	let diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text))) {
		problems++;
		let diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Error,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} is all uppercase.`,
			source: SOURCE_NAME
		};
		if (hasDiagnosticRelatedInformationCapability) {
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

connection.onDidChangeWatchedFiles(_change => {
	connection.console.log('We received an file change event');
});

connection.onHover((params: HoverParams) => {
	const position = params.position;
	const strings = parsedData?.strings ?? [];

	for (let i = 0; i < strings.length; i++)
    {
		const range = strings[i].range;
        if (range.line == position.line
           && (range.characterStart <= position.character && range.characterEnd >= position.character))
        {
			const hoverText = strings[i].evaluated;

			const hover: Hover = {
				contents: {
					kind: MarkupKind.PlainText,
					value: hoverText
				},
				range: {
					start: {
						line: range.line,
						character: range.characterStart,
					},
					end: {
						line: range.line,
						character: range.characterEnd
					}
				}
			}
			return hover;
        }
    }
});

// Make the text document manager listen on the connection for open, change and close text document events
documents.listen(connection);
connection.listen();
