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

interface TokenData {
    value: string | null;
    symbol: string | null;
    example: string | null;
}

const LEXER_TOKEN_NAME_TO_DATA = new Map<string, TokenData>([
    ['endOfFile', { value: 'end-of-file', symbol: null, example: null }],
    ['whitespace', { value: 'whitespace', symbol: null, example: ' ' }],
    ['whitespaceOrNewline', { value: 'whitespace-or-newline', symbol: ' ', example: null }],
    ['optionalWhitespaceAndMandatoryNewline', { value: 'optional-whitespace-and-mandatory-newline', symbol: null, example: '<newline>' }],
    ['comment', { value: 'comment', symbol: null, example: '// My informative comment' }],
    ['scopeOrArrayStart', { value: 'scope-or-Array-start', symbol: '{', example: null }],
    ['scopeOrArrayEnd', { value: 'scope-or-Array-end', symbol: '}', example: null }],
    ['integer', { value: 'Integer' , symbol: null, example: '123' }],
    ['singleQuotedStringStart', { value: 'single-quoted-String-start', symbol: "'", example: null }],
    ['singleQuotedStringEnd', { value: 'single-quoted-String-end', symbol: "'", example: null }],
    ['doubleQuotedStringStart', { value: 'double-quoted-String-start', symbol: '"', example: null }],
    ['doubleQuotedStringEnd', { value: 'double-quoted-String-end', symbol: '"', example: null }],
    ['startTemplatedVariable', { value: 'template-variable-start', symbol: '$', example: null }],
    ['endTemplatedVariable', { value: 'template-variable-end', symbol: '$', example: null }],
    ['stringLiteral', { value: 'String-literal' , symbol: 'abc', example: null }],
    ['variableReferenceCurrentScope', { value: 'variable-reference', symbol: '.', example: null }],
    ['variableReferenceParentScope', { value: 'parent-scope-variable-reference', symbol: '^', example: null }],
    ['variableName', { value: 'variable-name', symbol: null, example: 'MyVarName' }],
    ['operatorEqual', { value: 'operator-equal', symbol: '==', example: null }],
    ['operatorNotEqual', { value: 'operator-not-equal', symbol: '!=', example: null }],
    ['operatorLessOrEqual', { value: 'operator-less-or-equal', symbol: '<=', example: null }],
    ['operatorLess', { value: 'operator-less', symbol: '<', example: null }],
    ['operatorGreaterOrEqual', { value: 'operator-greater-or-equal', symbol: '>=', example: null }],
    ['operatorGreater', { value: 'operator-greater', symbol: '>', example: null }],
    ['operatorNot', { value: 'operator-not', symbol: '!', example: null }],
    ['operatorAnd', { value: 'operator-and', symbol: '&&', example: null }],
    ['operatorOr', { value: 'operator-or', symbol: '||', example: null }],
    ['operatorAssignment', { value: 'assignment', symbol: '=', example: null }],
    ['operatorAddition', { value: 'addition', symbol: '+', example: null }],
    ['operatorSubtraction', { value: 'subtraction', symbol: '-', example: null }],
    ['arrayItemSeparator', { value: 'Array-item-separator', symbol: ',', example: null }],
    ['structStart', { value: 'Struct-start', symbol: '[', example: null }],
    ['structEnd', { value: 'Struct-end', symbol: ']', example: null }],
    ['functionParametersStart', { value: 'function-parameters-start', symbol: '(', example: null }],
    ['functionParametersEnd', { value: 'function-parameters-end', symbol: ')', example: null }],
    ['keywordTrue', { value: 'true-literal', symbol: 'true', example: null }],
    ['keywordFalse', { value: 'false-literal', symbol: 'false', example: null }],
    ['keywordIn', { value: 'keyword-in', symbol: 'in', example: null }],
    ['keywordNot', { value: 'keyword-not', symbol: 'not', example: null }],
    ['keywordAlias', { value: 'function-Alias', symbol: 'Alias', example: null }],
    ['keywordCompiler', { value: 'function-Compiler', symbol: 'Compiler', example: null }],
    ['keywordCopyDir', { value: 'function-CopyDir', symbol: 'CopyDir', example: null }],
    ['keywordCopy', { value: 'function-Copy', symbol: 'Copy', example: null }],
    ['keywordCSAssembly', { value: 'function-CSAssembly', symbol: 'CSAssembly', example: null }],
    ['keywordDLL', { value: 'function-DLL', symbol: 'DLL', example: null }],
    ['keywordError', { value: 'function-Error', symbol: 'Error', example: null }],
    ['keywordExecutable', { value: 'function-Executable', symbol: 'Executable', example: null }],
    ['keywordExec', { value: 'function-keywordExec', symbol: 'keywordExec', example: null }],
    ['keywordForEach', { value: 'function-ForEach', symbol: 'ForEach', example: null }],
    ['keywordIf', { value: 'function-If', symbol: 'If', example: null }],
    ['keywordLibrary', { value: 'function-Library', symbol: 'Library', example: null }],
    ['keywordListDependencies', { value: 'function-ListDependencies', symbol: 'ListDependencies', example: null }],
    ['keywordObjectList', { value: 'function-ObjectList', symbol: 'ObjectList', example: null }],
    ['keywordPrint', { value: 'function-Print', symbol: 'Print', example: null }],
    ['keywordRemoveDir', { value: 'function-RemoveDir', symbol: 'RemoveDir', example: null }],
    ['keywordSettings', { value: 'function-Settings', symbol: 'Settings', example: null }],
    ['keywordTest', { value: 'function-Test', symbol: 'Test', example: null }],
    ['keywordTextFile', { value: 'function-TextFile', symbol: 'TextFile', example: null }],
    ['keywordUnity', { value: 'function-Unity', symbol: 'Unity', example: null }],
    ['keywordUserFunctionDeclaration', { value: 'function-UserFunctionDeclaration', symbol: 'UserFunctionDeclaration', example: null }],
    ['keywordUsing', { value: 'function-Using', symbol: 'Using', example: null }],
    ['keywordVCXProject', { value: 'function-VCXProject', symbol: 'VCXProject', example: null }],
    ['keywordVSProjectExternal', { value: 'function-VSProjectExternal', symbol: 'VSProjectExternal', example: null }],
    ['keywordVSSolution', { value: 'function-VSSolution', symbol: 'VSSolution', example: null }],
    ['keywordXCodeProject', { value: 'function-XCodeProject', symbol: 'XCodeProject', example: null }],
    ['directiveInclude', { value: 'directive-include', symbol: '#include', example: null }],
    ['directiveOnce', { value: 'directive-once', symbol: '#once', example: null }],
    ['directiveIf', { value: 'directive-if', symbol: '#if', example: null }],
    ['directiveElse', { value: 'directive-else', symbol: '#else', example: null }],
    ['directiveEndIf', { value: 'directive-endif', symbol: '#endif', example: null }],
    ['directiveDefine', { value: 'directive-define', symbol: '#define', example: null }],
    ['directiveUndefine', { value: 'directive-undef', symbol: '#undef', example: null }],
    ['directiveImport', { value: 'directive-import', symbol: '#import', example: null }],
    ['parametersStart', { value: 'parameters-start', symbol: '(', example: null }],
    ['parametersEnd', { value: 'parameters-end', symbol: ')', example: null }],
    ['functionName', { value: 'function-name', symbol: null, example: 'MyFunctionName' }],
]);

function getTokenData(token: string): TokenData {
    const data = LEXER_TOKEN_NAME_TO_DATA.get(token);
    if (data === undefined) {
        throw new Error(`Token "${token}" is missing data`);
    }
    return data;
}

function getExpectedTokenMessage(token: string) {
    const data = getTokenData(token);
    return data.value
        + (data.symbol ? `: "${data.symbol}"`: '')
        + (data.example ? ` (example: "${data.example}")` : '');
}

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

export function createPosition(line: number, character: number): SourcePosition {
    return {
        line,
        character
    };
}

export function createRange(startLine: number, startCharacter: number, endLine: number, endCharacter: number): ParseSourceRange {
    return {
        start: createPosition(startLine, startCharacter),
        end: createPosition(endLine, endCharacter)
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
    enableDiagnostics: boolean;
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

        let errorReason: string = match[3];
        if (errorReason === 'Unexpected input (lexer error).') {
            errorReason = 'Unexpected input.';
        } else {
            const errorReasonMatch = errorReason.match(/Unexpected ([^ ]+) token(.*)/);
            if (errorReasonMatch !== null) {
                const token = errorReasonMatch[1];
                const rest = errorReasonMatch[2];
                const tokenData = getTokenData(token);
                errorReason = `Unexpected ${tokenData.value}${rest}`;
            }
        }
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
            + `Expecting to see ${sortedFilteredExpectedTokens.length > 1 ? 'one of ' : ''}the following:\n`
            + sortedFilteredExpectedTokens.map(token => ` • ${getExpectedTokenMessage(token)}`).join('\n');

        return new ParseSyntaxError(parseErrorMessage, range);
    } else {
        // We were unable to parse the location from the error, so use the whole document as the error range.
        return new ParseError(`Failed to parse error location from ParseError: ${nearlyParseError.message}`, createWholeDocumentRange());
    }
}

// Parse the input and return the statements.
export function parse(input: string, options: ParseOptions): ParseData {
    // Pre-process the input:
    //  * Remove comments.
    //  * Add a newline in order to make parsing easier.
    //    This lets the grammar assume that statements always end in a newline.
    //  * Add an end-of-file token at the end. This is to make it fail with a ParseSyntaxError instead
    //    of a ParseNumParsesError ("Should parse to exactly 1 result, but parsed to 0") when
    //    the input matches part but not all of a statement, so that we can give more a more
    //    useful error message.
    // This code can be refactored to use replaceAll once on Node version 15+.
    const modifiedInput = removeComments(input) + '\n<end-of-file>';

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

// TODO: make this more efficient by moving it into the grammar.
function removeComments(input: string): string {
    const lines = input.split('\n');
    const modifiedLines: string[] = [];
    for (const line of lines) {
        let inSingleQuotedString = false;
        let inDoubleQuotedString = false;
        let lineWithCommentRemoved = line;

        for (let i = 0, lastNonSpaceIndex = -1; i < line.length; ++i) {
            const char = line[i];

            if (char === "'" && !inDoubleQuotedString) {
                inSingleQuotedString = !inSingleQuotedString;
            } else if (char === '"' && !inSingleQuotedString) {
                inDoubleQuotedString = !inDoubleQuotedString;
            } else if (!inSingleQuotedString
                    && !inDoubleQuotedString
                    && ((char === ';')
                        || ((char === '/') && (i + 1 < line.length) && (line[i + 1] === '/'))))
            {
                // Comment. Strip the rest of the line.
                lineWithCommentRemoved = line.substring(0, lastNonSpaceIndex + 1);
                break;
            }

            if (char !== ' ') {
                lastNonSpaceIndex = i;
            }
        }
        modifiedLines.push(lineWithCommentRemoved);
    }
    return modifiedLines.join('\n');
}