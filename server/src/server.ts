// Provide information when hovering over symbols.

import {
	createConnection,
	InitializeParams,
	InitializeResult,
	ProposedFeatures,
	TextDocuments,
	TextDocumentSyncKind
} from 'vscode-languageserver';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import * as evaluator from './evaluator'
import * as hovers from './hovers'
import * as diagnostic from './diagnostic'

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

const documents = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	const hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	diagnostic.configure(connection, hasDiagnosticRelatedInformationCapability);

	hovers.configure(connection);

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
	const text = change.document.getText();
	const parsedData = evaluator.evaluate(text);

	hovers.onParsedDataChanged(parsedData);
	diagnostic.onDidChangeContent(change.document);
});

// Make the text document manager listen on the connection for open, change and close text document events.
documents.listen(connection);
connection.listen();