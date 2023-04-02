# FASTBuild Language Server and Visual Studio Code Client Extension

Contains a language server and Visual Studio Code client for the [FASTBuild](https://www.fastbuild.org/) language.

  * [Functionality](#functionality)
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

https://user-images.githubusercontent.com/144260/229334359-cfbb1eec-2291-4b4e-9a7f-d7f77be325ce.mov

### Hover to see variable value

Hover over a variable to show a tooltip with its evaulated value. For example, the `Message` or `Location` variables in `.Message = 'Hello $Location$'`. If a variable is evaluated multiple times, like from a `ForEach` loop, it will show all the values.

https://user-images.githubusercontent.com/144260/229336491-30efa831-0a2c-4208-8916-fc6a30ddc4b9.mov

### Show errors

See errors on the fly as you write the code, before running FASTBuild.

TODO: video

### Go to symbol in editor or workspace

TODO: video

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
