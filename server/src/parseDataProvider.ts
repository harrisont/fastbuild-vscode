import { IFileContentProvider } from './fileContentProvider';

import {
    parse,
    ParseData,
    ParseOptions,
} from './parser';

export type Uri = string;

// Calculates and caches parse data.
export class ParseDataProvider {
    private data = new Map<Uri, ParseData>();

    constructor(private readonly fileContentProvider: IFileContentProvider, private readonly parseOptions: ParseOptions) {
    }
    
    updateParseData(uri: Uri): ParseData {
        const text = this.fileContentProvider.getFileContents(uri);
        const parseData = parse(text, this.parseOptions);
        this.data.set(uri, parseData);
        return parseData;
    }

    getParseData(uri: Uri): ParseData {
        const cachedData = this.data.get(uri);
        if (cachedData === undefined) {
            return this.updateParseData(uri);
        } else {
            return cachedData;
        }
    }
}