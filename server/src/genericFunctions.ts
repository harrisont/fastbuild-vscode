export enum ValueType {
    Boolean,
    Integer,
    String,
    Struct,
    ArrayOfStrings,
    ArrayOfStructs,
}

interface PropertyAttributes {
    isRequired: boolean;
    defaultDescription: string;

    // Can have more then one value, for properties that can take multiple types.
    // For example, some properties can either be a string or an array-of-strings.
    types: Set<ValueType>;

    documentation: string;
}

type PropertyName = string;

interface GenericFunctionMetadata {
    documentationUrl: string;
    properties: Map<PropertyName, PropertyAttributes>;
}

export const GENERIC_FUNCTION_METADATA_BY_NAME = new Map<PropertyName, GenericFunctionMetadata>([
    [ 'Alias', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/alias.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Targets', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `One or more targets must be provided, either as a string or an array of strings. Targets can be previously
defined nodes, or files external to the build process.

Example:
\`\`\`FASTBuild
.Targets = { 'Library-Alias'                         // A previously defined Alias()
        'tmp/Libraries/X64/Release/Core.dll'    // A previously defined DLL()
        'External/SDK/VS2012/libs/libcmt.lib' } // An external DLL import library
\`\`\``,
            }],
            ['Hidden', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Hide a target from -showtargets`,
            }]
        ]),
    }],
    [ 'Compiler', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/compiler.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Executable', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `The primary compiler executable that will be invoked by FASTBuild when this Compiler() is used.`,
            }],
            ['ExtraFiles', {
                isRequired: false,
                defaultDescription: '{}',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Additional files (usually dlls) required by the compiler.

For distributed compilation, the specified files will also be synchronized to the remote machine. The relative location of the source files controls how they will be mirrored on the remote machine. Files in 'ExtraFiles' in the same directory or in sub-directories under the primary 'Executable' will be placed in the same relative location on the remote machine. 'ExtraFiles' in other folders will be placed at the same level as the executable.

\`\`\`FASTBuild
// Path behaviour example
Compiler( 'Test' )
{
  .Executable	= 'C:\\compiler\\compiler.exe'       // dest: compiler.exe
  .ExtraFiles = { 'C:\\compiler\\subdir\\helper.dll'  // dest: subdir/helper.exe
                  'C:\\cruntime\\mvscrt.dll'         // dest: msvcrt.dll
}
\`\`\``,
            }],
            ['CompilerFamily', {
                isRequired: false,
                defaultDescription: '"auto"',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Explicitly specify compiler type

By default, FASTBuild will detect the compiler type based on the executable name. The .CompilerFamily property allows you to explicitly control the compiler type instead. This can be useful for:
* custom variants of compilers with unique naming
* custom exeutables used as compilers

The following values are supported:

| Value | Notes                                                       |
|:------|:------------------------------------------------------------|
| auto  | **(default)** Auto detect compiler based on executable path |

| Value            | Notes                              |
|:-----------------|:-----------------------------------|
| msvc             | Microsoft and compatible compilers |
| clang            | Clang and compatible compilers     |
| clang-cl         | Clang in MSVC cl-compatible mode   |
| gcc              | GCC and compatible compilers       |
| snc              | SNC and compatible compilers       |
| codewarrior-wii  | CodeWarrior compiler for the Wii   |
| greenhills-wiiu  | GreenHills compiler for the Wii U  |
| cuda-nvcc        | NVIDIA's CUDA compiler             |
| qt-rcc           | Qt's resource compiler             |
| vbcc             | vbcc compiler                      |
| orbis-wave-psslc | orbis wave psslc shader compiler   |
| csharp           | C# compiler                        |

| Value  | Notes                                                                                                                                                                                                                   |
|:-------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| custom | Any custom compiler. NOTE: Only primary input and output dependencies will be tracked. No additional dependencies will be tracked as FASTBuild has no way to extract dependency information from arbitrary executables. |`,
            }],
            ['AllowDistribution', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `For compilers where distributed compilation is supported, said feature can be disabled.`,
            }],
            ['ExecutableRootPath', {
                isRequired: false,
                defaultDescription: 'no override',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Override default path for executable distribution

When a compiler is distributed the .Compiler and .ExtraFiles hierarchy is replicated on the remote machine as documented above (see .ExtraFiles). The base path for this replication can be overriden by setting the .ExectuableRootPath property, allowing more flexibility in how the file hierarchy is replicated on the remote host.`,
            }],
            ['SimpleDistributionMode', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Allow distribution of otherwise unsupported "compilers"

FASTbuild supports distributed compilation for certain compilers that it explicitly understands how to interact with in order to obtain dependency information (in addition to the simple primary input file). By setting .SimpleDistributionMode, FASTBuild can be told that the single file input of a "compiler" is the only dependency and thus can be safely used with distributed compilation. This allows distribution of custom tools or other useful work like texture conversion.`,
            }],
            ['CustomEnvironmentVariables', {
                isRequired: false,
                defaultDescription: '{}',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Environment variables to set on remote host

When compiling on a remote host, a clean environment is used. If needed, environment variables can be set.`,
            }],
            ['AllowResponseFile', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Allow response files to be used if not auto-detected

Allow the use of Response Files for passing arguments to the compiler when they exceed operating system limits.

FASTBuild automatically detects that some compilers can use Response Files and uses them accordingly. For situations that FASTBuild doesn't auto-detect (such as custom compilers), AllowResponseFile can be set manually.`,
            }],
            ['ForceResponseFile', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Force use of response files

Force the use of Response Files for passing arguments to the compiler.

FASTBuild uses Response Files to pass command line arguments to Compilers that support them only when needed (length exceeds operating system limits). This is to limit the overhead of Response File creation to situations that require it.

Use of Response Files in all cases can be forced with .ForceResponseFile if required.`,
            }],
            ['ClangRewriteIncludes', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Use Clang's -frewrite-includes option when preprocessing

FASTBuild uses the -E preprocessor option when compiling with Clang to preprocess the source code. In order to improve consistency between this preprocessed source and the original source, FASTBuild also uses the -frewrite-includes option by default. An example of this improved consistency is that compiler errors originating from macros will have the caret point to the correct column location of the source code instead of the column location where the error would be in the expanded macro.

If for some reason the use of -frewrite-includes is not desirable, it can be disabled by setting .ClangRewriteIncludes to false as follows:

\`\`\`FASTBuild
.ClangRewriteIncludes = false
\`\`\``,
            }],
            ['ClangGCCUpdateXLanguageArg', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Update -x language arg for second pass of compilation

FASTBuild uses the -E preprocessor option combined with -frewrite-includes when preprocessing source with Clang to preserve debug information. If the -x language arg is specified explicitly by the user on the command line (for example "-x c++"), this is only correct for the first pass.

FASTBuild can update this arg ("-x c++" -> "-x c++-cpp-output" for example) but older versions of Clang (prior to 10) will ignore define (-D) options on the command line when this is set, breaking compilation when -frewrite-includes is used).

To maintain backwards compatibility, this option is disabled by default and must be explicitly enabled if desired.`,
            }],
            ['VS2012EnumBugFix', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Enable work-around for bug in VS2012 compiler

NOTE: This option incurs a minor build time cost that impacts compile times.

A bug exists in the Visual Studio 2012 compiler whereby enums in preprocessed code are sometimes incorrectly processed when they lie on specific buffer alignment boundaries. This bug is fixed in Visual Studio 2013 and later.

If a manual work around (described below) is impractical or undesirable, the .VS2012EnumBugFix option can be enabled to work around the problem at build time.

When the bug occurs, the following code:
\`\`\`C
enum dateorder
{
    no_order, dmy, mdy, ymd, ydm
};
\`\`\`

May be incorrectly pre-processed as:
\`\`\`C
enummdateorder
{
    no_order, dmy, mdy, ymd, ydm
};
\`\`\`

This results in very unintuitive compile errors.

This bug can be avoided by inserting additional whitespace into the enum declaration as follows:
\`\`\`C
enum  dateorder
{
    no_order, dmy, mdy, ymd, ydm
};
\`\`\`

This work-around may be impractical if a large number of enums are affected, or if the enum(s) originate in system headers or external code. In those cases the .VS2012EnumBugFix option can be enabled to insert the additional whitespace at build-time.`,
            }],
            ['Environment', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Environment variables to use for local build

When set, overrides the environment for local compiles

This allows you to have a different environment per compiler`,
            }],
            ['UseLightCache_Experimental', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Enable experimental "light" caching mode

When set, activates "Light Caching" mode. Light Caching mode avoids using the compiler's preprocessor for cache lookups, instead allowing FASTBuild to parse the files itself to gather the required information. This parsing is significantly faster than for each file and additionally allows FASTBuild to eliminate redundant file parsing between object files, further accelerating cache lookups.

NOTE: This feature should be used with caution. While there are no known issues (it self disables when known to not work - see other notes) it should be considered experimental.

NOTE: For now, Light Caching can only be used with the MSVC compiler. Support will be extended to other compilers in future versions.

NOTE: Light Caching does not support macros using for include paths (i.e. "#include MY_INCLUDE_HEADER") Support for this will be added in future versions.`,
            }],
            ['UseRelativePaths_Experimental', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Enable experimental relative path use

Use relative paths where possible. This is an experiment to lay a possible foundation for path-independent caching.

NOTE: This feature is incomplete and should not be used.`,
            }],
            ['SourceMapping_Experimental', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Use Clang's -fdebug-source-map option to remap source files

Provides a new root to remap source file paths to so they are recorded in the debugging information as if they were stored under the new root. For example, if $_WORKING_DIR_$ is "/path/to/original", a source file "src/main.cpp" would normally be recorded as being stored under "/path/to/original/src/main.cpp", but with .SourceMapping_Experimental='/another/root' it would be recorded as "/another/root/src/main.cpp" instead.

While the same effect could be achieved by passing "-fdebug-prefix-map=$_WORKING_DIR_$=/another/root" to the compiler via .CompilerOptions, doing so prevents caching from working across machines that use different root paths because the cache keys would not match.

Source mapping can help make builds more reproducible, and also improve the debugging experience by making it easier for the debugger to find source files when debugging a binary built on another machine. See the [GCC documentation for -fdebug-prefix-map](https://gcc.gnu.org/onlinedocs/gcc/Debugging-Options.html) for more information.

NOTE: This feature currently only works on Clang 3.8+ and GCC.

NOTE: Paths expanded from the __FILE__ macro are not remapped because that requires Clang 10+ and GCC 8+ (-fmacro-debug-map).

NOTE: Only one mapping can be provided, and the source directory for the mapping is always $_WORKING_DIR_$.

NOTE: This option currently inhibits dsitributed compilation. This will be resolved in a future release.`,
            }],
            ['ClangFixupUnity_Disable', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Disable preprocessor fixup for Unity files

When compiling Unity files with Clang, FASTBuild will modify the preprocessed output so that the files included by the Unity are considered to be the top level file(s), instead of the Unity file. This makes Clang's warning behavior (particularly for static analysis) consistent between Unity and non-Unity compilation.

This temporary option disables this behavior and is provided as a safety mechanism in case there are unforeseen problems with this feature. This toggle is expected to be removed in v1.01.`,
            }],
        ]),
    }],
    [ 'Copy', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/copy.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Source', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `File(s) to copy

One or more files to be copied.

Example:
\`\`\`FASTBuild
.Source      = 'folder/file.ext'
\`\`\`
Or:
\`\`\`FASTBuild
.Source      = { 'folder/file.a', 'folder/file.b' }
\`\`\``,
            }],
            ['Dest', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Destination (path or filename)

Destination for copy:
\`\`\`FASTBuild
.Dest = 'out/'
\`\`\`
If a single .Source file is specified, the .Dest can specify the destination filename:
\`\`\`FASTBuild
.Dest = 'out/renamedFile.ext'
\`\`\``,
            }],
            ['SourceBasePath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Base directory to copy partial relative hierarchy

Source path to consider as root for copy. Sub-directory structure relative to this path will be replicated during copy.

Example:
\`\`\`FASTBuild
.Source         = { 'in/folderA/fileA.ext'
                    'in/folderA/subDir/fileB.ext' }
.SourceBasePath = 'in/'
.Dest           = 'out/'
\`\`\`
Will result in the following output structure:
\`\`\`text
out/folderA/fileA.ext
out/folderA/subDir/fileB.ext
\`\`\`
Without .SourceBasePath, the copy result would be:
\`\`\`text
out/fileA.ext
out/fileB.ext
\`\`\``,
            }],
            ['PreBuildDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Force targets to be built before this Copy (Rarely needed, but useful when Copy relies on externally generated files).

One or more nodes which must be built before this node is built.

The .PreBuildDependencies option ensures the specified targets are up-to-date before the Copy() is executed. This is necessary in situations where multiple files are generated as part of a single build step. Failure to specify these dependencies in this way could allow the Copy() operation to be performed before the source files are updated/generated. This will result in unreliable builds (wrong or missing files) or even build failure (copy attempted while source file is still being written/updated).

Example:
\`\`\`FASTBuild
.Source               = { 'generated/scripts/program.exe'
                          'generated/scripts/program.pdb' }
.Dest                 = 'bin/'

.PreBuildDependencies = 'Compile'   // Make sure exe completes (so pdb is written before copy)
                                    // (assuming this is a previously defined target)
\`\`\`

For single file targets previously defined in the build, or for files which are present before the build starts (i.e. always on disk, or generated by some process external to the build) this option is unnecessary.`,
            }],
        ]),
    }],
    [ 'CopyDir', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/copydir.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['SourcePaths', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Directories to copy

One or more source paths can be provided, either as a string or an array of strings. The contents of each source path will be scanned for files. Recursion can be controlled (.SourcePathsRecurse) and the source files can be filtered using a wildcard pattern (.SourcePathsPattern).

Example:
\`\`\`FASTBuild
.SourcePaths = 'folder\\'
\`\`\`
Or:
\`\`\`FASTBuild
.SourcePaths = { 'folderA\\', 'folderB\\' }
\`\`\``,
            }],
            ['Dest', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Destination path

All files discovered in the .SourcePaths (subject to recursion and filtering options) will be copied to the .Dest path. The folder structure relative to the source path(s) will be re-created in the .Dest path.

Example:
\`\`\`FASTBuild
.Dest = 'out'
\`\`\``,
            }],
            ['SourcePathsPattern', {
                isRequired: false,
                defaultDescription: '"*"',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Wildcard pattern(s) to filter source files

One or more wildcard patterns can be specified to filter the files to be copied. The default pattern is '*'.

Example:
\`\`\`FASTBuild
.SourcePathsPattern = '*.dll' // Copy only dll files
\`\`\`

Example:
\`\`\`FASTBuild
.SourcePathsPattern = { '*.dll', '*.pdb' } // Copy dll and pdb files
\`\`\``,
            }],
            ['SourcePathsRecurse', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Recurse into source sub-directories?

File discovery in the .SourcePaths is recursive by default. This option can be enabled or disabled explicitly.

Example:
\`\`\`FASTBuild
.SourcePathsRecurse = false // disable recursion
\`\`\``,
            }],
            ['SourceExcludePaths', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Source directories to ignore when recursing

An optional list of source directories to ignore during the CopyDir() operation.

Example:
\`\`\`FASTBuild
.SourcePaths        = 'files\\'
.SourceExcludePaths = 'files\\badfiles\\' // don't copy this sub-dir
\`\`\``,
            }],
            ['PreBuildDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Force targets to be built before this CopyDir (Only needed when other nodes output files to be copied)

One or more nodes which must be built before this node is built.

The .PreBuildDependencies option ensures the specified targets are up-to-date before the CopyDir() is executed. This is necessary in situations where files are generated as part of the build. Failure to specify these dependencies in this way could allow the CopyDir() operation to be performed before the source files are updated/generated. This will result in unreliable builds (wrong or missing files) or even build failure (copy attempted while source file is still being written/updated).

Example:
\`\`\`FASTBuild
.SourcePaths          = 'generated\\scripts\\'
.Dest                 = 'out\\scripts\\'
.PreBuildDependencies = 'GenerateScriptFiles' // Make sure scripts are generated before copy
                                              // (assuming this is a previously defined target)
\`\`\`

For files which are present before the build starts (i.e. always on disk, or generated by some process external to the build) this option is unnecessary.`,
            }],
        ]),
    }],
    [ 'CSAssembly', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/csassembly.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Compiler', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Path to the C# compiler`,
            }],
            ['CompilerOptions', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Options to pass to the compiler`,
            }],
            ['CompilerOutput', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Output file to be generated`,
            }],
            ['CompilerInputPath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Path to include files from`,
            }],
            ['CompilerInputPathRecurse', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Whether to recurse into sub-dirs`,
            }],
            ['CompilerInputPattern', {
                isRequired: false,
                defaultDescription: '"*.cs"',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Pattern(s) of input files`,
            }],
            ['CompilerInputFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Explicit list of files to compile`,
            }],
            ['CompilerInputExcludePath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Path(s) to exclude from compilation`,
            }],
            ['CompilerInputExcludedFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `File(s) to exclude from compilation (partial, root-relative of full path)`,
            }],
            ['CompilerInputExcludePattern', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Pattern(s) to exclude from compilation`,
            }],
            ['CompilerReferences', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `References for the assembly`,
            }],
            ['PreBuildDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Force targets to be built before this assembly (Rarely needed, but useful when an assembly relies on generated code).`,
            }],
        ]),
    }],
    [ 'DLL', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/dll.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Linker', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Linker executable to use`,
            }],
            ['LinkerOutput', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Output from linker`,
            }],
            ['LinkerOptions', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Options to pass to linker`,
            }],
            ['Libraries', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Libraries to link into DLL`,
            }],
            ['Libraries2', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Secondary libraries to link into executable`,
            }],
            ['LinkerLinkObjects', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Link objects used to make libs instead of libs`,
            }],
            ['LinkerAssemblyResources', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `List of assembly resources to use with %3`,
            }],
            ['LinkerStampExe', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Executable to run post-link to "stamp" executable in-place`,
            }],
            ['LinkerStampExeArgs', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Arguments to pass to LinkerStampExe`,
            }],
            ['LinkerType', {
                isRequired: false,
                defaultDescription: '"auto"',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Specify the linker type. Valid options include: auto, msvc, gcc, snc-ps3, clang-orbis, greenhills-exlr, codewarrior-ld

Default is 'auto' (use the linker executable name to detect)`,
            }],
            ['LinkerAllowResponseFile', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Allow response files to be used if not auto-detected`,
            }],
            ['LinkerForceResponseFile', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Force use of response files`,
            }],
            ['PreBuildDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Force targets to be built before this DLL (Rarely needed, but useful when DLL relies on externally generated files).`,
            }],
            ['Environment', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Environment variables to use for local build

If set, linker uses this environment

If not set, linker uses .Environment from your Settings node`,
            }],
        ]),
    }],
    [ 'Exec', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/exec.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['ExecExecutable', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Executable to run`,
            }],
            ['ExecOutput', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Output file generated by executable`,
            }],
            ['ExecInput', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Input file(s) to pass to executable`,
            }],
            ['ExecInputPath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Path to find files in`,
            }],
            ['ExecInputPattern', {
                isRequired: false,
                defaultDescription: '"*.*"',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Pattern(s) to use when finding files`,
            }],
            ['ExecInputPathRecurse', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Recurse into dirs when finding files`,
            }],
            ['ExecInputExcludePath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Path(s) to exclude`,
            }],
            ['ExecInputExcludedFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `File(s) to exclude from compilation (partial, root-relative of full path)`,
            }],
            ['ExecInputExcludePattern', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Pattern(s) to exclude`,
            }],
            ['ExecArguments', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Arguments to pass to executable`,
            }],
            ['ExecWorkingDir', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Working dir to set for executable`,
            }],
            ['ExecReturnCode', {
                isRequired: false,
                defaultDescription: '0',
                types: new Set<ValueType>([ValueType.Integer]),
                documentation: `Expected return code from executable`,
            }],
            ['ExecUseStdOutAsOutput', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Write the standard output from the executable to output file`,
            }],
            ['ExecAlways', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Run the executable even if inputs have not changed`,
            }],
            ['ExecAlwaysShowOutput', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Show the process output even if the step succeeds`,
            }],
            ['PreBuildDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Force targets to be built before this Exec (Rarely needed, but useful when Exec relies on externally generated files).`,
            }],

            ['Environment', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Environment variables used when running the executable

If not set, uses .Environment from your Settings node`,
            }],
        ]),
    }],
    [ 'Executable', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/executable.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Linker', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Linker executable to use`,
            }],
            ['LinkerOutput', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Output from linker`,
            }],
            ['LinkerOptions', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Options to pass to linker`,
            }],
            ['Libraries', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Libraries to link into executable`,
            }],
            ['Libraries2', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Secondary libraries to link into executable`,
            }],
            ['LinkerLinkObjects', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Link objects used to make libs instead of libs`,
            }],
            ['LinkerAssemblyResources', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `List of assembly resources to use with %3`,
            }],
            ['LinkerStampExe', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Executable to run post-link to "stamp" executable in-place`,
            }],
            ['LinkerStampExeArgs', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Arguments to pass to LinkerStampExe`,
            }],
            ['LinkerType', {
                isRequired: false,
                defaultDescription: '"auto"',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Specify the linker type. Valid options include: auto, msvc, gcc, snc-ps3, clang-orbis, greenhills-exlr, codewarrior-ld

Default is 'auto' (use the linker executable name to detect)`,
            }],
            ['LinkerAllowResponseFile', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Allow response files to be used if not auto-detected`,
            }],
            ['LinkerForceResponseFile', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Force use of response files`,
            }],
            ['PreBuildDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Force targets to be built before this Executable (Rarely needed, but useful when Executable relies on externally generated files).`,
            }],
            ['Environment', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Environment variables to use for local build

If set, linker uses this environment

If not set, linker uses .Environment from your Settings node`,
            }],
        ]),
    }],
    [ 'Library', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/library.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Compiler', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Compiler to use`,
            }],
            ['CompilerOptions', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Options for compiler`,
            }],
            ['Librarian', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Librarian to collect intermediate objects`,
            }],
            ['LibrarianOptions', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Options for librarian`,
            }],
            ['LibrarianOutput', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Output path for lib file`,
            }],
            ['CompilerOutputPath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Path to store intermediate objects`,
            }],
            ['CompilerOutputExtension', {
                isRequired: false,
                defaultDescription: '".obj" on Windows, ".o" otherwise',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Specify the file extension for generated objects`,
            }],
            ['CompilerOutputPrefix', {
                isRequired: false,
                defaultDescription: '""',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Specify a prefix for generated objects`,
            }],
            ['LibrarianType', {
                isRequired: false,
                defaultDescription: '"auto"',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Specify the librarian type. Valid options include: auto, msvc, ar, ar-orbis, greenhills-ax

Default is 'auto' (use the librarian executable name to detect)`,
            }],
            ['LibrarianAdditionalInputs', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Additional inputs to merge into library`,
            }],
            ['LibrarianAllowResponseFile', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Allow response files to be used if not auto-detected`,
            }],
            ['LibrarianForceResponseFile', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Force use of response files`,
            }],
            ['CompilerInputPath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Path to find files in`,
            }],
            ['CompilerInputPattern', {
                isRequired: false,
                defaultDescription: '"*.cpp"',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Pattern(s) to use when finding files`,
            }],
            ['CompilerInputPathRecurse', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Recurse into dirs when finding files`,
            }],
            ['CompilerInputExcludePath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Path(s) to exclude from compilation`,
            }],
            ['CompilerInputExcludedFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `File(s) to exclude from compilation (partial, root-relative of full path)`,
            }],
            ['CompilerInputExcludePattern', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Pattern(s) to exclude from compilation`,
            }],
            ['CompilerInputFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Explicit array of files to build`,
            }],
            ['CompilerInputFilesRoot', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Root path to use for .obj path generation for explicitly listed files`,
            }],
            ['CompilerInputUnity', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Unity to build (or Unities)`,
            }],
            ['CompilerInputAllowNoFiles', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Don't fail if no inputs are found`,
            }],
            ['CompilerInputObjectLists', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `ObjectList(s) whos output should be used as an input`,
            }],
            ['AllowCaching', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Allow caching of compiled objects if available`,
            }],
            ['AllowDistribution', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Allow distributed compilation if available`,
            }],
            ['Preprocessor', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Compiler to use for preprocessing`,
            }],
            ['PreprocessorOptions', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Args to pass to compiler if using custom preprocessor`,
            }],
            ['CompilerForceUsing', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `List of objects to be used with /FU`,
            }],
            ['PCHInputFile', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Precompiled header (.cpp) file to compile`,
            }],
            ['PCHOutputFile', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Precompiled header compilation output`,
            }],
            ['PCHOptions', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Options for compiler for precompiled header`,
            }],
            ['PreBuildDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Force targets to be built before this library (Rarely needed, but useful when a library relies on generated code).`,
            }],
            ['Environment', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Environment variables to use for local build

If set, librarian uses this environment

If not set, librarian uses .Environment from your Settings node`,
            }],
            ['Hidden', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Hide a target from -showtargets`,
            }],
        ]),
    }],
    [ 'ListDependencies', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/listdependencies.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Source', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Source target (filename or node name)`,
            }],
            ['Dest', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Destination filename where dependent files list will be exported`,
            }],
            ['SourcePattern', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `String, or array of strings, to filter exported dependencies`,
            }],
            ['PreBuildDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Force targets to be built before this ListDependencies (Rarely needed)`,
            }],
        ]),
    }],
    [ 'ObjectList', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/objectlist.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Compiler', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Compiler to use`,
            }],
            ['CompilerOptions', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Options for compiler`,
            }],
            ['CompilerOutputPath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Path to store intermediate objects`,
            }],
            ['CompilerOutputExtension', {
                isRequired: false,
                defaultDescription: '".obj" on Windows, ".o" otherwise',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Specify the file extension for generated objects`,
            }],
            ['CompilerOutputKeepBaseExtension', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Append extension instead of replacing it`,
            }],
            ['CompilerOutputPrefix', {
                isRequired: false,
                defaultDescription: '""',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Specify a prefix for generated objects`,
            }],
            ['CompilerInputPath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Path to find files in`,
            }],
            ['CompilerInputPattern', {
                isRequired: false,
                defaultDescription: '"*.cpp"',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Pattern(s) to use when finding files`,
            }],
            ['CompilerInputPathRecurse', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Recurse into dirs when finding files`,
            }],
            ['CompilerInputExcludePath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Path(s) to exclude from compilation`,
            }],
            ['CompilerInputExcludedFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `File(s) to exclude from compilation (partial, root-relative of full path)`,
            }],
            ['CompilerInputExcludePattern', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Pattern(s) to exclude from compilation`,
            }],
            ['CompilerInputFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Explicit array of files to build`,
            }],
            ['CompilerInputFilesRoot', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Root path to use for .obj path generation for explicitly listed files`,
            }],
            ['CompilerInputUnity', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Unity to build (or Unities)`,
            }],
            ['CompilerInputAllowNoFiles', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Don't fail if no inputs are found`,
            }],
            ['CompilerInputObjectLists', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `ObjectList(s) whos output should be used as an input`,
            }],
            ['AllowCaching', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Allow caching of compiled objects if available`,
            }],
            ['AllowDistribution', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Allow distributed compilation if available`,
            }],
            ['Preprocessor', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Compiler to use for preprocessing`,
            }],
            ['PreprocessorOptions', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Args to pass to compiler if using custom preprocessor`,
            }],
            ['CompilerForceUsing', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `List of objects to be used with /FU`,
            }],
            ['PCHInputFile', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Precompiled header (.cpp) file to compile`,
            }],
            ['PCHOutputFile', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Precompiled header compilation output`,
            }],
            ['PCHOptions', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Options for compiler for precompiled header`,
            }],
            ['PreBuildDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Force targets to be built before this ObjectList (Rarely needed, but useful when a ObjectList relies on generated code).`,
            }],
            ['Hidden', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Hide a target from -showtargets`,
            }],
        ]),
    }],
    [ 'RemoveDir', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/removedir.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['RemovePaths', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Directories to delete contents of

One or more paths can be provided, either as a string or an array of strings. Each path will be traversed and files within it deleted (subject to other settings).

Example:
\`\`\`FASTBuild
.RemovePaths = 'folder\\'
\`\`\`
Or:
\`\`\`FASTBuild
.RemovePaths = { 'folderA\\', 'folderB\\' }
\`\`\``,
            }],
            ['RemovePathsRecurse', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Recurse into sub-directories?

Directories are scanned recursively by default. Recursion can be disabled.

Example:
\`\`\`FASTBuild
.RemovePathsRecurse = false
\`\`\``,
            }],
            ['RemovePatterns', {
                isRequired: false,
                defaultDescription: '"*"',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Wildcards of contents to delete

All discovered files will be deleted by default. Deletion can be restricted to certain files or sub-directories by specifying .RemovePatterns wildcards.

Example:
\`\`\`FASTBuild
.RemovePatterns = '*.obj' // Delete all *.obj files
\`\`\`
Example:
\`\`\`FASTBuild
.RemovePatterns = { 'subdir/*.exe',  // Delete *.exe files in "subdir"
                    'subdir/*.pdb' } // Delete *.pdb files in "subdir"
\`\`\``,
            }],
            ['RemoveExcludePaths', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Directories to ignore if recursing

Specific sub-directories can be ignored during recursion.

Example:
\`\`\`FASTBuild
.RemoveExcludePaths = 'folderA/' // Ignore contents of folder
\`\`\`
Example:
\`\`\`FASTBuild
.RemoveExcludePaths = { 'folderA/',  // Ignore contents of "folderA"
                        'FolderB/' } // and "folderB"
\`\`\``,
            }],
            ['RemoveExcludeFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Files to ignore if recursing

Specific files can be ignored during recursion.

Example:
\`\`\`FASTBuild
.RemoveExcludeFiles = 'file.txt' // Ignore file.txt
\`\`\`
Example:
\`\`\`FASTBuild
.RemoveExcludeFiles = { 'fileA.txt',  // Ignore "fileA.txt"
                        'fileB.txt' } // and "fileB.txt"
\`\`\``,
            }],
            ['PreBuildDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Force targets to be built before this RemoveDir

One or more nodes which must be built before this node is built.

The .PreBuildDependencies option ensures the specified targets are up-to-date before the RemoveDir() is executed.

Example:
\`\`\`FASTBuild
.PreBuildDependencies = 'DoStuff' // A previously defined target
\`\`\``,
            }],
        ]),
    }],
    [ 'Test', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/test.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['TestExecutable', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `The executable file to run that will execute the tests

The executable file to run that will execute the tests.

Can either be a file path or the name of a target specified with the \`Executable\` function.`,
            }],
            ['TestOutput', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Output file for captured test output

When executing tests, FASTBuild will capture standard output channels of the executable and write them to this file when done.`,
            }],
            ['TestInput', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Input file(s) to pass to executable`,
            }],
            ['TestInputPath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Path to find files in`,
            }],
            ['TestInputPattern', {
                isRequired: false,
                defaultDescription: '"*.*"',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Pattern(s) to use when finding files`,
            }],
            ['TestInputPathRecurse', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Recurse into dirs when finding files`,
            }],
            ['TestInputExcludePath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Path(s) to exclude`,
            }],
            ['TestInputExcludedFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `File(s) to exclude from compilation (partial, root-relative of full path)`,
            }],
            ['TestInputExcludePattern', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Pattern(s) to exclude`,
            }],
            ['TestArguments', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Arguments to pass to test executable`,
            }],
            ['TestWorkingDir', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Working dir for test execution`,
            }],
            ['TestTimeOut', {
                isRequired: false,
                defaultDescription: '0',
                types: new Set<ValueType>([ValueType.Integer]),
                documentation: `TimeOut (in seconds) for test

The amount of time (in seconds) to wait for a test to finish execution.

The default is 0, which means there is no timeout and FASTBuild will wait until the executable terminates on its own.`,
            }],
            ['TestAlwaysShowOutput', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Show output of tests even when they don't fail

The output of a test is normally shown only when the test fails. This option specifies that the output should always be shown.`,
            }],
            ['PreBuildDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Force targets to be built before this Test (Rarely needed, but useful when Test relies on externally generated files).

One or more nodes which must be built before this test is executed.

The .PreBuildDependencies option ensures the specified targets are up-to-date before the Test() is executed.`,
            }],
            ['Environment', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Environment variables to use for local build

If set, linker uses this environment

If not set, linker uses .Environment from your Settings node

When set, overrides the environment for running a Test.

This allows you to have a different environment per Test if needed.`,
            }],
        ]),
    }],
    [ 'TextFile', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/textfile.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['TextFileOutput', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Output file to generate`,
            }],
            ['TextFileInputStrings', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Array of non-empty strings to be written to the output file, one per line.`,
            }],
            ['TextFileAlways', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Generate the file even if it already exists with the current contents.`,
            }],
            ['Hidden', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Hide a target from -showtargets`,
            }],
            ['PreBuildDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Force targets to be built before this TextFile (Rarely needed, but useful if the output would be deleted by an earlier step.)`,
            }],
        ]),
    }],
    [ 'Unity', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/unity.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['UnityOutputPath', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Path to output generated Unity files`,
            }],
            ['UnityInputPath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Path (or paths) to find files`,
            }],
            ['UnityInputExcludePath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Path (or paths) in which to ignore files`,
            }],
            ['UnityInputExcludePattern', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Wildcard pattern(s) of files/folders to exclude`,
            }],
            ['UnityInputPattern', {
                isRequired: false,
                defaultDescription: '"*.cpp"',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Pattern(s) of files to find`,
            }],
            ['UnityInputPathRecurse', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Recurse when searching for files`,
            }],
            ['UnityInputFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Explicit list of files to include`,
            }],
            ['UnityInputExcludedFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Explicit list of excluded files (partial, root-relative or full path)`,
            }],
            ['UnityInputIsolatedFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `List of files to exclude from unity, but still compile (partial end or root-relative)`,
            }],
            ['UnityInputObjectLists', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `ObjectList(s) to use as input`,
            }],
            ['UnityInputIsolateWritableFiles', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Build writable files individually`,
            }],
            ['UnityInputIsolateWritableFilesLimit', {
                isRequired: false,
                defaultDescription: '0',
                types: new Set<ValueType>([ValueType.Integer]),
                documentation: `Disable isolation when many files are writable`,
            }],
            ['UnityInputIsolateListFile', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Text file containing list of files to isolate`,
            }],
            ['UnityOutputPattern', {
                isRequired: false,
                defaultDescription: '"Unity*.cpp"',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Pattern of output Unity file names`,
            }],
            ['UnityNumFiles', {
                isRequired: false,
                defaultDescription: '1',
                types: new Set<ValueType>([ValueType.Integer]),
                documentation: `Number of Unity files to generate`,
            }],
            ['UnityPCH', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Precompiled Header file to add to generated Unity files`,
            }],
            ['PreBuildDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Force targets to be built before this Unity (Rarely needed, but useful when a Unity should contain generated code)`,
            }],
            ['Hidden', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Hide a target from -showtargets`,
            }],
            ['UseRelativePaths_Experimental', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Use relative paths for generated Unity files`,
            }],
        ]),
    }],
    [ 'VCXProject', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/vcxproject.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['ProjectOutput', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Filename of project file

The output location of the .vcxproj file.

Example:
\`\`\`FASTBuild
.ProjectOutput = 'tmp/VisualStudio/Library/Library.vcxproj'
\`\`\``,
            }],
            ['ProjectInputPaths', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Paths to include in project

Paths(s) to search for files to include in the project.

Example:
\`\`\`FASTBuild
.ProjectInputPaths  = 'Code/Library/'
\`\`\`

Example:
\`\`\`FASTBuild
.ProjectInputPaths  = {
                        'Code/Library/Folder1/'
                        'Code/Library/Folder2/'
                      }
\`\`\``,
            }],
            ['ProjectInputPathsExclude', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Paths to exclude from project

Path(s) to exclude when searching for files to include in the project.

Example:
\`\`\`FASTBuild
.ProjectInputPathsExclude   = 'Code/Library/SubDir/'
\`\`\`
Example:
\`\`\`FASTBuild
.ProjectInputPathsExclude   = {
                                'Code/Library/SubDir1/'
                                'Code/Library/SubDir2/'
                              }
\`\`\``,
            }],
            ['ProjectInputPathsRecurse', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Recurse into project input paths when finding files

Toggles whether to recurse into subdirectories of .ProjectInputPaths when finding files to add to the project.

Example:
\`\`\`FASTBuild
.ProjectInputPathsRecurse   = false
\`\`\``,
            }],
            ['ProjectPatternToExclude', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Pattern(s) for files to exclude from project

Example:
\`\`\`FASTBuild
.ProjectPatternToExclude   = '*/OSX/*'
\`\`\`
Example:
\`\`\`FASTBuild
.ProjectPatternToExclude   = {
                                '*/OSX/*'
                                '*/Linux/*'
                              }
\`\`\``,
            }],
            ['ProjectAllowedFileExtensions', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Extensions to allow in path searches

Filter for file type(s) to include in the project.

Example:
\`\`\`FASTBuild
.ProjectAllowedFileExtensions   = { '*.cpp', '*.h' }
\`\`\`
If not specified, the following filters will be used:
\`\`\`FASTBuild
.ProjectAllowedFileExtensions 	= {
                                  '*.cpp', '*.hpp', '*.cxx', '*.hxx', '*.c',   '*.h',  '*.cc',   '*.hh',
                                  '*.cp',  '*.hp',  '*.cs',  '*.inl', '*.bff', '*.rc', '*.resx', '*.m',  '*.mm',
                                  '*.cu',
                                  '*.asm', '*.s',
                                  '*.natvis', '*.editorconfig'
                              }
\`\`\``,
            }],
            ['ProjectFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `List of files to include in project

File(s) to explicitly include in the project.

Example:
\`\`\`FASTBuild
.ProjectFiles   = {
                    'Code/Library/SubDir/FileA.cpp'
                    'Code/Library/SubDir/FileA.h'
                  }
\`\`\``,
            }],
            ['ProjectFilesToExclude', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `List of files to exclude from project

Files to exclude from the project (filtered from files discovered via ProjectInputPaths).

Example:
\`\`\`FASTBuild
.ProjectFilesToExclude  = {
                            'Code/Library/SubDir/FileB.cpp'
                            'Code/Library/SubDir/FileB.h'
                          }
\`\`\``,
            }],
            ['ProjectBasePath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Base path(s) for root folder(s) in project

Path(s) to use as base for generation of folder hierarchy within project.

Example:
\`\`\`FASTBuild
.ProjectBasePath  = 'Code/Library/'
\`\`\``,
            }],
            ['ProjectFileTypes', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStructs]),
                documentation: `List of filters to override base file types (see below)

File types can be specified if needed, for example for WinForms header files.

Example:
\`\`\`FASTBuild
.ProjectFileType = [
  .FileType   = 'CppForm'
  .Pattern    = '*\\Forms\\*.h'
]

.ProjectFileTypes = { .ProjectFileType }
\`\`\``,
            }],
            ['ProjectConfigs', {
                isRequired: false,
                defaultDescription: 'Debug Win32, Release Win32, Debug X64, Release X64',
                types: new Set<ValueType>([ValueType.ArrayOfStructs]),
                documentation: `List of project configurations, see below for details.

A list of project configuration structures in the following format:

\`\`\`FASTBuild
.ProjectConfig =
[
  // Basic Options
  .Platform                       // Platform (e.g. Win32, X64, PS3 etc.)
  .Config                         // Config (e.g. Debug, Release etc.)
  .Target                         // (optional) Previously defined Build Target

  // Additional configuration options - see ProjectConfig section below
]
\`\`\`
Example:
\`\`\`FASTBuild
.DebugConfig      = [ .Platform = 'Win32' .Config = 'Debug' ]
.ReleaseConfig    = [ .Platform = 'Win32' .Config = 'Release' ]
.ProjectConfigs   = { .DebugConfig, .ReleaseConfig }
\`\`\`
If no configurations are specified, the following defaults will be used:
\`\`\`FASTBuild
.X86DebugConfig   = [ .Platform = 'Win32' .Config = 'Debug' ]
.X86ReleaseConfig = [ .Platform = 'Win32' .Config = 'Release' ]
.X64DebugConfig   = [ .Platform = 'X64'   .Config = 'Debug' ]
.X64ReleaseConfig = [ .Platform = 'X64'   .Config = 'Release' ]
.ProjectConfigs   = {
                        .X86DebugConfig, .X86ReleaseConfig, .X64DebugConfig, .X64ReleaseConfig
                    }
\`\`\`
The optional .Target option can be used to specify the associated compilation target. This will be used to automatically populate the Intellisense options for Intellisense.

Example:
\`\`\`FASTBuild
.Target = 'MyProject-X64-Debug'
\`\`\``,
            }],
            ['ProjectReferences', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `References to assemblies (e.g "System.Core")

References to assemblies can be specified. This may be necessary if mixing C#, Managed C++ and C++ projects.

Example:
\`\`\`FASTBuild
.ProjectReferences = 'System.Core'
\`\`\`
Example:
\`\`\`FASTBuild
.ProjectReferences = {
                       'System.Core'
                       'System.Text'
                     }
\`\`\``,
            }],
            ['ProjectProjectReferences', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `References to projects (e.g. "myproj.csproj|{guid}")

Add explicit references to projects not generated by FASTBuild. If your Visual Studio Solution mixes generated and manually created project files, you can set explicit references to them.

Example:
\`\`\`FASTBuild
.ProjectProjectReferences = 'myproj1.csproj|{7cf4dd72-ddb6-4e8d-bc26-ffceb8c415a5}'
\`\`\`
Example:
\`\`\`FASTBuild
.ProjectProjectReferences = {
                              'myproj1.csproj|{7cf4dd72-ddb6-4e8d-bc26-ffceb8c415a5}'
                              'myproj2.csproj|{ffceb8c4-bc26-4932-ddb6-ff7cf4dd72a5}'
                            }
\`\`\``,
            }],
            ['ProjectProjectImports', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStructs]),
                documentation: `Array of ProjectImports, see below for details

Additional .targets files can be imported into a Visual Studio project. This can be useful for better integration/debugging of non-native architectures.

Example:
\`\`\`FASTBuild
.ProjectImport          = [
                            .Condition = "'$(ConfigurationType)' == 'Makefile'"
                            .Project = "$(VCTargetsPath)\\Platforms\\$(Platform)\\Custom.Makefile.targets"
                          ]
.ProjectProjectImports  = { .ProjectImport }
\`\`\`
NOTE: By default, the following project imports are active.
\`\`\`FASTBuild
.ProjectImportPS4       = [
                            .Condition = "'$(ConfigurationType)' == 'Makefile' and Exists('$(VCTargetsPath)\\Platforms\\$(Platform)\\SCE.Makefile.$(Platform).targets')"
                            .Project = "$(VCTargetsPath)\\Platforms\\$(Platform)\\SCE.Makefile.$(Platform).targets"
                          ]
.ProjectImportAndroid   = [
                            .Condition = "'$(ConfigurationType)' == 'Makefile' and '$(AndroidAPILevel)' != '' and Exists('$(VCTargetsPath)\\Application Type\\$(ApplicationType)\\$(ApplicationTypeRevision)\\Android.Common.targets')"
                            .Project = "$(VCTargetsPath)\\Application Type\\$(ApplicationType)\\$(ApplicationTypeRevision)\\Android.Common.targets"
                          ]
.ProjectProjectImports  = { .ProjectImportPS4, .ProjectImportAndroid }
\`\`\``,
            }],
            ['ProjectGuid', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Override default generated ProjectGuid

By default, a Guid for a project will be generated automatically. If necessary, a Guid can be explicitly specified instead.

Example:
\`\`\`FASTBuild
.ProjectGuid = '{7cf4dd72-ddb6-4e8d-bc26-ffceb8c415a5}'
\`\`\``,
            }],
            ['DefaultLanguage', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Default Language Property (for XboxOne/WinRT)

Set the default language property. This may be necessary for XboxOne and WinRT applications.

Example:
\`\`\`FASTBuild
.DefaultLanguage = 'en-US'
\`\`\``,
            }],
            ['ApplicationEnvironment', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Application Environment (for XboxOne/WinRT)

Set the application environment property. This may be necessary for XboxOne and WinRT applications.

Example:
\`\`\`FASTBuild
.ApplicationEnvironment = 'title'
\`\`\``,
            }],
            ['ProjectSccEntrySAK', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Project will contain source control binding strings

Specifies if generic source control strings (SAK) should be generated in the project file.

Example:
\`\`\`FASTBuild
.ProjectSccEntrySAK = true
\`\`\``,
            }],
            ['ProjectBuildCommand', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Command to launch when "build project" is selected.

Example:
\`\`\`FASTBuild
.ProjectBuildCommand = 'fbuild -ide -dist -cache MyProject-X64-Debug'
\`\`\`

It can be convenient to take advantage of Visual Studio's runtime macro substitution to avoid having to manually specify this for every configuration.
Example:
\`\`\`FASTBuild
.ProjectBuildCommand = 'cd ^$(SolutionDir)\\..\\..\\Code\\ &amp; fbuild -ide -dist -cache ^$(ProjectName)-^$(Configuration)'
\`\`\``,
            }],
            ['ProjectRebuildCommand', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Command to launch when "rebuild project" is selected.

Example:
\`\`\`FASTBuild
.ProjectRebuildCommand = 'fbuild -ide -clean -dist -cache MyProject-X64-Debug'
\`\`\`

It can be convenient to take advantage of Visual Studio's runtime macro substitution to avoid having to manually specify this for every configuration.

Example:
\`\`\`FASTBuild
.ProjectRebuildCommand = 'cd ^$(SolutionDir)\\..\\..\\Code\\ &amp; fbuild -ide -clean -dist -cache ^$(ProjectName)-^$(Configuration)'
\`\`\``,
            }],
            ['ProjectCleanCommand', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Command to launch when "clean project" is selected.

Example:
\`\`\`FASTBuild
.ProjectCleanCommand = 'fbuild -ide Clean-MyProject-X64-Debug'
\`\`\`

It can be convenient to take advantage of Visual Studio's runtime macro substitution to avoid having to manually specify this for every configuration.

Example:
\`\`\`FASTBuild
.ProjectCleanCommand = 'cd ^$(SolutionDir)\\..\\..\\Code\\ &amp; fbuild -ide Clean-$(ProjectName)-^$(Configuration)'
\`\`\``,
            }],
            ['Output', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Output generated by compilation.

Example:
\`\`\`FASTBuild
.Output = 'tmp/Debug/bin/MyExe.exe'
\`\`\``,
            }],
            ['OutputDirectory', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Output directory for Visual Studio.

Example:
\`\`\`FASTBuild
.OutputDirectory  = 'tmp/Debug/bin/'
\`\`\``,
            }],
            ['IntermediateDirectory', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Intermediate directory for Visual Studio.

Example:
\`\`\`FASTBuild
.IntermediateDirectory = 'tmp/'
\`\`\``,
            }],
            ['BuildLogFile', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Build log file for Visual Studio.

Example:
\`\`\`FASTBuild
.BuildLogFile = 'tmp/^$(ProjectName)-^$(Configuration).log'
\`\`\``,
            }],
            ['LayoutDir', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Directory to prepare Layout (for XboxOne).

Example:
\`\`\`FASTBuild
.LayoutDir = 'tmp/Layout/'
\`\`\``,
            }],
            ['LayoutExtensionFilter', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Files to filter from Layout (for XboxOne).

Example:
\`\`\`FASTBuild
.LayoutExtensionFilter = '.pdb;.map;'
\`\`\``,
            }],
            ['PreprocessorDefinitions', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Preprocessor definitions.

Preprocessor definitions for Intellisense can be manually specified. If the .Target for a configuration is specified, this will be populated automatically by detecting use of /D or -D in the compiler command line. Manual specification will override the automated detection.

Example:
\`\`\`FASTBuild
.PreprocessorDefinitions = 'DEBUG;MY_LIB_DEFINE;__WINDOWS__;'
\`\`\``,
            }],
            ['IncludeSearchPath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Include search paths.

Include search paths for Intellisense can be manually specified. If the .Target for a configuration is specified, this will be populated automatically by detecting use of /I, -I, -isystem, -isystem-after, /imsvc, -imsvc, -idirafter, -iquote, /external:I or -external:I in the compiler command line. Manual specification will override the automated detection.

Example:
\`\`\`FASTBuild
.IncludeSearchPath = 'Code/Core/;Code/Engine/;'
\`\`\``,
            }],
            ['ForcedIncludes', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Force included files.

Force included files for Intellisense can be manually specified.

Example:
\`\`\`FASTBuild
.ForcedIncludes = 'forced.h'
\`\`\``,
            }],
            ['AssemblySearchPath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Assembly search paths.

Assembly search paths for Intellisense can be manually specified.

Example:
\`\`\`FASTBuild
.AssemblySearchPath = '$WindowsSDK$/References/CommonConfiguration/Neutral'
\`\`\``,
            }],
            ['ForcedUsingAssemblies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Forced Using assemblies.

Forced using assemblies for Intellisense can be manually specified.

Example:
\`\`\`FASTBuild
.ForcedUsingAssemblies = 'AssemblyName'
\`\`\``,
            }],
            ['AdditionalOptions', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Additional compiler options.

Additional compiler options for Intellisense can be manually specified.

Example:
\`\`\`FASTBuild
.AdditionalOptions = '/Zm100'
\`\`\``,
            }],
            ['LocalDebuggerCommand', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Executable to launch when debugging.

Explicitly specify the executable to launch when debugging. The LocalDebuggerCommand property of a Visual Studio project is usually set automatically by FASTBuild (extracted from the .Target specified per build configuration), but can be explicitily set via .LocalDebuggerCommand if desired.

Example:
\`\`\`FASTBuild
.LocalDebuggerCommand  = 'tmp/bin/MyExe.exe'
\`\`\``,
            }],
            ['LocalDebuggerCommandArguments', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Args passed to executable when debugging.

Example:
\`\`\`FASTBuild
.LocalDebuggerCommandArguments = '-runFromVS'
\`\`\``,
            }],
            ['LocalDebuggerWorkingDirectory', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Working Dir for executable when debugging.

Example:
\`\`\`FASTBuild
.LocalDebuggerWorkingDirectory = '/tmp/bin/'
\`\`\``,
            }],
            ['LocalDebuggerEnvironment', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Environment variables when debugging.

Example:
\`\`\`FASTBuild
.LocalDebuggerEnvironment = '_NO_DEBUG_HEAP=1' // Disable debug heap
\`\`\``,
            }],
            ['RemoteDebuggerCommand', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Executable to launch when debugging remotely.

Specify the executable to launch when debugging remotely, when using the Windows Subsystem for Linux for example.

Example:
\`\`\`FASTBuild
.RemoteDebuggerCommand  = '/mnt/c/bin/myexe'
\`\`\``,
            }],
            ['RemoteDebuggerCommandArguments', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Args passed to remote executable when debugging.

Example:
\`\`\`FASTBuild
.RemoteDebuggerCommandArguments = '-myArg'
\`\`\``,
            }],
            ['RemoteDebuggerWorkingDirectory', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Working Dir for remote executable when debugging.

Example:
\`\`\`FASTBuild
.LocalDebuggerWorkingDirectory = '/mnt/c/bin/'
\`\`\``,
            }],
            ['Xbox360DebuggerCommand', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Debugger command for Xbox360 only.`,
            }],
            ['DebuggerFlavor', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Debugger flavor.

Example:
\`\`\`FASTBuild
.DebuggerFlavor = 'WindowsLocalDebugger'
\`\`\``,
            }],
            ['AumidOverride', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Aumid override (for XboxOne).`,
            }],
            ['Keyword', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Keyword e.g. 'Android'`,
            }],
            ['ApplicationType', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `ApplicationType e.g. 'Android'`,
            }],
            ['ApplicationTypeRevision', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `ApplicationType e.g. '3.0'`,
            }],
            ['TargetLinuxPlatform', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Set the Linux platform type

Example:
\`\`\`FASTBuild
.TargetLinuxPlatform = 'Generic'
\`\`\``,
            }],
            ['LinuxProjectType', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Set the project type GUID for Linux

Example:
\`\`\`FASTBuild
.LinuxProjectType = '{D51BCBC9-82E9-4017-911E-C93873C4EA2B}'
\`\`\``,
            }],
            ['PackagePath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Path to the package to be used for debugging.`,
            }],
            ['AdditionalSymbolSearchPaths', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Path to additional symbols to be used when debugging.`,
            }],
            ['AndroidApkLocation', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Location of APK for Android Game Development Extension`,
            }],
            ['PlatformToolset', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Specify PlatformToolset.

Example:
\`\`\`FASTBuild
.PlatformToolset = 'v120'
\`\`\``,
            }],
            ['DeploymentType', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Specify deployment type for Xbox360.`,
            }],
            ['DeploymentFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Specify files to add to deployment for Xbox360.`,
            }],
            ['RootNamespace', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Set RootNamespace for project

Example:
\`\`\`FASTBuild
.RootNamespace = 'MyProject'
\`\`\``,
            }],
        ]),
    }],
    [ 'VSProjectExternal', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/vsprojectexternal.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['ExternalProjectPath', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Path to project file

The location of the external, "foreign" .???proj file.

Example:
\`\`\`FASTBuild
.ExternalProjectPath = 'Setup\\Source\\ExtProject\\ExtProject.wixproj'
\`\`\``,
            }],
            ['ProjectGuid', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `(only when avoiding external module) Project Guid

(only if the value parsed by the external [VSProjTypeExtractor](https://github.com/lucianm/VSProjTypeExtractor) should be preceeded)

The actual project GUID exactly as found in the external, "foreign" .???proj file.

Example:
\`\`\`FASTBuild
.ProjectGuid = '{FA3D597E-38E6-4AE6-ACA1-22D2AF16F6A2}'
\`\`\``,
            }],
            ['ProjectTypeGuid', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `(only when avoiding external module) Project Type Guid

(Should not be given if using [VSProjTypeExtractor](https://github.com/lucianm/VSProjTypeExtractor))

This GUID identifies the project type and can be found in the registry, sometimes also in the project file itself inside the <ProjectTypeGuids> tag, but that is not guaranteed. Basically, every new type of project Visual Studio "learns" about after installing some new project type addon, stores this information in the system, so it is depending on the actual Visual Studio installation (especially its components), therefore if it's not available you can either consult the list your installation supports in the registry under HKCU\\Software\\Microsoft\\VisualStudio\\12.0_Config\\Projects (or similar), or more simple, check what type GUID would be added in a solution file when interactively adding that kind of project to it.

Example:
\`\`\`FASTBuild
.ProjectTypeGuid = '{930c7802-8a8c-48f9-8165-68863bccd9dd}' // WiX Toolset project type GUID
\`\`\``,
            }],
            ['ProjectConfigs', {
                isRequired: false,
                defaultDescription: 'Debug Win32, Release Win32, Debug X64, Release X64',
                types: new Set<ValueType>([ValueType.ArrayOfStructs]),
                documentation: `(only when avoiding external module) List of project configurations (see below)

A list of project configuration structures in the following format:
\`\`\`FASTBuild
.ProjectConfig =
[
  // Basic Options
  .Platform                       // Platform (e.g. Win32, X64, PS3 etc.)
  .Config                         // Config (e.g. Debug, Release etc.)
]
\`\`\`

Example:
\`\`\`FASTBuild
.DebugConfig      = [ .Platform = 'Win32' .Config = 'Debug' ]
.ReleaseConfig    = [ .Platform = 'Win32' .Config = 'Release' ]
.ProjectConfigs   = { .DebugConfig, .ReleaseConfig }
\`\`\`

If no configurations are specified, the following defaults will be used:
\`\`\`FASTBuild
.X86DebugConfig   = [ .Platform = 'Win32' .Config = 'Debug' ]
.X86ReleaseConfig = [ .Platform = 'Win32' .Config = 'Release' ]
.X64DebugConfig   = [ .Platform = 'X64'   .Config = 'Debug' ]
.X64ReleaseConfig = [ .Platform = 'X64'   .Config = 'Release' ]
.ProjectConfigs   = {
                        .X86DebugConfig, .X86ReleaseConfig, .X64DebugConfig, .X64ReleaseConfig
                    }
\`\`\`

If the [VSProjTypeExtractor](https://github.com/lucianm/VSProjTypeExtractor) DLLs (Windows only) are present in the FASTBuild binary directory or reachable within the PATH environment, all of these Options except .ExternalProjectPath can be empty or not used at all, in order to let the VSProjTypeExtractor module to retrieve them. On the contrary, if despite of having the DLLs in place, some of these options have to be overridden, they should be provided in the BFF. If all are provided, the external project will no longer be parsed.`,
            }],
        ]),
    }],
    [ 'VSSolution', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/vssolution.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['SolutionOutput', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Path to Solution file to be generated

The output location of the .sln file.

Example:
\`\`\`FASTBuild
.SolutionOutput = 'tmp/VisualStudio/MySolution.sln'
\`\`\``,
            }],

            ['SolutionProjects', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Project(s) to include in Solution

The previously defined VCXProject item(s) to include in the solution. Projects will be placed at the root of the Solution, unless a .Folders entry specifies otherwise (see below). Projects which are placed in Solution Folders do not need to be listed in .SolutionProjects.

Example:
\`\`\`FASTBuild
.SolutionProjects =
{
  'LibraryA-proj' // Previously defined with VCXProject
  'LibraryB-proj' // Previously defined with VCXProject
  'Exe-proj'      // Previously defined with VCXProject
}
\`\`\``,
            }],
            ['SolutionConfigs', {
                isRequired: false,
                defaultDescription: 'Win32|Debug, Win32|Release, x64|Debug, x64|Release',
                types: new Set<ValueType>([ValueType.ArrayOfStructs]),
                documentation: `Solution configurations (see below)

The platform/configuration pairs you wish to appear in Visual Studio can be controlled here. They need to match those specified in your generated projects.

Example:
\`\`\`FASTBuild
.Solution_Config_Debug =
[
  .Platform = 'Win32'
  .Config   = 'Debug'
]
.Solution_Config_Release =
[
  .Platform = 'Win32'
  .Config   = 'Release'
]
.SolutionConfigs = { .Solution_Config_Debug, .Solution_Config_Release }
\`\`\`

If not specified, a default matrix of Win32|Debug, Win32|Release, x64|Debug and x64|Release configurations is used.

The optional .SolutionConfig and .SolutionPlatform allow custom solution level Configs and Platforms to be defined. This can be useful when the Config/Platform from the Solution and Project don't have a 1:1 relationship.

Example:
\`\`\`FASTBuild
.DebugDirectX =
[
  .Config           = 'Debug-DirectX'
  .Platform         = 'Win32'
  .SolutionConfig   = 'Debug'
  .SolutionPlatform = 'Win32-DirectX'
]
.DebugOpenGL =
[
  .Config           = 'Debug-OpenGL'
  .Platform         = 'Win32'
  .SolutionConfig   = 'Debug'
  .SolutionPlatform = 'Win32-OpenGL'
]
\`\`\``,
            }],
            ['SolutionFolders', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStructs]),
                documentation: `Folders to organize projects (see below)

Projects and solution items within a Solution can be organized into folders. Folders may contain projects and/or items, or can be empty.

Example:
\`\`\`FASTBuild
.FolderA =
[
  .Path      = 'Libraries'
  .Projects  = { 'LibraryA-proj', 'LibraryB-proj' }
  .Items     = { 'rel_path_to/item_file_1.txt', 'rel_path_to/item_file_2.ext' }
]
.FolderB =
[
  .Path      = 'Executables'
  .Projects  = { 'Exe-proj' }
]
.SolutionFolders = { .FolderA, .FolderB }
\`\`\`

Projects not associated with folders will appear at the root of the the Solution.`,
            }],
            ['SolutionDependencies', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStructs]),
                documentation: `Project dependency information (see below)

Projects within a Solution can be specified as depending on other projects within the Solution.

For simple solutions, this option is typically not necessary.

For more complex Solutions, specifying artificial SolutionDependencies may be useful (depending on the desired F5 behaviour). For example, in Solutions with multiple executables, only one of the executables should be listed as a .SolutionBuildProject (to prevent multiple concurrent invocations of FASTBuild). However, (because of what is arguably a bug in Visual Studio) only when this project (the "primary" project) is the active project, will F5 trigger an up-to-date build check on the target automatically before running. If you want this automatic check on other targets (rather than having to manually build the Project or Solution), you have to artificially make any "non-primary" projects depend on the "primary" executable.

Example:
\`\`\`FASTBuild
.Deps =
[
  .Projects      = { 'Exe1-proj',
                     'Exe2-proj' } // F5 with either as the active project will perform a Solution Build (via "All")
  .Dependencies  = { 'All-proj' }
]
.SolutionDependencies = { .Deps }
\`\`\``,
            }],
            ['SolutionVisualStudioVersion', {
                isRequired: false,
                defaultDescription: '"14.0.22823.1"',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Version of Solution

Specify the VisualStudio version that you would like to appear as the generator of this Solution file.

Example:
\`\`\`FASTBuild
.SolutionVisualStudioVersion = "14.0.22823.1"
\`\`\`

If not specified, "14.0.22823.1" will be used (VS2015 RC).`,
            }],
            ['SolutionMinimumVisualStudioVersion', {
                isRequired: false,
                defaultDescription: '"10.0.40219.1"',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Min version of Solution

Specify the minimum VisualStudio version necessary to open this Solution file.

Example:
\`\`\`FASTBuild
.SolutionMinimumVisualStudioVersion = "10.0.40219.1"
\`\`\`

If not specified, "10.0.40219.1" will be used (VS2010 Express).`,
            }],
            ['SolutionBuildProject', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Project(s) set to build when "Build Solution" is selected

Projects which will build when solution is built. Generally, only one project should be specified.

Example:
\`\`\`FASTBuild
.SolutionBuildProjects = 'Project' // A previously defined vcxproject
\`\`\``,
            }],
            ['SolutionDeployProjects', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Project(s) set deploy

Projects in the solution to be deployed.

Example:
\`\`\`FASTBuild
.SolutionDeployProjects = 'Project' // A previously defined vcxproject
\`\`\``,
            }]
        ]),
    }],
    [ 'XCodeProject', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/xcodeproject.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['ProjectOutput', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Path to project.pbxproj file to be created

The output location of the project.pbxproj file. Note that a valid XCode Project requires a project.pbxproj file be created within a specifically named folder.

Example:
\`\`\`FASTBuild
.ProjectOutput = 'tmp/XCode/MyProject.xcodeproj/project.pbxproj'
\`\`\``,
            }],
            ['ProjectConfigs', {
                isRequired: true,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStructs]),
                documentation: `Project configurations

One or more build configuration must be specified. Each configuration can be selected in the XCode UI and the various properties specify how to generate configuration info for XCode.

Example:
\`\`\`FASTBuild
.DebugConfig = [ ... ] // See below for options
.ReleaseConfig = [ ... ] // See below for options
.ProjectConfigs = { .DebugConfig, .ReleaseConfig }
\`\`\``,
            }],
            ['ProjectInputPaths', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Path(s) containing files to include in project

One or more directories can be specified to search for files and add to a project. Searching is recursive.

Example:
\`\`\`FASTBuild
.ProjectInputPaths = 'Code/Lib/Folder/'
\`\`\`
Or:
\`\`\`FASTBuild
.ProjectInputPaths = {
                       'Code/Lib/Folder1/'
                       'Code/Lib/Folder2/'
                     }
\`\`\``,
            }],
            ['ProjectInputPathsExclude', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Path(s) to exclude from project

One or more directories can be specified to ignore during directory traversal.

Example:
\`\`\`FASTBuild
.ProjectInputPathsExclude = 'Code/Lib/FolderToExclude/'
\`\`\`
Or:
\`\`\`FASTBuild
.ProjectInputPathsExclude = {
                              'Code/Lib/FolderToExclude1/'
                              'Code/Lib/FolderToExclude2/'
                            }
\`\`\``,
            }],
            ['ProjectInputPathsRecurse', {
                isRequired: false,
                defaultDescription: 'true',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Recurse into project input paths when finding files

Toggles whether to recurse into subdirectories of .ProjectInputPaths when finding files to add to the project.

Example:
\`\`\`FASTBuild
.ProjectInputPathsRecurse   = false
\`\`\``,
            }],
            ['ProjectPatternToExclude', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Pattern(s) for files to exclude from project

One or more patterns can be specified to ignore during directory traversal.

Example:
\`\`\`FASTBuild
.ProjectPatternToExclude = '*/OSX/*'
\`\`\`
Or:
\`\`\`FASTBuild
.ProjectPatternToExclude = {
                              '*/Windows/*'
                              '*/Linux/*'
                           }
\`\`\``,
            }],
            ['ProjectFiles', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `File(s) to include in project

One or more files can be explicitly listed for inclusion in the project.

Example:
\`\`\`FASTBuild
.ProjectFiles = 'Code/Libraries/Lib/A.cpp'
\`\`\`
Or:
\`\`\`FASTBuild
.ProjectFiles = {
                  'Code/Libraries/Core/A.cpp'
                  'Code/Libraries/Core/B.cpp'
                }
\`\`\`

Additionally, XCodeProjects can be embedded within other XCodeProjects:
\`\`\`FASTBuild
.ProjectFiles = {
                  'Core-xcode'   // Assume alias to previously defined XCodeProject
                  'Engine-xcode' // Assume alias to previously defined XCodeProject
                }
\`\`\``,
            }],
            ['ProjectFilesToExclude', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `File(s) to exclude from project

One or move files can be specified to ignore during directory traversal.

Example:
\`\`\`FASTBuild
.ProjectFilesToExclude = 'Code/Lib/FileToExclude.cpp'
\`\`\`
Or:
\`\`\`FASTBuild
.ProjectFilesToExclude = {
                           'Code/Lib/FileToExclude1.cpp'
                           'Code/Lib/FileToExclude2.cpp'
                         }
\`\`\``,
            }],
            ['ProjectBasePath', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Base path(s) to use to build folder hierarchy in project

One or move directories can be specified as the root of the folder hierarchy that will be created within the generated project.

Example:
\`\`\`FASTBuild
.ProjectBasePath = 'Code/Lib/'
\`\`\`
Or:
\`\`\`FASTBuild
.ProjectBasePath = {
                     'Code/Lib1/'
                     'Code/Lib2/'
                   }
\`\`\``,
            }],
            ['ProjectAllowedFileExtensions', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `File extension pattern(s) to include in project (see below for default)

One or move wildcard patterns can be specified to restrict which files will be included in the project during directory traversal. Explicitly listed files (.ProjectFiles) will always be included.

Example:
\`\`\`FASTBuild
.ProjectAllowedFileExtensions = '*.cpp'
\`\`\`
Or:
\`\`\`FASTBuild
.ProjectAllowedFileExtensions = { '*.cpp', '*.h' }
\`\`\`

If not specified, the default will be used:
\`\`\`FASTBuild
.ProjectAllowedFileExtensions = {
                                  '*.cpp', '*.hpp', '*.cxx', '*.hxx', '*.c',   '*.h',  '*.cc',   '*.hh',
                                  '*.cp',  '*.hp',  '*.cs',  '*.inl', '*.bff', '*.rc', '*.resx', '*.m',  '*.mm',
                                  '*.cu',
                                  '*.asm', '*.s',
                                  '*.natvis', '*.editorconfig'
                                }
\`\`\``,
            }],
            ['XCodeBuildToolPath', {
                isRequired: false,
                defaultDescription: '"./FBuild"',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Path to FASTBuild executable

The location of the FASTBuild executable to invoke can be specified.

Example:
\`\`\`FASTBuild
.XCodeBuildToolPath = '../Build/FBuild'
\`\`\`

If not specified, the default will be used:
\`\`\`FASTBuild
.XCodeBuildToolPath = './FBuild'
\`\`\``,
            }],
            ['XCodeBuildToolArgs', {
                isRequired: false,
                defaultDescription: '"-ide ^$(FASTBUILD_TARGET)"',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Args to pass to FASTBuild

The command line args to pass to FASTBuild when compiling can be specified.

Example:
\`\`\`FASTBuild
.XCodeBuildToolArgs = '-ide -cache -summary OSX64-All'
\`\`\`

If not specified, the default will be used:
\`\`\`FASTBuild
.XCodeBuildToolArgs = '-ide ^$(FASTBUILD_TARGET)'
\`\`\`

* FASTBUILD_TARGET is a special per-configuration symbol that will be replaced (by XCode) with the .Target being compiled. FASTBuild automatically defines this symbol correctly for each build configuration.
* Note that the $ is escaped so that it's not interpretted by FASTBuild as the beginning of a variable substitution.`,
            }],
            ['XCodeBuildWorkingDir', {
                isRequired: false,
                defaultDescription: '"./"',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Working dir to set when invoking FASTBuild

The location to set as a working directory for compilation.

Example:
\`\`\`FASTBuild
.XCodeBuildToolPath = 'Code/'
\`\`\`

If not specified, the default will be used:
\`\`\`FASTBuild
.XCodeBuildToolPath = './'
\`\`\``,
            }],
            ['XCodeDocumentVersioning', {
                isRequired: false,
                defaultDescription: 'false',
                types: new Set<ValueType>([ValueType.Boolean]),
                documentation: `Enable "Document Versioning"

Controls whether the "Document Versionsing" checkbox is enabled.

By default (non-FASTBuild) XCode projects have this option set, which causes XCode to pass additional args on the command line to the process when debugging. This is usually not desired, so FASTBuild suppresses this by default. The option can be re-enabled if needed.

Example:
\`\`\`FASTBuild
.XCodeDocumentVersioning = true
\`\`\``,
            }],
            ['XCodeCommandLineArguments', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Enabled command line options for debug

Specify command line arguments passed to the process when debugging.

Example:
\`\`\`FASTBuild
.XCodeCommandLineArguments = { '-Arg1', '-Arg2' }
\`\`\`

NOTE: This option (and .XCodeCommandLineArgumentsDisabled) is stored in the .xcscheme file for the project, which also contains other user-edited settings. As such, while FASTBuild will generate this file if missing, it will not overwrite it when it changes (so as not to overwrite other user edited settings). The .xcscheme can be deleted to force regeneration.`,
            }],
            ['XCodeCommandLineArgumentsDisabled', {
                isRequired: false,
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.String, ValueType.ArrayOfStrings]),
                documentation: `Disabled command line options for debug target

Specify command line arguments passed to the process when debugging (same as .XCodeCommandLineArguments), but disable them by default.`,
            }],
            ['XCodeOrganizationName', {
                isRequired: false,
                defaultDescription: '"Organization"',
                types: new Set<ValueType>([ValueType.String]),
                documentation: `Organization name to set in project

The organization name which appears in the generated project can be set.

Example:
\`\`\`FASTBuild
.XCodeOrganizationName = 'MyCompany'
\`\`\`

If not specified, the default will be used:
\`\`\`FASTBuild
.XCodeOrganizationName = 'Organization'
\`\`\``,
            }],
        ]),
    }],
]);
