@{%
const moo = require('moo');

const lexer = moo.states({
	main: {
		whitespace: /[ \t]+/,
		newline: { match: '\n', lineBreaks: true },
		comment: /(?:;|\/\/).*/,
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
    [ \t]:+
  | "\n" lines  {% function(d) { return d[1]; } %}

statementAndOrComment ->
    statement _  {% function(d) { return d[0]; } %}
  | comment  {% function(d) { return []; } %}
  | statement _ comment  {% function(d) { return d[0]; } %}

statement ->
    variableDefinition  {% function(d) { return d[0]; } %}

comment ->
    "//" [^\n]:*
  | ";" [^\n]:*

variableDefinition -> lvalue _ "=" _ rvalue  {% function(d) { return { type: "variableDefinition", lhs: d[0], rhs: d[4] }; } %}

lvalue ->
    "." identifier  {% function(d) { return { name: d[1], scope: "current" }; } %}
  | "^" identifier  {% function(d) { return { name: d[1], scope: "parent" }; } %}

rvalue ->
    int  {% function(d) { return d[0]; } %}
  | bool  {% function(d) { return d[0]; } %}
  | string  {% function(d) { return d[0]; } %}
  |  "." identifier  {% function(d) { return { name: d[1] }; } %}
  
int -> [0-9]:+  {% function(d) { return parseInt(d[0].join("")); } %}

bool ->
    "true"  {% function(d) { return true; } %}
  | "false"  {% function(d) { return false; } %}

string ->
    "'" singleQuotedStringContents "'"  {% function(d) { return d[1]; } %}
  | "\"" doubleQuotedStringContents "\""  {% function(d) { return d[1]; } %}
  
singleQuotedStringContents ->
    singleQuotedStringContentsLiteral  {% function(d) { return d[0]; } %}
  | singleQuotedStringContentsLiteral (evaluatedVariable singleQuotedStringContentsLiteral):+  {% function(d) { return { type: "stringTemplate", parts: [d[0]].concat(d[1].flat()) }; } %}
  
doubleQuotedStringContents ->
    doubleQuotedStringContentsLiteral  {% function(d) { return d[0]; } %}
  | doubleQuotedStringContentsLiteral (evaluatedVariable doubleQuotedStringContentsLiteral):+  {% function(d) { return { type: "stringTemplate", parts: [d[0]].concat(d[1].flat()) }; } %}

singleQuotedStringContentsLiteral -> [^'$]:*  {% function(d) { return d[0].join(""); } %}
doubleQuotedStringContentsLiteral -> [^"$]:*  {% function(d) { return d[0].join(""); } %}

evaluatedVariable -> "$" identifier "$"  {% function(d) { return { type: "evaluatedVariable", name: d[1] }; } %}

identifier -> [a-zA-Z0-9]:+  {% function(d) { return d[0].join(""); } %}

# Whitespace
_ -> [ \t]:*  {% function(d) { return null; } %}