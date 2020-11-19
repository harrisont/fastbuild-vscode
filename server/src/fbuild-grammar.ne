@{%
const moo = require('moo');

const lexer = moo.states({
    main: {
        whitespace: /[ \t]+/,
        optionalWhitespaceAndMandatoryNewline: { match: /[ \t\n]*\n[ \t\n]*/, lineBreaks: true },
        comment: /(?:;|\/\/).*/,
        scopeStart: '{',
        scopeEnd: '}',
        integer: { match: /0|[1-9][0-9]*/, value: (s: string) => parseInt(s) },
        singleQuotedStringStart: { match: "'", push: 'singleQuotedStringBody' },
        doubleQuotedStringStart: { match: '"', push: 'doubleQuotedStringBody' },
        variableName: /[a-zA-Z_][a-zA-Z0-9_]*/,
        variableReferenceCurrentScope: '.',
        variableReferenceParentScope: '^',
        operatorAssignment: '=',
        operatorAddition: '+',
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
  | %optionalWhitespaceAndMandatoryNewline lines  {% function(d) { return d[1]; } %}
  | %whitespace lines  {% function(d) { return d[1]; } %}
  | statementAndOrComment lines  {% function(d) { return d.flat(); } %}

statementAndOrComment ->
    statement %optionalWhitespaceAndMandatoryNewline  {% function(d) { return d[0]; } %}
  | statement %comment %optionalWhitespaceAndMandatoryNewline  {% function(d) { return d[0]; } %}
  | statement %whitespace %comment %optionalWhitespaceAndMandatoryNewline  {% function(d) { return d[0]; } %}
  | %comment %optionalWhitespaceAndMandatoryNewline  {% function(d) { return []; } %}

statement ->
    %scopeStart  {% function(d) { return { type: "scopeStart" }; } %}
  | %scopeEnd  {% function(d) { return { type: "scopeEnd" }; } %}
  | variableDefinition  {% function(d) { return d[0]; } %}
  | variableAddition  {% function(d) { return d[0]; } %}

variableDefinition ->
    # No whitespace/newlines.
    lhs %operatorAssignment rhs                                                                                {% ([lhs, operator, rhs]) =>                 { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
    # Whitespace/newlines left of the operator.
  | lhs %whitespace %operatorAssignment rhs                                                                    {% ([lhs, space1, operator, rhs]) =>         { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
  | lhs %optionalWhitespaceAndMandatoryNewline %operatorAssignment rhs                                         {% ([lhs, space1, operator, rhs]) =>         { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
    # Whitespace/newlines right of the operator.
  | lhs %operatorAssignment %whitespace rhs                                                                    {% ([lhs, operator, space2, rhs]) =>         { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
  | lhs %operatorAssignment %optionalWhitespaceAndMandatoryNewline rhs                                         {% ([lhs, operator, space2, rhs]) =>         { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
    # Whitespace/newlines left and right of the operator.
  | lhs %whitespace %operatorAssignment %whitespace rhs                                                        {% ([lhs, space1, operator, space2, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
  | lhs %optionalWhitespaceAndMandatoryNewline %operatorAssignment %whitespace rhs                             {% ([lhs, space1, operator, space2, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
  | lhs %whitespace %operatorAssignment %optionalWhitespaceAndMandatoryNewline rhs                             {% ([lhs, space1, operator, space2, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
  | lhs %optionalWhitespaceAndMandatoryNewline %operatorAssignment %optionalWhitespaceAndMandatoryNewline rhs  {% ([lhs, space1, operator, space2, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}

variableAddition ->
    # No whitespace/newlines.
    lhs %operatorAddition rhs                                                                                {% ([lhs, operator, rhs]) =>                 { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
    # Whitespace/newlines left of the operator.
  | lhs %whitespace %operatorAddition rhs                                                                    {% ([lhs, space1, operator, rhs]) =>         { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
  | lhs %optionalWhitespaceAndMandatoryNewline %operatorAddition rhs                                         {% ([lhs, space1, operator, rhs]) =>         { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
    # Whitespace/newlines right of the operator.
  | lhs %operatorAddition %whitespace rhs                                                                    {% ([lhs, operator, space2, rhs]) =>         { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
  | lhs %operatorAddition %optionalWhitespaceAndMandatoryNewline rhs                                         {% ([lhs, operator, space2, rhs]) =>         { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
    # Whitespace/newlines left and right of the operator.
  | lhs %whitespace %operatorAddition %whitespace rhs                                                        {% ([lhs, space1, operator, space2, rhs]) => { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
  | lhs %optionalWhitespaceAndMandatoryNewline %operatorAddition %whitespace rhs                             {% ([lhs, space1, operator, space2, rhs]) => { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
  | lhs %whitespace %operatorAddition %optionalWhitespaceAndMandatoryNewline rhs                             {% ([lhs, space1, operator, space2, rhs]) => { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
  | lhs %optionalWhitespaceAndMandatoryNewline %operatorAddition %optionalWhitespaceAndMandatoryNewline rhs  {% ([lhs, space1, operator, space2, rhs]) => { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}

lhs ->
    "." %variableName  {% function(d) { return { name: d[1].value, scope: "current" }; } %}
  | "^" %variableName  {% function(d) { return { name: d[1].value, scope: "parent" }; } %}

rhs ->
    %integer  {% function(d) { return d[0].value; } %}
  | bool  {% function(d) { return d[0]; } %}
  | stringExpression  {% function(d) { return d[0]; } %}
  | "." %variableName  {% ([_, varName]) => {
        return [
            {
                type: "evaluatedVariable",
                name: varName.value,
                line: varName.line - 1,
                // Include the "." character.
                characterStart: varName.col - 2,
                // TODO: determine the end. See the known issue in README.md.
                characterEnd: 10000,
            }
        ];
    } %}

bool ->
    "true"  {% function(d) { return true; } %}
  | "false"  {% function(d) { return false; } %}

stringExpression ->
    # Single string
    string                                                                                                                   {% function(d) { return d[0]; } %}
    # Multiple strings added together. No whitespace/newlines.
  | string %operatorAddition stringExpression                                                                                {% ([lhs, operator, rhs]) =>                 { return lhs + rhs; } %}
    # Multiple strings added together. Whitespace/newlines left of the operator.
  | string %whitespace %operatorAddition stringExpression                                                                    {% ([lhs, space1, operator, rhs]) =>         { return lhs + rhs; } %}
  | string %optionalWhitespaceAndMandatoryNewline %operatorAddition stringExpression                                         {% ([lhs, space1, operator, rhs]) =>         { return lhs + rhs; } %}
    # Multiple strings added together. Whitespace/newlines right of the operator.
  | string %operatorAddition %whitespace stringExpression                                                                    {% ([lhs, operator, space2, rhs]) =>         { return lhs + rhs; } %}
  | string %operatorAddition %optionalWhitespaceAndMandatoryNewline stringExpression                                         {% ([lhs, operator, space2, rhs]) =>         { return lhs + rhs; } %}
    # Multiple strings added together. Whitespace/newlines left and right of the operator.
  | string  %whitespace %operatorAddition  %whitespace stringExpression                                                      {% ([lhs, space1, operator, space2, rhs]) => { return lhs + rhs; } %}
  | string %optionalWhitespaceAndMandatoryNewline %operatorAddition  %whitespace stringExpression                            {% ([lhs, space1, operator, space2, rhs]) => { return lhs + rhs; } %}
  | string  %whitespace %operatorAddition %optionalWhitespaceAndMandatoryNewline stringExpression                            {% ([lhs, space1, operator, space2, rhs]) => { return lhs + rhs; } %}
  | string %optionalWhitespaceAndMandatoryNewline %operatorAddition %optionalWhitespaceAndMandatoryNewline stringExpression  {% ([lhs, space1, operator, space2, rhs]) => { return lhs + rhs; } %}

string ->
    %singleQuotedStringStart stringContents %stringEnd  {% ([quoteStart, content, quoteEnd]) => (content.length == 1) ? content[0] : content %}
  | %doubleQuotedStringStart stringContents %stringEnd  {% ([quoteStart, content, quoteEnd]) => (content.length == 1) ? content[0] : content %}

stringContents ->
    null
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
            name: varName.value,
            line: varName.line - 1,
            // Include the start and end "$" characters.
            characterStart: startVarIndicator.col - 1,
            characterEnd: endVarIndicator.col,
        };
        if (rest.length > 0) {
            return [evaluatedVariable, ...rest];
        } else {
            return [evaluatedVariable];
        }
    } %}
