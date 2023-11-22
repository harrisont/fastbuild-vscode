
interface PropertyAttributes {
    isRequired: boolean;
}

type PropertyName = string;

interface GenericFunctionMetadata {
    properties: Map<PropertyName, PropertyAttributes>;
}

export const GENERIC_FUNCTION_METADATA_BY_NAME = new Map<PropertyName, GenericFunctionMetadata>([
    [ 'Alias', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Targets', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'Compiler', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Executable', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'Copy', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Source', {
                isRequired: true,
            }],
            ['Dest', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'CopyDir', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['SourcePaths', {
                isRequired: true,
            }],
            ['Dest', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'CSAssembly', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Compiler', {
                isRequired: true,
            }],
            ['CompilerOptions', {
                isRequired: true,
            }],
            ['CompilerOutput', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'DLL', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Linker', {
                isRequired: true,
            }],
            ['LinkerOutput', {
                isRequired: true,
            }],
            ['LinkerOptions', {
                isRequired: true,
            }],
            ['Libraries', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'Exec', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['ExecExecutable', {
                isRequired: true,
            }],
            ['ExecOutput', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'Executable', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Linker', {
                isRequired: true,
            }],
            ['LinkerOutput', {
                isRequired: true,
            }],
            ['LinkerOptions', {
                isRequired: true,
            }],
            ['Libraries', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'Library', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Compiler', {
                isRequired: true,
            }],
            ['CompilerOptions', {
                isRequired: true,
            }],
            ['Librarian', {
                isRequired: true,
            }],
            ['LibrarianOptions', {
                isRequired: true,
            }],
            ['LibrarianOutput', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'ListDependencies', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Source', {
                isRequired: true,
            }],
            ['Dest', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'ObjectList', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['Compiler', {
                isRequired: true,
            }],
            ['CompilerOptions', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'RemoveDir', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['RemovePaths', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'Test', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['TestExecutable', {
                isRequired: true,
            }],
            ['TestOutput', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'TextFile', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['TextFileOutput', {
                isRequired: true,
            }],
            ['TextFileInputStrings', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'Unity', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['UnityOutputPath', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'VCXProject', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['ProjectOutput', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'VSProjectExternal', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['ExternalProjectPath', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'VSSolution', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['SolutionOutput', {
                isRequired: true,
            }],
        ]),
    }],
    [ 'XCodeProject', {
        properties: new Map<PropertyName, PropertyAttributes>([
            ['ProjectOutput', {
                isRequired: true,
            }],
            ['ProjectConfigs', {
                isRequired: true,
            }],
        ]),
    }],
]);
