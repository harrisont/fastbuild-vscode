@preprocessor typescript

main -> lines  {% function(d) { return d[0]; } %}

lines ->
    null  {% function(d) { return []; } %}
  | [\s] lines  {% function(d) { return d[1]; } %}
  | statementAndOrComment
  | statementAndOrComment newlineBeforeStatementAndOrComment  {% function(d) { return [d[0]].concat(d[1]); } %}

newlineBeforeStatementAndOrComment ->
    [ \t]:+
  | "\n" lines  {% function(d) { return d[1]; } %}

statementAndOrComment ->
    statement _  {% function(d) { return d[0]; } %}
  | comment  {% function(d) { return null; } %}
  | statement _ comment  {% function(d) { return d[0]; } %}

statement ->
    variableDefinition  {% function(d) { return d[0]; } %}

comment ->
    "//" [^\n]:*
  | ";" [^\n]:*

variableDefinition -> variable _ "=" _ rvalue  {% function(d) { return { type: "variableDefinition", lhs: d[0], rhs: d[4] }; } %}

rvalue ->
    int  {% function(d) { return d[0]; } %}
  | bool  {% function(d) { return d[0]; } %}
  | string  {% function(d) { return d[0]; } %}
  | variable  {% function(d) { return d[0]; } %}
  
int -> [0-9]:+  {% function(d) { return parseInt(d[0].join("")); } %}

bool ->
    "true"  {% function(d) { return true; } %}
  | "false"  {% function(d) { return false; } %}

string ->
    "'" singleQuotedStringContents "'"  {% function(d) { return d[1]; } %}
  | "\"" doubleQuotedStringContents "\""  {% function(d) { return d[1]; } %}
  
singleQuotedStringContents ->
    singleQuotedStringContentsLiteral  {% function(d) { return d[0]; } %}
  | singleQuotedStringContentsLiteral (evaluatedVariable singleQuotedStringContentsLiteral):+
  
doubleQuotedStringContents ->
    doubleQuotedStringContentsLiteral  {% function(d) { return d[0]; } %}
  | (doubleQuotedStringContentsLiteral evaluatedVariable doubleQuotedStringContentsLiteral):+

singleQuotedStringContentsLiteral -> [^'$]:*  {% function(d) { return d[0].join(""); } %}
doubleQuotedStringContentsLiteral -> [^"$]:*  {% function(d) { return d[0].join(""); } %}

evaluatedVariable -> "$" identifier "$"  {% function(d) { return { type: "evaluatedVariable", variable: d[1] }; } %}
  
variable ->
    "." identifier  {% function(d) { return { name: d[1], scope: "current" }; } %}
  | "^" identifier  {% function(d) { return { name: d[1], scope: "parent" }; } %}

identifier -> [a-zA-Z0-9]:+  {% function(d) { return d[0].join(""); } %}

# Whitespace
_ -> [ \t]:*  {% function(d) { return null; } %}