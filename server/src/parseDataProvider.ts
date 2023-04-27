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
        try {
            const parseData = parse(content, uri.toString(), this.parseOptions);
            this.data.set(uri.toString(), {
                data: parseData,
                fileContent: content,
            });
            return Maybe.ok(parseData);
        } catch (error) {
            if (error instanceof Error) {
                return Maybe.error(error);
            } else {
                // We should only throw `Error` instances, but handle other types as a fallback.
                // `error` could be anything. Try to get a useful message out of it.
                const typedError = new Error(String(error));
                return Maybe.error(typedError);
            }
        }
    }

    // The same as `updateParseDataWithContent`, but skips re-parsing if the content is the same
    // as the cached content.
    updateParseDataWithContentIfChanged(uri: vscodeUri.URI, content: string): Maybe<ParseData>  {
        const cachedData = this.data.get(uri.toString());
        if (cachedData !== undefined && content === cachedData.fileContent) {
            return Maybe.ok(cachedData.data);
        } else {
            return this.updateParseDataWithContent(uri, content);
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
            return Maybe.ok(cachedData.data);
        }
    }
}
