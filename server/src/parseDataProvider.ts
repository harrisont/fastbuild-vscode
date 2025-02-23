// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

import { IFileSystem } from './fileSystem';

import {
    Maybe,
} from './coreTypes';

import {
    parse,
    ParseData,
    ParseOptions,
} from './parser';

export type UriStr = string;

interface CachedParseData {
    // If true, the info is for an older version of the content.
    // This is likely due to an in-progress text edit.
    isStale: boolean;

    data: ParseData;

    // The file content used to generate the cached parse data.
    // This is important to save so that we can know if we can re-use the cached data or need to re-calculate it.
    //
    // Alternatively, we could choose to store a hash of the content.
    // This has the advantage of taking less memory, but has the disadvantage of taking more compute.
    fileContent: string;
}

// Calculates and caches parse data.
export class ParseDataProvider {
    private data = new Map<UriStr, CachedParseData>();

    constructor(private readonly fileContentProvider: IFileSystem, private readonly parseOptions: ParseOptions) {
    }

    // Reads the URI's file content, calculates the parse data, caches it, and returns it.
    //
    // Returns |Error| on failing to read the file contents.
    // Returns |ParseError| on failing to parse the file contents.
    updateParseData(uri: vscodeUri.URI): Maybe<ParseData> {
        const maybeContent = this.fileContentProvider.getFileContents(uri);
        if (maybeContent.hasError) {
            return Maybe.error(maybeContent.getError());
        }
        const content = maybeContent.getValue();
        return this.updateParseDataWithContent(uri, content);
    }

    // Calculates the parse data for the given URI and content, caches it, and returns it.
    //
    // Returns |ParseError| on failing to parse the file contents.
    updateParseDataWithContent(uri: vscodeUri.URI, content: string): Maybe<ParseData>  {
        const maybeParseData = parse(content, uri.toString(), this.parseOptions);
        if (maybeParseData.hasError) {
            const existingData = this.data.get(uri.toString());
            if (existingData !== undefined) {
                // Mark the existing data as stale instead of deleting it, so that we can still do
                // useful things like auto-completion while in the middle of editing text.
                existingData.isStale = true;
            }
            
            const error = maybeParseData.getError();
            if (error instanceof Error) {
                return Maybe.error(error);
            } else {
                // We should only throw `Error` instances, but handle other types as a fallback.
                // `error` could be anything. Try to get a useful message out of it.
                const typedError = new Error(String(error));
                return Maybe.error(typedError);
            }
        } else {
            const parseData = maybeParseData.getValue();
            this.data.set(uri.toString(), {
                isStale: false,
                data: parseData,
                fileContent: content,
            });
            return Maybe.ok(parseData);
        }
    }

    // Returns the parse data for a URI.
    // If the data is already cached, it just returns it, even if the cached data is stale.
    // Otherwise, it calculates the parse data and caches it.
    //
    // Returns |Error| on failing to read the file contents.
    // Returns |ParseError| on failing to parse the file contents.
    getParseData(uri: vscodeUri.URI, includeStale: boolean): Maybe<ParseData> {
        const cachedData = this.data.get(uri.toString());
        if (cachedData === undefined || (!includeStale && cachedData.isStale)) {
            return this.updateParseData(uri);
        } else {
            return Maybe.ok(cachedData.data);
        }
    }

    // Returns the non-stale cached content for a URI if it exists, or `null` otherwise.
    getCachedDocumentContent(uri: vscodeUri.URI): string | null {
        const cachedData = this.data.get(uri.toString());
        if (cachedData === undefined || cachedData.isStale) {
            return null;
        } else {
            return cachedData.fileContent;
        }
    }
}
