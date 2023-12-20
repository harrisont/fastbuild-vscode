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
                defaultDescription: 'auto',
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
                defaultDescription: '',
                types: new Set<ValueType>([ValueType.ArrayOfStrings]),
                documentation: `Link objects used to make libs instead of libs (default true)`,
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
                defaultDescription: 'auto',
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
.ProjectConfigs = [ .DebugConfig, .ReleaseConfig ]
\`\`\``,
            }],
        ]),
    }],
]);
