@preprocessor typescript

main ->
    newlines  {% function(d) { return []; } %}
  | newlines statementAndOrComments newlines  {% function(d) { return d[1]; } %}
  
statementAndOrComments -> statementAndOrComment (newline statementAndOrComment):*  {% function(d) { return d.flat(); } %}

#.filter((v,i) => i%2 === 0)
statementAndOrComment ->
    _ statement _  {% function(d) { return d[1]; } %}
  | _ comment  {% function(d) { return null; } %}
  | _ statement _ comment  {% function(d) { return d[1]; } %}

statement ->
    variableDefinition

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
    "." identifier  {% function(d) { return { type: "variable", name: d[1], scope: "current" }; } %}
  | "^" identifier  {% function(d) { return { type: "variable", name: d[1], scope: "parent" }; } %}

identifier -> [a-zA-Z0-9]:+  {% function(d) { return d[0].join(""); } %}

# Whitespace
_ -> [\s]:*     {% function(d) { return null; } %}

# Newlines
newline -> "\n"  {% function(d) { return { type: "newline" }; } %}
newlines -> newline:*  {% function(d) { return { type: "newlines" }; } %}