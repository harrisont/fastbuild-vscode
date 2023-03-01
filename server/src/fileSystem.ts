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
                if (error instanceof Error) {
                    return Maybe.error(error);
                } else {
                    // `error` should be an `Error` instance, but handle other types as a fallback.
                    // `error` could be anything. Try to get a useful message out of it.
                    const typedError = new Error(String(error));
                    return Maybe.error(typedError);
                }
            }
        }
    }
}