import * as nearley from 'nearley';
import fbuildGrammar from './fbuild-grammar';

export interface SourcePosition {
    line: number;
    character: number;
}

export interface ParseSourceRange {
    start: SourcePosition;
    end: SourcePosition;
}

export function isPositionInRange(position: SourcePosition, range: ParseSourceRange): boolean {
    return position.line >= range.start.line
        && position.line <= range.end.line
        && position.character >= range.start.character
        && position.character <= range.end.character;
}

export type Statement = Record<string, any>;

export class ParseError extends Error {
    private filePath = '';

    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = ParseError.name;
    }

    setFilePath(path: string): void {
        this.filePath = path;
        this.message = `${path}: ${this.message}`;
    }
}

function getParseTable(parser: nearley.Parser) {
    // The `table` property only exists when `keepHistory: true` is passed for the options when creating the Parser.
    const table = (parser as Record<string, any>).table;
    const numParses = parser.results?.length ?? 0;
    let result = '';
    result += `Table length: ${table.length}\n`;
    result += `Number of parses: ${numParses}\n`;
    result += "Parse Charts";
    for (const [columnIndex, column] of table.entries()) {
        result += `\nChart: ${columnIndex + 1}\n`;
        for (const [stateIndex, state] of column.states.entries()) {
            result += `${stateIndex}: ${state}\n`;
        }
    }
    return result;
}

export interface ParseOptions {
    enableDiagnostics: boolean
}

export interface ParseData {
    statements: Statement[];
}

// Parse the input and return the statements.
export function parse(input: string, options: ParseOptions): ParseData {
    // Make the input always end in a newline in order to make parsing easier.
    // This lets the grammar assume that statements always end in a newline.
    const modifiedInput = input + '\n';

    const parser = new nearley.Parser(
        nearley.Grammar.fromCompiled(fbuildGrammar),
        { keepHistory: options.enableDiagnostics }
    );
    
    try {
        parser.feed(modifiedInput);
    } catch (error) {
        if (options.enableDiagnostics) {
            console.log(getParseTable(parser));
        }
        throw new ParseError(error);
    }

    const numResults = parser.results.length;
    if (numResults != 1) {
        if (options.enableDiagnostics) {
            console.log(getParseTable(parser));
        }
        throw new ParseError(`Should parse to exactly 1 result, but parsed to ${numResults}`);
    }
    const statements = parser.results[0];
    return {
        statements
    };
}