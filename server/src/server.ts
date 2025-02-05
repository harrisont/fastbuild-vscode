import {
    CompletionItem,
    CompletionParams,
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
    TextDocumentChangeEvent,
    TextDocuments,
    TextDocumentSyncKind,
    WorkspaceSymbolParams,
} from 'vscode-languageserver';

import {
    TextDocument,
} from 'vscode-languageserver-textdocument';

// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

import {
    Maybe,
} from './coreTypes';

import { ParseError } from './parser';

import {
    DataAndMaybeError,
    evaluate,
    EvaluatedData,
    evaluateUntilPosition,
    EvaluationContext,
    EvaluationError,
    SourcePositionWithUri,
    SourceRange,
} from './evaluator';

import {
    Settings,
    SettingsError,
    getRootFileSettingError,
} from './settings';

import * as hoverProvider from './features/hoversProvider';
import * as definitionProvider from './features/definitionProvider';
import { DiagnosticProvider } from './features/diagnosticProvider';
import * as referenceProvider from './features/referenceProvider';
import * as symbolProvider from './features/symbolProvider';
import * as completionProvider from './features/completionProvider';
import { DiskFileSystem } from './fileSystem';
import { ParseDataProvider } from './parseDataProvider';

import * as fs from 'fs';

const ROOT_FBUILD_FILE = 'fbuild.bff';
const CONFIGURATION_SECTION = 'fastbuild';

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
    settings: Settings | null = null;
    // Errors in the cached settings.
    settingsErrors: SettingsError[] = [];

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

    readonly diagnosticProvider = new DiagnosticProvider();

    // Map of open documents to their root FASTBuild file
    readonly openDocumentToRootMap = new Map<UriStr, UriStr>();

    // Map of root FASTBuild files to their evaluated data
    readonly rootToEvaluatedDataMap = new Map<UriStr, EvaluatedData>();

    readonly queuedDocumentUpdates = new Map<UriStr, QueuedDocumentUpdate>();

    // Same API as the non-member getRootFbuildFile.
    async getRootFbuildFile(uri: vscodeUri.URI): Promise<vscodeUri.URI | null> {
        const cachedRootUri = this.fileToRootFbuildFileCache.get(uri.toString());
        if (cachedRootUri === undefined) {
            let rootUri: vscodeUri.URI | null = null;
            const settings = await this.getSettings();
            if (settings.rootFile) {
                rootUri = vscodeUri.URI.file(settings.rootFile);
            } else {
                rootUri = getRootFbuildFile(uri);
                if (rootUri === null) {
                    return null;
                }
            }
            this.fileToRootFbuildFileCache.set(uri.toString(), rootUri);
            return rootUri;
        } else {
            return cachedRootUri;
        }
    }

    async getRootFbuildEvaluatedData(uriStr: UriStr): Promise<EvaluatedData | null> {
        const uri = vscodeUri.URI.parse(uriStr);
        const rootFbuildUri = await state.getRootFbuildFile(uri);
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

    async getSettings(): Promise<Settings> {
        if (this.settings === null) {
            // Get the initial configuration.
            const settings = await state.connection.workspace.getConfiguration({
                section: CONFIGURATION_SECTION,
            });
            if (settings === null) {
                throw new Error("Failed to get settings");
            }
            return state.processChangedSettings(settings);
        } else {
            return this.settings;
        }
    }

    // Return the sanitized settings.
    processChangedSettings(newSettings: Settings): Settings {
        const sanitizedSettings = newSettings;

        // Validate the settings and sanitize them.
        this.settingsErrors = [];
        const rootFileSettingError = getRootFileSettingError(newSettings.rootFile);
        if (rootFileSettingError) {
            this.settingsErrors.push(rootFileSettingError);
            sanitizedSettings.rootFile = "";
        }

        this.settings = sanitizedSettings;

        // Clear all the diagnostics, to avoid showing outdated non-setting diagnostics.
        this.diagnosticProvider.clearDiagnostics(this.connection);
        // Set the settings diagnostics.
        if (this.settingsErrors.length) {
            this.diagnosticProvider.setSettingsErrorDiagnostic(this.settingsErrors, this.connection);
        }

        // The changed settings could impact the cached results, so clear them.
        state.rootToEvaluatedDataMap.clear();

        return sanitizedSettings;
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
            completionProvider: {
                triggerCharacters: [ '.', '^' ],
            },
        }
    };

    return result;
});

state.connection.onInitialized(() => {
    // Register for configuration changes.
    state.connection.client.register(DidChangeConfigurationNotification.type, {
        section: CONFIGURATION_SECTION,
    });
});

state.connection.onDidChangeConfiguration((params: DidChangeConfigurationParams) => {
    try {
        const settings = params.settings[CONFIGURATION_SECTION];
        state.processChangedSettings(settings);
    } catch(error) {
        let message = '';
        if (error instanceof Error) {
            message = `${error.stack}`;
        } else {
            message = `${error}`;
        }
        console.log(`onDidChangeConfiguration error: ${message}`);
    }
});

state.connection.onHover(async (params: HoverParams) => {
    // Wait for any queued updates, so that we don't return stale data.
    await flushQueuedDocumentUpdates();

    const evaluatedData = await state.getRootFbuildEvaluatedData(params.textDocument.uri);
    if (evaluatedData === null) {
        return null;
    }
    return hoverProvider.getHover(params, evaluatedData);
});

state.connection.onDefinition(async (params: DefinitionParams) => {
    // Wait for any queued updates, so that we don't return stale data.
    await flushQueuedDocumentUpdates();

    const evaluatedData = await state.getRootFbuildEvaluatedData(params.textDocument.uri);
    if (evaluatedData === null) {
        return null;
    }
    return definitionProvider.getDefinition(params, evaluatedData);
});

state.connection.onReferences(async (params: ReferenceParams) => {
    // Wait for any queued updates, so that we don't return stale data.
    await flushQueuedDocumentUpdates();

    const evaluatedData = await state.getRootFbuildEvaluatedData(params.textDocument.uri);
    if (evaluatedData === null) {
        return null;
    }
    return referenceProvider.getReferences(params, evaluatedData);
});

state.connection.onDocumentSymbol(async (params: DocumentSymbolParams) => {
    // Wait for any queued updates, so that we don't return stale data.
    await flushQueuedDocumentUpdates();

    const evaluatedData = await state.getRootFbuildEvaluatedData(params.textDocument.uri);
    if (evaluatedData === null) {
        return null;
    }
    return symbolProvider.getDocumentSymbols(params, evaluatedData);
});

state.connection.onWorkspaceSymbol(async (params: WorkspaceSymbolParams) => {
    // Wait for any queued updates, so that we don't return stale data.
    await flushQueuedDocumentUpdates();

    return symbolProvider.getWorkspaceSymbols(params, state.rootToEvaluatedDataMap.values());
});

state.connection.onCompletion(async (params: CompletionParams): Promise<CompletionItem[]> => {
    // Wait for any queued updates, so that we don't return stale data.
    await flushQueuedDocumentUpdates();

    //
    // Calculate the evaluated data only up to the specified position, to avoid making suggestions for symbols defined after the position.
    //
    const untilPosition = new SourcePositionWithUri(params.textDocument.uri, params.position);
    const maybeEvaluationContextAndMaybeError = await evaluateUntilPositionWrapper(untilPosition);
    if (maybeEvaluationContextAndMaybeError.hasError) {
        // There was an error doing any evaluation, so return no completions.
        return [];
    }
    const evaluatedDataAndMaybeError = maybeEvaluationContextAndMaybeError.getValue();
    if (evaluatedDataAndMaybeError.error !== null) {
        // The evaluation partially completed, so continue to use what completions we can.
    }

    return completionProvider.getCompletions(params, evaluatedDataAndMaybeError.data, true /*isTriggerCharacterInContent*/);
});

async function evaluateUntilPositionWrapper(untilPosition: SourcePositionWithUri): Promise<Maybe<DataAndMaybeError<EvaluationContext>>> {
    const positionUri = vscodeUri.URI.parse(untilPosition.uri);
    const rootFbuildUri = await state.getRootFbuildFile(positionUri);
    if (rootFbuildUri === null) {
        return Maybe.error(new Error(`Could not find a root FASTBuild file ('${ROOT_FBUILD_FILE}') for document '${positionUri.fsPath}'`));
    }
    const rootFbuildUriStr = rootFbuildUri.toString();

    const maybeRootFbuildParseData = state.parseDataProvider.getParseData(rootFbuildUri, true /*includeStale*/);
    if (maybeRootFbuildParseData.hasError) {
        return Maybe.error(maybeRootFbuildParseData.getError());
    }
    const rootFbuildParseData = maybeRootFbuildParseData.getValue();

    const evaluationContextAndMaybeError =
        evaluateUntilPosition(
            rootFbuildParseData,
            rootFbuildUriStr,
            state.fileSystem,
            state.parseDataProvider,
            untilPosition,
            true /*includeStaleParseData*/);
    return Maybe.ok(evaluationContextAndMaybeError);
}

// The content of a file has changed. This event is emitted when the file first opened or when its content has changed.
//
// Note that it also can occur when holding 'Ctrl' (the go-to-definition hotkey) and hovering over a reference
// whose definition is in an unopened file.
// In this case, VS Code opens and closes that file, which triggers this `onDidChangeContent` event even though
// no content changed.
// See [#59](https://github.com/harrisont/fastbuild-vscode/issues/59) for details.
state.documents.onDidChangeContent(change => {
    queueDocumentUpdate(change);
});

// Wait for a period of time before updating.
// This improves the performance when the user is rapidly modifying the document (e.g. typing),
// at the cost of introducing a small amount of latency.
async function queueDocumentUpdate(change: TextDocumentChangeEvent<TextDocument>): Promise<void> {
    const documentUriStr = change.document.uri;
    const settings = await state.getSettings();

    // Cancel any existing queued update.
    const queuedUpdate = state.queuedDocumentUpdates.get(documentUriStr);
    if (queuedUpdate !== undefined) {
        clearTimeout(queuedUpdate.timer);
        state.queuedDocumentUpdates.delete(documentUriStr);
    }

    const updateFunction = async () => await updateDocument(change, settings);

    // Skip the delay and immediately update if the document has no evaluated data.
    // This is necessary in order to do initially populate the data.
    const evaluatedData = await state.getRootFbuildEvaluatedData(documentUriStr);
    if (evaluatedData === null) {
        await updateFunction();
    } else {
        // Queue the new update.

        const timer = setTimeout(async () => {
            state.queuedDocumentUpdates.delete(documentUriStr);
            await updateFunction();
        }, settings.inputDebounceDelay);

        const queuedUpdate: QueuedDocumentUpdate = {
            timer,
            updateFunction,
        };
        state.queuedDocumentUpdates.set(documentUriStr, queuedUpdate);
    }
}

async function flushQueuedDocumentUpdates() {
    for (const queuedUpdate of state.queuedDocumentUpdates.values()) {
        await queuedUpdate.updateFunction();
        clearTimeout(queuedUpdate.timer);
    }
    state.queuedDocumentUpdates.clear();
}

async function updateDocument(change: TextDocumentChangeEvent<TextDocument>, settings: Settings): Promise<void> {
    if (state.settingsErrors.length) {
        return;
    }

    const changedDocumentUriStr = change.document.uri;
    const changedDocumentUri = vscodeUri.URI.parse(changedDocumentUriStr);

    let evaluatedData = new EvaluatedData();
    let rootFbuildUriStr = '';
    try {
        // We need to start evaluating from the root FASTBuild file, not from the changed one.
        // This is because changes to a file can affect other files.
        // A future optimization would be to support incremental evaluation.
        const rootFbuildUri = await state.getRootFbuildFile(changedDocumentUri);
        if (rootFbuildUri === null) {
            const errorRange = SourceRange.create(changedDocumentUriStr, 0, 0, Number.MAX_VALUE, Number.MAX_VALUE);
            throw new EvaluationError(errorRange, `Could not find a root FASTBuild file ('${ROOT_FBUILD_FILE}') for document '${changedDocumentUri.fsPath}'`, []);
        }
        rootFbuildUriStr = rootFbuildUri.toString();

        const cachedEvaluatedData = state.rootToEvaluatedDataMap.get(rootFbuildUriStr);
        const changedDocumentContent = change.document.getText();
        const cachedDocumentContent = state.parseDataProvider.getCachedDocumentContent(changedDocumentUri);
        if (cachedEvaluatedData !== undefined && changedDocumentContent === cachedDocumentContent) {
            return;
        }

        const parseDurationLabel = 'parse-duration';
        if (settings.logPerformanceMetrics) {
            console.time(parseDurationLabel);
        }
        const maybeChangedDocumentParseData = state.parseDataProvider.updateParseDataWithContent(changedDocumentUri, changedDocumentContent);
        if (maybeChangedDocumentParseData.hasError) {
            if (settings.logPerformanceMetrics) {
                console.timeEnd(parseDurationLabel);
            }
            throw maybeChangedDocumentParseData.getError();
        }

        const maybeRootFbuildParseData = state.parseDataProvider.getParseData(rootFbuildUri, false /*includeStale*/);
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
        evaluatedData = evaluatedDataAndMaybeError.data.evaluatedData;
        state.rootToEvaluatedDataMap.set(rootFbuildUriStr, evaluatedData);
        if (settings.logPerformanceMetrics) {
            console.timeEnd(evaluationDurationLabel);
        }
        if (evaluatedDataAndMaybeError.error !== null) {
            throw evaluatedDataAndMaybeError.error;
        }

        state.diagnosticProvider.clearDiagnosticsForRoot(rootFbuildUriStr, state.connection);

        // Handle non-fatal errors.
        state.diagnosticProvider.setEvaluationErrorDiagnostic(rootFbuildUriStr, evaluatedData.nonFatalErrors, state.connection);
    } catch (error) {
        // Handle fatal errors.

        // Clear previous diagnostics because they are now potentially stale.
        state.diagnosticProvider.clearDiagnosticsForRoot(rootFbuildUriStr, state.connection);

        if (error instanceof ParseError) {
            state.diagnosticProvider.setParseErrorDiagnostic(rootFbuildUriStr, error, state.connection);
        } else if (error instanceof EvaluationError) {
            const errors = [...evaluatedData.nonFatalErrors, error];
            state.diagnosticProvider.setEvaluationErrorDiagnostic(rootFbuildUriStr, errors, state.connection);
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
state.documents.onDidOpen(async change => {
    const changedDocumentUriStr: UriStr = change.document.uri;
    const changedDocumentUri = vscodeUri.URI.parse(changedDocumentUriStr);
    const rootFbuildUri = await state.getRootFbuildFile(changedDocumentUri);
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
