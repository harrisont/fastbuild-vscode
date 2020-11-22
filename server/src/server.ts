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
import { HoverProvider } from './hoversProvider'
import { DefinitionProvider } from './definitionProvider'
import { DiagnosticProvider } from './diagnosticProvider'

class State {
	// Create a connection for the server, using Node's IPC as a transport.
	// Also include all preview / proposed LSP features.
	readonly connection = createConnection(ProposedFeatures.all);

	readonly documents = new TextDocuments(TextDocument);

	readonly hoverProvider = new HoverProvider();
	readonly definitionProvider = new DefinitionProvider();
	diagnosticProvider: DiagnosticProvider | null = null;
}

const state = new State();

state.connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	const hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	state.diagnosticProvider = new DiagnosticProvider(hasDiagnosticRelatedInformationCapability);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			hoverProvider: true,
			definitionProvider: true,
		}
	};

	return result;
});

state.connection.onHover(state.hoverProvider.onHover.bind(state.hoverProvider));
state.connection.onDefinition(state.definitionProvider.onDefinition.bind(state.definitionProvider));

// The content of a file has changed. This event is emitted when the file first opened or when its content has changed.
state.documents.onDidChangeContent(change => {
	state.diagnosticProvider?.onContentChanged(change.document, state.connection);

	const uri = change.document.uri;
	const text = change.document.getText();
	const parsedData = evaluator.evaluate(text);

	state.hoverProvider.onParsedDataChanged(parsedData);
	state.definitionProvider.onParsedDataChanged(uri, parsedData);
});

// Make the text document manager listen on the connection for open, change and close text document events.
state.documents.listen(state.connection);
state.connection.listen();