@{%
const moo = require('moo');

const lexer = moo.states({
    main: {
        whitespace: /[ \t]+/,
        optionalWhitespaceAndMandatoryNewline: { match: /[ \t\n]*\n[ \t\n]*/, lineBreaks: true },
        comment: /(?:;|\/\/).*/,
        // The symbols for array/scope delimeters are the same.
        // We could distinguish them by pushing state when we're on the RHS of an operator (assignment/addition), to know that the symbols are array delimeters.
        // There doesn't seem to be a benefit to doing so though, so for now, use the same symbol for both.
        scopeOrArrayStart: '{',
        scopeOrArrayEnd: '}',
        integer: { match: /0|[1-9][0-9]*/, value: (s: string) => parseInt(s) },
        singleQuotedStringStart: { match: "'", push: 'singleQuotedStringBody' },
        doubleQuotedStringStart: { match: '"', push: 'doubleQuotedStringBody' },
        variableName: /[a-zA-Z_][a-zA-Z0-9_]*/,
        variableReferenceCurrentScope: '.',
        variableReferenceParentScope: '^',
        operatorAssignment: '=',
        operatorAddition: '+',
        arrayItemSeparator: ',',
        structStart: '[',
        structEnd: ']',
    },
    singleQuotedStringBody: {
        startTemplatedVariable: { match: '$', push: 'templatedVariable' },
        stringEnd: { match: "'", pop: 1 },
        // Handle escaping ', $, ^ with ^
        stringLiteral: /(?:[^'\$\^\n]|\^['$\^])+/,
    },
    doubleQuotedStringBody: {
        startTemplatedVariable: { match: '$', push: 'templatedVariable' },
        stringEnd: { match: '"', pop: 1 },
        // Handle escaping ", $, ^ with ^
        stringLiteral: /(?:[^"\$\^\n]|\^["$\^])+/,
    },
    templatedVariable: {
        endTemplatedVariable: { match: '$', pop: 1 },
        variableName: /[a-zA-Z_][a-zA-Z0-9_]*/,
    }
});
%}

# Pass your lexer object using the @lexer option:
@lexer lexer

@preprocessor typescript

main -> lines  {% function(d) { return d[0]; } %}

lines ->
    null  {% function(d) { return []; } %}
  | whitespaceOrNewline lines  {% function(d) { return d[1]; } %}
  | statementAndOrComment lines  {% function(d) { return d.flat(); } %}

statementAndOrComment ->
    statement %optionalWhitespaceAndMandatoryNewline  {% function(d) { return d[0]; } %}
  | statement %comment %optionalWhitespaceAndMandatoryNewline  {% function(d) { return d[0]; } %}
  | statement %whitespace %comment %optionalWhitespaceAndMandatoryNewline  {% function(d) { return d[0]; } %}
  | %comment %optionalWhitespaceAndMandatoryNewline  {% function(d) { return []; } %}

statement ->
    %scopeOrArrayStart  {% function(d) { return { type: "scopeStart" }; } %}
  | %scopeOrArrayEnd  {% function(d) { return { type: "scopeEnd" }; } %}
  | variableDefinition  {% function(d) { return d[0]; } %}
  | variableAddition  {% function(d) { return d[0]; } %}

@{%

// Creates a range from tokenStart's location (inclusive) to tokenEnd's location (exclusive).
// tokenStart and tokenEnd must be lexer tokens.
function createRange(tokenStart: any, tokenEnd: any) {
    return {
        start: {
            line: tokenStart.line - 1,
            character: tokenStart.col - 1
        },
        end: {
            line: tokenEnd.line - 1,
            character: tokenEnd.col - 1
        }
    };
}

%}

lhsWithOperator[OPERATOR] ->
    %variableReferenceCurrentScope %variableName                     $OPERATOR  {% ([scope, variable,        operator]) => { return { name: variable.value, scope: "current", range: createRange(scope, operator) }; } %}
  | %variableReferenceCurrentScope %variableName whitespaceOrNewline $OPERATOR  {% ([scope, variable, space, operator]) => { return { name: variable.value, scope: "current", range: createRange(scope, space)    }; } %}
  | %variableReferenceParentScope  %variableName                     $OPERATOR  {% ([scope, variable,        operator]) => { return { name: variable.value, scope: "parent",  range: createRange(scope, operator) }; } %}
  | %variableReferenceParentScope  %variableName whitespaceOrNewline $OPERATOR  {% ([scope, variable, space, operator]) => { return { name: variable.value, scope: "parent",  range: createRange(scope, space)    }; } %}

variableDefinition ->
    lhsWithOperator[%operatorAssignment] optionalWhitespaceOrNewline rhs  {% ([lhs, space, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}

variableAddition ->
    lhsWithOperator[%operatorAddition]   optionalWhitespaceOrNewline rhs  {% ([lhs, space, rhs]) => { return { type: "variableAddition",   lhs: lhs, rhs: rhs }; } %}

rhs ->
    %integer  {% function(d) { return d[0].value; } %}
  | bool  {% function(d) { return d[0]; } %}
  # evaluatedVariable is in stringExpression and not rhs in order to remove ambiguity
  | stringExpression  {% function(d) { return d[0]; } %}
  | array  {% function(d) { return d[0]; } %}

@{%

function createEvaluatedVariable(varName: any, scope: ("current" | "parent")) {
    return {
        type: "evaluatedVariable",
        scope: scope,
        name: varName.value,
        range: {
            start: {
                line: varName.line - 1,
                character: varName.col - 2,
            },
            end: {
                line: varName.line - 1,
                // TODO: determine the end. See the known issue in README.md.
                character: 10000,
            }
        }
    };
}

%}

evaluatedVariable ->
    %variableReferenceCurrentScope %variableName  {% ([_, varName]) => [ createEvaluatedVariable(varName, "current") ] %}
  | %variableReferenceParentScope  %variableName  {% ([_, varName]) => [ createEvaluatedVariable(varName, "parent") ] %}

bool ->
    "true"  {% function(d) { return true; } %}
  | "false"  {% function(d) { return false; } %}

@{%

interface EvaluatedVariable {
    type: "evaluatedVariable";
}

%}

# Generates string | evaluatedVariable | (string | evaluatedVariable)[]
# Merges string literals.
# e.g. ['hello', ' world'] becomes 'hello world'
# e.g. [evaluatedVariable] becomes evaluatedVariable
# e.g. ['hello', ' world', evaluatedVariable] becomes ['hello world', evaluatedVariable]
stringExpression -> stringExpressionHelper  {% ([parts]) => {
    let joinedParts: (string | EvaluatedVariable)[] = [];
    let previousPartIsStringLiteral: boolean = false;
    for (const part of parts) {
        const isStringLiteral: boolean = (typeof part == "string");
        if (isStringLiteral && previousPartIsStringLiteral) {
          joinedParts[joinedParts.length - 1] += part;
        } else {
          joinedParts.push(part);
        }
        
        previousPartIsStringLiteral = isStringLiteral;
    }

    if (joinedParts.length == 0) {
        return '';
    } else if (joinedParts.length == 1) {
        if ((typeof joinedParts[0] == "string") ||
            (joinedParts[0].type == "evaluatedVariable"))
        {
            return joinedParts[0];
        }
    }

    return {
        type: 'stringExpression',
        parts: joinedParts,
    };
} %}

# Generates an array of either string or evaluatedVariables: (string | evaluatedVariable)[]
stringExpressionHelper ->
    # Single string
    stringOrEvaluatedVariable  {% function(d) { return d[0]; } %}
    # Multiple strings added together
  | stringOrEvaluatedVariable optionalWhitespaceOrNewline %operatorAddition optionalWhitespaceOrNewline stringExpressionHelper  {% ([lhs, space1, operator, space2, rhs]) => { return [...lhs, ...rhs]; } %}

stringOrEvaluatedVariable ->
    string             {% function(d) { return d[0]; } %}
  | evaluatedVariable  {% function(d) { return d[0]; } %}

string ->
    %singleQuotedStringStart stringContents %stringEnd  {% ([quoteStart, content, quoteEnd]) => content %}
  | %doubleQuotedStringStart stringContents %stringEnd  {% ([quoteStart, content, quoteEnd]) => content %}

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

array -> %scopeOrArrayStart arrayContents %scopeOrArrayEnd  {% ([braceOpen, contents, braceClose]) => contents %}

arrayContents ->
    # Empty
    null                 {% () => [] %}
  | whitespaceOrNewline  {% () => [] %}
  | nonEmptyArrayContents  {% ([contents]) => contents %}

nonEmptyArrayContents ->
    # Single item
    optionalWhitespaceOrNewline rhs optionalWhitespaceOrNewline  {% ([space1, content, space2]) => [content] %}
    # Multiple items
  | optionalWhitespaceOrNewline rhs optionalWhitespaceOrNewline %arrayItemSeparator nonEmptyArrayContents  {% ([space1, first, space2, separator, rest]) => [first, ...rest] %}

whitespaceOrNewline ->
    %whitespace                             {% ([space]) => space %}
  | %optionalWhitespaceAndMandatoryNewline  {% ([space]) => space %}

optionalWhitespaceOrNewline ->
    null                 {% () => null %}
  | whitespaceOrNewline  {% () => null %}

