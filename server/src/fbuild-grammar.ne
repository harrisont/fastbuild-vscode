@{%
const moo = require('moo');

const lexer = moo.states({
    main: {
        optionalWhitespaceAndMandatoryNewline: { match: /[ \t\n]*\n[ \t\n]*/, lineBreaks: true },
        whitespace: /[ \t]+/,
        comment: /(?:;|\/\/).*/,
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

        operatorAssignment: '=',
        operatorAddition: '+',

        arrayOrStructItemSeparator: ',',
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
    },
    singleQuotedStringBodyThenPop: {
        startTemplatedVariable: { match: '$', push: 'templatedVariable' },
        stringEnd: { match: "'", pop: 1 },
        // Handle escaping ', $, ^ with ^
        stringLiteral: /(?:[^'\$\^\n]|\^['$\^])+/,
    },
    doubleQuotedStringBodyThenPop: {
        startTemplatedVariable: { match: '$', push: 'templatedVariable' },
        stringEnd: { match: '"', pop: 1 },
        // Handle escaping ", $, ^ with ^
        stringLiteral: /(?:[^"\$\^\n]|\^["$\^])+/,
    },
    // Same as "...ThenPop" but instead of popping, goes to "main".
    singleQuotedStringBodyThenMain: {
        startTemplatedVariable: { match: '$', push: 'templatedVariable' },
        stringEnd: { match: "'", next: 'main' },
        // Handle escaping ', $, ^ with ^
        stringLiteral: /(?:[^'\$\^\n]|\^['$\^])+/,
    },
    doubleQuotedStringBodyThenMain: {
        startTemplatedVariable: { match: '$', push: 'templatedVariable' },
        stringEnd: { match: '"', next: 'main' },
        // Handle escaping ", $, ^ with ^
        stringLiteral: /(?:[^"\$\^\n]|\^["$\^])+/,
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
});
%}

# Pass your lexer object using the @lexer option:
@lexer lexer

@preprocessor typescript

main -> lines  {% (d) => d[0] %}

lines ->
    null  {% () => [] %}
  | whitespaceOrNewline lines  {% ([space, lines]) => lines %}
  | statementAndOrCommentAndNewline lines  {% ([first, rest]) => [...first, ...rest] %}

@{%

class ParseContext {
    onNextToken: null | ((token:any) => void) = null;
}

function callOnNextToken(context: ParseContext, token: object) {
    if (context.onNextToken !== null) {
        context.onNextToken(token);
        context.onNextToken = null;
    }
}

%}

# Returns either:
#  * a 1-length array with the item being the statement
#  * a 0-length array
statementAndOrCommentAndNewline ->
    statement                      %optionalWhitespaceAndMandatoryNewline  {% ([[statement, context],                  space2]) => { callOnNextToken(context, space2);  return [statement]; } %}
  | statement             %comment %optionalWhitespaceAndMandatoryNewline  {% ([[statement, context],         comment, space2]) => { callOnNextToken(context, comment); return [statement]; } %}
  | statement %whitespace %comment %optionalWhitespaceAndMandatoryNewline  {% ([[statement, context], space1, comment, space2]) => { callOnNextToken(context, space1);  return [statement]; } %}
  |                       %comment %optionalWhitespaceAndMandatoryNewline  {% () => [] %}

statement ->
    scopedStatements          {% ([value]) => [ value, new ParseContext() ] %}
  | variableDefinition        {% ([valueWithContext]) => valueWithContext %}
  | variableAddition          {% ([valueWithContext]) => valueWithContext %}
  | functionError             {% ([value]) => [ value, new ParseContext() ] %}
  | functionForEach           {% ([value]) => [ value, new ParseContext() ] %}
  | functionIf                {% ([value]) => [ value, new ParseContext() ] %}
  | functionPrint             {% ([value]) => [ value, new ParseContext() ] %}
  | functionSettings          {% ([value]) => [ value, new ParseContext() ] %}
  | functionUsing             {% ([value]) => [ value, new ParseContext() ] %}
  | genericFunctionWithAlias  {% ([value]) => [ value, new ParseContext() ] %}

scopedStatements -> %scopeOrArrayStart %optionalWhitespaceAndMandatoryNewline lines %scopeOrArrayEnd  {% ([braceOpen, space, statements, braceClose]) => { return { type: "scopedStatements", statements }; } %}

@{%

interface SourceLocation {
    line: number;
    character: number;
}

interface SourceRange {
    start: SourceLocation;
    end: SourceLocation;
}

interface Token {
    line: number;
    col: number;
    value: any;
}

function createLocation(token: Token): SourceLocation {
    return {
        line: token.line - 1,
        character: token.col - 1
    };
}

// Creates a range from tokenStart's location (inclusive) to tokenEnd's location (exclusive).
// tokenStart and tokenEnd must be lexer tokens.
function createRange(tokenStart: Token, tokenEnd: Token): SourceRange {
    return {
        start: createLocation(tokenStart),
        end: createLocation(tokenEnd)
    };
}

// Creates a range from tokenStart's location (inclusive) to tokenEnd's location (inclusive).
// tokenStart and tokenEnd must be lexer tokens.
function createRangeEndInclusive(tokenStart: Token, tokenEnd: Token): SourceRange {
    const end = createLocation(tokenEnd);
    end.character += 1;
    return {
        start: createLocation(tokenStart),
        end
    };
}

%}

variableName ->
    # Literal name
    %variableName  {% ([nameToken]) => nameToken.value %}
    # Evaluated (dynamic) name
  | string  {% ([string]) => string %}

variableReference ->
    %variableReferenceCurrentScope variableName  {% ([scopeToken, varName]) => [scopeToken, "current", varName] %}
  | %variableReferenceParentScope  variableName  {% ([scopeToken, varName]) => [scopeToken, "parent",  varName] %}

lhsWithOperatorAssignment ->
    variableReference                     %operatorAssignment  {% ([[scopeToken, scope, varName],        operator]) => { return { name: varName, scope, range: createRange(scopeToken, operator) }; } %}
  | variableReference whitespaceOrNewline %operatorAssignment  {% ([[scopeToken, scope, varName], space, operator]) => { return { name: varName, scope, range: createRange(scopeToken, space)    }; } %}

lhsWithOperatorAddition ->
    variableReference                     %operatorAddition    {% ([[scopeToken, scope, varName],        operator]) => { return { name: varName, scope, range: createRange(scopeToken, operator) }; } %}
  | variableReference whitespaceOrNewline %operatorAddition    {% ([[scopeToken, scope, varName], space, operator]) => { return { name: varName, scope, range: createRange(scopeToken, space)    }; } %}

variableDefinition ->
    lhsWithOperatorAssignment optionalWhitespaceOrNewline rValue  {% ([lhs, space, [rValue, context]]) => { return [ { type: "variableDefinition", lhs: lhs, rhs: rValue }, context ]; } %}

variableAddition ->
    lhsWithOperatorAddition   optionalWhitespaceOrNewline rValue  {% ([lhs, space, [rValue, context]]) => { return [ { type: "variableAddition",   lhs: lhs, rhs: rValue }, context ]; } %}

rValue ->
    %integer          {% ([token]) => [ token.value, new ParseContext() ] %}
  | bool              {% ([value]) => [ value,       new ParseContext() ] %}
  # sum is the sum of 1 or more strings, evaluated variables, or arrays.
  | sum               {% ([valueWithContext]) => valueWithContext %}
  | struct            {% ([valueWithContext]) => valueWithContext %}

bool ->
    %keywordTrue   {% () => true %}
  | %keywordFalse  {% () => false %}

# A single item or multiple items added together.
sum -> sumHelper  {% ([[parts, context]]) => {
    if (parts.length == 1) {
        return [parts[0], context];
    } else {
        const sum = {
            type: 'sum',
            summands: parts,
        };
        return [sum, context];
    }
} %}

sumHelper ->
    # Single item
    summand  {% ([[value, context]]) => [value, context] %}
    # Multiple items added together
  | summand                     %operatorAddition optionalWhitespaceOrNewline sumHelper  {% ([[lhs, lhsContext],         operator, space2, [rValue, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [[...lhs, ...rValue], rhsContext]; } %}
  | summand whitespaceOrNewline %operatorAddition optionalWhitespaceOrNewline sumHelper  {% ([[lhs, lhsContext], space1, operator, space2, [rValue, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [[...lhs, ...rValue], rhsContext]; } %}

summand ->
    string             {% ([value]) => [ [value], new ParseContext() ] %}
  | evaluatedVariable  {% ([[value, context]]) => [ [value], context] %}
  | array              {% ([[value, context]]) => [ [value], context] %}

@{%

function createString(parts: any[]) {
    if (parts.length == 0) {
        return '';
    } else if (parts.length == 1) {
        return parts[0];
    } else {
        const stringExpression = {
            type: 'stringExpression',
            parts,
        };
        return stringExpression;
    }
}

%}

string ->
    %singleQuotedStringStart stringContents %stringEnd  {% ([quoteStart, content, quoteEnd]) => createString(content) %}
  | %doubleQuotedStringStart stringContents %stringEnd  {% ([quoteStart, content, quoteEnd]) => createString(content) %}

# Generates an array of either string or evaluatedVariables: (string | evaluatedVariable)[]
stringContents ->
    null  {% () => [] %}
    # String literal
  | %stringLiteral stringContents  {% ([literal, rest]) => {
        // Handle escaped characters.
        const escapedValue = literal.value.replace(/\^(.)/g, '$1');

        if (rest.length > 0) {
            return [escapedValue, ...rest];
        } else {
            return [escapedValue];
        }
    } %}
    # Templated string
  | %startTemplatedVariable %variableName %endTemplatedVariable stringContents  {% ([startVarIndicator, varName, endVarIndicator, rest]) => {
        const evaluatedVariable = {
            type: "evaluatedVariable",
            scope: "current",
            name: varName.value,
            range: {
                start: {
                    line: varName.line - 1,
                    character: startVarIndicator.col - 1,
                },
                end: {
                    line: varName.line - 1,
                    character: endVarIndicator.col,
                }
            }
        };
        if (rest.length > 0) {
            return [evaluatedVariable, ...rest];
        } else {
            return [evaluatedVariable];
        }
    } %}

@{%

function createEvaluatedVariable(varName: any, startToken: Token, scope: ("current" | "parent")) {
    const evaluatedVariable = {
        type: "evaluatedVariable",
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
        evaluatedVariable.range.end = createLocation(token);
    };

    return [evaluatedVariable, context];
}

%}

evaluatedVariable -> variableReference  {% ([[scopeToken, scope, varName]]) => createEvaluatedVariable(varName, scopeToken, scope) %}

array -> %scopeOrArrayStart arrayContents %scopeOrArrayEnd  {% ([braceOpen, [contents, context], braceClose]) => { callOnNextToken(context, braceClose); return [contents, context]; } %}

arrayContents ->
    # Empty
    null                 {% () => [[], new ParseContext()] %}
  | whitespaceOrNewline  {% () => [[], new ParseContext()] %}
    # Not empty
  | nonEmptyArrayContents  {% ([contentsWithContext]) => contentsWithContext %}

nonEmptyArrayContents ->
    # Single item. Optional trailing item separator (",").
    optionalWhitespaceOrNewline rValue                                                                              {% ([space1, [content, context]                           ]) => {                                      return [[content], context]; } %}
  | optionalWhitespaceOrNewline rValue whitespaceOrNewline                                                          {% ([space1, [content, context], space2                   ]) => { callOnNextToken(context, space2);    return [[content], context]; } %}
  | optionalWhitespaceOrNewline rValue                     %arrayOrStructItemSeparator optionalWhitespaceOrNewline  {% ([space1, [content, context],         separator, space3]) => { callOnNextToken(context, separator); return [[content], context]; } %}
  | optionalWhitespaceOrNewline rValue whitespaceOrNewline %arrayOrStructItemSeparator optionalWhitespaceOrNewline  {% ([space1, [content, context], space2, separator, space3]) => { callOnNextToken(context, space2);    return [[content], context]; } %}
    # Item and then another item(s). The items must be separated by a newline and/or an item separator (",").
  | optionalWhitespaceOrNewline rValue %optionalWhitespaceAndMandatoryNewline                             nonEmptyArrayContents  {% ([space1, [first, firstContext], space2,            [rest, restContext]]) => { callOnNextToken(firstContext, space2);    return [[first, ...rest], restContext]; } %}
  | optionalWhitespaceOrNewline rValue                                        %arrayOrStructItemSeparator nonEmptyArrayContents  {% ([space1, [first, firstContext],         separator, [rest, restContext]]) => { callOnNextToken(firstContext, separator); return [[first, ...rest], restContext]; } %}
  | optionalWhitespaceOrNewline rValue whitespaceOrNewline                    %arrayOrStructItemSeparator nonEmptyArrayContents  {% ([space1, [first, firstContext], space2, separator, [rest, restContext]]) => { callOnNextToken(firstContext, space2);    return [[first, ...rest], restContext]; } %}
    # Single comment.
  | optionalWhitespaceOrNewline %comment optionalWhitespaceOrNewline                                   {% () => [[], new ParseContext()] %}
    # Comment and then another item(s).
  | optionalWhitespaceOrNewline %comment %optionalWhitespaceAndMandatoryNewline nonEmptyArrayContents  {% ([space, comment, newline, [rest, context]]) => [[...rest], context] %}

struct -> %structStart structContents %structEnd  {% ([braceOpen, [statements, context], braceClose]) => {
    callOnNextToken(context, braceClose);
    return [
        { type: "struct", statements: statements },
        context
    ];
} %}

structContents ->
    # Empty
    null                      {% () => [ [], new ParseContext() ] %}
  | whitespaceOrNewline       {% () => [ [], new ParseContext() ] %}
  | nonEmptyStructStatements  {% ([statementsWithContext]) => statementsWithContext %}

nonEmptyStructStatements ->
    # Single item. Optional trailing item separator (",").
    optionalWhitespaceOrNewline statementAndOptionalComment                                                                              {% ([space1, [statement, context]                           ]) => {                                      return [[statement], context]; } %}
  | optionalWhitespaceOrNewline statementAndOptionalComment whitespaceOrNewline                                                          {% ([space1, [statement, context], space2                   ]) => { callOnNextToken(context, space2);    return [[statement], context]; } %}
  | optionalWhitespaceOrNewline statementAndOptionalComment                     %arrayOrStructItemSeparator optionalWhitespaceOrNewline  {% ([space1, [statement, context],         separator, space3]) => { callOnNextToken(context, separator); return [[statement], context]; } %}
  | optionalWhitespaceOrNewline statementAndOptionalComment whitespaceOrNewline %arrayOrStructItemSeparator optionalWhitespaceOrNewline  {% ([space1, [statement, context], space2, separator, space3]) => { callOnNextToken(context, space2);    return [[statement], context]; } %}
    # Item and then another item(s). The items must be separated by a newline and/or an item separator (",").
  | optionalWhitespaceOrNewline statementAndOptionalComment %optionalWhitespaceAndMandatoryNewline                             nonEmptyStructStatements  {% ([space1, [firstStatement, firstContext], space2,            [restStatements, restContext]]) => { callOnNextToken(firstContext, space2);    return [[firstStatement, ...restStatements], restContext]; } %}
  | optionalWhitespaceOrNewline statementAndOptionalComment                                        %arrayOrStructItemSeparator nonEmptyStructStatements  {% ([space1, [firstStatement, firstContext],         separator, [restStatements, restContext]]) => { callOnNextToken(firstContext, separator); return [[firstStatement, ...restStatements], restContext]; } %}
  | optionalWhitespaceOrNewline statementAndOptionalComment whitespaceOrNewline                    %arrayOrStructItemSeparator nonEmptyStructStatements  {% ([space1, [firstStatement, firstContext], space2, separator, [restStatements, restContext]]) => { callOnNextToken(firstContext, space2);    return [[firstStatement, ...restStatements], restContext]; } %}
    # Single comment.
  | optionalWhitespaceOrNewline %comment %optionalWhitespaceAndMandatoryNewline {% () => [[], new ParseContext()] %}
    # Comment and then another item(s).
  | optionalWhitespaceOrNewline %comment %optionalWhitespaceAndMandatoryNewline nonEmptyStructStatements {% ([space, comment, newline, restWithContext]) => restWithContext %}

statementAndOptionalComment ->
    statement                       {% ([statementWithContext,                ]) => {                                    return statementWithContext; } %}
  | statement             %comment  {% ([[statement, context],         comment]) => { callOnNextToken(context, comment); return [statement, context]; } %}
  | statement %whitespace %comment  {% ([[statement, context], space1, comment]) => { callOnNextToken(context, space1);  return [statement, context]; } %}
  

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

function createForEach(loopVar: object, arrayToLoopOver: object, statements: Record<string, any>) {
    return {
        type: 'forEach',
        loopVar,
        arrayToLoopOver,
        statements
    };
}

%}

functionForEach ->
    %keywordForEach optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline forEachLoopVar optionalWhitespaceOrNewline evaluatedVariable                     %functionParametersEnd functionBody  {% ([functionName, space1, braceOpen, space2, forEachLoopVar, space3, [evaluatedVariable, context],         braceClose, statements]) => { callOnNextToken(context, braceClose); return createForEach(forEachLoopVar, evaluatedVariable, statements); } %}
  | %keywordForEach optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline forEachLoopVar optionalWhitespaceOrNewline evaluatedVariable whitespaceOrNewline %functionParametersEnd functionBody  {% ([functionName, space1, braceOpen, space2, forEachLoopVar, space3, [evaluatedVariable, context], space4, braceClose, statements]) => { callOnNextToken(context, space4);     return createForEach(forEachLoopVar, evaluatedVariable, statements); } %}

forEachLoopVar ->
    %variableReferenceCurrentScope variableName                     %keywordIn  {% ([scope, varName,        keywordIn]) => { return { name: varName, range: createRange(scope, keywordIn) }; } %}
  | %variableReferenceCurrentScope variableName whitespaceOrNewline %keywordIn  {% ([scope, varName, space, keywordIn]) => { return { name: varName, range: createRange(scope, space)     }; } %}

functionBody -> optionalWhitespaceOrNewline %scopeOrArrayStart %optionalWhitespaceAndMandatoryNewline lines %scopeOrArrayEnd  {% ([space1, braceOpen, space2, statements, braceClose]) => statements %}

@{%

function createGenericFunction(alias: any, statements: Record<string, any>) {
    return {
        type: 'genericFunction',
        alias,
        statements
    };
}

%}

# Functions that we don't care about handling except for the function's alias parameter.
genericFunctionWithAlias ->
    genericFunctionNameWithAlias optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline alias                     %functionParametersEnd functionBody  {% ([functionName, space1, braceOpen, space2, [alias, context],         braceClose, statements]) => { callOnNextToken(context, braceClose); return createGenericFunction(alias, statements); } %}
  | genericFunctionNameWithAlias optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline alias whitespaceOrNewline %functionParametersEnd functionBody  {% ([functionName, space1, braceOpen, space2, [alias, context], space3, braceClose, statements]) => { callOnNextToken(context, space3);     return createGenericFunction(alias, statements); } %}

# Function names of functions that we don't care about handling except for the function's alias parameter.
genericFunctionNameWithAlias ->
    %keywordAlias
  | %keywordCompiler
  | %keywordCopy
  | %keywordCopyDir
  | %keywordCSAssembly
  | %keywordDLL
  | %keywordExec
  | %keywordExecutable
  | %keywordLibrary
  | %keywordObjectList
  | %keywordRemoveDir
  | %keywordTest
  | %keywordTextFile
  | %keywordUnity
  | %keywordVCXProject
  | %keywordVSProjectExternal
  | %keywordVSSolution
  | %keywordXCodeProject

alias ->
    string             {% ([value]) => [ value, new ParseContext() ] %}
  | evaluatedVariable  {% ([valueWithContext]) => valueWithContext %}

functionError -> %keywordError optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline string optionalWhitespaceOrNewline %functionParametersEnd  {% ([functionName, space1, braceOpen, space2, value, space3, braceClose]) => { return { type: 'error', value }; } %}

functionPrint ->
    # String
    %keywordPrint optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline string            optionalWhitespaceOrNewline %functionParametersEnd  {% ([functionName, space1, braceOpen, space2, value,            space3, braceClose]) => {                                       return { type: 'print', value }; } %}
    # Evaluated variable
  | %keywordPrint optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline evaluatedVariable                             %functionParametersEnd  {% ([functionName, space1, braceOpen, space2, [value, context],         braceClose]) => { callOnNextToken(context, braceClose); return { type: 'print', value }; } %}
  | %keywordPrint optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline evaluatedVariable whitespaceOrNewline         %functionParametersEnd  {% ([functionName, space1, braceOpen, space2, [value, context], space3, braceClose]) => { callOnNextToken(context, space3);     return { type: 'print', value }; } %}

functionSettings -> %keywordSettings functionBody  {% ([functionName, statements]) => { return { type: 'settings', statements }; } %}

functionIf ->
    %keywordIf optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline ifCondition                     %functionParametersEnd functionBody  {% ([functionName, space1, braceOpen, space2, [condition, context],         braceClose, statements]) => { callOnNextToken(context, braceClose); return { type: 'if', condition, statements }; } %}
  | %keywordIf optionalWhitespaceOrNewline %functionParametersStart optionalWhitespaceOrNewline ifCondition whitespaceOrNewline %functionParametersEnd functionBody  {% ([functionName, space1, braceOpen, space2, [condition, context], space3, braceClose, statements]) => { callOnNextToken(context, space3);     return { type: 'if', condition, statements }; } %}

ifCondition ->
    # Boolean expression: .Value
                                             evaluatedVariable  {% ([            [value, context]]) => [ { type: 'boolean', value, invert: false }, context ] %}
    # Boolean expression: ! .Value 
  | %operatorNot optionalWhitespaceOrNewline evaluatedVariable  {% ([not, space, [value, context]]) => [ { type: 'boolean', value, invert: true  }, context ] %}
    # Comparison: .Value1 == .Value2
  | evaluatedVariable                     %operatorEqual          optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [ { type: 'comparison', operator: operator.value, lhs, rhs }, rhsContext ]; } %}
  | evaluatedVariable whitespaceOrNewline %operatorEqual          optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [ { type: 'comparison', operator: operator.value, lhs, rhs }, rhsContext ]; } %}
    # Comparison: .Value1 != .Value2
  | evaluatedVariable                     %operatorNotEqual       optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [ { type: 'comparison', operator: operator.value, lhs, rhs }, rhsContext ]; } %}
  | evaluatedVariable whitespaceOrNewline %operatorNotEqual       optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [ { type: 'comparison', operator: operator.value, lhs, rhs }, rhsContext ]; } %}
    # Comparison: .Value1 < .Value2
  | evaluatedVariable                     %operatorLess           optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [ { type: 'comparison', operator: operator.value, lhs, rhs }, rhsContext ]; } %}
  | evaluatedVariable whitespaceOrNewline %operatorLess           optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [ { type: 'comparison', operator: operator.value, lhs, rhs }, rhsContext ]; } %}
    # Comparison: .Value1 <= .Value2
  | evaluatedVariable                     %operatorLessOrEqual    optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [ { type: 'comparison', operator: operator.value, lhs, rhs }, rhsContext ]; } %}
  | evaluatedVariable whitespaceOrNewline %operatorLessOrEqual    optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [ { type: 'comparison', operator: operator.value, lhs, rhs }, rhsContext ]; } %}
    # Comparison: .Value1 > .Value2
  | evaluatedVariable                     %operatorGreater        optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [ { type: 'comparison', operator: operator.value, lhs, rhs }, rhsContext ]; } %}
  | evaluatedVariable whitespaceOrNewline %operatorGreater        optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [ { type: 'comparison', operator: operator.value, lhs, rhs }, rhsContext ]; } %}
    # Comparison: .Value1 >= .Value2
  | evaluatedVariable                     %operatorGreaterOrEqual optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext],         operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, operator); return [ { type: 'comparison', operator: operator.value, lhs, rhs }, rhsContext ]; } %}
  | evaluatedVariable whitespaceOrNewline %operatorGreaterOrEqual optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext], space1, operator, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);   return [ { type: 'comparison', operator: operator.value, lhs, rhs }, rhsContext ]; } %}
    # Presence in ArrayOfStrings: .Value1 in .Value2
  | evaluatedVariable                                                             %keywordIn optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext],                      keywordIn, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, keywordIn); return [ { type: 'in', lhs, rhs, invert: false }, rhsContext ]; } %}
  | evaluatedVariable whitespaceOrNewline                                         %keywordIn optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext], space1,              keywordIn, space2, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);    return [ { type: 'in', lhs, rhs, invert: false }, rhsContext ]; } %}
    # Presence in ArrayOfStrings: .Value1 not in .Value2
  | evaluatedVariable                     %keywordNot optionalWhitespaceOrNewline %keywordIn optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext],         not, space2, keywordIn, space3, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, not);       return [ { type: 'in', lhs, rhs, invert: true  }, rhsContext ]; } %}
  | evaluatedVariable whitespaceOrNewline %keywordNot optionalWhitespaceOrNewline %keywordIn optionalWhitespaceOrNewline evaluatedVariable  {% ([[lhs, lhsContext], space1, not, space2, keywordIn, space3, [rhs, rhsContext]]) => { callOnNextToken(lhsContext, space1);    return [ { type: 'in', lhs, rhs, invert: true  }, rhsContext ]; } %}

whitespaceOrNewline ->
    %whitespace                             {% ([space]) => space %}
  | %optionalWhitespaceAndMandatoryNewline  {% ([space]) => space %}

optionalWhitespaceOrNewline ->
    null                 {% () => null %}
  | whitespaceOrNewline  {% () => null %}
