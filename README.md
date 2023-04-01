# FASTBuild Language Server and Visual Studio Code Client Extension

Contains a language server and Visual Studio Code client for the [FASTBuild](https://www.fastbuild.org/) language.

  * [Functionality](#functionality)
  * [Limitations](#limitations)
  * [Compatibility](#compatibility)
  * [Installing](#installing)
  * [Contributing](#contributing)

## Functionality

This provides the following functionality:
* "Go to definition" and "Find references" for:
    * Variables
    * `#import`s
    * `#define`s
* Hover over a variable to show a tooltip with its evaulated value (e.g. the evaluated `Location` variable in `.Message = 'Hello $Location$'` or `.Message = .Location`).
* See errors on the fly as you write the code, before running FASTBuild.
* Go to symbol in editor or workspace.

It does not yet provide syntax highlighting. For that in the meantime, I recommend the FASTBuild (`roscop.fastbuild`) extension ([extension website](https://marketplace.visualstudio.com/items?itemName=RoscoP.fastbuild)).

## Limitations

* Only evaluates code if it is called at least once. This means, for example, that you cannot jump to the definition of a variable defined inside a user function if that user function is never called.

## Compatibility

Compatible with [FASTBuild](https://www.fastbuild.org/) version 1.08 ([FASTBuild Changelog](https://www.fastbuild.org/docs/changelog.html)).

It may be compatible with a newer version of FASTBuild, but this was the latest version tested.

## Installing

Install the extension from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=HarrisonT.fastbuild-support).

## Contributing

Contributions welcome! See the [contribution guide](CONTRIBUTING.md) for details.
