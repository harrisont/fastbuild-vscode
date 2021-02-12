import * as nearley from 'nearley';
import fbuildGrammar from './fbuild-grammar';
import { UriStr } from './parseDataProvider';

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
    fileUri: UriStr = '';

    constructor(readonly message: string, readonly isNumParsesError=false) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = ParseError.name;
    }

    setFile(uri: UriStr): void {
        this.fileUri = uri;
    }
}

export class ParseSyntaxError extends ParseError {
    constructor(message: string, readonly position: SourcePosition) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = ParseSyntaxError.name;
    }
}

export class ParseNumParsesError extends ParseError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = ParseNumParsesError.name;
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

        // Example error message:
        //
        //     Syntax error at line 6 col 7:
        //     
        //       Print()
        //             ^
        //     Unexpected functionParametersEnd token: ")". Instead, I was expecting to see one of the following:
        //     ...
        const match = error.message.match(/(?:(?:invalid syntax)|(?:Syntax error)) at line (\d+) col (\d+):/);
        if (match !== null) {
            // Subtract 1 from the postition because VS Code positions are 0-based, but Nearly is 1-based.
            const line = parseInt(match[1]) - 1;
            const character = parseInt(match[2]) - 1;
            const position: SourcePosition = { line, character };
            throw new ParseSyntaxError(error.message, position);
        } else {
            // We were unable to parse the location from the error, so use the whole document as the error range.
            throw new ParseError(`Failed to parse error location from ParseError: ${error.message}`);
        }
    }

    const numResults = parser.results.length;
    if (numResults != 1) {
        if (options.enableDiagnostics) {
            console.log(getParseTable(parser));
        }
        throw new ParseNumParsesError(`Should parse to exactly 1 result, but parsed to ${numResults}`);
    }
    const statements = parser.results[0];
    return {
        statements
    };
}