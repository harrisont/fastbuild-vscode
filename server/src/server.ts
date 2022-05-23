//
// The language server.
//
// Uses dependency injection to prevent depending on VS Code, for testability.
// `vscodeServer.ts` instantiates a server.
//


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
import { DiskFileSystem, ITextDocuments } from './fileSystem';
import { ParseDataProvider } from './parseDataProvider';

import * as fs from 'fs';

// Only import interfaces/constants from VS Code, not implementation.
// We could add these ourselves, to remove the code dependency, but it's not worthwhile now.

import {
    Connection as IConnection,
    TextDocumentChangeEvent as ITextDocumentChangeEvent,
    TextDocumentSyncKind,
} from 'vscode-languageserver';

import {
    InitializeParams as IConnectionInitializeParams,
    InitializeResult as IConnectionInitializeResult,
} from 'vscode-languageserver-protocol';

import {
    TextDocument as ITextDocument,
} from 'vscode-languageserver-textdocument';

// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

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

export class Server {
    private fileSystem: DiskFileSystem;
    private parseDataProvider: ParseDataProvider;

    // Cache the mapping of FASTBuild file to root-FASTBuild file, so that we don't need to compute it each time.
    private readonly fileToRootFbuildFileCache = new Map<UriStr, vscodeUri.URI>();

    private readonly hoverProvider = new HoverProvider();
    private readonly definitionProvider = new DefinitionProvider();
    private readonly referenceProvider = new ReferenceProvider();
    private readonly diagnosticProvider = new DiagnosticProvider();

    // Map of open documents to their root FASTBuild file
    private readonly openDocumentToRootMap = new Map<UriStr, UriStr>();

    constructor(private readonly connection: IConnection, private readonly documents: ITextDocuments)
    {
        this.fileSystem = new DiskFileSystem(documents);

        this.parseDataProvider = new ParseDataProvider(
            this.fileSystem,
            {
                enableDiagnostics: false
            }
        );

        connection.onInitialize((params: IConnectionInitializeParams) => {
            const capabilities = params.capabilities;

            const hasDiagnosticRelatedInformationCapability = !!(
                capabilities.textDocument &&
                capabilities.textDocument.publishDiagnostics &&
                capabilities.textDocument.publishDiagnostics.relatedInformation
            );

            this.diagnosticProvider.hasDiagnosticRelatedInformationCapability = hasDiagnosticRelatedInformationCapability;

            const result: IConnectionInitializeResult = {
                capabilities: {
                    textDocumentSync: TextDocumentSyncKind.Incremental,
                    hoverProvider: true,
                    definitionProvider: true,
                    referencesProvider: true,
                }
            };

            return result;
        });

        connection.onHover(this.hoverProvider.onHover.bind(this.hoverProvider));
        connection.onDefinition(this.definitionProvider.onDefinition.bind(this.definitionProvider));
        connection.onReferences(this.referenceProvider.onReferences.bind(this.referenceProvider));

        documents.onDidOpen(this.onDocumentDidOpen);
        documents.onDidClose(this.onDocumentDidClose);
        // The content of a file has changed. This event is emitted when the file first opened or when its content has changed.
        documents.onDidChangeContent(this.onDocumentDidChangeContent);

        documents.listen(connection);
        connection.listen();
    }

    // Same API as the non-member getRootFbuildFile.
    private getRootFbuildFile(uri: vscodeUri.URI): vscodeUri.URI | null {
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

    private onDocumentDidChangeContent(event: ITextDocumentChangeEvent<ITextDocument>): void {
        const changedDocumentUriStr: UriStr = event.document.uri;
        const changedDocumentUri = vscodeUri.URI.parse(changedDocumentUriStr);

        let evaluatedData = new EvaluatedData();
        let rootFbuildUriStr = '';
        try {
            // We need to start evaluating from the root FASTBuild file, not from the changed one.
            // This is because changes to a file can affect other files.
            // A future optimization would be to support incremental evaluation.
            const rootFbuildUri = this.getRootFbuildFile(changedDocumentUri);
            if (rootFbuildUri === null) {
                const errorRange = SourceRange.create(changedDocumentUriStr, 0, 0, Number.MAX_VALUE, Number.MAX_VALUE);
                throw new EvaluationError(errorRange, `Could not find a root FASTBuild file ('${ROOT_FBUILD_FILE}') for document '${changedDocumentUri.fsPath}'`);
            }
            rootFbuildUriStr = rootFbuildUri.toString();

            const maybeChangedDocumentParseData = this.parseDataProvider.updateParseData(changedDocumentUri);
            if (maybeChangedDocumentParseData.hasError) {
                throw maybeChangedDocumentParseData.getError();
            }

            const maybeRootFbuildParseData = this.parseDataProvider.getParseData(rootFbuildUri);
            if (maybeRootFbuildParseData.hasError) {
                throw maybeRootFbuildParseData.getError();
            }
            const rootFbuildParseData = maybeRootFbuildParseData.getValue();

            const evaluatedDataAndMaybeError = evaluate(rootFbuildParseData, rootFbuildUriStr, this.fileSystem, this.parseDataProvider);
            evaluatedData = evaluatedDataAndMaybeError.data;
            if (evaluatedDataAndMaybeError.error !== null) {
                throw evaluatedDataAndMaybeError.error;
            }
            
            this.diagnosticProvider.clearDiagnosticsForRoot(rootFbuildUriStr, this.connection);
        } catch (error) {
            if (error instanceof ParseError) {
                this.diagnosticProvider.setParseErrorDiagnostic(rootFbuildUriStr, error, this.connection);
            } else if (error instanceof EvaluationError) {
                this.diagnosticProvider.setEvaluationErrorDiagnostic(rootFbuildUriStr, error, this.connection);
            } else {
                this.diagnosticProvider.setUnknownErrorDiagnostic(rootFbuildUriStr, error, this.connection);
            }
        }

        this.hoverProvider.onEvaluatedDataChanged(evaluatedData);
        this.definitionProvider.onEvaluatedDataChanged(changedDocumentUri.toString(), evaluatedData);
        this.referenceProvider.onEvaluatedDataChanged(changedDocumentUri.toString(), evaluatedData);
    }

    // Track the open files by root FASTBuild file.
    private onDocumentDidOpen(event: ITextDocumentChangeEvent<ITextDocument>) {
        const changedDocumentUriStr: UriStr = event.document.uri;
        const changedDocumentUri = vscodeUri.URI.parse(changedDocumentUriStr);
        const rootFbuildUri = this.getRootFbuildFile(changedDocumentUri);
        // If a document has no root, use itself as its root.
        const rootFbuildUriStr = rootFbuildUri ? rootFbuildUri.toString() : changedDocumentUriStr;
        this.openDocumentToRootMap.set(changedDocumentUriStr, rootFbuildUriStr);
    }

    // If the closed document's root's tree has no more open documents, clear diagnostics for the root.
    private onDocumentDidClose(event: ITextDocumentChangeEvent<ITextDocument>) {
        const closedDocumentUriStr: UriStr = event.document.uri;
        const rootFbuildUriStr = this.openDocumentToRootMap.get(closedDocumentUriStr);
        if (rootFbuildUriStr === undefined) {
            return;
        }
        this.openDocumentToRootMap.delete(closedDocumentUriStr);
        if (!Array.from(this.openDocumentToRootMap.values()).includes(rootFbuildUriStr)) {
            this.diagnosticProvider.clearDiagnosticsForRoot(rootFbuildUriStr, this.connection);
        }
    }
}