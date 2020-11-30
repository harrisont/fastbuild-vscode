import * as nearley from 'nearley';
import fbuildGrammar from './fbuild-grammar';

export interface SourcePosition {
    line: number;
    character: number;
}

export interface SourceRange {
    start: SourcePosition;
    end: SourcePosition;
}

export function isPositionInRange(position: SourcePosition, range: SourceRange): boolean {
    return position.line >= range.start.line
        && position.line <= range.end.line
        && position.character >= range.start.character
        && position.character <= range.end.character;
}

export type Statement = Record<string, any>;

export class ParseError extends Error {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = ParseError.name;
    }
}

// Parse the input and return the statements.
export function parse(input: string): Statement[] {
    // Make the input always end in a newline in order to make parsing easier.
    // This lets the grammar assume that statements always end in a newline.
    const modifiedInput = input + '\n';

    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
    parser.feed(modifiedInput);

    const numResults = parser.results.length;
    if (numResults != 1) {
        throw new ParseError(`Should parse to exactly 1 result, but parsed to ${numResults}`);
    }
    const statements = parser.results[0];
    return statements;
}