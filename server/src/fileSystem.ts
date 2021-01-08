import {
    TextDocuments,
} from 'vscode-languageserver';

import {
    TextDocument,
} from 'vscode-languageserver-textdocument';

// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

import * as fs from 'fs';

export interface IFileSystem {
    fileExists(uri: vscodeUri.URI): boolean;
    getFileContents(uri: vscodeUri.URI): string;
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
    getFileContents(uri: vscodeUri.URI): string {
        const cachedDocument = this.documents.get(uri.toString());
        if (cachedDocument !== undefined) {
            return cachedDocument.getText();
        } else {
            return fs.readFileSync(uri.fsPath, 'utf-8');
        }
    }
}