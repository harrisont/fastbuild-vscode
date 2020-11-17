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
		stringLiteral: /[^'\$\n]+/,
	},
	doubleQuotedStringBody: {
		startTemplatedVariable: { match: '$', push: 'templatedVariable' },
		stringEnd: { match: '"', pop: 1 },
		stringLiteral: /[^"\$\n]+/,
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
    lvalue %operatorAssignment rvalue  {% ([lhs, equalsSign, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %whitespace %operatorAssignment rvalue  {% ([lhs, equalsSign, space2, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %optionalWhitespaceAndMandatoryNewline %operatorAssignment rvalue  {% ([lhs, equalsSign, space2, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %operatorAssignment %whitespace rvalue  {% ([lhs, space1, equalsSign, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %operatorAssignment %optionalWhitespaceAndMandatoryNewline rvalue  {% ([lhs, space1, equalsSign, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %whitespace %operatorAssignment %whitespace rvalue  {% ([lhs, space1, equalsSign, space2, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %optionalWhitespaceAndMandatoryNewline %operatorAssignment %whitespace rvalue  {% ([lhs, space1, equalsSign, space2, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %whitespace %operatorAssignment %optionalWhitespaceAndMandatoryNewline rvalue  {% ([lhs, space1, equalsSign, space2, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %optionalWhitespaceAndMandatoryNewline %operatorAssignment %optionalWhitespaceAndMandatoryNewline rvalue  {% ([lhs, space1, equalsSign, space2, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}

variableAddition ->
    lvalue %operatorAddition rvalue  {% ([lhs, equalsSign, rhs]) => { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %whitespace %operatorAddition rvalue  {% ([lhs, equalsSign, space2, rhs]) => { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %optionalWhitespaceAndMandatoryNewline %operatorAddition rvalue  {% ([lhs, equalsSign, space2, rhs]) => { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %operatorAddition %whitespace rvalue  {% ([lhs, space1, equalsSign, rhs]) => { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %operatorAddition %optionalWhitespaceAndMandatoryNewline rvalue  {% ([lhs, space1, equalsSign, rhs]) => { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %whitespace %operatorAddition %whitespace rvalue  {% ([lhs, space1, equalsSign, space2, rhs]) => { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %optionalWhitespaceAndMandatoryNewline %operatorAddition %whitespace rvalue  {% ([lhs, space1, equalsSign, space2, rhs]) => { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %whitespace %operatorAddition %optionalWhitespaceAndMandatoryNewline rvalue  {% ([lhs, space1, equalsSign, space2, rhs]) => { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}
  | lvalue %optionalWhitespaceAndMandatoryNewline %operatorAddition %optionalWhitespaceAndMandatoryNewline rvalue  {% ([lhs, space1, equalsSign, space2, rhs]) => { return { type: "variableAddition", lhs: lhs, rhs: rhs }; } %}

lvalue ->
    "." %variableName  {% function(d) { return { name: d[1].value, scope: "current" }; } %}
  | "^" %variableName  {% function(d) { return { name: d[1].value, scope: "parent" }; } %}

rvalue ->
    %integer  {% function(d) { return d[0].value; } %}
  | bool  {% function(d) { return d[0]; } %}
  | string  {% function(d) { return d[0]; } %}
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

string ->
    %singleQuotedStringStart stringContents %stringEnd  {% ([quoteStart, content, quoteEnd]) => (content.length == 1) ? content[0] : content %}
  | %doubleQuotedStringStart stringContents %stringEnd  {% ([quoteStart, content, quoteEnd]) => (content.length == 1) ? content[0] : content %}

stringContents ->
    null
    # String literal
  | %stringLiteral stringContents  {% ([literal, rest]) => (rest.length > 0) ? [literal.value, ...rest] : [literal.value] %}
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
