@{%
const moo = require('moo');

const lexer = moo.states({
	main: {
		whitespace: /[ \t]+/,
		newline: { match: '\n', lineBreaks: true },
		comment: /(?:;|\/\/).*/,
		scopeStart: '{',
		scopeEnd: '}',
		integer: /0|[1-9][0-9]*/,
		singleQuotedStringStart: { match: "'", push: 'singleQuotedStringBody' },
		doubleQuotedStringStart: { match: '"', push: 'doubleQuotedStringBody' },
		variableName: /[a-zA-Z][a-zA-Z0-9]*/,
		variableReferenceCurrentScope: '.',
		variableReferenceParentScope: '^',
		assignment: '=',
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
		variableName: /[a-zA-Z][a-zA-Z0-9]*/,
	}
});
%}

# Pass your lexer object using the @lexer option:
@lexer lexer

@preprocessor typescript

main -> lines  {% function(d) { return d[0]; } %}

lines ->
    null  {% function(d) { return []; } %}
  | [\s] lines  {% function(d) { return d[1]; } %}
  | statementAndOrComment  {% function(d) { return d.flat(); } %}
  | statementAndOrComment newlineBeforeStatementAndOrComment  {% function(d) { return [d[0]].concat(d[1]).flat(); } %}

newlineBeforeStatementAndOrComment ->
    %whitespace
  | "\n" lines  {% function(d) { return d[1]; } %}

statementAndOrComment ->
    statement _  {% function(d) { return d[0]; } %}
  | comment  {% function(d) { return []; } %}
  | statement _ comment  {% function(d) { return d[0]; } %}

statement ->
    %scopeStart  {% function(d) { return { type: "scopeStart" }; } %}
  | %scopeEnd  {% function(d) { return { type: "scopeEnd" }; } %}
  | variableDefinition  {% function(d) { return d[0]; } %}

comment ->
    "//" [^\n]:*
  | ";" [^\n]:*

variableDefinition -> lvalue _ "=" _ rvalue  {% ([lhs, space1, equalsSign, space2, rhs]) => { return { type: "variableDefinition", lhs: lhs, rhs: rhs }; } %}

lvalue ->
    "." identifier  {% function(d) { return { name: d[1], scope: "current" }; } %}
  | "^" identifier  {% function(d) { return { name: d[1], scope: "parent" }; } %}

rvalue ->
    int  {% function(d) { return d[0]; } %}
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
  
int -> [0-9]:+  {% function(d) { return parseInt(d[0].join("")); } %}

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

identifier -> [a-zA-Z0-9]:+  {% function(d) { return d[0].join(""); } %}

# Whitespace
_ -> [ \t]:*  {% function(d) { return null; } %}