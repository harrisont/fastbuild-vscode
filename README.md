# FASTBuild Language Server and Visual Studio Code Client Extension

Contains a language server and Visual Studio Code client for the [FASTBuild](https://www.fastbuild.org/) language.

* [Functionality](#functionality)
  * ["Go to Definition" and "Go to References"](#go-to-definition-and-go-to-references)
  * [Hover to see variable value](#hover-to-see-variable-value)
  * [Show errors](#show-errors)
  * [Go to symbol in editor or workspace](#go-to-symbol-in-editor-or-workspace)
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

![Demo - go to definition and references](https://user-images.githubusercontent.com/144260/229382457-e15236ef-a0d6-4815-9f5c-6763d346399f.gif)

### Hover to see variable value

Hover over a variable to show a tooltip with its evaulated value. For example, the `Message` or `Location` variables in `.Message = 'Hello $Location$'`. If a variable is evaluated multiple times, like from a `ForEach` loop, it will show the deduplicated values.

![Demo - hover variables](https://user-images.githubusercontent.com/144260/229382487-fedbe466-5e2f-449c-b184-8b38f97fec48.gif)

### Show errors

See errors on the fly as you write the code, before running FASTBuild.

![Demo - show errors](https://user-images.githubusercontent.com/144260/229382494-3a876079-c905-4db0-babb-2b5a19f1195b.gif)

### Go to symbol in editor or workspace

![Demo - go to symbol in editor and workspace](https://user-images.githubusercontent.com/144260/229382499-005885f7-5834-4796-bc27-3ff577d88a7e.gif)

## Limitations

* The extension does not yet provide syntax highlighting. For that in the meantime, I recommend the FASTBuild (`roscop.fastbuild`) extension ([extension website](https://marketplace.visualstudio.com/items?itemName=RoscoP.fastbuild)).
* Only evaluates code if it is called at least once. This means, for example, that you cannot jump to the definition of a variable defined inside a user function if that user function is never called.

## Compatibility

Compatible with [FASTBuild](https://www.fastbuild.org/) version 1.08 ([FASTBuild Changelog](https://www.fastbuild.org/docs/changelog.html)).

It may be compatible with a newer version of FASTBuild, but this was the latest version tested.

## Installing

Install the extension from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=HarrisonT.fastbuild-support).

## Contributing

Contributions welcome! See the [contribution guide](CONTRIBUTING.md) for details.
