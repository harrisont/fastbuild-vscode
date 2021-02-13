import * as nearley from 'nearley';
import fbuildGrammar from './fbuild-grammar';
import { UriStr } from './parseDataProvider';

// Certain tokens are optional, so they should not be listed as expected.
const IGNORED_EXPECTED_TOKENS = new Set<string>([
    'optionalWhitespaceOrNewline',
    'comment',
    'optionalComment',
    'startTemplatedVariable'
]);

const LEXER_TOKEN_NAME_TO_VALUE = new Map<string, string>([
    ['whitespace', ' '],
    ['whitespaceOrNewline', ' '],
    ['optionalWhitespaceAndMandatoryNewline', '\\n'],
    ['comment', '// My informative comment'],
    ['scopeOrArrayStart', '{'],
    ['scopeOrArrayEnd', '}'],
    ['integer', '123'],
    ['singleQuotedStringStart', "'"],
    ['singleQuotedStringEnd', "'"],
    ['doubleQuotedStringStart', '"'],
    ['doubleQuotedStringEnd', '"'],
    ['startTemplatedVariable', '$'],
    ['endTemplatedVariable', '$'],
    ['stringLiteral', 'abc'],
    ['variableReferenceCurrentScope', '.'],
    ['variableReferenceParentScope', '^'],
    ['variableName', 'MyVarName'],
    ['operatorEqual', '=='],
    ['operatorNotEqual', '!='],
    ['operatorLessOrEqual', '<='],
    ['operatorLess', '<'],
    ['operatorGreaterOrEqual', '>='],
    ['operatorGreater', '>'],
    ['operatorNot', '!'],
    ['operatorAssignment', '='],
    ['operatorAddition', '+'],
    ['operatorSubtraction', '-'],
    ['arrayItemSeparator', ','],
    ['structStart', '['],
    ['structEnd', ']'],
    ['functionParametersStart', '('],
    ['functionParametersEnd', ')'],
    ['keywordTrue', 'true'],
    ['keywordFalse', 'false'],
    ['keywordIn', 'in'],
    ['keywordNot', 'not'],
    ['keywordAlias', 'Alias'],
    ['keywordCompiler', 'Compiler'],
    ['keywordCopyDir', 'CopyDir'],
    ['keywordCopy', 'Copy'],
    ['keywordCSAssembly', 'CSAssembly'],
    ['keywordDLL', 'DLL'],
    ['keywordError', 'Error'],
    ['keywordExecutable', 'Executable'],
    ['keywordExec', 'Exec'],
    ['keywordForEach', 'ForEach'],
    ['keywordIf', 'If'],
    ['keywordLibrary', 'Library'],
    ['keywordObjectList', 'ObjectList'],
    ['keywordPrint', 'Print'],
    ['keywordRemoveDir', 'RemoveDir'],
    ['keywordSettings', 'Settings'],
    ['keywordTest', 'Test'],
    ['keywordTextFile', 'TextFile'],
    ['keywordUnity', 'Unity'],
    ['keywordUsing', 'Using'],
    ['keywordVCXProject', 'VCXProject'],
    ['keywordVSProjectExternal', 'VSProjectExternal'],
    ['keywordVSSolution', 'VSSolution'],
    ['keywordXCodeProject', 'XCodeProject'],
    ['directiveInclude', '#include'],
    ['directiveOnce', '#once'],
    ['directiveIf', '#if'],
    ['directiveElse', '#else'],
    ['directiveEndIf', '#endif'],
    ['directiveDefine', '#define'],
    ['directiveUndefine', '#undef'],
    ['directiveImport', '#import'],
    ['operatorNot', '!'],
    ['operatorAnd', '&&'],
    ['operatorOr', '||'],
    ['parametersStart', '('],
    ['parametersEnd', ')'],
]);

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

export function createRange(startLine: number, startCharacter: number, endLine: number, endCharacter: number): ParseSourceRange {
    return {
        start: {
            line: startLine,
            character: startCharacter
        },
        end: {
            line: endLine,
            character: endCharacter
        }
    };
}

function createWholeDocumentRange(): ParseSourceRange {
    return createRange(0, 0, Number.MAX_VALUE, Number.MAX_VALUE);
}

export type Statement = Record<string, any>;

export class ParseError extends Error {
    fileUri: UriStr = '';

    constructor(readonly message: string, readonly range: ParseSourceRange) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = ParseError.name;
    }

    setFile(uri: UriStr): void {
        this.fileUri = uri;
    }
}

export class ParseSyntaxError extends ParseError {
    constructor(message: string, readonly range: ParseSourceRange) {
        super(message, range);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = ParseSyntaxError.name;
    }
}

export class ParseNumParsesError extends ParseError {
    constructor(message: string) {
        // We don't know the location that causes the wrong number of parses, so use the whole document as the error range.
        super(message, createWholeDocumentRange());
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

function createParseErrorFromNearlyParseError(nearlyParseError: Error): ParseError {
    // Example error message:
    //
    //     Syntax error at line 6 col 7:
    //     
    //       Print()
    //             ^
    //     Unexpected functionParametersEnd token: ")". Instead, I was expecting to see one of the following:
    //     ...
    const match = nearlyParseError.message.match(/(?:(?:invalid syntax)|(?:Syntax error)) at line (\d+) col (\d+):\n\n.+\n.+\n(.+) Instead, I was expecting to see one of the following:\n((?:.|\n)+)/);
    if (match !== null) {
        // Subtract 1 from the postition because VS Code positions are 0-based, but Nearly is 1-based.
        const line = parseInt(match[1]) - 1;
        const character = parseInt(match[2]) - 1;
        const range: ParseSourceRange = {
            start: {line, character },
            end: {
                line,
                character: character + 1
            }
        };
    
        const errorReason: string = match[3];
        const expected: string = match[4];
        const expectedTokens = new Set<string>();
        // Until string.prototype.matchAll is available, use string.prototype.replace.
        expected.replace(
            /A (.+) token based on:(\n {4}.+)+/g,
            function(matchedStr: string, expectedToken: string) {
                expectedTokens.add(expectedToken);
                return '';
            }
        );
        const filteredExpectedTokens = [...expectedTokens.values()].filter(token => !IGNORED_EXPECTED_TOKENS.has(token));
        const sortedFilteredExpectedTokens = filteredExpectedTokens.sort();
        const parseErrorMessage = `Syntax error: ${errorReason}\n`
            + 'Instead, I was expecting to see one of the following:\n'
            + sortedFilteredExpectedTokens.map(token => ` • ${token} ("${LEXER_TOKEN_NAME_TO_VALUE.get(token)}")`).join('\n');

        return new ParseSyntaxError(parseErrorMessage, range);
    } else {
        // We were unable to parse the location from the error, so use the whole document as the error range.
        return new ParseError(`Failed to parse error location from ParseError: ${nearlyParseError.message}`, createWholeDocumentRange());
    }
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
    } catch (nearlyParseError) {
        if (options.enableDiagnostics) {
            console.log(getParseTable(parser));
        }
        throw createParseErrorFromNearlyParseError(nearlyParseError);
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