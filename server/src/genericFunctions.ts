
interface PropertyAttributes {
    isRequired: boolean;
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
                documentation: `String/ArrayOfStrings

One or more targets must be provided, either as a string or an array of strings. Targets can be previously
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
                documentation: `Boolean (default false)

Hide a target from -showtargets`,
            }]
        ]),
    }],
    [ 'Compiler', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/compiler.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Executable', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'Copy', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/copy.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Source', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['Dest', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'CopyDir', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/copydir.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['SourcePaths', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['Dest', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'CSAssembly', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/csassembly.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Compiler', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['CompilerOptions', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['CompilerOutput', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'DLL', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/dll.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Linker', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['LinkerOutput', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['LinkerOptions', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['Libraries', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'Exec', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/exec.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['ExecExecutable', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['ExecOutput', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'Executable', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/executable.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Linker', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['LinkerOutput', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['LinkerOptions', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['Libraries', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'Library', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/library.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Compiler', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['CompilerOptions', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['Librarian', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['LibrarianOptions', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['LibrarianOutput', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'ListDependencies', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/listdependencies.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Source', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['Dest', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'ObjectList', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/objectlist.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Compiler', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['CompilerOptions', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'RemoveDir', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/removedir.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['RemovePaths', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'Test', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/test.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['TestExecutable', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['TestOutput', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'TextFile', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/textfile.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['TextFileOutput', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['TextFileInputStrings', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'Unity', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/unity.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['UnityOutputPath', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'VCXProject', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/vcxproject.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['ProjectOutput', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'VSProjectExternal', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/vsprojectexternal.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['ExternalProjectPath', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'VSSolution', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/vssolution.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['SolutionOutput', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
    [ 'XCodeProject', {
        documentationUrl: 'https://www.fastbuild.org/docs/functions/xcodeproject.html',
        properties: new Map<PropertyName, PropertyAttributes>([
            ['ProjectOutput', {
                isRequired: true,
                documentation: `TODO`,
            }],
            ['ProjectConfigs', {
                isRequired: true,
                documentation: `TODO`,
            }],
        ]),
    }],
]);
