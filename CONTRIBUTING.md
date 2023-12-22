# How to contribute changes

* [Steps to make a change](#steps-to-make-a-change)
* [Build and run/debug the extension](#build-and-rundebug-the-extension)
* [Run/debug Tests](#rundebug-tests)
* [Code architecture](#code-architecture)
  * [Terminology](#terminology)
  * [Architecture diagram](#architecture-diagram)
* [VS Code language server extension resources](#vs-code-language-server-extension-resources)

## Steps to make a change

1. [Build and run/debug the extension](#build-and-rundebug-the-extension).
2. Make your change, including:
    1. The change itself.
    2. A [test](server/src/test), if appropriate.
    3. Update the `version` in [package.json](package.json).
    4. Update [CHANGELOG.md](CHANGELOG.md) with the release notes for the new version.
3. [Run/debug tests](#rundebug-tests).
4. Submit a [pull request](https://github.com/harrisont/fastbuild-vscode/pulls) with the change for review.
5. Once the PR is accepted, create a new release, using a new release tag for the new version. Include the release notes from [CHANGELOG.md](CHANGELOG.md). This will automatically publish the extension to the VS Code Marketplace via the GitHub Action.

## Build and run/debug the extension

1. Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder.
2. Open VS Code on this folder.
3. Run the `build` task, which builds the client and server. Alternatively, run the `watch-build` task to watch for changes and automatically build.
4. Run the `Launch Client` launch configuration. If you want to debug the server as well, use `Launch Client + Server` instead.

## Run/debug Tests

* Run the `test` task. Alternatively, run the `watch-test` task to watch for changes and automatically run tests.
* Debug the tests by running the `Run Tests` launch configuration.

## Code architecture

### Terminology

* **Parse**:  Convert a FASTBuild (`.bff`) file's text contents into tokens and metadata about those tokens, which can include sub-tokens. A syntax error will cause parsing to fail, but a logical error (e.g. referencing an undefined variable) will not. Note that the [FASTBuild source code](https://github.com/fastbuild/fastbuild) calls this "tokenize" instead of "parse".
* **Evaluate**: Run each parsed statement, skipping steps that change external machine state (for example running the executable in `Exec`, building the DLL from `DLL`, etc.). This includes maintaining state for variables/defines/etc., looping through `ForEach`s' statements, branching on `If`/`#if`, `#include`ing other files, etc.  Note that the [FASTBuild source code](https://github.com/fastbuild/fastbuild) calls this "parse" instead of "evaluate".

### Architecture diagram

```mermaid
flowchart TB
    RawGrammar["Raw grammar (fbuild-grammar.ne)"] -->|1. Nearley compiler produces| CompiledGrammar[fbuild-grammar.ts]
    subgraph Extension
        LanguageClient["Language client (extension.ts)"] <-->|"2. File changed (Language Server Protocol)"| FileUpdate[[updateFile]]
        subgraph LanguageServer["Language server (server.ts)"]
            FileUpdate -->|3. Parse| ParseDataProvider[parseDataProvider.ts]
            ParseDataProvider -->|4. Read file| FileContentProvider["fileContentProvider (fileSystem.ts)"]
            FileContentProvider -->|5. Cache| FileCache[(File cache)]
            ParseDataProvider -->|6. Parse| Parser[parser.ts]
            Parser -->|7. Parse| CompiledGrammar
            ParseDataProvider -->|8. Cache| ParseCache[(Parse cache)]
            FileUpdate -->|9. Evaluate parsed data| Evaluator[evaluator.ts]
            Evaluator -->|"10. Parse and evaluate (for #include)"| ParseDataProvider
            FileUpdate -->|11. Cache| EvaluatedDataCache[(Evaluated data cache)]

            subgraph FeatureProviders[Feature providers]
                HoverProvider
                DefinitionProvider
                ReferenceProvider
                DiagnosticProvider
            end
            FeatureProviders --> EvaluatedDataCache

            FileUpdate -->|12. Update diagnostics| DiagnosticProvider
        end
        LanguageClient <-->|13. Other Language Server Protocol messages| FeatureProviders
    end

    style Extension fill:#555
    style LanguageServer fill:#444
    style FeatureProviders fill:#333
```

1. The [Nearley](https://nearley.js.org/) parser generator compiles [fbuild-grammar.ne](server/src/fbuild-grammar.ne) into `fbuild-grammar.ts`. This compiled grammer is used later to parse `.bff` files. The parsing lexes using [Moo](https://github.com/no-context/moo).
   * [Nearley Parser Playground](https://omrelli.ug/nearley-playground/)
   * Example: [Moo.js Tokenizer with Nearley.js](https://www.youtube.com/watch?v=GP91_duEmk8)
2. The extension has a language [server](server/src/server.ts) and [client](client/src/extension.ts). They communicate using the Language Server Protocol. The [client](client/src/extension.ts) sends the server a message that a file has changed.
3. The [server](server/src/server.ts) parses the file using [ParseDataProvider](server/src/parseDataProvider.ts).
4. [ParseDataProvider](server/src/parseDataProvider.ts) reads the file using the `fileContentProvider`, ...
5. ... which caches the file contents, to avoid re-reading files that have not changed.
6. [ParseDataProvider](server/src/parseDataProvider.ts) parses the file using [parser.ts](server/src/parser.ts), ...
7. ... which parses it using the compiled `fbuild-grammar.ts` from step 0.
8. [ParseDataProvider](server/src/parseDataProvider.ts) caches the parse data, to avoid re-parsing files that have not changed.
9. The [server](server/src/server.ts) evaluates the parsed data using [evaluator.ts](server/src/evaluator.ts).
10. Evaluating the parsed data parses and evaluates any `#import`ed files.
11. The [server](server/src/server.ts) caches the evaluated data, so that it can use it for future operations.
12. The [server](server/src/server.ts) updates the diagnostics (e.g. errors) based on the evaluation.
13. The [client](client/src/extension.ts) asks the [server](server/src/server.ts) for additional information (e.g. definitions, hover data, etc.), which the server provides using its [feature providers](server/src/features/).

## VS Code language server extension resources

* [VS Code Language Server Extension Guide](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
* [How to create a language server and VS Code extension](https://github.com/donaldpipowitch/how-to-create-a-language-server-and-vscode-extension)
* [Language Server Protocol: A Language Server For DOT With Visual Studio Code](https://tomassetti.me/language-server-dot-visual-studio/)

## Visual Studio Code Marketplace extension administration

The [Visual Studio Code Marketplace extension admin page](https://marketplace.visualstudio.com/manage/publishers/harrisont/extensions/fastbuild-support/hub?_a=acquisition) contains:
* Conversion (installation) funnel telemetry
* Ratings and reviews
