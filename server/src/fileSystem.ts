// Only import interfaces/constants from VS Code, not implementation.
// We could add these ourselves, to remove the code dependency, but it's not worthwhile now.

import {
    Connection as IConnection,
    TextDocumentChangeEvent as ITextDocumentChangeEvent,
} from 'vscode-languageserver';

import {
    TextDocument as ITextDocument,
} from 'vscode-languageserver-textdocument';

import {
    Event as IEvent,
} from 'vscode-jsonrpc';

export { IConnection, ITextDocumentChangeEvent, ITextDocument, IEvent };

import {
    Maybe,
} from './coreTypes';

// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

import * as fs from 'fs';

export interface IFileSystem {
    fileExists(uri: vscodeUri.URI): boolean;
    getFileContents(uri: vscodeUri.URI): Maybe<string>;
}

/**
 * A manager for simple text documents
 * 
 * Based on 'vscode-languageserver'.TextDocuments.
 */
export interface ITextDocuments {
    /**
     * An event that fires when a text document managed by this manager
     * has been opened or the content changes.
     */
    onDidChangeContent: IEvent<ITextDocumentChangeEvent<ITextDocument>>;

    /**
     * An event that fires when a text document managed by this manager
     * has been opened.
     */
    onDidOpen: IEvent<ITextDocumentChangeEvent<ITextDocument>>;
    
    /**
     * An event that fires when a text document managed by this manager
     * has been closed.
     */
    onDidClose: IEvent<ITextDocumentChangeEvent<ITextDocument>>;
    
    /**
     * Returns the document for the given URI.
     * Returns undefined if the document is not mananged by this instance.
     *
     * @param uri The text document's URI to retrieve.
     * @return the text document or `undefined`.
     */
    get(uri: string): ITextDocument | undefined;
    
    /**
     * Listens for `low level` notification on the given connection to
     * update the text documents managed by this instance.
     *
     * @param connection The connection to listen on.
     */
    listen(connection: IConnection): void;
}

// Provides an abstraction over reading file contents from either:
//  * disk
//  * a document manager (vscode-languageserver's TextDocuments)
export class DiskFileSystem implements IFileSystem {
    constructor(private readonly documents: ITextDocuments) {
    }
    
    fileExists(uri: vscodeUri.URI): boolean
    {
        const hasCachedDocument = this.documents.get(uri.toString()) !== undefined;
        if (hasCachedDocument) {
            return true;
        } else {
            return fs.existsSync(uri.fsPath);
        }
    }

    // If the file contents already exist in the document manager, return the results from there.
    // Otherwise read the contents from disk.
    // Returns an error on filesystem errors.
    getFileContents(uri: vscodeUri.URI): Maybe<string> {
        const cachedDocument = this.documents.get(uri.toString());
        if (cachedDocument !== undefined) {
            return Maybe.ok(cachedDocument.getText());
        } else {
            try {
                return Maybe.ok(fs.readFileSync(uri.fsPath, 'utf-8'));
            } catch (error) {
                return Maybe.error(error);
            }
        }
    }
}