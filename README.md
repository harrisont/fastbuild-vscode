# FASTBuild Language Server and VS Code Client

Contains a language server and Visual Studio Code client for the [FASTBuild](https://www.fastbuild.org/) language.

This provides the following functionality:
* Go to definition of a variable.
* Find references of a variable.
* Hover over an evaluated variable to show a tooltip with its evaulated value (e.g. the evaluation `Location` variable in `.Message = 'Hello $Location$` or `.Message = .Location`).

It does not yet provide syntax highlighting. For that, I recommend the FASTBuild (`roscop.fastbuild`) extension ([extension website](https://marketplace.visualstudio.com/items?itemName=RoscoP.fastbuild)).

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
    * [RegEx101](https://regex101.com/): regex playgound

## TODO

Support full FASTBuild syntax:
* Support the `_CURRENT_BFF_DIR_` built in variable ([docs](https://www.fastbuild.org/docs/syntaxguide.html#builtin)).
* Support the `_WORKING_DIR_` built in variable ([docs](https://www.fastbuild.org/docs/syntaxguide.html#builtin)).
* Support `#define` / `#undef` ([docs](https://www.fastbuild.org/docs/syntaxguide.html#define)) and `#if` / `#else` / `#endif` ([docs](https://www.fastbuild.org/docs/syntaxguide.html#if)).
* Support `#once` ([docs](https://www.fastbuild.org/docs/syntaxguide.html#once)).
* Support the `_FASTBUILD_VERSION_STRING_` and `_FASTBUILD_VERSION_` built in variables ([docs](https://www.fastbuild.org/docs/syntaxguide.html#builtin)).

Add more language server provider features:
* Support listing document symbols, including alias names ([docs](https://code.visualstudio.com/api/language-extensions/programmatic-language-features#show-all-symbol-definitions-within-a-document)).
* Support "go to definition" and "find references" for aliases.
* Speed up evaluation by evaluating incrementally instead of re-evaluating everything any time any file changes.
* Support `ForEach` iterating over multiple arrays at a time (single array iterating already supported) ([docs](https://www.fastbuild.org/docs/functions/foreach.html)). This is low priority, since I have never seen it used.
* Support variable subtraction ([docs](https://www.fastbuild.org/docs/syntaxguide.html#modification)). This is low priority, since I have never seen it used.
