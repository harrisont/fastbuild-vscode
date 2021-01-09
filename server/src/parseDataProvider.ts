// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

import { IFileSystem } from './fileSystem';

import {
    parse,
    ParseData,
    ParseError,
    ParseOptions,
} from './parser';

export type UriStr = string;

// Calculates and caches parse data.
export class ParseDataProvider {
    private data = new Map<UriStr, ParseData>();

    constructor(private readonly fileContentProvider: IFileSystem, private readonly parseOptions: ParseOptions) {
    }
    
    updateParseData(uri: vscodeUri.URI): ParseData {
        const text = this.fileContentProvider.getFileContents(uri);
        try {
            const parseData = parse(text, this.parseOptions);
            this.data.set(uri.toString(), parseData);
            return parseData;
        } catch (error) {
            if (error instanceof ParseError) {
                error.setFile(uri.toString());
            }
            throw error;
        }
    }

    getParseData(uri: vscodeUri.URI): ParseData {
        const cachedData = this.data.get(uri.toString());
        if (cachedData === undefined) {
            return this.updateParseData(uri);
        } else {
            return cachedData;
        }
    }
}