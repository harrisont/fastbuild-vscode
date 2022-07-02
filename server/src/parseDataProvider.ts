// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

import { IFileSystem } from './fileSystem';

import {
    Maybe,
} from './coreTypes';

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

    // Calculates the parse data for a URI, caches it, and returns it.
    //
    // Returns |Error| on failing to read the file contents.
    // Returns |ParseError| on failing to parse the file contents.
    updateParseData(uri: vscodeUri.URI): Maybe<ParseData> {
        const maybeText = this.fileContentProvider.getFileContents(uri);
        if (maybeText.hasError) {
            return Maybe.error(maybeText.getError());
        }
        const text = maybeText.getValue();
        try {
            const parseData = parse(text, uri.toString(), this.parseOptions);
            this.data.set(uri.toString(), parseData);
            return Maybe.ok(parseData);
        } catch (error) {
            return Maybe.error(error);
        }
    }

    // Returns the parse data for a URI.
    // If the data is already cached, it just returns it, even if the cached data is stale.
    // Otherwise, it calculates the parse data and caches it.
    //
    // Returns |Error| on failing to read the file contents.
    // Returns |ParseError| on failing to parse the file contents.
    getParseData(uri: vscodeUri.URI): Maybe<ParseData> {
        const cachedData = this.data.get(uri.toString());
        if (cachedData === undefined) {
            return this.updateParseData(uri);
        } else {
            return Maybe.ok(cachedData);
        }
    }
}