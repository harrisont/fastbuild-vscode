import {
    TextDocuments,
} from 'vscode-languageserver';

import {
    TextDocument,
} from 'vscode-languageserver-textdocument';

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

// Provides an abstraction over reading file contents from either:
//  * disk
//  * a document manager (vscode-languageserver's TextDocuments)
export class DiskFileSystem implements IFileSystem {
    constructor(private readonly documents: TextDocuments<TextDocument>) {
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