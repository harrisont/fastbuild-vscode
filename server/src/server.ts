import {
    createConnection,
    InitializeParams,
    InitializeResult,
    ProposedFeatures,
    TextDocuments,
    TextDocumentSyncKind,
} from 'vscode-languageserver';

import {
    TextDocument,
} from 'vscode-languageserver-textdocument';

// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

import * as evaluator from './evaluator';

import { HoverProvider } from './features/hoversProvider';
import { DefinitionProvider } from './features/definitionProvider';
import { DiagnosticProvider } from './features/diagnosticProvider';
import { ReferenceProvider } from './features/referenceProvider';
import { FileContentProvider } from './fileContentProvider';
import { ParseDataProvider } from './parseDataProvider';

import * as fs from 'fs';

const ROOT_FBUILD_FILE = 'fbuild.bff';

type UriStr = string;

// Given a FASTBuild file, find the root FASTBuild file that included it.
//
// The root FASTBuild file must be in one of the parent directories.
//
// Given the root FASTBuild file, returns itself.
function getRootFbuildFile(uri: vscodeUri.URI): vscodeUri.URI {
    let searchUri = uri;
    while (searchUri.path !== '/') {
        searchUri = vscodeUri.Utils.dirname(searchUri);
        const potentialRootFbuildUri = vscodeUri.Utils.joinPath(searchUri, ROOT_FBUILD_FILE);
        if (fs.existsSync(potentialRootFbuildUri.fsPath)) {
            return potentialRootFbuildUri;
        }
    }

    throw new Error(`Could not find a root FASTBuild file ('${ROOT_FBUILD_FILE}') for document '${uri}'`);
}

class State {
    // Create a connection for the server, using Node's IPC as a transport.
    // Also include all preview / proposed LSP features.
    readonly connection = createConnection(ProposedFeatures.all);

    readonly documents = new TextDocuments(TextDocument);

    parseDataProvider = new ParseDataProvider(
        new FileContentProvider(this.documents),
        {
            enableDiagnostics: false
        }
    );

    // Cache the mapping of FASTBuild file to root-FASTBuild file, so that we don't need to compute it each time.
    readonly fileToRootFbuildFileCache = new Map<UriStr, vscodeUri.URI>();

    readonly hoverProvider = new HoverProvider();
    readonly definitionProvider = new DefinitionProvider();
    readonly referenceProvider = new ReferenceProvider();
    diagnosticProvider: DiagnosticProvider | null = null;

    getRootFbuildFile(uri: vscodeUri.URI): vscodeUri.URI {
        const cachedRootUri = this.fileToRootFbuildFileCache.get(uri.toString());
        if (cachedRootUri === undefined) {
            const rootUri = getRootFbuildFile(uri);
            this.fileToRootFbuildFileCache.set(uri.toString(), rootUri);
            return rootUri;
        } else {
            return cachedRootUri;
        }
    }
}

const state = new State();

state.connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

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
            referencesProvider: true,
        }
    };

    return result;
});

state.connection.onHover(state.hoverProvider.onHover.bind(state.hoverProvider));
state.connection.onDefinition(state.definitionProvider.onDefinition.bind(state.definitionProvider));
state.connection.onReferences(state.referenceProvider.onReferences.bind(state.referenceProvider));

// The content of a file has changed. This event is emitted when the file first opened or when its content has changed.
state.documents.onDidChangeContent(change => {
    const changedDocumentUri = vscodeUri.URI.parse(change.document.uri);
    state.parseDataProvider.updateParseData(changedDocumentUri);

    // We need to start evaluating from the root FASTBuild file, not from the changed one.
    // This is because changes to a file can affect other files.
    // A future optimization would be to support incremental evaluation.
    const rootFbuildUri = state.getRootFbuildFile(changedDocumentUri);
    const rootFbuildParseData = state.parseDataProvider.getParseData(rootFbuildUri);
    const evaluatedData = evaluator.evaluate(rootFbuildParseData, rootFbuildUri.toString(), state.parseDataProvider);

    state.hoverProvider.onEvaluatedDataChanged(evaluatedData);
    state.definitionProvider.onEvaluatedDataChanged(changedDocumentUri.toString(), evaluatedData);
    state.referenceProvider.onEvaluatedDataChanged(changedDocumentUri.toString(), evaluatedData);
    
    // Placeholder for diagnostics. This will likely need to change to behave like the other providers, and take the evaluated data.
    state.diagnosticProvider?.onContentChanged(change.document, state.connection);
});

// Make the text document manager listen on the connection for open, change and close text document events.
state.documents.listen(state.connection);
state.connection.listen();