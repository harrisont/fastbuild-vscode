@{%
const moo = require('moo');

const lexer = moo.states({
    main: {
        // This needs to come before '<' so that it has higher priority when matching.
        endOfFile: '<end-of-file>',

        optionalWhitespaceAndMandatoryNewline: { match: /[ \t\r\n]*\r?\n[ \t\r\n]*/, lineBreaks: true },
        whitespace: /[ \t]+/,
        // The symbols for array/scope delimeters are the same.
        // We could distinguish them by pushing state when we're on the RHS of an operator (assignment/addition), to know that the symbols are array delimeters.
        // There doesn't seem to be a benefit to doing so though, so for now, use the same symbol for both.
        scopeOrArrayStart: '{',
        scopeOrArrayEnd: '}',
        integer: { match: /0|[1-9][0-9]*/, value: (s: string) => parseInt(s) },
        singleQuotedStringStart: { match: "'", push: 'singleQuotedStringBodyThenPop' },
        doubleQuotedStringStart: { match: '"', push: 'doubleQuotedStringBodyThenPop' },
        variableReferenceCurrentScope: { match: '.', push: 'variableReferenceName' },
        variableReferenceParentScope:  { match: '^', push: 'variableReferenceName' },

        // '==' needs to come before '=' so that it has priority when matching.
        operatorEqual: '==',
        // '!=' needs to come before '!' so that it has priority when matching.
        operatorNotEqual: '!=',
        // '<=' needs to come before '<' so that it has priority when matching.
        operatorLessOrEqual: '<=',
        operatorLess: '<',
        // '>=' needs to come before '>' so that it has priority when matching.
        operatorGreaterOrEqual: '>=',
        operatorGreater: '>',
        operatorNot: '!',
        operatorAnd: '&&',
        operatorOr: '||',

        operatorAssignment: '=',
        operatorAddition: '+',
        operatorSubtraction: '-',

        itemSeparator: ',',
        structStart: '[',
        structEnd: ']',
        functionParametersStart: '(',
        functionParametersEnd: ')',

        keywordTrue: 'true',
        keywordFalse: 'false',

        keywordIn: 'in',
        keywordNot: 'not',

        // Function keywords.

        keywordAlias: 'Alias',
        keywordCompiler: 'Compiler',
        // 'CopyDir' needs to come before 'Copy' so that it has priority when matching.
        keywordCopyDir: 'CopyDir',
        keywordCopy: 'Copy',
        keywordCSAssembly: 'CSAssembly',
        keywordDLL: 'DLL',
        keywordError: 'Error',
        // 'Executable' needs to come before 'Exec' so that it has priority when matching.
        keywordExecutable: 'Executable',
        keywordExec: 'Exec',
        keywordForEach: 'ForEach',
        keywordIf: 'If',
        keywordLibrary: 'Library',
        keywordListDependencies: 'ListDependencies',
        keywordObjectList: 'ObjectList',
        keywordPrint: 'Print',
        keywordRemoveDir: 'RemoveDir',
        keywordSettings: 'Settings',
        keywordTest: 'Test',
        keywordTextFile: 'TextFile',
        keywordUnity: 'Unity',
        keywordUsing: 'Using',
        keywordVCXProject: 'VCXProject',
        keywordVSProjectExternal: 'VSProjectExternal',
        keywordVSSolution: 'VSSolution',
        keywordXCodeProject: 'XCodeProject',

        keywordUserFunctionDeclaration: { match: 'function', push: 'userFunction' },
        functionName: /[a-zA-Z_][a-zA-Z0-9_]*/,

        directiveInclude: '#include',
        directiveOnce: '#once',

        directiveIf: { match: '#if', push: 'directiveIfCondition' },
        directiveElse: '#else',
        directiveEndIf: '#endif',

        directiveDefine: { match: '#define', push: 'directiveDefineSymbol' },
        directiveUndefine: { match: '#undef', push: 'directiveDefineSymbol' },
        directiveImport: { match: '#import', push: 'directiveDefineSymbol' },
    },
    singleQuotedStringBodyThenPop: {
        startTemplatedVariable: { match: '$', push: 'templatedVariable' },
        singleQuotedStringEnd: { match: "'", pop: 1 },
        // Handle escaping ', $, ^ with ^
        stringLiteral: /(?:[^'$^\r\n]|\^['$^])+/,
    },
    doubleQuotedStringBodyThenPop: {
        startTemplatedVariable: { match: '$', push: 'templatedVariable' },
        doubleQuotedStringEnd: { match: '"', pop: 1 },
        // Handle escaping ", $, ^ with ^
        stringLiteral: /(?:[^"$^\r\n]|\^["$^])+/,
    },
    // Same as "...ThenPop" but instead of popping, goes to "main".
    singleQuotedStringBodyThenMain: {
        startTemplatedVariable: { match: '$', push: 'templatedVariable' },
        singleQuotedStringEnd: { match: "'", next: 'main' },
        // Handle escaping ', $, ^ with ^
        stringLiteral: /(?:[^'$^\r\n]|\^['$^])+/,
    },
    doubleQuotedStringBodyThenMain: {
        startTemplatedVariable: { match: '$', push: 'templatedVariable' },
        doubleQuotedStringEnd: { match: '"', next: 'main' },
        // Handle escaping ", $, ^ with ^
        stringLiteral: /(?:[^"$^\r\n]|\^["$^])+/,
    },
    templatedVariable: {
        endTemplatedVariable: { match: '$', pop: 1 },
        variableName: /[a-zA-Z_][a-zA-Z0-9_]*/,
    },
    variableReferenceName: {
        // Literal variable name
        variableName: { match: /[a-zA-Z_][a-zA-Z0-9_]*/, pop: 1 },
        // Dynamic variable name
        singleQuotedStringStart: { match: "'", push: 'singleQuotedStringBodyThenMain' },
        doubleQuotedStringStart: { match: '"', push: 'doubleQuotedStringBodyThenMain' },
    },
    directiveIfCondition: {
        operatorNot: '!',
        operatorAnd: '&&',
        operatorOr: '||',
        variableName: { match: /[a-zA-Z_][a-zA-Z0-9_]*/, type: moo.keywords({
          exists: 'exists',
          fileExists: 'file_exists',
        })},
        optionalWhitespaceAndMandatoryNewline: { match: /[ \t\r\n]*\r?\n[ \t\r\n]*/, lineBreaks: true, pop: 1 },
        whitespace: /[ \t]+/,
        parametersStart: '(',
        parametersEnd: ')',
        singleQuotedStringStart: { match: "'", push: 'singleQuotedStringBodyThenPop' },
        doubleQuotedStringStart: { match: '"', push: 'doubleQuotedStringBodyThenPop' },
    },
    directiveDefineSymbol: {
        whitespace: /[ \t]+/,
        variableName: { match: /[a-zA-Z_][a-zA-Z0-9_]*/, pop: 1 }
    },
    userFunction: {
        functionName: /[a-zA-Z_][a-zA-Z0-9_]*/,
        parametersStart: '(',
        parametersEnd: { match: ')', pop: 1 },
        parameterName: /\.[a-zA-Z_][a-zA-Z0-9_]*/,
        itemSeparator: ',',
        optionalWhitespaceAndMandatoryNewline: { match: /[ \t\r\n]*\r?\n[ \t\r\n]*/, lineBreaks: true },
        whitespace: /[ \t]+/,
    },
});
%}

# Pass your lexer object using the @lexer option:
@lexer lexer

@preprocessor typescript

main -> lines %endOfFile  {% ([lines, endOfFile]) => lines %}

lines ->
    null  {% () => [] %}
  | whitespaceOrNewline lines  {% ([space, lines]) => lines %}
  | statement %optionalWhitespaceAndMandatoryNewline lines  {% ([[firstStatement, firstStatementContext], space, rest]) => { callOnNextToken(firstStatementContext, space); return [firstStatement, ...rest]; } %}

# Like `lines` but has a scope end, which can come before the newline.
linesWithScopeEnd ->
    %scopeOrArrayEnd  {% () => [] %}
  | whitespaceOrNewline linesWithScopeEnd  {% ([space, lines]) => lines %}
  # Statement with scope end.
  | statement             %scopeOrArrayEnd  {% ([[statement, context],        closeBrace]) => { callOnNextToken(context, closeBrace); return [statement]; } %}
  | statement %whitespace %scopeOrArrayEnd  {% ([[statement, context], space, closeBrace]) => { callOnNextToken(context, space    ); return [statement]; } %}
  # Multiple statements.
  | statement %optionalWhitespaceAndMandatoryNewline linesWithScopeEnd  {% ([[firstStatement, firstStatementContext], space, rest]) => { callOnNextToken(firstStatementContext, space); return [firstStatement, ...rest]; } %}

@{%

interface Token {
    line: number;
    col: number;
    value: any;
}

class ParseContext {
    onNextToken: null | ((token:Token) => void) = null;
}

function callOnNextToken(context: ParseContext, token: Token) {
    if (context.onNextToken !== null) {
        context.onNextToken(token);
        context.onNextToken = null;
    }
}

%}

statement ->
    scopedStatements                 {% ([value]) => [ value, new ParseContext() ] %}
  | variableDefinition               {% ([valueWithContext]) => valueWithContext %}
  | variableBinaryOperator           {% ([valueWithContext]) => valueWithContext %}
  | variableBinaryOperatorOnUnnamed  {% ([valueWithContext]) => valueWithContext %}
  | functionError                    {% ([value]) => [ value, new ParseContext() ] %}
  | functionForEach                  {% ([value]) => [ value, new ParseContext() ] %}
  | functionIf                       {% ([value]) => [ value, new ParseContext() ] %}
  | functionPrint                    {% ([value]) => [ value, new ParseContext() ] %}
  | functionSettings                 {% ([value]) => [ value, new ParseContext() ] %}
  | functionUsing                    {% ([value]) => [ value, new ParseContext() ] %}
  | genericFunctionWithAlias         {% ([value]) => [ value, new ParseContext() ] %}
  | userFunctionDeclaration          {% ([value]) => [ value, new ParseContext() ] %}
  | userFunctionCall                 {% ([value]) => [ value, new ParseContext() ] %}
  | directiveInclude                 {% ([value]) => [ value, new ParseContext() ] %}
  | directiveOnce                    {% ([value]) => [ value, new ParseContext() ] %}
  | directiveIf                      {% ([value]) => [ value, new ParseContext() ] %}
  | directiveDefine                  {% ([valueWithContext]) => valueWithContext %}
  | directiveUndefine                {% ([valueWithContext]) => valueWithContext %}
  | directiveImport                  {% ([valueWithContext]) => valueWithContext %}

scopedStatements -> %scopeOrArrayStart linesWithScopeEnd  {% ([braceOpen, statements]) => { return { type: 'scopedStatements', statements }; } %}

@{%

interface SourceLocation {
    line: number;
    character: number;
}

interface SourceRange {
    start: SourceLocation;
    end: SourceLocation;
}

function createLocation(token: Token): SourceLocation {
    return {
        line: token.line - 1,
        character: token.col - 1
    };
}

// Creates a range from tokenStart's location (inclusive) to tokenEnd's location (exclusive).
function createRange(tokenStart: Token, tokenEnd: Token): SourceRange {
    return {
        start: createLocation(tokenStart),
        end: createLocation(tokenEnd)
    };
}

// Creates a range from tokenStart's location (inclusive) to tokenEnd's location (inclusive).
function createRangeEndInclusive(tokenStart: Token, tokenEnd: Token): SourceRange {
    const end = createLocation(tokenEnd);
    end.character += 1;
    return {
        start: createLocation(tokenStart),
        end
    };
}

// Creates a range from tokenStart's location (inclusive) to a to-be-received-later token's location (exclusive).
function createRangeStart(startToken: Token) {
    const range = {
        start: createLocation(startToken),
        // Updated by the onNextToken callback
        end: {
            line: 0,
            character: 0,
        }
    };

    const context = new ParseContext();
    context.onNextToken = (token: Token) => {
        range.end = createLocation(token);
    };

    return [range, context];
}

function createCombinedContext(contexts: ParseContext[]): ParseContext {
    const combinedContext = new ParseContext();
    combinedContext.onNextToken = (token: Token) => {
        for (const context of contexts) {
            callOnNextToken(context, token);
        }
    };
    return combinedContext;
}

function createString(value: string, range: SourceRange) {
    return {
        type: 'string',
        value,
        range,
    };
}

function createStringWithStartRange(nameToken: Token) {
    const [range, context] = createRangeStart(nameToken);

    const result = {
        type: 'string',
        value: nameToken.value,
        range,
    };

    return [result, context];
}

%}

variableName ->
    # Literal name
    %variableName  {% ([nameToken]) => createStringWithStartRange(nameToken) %}
    # Evaluated (dynamic) name
  | string  {% ([value]) => [ value, new ParseContext() ] %}

variableReference ->
    %variableReferenceCurrentScope variableName  {% ([scopeToken, [varName, context]]) => [scopeToken, 'current', varName, context] %}
  | %variableReferenceParentScope  variableName  {% ([scopeToken, [varName, context]]) => [scopeToken, 'parent',  varName, context] %}

lhsWithAssignmentOperator ->
    variableReference                     %operatorAssignment  {% ([[scopeToken, scope, varName, context],        operator]) => { callOnNextToken(context, operator); return { name: varName, scope, range: createRange(scopeToken, operator) }; } %}
  | variableReference whitespaceOrNewline %operatorAssignment  {% ([[scopeToken, scope, varName, context], space, operator]) => { callOnNextToken(context, space   ); return { name: varName, scope, range: createRange(scopeToken, space)    }; } %}

lhsWithBinaryOperator ->
    variableReference                     %operatorAddition       {% ([[scopeToken, scope, varName, context],        operator]) => { callOnNextToken(context, operator); return [ { name: varName, scope, range: createRange(scopeToken, operator) }, '+' ]; } %}
  | variableReference whitespaceOrNewline %operatorAddition       {% ([[scopeToken, scope, varName, context], space, operator]) => { callOnNextToken(context, space   ); return [ { name: varName, scope, range: createRange(scopeToken, space)    }, '+' ]; } %}
  | variableReference                     %operatorSubtraction    {% ([[scopeToken, scope, varName, context],        operator]) => { callOnNextToken(context, operator); return [ { name: varName, scope, range: createRange(scopeToken, operator) }, '-' ]; } %}
  | variableReference whitespaceOrNewline %operatorSubtraction    {% ([[scopeToken, scope, varName, context], space, operator]) => { callOnNextToken(context, space   ); return [ { name: varName, scope, range: createRange(scopeToken, space)    }, '-' ]; } %}

variableDefinition ->
    lhsWithAssignmentOperator optionalWhitespaceOrNewline rValue  {% ([lhs,             space, [rValue, context]]) => { return [ { type: 'variableDefinition', lhs: lhs, rhs: rValue           }, context ]; } %}

variableBinaryOperator ->
    lhsWithBinaryOperator     optionalWhitespaceOrNewline rValue  {% ([[lhs, operator], space, [rValue, context]]) => { return [ { type: 'binaryOperator',     lhs: lhs, rhs: rValue, operator }, context ]; } %}

variableBinaryOperatorOnUnnamed ->
    %operatorAddition         optionalWhitespaceOrNewline rValue  {% ([      operator,  space, [rValue, context]]) => { return [ { type: 'binaryOperatorOnUnnamed', rhs: rValue, operator: '+', rangeStart: createLocation(operator) }, context ]; } %}
  | %operatorSubtraction      optionalWhitespaceOrNewline rValue  {% ([      operator,  space, [rValue, context]]) => { return [ { type: 'binaryOperatorOnUnnamed', rhs: rValue, operator: '-', rangeStart: createLocation(operator) }, context ]; } %}

@{%

function createInteger(token: Token) {
    const [range, context] = createRangeStart(token);

    const result = {
        type: 'integer',
        value: token.value,
        range,
    };

    return [result, context];
}

function createBoolean(value: boolean, token: Token) {
    const [range, context] = createRangeStart(token);

    const result = {
        type: 'boolean',
        value,
        range,
    };

    return [result, context];
}

%}

bool ->
    # true
    %keywordTrue                                  {% ([token]) => createBoolean(true,  token) %}
    # false
  | %keywordFalse                                 {% ([token]) => createBoolean(false, token) %}
    # !true
  | %operatorNot optionalWhitespace %keywordTrue   {% ([token]) => createBoolean(false, token) %}
    # !false
  | %operatorNot optionalWhitespace %keywordFalse  {% ([token]) => createBoolean(true,  token) %}

integer ->
    %integer  {% ([token]) => createInteger(token) %}

# A single item or multiple items added/subtracted together.
rValue -> sumHelper  {% ([[first, rest, context]]) => {
    if (rest.length == 0) {
        return [first, context];
    } else {
        const sum = {
            type: 'sum',
            first,
            summands: rest,
        };
        return [sum, context];
    }
} %}

# Returns [first, rest, context], where rest is {operator, value}[]
sumHelper ->
    # Single item
    summand  {% ([[value, context]]) => [value, [], context] %}
    # Multiple items added together
    # A newline can occur after the operator, but not before, since a newline before the operator
    # is the same as the `variableBinaryOperatorOnUnnamed` statement.
  | summand             %operatorAddition    optionalWhitespaceOrNewline sumHelper  {% ([[first, firstContext],         operator, space2, [restFirst, restRest, restContext]]) => { callOnNextToken(firstContext, operator); return [first, [{operator: '+', value: restFirst}, ...restRest], restContext]; } %}
  | summand             %operatorSubtraction optionalWhitespaceOrNewline sumHelper  {% ([[first, firstContext],         operator, space2, [restFirst, restRest, restContext]]) => { callOnNextToken(firstContext, operator); return [first, [{operator: '-', value: restFirst}, ...restRest], restContext]; } %}
  | summand %whitespace %operatorAddition    optionalWhitespaceOrNewline sumHelper  {% ([[first, firstContext], space1, operator, space2, [restFirst, restRest, restContext]]) => { callOnNextToken(firstContext, space1);   return [first, [{operator: '+', value: restFirst}, ...restRest], restContext]; } %}
  | summand %whitespace %operatorSubtraction optionalWhitespaceOrNewline sumHelper  {% ([[first, firstContext], space1, operator, space2, [restFirst, restRest, restContext]]) => { callOnNextToken(firstContext, space1);   return [first, [{operator: '-', value: restFirst}, ...restRest], restContext]; } %}

summand ->
    integer            {% ([valueWithContext]) => valueWithContext %}
  | string             {% ([value]) => [ value, new ParseContext() ] %}
  | evaluatedVariable  {% ([valueWithContext]) => valueWithContext %}
  | array              {% ([valueWithContext]) => valueWithContext %}
  # bool and struct are valid as single items, but not for addition/subtraction.
  # Allow them anyways for addition/subtraction here and fail in evaluation instead, in order to give better error messages.
  | bool      {% ([valueWithContext]) => valueWithContext %}
  | struct    {% ([valueWithContext]) => valueWithContext %}

@{%

function unescapeString(escapedString: string): string {
    return escapedString.replace(/\^(.)/g, '$1');
}

function createStringOrStringExpression(parts: any[], startToken: Token, endToken: Token) {
    const range = createRangeEndInclusive(startToken, endToken);
    if (parts.length == 0) {
        return createString('', range);
    } else if (parts.length == 1 && typeof parts[0] === 'string') {
        return createString(parts[0], range);
    } else {
        return {
            type: 'stringExpression',
            parts,
            range,
        };
    }
}

%}

stringLiteral ->
    %singleQuotedStringStart %stringLiteral %singleQuotedStringEnd  {% ([quoteStart, content, quoteEnd]) => createString(unescapeString(content.value), createRangeEndInclusive(quoteStart, quoteEnd)) %}
  | %doubleQuotedStringStart %stringLiteral %doubleQuotedStringEnd  {% ([quoteStart, content, quoteEnd]) => createString(unescapeString(content.value), createRangeEndInclusive(quoteStart, quoteEnd)) %}

string ->
    %singleQuotedStringStart stringContents %singleQuotedStringEnd  {% ([quoteStart, content, quoteEnd]) => createStringOrStringExpression(content, quoteStart, quoteEnd) %}
  | %doubleQuotedStringStart stringContents %doubleQuotedStringEnd  {% ([quoteStart, content, quoteEnd]) => createStringOrStringExpression(content, quoteStart, quoteEnd) %}

# Generates an array of either string or evaluatedVariables: (string | evaluatedVariable)[]
stringContents ->
    null  {% () => [] %}
    # String literal
  | %stringLiteral stringContents  {% ([literal, rest]) => {
        // Handle escaped characters.
        const unescapedValue = unescapeString(literal.value);

        if (rest.length > 0) {
            return [unescapedValue, ...rest];
        } else {
            return [unescapedValue];
        }
    } %}
    # Templated string
  | %startTemplatedVariable %variableName %endTemplatedVariable stringContents  {% ([startVarIndicator, varName, endVarIndicator, rest]) => {
        const varNameWithContext = createStringWithStartRange(varName);
        const varNameValue = varNameWithContext[0] as Record<string, any>;
        const varNameContext = varNameWithContext[1] as ParseContext;
        callOnNextToken(varNameContext, endVarIndicator);
        const evaluatedVariable = {
            type: 'evaluatedVariable',
            scope: 'current',
            name: varNameValue,
            range: createRangeEndInclusive(startVarIndicator, endVarIndicator),
        };
        if (rest.length > 0) {
            return [evaluatedVariable, ...rest];
        } else {
            return [evaluatedVariable];
        }
    } %}

@{%

function createEvaluatedVariable(varName: any, startToken: Token, scope: ("current" | "parent"), existingContext: ParseContext) {
    const evaluatedVariable = {
        type: 'evaluatedVariable',
        scope: scope,
        name: varName,
        range: {
            start: createLocation(startToken),
            // Updated by the onNextToken callback
            end: {
                line: 0,
                character: 0,
            }
        },
    };

    const context = new ParseContext();
    context.onNextToken = (token: Token) => {
        callOnNextToken(existingContext, token);
        evaluatedVariable.range.end = createLocation(token);
    };

    return [evaluatedVariable, context];
}

%}

evaluatedVariable -> variableReference  {% ([[scopeToken, scope, varName, context]]) => createEvaluatedVariable(varName, scopeToken, scope, context) %}

array -> %scopeOrArrayStart arrayContents %scopeOrArrayEnd  {% ([braceOpen, [value, context], braceClose]) => { callOnNextToken(context, braceClose); return [ { type: 'array', value, range: createRangeEndInclusive(braceOpen, braceClose) }, context]; } %}

arrayContents ->
    # Empty
    null                 {% () => [[], new ParseContext()] %}
  | whitespaceOrNewline  {% () => [[], new ParseContext()] %}
    # Not empty
  | nonEmptyArrayContents  {% ([contentsWithContext]) => contentsWithContext %}

nonEmptyArrayContents ->
    # Single item. Optional trailing item separator (",").
    optionalWhitespaceOrNewline rValue                                                                 {% ([space1, [content, context]                           ]) => {                                      return [[content], context]; } %}
  | optionalWhitespaceOrNewline rValue whitespaceOrNewline                                             {% ([space1, [content, context], space2                   ]) => { callOnNextToken(context, space2);    return [[content], context]; } %}
  | optionalWhitespaceOrNewline rValue                     %itemSeparator optionalWhitespaceOrNewline  {% ([space1, [content, context],         separator, space3]) => { callOnNextToken(context, separator); return [[content], context]; } %}
  | optionalWhitespaceOrNewline rValue whitespaceOrNewline %itemSeparator optionalWhitespaceOrNewline  {% ([space1, [content, context], space2, separator, space3]) => { callOnNextToken(context, space2);    return [[content], context]; } %}
    # Item and then another item(s). The items must be separated by a newline and/or an item separator (",").
  | optionalWhitespaceOrNewline rValue %optionalWhitespaceAndMandatoryNewline                nonEmptyArrayContents  {% ([space1, [first, firstContext], space2,            [rest, restContext]]) => { callOnNextToken(firstContext, space2);    return [[first, ...rest], restContext]; } %}
  | optionalWhitespaceOrNewline rValue                                        %itemSeparator nonEmptyArrayContents  {% ([space1, [first, firstContext],         separator, [rest, restContext]]) => { callOnNextToken(firstContext, separator); return [[first, ...rest], restContext]; } %}
  | optionalWhitespaceOrNewline rValue whitespaceOrNewline                    %itemSeparator nonEmptyArrayContents  {% ([space1, [first, firstContext], space2, separator, [rest, restContext]]) => { callOnNextToken(firstContext, space2);    return [[first, ...rest], restContext]; } %}

struct -> %structStart structContents %structEnd  {% ([braceOpen, [statements, context], braceClose]) => {
    callOnNextToken(context, braceClose);
    return [
        { type: 'struct', statements, range: createRangeEndInclusive(braceOpen, braceClose) },
        context
    ];
} %}

structContents ->
    # Empty
    null                      {% () => [ [], new ParseContext() ] %}
  | whitespaceOrNewline       {% () => [ [], new ParseContext() ] %}
  | nonEmptyStructStatements  {% ([statementsWithContext]) => statementsWithContext %}

nonEmptyStructStatements ->
    # Single item.
    optionalWhitespaceOrNewline statement                      {% ([space1, [statement, context]        ]) => {                                   return [[statement], context]; } %}
  | optionalWhitespaceOrNewline statement whitespaceOrNewline  {% ([space1, [statement, context], space2]) => { callOnNextToken(context, space2); return [[statement], context]; } %}
    # Item and then another item(s), separated by a newline.
  | optionalWhitespaceOrNewline statement %optionalWhitespaceAndMandatoryNewline nonEmptyStructStatements  {% ([space1, [firstStatement, firstContext], space2, [restStatements, restContext]]) => { callOnNextToken(firstContext, space2); return [[firstStatement, ...restStatements], restContext]; } %}

@{%

function createUsing(struct: object, statementStartToken: Token, statementEndToken: Token) {
    return {
        type: 'using',
        struct,
        range: createRangeEndInclusive(statementStartToken, statementEndToken)
    };
}

%}

functionUsing ->
    %keywordUsing optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline evaluatedVariable                     %functionParametersEnd  {% ([functionName, space1, braceOpen, space2, [evaluatedVariable, context],         braceClose]) => { callOnNextToken(context, braceClose); return createUsing(evaluatedVariable, functionName, braceClose); } %}
  | %keywordUsing optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline evaluatedVariable whitespaceOrNewline %functionParametersEnd  {% ([functionName, space1, braceOpen, space2, [evaluatedVariable, context], space3, braceClose]) => { callOnNextToken(context, space3);     return createUsing(evaluatedVariable, functionName, braceClose); } %}

@{%

function createForEach(loopVar: object, arrayToLoopOver: object, statements: Record<string, any>, statementStartToken: Token, statementEndToken: Token) {
    return {
        type: 'forEach',
        loopVar,
        arrayToLoopOver,
        range: createRangeEndInclusive(statementStartToken, statementEndToken),
        statements
    };
}

%}

functionForEach ->
    %keywordForEach optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline forEachLoopVar optionalWhitespaceOrNewline evaluatedVariable                     %functionParametersEnd functionBody  {% ([functionName, space1, braceOpen, space2, forEachLoopVar, space3, [evaluatedVariable, context],         braceClose, statements]) => { callOnNextToken(context, braceClose); return createForEach(forEachLoopVar, evaluatedVariable, statements, functionName, braceClose); } %}
  | %keywordForEach optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline forEachLoopVar optionalWhitespaceOrNewline evaluatedVariable whitespaceOrNewline %functionParametersEnd functionBody  {% ([functionName, space1, braceOpen, space2, forEachLoopVar, space3, [evaluatedVariable, context], space4, braceClose, statements]) => { callOnNextToken(context, space4);     return createForEach(forEachLoopVar, evaluatedVariable, statements, functionName, braceClose); } %}

forEachLoopVar ->
    %variableReferenceCurrentScope variableName                     %keywordIn  {% ([scope, [varName, varNameContext],        keywordIn]) => { return { name: varName, range: createRange(scope, keywordIn) }; } %}
  | %variableReferenceCurrentScope variableName whitespaceOrNewline %keywordIn  {% ([scope, [varName, varNameContext], space, keywordIn]) => { return { name: varName, range: createRange(scope, space)     }; } %}

functionBody ->
    optionalWhitespaceOrNewline %scopeOrArrayStart linesWithScopeEnd  {% ([space, braceOpen, statements]) => statements %}

@{%

function createGenericFunction(alias: any, statements: Record<string, any>, statementStartToken: Token, statementEndToken: Token) {
    return {
        type: 'genericFunction',
        alias,
        range: createRangeEndInclusive(statementStartToken, statementEndToken),
        statements
    };
}

%}

# Functions that we don't care about handling except for the function's alias parameter.
genericFunctionWithAlias ->
    genericFunctionNameWithAlias optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline alias                     %functionParametersEnd functionBody  {% ([functionName, space1, braceOpen, space2, [alias, context],         braceClose, statements]) => { callOnNextToken(context, braceClose); return createGenericFunction(alias, statements, functionName, braceClose); } %}
  | genericFunctionNameWithAlias optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline alias whitespaceOrNewline %functionParametersEnd functionBody  {% ([functionName, space1, braceOpen, space2, [alias, context], space3, braceClose, statements]) => { callOnNextToken(context, space3);     return createGenericFunction(alias, statements, functionName, braceClose); } %}

# Function names of functions that we don't care about handling except for the function's alias parameter.
genericFunctionNameWithAlias ->
    %keywordAlias              {% id %}
  | %keywordCompiler           {% id %}
  | %keywordCopy               {% id %}
  | %keywordCopyDir            {% id %}
  | %keywordCSAssembly         {% id %}
  | %keywordDLL                {% id %}
  | %keywordExec               {% id %}
  | %keywordExecutable         {% id %}
  | %keywordLibrary            {% id %}
  | %keywordListDependencies   {% id %}
  | %keywordObjectList         {% id %}
  | %keywordRemoveDir          {% id %}
  | %keywordTest               {% id %}
  | %keywordTextFile           {% id %}
  | %keywordUnity              {% id %}
  | %keywordVCXProject         {% id %}
  | %keywordVSProjectExternal  {% id %}
  | %keywordVSSolution         {% id %}
  | %keywordXCodeProject       {% id %}

alias ->
    string             {% ([value]) => [ value, new ParseContext() ] %}
  | evaluatedVariable  {% ([valueWithContext]) => valueWithContext %}

@{%

function createUserFunctionDeclaration(nameToken: Token, tokenAfterName: Token, parameters: Record<string, any>[], statements: Record<string, any>) {
    return {
        type: 'userFunctionDeclaration',
        name: nameToken.value,
        nameRange: createRange(nameToken, tokenAfterName),
        parameters,
        statements,
    };
}

function createUserFunctionDeclarationParameter(nameToken: Token, tokenAfterName: Token) {
    // Strip the leading "." since it's not part of the name.
    const name = nameToken.value.substring(1);

    return {
        type: 'userFunctionDeclarationParameter',
        name,
        range: createRange(nameToken, tokenAfterName),
    };
}

function createUserFunctionDeclarationParameterWithStartRange(nameToken: Token) {
    const [range, context] = createRangeStart(nameToken);

    // Strip the leading "." since it's not part of the name.
    const name = nameToken.value.substring(1);

    const result = {
        type: 'userFunctionDeclarationParameter',
        name,
        range,
    };

    return [result, context];
}

function createUserFunctionCall(nameToken: Token, tokenAfterName: Token, closeBraceToken: Token, parameters: Record<string, any>[]) {
    return {
        type: 'userFunctionCall',
        range: createRangeEndInclusive(nameToken, closeBraceToken),
        name: nameToken.value,
        nameRange: createRange(nameToken, tokenAfterName),
        parameters,
    };
}

function createUserFunctionCallParameter(value: Record<string, any>) {
    return {
        type: 'userFunctionCallParameter',
        value,
        range: value.range,
    };
}

%}

# User functions
userFunctionDeclaration ->
    %keywordUserFunctionDeclaration whitespaceOrNewline %functionName                     %parametersStart userFunctionDeclarationParams %parametersEnd functionBody {% ([functionKeyword, space1, functionName,         braceOpen, [parameters, context], braceClose, statements]) => { callOnNextToken(context, braceClose); return createUserFunctionDeclaration(functionName, braceOpen, parameters, statements); } %}
  | %keywordUserFunctionDeclaration whitespaceOrNewline %functionName whitespaceOrNewline %parametersStart userFunctionDeclarationParams %parametersEnd functionBody {% ([functionKeyword, space1, functionName, space2, braceOpen, [parameters, context], braceClose, statements]) => { callOnNextToken(context, braceClose); return createUserFunctionDeclaration(functionName, space2,    parameters, statements); } %}

userFunctionDeclarationParams ->
    # Empty
    null                 {% () => [[], new ParseContext()] %}
  | whitespaceOrNewline  {% () => [[], new ParseContext()] %}
    # Not empty
  | nonEmptyUserFunctionDeclarationParams  {% ([paramsWithContext]) => paramsWithContext %}
  
nonEmptyUserFunctionDeclarationParams ->
    # Single param. Optional trailing param separator (",").
    optionalWhitespaceOrNewline %parameterName                                                                 {% ([space1, paramName                           ]) => { const [param, context] = createUserFunctionDeclarationParameterWithStartRange(paramName); return [[param], context]; } %}
  | optionalWhitespaceOrNewline %parameterName whitespaceOrNewline                                             {% ([space1, paramName, space2                   ]) => [[createUserFunctionDeclarationParameter(paramName, space2)],    new ParseContext()] %}
  | optionalWhitespaceOrNewline %parameterName                     %itemSeparator optionalWhitespaceOrNewline  {% ([space1, paramName,         separator, space3]) => [[createUserFunctionDeclarationParameter(paramName, separator)], new ParseContext()] %}
  | optionalWhitespaceOrNewline %parameterName whitespaceOrNewline %itemSeparator optionalWhitespaceOrNewline  {% ([space1, paramName, space2, separator, space3]) => [[createUserFunctionDeclarationParameter(paramName, space2)],    new ParseContext()] %}
    # Param and then another param(s). The params must be separated by a newline and/or an param separator (",").
  | optionalWhitespaceOrNewline %parameterName whitespaceOrNewline                nonEmptyUserFunctionDeclarationParams  {% ([space1, first, space2,            [rest, restContext]]) => [[createUserFunctionDeclarationParameter(first, space2),    ...rest], restContext] %}
  | optionalWhitespaceOrNewline %parameterName                     %itemSeparator nonEmptyUserFunctionDeclarationParams  {% ([space1, first,         separator, [rest, restContext]]) => [[createUserFunctionDeclarationParameter(first, separator), ...rest], restContext] %}
  | optionalWhitespaceOrNewline %parameterName whitespaceOrNewline %itemSeparator nonEmptyUserFunctionDeclarationParams  {% ([space1, first, space2, separator, [rest, restContext]]) => [[createUserFunctionDeclarationParameter(first, space2),    ...rest], restContext] %}

userFunctionCall ->
    %functionName                     %functionParametersStart userFunctionCallParams %functionParametersEnd  {% ([functionName,         braceOpen, [parameters, context], braceClose]) => { callOnNextToken(context, braceClose); return createUserFunctionCall(functionName, braceOpen, braceClose, parameters); } %}
  | %functionName whitespaceOrNewline %functionParametersStart userFunctionCallParams %functionParametersEnd  {% ([functionName, space1, braceOpen, [parameters, context], braceClose]) => { callOnNextToken(context, braceClose); return createUserFunctionCall(functionName, space1,    braceClose, parameters); } %}

userFunctionCallParams ->
    # Empty
    null                 {% () => [[], new ParseContext()] %}
  | whitespaceOrNewline  {% () => [[], new ParseContext()] %}
    # Not empty
  | nonEmptyUserFunctionCallParams  {% ([paramsWithContext]) => paramsWithContext %}

nonEmptyUserFunctionCallParams ->
    # Single param. Optional trailing param separator (",").
    optionalWhitespaceOrNewline summand                                                                 {% ([space1, [paramValue, paramValueContext]                           ]) => [[createUserFunctionCallParameter(paramValue)], paramValueContext] %}
  | optionalWhitespaceOrNewline summand whitespaceOrNewline                                             {% ([space1, [paramValue, paramValueContext], space2                   ]) => { callOnNextToken(paramValueContext, space2);    return [[createUserFunctionCallParameter(paramValue)], new ParseContext()]; } %}
  | optionalWhitespaceOrNewline summand                     %itemSeparator optionalWhitespaceOrNewline  {% ([space1, [paramValue, paramValueContext],         separator, space3]) => { callOnNextToken(paramValueContext, separator); return [[createUserFunctionCallParameter(paramValue)], new ParseContext()]; } %}
  | optionalWhitespaceOrNewline summand whitespaceOrNewline %itemSeparator optionalWhitespaceOrNewline  {% ([space1, [paramValue, paramValueContext], space2, separator, space3]) => { callOnNextToken(paramValueContext, space2);    return [[createUserFunctionCallParameter(paramValue)], new ParseContext()]; } %}
    # Param and then another param(s). The params must be separated by a newline and/or an param separator (",").
  | optionalWhitespaceOrNewline summand whitespaceOrNewline                nonEmptyUserFunctionCallParams  {% ([space1, [first, firstContext], space2,            [rest, restContext]]) => { callOnNextToken(firstContext, space2);    return [[createUserFunctionCallParameter(first), ...rest], restContext]; } %}
  | optionalWhitespaceOrNewline summand                     %itemSeparator nonEmptyUserFunctionCallParams  {% ([space1, [first, firstContext],         separator, [rest, restContext]]) => { callOnNextToken(firstContext, separator); return [[createUserFunctionCallParameter(first), ...rest], restContext]; } %}
  | optionalWhitespaceOrNewline summand whitespaceOrNewline %itemSeparator nonEmptyUserFunctionCallParams  {% ([space1, [first, firstContext], space2, separator, [rest, restContext]]) => { callOnNextToken(firstContext, space2);    return [[createUserFunctionCallParameter(first), ...rest], restContext]; } %}

functionError -> %keywordError optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline string optionalWhitespaceOrNewline %functionParametersEnd  {% ([functionName, space1, braceOpen, space2, value, space3, braceClose]) => { return { type: 'error', value, range: createRangeEndInclusive(functionName, braceClose) }; } %}

functionPrint ->
    # String
    %keywordPrint optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline string            optionalWhitespaceOrNewline %functionParametersEnd  {% ([functionName, space1, braceOpen, space2, value,            space3, braceClose]) => {                                       return { type: 'print', value, range: createRangeEndInclusive(functionName, braceClose) }; } %}
    # Evaluated variable
  | %keywordPrint optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline evaluatedVariable                             %functionParametersEnd  {% ([functionName, space1, braceOpen, space2, [value, context],         braceClose]) => { callOnNextToken(context, braceClose); return { type: 'print', value, range: createRangeEndInclusive(functionName, braceClose) }; } %}
  | %keywordPrint optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline evaluatedVariable whitespaceOrNewline         %functionParametersEnd  {% ([functionName, space1, braceOpen, space2, [value, context], space3, braceClose]) => { callOnNextToken(context, space3);     return { type: 'print', value, range: createRangeEndInclusive(functionName, braceClose) }; } %}

functionSettings -> %keywordSettings functionBody  {% ([functionName, statements]) => { return { type: 'settings', statements }; } %}

functionIf ->
    %keywordIf optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline ifConditionExpression                     %functionParametersEnd functionBody  {% ([functionName, space1, braceOpen, space2, [condition, context],         braceClose, statements]) => { callOnNextToken(context, braceClose); return { type: 'if', condition, statements, range: createRangeEndInclusive(functionName, braceClose) }; } %}
  | %keywordIf optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline ifConditionExpression whitespaceOrNewline %functionParametersEnd functionBody  {% ([functionName, space1, braceOpen, space2, [condition, context], space3, braceClose, statements]) => { callOnNextToken(context, space3);     return { type: 'if', condition, statements, range: createRangeEndInclusive(functionName, braceClose) }; } %}

# Note on grouping (with `(...)`): grouping is always optional for boolean expressions (single booleans),
# but is required for comparisions and presence-in-ArrayOfStrings when they are part of a compound expression.
ifConditionExpression ->
    # Single item
    ifConditionExpressionExceptOr  {% ([valueWithContext]) => valueWithContext %}
    # Multiple items ||'d together
  | ifConditionExpressionExceptOrInCompound                     %operatorOr optionalWhitespaceOrNewline ifConditionExpressionInCompound  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [{ type: 'operator', operator: '||', lhs: lhs, rhs: rhs }, rhsContext]; } %}
  | ifConditionExpressionExceptOrInCompound whitespaceOrNewline %operatorOr optionalWhitespaceOrNewline ifConditionExpressionInCompound  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [{ type: 'operator', operator: '||', lhs: lhs, rhs: rhs }, rhsContext]; } %}

# Same as `ifConditionExpression` but it's part of a compund condition, so all paths use `ifConditionExpressionExceptOrInCompound`.
ifConditionExpressionInCompound ->
    # Single item
    ifConditionExpressionExceptOrInCompound  {% ([valueWithContext]) => valueWithContext %}
    # Multiple items ||'d together
  | ifConditionExpressionExceptOrInCompound                     %operatorOr optionalWhitespaceOrNewline ifConditionExpressionInCompound  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [{ type: 'operator', operator: '||', lhs: lhs, rhs: rhs }, rhsContext]; } %}
  | ifConditionExpressionExceptOrInCompound whitespaceOrNewline %operatorOr optionalWhitespaceOrNewline ifConditionExpressionInCompound  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [{ type: 'operator', operator: '||', lhs: lhs, rhs: rhs }, rhsContext]; } %}

ifConditionExpressionExceptOr ->
    # Single item
    ifConditionTermNotInCompound  {% ([valueWithContext]) => valueWithContext %}
    # Multiple items &&'d together
  | ifConditionTermInCompound                     %operatorAnd optionalWhitespaceOrNewline ifConditionExpressionExceptOrInCompound  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [{ type: 'operator', operator: '&&', lhs: lhs, rhs: rhs }, rhsContext]; } %}
  | ifConditionTermInCompound whitespaceOrNewline %operatorAnd optionalWhitespaceOrNewline ifConditionExpressionExceptOrInCompound  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [{ type: 'operator', operator: '&&', lhs: lhs, rhs: rhs }, rhsContext]; } %}

# Same as `ifConditionExpressionExceptOr` but it's part of a compound condition, so all paths use `ifConditionTermInCompound`.
ifConditionExpressionExceptOrInCompound ->
    # Single item
    ifConditionTermInCompound  {% ([valueWithContext]) => valueWithContext %}
    # Multiple items &&'d together
  | ifConditionTermInCompound                     %operatorAnd optionalWhitespaceOrNewline ifConditionExpressionExceptOrInCompound  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [{ type: 'operator', operator: '&&', lhs: lhs, rhs: rhs }, rhsContext]; } %}
  | ifConditionTermInCompound whitespaceOrNewline %operatorAnd optionalWhitespaceOrNewline ifConditionExpressionExceptOrInCompound  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [{ type: 'operator', operator: '&&', lhs: lhs, rhs: rhs }, rhsContext]; } %}

@{%

function createIfConditionComparison(operatorToken: Token, lhs: any, rhs: any) {
    const operatorValue = operatorToken.value;

    const operatorRange = createRange(operatorToken, operatorToken);
    operatorRange.end.character += operatorValue.length;

    return {
        type: 'comparison',
        operator: {
            value: operatorValue,
            range: operatorRange
        },
        lhs,
        rhs
    };
}

%}

# Note on grouping (with `(...)`): grouping is optional since this is not part of a compound expression.
ifConditionTermNotInCompound ->
    ifConditionTermBoolean                               {% ([valueWithContext]) => valueWithContext %}
  | ifConditionTermComparisonOrPresenceInArrayOfStrings  {% ([valueWithContext]) => valueWithContext %}
    # () group
  | %functionParametersStart optionalWhitespaceOrNewline ifConditionExpression optionalWhitespaceOrNewline %functionParametersEnd                                {% ([braceOpen, space1, valueWithContext, space2, braceClose]) => valueWithContext %}

# Note on grouping (with `(...)`): grouping is optional for boolean expressions (single booleans),
# but is required for comparisions and presence-in-ArrayOfStrings since this is part of a compound expression.
ifConditionTermInCompound ->
    ifConditionTermBoolean                               {% ([valueWithContext]) => valueWithContext %}
    # () group
  | %functionParametersStart optionalWhitespaceOrNewline ifConditionExpression optionalWhitespaceOrNewline %functionParametersEnd                                {% ([braceOpen, space1, valueWithContext, space2, braceClose]) => valueWithContext %}

# A condition term that is a boolean expression (boolean literal or evaluated variable)
ifConditionTermBoolean ->
    # Boolean expression: literal
    bool                                                        {% ([            [value, context]]) => [ { type: 'boolean', value, invert: false }, context ] %}
    # Boolean expression: .Value
  |                                          evaluatedVariable  {% ([            [value, context]]) => [ { type: 'boolean', value, invert: false }, context ] %}
    # Boolean expression: ! .Value
  | %operatorNot optionalWhitespaceOrNewline evaluatedVariable  {% ([not, space, [value, context]]) => [ { type: 'boolean', value, invert: true  }, context ] %}

# A condition term that is a comparison or a check for presence-in-ArrayOfStrings
#
# Allow specifying more types than are allowed in comparisons, because we can give a better error in the evaluator than here.
ifConditionTermComparisonOrPresenceInArrayOfStrings ->
    # Comparison: .Value1 == .Value2
    summand                     %operatorEqual          optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [ createIfConditionComparison(operator, lhs, rhs), rhsContext ]; } %}
  | summand whitespaceOrNewline %operatorEqual          optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [ createIfConditionComparison(operator, lhs, rhs), rhsContext ]; } %}
    # Comparison: .Value1 != .Value2
  | summand                     %operatorNotEqual       optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [ createIfConditionComparison(operator, lhs, rhs), rhsContext ]; } %}
  | summand whitespaceOrNewline %operatorNotEqual       optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [ createIfConditionComparison(operator, lhs, rhs), rhsContext ]; } %}
    # Comparison: .Value1 < .Value2
  | summand                     %operatorLess           optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [ createIfConditionComparison(operator, lhs, rhs), rhsContext ]; } %}
  | summand whitespaceOrNewline %operatorLess           optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [ createIfConditionComparison(operator, lhs, rhs), rhsContext ]; } %}
    # Comparison: .Value1 <= .Value2
  | summand                     %operatorLessOrEqual    optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [ createIfConditionComparison(operator, lhs, rhs), rhsContext ]; } %}
  | summand whitespaceOrNewline %operatorLessOrEqual    optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [ createIfConditionComparison(operator, lhs, rhs), rhsContext ]; } %}
    # Comparison: .Value1 > .Value2
  | summand                     %operatorGreater        optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [ createIfConditionComparison(operator, lhs, rhs), rhsContext ]; } %}
  | summand whitespaceOrNewline %operatorGreater        optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [ createIfConditionComparison(operator, lhs, rhs), rhsContext ]; } %}
    # Comparison: .Value1 >= .Value2
  | summand                     %operatorGreaterOrEqual optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [ createIfConditionComparison(operator, lhs, rhs), rhsContext ]; } %}
  | summand whitespaceOrNewline %operatorGreaterOrEqual optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [ createIfConditionComparison(operator, lhs, rhs), rhsContext ]; } %}
    # Presence in ArrayOfStrings: .Value1 in .Value2
  | summand                                                             %keywordIn optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext],                      keywordIn, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, keywordIn); return [ { type: 'in', lhs, rhs, invert: false }, rhsContext ]; } %}
  | summand whitespaceOrNewline                                         %keywordIn optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext], space1,              keywordIn, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);    return [ { type: 'in', lhs, rhs, invert: false }, rhsContext ]; } %}
    # Presence in ArrayOfStrings: .Value1 not in .Value2
  | summand                     %keywordNot optionalWhitespaceOrNewline %keywordIn optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext],         not, space2, keywordIn, space3, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, not);       return [ { type: 'in', lhs, rhs, invert: true  }, rhsContext ]; } %}
  | summand whitespaceOrNewline %keywordNot optionalWhitespaceOrNewline %keywordIn optionalWhitespaceOrNewline summand  {% ([[lhs, lhsContext], space1, not, space2, keywordIn, space3, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);    return [ { type: 'in', lhs, rhs, invert: true  }, rhsContext ]; } %}

directiveInclude -> %directiveInclude optionalWhitespaceOrNewline stringLiteral  {% ([include, space, path]) => { return { type: 'include', path }; } %}

directiveOnce -> %directiveOnce  {% () => { return { type: 'once' }; } %}

directiveIf ->
    %directiveIf %whitespace directiveIfConditionOrExpression %optionalWhitespaceAndMandatoryNewline lines                                                             %directiveEndIf  {% ([directiveIf, space1, condition, space2, ifStatements,                                        directiveEndIf]) => { return { type: 'directiveIf', condition, ifStatements, elseStatements: [], rangeStart: createLocation(directiveIf) }; } %}
  | %directiveIf %whitespace directiveIfConditionOrExpression %optionalWhitespaceAndMandatoryNewline lines %directiveElse %optionalWhitespaceAndMandatoryNewline lines %directiveEndIf  {% ([directiveIf, space1, condition, space2, ifStatements, directiveElse, space3, elseStatements, directiveEndIf]) => { return { type: 'directiveIf', condition, ifStatements, elseStatements    , rangeStart: createLocation(directiveIf) }; } %}

directiveIfConditionOrExpression ->
    # Single item
    directiveIfConditionAndExpression  {% ([value]) => [value] %}
    # Multiple items ||'d together
  | directiveIfConditionAndExpression optionalWhitespace %operatorOr optionalWhitespace directiveIfConditionOrExpression  {% ([lhsValue, space1, or, space2, rhsValues]) => [lhsValue, ...rhsValues] %}

directiveIfConditionAndExpression ->
    # Single item
    directiveIfConditionTermOrNot  {% ([value]) => [value] %}
    # Multiple items &&'d together
  | directiveIfConditionTermOrNot optionalWhitespace %operatorAnd optionalWhitespace directiveIfConditionAndExpression  {% ([lhsValue, space1, and, space2, rhsValues]) => [lhsValue, ...rhsValues] %}

directiveIfConditionTermOrNot ->
    # SYMBOL
                                    directiveIfConditionTerm  {% ([            term]) => { return { term, invert: false }; } %}
    # ! SYMBOL
  | %operatorNot optionalWhitespace directiveIfConditionTerm  {% ([not, space, term]) => { return { term, invert: true  }; } %}

directiveIfConditionTerm ->
    variableName  {% ([[symbol, context]]) => { return { type: 'isSymbolDefined', symbol: symbol.value }; } %}
  | %exists     optionalWhitespace %parametersStart optionalWhitespace variableName  optionalWhitespace %parametersEnd {% ([exists, space1, openBrace, space2, [envVar, context], space3, closeBrace]) => { return { type: 'envVarExists'         }; } %}
  | %fileExists optionalWhitespace %parametersStart optionalWhitespace stringLiteral optionalWhitespace %parametersEnd {% ([exists, space1, openBrace, space2, filePath,          space3, closeBrace]) => { return { type: 'fileExists', filePath }; } %}

directiveDefine   -> %directiveDefine   %whitespace variableName  {% ([define,   space, [symbol, context]]) => [{ type: 'define',   symbol }, context] %}

directiveUndefine -> %directiveUndefine %whitespace variableName  {% ([undefine, space, [symbol, context]]) => [{ type: 'undefine', symbol }, context] %}

directiveImport   -> %directiveImport   %whitespace variableName  {% ([directiveImport, space, [symbol, varNameContext]]) => {
    const [range, statementContext] = createRangeStart(directiveImport);
    const context = createCombinedContext([statementContext, varNameContext]);
    return [{ type: 'importEnvVar', symbol, range }, context];
} %}

whitespaceOrNewline ->
    %whitespace                             {% id %}
  | %optionalWhitespaceAndMandatoryNewline  {% id %}

optionalWhitespaceOrNewline ->
    null                 {% () => null %}
  | whitespaceOrNewline  {% () => null %}

optionalWhitespace ->
    null         {% () => null %}
  | %whitespace  {% () => null %}
