# FASTBuild Language Server and VS Code Client

Contains a language server and Visual Studio Code client for the [FASTBuild](https://www.fastbuild.org/) language.

This provides the following functionality:
* Hover over an evaluated variable (e.g. `.Message = 'Hello $Location$`, `.MyVarCopy = .MyVar`).
    * Known issue: when the RHS is another variable directly, and not a string template (e.g. `.MyVarCopy = .MyVar`), the hover extends to the end of the line instead of ending at the end of the RHS. For example, in the case of `.MyVarCopy = .MyVar  // Comment`, the hover includes the comment. The hover stil shows the correct value.

## Compatibility

Compatible with [FASTBuild](https://www.fastbuild.org/) version 1.02.

Note that much of the language is not yet implemented. See [TODO](#todo) for details.

## Running

1. Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder.
2. Open VS Code on this folder.
3. Run the `compile` task, which compiles the client and server. Alternatively, run the `watch-compile` task to watch for changes and automatically compile.
4. Run the `Launch Client` launch configuration. If you want to debug the server as well, use `Launch Client + Server` instead.

## Testing

* Run the `test` task. Alternatively, run the `watch-test` task to watch for changes and automatically run tests.
* Debug the tests by running the `Run Tests` launch configuration.

## Implementation Notes

* Parses using [Nearley](https://nearley.js.org/), which lexes using [moo](https://github.com/no-context/moo).
    * [Nearley Parser Playground](https://omrelli.ug/nearley-playground/)
	* Example: [Moo.js Tokenizer with Nearley.js](https://www.youtube.com/watch?v=GP91_duEmk8)
* VS Code language server extension resources:
    * [VS Code Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
	* [How to create a language server and VS Code extension](https://github.com/donaldpipowitch/how-to-create-a-language-server-and-vscode-extension)
	* [Language Server Protocol: A Language Server For DOT With Visual Studio Code](https://tomassetti.me/language-server-dot-visual-studio/)
* Other resources:
    * [RegExr](https://regexr.com/) regex playgound

## TODO

* Support arrays of arrays.
* Support structs ([docs](https://www.fastbuild.org/docs/syntaxguide.html#structs)).
* Support dynamic variable names ([docs](https://www.fastbuild.org/docs/syntaxguide.html#dynamic_construction)).
* Support `#include` ([docs](https://www.fastbuild.org/docs/syntaxguide.html#include)).
* Support [functions](https://www.fastbuild.org/docs/functions.html):
    * `ForEach` ([docs](https://www.fastbuild.org/docs/functions/foreach.html))
    * `Using` ([docs](https://www.fastbuild.org/docs/functions/using.html))
    * `If` ([docs](https://www.fastbuild.org/docs/functions/if.html))
* Support the `_CURRENT_BFF_DIR_` built in variable ([docs](https://www.fastbuild.org/docs/syntaxguide.html#builtin)).
* Support the `_WORKING_DIR_` built in variable ([docs](https://www.fastbuild.org/docs/syntaxguide.html#builtin)).
* Support `#if` / `#else` / `#endif` ([docs](https://www.fastbuild.org/docs/syntaxguide.html#if)).
* Support `#define` / `#undef` ([docs](https://www.fastbuild.org/docs/syntaxguide.html#define)).
* Fix bug where the hover extends to the end of the line when the RHS is another variable directly, and not a string template (e.g. `.MyVarCopy = .MyVar // Comment`). See `TODO: determine the end` in `server/src/fbuild-grammar.ne`.