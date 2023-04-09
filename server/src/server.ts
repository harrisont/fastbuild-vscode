import {
    createConnection,
    DefinitionParams,
    DidChangeConfigurationNotification,
    DidChangeConfigurationParams,
    DocumentSymbolParams,
    HoverParams,
    InitializeParams,
    InitializeResult,
    ProposedFeatures,
    ReferenceParams,
    TextDocuments,
    TextDocumentSyncKind,
    WorkspaceSymbolParams,
} from 'vscode-languageserver';

import {
    TextDocument,
} from 'vscode-languageserver-textdocument';

// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

import { ParseError } from './parser';

import {
    evaluate,
    EvaluatedData,
    EvaluationError,
    SourceRange,
} from './evaluator';

import { HoverProvider } from './features/hoversProvider';
import { DefinitionProvider } from './features/definitionProvider';
import { DiagnosticProvider } from './features/diagnosticProvider';
import { ReferenceProvider } from './features/referenceProvider';
import { SymbolProvider } from './features/symbolProvider';
import { DiskFileSystem } from './fileSystem';
import { ParseDataProvider } from './parseDataProvider';

import * as fs from 'fs';

const ROOT_FBUILD_FILE = 'fbuild.bff';

type UriStr = string;

// Given a FASTBuild file, find the root FASTBuild file that included it.
//
// The root FASTBuild file must be in one of the parent directories.
//
// Return null if no root FASTBuild file exists.
//
// Given the root FASTBuild file, returns itself.
function getRootFbuildFile(uri: vscodeUri.URI): vscodeUri.URI | null {
    let searchUri = uri;
    while (searchUri.path !== '/') {
        searchUri = vscodeUri.Utils.dirname(searchUri);
        const potentialRootFbuildUri = vscodeUri.Utils.joinPath(searchUri, ROOT_FBUILD_FILE);
        if (fs.existsSync(potentialRootFbuildUri.fsPath)) {
            return potentialRootFbuildUri;
        }
    }
    return null;
}

interface Settings {
    logPerformanceMetrics: boolean;
    inputDebounceDelay: number;
}

interface QueuedDocumentUpdate {
    timer: NodeJS.Timer;
    updateFunction: () => void;
}

class State {
    // Create a connection for the server, using Node's IPC as a transport.
    // Also include all preview / proposed LSP features.
    readonly connection = createConnection(ProposedFeatures.all);

    readonly documents = new TextDocuments(TextDocument);

    // Settings cache
    settings: Thenable<Settings> | null = null;

    fileSystem = new DiskFileSystem(this.documents);

    parseDataProvider = new ParseDataProvider(
        this.fileSystem,
        {
            enableDiagnostics: false,
            // No need to include the code location, since the extension will show the error location.
            includeCodeLocationInError: false,
        }
    );

    // Cache the mapping of FASTBuild file to root-FASTBuild file, so that we don't need to compute it each time.
    readonly fileToRootFbuildFileCache = new Map<UriStr, vscodeUri.URI>();

    readonly hoverProvider = new HoverProvider();
    readonly definitionProvider = new DefinitionProvider();
    readonly referenceProvider = new ReferenceProvider();
    readonly diagnosticProvider = new DiagnosticProvider();
    readonly symbolProvider = new SymbolProvider();

    // Map of open documents to their root FASTBuild file
    readonly openDocumentToRootMap = new Map<UriStr, UriStr>();

    // Map of root FASTBuild files to their evaluated data
    readonly rootToEvaluatedDataMap = new Map<UriStr, EvaluatedData>();

    readonly queuedDocumentUpdates = new Map<UriStr, QueuedDocumentUpdate>();

    // Same API as the non-member getRootFbuildFile.
    getRootFbuildFile(uri: vscodeUri.URI): vscodeUri.URI | null {
        const cachedRootUri = this.fileToRootFbuildFileCache.get(uri.toString());
        if (cachedRootUri === undefined) {
            const rootUri = getRootFbuildFile(uri);
            if (rootUri === null) {
                return null;
            }
            this.fileToRootFbuildFileCache.set(uri.toString(), rootUri);
            return rootUri;
        } else {
            return cachedRootUri;
        }
    }

    getRootFbuildEvaluatedData(uriStr: UriStr): EvaluatedData | null {
        const uri = vscodeUri.URI.parse(uriStr);
        const rootFbuildUri = state.getRootFbuildFile(uri);
        if (rootFbuildUri === null) {
            return null;
        }
        const rootFbuildUriStr = rootFbuildUri.toString();
        const evaluatedData = state.rootToEvaluatedDataMap.get(rootFbuildUriStr);
        if (evaluatedData === undefined) {
            return null;
        }
        return evaluatedData;
    }

    getSettings(): Thenable<Settings> {
        if (this.settings === null) {
            this.settings = this.connection.workspace.getConfiguration({
                section: 'fastbuild',
            });
        }
        return this.settings;
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

    state.diagnosticProvider.hasDiagnosticRelatedInformationCapability = hasDiagnosticRelatedInformationCapability;

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            hoverProvider: true,
            definitionProvider: true,
            referencesProvider: true,
            documentSymbolProvider: true,
            workspaceSymbolProvider: true,
            // TODO: add `workspace: { workspaceFolders: { supported: true } }` to add support for workspace folders.
        }
    };

    return result;
});

state.connection.onInitialized(() => {
    // Register for configuration changes.
    state.connection.client.register(DidChangeConfigurationNotification.type, undefined);
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
state.connection.onDidChangeConfiguration((_params: DidChangeConfigurationParams) => {
    // Reset all cached settings
    state.settings = null;
});

state.connection.onHover((params: HoverParams) => {
    // Wait for any queued updates, so that we don't return stale data.
    flushQueuedDocumentUpdates();

    const evaluatedData = state.getRootFbuildEvaluatedData(params.textDocument.uri);
    if (evaluatedData === null) {
        return null;
    }
    return state.hoverProvider.getHover(params, evaluatedData);
});

state.connection.onDefinition((params: DefinitionParams) => {
    // Wait for any queued updates, so that we don't return stale data.
    flushQueuedDocumentUpdates();

    const evaluatedData = state.getRootFbuildEvaluatedData(params.textDocument.uri);
    if (evaluatedData === null) {
        return null;
    }
    return state.definitionProvider.getDefinition(params, evaluatedData);
});

state.connection.onReferences((params: ReferenceParams) => {
    // Wait for any queued updates, so that we don't return stale data.
    flushQueuedDocumentUpdates();

    const evaluatedData = state.getRootFbuildEvaluatedData(params.textDocument.uri);
    if (evaluatedData === null) {
        return null;
    }
    return state.referenceProvider.getReferences(params, evaluatedData);
});

state.connection.onDocumentSymbol((params: DocumentSymbolParams) => {
    // Wait for any queued updates, so that we don't return stale data.
    flushQueuedDocumentUpdates();

    const evaluatedData = state.getRootFbuildEvaluatedData(params.textDocument.uri);
    if (evaluatedData === null) {
        return null;
    }
    return state.symbolProvider.getDocumentSymbols(params, evaluatedData);
});

state.connection.onWorkspaceSymbol((params: WorkspaceSymbolParams) => {
    // Wait for any queued updates, so that we don't return stale data.
    flushQueuedDocumentUpdates();

    return state.symbolProvider.getWorkspaceSymbols(params, state.rootToEvaluatedDataMap.values());
});

// The content of a file has changed. This event is emitted when the file first opened or when its content has changed.
state.documents.onDidChangeContent(change => queueDocumentUpdate(change.document.uri));

// Wait for a period of time before updating.
// This improves the performance when the user is rapidly modifying the document (e.g. typing),
// at the cost of introducing a small amount of latency.
async function queueDocumentUpdate(documentUriStr: UriStr): Promise<void> {
    const settings = await state.getSettings();

    // Cancel any existing queued update.
    const queuedUpdate = state.queuedDocumentUpdates.get(documentUriStr);
    if (queuedUpdate !== undefined) {
        clearTimeout(queuedUpdate.timer);
        state.queuedDocumentUpdates.delete(documentUriStr);
    }

    const updateFunction = () => updateDocument(documentUriStr, settings);

    // Skip the delay and immediately update if the document has no evaulated data.
    // This is necesasry in order to do initially populate the data.
    const evaluatedData = state.getRootFbuildEvaluatedData(documentUriStr);
    if (evaluatedData === null) {
        updateFunction();
    } else {
        // Queue the new update.

        const timer = setTimeout(() => {
            state.queuedDocumentUpdates.delete(documentUriStr);
            updateFunction();
        }, settings.inputDebounceDelay);

        const queuedUpdate: QueuedDocumentUpdate = {
            timer,
            updateFunction,
        };
        state.queuedDocumentUpdates.set(documentUriStr, queuedUpdate);
    }
}

function flushQueuedDocumentUpdates() {
    for (const queuedUpdate of state.queuedDocumentUpdates.values()) {
        queuedUpdate.updateFunction();
        clearTimeout(queuedUpdate.timer);
    }
    state.queuedDocumentUpdates.clear();
}

function updateDocument(changedDocumentUriStr: UriStr, settings: Settings): void {
    const changedDocumentUri = vscodeUri.URI.parse(changedDocumentUriStr);

    let evaluatedData = new EvaluatedData();
    let rootFbuildUriStr = '';
    try {
        // We need to start evaluating from the root FASTBuild file, not from the changed one.
        // This is because changes to a file can affect other files.
        // A future optimization would be to support incremental evaluation.
        const rootFbuildUri = state.getRootFbuildFile(changedDocumentUri);
        if (rootFbuildUri === null) {
            const errorRange = SourceRange.create(changedDocumentUriStr, 0, 0, Number.MAX_VALUE, Number.MAX_VALUE);
            throw new EvaluationError(errorRange, `Could not find a root FASTBuild file ('${ROOT_FBUILD_FILE}') for document '${changedDocumentUri.fsPath}'`);
        }
        rootFbuildUriStr = rootFbuildUri.toString();

        const parseDurationLabel = 'parse-duration';
        if (settings.logPerformanceMetrics) {
            console.time(parseDurationLabel);
        }
        const maybeChangedDocumentParseData = state.parseDataProvider.updateParseData(changedDocumentUri);
        if (maybeChangedDocumentParseData.hasError) {
            if (settings.logPerformanceMetrics) {
                console.timeEnd(parseDurationLabel);
            }
            throw maybeChangedDocumentParseData.getError();
        }

        const maybeRootFbuildParseData = state.parseDataProvider.getParseData(rootFbuildUri);
        if (settings.logPerformanceMetrics) {
            console.timeEnd(parseDurationLabel);
        }
        if (maybeRootFbuildParseData.hasError) {
            throw maybeRootFbuildParseData.getError();
        }
        const rootFbuildParseData = maybeRootFbuildParseData.getValue();

        const evaluationDurationLabel = 'evaluation-duration';
        if (settings.logPerformanceMetrics) {
            console.time(evaluationDurationLabel);
        }
        const evaluatedDataAndMaybeError = evaluate(rootFbuildParseData, rootFbuildUriStr, state.fileSystem, state.parseDataProvider);
        evaluatedData = evaluatedDataAndMaybeError.data;
        state.rootToEvaluatedDataMap.set(rootFbuildUriStr, evaluatedData);
        if (settings.logPerformanceMetrics) {
            console.timeEnd(evaluationDurationLabel);
        }
        if (evaluatedDataAndMaybeError.error !== null) {
            throw evaluatedDataAndMaybeError.error;
        }

        state.diagnosticProvider.clearDiagnosticsForRoot(rootFbuildUriStr, state.connection);
    } catch (error) {
        // Clear previous diagnostics because they are now potentially stale.
        state.diagnosticProvider.clearDiagnosticsForRoot(rootFbuildUriStr, state.connection);

        if (error instanceof ParseError) {
            state.diagnosticProvider.setParseErrorDiagnostic(rootFbuildUriStr, error, state.connection);
        } else if (error instanceof EvaluationError) {
            state.diagnosticProvider.setEvaluationErrorDiagnostic(rootFbuildUriStr, error, state.connection);
        } else if (error instanceof Error) {
            state.diagnosticProvider.setUnknownErrorDiagnostic(rootFbuildUriStr, error, state.connection);
        } else {
            // We should only throw `Error` instances, but handle other types as a fallback.
            // `error` could be anything. Try to get a useful message out of it.
            const typedError = new Error(String(error));
            state.diagnosticProvider.setUnknownErrorDiagnostic(rootFbuildUriStr, typedError, state.connection);
        }
    }
}

// Track the open files by root FASTBuild file.
state.documents.onDidOpen(change => {
    const changedDocumentUriStr: UriStr = change.document.uri;
    const changedDocumentUri = vscodeUri.URI.parse(changedDocumentUriStr);
    const rootFbuildUri = state.getRootFbuildFile(changedDocumentUri);
    // If a document has no root, use itself as its root.
    const rootFbuildUriStr = rootFbuildUri ? rootFbuildUri.toString() : changedDocumentUriStr;
    state.openDocumentToRootMap.set(changedDocumentUriStr, rootFbuildUriStr);
});

// If the closed document's root's tree has no more open documents, clear state for the root.
state.documents.onDidClose(change => {
    const closedDocumentUriStr: UriStr = change.document.uri;
    const rootFbuildUriStr = state.openDocumentToRootMap.get(closedDocumentUriStr);
    if (rootFbuildUriStr === undefined) {
        return;
    }
    state.openDocumentToRootMap.delete(closedDocumentUriStr);
    if (!Array.from(state.openDocumentToRootMap.values()).includes(rootFbuildUriStr)) {
        state.diagnosticProvider.clearDiagnosticsForRoot(rootFbuildUriStr, state.connection);
        state.rootToEvaluatedDataMap.delete(rootFbuildUriStr);
    }
});

// Make the text document manager listen on the connection for open, change and close text document events.
state.documents.listen(state.connection);
state.connection.listen();
