import {
    TextDocuments,
} from 'vscode-languageserver';

import {
    TextDocument,
} from 'vscode-languageserver-textdocument';

import * as fs from 'fs';

export interface IFileContentProvider {
    getFileContents(uri: string): string;
}

// Provides an abstraction over reading file contents from either:
//  * disk
//  * a document manager (vscode-languageserver's TextDocuments)
export class FileContentProvider implements IFileContentProvider {
    constructor(private readonly documents: TextDocuments<TextDocument>) {
    }

    // If the file contents already exist in the document manager, return the results from there.
    // Otherwise read the contents from disk.
    getFileContents(uri: string): string {
        console.log(`getFileContents('${uri}'): documents=${this.documents.keys()}`);

        const cachedDocument = this.documents.get(uri);
        if (cachedDocument !== undefined) {
            return cachedDocument.getText();
        } else {
            return fs.readFileSync(uri, 'utf-8');
        }
    }
}