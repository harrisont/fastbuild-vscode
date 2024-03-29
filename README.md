# FASTBuild Language Server and Visual Studio Code Client Extension

Contains a language server and Visual Studio Code client for the [FASTBuild](https://www.fastbuild.org/) language.

* [Functionality](#functionality)
  * ["Go to Definition" and "Go to References"](#go-to-definition-and-go-to-references)
  * [Hover to see variable value](#hover-to-see-variable-value)
  * [Show errors](#show-errors)
  * [Go to symbol in editor or workspace](#go-to-symbol-in-editor-or-workspace)
  * [Syntax highlighting](#syntax-highlighting)
  * [Function property auto-completion and documentation](#function-property-auto-completion-and-documentation)
  * [Variable auto-completion](#variable-auto-completion)
* [Limitations](#limitations)
* [Compatibility](#compatibility)
* [Installing](#installing)
* [Contributing](#contributing)

## Functionality

### "Go to Definition" and "Go to References"

"Go to Definition" and "Go to References" supports:
* Variables
* `#import`s
* `#define`s
* `#include`s

![Demo - go to definition and references](https://user-images.githubusercontent.com/144260/229382457-e15236ef-a0d6-4815-9f5c-6763d346399f.gif)

### Hover to see variable value

Hover over a variable to show a tooltip with its evaluated value. For example, the `Message` or `Location` variables in `.Message = 'Hello $Location$'`. If a variable is evaluated multiple times, like from a `ForEach` loop, it will show the deduplicated values.

![Demo - hover variables](https://user-images.githubusercontent.com/144260/229382487-fedbe466-5e2f-449c-b184-8b38f97fec48.gif)

### Show errors

See errors on the fly as you write the code, before running FASTBuild.

![Demo - show errors](https://user-images.githubusercontent.com/144260/229382494-3a876079-c905-4db0-babb-2b5a19f1195b.gif)

### Go to symbol in editor or workspace

![Demo - go to symbol in editor and workspace](https://user-images.githubusercontent.com/144260/229382499-005885f7-5834-4796-bc27-3ff577d88a7e.gif)

### Syntax highlighting

FASTBuild files are easier to read with syntax highlighting.

### Function property auto-completion and documentation

Example:
![Demo - function property auto-completion and documentation](https://github.com/harrisont/fastbuild-vscode/assets/144260/fb0ccd56-5b12-41f5-9b29-4ca7f34027ee)

### Variable auto-completion

Example: ![Demo - variable auto-completion](https://github.com/harrisont/fastbuild-vscode/assets/144260/971aa929-34d0-4de3-a635-f777e86cc33d)

## Limitations

* Only evaluates code if it is called at least once. This means, for example, that you cannot jump to the definition of a variable defined inside a [user function](https://www.fastbuild.org/docs/syntaxguide.html#userfunctions) if that user function is never called.
* Variable auto-completion inside of [user functions](https://www.fastbuild.org/docs/syntaxguide.html#userfunctions) only works for the function parameters, and not other variables defined inside the function.

## Compatibility

Compatible with [FASTBuild](https://www.fastbuild.org/) version 1.11 ([FASTBuild Changelog](https://www.fastbuild.org/docs/changelog.html)).

It may be compatible with a newer version of FASTBuild, but this was the latest version tested.

## Installing

Install the extension from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=HarrisonT.fastbuild-support).

## Contributing

Contributions welcome! See the [contribution guide](CONTRIBUTING.md) for details.
