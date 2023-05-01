import * as os from 'os';
import * as path from 'path';

import {
    Maybe,
} from './coreTypes';

import {
    ParseData,
    ParseError,
    ParseSourceRange,
    RESERVED_SYMBOL_NAMES,
    SourcePosition,
    Statement,
} from './parser';

import { IFileSystem } from './fileSystem';

import { ParseDataProvider, UriStr } from './parseDataProvider';

// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

const MAX_SCOPE_STACK_DEPTH = 128;

interface GenericFunctionMetadata {
    requiredPropertyNames: string[];
}

const GENERIC_FUNCTION_METADATA_BY_NAME = new Map<string, GenericFunctionMetadata>([
    [ 'Alias', {
        requiredPropertyNames: ['Targets'],
    }],
    [ 'Compiler', {
        requiredPropertyNames: ["Executable"],
    }],
    [ 'Copy', {
        requiredPropertyNames: ["Source", "Dest"],
    }],
    [ 'CopyDir', {
        requiredPropertyNames: ["SourcePaths", "Dest"],
    }],
    [ 'CSAssembly', {
        requiredPropertyNames: ["Compiler", "CompilerOptions", "CompilerOutput"],
    }],
    [ 'DLL', {
        requiredPropertyNames: ["Linker", "LinkerOutput", "LinkerOptions", "Libraries", "Libraries2"],
    }],
    [ 'Exec', {
        requiredPropertyNames: ["ExecExecutable", "ExecOutput"],
    }],
    [ 'Executable', {
        requiredPropertyNames: ["Linker", "LinkerOutput", "LinkerOptions", "Libraries", "Libraries2"],
    }],
    [ 'Library', {
        requiredPropertyNames: ["Compiler", "CompilerOptions", "CompilerOutputPath", "Librarian", "LibrarianOptions", "LibrarianOutput"],
    }],
    [ 'ListDependencies', {
        requiredPropertyNames: ["Source", "Dest"],
    }],
    [ 'ObjectList', {
        requiredPropertyNames: ["Compiler", "CompilerOptions", "CompilerOutputPath"],
    }],
    [ 'RemoveDir', {
        requiredPropertyNames: ["RemovePaths"],
    }],
    [ 'Test', {
        requiredPropertyNames: ["TestExecutable", "TestOutput"],
    }],
    [ 'TextFile', {
        requiredPropertyNames: ["TextFileOutput", "TextFileInputStrings"],
    }],
    [ 'Unity', {
        requiredPropertyNames: ["UnityOutputPath"],
    }],
    [ 'VCXProject', {
        requiredPropertyNames: ["ProjectOutput"],
    }],
    [ 'VSProjectExternal', {
        requiredPropertyNames: ["ExternalProjectPath"],
    }],
    [ 'VSSolution', {
        requiredPropertyNames: ["SolutionOutput"],
    }],
    [ 'XCodeProject', {
        requiredPropertyNames: ["ProjectOutput", "ProjectConfigs"],
    }],
]);

export interface ErrorRelatedInformation {
    range: SourceRange;
    message: string;
}

// This indicates a problem with the content being evaluated.
export class EvaluationError extends Error {
    constructor(readonly range: SourceRange, message: string, readonly relatedInformation: ErrorRelatedInformation[]) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = EvaluationError.name;
    }
}

// This indicates a programming problem with the language server.
export class InternalEvaluationError extends EvaluationError {
    constructor(range: SourceRange, message: string) {
        super(range, message, []);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = InternalEvaluationError.name;
    }
}

export class DataAndMaybeError<T> {
    constructor(readonly data: T, readonly error: Error | null = null) {
    }
}

type ValueTypeName = 'Boolean' | 'Integer' | 'String' | 'Array' | 'Struct';

export type Value = boolean | number | string | Value[] | Struct;

export type VariableName = string;

export class StructMember {
    constructor(readonly value: Value, readonly definitions: AtLeast1VariableDefinition) {
    }
}

export class Struct {
    constructor(readonly members=new Map<VariableName, StructMember>()) {
    }

    static from(iterable: Iterable<readonly [VariableName, StructMember]>): Struct {
        return new Struct(new Map<VariableName, StructMember>(iterable));
    }

    toJSON(): string {
        if (this.members.size === 0) {
            return '[]';
        } else {
            const items = Array.from(this.members,
                ([structMemberName, structMember]) => `${structMemberName}=${JSON.stringify(structMember.value)}`
            );
            return `{${items.join(',')}}`;
        }
    }
}

export class SourceRange {
    readonly start: SourcePosition;
    readonly end: SourcePosition;

    constructor(readonly uri: UriStr, parseSourceRange: ParseSourceRange) {
        this.start = parseSourceRange.start;
        this.end = parseSourceRange.end;
    }

    static create(uri: UriStr, startLine: number, startCharacter: number, endLine: number, endCharacter: number): SourceRange {
        return new SourceRange(
            uri,
            {
                start: {
                    line: startLine,
                    character: startCharacter
                },
                end: {
                    line: endLine,
                    character: endCharacter
                }
            }
        );
    }

    static createFromPosition(uri: UriStr, start: SourcePosition, end: SourcePosition): SourceRange {
        return new SourceRange(
            uri,
            {
                start,
                end
            }
        );
    }
}

export interface EvaluatedVariable {
    value: Value;
    range: SourceRange;
}

export interface VariableDefinition {
    id: number;
    range: SourceRange;
    name: string;
}

type AtLeast1VariableDefinition = [VariableDefinition, ...VariableDefinition[]];

export interface VariableReference {
    definitions: AtLeast1VariableDefinition;
    range: SourceRange;
}

export interface TargetDefinition {
    id: number;
    range: SourceRange;
}

export interface TargetReference {
    definition: TargetDefinition;
    range: SourceRange;
}

export interface IncludeReference {
    includeUri: UriStr;
    range: SourceRange;
}

export class EvaluatedData {
    evaluatedVariables: EvaluatedVariable[] = [];

    variableDefinitions: VariableDefinition[] = [];

    variableReferences: VariableReference[] = [];

    // Maps a target name to its definition
    targetDefinitions = new Map<string, TargetDefinition>();

    targetReferences: TargetReference[] = [];

    includeDefinitions = new Set<UriStr>();

    includeReferences: IncludeReference[] = [];

    nonFatalErrors: EvaluationError[] = [];
}

type ScopeLocation = 'current' | 'parent';

interface ParsedString {
    type: 'string';
    value: string;
    range: ParseSourceRange;
}

function isParsedString(obj: Record<string, any>): obj is ParsedString {
    return (obj as ParsedString).type === 'string';
}

interface ParsedStringExpression {
    type: 'stringExpression';
    range: ParseSourceRange;
    parts: (string | any)[];
}

function isParsedStringExpression(obj: Record<string, any>): obj is ParsedStringExpression {
    return (obj as ParsedStringExpression).type === 'stringExpression';
}

interface ParsedStruct {
    type: 'struct';
    range: ParseSourceRange;
    statements: Statement[];
}

function isParsedStruct(obj: Record<string, any>): obj is ParsedStruct {
    return (obj as ParsedStruct).type === 'struct';
}

type OperatorPlusOrMinus = '+' | '-';

interface ParsedSumSummand {
    operator: OperatorPlusOrMinus;
    value: any;
}

interface ParsedSum {
    type: 'sum';
    first: any;
    // summands must be of length at least 1
    summands: ParsedSumSummand[];
}

function isParsedSum(obj: Record<string, any>): obj is ParsedSum {
    return (obj as ParsedSum).type === 'sum';
}

interface ParsedEvaluatedVariable {
    type: 'evaluatedVariable';
    name: ParsedString | ParsedStringExpression;
    scope: ScopeLocation;
    range: ParseSourceRange;
}

function isParsedEvaluatedVariable(obj: Record<string, any>): obj is ParsedEvaluatedVariable {
    return (obj as ParsedEvaluatedVariable).type === 'evaluatedVariable';
}

interface ParsedArray {
    type: 'array';
    value: any[];
    range: ParseSourceRange;
}

function isParsedArray(obj: Record<string, any>): obj is ParsedArray {
    return (obj as ParsedArray).type === 'array';
}

interface ParsedBoolean {
    type: 'boolean';
    range: ParseSourceRange;
    value: boolean;
}

function isParsedBoolean(obj: Record<string, any>): obj is ParsedBoolean {
    return (obj as ParsedBoolean).type === 'boolean';
}

interface ParsedInteger {
    type: 'integer';
    range: ParseSourceRange;
    value: number;
}

function isParsedInteger(obj: Record<string, any>): obj is ParsedInteger {
    return (obj as ParsedInteger).type === 'integer';
}

interface ParsedVariableDefinitionLhs {
    name: ParsedString | ParsedStringExpression;
    scope: ScopeLocation;
    range: ParseSourceRange;
}

interface ParsedStatementVariableDefintion {
    type: 'variableDefinition';
    lhs: ParsedVariableDefinitionLhs;
    rhs: any;
}

function isParsedStatementVariableDefintion(obj: Record<string, any>): obj is ParsedStatementVariableDefintion {
    return (obj as ParsedStatementVariableDefintion).type === 'variableDefinition';
}

interface ParsedStatementBinaryOperator {
    type: 'binaryOperator';
    lhs: ParsedVariableDefinitionLhs;
    rhs: any;
    operator: OperatorPlusOrMinus;
}

function isParsedStatementBinaryOperator(obj: Record<string, any>): obj is ParsedStatementBinaryOperator {
    return (obj as ParsedStatementBinaryOperator).type === 'binaryOperator';
}

interface ParsedStatementBinaryOperatorOnUnnamed {
    type: 'binaryOperatorOnUnnamed';
    rhs: any;
    operator: OperatorPlusOrMinus;
    rangeStart: SourcePosition;
}

function isParsedStatementBinaryOperatorOnUnnamed(obj: Record<string, any>): obj is ParsedStatementBinaryOperatorOnUnnamed {
    return (obj as ParsedStatementBinaryOperatorOnUnnamed).type === 'binaryOperatorOnUnnamed';
}

// {...}
interface ParsedStatementScopedStatements {
    type: 'scopedStatements';
    statements: Statement[];
}

function isParsedStatementScopedStatements(obj: Record<string, any>): obj is ParsedStatementScopedStatements {
    return (obj as ParsedStatementScopedStatements).type === 'scopedStatements';
}

interface ParsedStatementUsing {
    type: 'using';
    range: ParseSourceRange;
    struct: ParsedEvaluatedVariable;
}

function isParsedStatementUsing(obj: Record<string, any>): obj is ParsedStatementUsing {
    return (obj as ParsedStatementUsing).type === 'using';
}

interface ParsedForEachIterator {
    loopVar: {
        name: string,
        range: ParseSourceRange,
    }
    arrayToLoopOver: ParsedEvaluatedVariable;
}

interface ParsedStatementForEach {
    type: 'forEach';
    range: ParseSourceRange;
    iterators: ParsedForEachIterator[];
    statements: Statement[];
}

function isParsedStatementForEach(obj: Record<string, any>): obj is ParsedStatementForEach {
    return (obj as ParsedStatementForEach).type === 'forEach';
}

interface ParsedStatementGenericFunction {
    type: 'genericFunction';
    range: ParseSourceRange;
    functionName: string;
    targetName: any;
    statements: Statement[];
}

function isParsedStatementGenericFunction(obj: Record<string, any>): obj is ParsedStatementGenericFunction {
    return (obj as ParsedStatementGenericFunction).type === 'genericFunction';
}

interface ParsedStatementError {
    type: 'error';
    range: ParseSourceRange;
    value: any;
}

function isParsedStatementError(obj: Record<string, any>): obj is ParsedStatementError {
    return (obj as ParsedStatementError).type === 'error';
}

interface ParsedStatementPrint {
    type: 'print';
    range: ParseSourceRange;
    value: any;
}

function isParsedStatementPrint(obj: Record<string, any>): obj is ParsedStatementPrint {
    return (obj as ParsedStatementPrint).type === 'print';
}

interface ParsedStatementSettings {
    type: 'settings';
    statements: Statement[];
}

function isParsedStatementSettings(obj: Record<string, any>): obj is ParsedStatementSettings {
    return (obj as ParsedStatementSettings).type === 'settings';
}

interface ParsedIfConditionBoolean {
    type: 'boolean';
    value: ParsedEvaluatedVariable;
    invert: boolean;
}

function isParsedIfConditionBoolean(obj: Record<string, any>): obj is ParsedIfConditionBoolean {
    return (obj as ParsedIfConditionBoolean).type === 'boolean';
}

interface ParsedIfConditionComparison {
    type: 'comparison';
    lhs: ParsedEvaluatedVariable;
    rhs: ParsedEvaluatedVariable;
    operator: {
        value: '==' | '!=' | '<' | '<=' | '>' | '>=';
        range: ParseSourceRange;
    }
}

function isParsedIfConditionComparison(obj: Record<string, any>): obj is ParsedIfConditionComparison {
    return (obj as ParsedIfConditionComparison).type === 'comparison';
}

interface ParsedIfConditionIn {
    type: 'in';
    lhs: ParsedEvaluatedVariable;
    rhs: ParsedEvaluatedVariable;
    invert: boolean;
}

function isParsedIfConditionIn(obj: Record<string, any>): obj is ParsedIfConditionIn {
    return (obj as ParsedIfConditionIn).type === 'in';
}

interface ParsedIfConditionOperatorAnd {
    type: 'operator';
    operator: '&&';
    lhs: ParsedIfCondtion;
    rhs: ParsedIfCondtion;
}

function isParsedIfConditionOperatorAnd(obj: Record<string, any>): obj is ParsedIfConditionOperatorAnd {
    const castObj = obj as ParsedIfConditionOperatorAnd;
    return castObj.type === 'operator' && castObj.operator === '&&';
}

interface ParsedIfConditionOperatorOr {
    type: 'operator';
    operator: '||';
    lhs: ParsedIfCondtion;
    rhs: ParsedIfCondtion;
}

function isParsedIfConditionOperatorOr(obj: Record<string, any>): obj is ParsedIfConditionOperatorOr {
    const castObj = obj as ParsedIfConditionOperatorOr;
    return castObj.type === 'operator' && castObj.operator === '||';
}

type ParsedIfCondtion = ParsedIfConditionBoolean | ParsedIfConditionComparison | ParsedIfConditionIn | ParsedIfConditionOperatorAnd | ParsedIfConditionOperatorOr;

interface ParsedStatementIf {
    type: 'if';
    range: ParseSourceRange;
    condition: ParsedIfCondtion;
    statements: Statement[];
}

function isParsedStatementIf(obj: Record<string, any>): obj is ParsedStatementIf {
    return (obj as ParsedStatementIf).type === 'if';
}

interface ParsedStatementUserFunctionDeclarationParameter {
    type: 'userFunctionDeclarationParameter';
    name: string;
    range: ParseSourceRange;
    definition: VariableDefinition | undefined;
}

function isParsedStatementUserFunctionDeclarationParameter(obj: Record<string, any>): obj is ParsedStatementUserFunctionDeclarationParameter {
    return (obj as ParsedStatementUserFunctionDeclarationParameter).type === 'userFunctionDeclarationParameter';
}

interface ParsedStatementUserFunctionDeclaration {
    type: 'userFunctionDeclaration';
    name: string;
    nameRange: ParseSourceRange;
    parameters: ParsedStatementUserFunctionDeclarationParameter[];
    statements: Statement[];
}

function isParsedStatementUserFunctionDeclaration(obj: Record<string, any>): obj is ParsedStatementUserFunctionDeclaration {
    const userFunction = obj as ParsedStatementUserFunctionDeclaration;

    if (userFunction.type !== 'userFunctionDeclaration') {
        return false;
    }

    return userFunction.parameters.every(isParsedStatementUserFunctionDeclarationParameter);
}

interface ParsedStatementUserFunctionCallParameter {
    type: 'userFunctionCallParameter';
    value: Value;
    range: ParseSourceRange;
}

function isParsedStatementUserFunctionCallParameter(obj: Record<string, any>): obj is ParsedStatementUserFunctionCallParameter {
    return (obj as ParsedStatementUserFunctionCallParameter).type === 'userFunctionCallParameter';
}

interface ParsedStatementUserFunctionCall {
    type: 'userFunctionCall';
    range: ParseSourceRange;
    name: string;
    nameRange: ParseSourceRange;
    parameters: ParsedStatementUserFunctionCallParameter[];
}

function isParsedStatementUserFunctionCall(obj: Record<string, any>): obj is ParsedStatementUserFunctionCall {
    const userFunction = obj as ParsedStatementUserFunctionCall;

    if (userFunction.type !== 'userFunctionCall') {
        return false;
    }

    return userFunction.parameters.every(isParsedStatementUserFunctionCallParameter);
}

// #include
interface ParsedStatementInclude {
    type: 'include';
    path: ParsedString;
}

function isParsedStatementInclude(obj: Record<string, any>): obj is ParsedStatementInclude {
    return (obj as ParsedStatementInclude).type === 'include';
}

// #once
interface ParsedStatementOnce {
    type: 'once';
}

function isParsedStatementOnce(obj: Record<string, any>): obj is ParsedStatementOnce {
    return (obj as ParsedStatementOnce).type === 'once';
}

interface ParsedDirectiveIfConditionTermIsSymbolDefined {
    type: 'isSymbolDefined';
    symbol: string;
    range: ParseSourceRange;
}

function isParsedDirectiveIfConditionTermIsSymbolDefined(obj: Record<string, any>): obj is ParsedDirectiveIfConditionTermIsSymbolDefined {
    return (obj as ParsedDirectiveIfConditionTermIsSymbolDefined).type === 'isSymbolDefined';
}

interface ParsedDirectiveIfConditionTermEnvVarExists {
    type: 'envVarExists';
    envVar: string;
    range: ParseSourceRange;
}

function isParsedDirectiveIfConditionTermEnvVarExists(obj: Record<string, any>): obj is ParsedDirectiveIfConditionTermEnvVarExists {
    return (obj as ParsedDirectiveIfConditionTermEnvVarExists).type === 'envVarExists';
}

interface ParsedDirectiveIfConditionTermFileExists {
    type: 'fileExists';
    filePath: ParsedString;
    range: ParseSourceRange;
}

function isParsedDirectiveIfConditionTermFileExists(obj: Record<string, any>): obj is ParsedDirectiveIfConditionTermFileExists {
    return (obj as ParsedDirectiveIfConditionTermFileExists).type === 'fileExists';
}

type DirectiveIfConditionTerm =
    ParsedDirectiveIfConditionTermIsSymbolDefined |
    ParsedDirectiveIfConditionTermEnvVarExists |
    ParsedDirectiveIfConditionTermFileExists;

interface DirectiveIfConditionTermOrNot {
    term: DirectiveIfConditionTerm;
    invert: boolean;
}

// #if
interface ParsedStatementDirectiveIf {
    type: 'directiveIf';
    rangeStart: SourcePosition;
    // An array of AND statements OR'd together
    condition: Array<Array<DirectiveIfConditionTermOrNot>>;
    ifStatements: Statement[];
    elseStatements: Statement[];
}

function isParsedStatementDirectiveIf(obj: Record<string, any>): obj is ParsedStatementDirectiveIf {
    return (obj as ParsedStatementDirectiveIf).type === 'directiveIf';
}

// #define
interface ParsedStatementDefine {
    type: 'define';
    symbol: string;
    range: ParseSourceRange;
}

function isParsedStatementDefine(obj: Record<string, any>): obj is ParsedStatementDefine {
    return (obj as ParsedStatementDefine).type === 'define';
}

// #undefine
interface ParsedStatementUndefine {
    type: 'undefine';
    symbol: string;
    range: ParseSourceRange;
}

function isParsedStatementUndefine(obj: Record<string, any>): obj is ParsedStatementUndefine {
    return (obj as ParsedStatementUndefine).type === 'undefine';
}

// #import
interface ParsedStatementImportEnvVar {
    type: 'importEnvVar';
    symbol: string;
    range: ParseSourceRange;
}

function isParsedStatementImportEnvVar(obj: Record<string, any>): obj is ParsedStatementImportEnvVar {
    return (obj as ParsedStatementImportEnvVar).type === 'importEnvVar';
}

interface EvaluatedRValue {
    value: Value;
    range: ParseSourceRange;
}

interface EvaluatedStringExpression {
    evaluatedString: string;
}

interface EvaluatedEvaluatedVariable {
    valueScopeVariable: ScopeVariable;
}

interface EvaluatedCondition {
    condition: boolean;
}

interface UserFunction {
    definition: VariableDefinition;
    parameters: ParsedStatementUserFunctionDeclarationParameter[];
    statements: Statement[];
}

interface ScopeVariable {
    value: Value;
    definitions: AtLeast1VariableDefinition;
}

class Scope {
    variables = new Map<string, ScopeVariable>();

    constructor(readonly canAccessParentScopes: boolean) {
    }
}

class ScopeStack {
    private stack: Scope[] = [];
    private nextVariableDefinitionId = 0;

    constructor() {
        this.push(true /*canAccessParentScopes*/);
    }

    private push(canAccessParentScopes: boolean) {
        const scope = new Scope(canAccessParentScopes);
        this.stack.push(scope);
    }

    private pop() {
        this.stack.pop();
    }

    // Convenience method to `push`, run `body`, and then `pop`.
    withScope(body: () => void) {
        this.push(true /*canAccessParentScopes*/);
        body();
        this.pop();
    }

    // Like `withScope`, but cannot access variables in parent scopes.
    withPrivateScope(body: () => void) {
        this.push(false /*canAccessParentScopes*/);
        body();
        this.pop();
    }

    getDepth(): number {
        return this.stack.length;
    }

    // Get a variable, searching from the current scope to the root.
    // Return null if the variable is not defined.
    getVariableStartingFromCurrentScope(variableName: string): ScopeVariable | null {
        for (let scopeIndex = this.stack.length - 1; scopeIndex >= 0; --scopeIndex) {
            const scope = this.stack[scopeIndex];
            const maybeVariable = scope.variables.get(variableName);
            if (maybeVariable !== undefined) {
                return maybeVariable;
            }
            if (!scope.canAccessParentScopes) {
                return null;
            }
        }
        return null;
    }

    // Get a variable, searching from the current scope to the root.
    // Return EvaluationError if the variable is not defined.
    getVariableStartingFromCurrentScopeOrError(variableName: string, variableRange: SourceRange): Maybe<ScopeVariable> {
        const maybeVariable = this.getVariableStartingFromCurrentScope(variableName);
        if (maybeVariable === null) {
            return Maybe.error(new EvaluationError(variableRange, `Referencing variable "${variableName}" that is not defined in the current scope or any of the parent scopes.`, []));
        } else {
            return Maybe.ok(maybeVariable);
        }
    }

    // Get a variable, searching from the parent scope to the root.
    // Return EvaluationError if the variable is not defined.
    getVariableStartingFromParentScopeOrError(variableName: string, variableRange: SourceRange): Maybe<ScopeVariable> {
        if (this.stack.length < 2) {
            return Maybe.error(new EvaluationError(variableRange, `Cannot access parent scope because there is no parent scope.`, []));
        }

        const currentScope = this.stack[this.stack.length - 1];
        if (currentScope.canAccessParentScopes) {
            for (let scopeIndex = this.stack.length - 2; scopeIndex >= 0; --scopeIndex) {
                const scope = this.stack[scopeIndex];
                const maybeVariable = scope.variables.get(variableName);
                if (maybeVariable !== undefined) {
                    return Maybe.ok(maybeVariable);
                }
            }
        }
        return Maybe.error(new EvaluationError(variableRange, `Referencing variable "${variableName}" in a parent scope that is not defined in any parent scope.`, []));
    }

    // Return null if the variable is not defined.
    getVariableInCurrentScope(variableName: string): ScopeVariable | null {
        const currentScope = this.getCurrentScope();
        const maybeVariable = currentScope.variables.get(variableName);
        if (maybeVariable === undefined) {
            return null;
        } else {
            return maybeVariable;
        }
    }

    // Return EvaluationError if the variable is not defined.
    getVariableInCurrentScopeOrError(variableName: string, variableRange: SourceRange): Maybe<ScopeVariable> {
        const maybeVariable = this.getVariableInCurrentScope(variableName);
        if (maybeVariable === null) {
            return Maybe.error(new EvaluationError(variableRange, `Referencing varable "${variableName}" that is not defined in the current scope.`, []));
        } else {
            return Maybe.ok(maybeVariable);
        }
    }

    // Return EvaluationError if the variable is not defined.
    getVariableInScopeOrError(scope: ScopeLocation, variableName: string, variableRange: SourceRange): Maybe<ScopeVariable> {
        if (scope === 'current') {
            return this.getVariableInCurrentScopeOrError(variableName, variableRange);
        } else {
            return this.getVariableStartingFromParentScopeOrError(variableName, variableRange);
        }
    }

    setVariableInCurrentScope(name: string, value: Value, definitions: AtLeast1VariableDefinition): ScopeVariable {
        const currentScope = this.getCurrentScope();
        const existingVariable = currentScope.variables.get(name);
        if (existingVariable === undefined) {
            const variable: ScopeVariable = {
                value: value,
                definitions,
            };
            currentScope.variables.set(name, variable);
            return variable;
        } else {
            existingVariable.value = value;
            return existingVariable;
        }
    }

    getCurrentScope(): Scope {
        return this.stack[this.stack.length - 1];
    }

    createVariableDefinition(range: SourceRange, name: string): VariableDefinition {
        const id = this.nextVariableDefinitionId;
        this.nextVariableDefinitionId += 1;
        return {
            id,
            range,
            name,
        };
    }

    createTargetDefinition(range: SourceRange): TargetDefinition {
        const id = this.nextVariableDefinitionId;
        this.nextVariableDefinitionId += 1;
        return {
            id,
            range,
        };
    }
}

function getPlatformSpecificDefineSymbol(): string {
    const platform = os.platform();
    switch(platform) {
        case 'linux':
            return '__LINUX__';
        case 'darwin':
            return '__OSX__';
        case 'win32':
            return '__WINDOWS__';
        default:
            throw new Error(`Unsupported platform '${platform}`);
    }
}

interface VariableAndEvaluatedVariable {
    variable: ScopeVariable;
    evaluatedVariable: EvaluatedVariable;
}

interface EvaluationContext {
    evaluatedData: EvaluatedData,
    scopeStack: ScopeStack,
    defines: Map<string, DefineInfo>,
    userFunctions: Map<string, UserFunction>,
    rootFbuildDirUri: vscodeUri.URI,
    thisFbuildUri: UriStr,
    fileSystem: IFileSystem,
    parseDataProvider: ParseDataProvider,
    // Used to ensure that a URI is only included a single time.
    onceIncludeUrisAlreadyIncluded: string[];
    // Used for unnamed modifiers (e.g. adding to the LHS of the previous statement).
    previousStatementLhs: VariableAndEvaluatedVariable | null;
}

function createDefaultScopeStack(rootFbuildDirUri: vscodeUri.URI): ScopeStack {
    const scopeStack = new ScopeStack();

    const createNoLocationVariableDefinition = (name: string) => {
        const definition: VariableDefinition = {
            id: -1,
            range: {
                uri: '',
                start: {
                    line: -1,
                    character: -1
                },
                end: {
                    line: -1,
                    character: -1
                }
            },
            name,
        };
        return definition;
    };

    scopeStack.setVariableInCurrentScope('_WORKING_DIR_', rootFbuildDirUri.fsPath, [createNoLocationVariableDefinition('_WORKING_DIR_')]);
    scopeStack.setVariableInCurrentScope('_CURRENT_BFF_DIR_', '', [createNoLocationVariableDefinition('_CURRENT_BFF_DIR_')]);
    scopeStack.setVariableInCurrentScope('_FASTBUILD_VERSION_STRING_', 'vPlaceholderFastBuildVersionString', [createNoLocationVariableDefinition('_FASTBUILD_VERSION_STRING_')]);
    scopeStack.setVariableInCurrentScope('_FASTBUILD_VERSION_', -1, [createNoLocationVariableDefinition('_FASTBUILD_VERSION_')]);

    return scopeStack;
}

interface DefineInfo {
    isPredefined: boolean;
    definition: VariableDefinition;
}

// Returns a map of defines to variable definitions for the defines.
function createDefaultDefines(rootFbuildUri: string, scopeStack: ScopeStack): Map<string, DefineInfo> {
    const defines = new Map<string, DefineInfo>();
    const platformSpecificSymbol = getPlatformSpecificDefineSymbol();
    const dummyRange = SourceRange.create(rootFbuildUri, 0, 0, 0, 0);
    const info: DefineInfo = {
        isPredefined: true,
        definition: scopeStack.createVariableDefinition(dummyRange, platformSpecificSymbol),
    };
    defines.set(platformSpecificSymbol, info);
    return defines;
}
// thisFbuildUri is used to calculate relative paths (e.g. from #include)
export function evaluate(parseData: ParseData, thisFbuildUri: string, fileSystem: IFileSystem, parseDataProvider: ParseDataProvider): DataAndMaybeError<EvaluatedData> {
    const rootFbuildDirUri = vscodeUri.Utils.dirname(vscodeUri.URI.parse(thisFbuildUri));
    const scopeStack = createDefaultScopeStack(rootFbuildDirUri);
    const context: EvaluationContext = {
        evaluatedData: new EvaluatedData(),
        scopeStack,
        defines: createDefaultDefines(rootFbuildDirUri.toString(), scopeStack),
        userFunctions: new Map<string, UserFunction>(),
        rootFbuildDirUri,
        thisFbuildUri,
        fileSystem,
        parseDataProvider,
        onceIncludeUrisAlreadyIncluded: [],
        previousStatementLhs: null,
    };
    const error = evaluateStatements(parseData.statements, context);
    return new DataAndMaybeError(context.evaluatedData, error);
}

// The resulting evaluated data is stored in `context.evaluatedData`.
// Returns `Error` on fatal error, or `null` otherwise.
function evaluateStatements(statements: Statement[], context: EvaluationContext): Error | null {
    try {
        for (const statement of statements) {
            let statementLhs: VariableAndEvaluatedVariable | null = null;

            if (isParsedStatementVariableDefintion(statement)) {
                const maybeStatementLhs = evaluateStatementVariableDefinition(statement, context);
                if (maybeStatementLhs.hasError) {
                    return maybeStatementLhs.getError();
                }
                statementLhs = maybeStatementLhs.getValue();
            } else if (isParsedStatementBinaryOperator(statement)) {
                const maybeStatementLhs = evaluateStatementBinaryOperator(statement, context);
                if (maybeStatementLhs.hasError) {
                    return maybeStatementLhs.getError();
                }
                statementLhs = maybeStatementLhs.getValue();
            } else if (isParsedStatementBinaryOperatorOnUnnamed(statement)) {
                const maybeStatementLhs = evaluateStatementBinaryOperatorOnUnnamed(statement, context);
                if (maybeStatementLhs.hasError) {
                    return maybeStatementLhs.getError();
                }
                statementLhs = maybeStatementLhs.getValue();
            } else if (isParsedStatementScopedStatements(statement)) {
                const error = evaluateStatementScopedStatements(statement, context);
                if (error !== null) {
                    return error;
                }
            } else if (isParsedStatementUsing(statement)) {
                const error = evaluateStatementUsing(statement, context);
                if (error !== null) {
                    return error;
                }
            } else if (isParsedStatementForEach(statement)) {
                const error = evaluateStatementForEach(statement, context);
                if (error !== null) {
                    return error;
                }
            } else if (isParsedStatementGenericFunction(statement)) {
                const error = evaluateStatementGenericFunction(statement, context);
                if (error !== null) {
                    return error;
                }
            } else if (isParsedStatementError(statement)) {
                const error = evaluateStatementError(statement, context);
                if (error !== null) {
                    return error;
                }
            } else if (isParsedStatementPrint(statement)) {
                const error = evaluateStatementPrint(statement, context);
                if (error !== null) {
                    return error;
                }
            } else if (isParsedStatementSettings(statement)) {
                const error = evaluateStatementSettings(statement, context);
                if (error !== null) {
                    return error;
                }
            } else if (isParsedStatementIf(statement)) {
                const error = evaluateStatementIf(statement, context);
                if (error !== null) {
                    return error;
                }
            } else if (isParsedStatementUserFunctionDeclaration(statement)) {
                evaluateStatementUserFunctionDeclaration(statement, context);
            } else if (isParsedStatementUserFunctionCall(statement)) {
                const error = evaluateStatementUserFunctionCall(statement, context);
                if (error !== null) {
                    return error;
                }
            } else if (isParsedStatementInclude(statement)) {  // #include
                const error = evaluateStatementInclude(statement, context);
                if (error !== null) {
                    return error;
                }
            } else if (isParsedStatementOnce(statement)) {  // #once
                context.onceIncludeUrisAlreadyIncluded.push(context.thisFbuildUri);
            } else if (isParsedStatementDirectiveIf(statement)) {  // #if
                const maybeStatementLhs = evaluateStatementDirectiveIf(statement, context);
                if (maybeStatementLhs.hasError) {
                    return maybeStatementLhs.getError();
                }
                statementLhs = maybeStatementLhs.getValue();
            } else if (isParsedStatementDefine(statement)) {  // #define
                evaluateStatementDefine(statement, context);
            } else if (isParsedStatementUndefine(statement)) {  // #undef
                const error = evaluateStatementUndefine(statement, context);
                if (error !== null) {
                    return error;
                }
            } else if (isParsedStatementImportEnvVar(statement)) {  // #import
                const error = evaluateStatementImportEnvVar(statement, context);
                if (error !== null) {
                    return error;
                }
            } else {
                const dummyRange = SourceRange.create(context.thisFbuildUri, 0, 0, 0, 0);
                return new InternalEvaluationError(dummyRange, `Unknown statement type '${statement.type}' from statement ${JSON.stringify(statement)}`);
            }

            context.previousStatementLhs = statementLhs;
        }
    } catch (error) {
        if (error instanceof Error) {
            return error;
        } else {
            // We should only throw `Error` instances, but handle other types as a fallback.
            // `error` could be anything. Try to get a useful message out of it.
            const typedError = new Error(String(error));
            return typedError;
        }
    }

    return null;
}

// Returns an `Error` on fatal error, or the statement's LHS otherwise.
function evaluateStatementVariableDefinition(statement: ParsedStatementVariableDefintion, context: EvaluationContext): Maybe<VariableAndEvaluatedVariable> {
    const maybeEvaluatedRhs = evaluateRValue(statement.rhs, context);
    if (maybeEvaluatedRhs.hasError) {
        return Maybe.error(maybeEvaluatedRhs.getError());
    }
    const evaluatedRhs = maybeEvaluatedRhs.getValue();

    const lhs: ParsedVariableDefinitionLhs = statement.lhs;
    const lhsRange = new SourceRange(context.thisFbuildUri, lhs.range);

    const maybeEvaluatedLhsName = evaluateRValue(lhs.name, context);
    if (maybeEvaluatedLhsName.hasError) {
        return Maybe.error(maybeEvaluatedLhsName.getError());
    }
    const evaluatedLhsName = maybeEvaluatedLhsName.getValue();
    if (typeof evaluatedLhsName.value !== 'string') {
        return Maybe.error(new EvaluationError(lhsRange, `Variable name must evaluate to a String, but instead evaluates to ${getValueTypeNameA(evaluatedLhsName.value)}`, []));
    }

    let variable: ScopeVariable | null = null;
    let existingValue: Value | null = null;
    // Copy the RHS value so that future modifications to the value do not modify the RHS value.
    const value = deepCopyValue(evaluatedRhs.value);
    if (lhs.scope === 'current') {
        const existingVariable = context.scopeStack.getVariableInCurrentScope(evaluatedLhsName.value);
        if (existingVariable !== null) {
            existingValue = existingVariable.value;
        }

        const definition = context.scopeStack.createVariableDefinition(lhsRange, evaluatedLhsName.value);
        variable = context.scopeStack.setVariableInCurrentScope(evaluatedLhsName.value, value, [definition]);

        if (existingVariable === null) {
            // The definition's LHS is a variable definition.
            context.evaluatedData.variableDefinitions.push(definition);
        }
    } else {
        const maybeVariable = context.scopeStack.getVariableStartingFromParentScopeOrError(evaluatedLhsName.value, lhsRange);
        if (maybeVariable.hasError) {
            return Maybe.error(maybeVariable.getError());
        }
        variable = maybeVariable.getValue();
        existingValue = variable.value;
        variable.value = value;
    }

    // Assigning a non-Array to an Array results in an Array with a single item: the RHS.
    if (existingValue !== null && existingValue instanceof Array && !(value instanceof Array)) {
        if (existingValue.length === 0) {
            // Assignment to an empty Array: the RHS can be any valid Array.
            if (typeof value !== 'string' && !(value instanceof Struct)) {
                const errorRange = new SourceRange(context.thisFbuildUri, evaluatedRhs.range);
                return Maybe.error(new EvaluationError(new SourceRange(context.thisFbuildUri, errorRange), `Cannot assign ${getValueTypeNameA(value)} to an Array. Arrays can only contain Strings or Structs.`, []));
            }
        } else {
            // Assignment to a non-empty Array: the RHS items must be of the same type as the LHS.
            const lhsFirstItem = existingValue[0];
            if ((typeof lhsFirstItem === 'string' && typeof value !== 'string')
                || (lhsFirstItem instanceof Struct && !(value instanceof Struct)))
            {
                const errorRange = new SourceRange(context.thisFbuildUri, evaluatedRhs.range);
                return Maybe.error(new EvaluationError(new SourceRange(context.thisFbuildUri, errorRange), `Cannot assign ${getValueTypeNameA(value)} to an Array of ${getValueTypeName(lhsFirstItem)}s.`, []));
            }
        }
        variable.value = [value];
    }

    // The definition's LHS is a variable reference.
    context.evaluatedData.variableReferences.push({
        definitions: variable.definitions,
        range: lhsRange,
    });

    // The definition's LHS is an evaluation.
    const evaluatedVariable: EvaluatedVariable = {
        // Deep copy the value so that future modifications don't modify this captured evaluation.
        value: deepCopyValue(variable.value),
        range: lhsRange,
    };
    context.evaluatedData.evaluatedVariables.push(evaluatedVariable);

    const statementLhs: VariableAndEvaluatedVariable = {
        variable,
        evaluatedVariable,
    };
    return Maybe.ok(statementLhs);
}

// Returns an `Error` on fatal error, or the statement's LHS otherwise.
function evaluateStatementBinaryOperator(statement: ParsedStatementBinaryOperator, context: EvaluationContext): Maybe<VariableAndEvaluatedVariable> {
    const lhs = statement.lhs;
    const lhsRange = new SourceRange(context.thisFbuildUri, lhs.range);

    const maybeEvaluatedLhsName = evaluateRValue(lhs.name, context);
    if (maybeEvaluatedLhsName.hasError) {
        return Maybe.error(maybeEvaluatedLhsName.getError());
    }
    const evaluatedLhsName = maybeEvaluatedLhsName.getValue();
    if (typeof evaluatedLhsName.value !== 'string') {
        return Maybe.error(new EvaluationError(lhsRange, `Variable name must evaluate to a String, but instead evaluates to ${getValueTypeNameA(evaluatedLhsName.value)}`, []));
    }

    let lhsVariable: ScopeVariable;
    let maybeExistingVariableStartingFromParentScope: ScopeVariable | null;
    // Adding to a current-scope non-existant, parent-scope existant variable defines it in the current scope to be the sum.
    if (lhs.scope === 'current'
        && context.scopeStack.getVariableInCurrentScope(evaluatedLhsName.value) === null
        && (maybeExistingVariableStartingFromParentScope = context.scopeStack.getVariableStartingFromCurrentScope(evaluatedLhsName.value)) !== null)
    {
        const previousValue = maybeExistingVariableStartingFromParentScope.value;
        const definition = context.scopeStack.createVariableDefinition(lhsRange, evaluatedLhsName.value);
        context.evaluatedData.variableDefinitions.push(definition);
        lhsVariable = context.scopeStack.setVariableInCurrentScope(evaluatedLhsName.value, previousValue, [definition]);
    } else {
        const maybeExistingVariable = context.scopeStack.getVariableInScopeOrError(lhs.scope, evaluatedLhsName.value, lhsRange);
        if (maybeExistingVariable.hasError) {
            return Maybe.error(maybeExistingVariable.getError());
        }
        lhsVariable = maybeExistingVariable.getValue();
    }

    const maybeEvaluatedRhs = evaluateRValue(statement.rhs, context);
    if (maybeEvaluatedRhs.hasError) {
        return Maybe.error(maybeEvaluatedRhs.getError());
    }
    const evaluatedRhs = maybeEvaluatedRhs.getValue();

    const binaryOperatorRange = SourceRange.createFromPosition(context.thisFbuildUri, lhs.range.start, evaluatedRhs.range.end);
    let inPlaceBinaryOperatorFunc: (existingValue: Value, summand: Value, range: SourceRange) => Maybe<Value>;
    switch (statement.operator) {
        case '+':
            inPlaceBinaryOperatorFunc = inPlaceAdd;
            break;
        case '-':
            inPlaceBinaryOperatorFunc = inPlaceSubtract;
            break;
    }
    const maybeOperatorResult = inPlaceBinaryOperatorFunc(lhsVariable.value, evaluatedRhs.value, binaryOperatorRange);
    if (maybeOperatorResult.hasError) {
        return Maybe.error(maybeOperatorResult.getError());
    }
    lhsVariable.value = maybeOperatorResult.getValue();

    // The LHS is a variable reference.
    context.evaluatedData.variableReferences.push({
        definitions: lhsVariable.definitions,
        range: lhsRange,
    });

    // The LHS is an evaluated variable.
    // We could also add an entry for the pre-operator value that we read, but it's not very useful and reduces clarity because normally you just want to read the new value, not the old value.
    const evaluatedVariable: EvaluatedVariable = {
        value: deepCopyValue(lhsVariable.value),
        range: lhsRange,
    };
    context.evaluatedData.evaluatedVariables.push(evaluatedVariable);

    const statementLhs: VariableAndEvaluatedVariable = {
        variable: lhsVariable,
        evaluatedVariable,
    };
    return Maybe.ok(statementLhs);
}

// Returns an `Error` on fatal error, or the statement's LHS otherwise.
function evaluateStatementBinaryOperatorOnUnnamed(statement: ParsedStatementBinaryOperatorOnUnnamed, context: EvaluationContext): Maybe<VariableAndEvaluatedVariable> {
    if (context.previousStatementLhs === null) {
        const range = SourceRange.createFromPosition(context.thisFbuildUri, statement.rangeStart, statement.rangeStart);
        return Maybe.error(new EvaluationError(range, 'Unnamed modification must follow a variable assignment in the same scope.', []));
    }
    const lhsVariable = context.previousStatementLhs.variable;

    const maybeEvaluatedRhs = evaluateRValue(statement.rhs, context);
    if (maybeEvaluatedRhs.hasError) {
        return Maybe.error(maybeEvaluatedRhs.getError());
    }
    const evaluatedRhs = maybeEvaluatedRhs.getValue();

    const binaryOperatorRange = SourceRange.createFromPosition(context.thisFbuildUri, statement.rangeStart, evaluatedRhs.range.end);
    let inPlaceBinaryOperatorFunc: (existingValue: Value, summand: Value, range: SourceRange) => Maybe<Value>;
    switch (statement.operator) {
        case '+':
            inPlaceBinaryOperatorFunc = inPlaceAdd;
            break;
        case '-':
            inPlaceBinaryOperatorFunc = inPlaceSubtract;
            break;
    }
    const maybeOperatorResult = inPlaceBinaryOperatorFunc(lhsVariable.value, evaluatedRhs.value, binaryOperatorRange);
    if (maybeOperatorResult.hasError) {
        return Maybe.error(maybeOperatorResult.getError());
    }
    lhsVariable.value = maybeOperatorResult.getValue();

    // Modify the previous statement's LHS variable evaluation to be the new value.
    // We could instead capture both the previous value and the new value, but it's not very useful and reduces clarity because normally you just want to read the new value, not the old value.
    context.previousStatementLhs.evaluatedVariable.value = lhsVariable.value;

    // Allow chaining of unnamed operators.
    return Maybe.ok(context.previousStatementLhs);
}

// Returns `Error` on fatal error, or `null` otherwise.
function evaluateStatementScopedStatements(statement: ParsedStatementScopedStatements, context: EvaluationContext): Error | null {
    let error: Error | null = null;
    context.scopeStack.withScope(() => {
        error = evaluateStatements(statement.statements, context);
    });
    return error;
}

// Returns `Error` on fatal error, or `null` otherwise.
function evaluateStatementUsing(statement: ParsedStatementUsing, context: EvaluationContext): Error | null {
    const statementRange = new SourceRange(context.thisFbuildUri, statement.range);
    const structRange = new SourceRange(context.thisFbuildUri, statement.struct.range);

    if (statement.struct.type !== 'evaluatedVariable') {
        return new EvaluationError(structRange, `'Using' parameter must be an evaluated variable, but instead is '${statement.struct.type}'`, []);
    }
    const maybeEvaluated = evaluateEvaluatedVariable(statement.struct, context);
    if (maybeEvaluated.hasError) {
        return maybeEvaluated.getError();
    }
    const evaluated = maybeEvaluated.getValue();

    const structVariable = evaluated.valueScopeVariable;
    const struct = structVariable.value;
    if (!(struct instanceof Struct)) {
        return new EvaluationError(structRange, `'Using' parameter must be a Struct, but instead is ${getValueTypeNameA(struct)}`, []);
    }

    //
    // For each struct member:
    //   * If it is already defined in the current scope, update it and add a reference to the definition.
    //   * Otherwise, define it and add a reference to the definition.
    //   * Either way, add references to:
    //       * the struct member's definition from the statement
    //       * the current scope's variable-from-member's definition from the member's definition

    for (const [structMemberName, structMember] of struct.members) {
        let variableDefinitions: AtLeast1VariableDefinition;
        const existingVariable = context.scopeStack.getVariableInCurrentScope(structMemberName);
        if (existingVariable !== null) {
            existingVariable.value = structMember.value;
            variableDefinitions = existingVariable.definitions;
        } else {
            const newDefinition = context.scopeStack.createVariableDefinition(statementRange, structMemberName);
            variableDefinitions = structMember.definitions.concat(newDefinition) as AtLeast1VariableDefinition;
            context.scopeStack.setVariableInCurrentScope(structMemberName, structMember.value, variableDefinitions);
            context.evaluatedData.variableDefinitions.push(newDefinition);
        }

        context.evaluatedData.variableReferences.push(
            // The `Using` statement references the variable definition being set to the new value,
            // which is either the existing definition, if one exists, or the new defintion otherwise.
            {
                definitions: variableDefinitions,
                range: statementRange,
            },
            // // The `Using` statement references the struct's member's definition.
            {
                definitions: structMember.definitions,
                range: statementRange,
            },
        );
        // The struct's member's definition references the variable definition being set to the new value,
        // which is either the existing definition, if one exists, or the new defintion otherwise.
        for (const structMemberDefinition of structMember.definitions) {
            context.evaluatedData.variableReferences.push({
                definitions: variableDefinitions,
                range: structMemberDefinition.range,
            });
        }
    }

    return null;
}

// Returns `Error` on fatal error, or `null` otherwise.
function evaluateStatementForEach(statement: ParsedStatementForEach, context: EvaluationContext): Error | null {
    // Evaluate the iterators (array to loop over plus the loop-variable)
    interface ForEachIterator {
        loopVariable: ScopeVariable;
        loopVariableRange: SourceRange;
        arrayItems: Value[];
    }
    const iterators: ForEachIterator[] = [];
    for (const iterator of statement.iterators) {
        // Evaluate the array to loop over.
        if (iterator.arrayToLoopOver.type !== 'evaluatedVariable') {
            const range = new SourceRange(context.thisFbuildUri, statement.range);
            return new InternalEvaluationError(range, `'ForEach' array to loop over must be an evaluated variable, but instead is '${iterator.arrayToLoopOver.type}'`);
        }
        const arrayToLoopOverRange = new SourceRange(context.thisFbuildUri, iterator.arrayToLoopOver.range);
        const maybeEvaluatedArrayToLoopOver = evaluateEvaluatedVariable(iterator.arrayToLoopOver, context);
        if (maybeEvaluatedArrayToLoopOver.hasError) {
            return maybeEvaluatedArrayToLoopOver.getError();
        }
        const evaluatedArrayToLoopOver = maybeEvaluatedArrayToLoopOver.getValue();
        const arrayItems = evaluatedArrayToLoopOver.valueScopeVariable.value;
        if (!(arrayItems instanceof Array)) {
            return new EvaluationError(arrayToLoopOverRange, `'ForEach' variable to loop over must be an Array, but instead is ${getValueTypeNameA(arrayItems)}`, []);
        }

        if ((iterators.length > 0) && (arrayItems.length != iterators[0].arrayItems.length)) {
            return new EvaluationError(arrayToLoopOverRange, `'ForEach' Array variable to loop over contains ${arrayItems.length} elements, but the loop is for ${iterators[0].arrayItems.length} elements.`, []);
        }

        const loopVar = iterator.loopVar;
        const loopVarRange = new SourceRange(context.thisFbuildUri, loopVar.range);

        // Evaluate the loop-variable name.
        const maybeEvaluatedLoopVarName = evaluateRValue(loopVar.name, context);
        if (maybeEvaluatedLoopVarName.hasError) {
            return maybeEvaluatedLoopVarName.getError();
        }
        const evaluatedLoopVarName = maybeEvaluatedLoopVarName.getValue();
        if (typeof evaluatedLoopVarName.value !== 'string') {
            return new InternalEvaluationError(loopVarRange, `Variable name must evaluate to a String, but instead evaluates to ${getValueTypeNameA(evaluatedLoopVarName.value)}`);
        }
        const evaluatedLoopVarNameValue: string = evaluatedLoopVarName.value;

        const loopVarDefinition = context.scopeStack.createVariableDefinition(loopVarRange, evaluatedLoopVarNameValue);

        // The loop variable is a definition and a reference.
        context.evaluatedData.variableDefinitions.push(loopVarDefinition);
        context.evaluatedData.variableReferences.push({
            definitions: [loopVarDefinition],
            range: loopVarRange,
        });

        // Set a variable in the current scope for each iterator's loop variable.
        const loopVariable = context.scopeStack.setVariableInCurrentScope(evaluatedLoopVarNameValue, 0, [loopVarDefinition]);
        iterators.push({
            loopVariable,
            loopVariableRange: loopVarRange,
            arrayItems,
        });
    }

    // Evaluate the ForEach body.

    let error: Error | null = null;
    const arrayItemsLength = iterators[0].arrayItems.length;
    for (let arrayItemIndex = 0; arrayItemIndex < arrayItemsLength; arrayItemIndex++) {
        context.scopeStack.withScope(() => {
            // Update the loop variables' values and add evaluated-variables for them.
            for (const iterator of iterators) {
                const arrayItem = iterator.arrayItems[arrayItemIndex];
                iterator.loopVariable.value = arrayItem;

                context.evaluatedData.evaluatedVariables.push({
                    value: arrayItem,
                    range: iterator.loopVariableRange,
                });
            }

            error = evaluateStatements(statement.statements, context);
            if (error !== null) {
                return;
            }
        });
    }
    return error;
}

// Returns `Error` on fatal error, or `null` otherwise.
function evaluateStatementGenericFunction(statement: ParsedStatementGenericFunction, context: EvaluationContext): Error | null {
    // Evaluate the target name.
    const maybeEvaluatedTargetNameName = evaluateRValue(statement.targetName, context);
    if (maybeEvaluatedTargetNameName.hasError) {
        return maybeEvaluatedTargetNameName.getError();
    }
    const evaluatedTargetName = maybeEvaluatedTargetNameName.getValue();
    const evaluatedTargetNameRange = new SourceRange(context.thisFbuildUri, evaluatedTargetName.range);
    if (typeof evaluatedTargetName.value !== 'string') {
        return new EvaluationError(evaluatedTargetNameRange, `Target name must evaluate to a String, but instead evaluates to ${getValueTypeNameA(evaluatedTargetName.value)}`, []);
    }

    // Ensure that this doesn't resuse an existing target name.
    const existingTargetDefinition = context.evaluatedData.targetDefinitions.get(evaluatedTargetName.value);
    if (existingTargetDefinition !== undefined) {
        const existingTargetDefinitionInfo: ErrorRelatedInformation = {
            range: existingTargetDefinition.range,
            message: 'Defined here',
        };
        context.evaluatedData.nonFatalErrors.push(new EvaluationError(
            evaluatedTargetNameRange,
            `Target name "${evaluatedTargetName.value}" already exists`,
            [existingTargetDefinitionInfo]
        )
        );
        return null;
    }

    // Create a definition and reference for the target name.
    const targetNameDefinition = context.scopeStack.createTargetDefinition(evaluatedTargetNameRange);
    const targetNameReference: TargetReference = {
        definition: targetNameDefinition,
        range: evaluatedTargetNameRange,
    };
    context.evaluatedData.targetDefinitions.set(evaluatedTargetName.value, targetNameDefinition);
    context.evaluatedData.targetReferences.push(targetNameReference);

    // Evaluate the function body.
    let error: Error | null = null;
    context.scopeStack.withScope(() => {
        error = evaluateStatements(statement.statements, context);
        if (error !== null) {
            return;
        }

        // Ensure that all required properties are set.
        const functionMetadata = GENERIC_FUNCTION_METADATA_BY_NAME.get(statement.functionName);
        if (functionMetadata === undefined) {
            error = new InternalEvaluationError(
                new SourceRange(context.thisFbuildUri, statement.range),
                `Missing metadata for function ${statement.functionName}`
            );
            return;
        }
        const missingPropertyNames = [];
        for (const requiredPropertyName of functionMetadata.requiredPropertyNames) {
            const propertyVariable = context.scopeStack.getVariableStartingFromCurrentScope(requiredPropertyName);
            if (propertyVariable === null) {
                missingPropertyNames.push(requiredPropertyName);
            }
        }
        if (missingPropertyNames.length > 0) {
            const pluralizedPropertyWord = (missingPropertyNames.length === 1) ? 'property' : 'properties';
            const missingPropertyNamesString = missingPropertyNames.map(name => `"${name}"`).join(', ');
            context.evaluatedData.nonFatalErrors.push(new EvaluationError(
                new SourceRange(context.thisFbuildUri, statement.range),
                `Call to function "${statement.functionName}" is missing required ${pluralizedPropertyWord} ${missingPropertyNamesString}.`,
                []
            ));
            return;
        }
    });
    return error;
}

// Returns `Error` on fatal error, or `null` otherwise.
function evaluateStatementError(statement: ParsedStatementError, context: EvaluationContext): Error | null {
    const maybeEvaluatedValue = evaluateRValue(statement.value, context);
    if (maybeEvaluatedValue.hasError) {
        return maybeEvaluatedValue.getError();
    }
    const evaluatedValue = maybeEvaluatedValue.getValue();
    if (typeof evaluatedValue.value !== 'string') {
        const range = new SourceRange(context.thisFbuildUri, statement.range);
        return new InternalEvaluationError(range, `'Error' argument must evaluate to a String, but instead evaluates to ${getValueTypeNameA(evaluatedValue.value)}`);
    }
    return null;
}

// Returns `Error` on fatal error, or `null` otherwise.
function evaluateStatementPrint(statement: ParsedStatementPrint, context: EvaluationContext): Error | null {
    const value = statement.value;
    const maybeEvaluatedValue = evaluateRValue(value, context);
    if (maybeEvaluatedValue.hasError) {
        return maybeEvaluatedValue.getError();
    }
    const evaluatedValue = maybeEvaluatedValue.getValue();
    if (!isParsedEvaluatedVariable(value) && typeof evaluatedValue.value !== 'string') {
        const range = new SourceRange(context.thisFbuildUri, statement.range);
        return new InternalEvaluationError(range, `'Print' argument must either be a variable or evaluate to a String, but instead is ${getValueTypeNameA(evaluatedValue.value)}`);
    }
    return null;
}

// Returns `Error` on fatal error, or `null` otherwise.
function evaluateStatementSettings(statement: ParsedStatementSettings, context: EvaluationContext): Error | null {
    // Evaluate the function body.
    let error: Error | null = null;
    context.scopeStack.withScope(() => {
        error = evaluateStatements(statement.statements, context);
    });
    return error;
}

// Returns `Error` on fatal error, or `null` otherwise.
function evaluateStatementIf(statement: ParsedStatementIf, context: EvaluationContext): Error | null {
    // Evaluate the condition.
    const condition = statement.condition;
    const statementRange = new SourceRange(context.thisFbuildUri, statement.range);
    const maybeEvaluatedCondition = evaluateIfCondition(condition, context, statementRange);
    if (maybeEvaluatedCondition.hasError) {
        return maybeEvaluatedCondition.getError();
    }
    const evaluatedCondition = maybeEvaluatedCondition.getValue();

    // Skip evaluating the function body if the condition was false.
    if (evaluatedCondition.condition === false) {
        return null;
    }

    // Evaluate the function body.
    let error: Error | null = null;
    context.scopeStack.withScope(() => {
        error = evaluateStatements(statement.statements, context);
    });
    return error;
}

// Returns an `Error` on fatal error, or `null` otherwise.
function evaluateStatementUserFunctionDeclaration(
    userFunction: ParsedStatementUserFunctionDeclaration,
    context: EvaluationContext
): void {
    const nameSourceRange = new SourceRange(context.thisFbuildUri, userFunction.nameRange);
    const functionNameDefinition = context.scopeStack.createVariableDefinition(nameSourceRange, userFunction.name);
    const functionNameReference: VariableReference = {
        definitions: [functionNameDefinition],
        range: nameSourceRange,
    };

    context.evaluatedData.variableReferences.push(functionNameReference);
    context.evaluatedData.variableDefinitions.push(functionNameDefinition);

    // Ensure that the function name is not reserved.
    if (RESERVED_SYMBOL_NAMES.has(userFunction.name)) {
        context.evaluatedData.nonFatalErrors.push(new EvaluationError(
            nameSourceRange,
            `Cannot use function name "${userFunction.name}" because it is reserved.`,
            []
        ));
        return;
    }

    const existingFunction = context.userFunctions.get(userFunction.name);
    // Ensure that the function name is not already used by another user function.
    if (existingFunction !== undefined) {
        const existingFunctionInfo: ErrorRelatedInformation = {
            range: existingFunction.definition.range,
            message: 'Defined here',
        };
        context.evaluatedData.nonFatalErrors.push(new EvaluationError(
            nameSourceRange,
            `Cannot use function name "${userFunction.name}" because it is already used by another user function. Functions must be uniquely named.`,
            [existingFunctionInfo]
        ));
        return;
    }

    // Define and reference each parameter.
    //
    // Ensure that the parameter names are unique.
    // Use an Array instead of a Set since we're optimizing for a small number of parameters.
    const usedParameterNames: string[] = [];
    for (const parameter of userFunction.parameters) {
        const paramSourceRange = new SourceRange(context.thisFbuildUri, parameter.range);

        if (usedParameterNames.includes(parameter.name)) {
            context.evaluatedData.nonFatalErrors.push(new EvaluationError(
                paramSourceRange,
                `User-function argument names must be unique.`,
                []
            ));
            return;
        }
        usedParameterNames.push(parameter.name);

        const definition = context.scopeStack.createVariableDefinition(paramSourceRange, parameter.name);
        parameter.definition = definition;

        context.evaluatedData.variableDefinitions.push(definition);
        context.evaluatedData.variableReferences.push({
            definitions: [definition],
            range: paramSourceRange,
        });
    }

    context.userFunctions.set(userFunction.name, {
        definition: functionNameDefinition,
        parameters: userFunction.parameters,
        statements: userFunction.statements,
    });
}

function evaluateStatementUserFunctionCall(
    call: ParsedStatementUserFunctionCall,
    context: EvaluationContext
): Error | null {
    const nameSourceRange = new SourceRange(context.thisFbuildUri, call.nameRange);

    // Lookup the function.
    const userFunction = context.userFunctions.get(call.name);
    if (userFunction === undefined) {
        return new EvaluationError(nameSourceRange, `No function exists with the name "${call.name}".`, []);
    }

    // Reference the function.
    context.evaluatedData.variableReferences.push({
        definitions: [userFunction.definition],
        range: nameSourceRange,
    });

    if (call.parameters.length !== userFunction.parameters.length) {
        const callSourceRange = new SourceRange(context.thisFbuildUri, call.range);
        const numExpectedArgumentsStr = `${userFunction.parameters.length} argument${userFunction.parameters.length === 1 ? '' : 's'}`;
        return new EvaluationError(callSourceRange, `User function "${call.name}" takes ${numExpectedArgumentsStr} but passing ${call.parameters.length}.`, []);
    }

    if (context.scopeStack.getDepth() > MAX_SCOPE_STACK_DEPTH) {
        const callSourceRange = new SourceRange(context.thisFbuildUri, call.range);
        return new EvaluationError(callSourceRange, 'Excessive scope depth. Possible infinite recursion from user function calls.', []);
    }

    // Evaluate the call-parameters' values.
    // Note that we evaluate the call's parameter in the current context, not the function call context.
    const paramValues: Value[] = new Array(call.parameters.length);
    for (const [i, callParam] of call.parameters.entries()) {
        const maybeEvaluatedValue = evaluateRValue(callParam.value, context);
        if (maybeEvaluatedValue.hasError) {
            return maybeEvaluatedValue.getError();
        }
        const evaluatedValue = maybeEvaluatedValue.getValue();
        paramValues[i] = evaluatedValue.value;
    }

    //
    // Call the function.
    //
    // Note that the call uses the current `EvaluationContext`, but the body of the call uses a new context.
    //
    let error: Error | null = null;
    // User functions can only use passed-in arguments and not variables in scope where they are defined.
    context.scopeStack.withPrivateScope(() => {
        const functionCallContext: EvaluationContext = {
            evaluatedData: context.evaluatedData,
            scopeStack: context.scopeStack,
            // User functions do not share defines.
            defines: createDefaultDefines(context.rootFbuildDirUri.toString(), context.scopeStack),
            // User functions can call other user functions.
            userFunctions: context.userFunctions,
            rootFbuildDirUri: context.rootFbuildDirUri,
            thisFbuildUri: context.thisFbuildUri,
            fileSystem: context.fileSystem,
            parseDataProvider: context.parseDataProvider,
            onceIncludeUrisAlreadyIncluded: context.onceIncludeUrisAlreadyIncluded,
            previousStatementLhs: null,
        };

        // Set a variable for each parameter.
        for (const [i, funcDeclarationParam] of userFunction.parameters.entries()) {
            if (funcDeclarationParam.definition === undefined) {
                const callParam = call.parameters[i];
                const callParamSourceRange = new SourceRange(context.thisFbuildUri, callParam.range);
                error = new InternalEvaluationError(callParamSourceRange, `Bug: user-function "${call.name}"'s "${funcDeclarationParam.name}" parameter has no definition`);
                return;
            }

            // Note that we set the variable in the function call context, not the current context.
            functionCallContext.scopeStack.setVariableInCurrentScope(funcDeclarationParam.name, paramValues[i], [funcDeclarationParam.definition]);
        }

        error = evaluateStatements(userFunction.statements, functionCallContext);
    });
    return error;
}

// Returns `Error` on fatal error, or `null` otherwise.
function evaluateStatementInclude(statement: ParsedStatementInclude, context: EvaluationContext): Error | null {
    const thisFbuildUriDir = vscodeUri.Utils.dirname(vscodeUri.URI.parse(context.thisFbuildUri));
    const includeUri = vscodeUri.Utils.resolvePath(thisFbuildUriDir, statement.path.value);
    const includeUriStr = includeUri.toString();
    const includeRange = new SourceRange(context.thisFbuildUri, statement.path.range);

    context.evaluatedData.includeDefinitions.add(includeUriStr);
    const includeReference: IncludeReference = {
        includeUri: includeUriStr,
        range: includeRange,
    };
    context.evaluatedData.includeReferences.push(includeReference);

    // Skip the include if it's marked to only be included once and it has already been included.
    if (context.onceIncludeUrisAlreadyIncluded.includes(includeUriStr)) {
        return null;
    }

    const maybeIncludeParseData = context.parseDataProvider.getParseData(includeUri);
    if (maybeIncludeParseData.hasError) {
        const includeError = maybeIncludeParseData.getError();
        let error: Error;
        if (includeError instanceof ParseError) {
            error = includeError;
        } else {
            error = new EvaluationError(includeRange, `Unable to open include: ${includeError.message}`, []);
        }
        return error;
    }
    const includeParseData = maybeIncludeParseData.getValue();

    // Save the current `_CURRENT_BFF_DIR_` value so that we can restore it after processing the include.
    const dummyRange = SourceRange.create(context.thisFbuildUri, 0, 0, 0, 0);
    const maybeCurrentBffDirVariable = context.scopeStack.getVariableStartingFromCurrentScopeOrError('_CURRENT_BFF_DIR_', dummyRange);
    if (maybeCurrentBffDirVariable.hasError) {
        return maybeCurrentBffDirVariable.getError();
    }
    const currentBffDirVariable = maybeCurrentBffDirVariable.getValue();
    const currentBffDirBeforeInclude = currentBffDirVariable.value;

    // Update the `_CURRENT_BFF_DIR_` value for the include.
    const includeDirRelativeToRoot = path.relative(context.rootFbuildDirUri.toString(), vscodeUri.Utils.dirname(includeUri).toString());
    currentBffDirVariable.value = includeDirRelativeToRoot;

    const includeContext: EvaluationContext = {
        evaluatedData: context.evaluatedData,
        scopeStack: context.scopeStack,
        defines: context.defines,
        userFunctions: context.userFunctions,
        rootFbuildDirUri: context.rootFbuildDirUri,
        thisFbuildUri: includeUriStr,
        fileSystem: context.fileSystem,
        parseDataProvider: context.parseDataProvider,
        onceIncludeUrisAlreadyIncluded: context.onceIncludeUrisAlreadyIncluded,
        previousStatementLhs: context.previousStatementLhs,
    };

    const error = evaluateStatements(includeParseData.statements, includeContext);
    if (error !== null) {
        return error;
    }

    // Restore the `_CURRENT_BFF_DIR_` value.
    currentBffDirVariable.value = currentBffDirBeforeInclude;

    return null;
}

// Returns `Error` on fatal error, or `null` otherwise.
function evaluateStatementDirectiveIf(statement: ParsedStatementDirectiveIf, context: EvaluationContext): Maybe<VariableAndEvaluatedVariable | null> {

    const maybeEvaluatedCondition = evaluateDirectiveIfCondition(statement, context);
    if (maybeEvaluatedCondition.hasError) {
        return Maybe.error(maybeEvaluatedCondition.getError());
    }

    // Evaluate the '#if' body statements if the condition was true.
    // Otherwise, evaluate the '#else' body statements.
    const statements = maybeEvaluatedCondition.getValue() ? statement.ifStatements : statement.elseStatements;
    const error = evaluateStatements(statements, context);
    if (error !== null) {
        return Maybe.error(error);
    }

    // Preserve the previous LHS variable in order to support embedding #if in a variable assignment expression.
    return Maybe.ok(context.previousStatementLhs);
}

function evaluateStatementDefine(statement: ParsedStatementDefine, context: EvaluationContext): void {
    const symbol = statement.symbol;
    const statementRange = new SourceRange(context.thisFbuildUri, statement.range);
    const existingDefine = context.defines.get(symbol);
    if (existingDefine !== undefined) {
        const existingDefineInfo: ErrorRelatedInformation = {
            range: existingDefine.definition.range,
            message: 'Defined here',
        };
        context.evaluatedData.nonFatalErrors.push(new EvaluationError(
            statementRange,
            `Cannot #define already defined symbol "${symbol}".`,
            [existingDefineInfo]
        ));
        return;
    }
    const definition = context.scopeStack.createVariableDefinition(statementRange, symbol);
    const info: DefineInfo = {
        isPredefined: false,
        definition,
    };
    context.defines.set(symbol, info);
    const reference: VariableReference = {
        definitions: [definition],
        range: statementRange,
    };
    context.evaluatedData.variableReferences.push(reference);
    context.evaluatedData.variableDefinitions.push(definition);
}

// Returns `Error` on fatal error, or `null` otherwise.
function evaluateStatementUndefine(statement: ParsedStatementUndefine, context: EvaluationContext): EvaluationError | null {
    const symbol = statement.symbol;
    const sourceRange = new SourceRange(context.thisFbuildUri, statement.range);
    if (symbol === getPlatformSpecificDefineSymbol()) {
        return new EvaluationError(sourceRange, `Cannot #undef built-in symbol "${symbol}".`, []);
    }
    if (!context.defines.has(symbol)) {
        return new EvaluationError(sourceRange, `Cannot #undef undefined symbol "${symbol}".`, []);
    }
    context.defines.delete(symbol);
    return null;
}

// Returns `Error` on fatal error, or `null` otherwise.
function evaluateStatementImportEnvVar(statement: ParsedStatementImportEnvVar, context: EvaluationContext): EvaluationError | null {
    // Read an environment variable and store the value in a variable with the same name as the environment variable.
    const symbolName = statement.symbol;
    const statementRange = new SourceRange(context.thisFbuildUri, statement.range);
    const environmentVariableValue = process.env[symbolName];
    if (environmentVariableValue === undefined) {
        return new EvaluationError(statementRange, `Cannot import environment variable "${symbolName}" because it does not exist.`, []);
    }
    const definition = context.scopeStack.createVariableDefinition(statementRange, symbolName);
    context.scopeStack.setVariableInCurrentScope(symbolName, environmentVariableValue, [definition]);

    const reference: VariableReference = {
        definitions: [definition],
        range: statementRange,
    };
    context.evaluatedData.variableReferences.push(reference);
    context.evaluatedData.variableDefinitions.push(definition);
    return null;
}

function evaluateRValue(rValue: any, context: EvaluationContext): Maybe<EvaluatedRValue> {
    if (isParsedString(rValue)) {
        return Maybe.ok({
            value: rValue.value,
            range: rValue.range,
        });
    } else if (isParsedStringExpression(rValue)) {
        const maybeEvaluated = evaluateStringExpression(rValue.parts, context);
        if (maybeEvaluated.hasError) {
            return Maybe.error(maybeEvaluated.getError());
        }
        const evaluated = maybeEvaluated.getValue();
        return Maybe.ok({
            value: evaluated.evaluatedString,
            range: rValue.range,
        });
    } else if (isParsedStruct(rValue)) {
        return evaluateStruct(rValue, context);
    } else if (isParsedSum(rValue)) {
        return evaluateSum(rValue, context);
    } else if (isParsedEvaluatedVariable(rValue)) {
        const maybeEvaluated = evaluateEvaluatedVariable(rValue, context);
        if (maybeEvaluated.hasError) {
            return Maybe.error(maybeEvaluated.getError());
        }
        const evaluated = maybeEvaluated.getValue();
        return Maybe.ok({
            value: evaluated.valueScopeVariable.value,
            range: rValue.range,
        });
    } else if (isParsedArray(rValue)) {
        const maybeEvaluated = evaluateRValueArray(rValue.value, rValue.range, context);
        if (maybeEvaluated.hasError) {
            return Maybe.error(maybeEvaluated.getError());
        }
        const evaluated = maybeEvaluated.getValue();
        return Maybe.ok({
            value: evaluated.value,
            range: rValue.range,
        });
    } else if (isParsedBoolean(rValue) || isParsedInteger(rValue)) {
        return Maybe.ok({
            value: rValue.value,
            range: rValue.range,
        });
    } else {
        const dummyRange = SourceRange.create(context.thisFbuildUri, 0, 0, 0, 0);
        return Maybe.error(new InternalEvaluationError(dummyRange, `Unsupported rValue ${JSON.stringify(rValue)}`));
    }
}

function evaluateRValueArray(
    rValue: any[],
    range: ParseSourceRange,
    context: EvaluationContext
): Maybe<EvaluatedRValue>
{
    const result: EvaluatedRValue = {
        value: [],
        range,
    };
    result.value = [];

    let firstItemTypeNameA: string | null = null;
    for (const item of rValue) {
        // Specially handle a #if inside an array's contents.
        if (isParsedStatementDirectiveIf(item)) {
            const directiveIfStatement = item;
            const maybeEvaluatedCondition = evaluateDirectiveIfCondition(directiveIfStatement, context);
            if (maybeEvaluatedCondition.hasError) {
                return Maybe.error(maybeEvaluatedCondition.getError());
            }

            // Evaluate the '#if' body statements if the condition was true.
            // Otherwise, evaluate the '#else' body statements.
            const contents = maybeEvaluatedCondition.getValue() ? directiveIfStatement.ifStatements : directiveIfStatement.elseStatements;
            const maybeEvaluated = evaluateRValueArray(contents, range, context);
            const evaluated = maybeEvaluated.getValue();
            if (maybeEvaluated.hasError) {
                return Maybe.error(maybeEvaluated.getError());
            }

            if (!(evaluated.value instanceof Array)) {
                return Maybe.error(new InternalEvaluationError(new SourceRange(context.thisFbuildUri, evaluated.range), 'Bug: directive if ("#if") body must evaluate to an Array.'));
            }

            pushToFirstArray(result.value, evaluated.value);
        } else {
            const maybeEvaluated = evaluateRValue(item, context);
            if (maybeEvaluated.hasError) {
                return Maybe.error(maybeEvaluated.getError());
            }
            const evaluated = maybeEvaluated.getValue();

            if (evaluated.value instanceof Array) {
                pushToFirstArray(result.value, evaluated.value);
            } else {
                if (firstItemTypeNameA === null) {
                    firstItemTypeNameA = getValueTypeNameA(evaluated.value);

                    if (typeof evaluated.value === 'boolean'
                        || typeof evaluated.value === 'number')
                    {
                        return Maybe.error(new EvaluationError(new SourceRange(context.thisFbuildUri, evaluated.range), `Cannot have an Array of ${getValueTypeName(evaluated.value)}s. Only Arrays of Strings and Arrays of Structs are allowed.`, []));
                    } else if (evaluated.value instanceof Struct && !isParsedEvaluatedVariable(item)) {
                        return Maybe.error(new EvaluationError(new SourceRange(context.thisFbuildUri, evaluated.range), `Cannot have an Array of literal Structs. Use an Array of evaluated variables instead.`, []));
                    }
                } else {
                    const itemTypeNameA = getValueTypeNameA(evaluated.value);
                    if (itemTypeNameA !== firstItemTypeNameA) {
                        return Maybe.error(new EvaluationError(new SourceRange(context.thisFbuildUri, evaluated.range), `All values in an Array must have the same type, but the first item is ${firstItemTypeNameA} and this item is ${itemTypeNameA}`, []));
                    }
                }

                result.value.push(evaluated.value);
            }
        }
    }
    return Maybe.ok(result);
}

function evaluateEvaluatedVariable(parsedEvaluatedVariable: ParsedEvaluatedVariable, context: EvaluationContext): Maybe<EvaluatedEvaluatedVariable> {
    const maybeEvaluatedVariableName = evaluateRValue(parsedEvaluatedVariable.name, context);
    if (maybeEvaluatedVariableName.hasError) {
        return Maybe.error(maybeEvaluatedVariableName.getError());
    }
    const evaluatedVariableName = maybeEvaluatedVariableName.getValue();
    const evaluatedVariableRange = new SourceRange(context.thisFbuildUri, parsedEvaluatedVariable.range);
    if (typeof evaluatedVariableName.value !== 'string') {
        return Maybe.error(new InternalEvaluationError(evaluatedVariableRange, `Variable name must evaluate to a String, but instead is ${getValueTypeNameA(evaluatedVariableName.value)}`));
    }

    const maybeValueScopeVariable = (parsedEvaluatedVariable.scope === 'current')
        ? context.scopeStack.getVariableStartingFromCurrentScopeOrError(evaluatedVariableName.value, evaluatedVariableRange)
        : context.scopeStack.getVariableStartingFromParentScopeOrError(evaluatedVariableName.value, evaluatedVariableRange);
    if (maybeValueScopeVariable.hasError) {
        return Maybe.error(maybeValueScopeVariable.getError());
    }
    const valueScopeVariable = maybeValueScopeVariable.getValue();

    const parsedEvaluatedVariableRange = new SourceRange(context.thisFbuildUri, parsedEvaluatedVariable.range);

    context.evaluatedData.evaluatedVariables.push({
        value: valueScopeVariable.value,
        range: parsedEvaluatedVariableRange,
    });

    context.evaluatedData.variableReferences.push({
        definitions: valueScopeVariable.definitions,
        range: parsedEvaluatedVariableRange,
    });

    const result: EvaluatedEvaluatedVariable = {
        valueScopeVariable,
    };
    return Maybe.ok(result);
}

// `parts` is an array of either strings or `evaluatedVariable` parse-data.
function evaluateStringExpression(parts: (string | any)[], context: EvaluationContext): Maybe<EvaluatedStringExpression> {
    let evaluatedString = '';
    for (const part of parts) {
        if (isParsedEvaluatedVariable(part)) {
            const maybeEvaluated = evaluateEvaluatedVariable(part, context);
            if (maybeEvaluated.hasError) {
                return Maybe.error(maybeEvaluated.getError());
            }
            const evaluated = maybeEvaluated.getValue();
            evaluatedString += String(evaluated.valueScopeVariable.value);
        } else {
            // Literal
            evaluatedString += part;
        }
    }

    const result: EvaluatedStringExpression = {
        evaluatedString,
    };
    return Maybe.ok(result);
}

function evaluateStruct(struct: ParsedStruct, context: EvaluationContext): Maybe<EvaluatedRValue> {
    let error: Error | null = null;
    let structScope = new Scope(true /*canAccessParentScopes*/);
    context.scopeStack.withScope(() => {
        error = evaluateStatements(struct.statements, context);
        structScope = context.scopeStack.getCurrentScope();
    });
    if (error !== null) {
        return Maybe.error(error);
    }

    const structMembers = new Map<VariableName, StructMember>();
    for (const [name, variable] of structScope.variables) {
        structMembers.set(name, new StructMember(variable.value, variable.definitions));
    }
    const evaluatedValue = new Struct(structMembers);

    const result: EvaluatedRValue = {
        value: evaluatedValue,
        range: struct.range,
    };
    return Maybe.ok(result);
}

function evaluateSum(sum: ParsedSum, context: EvaluationContext): Maybe<EvaluatedRValue> {
    if (sum.summands.length == 0) {
        const dummyRange = SourceRange.create(context.thisFbuildUri, 0, 0, 0, 0);
        return Maybe.error(new InternalEvaluationError(dummyRange, `A sum must have at least 2 values to add`));
    }

    const maybeResult = evaluateRValue(sum.first, context);
    if (maybeResult.hasError) {
        return maybeResult;
    }
    const result = maybeResult.getValue();

    // Copy the value so that we don't modify the EvaluatedVariable which references it when we add to it.
    result.value = deepCopyValue(result.value);

    let previousSummandValue = result;
    for (const summand of sum.summands) {
        const maybeEvaluatedSummand = evaluateRValue(summand.value, context);
        if (maybeEvaluatedSummand.hasError) {
            return Maybe.error(maybeEvaluatedSummand.getError());
        }
        const evaluatedSummand = maybeEvaluatedSummand.getValue();
        const binaryOperatorRange = SourceRange.createFromPosition(context.thisFbuildUri, previousSummandValue.range.start, evaluatedSummand.range.end);
        let inPlaceBinaryOperatorFunc: (existingValue: Value, summand: Value, range: SourceRange) => Maybe<Value>;
        switch (summand.operator) {
            case '+':
                inPlaceBinaryOperatorFunc = inPlaceAdd;
                break;
            case '-':
                inPlaceBinaryOperatorFunc = inPlaceSubtract;
                break;
        }
        const maybeSum = inPlaceBinaryOperatorFunc(result.value, evaluatedSummand.value, binaryOperatorRange);
        if (maybeSum.hasError) {
            return Maybe.error(maybeSum.getError());
        }
        result.value = maybeSum.getValue();
        previousSummandValue = summand.value;
    }

    return Maybe.ok(result);
}

// In-place add summand to existingValue, and return it.
function inPlaceAdd(existingValue: Value, summand: Value, additionRange: SourceRange): Maybe<Value> {
    if (existingValue instanceof Array) {
        if (summand instanceof Array) {
            existingValue.push(...summand);
        } else {
            existingValue.push(summand);
        }
    } else if (existingValue instanceof Struct) {
        if (summand instanceof Struct) {
            for (const [structMemberName, structMember] of summand.members) {
                existingValue.members.set(structMemberName, structMember);
            }
        } else {
            return Maybe.error(new EvaluationError(additionRange, `Cannot add ${getValueTypeNameA(summand)} to a Struct. Can only add a Struct.`, []));
        }
    } else if (typeof existingValue === 'string') {
        if (typeof summand === 'string') {
            existingValue += summand;
        } else {
            return Maybe.error(new EvaluationError(additionRange, `Cannot add ${getValueTypeNameA(summand)} to a String. Can only add a String.`, []));
        }
    } else if (typeof existingValue === 'number') {
        if (typeof summand === 'number') {
            existingValue += summand;
        } else {
            return Maybe.error(new EvaluationError(additionRange, `Cannot add ${getValueTypeNameA(summand)} to an Integer. Can only add an Integer.`, []));
        }
    } else if (typeof existingValue === 'boolean') {
        return Maybe.error(new EvaluationError(additionRange, `Cannot add to a Boolean.`, []));
    } else {
        return Maybe.error(new EvaluationError(additionRange, `Cannot add ${getValueTypeNameA(summand)} to ${getValueTypeNameA(existingValue)}.`, []));
    }

    return Maybe.ok(existingValue);
}

// In-place subtract valueToSubtract from existingValue, and return it.
function inPlaceSubtract(existingValue: Value, valueToSubtract: Value, subtractionRange: SourceRange): Maybe<Value> {
    if (existingValue instanceof Array) {
        if (existingValue.length > 0) {
            if (typeof existingValue[0] === 'string') {
                if (typeof valueToSubtract === 'string') {
                    // Remove all occurrences of |valueToSubtract|.
                    existingValue = existingValue.filter(value => value != valueToSubtract);
                } else {
                    return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract ${getValueTypeNameA(valueToSubtract)} from an Array of Strings. Can only subtract a String.`, []));
                }
            } else {
                return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract from an Array of ${getValueTypeName(existingValue[0])}s. Can only subtract from an Array if it is an Array of Strings.`, []));
            }
        }
    } else if (existingValue instanceof Struct) {
        return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract from a Struct.`, []));
    } else if (typeof existingValue === 'string') {
        if (typeof valueToSubtract === 'string') {
            // Remove all substrings of |valueToSubtract|.
            // This code can be refactored to use replaceAll once on Node version 15+: existingValue.replaceAll(valueToSubtract, '')
            const escapedValueToSubtract = valueToSubtract.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1");
            existingValue = existingValue.replace(new RegExp(escapedValueToSubtract, 'g'), '');
        } else {
            return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract ${getValueTypeNameA(valueToSubtract)} from a String. Can only subtract a String.`, []));
        }
    } else if (typeof existingValue === 'number') {
        if (typeof valueToSubtract === 'number') {
            existingValue -= valueToSubtract;
        } else {
            return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract ${getValueTypeNameA(valueToSubtract)} from an Integer. Can only subtract an Integer.`, []));
        }
    } else if (typeof existingValue === 'boolean') {
        return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract from a Boolean.`, []));
    } else {
        return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract ${getValueTypeNameA(valueToSubtract)} from ${getValueTypeNameA(existingValue)}.`, []));
    }

    return Maybe.ok(existingValue);
}

function evaluateIfCondition(
    condition: ParsedIfCondtion,
    context: EvaluationContext,
    statementRange: SourceRange
): Maybe<EvaluatedCondition>
{
    if (isParsedIfConditionBoolean(condition)) {
        const maybeEvaluatedCondition = evaluateRValue(condition.value, context);
        if (maybeEvaluatedCondition.hasError) {
            return Maybe.error(maybeEvaluatedCondition.getError());
        }
        const evaluatedCondition = maybeEvaluatedCondition.getValue();
        const evaluatedConditionValue = evaluatedCondition.value;
        if (typeof evaluatedConditionValue !== 'boolean') {
            const conditionValueRange = new SourceRange(context.thisFbuildUri, evaluatedCondition.range);
            return Maybe.error(new EvaluationError(conditionValueRange, `Condition must evaluate to a Boolean, but instead evaluates to ${getValueTypeNameA(evaluatedConditionValue)}`, []));
        }
        const result: EvaluatedCondition = {
            condition: condition.invert ? !evaluatedConditionValue : evaluatedConditionValue,
        };
        return Maybe.ok(result);
    } else if (isParsedIfConditionComparison(condition)) {
        // Evaluate LHS.
        const lhs = condition.lhs;
        const maybeEvaluatedLhs = evaluateRValue(lhs, context);
        if (maybeEvaluatedLhs.hasError) {
            return Maybe.error(maybeEvaluatedLhs.getError());
        }
        const evaluatedLhsValue = maybeEvaluatedLhs.getValue().value;

        // Evaluate RHS.
        const rhs = condition.rhs;
        const maybeEvaluatedRhs = evaluateRValue(rhs, context);
        if (maybeEvaluatedRhs.hasError) {
            return Maybe.error(maybeEvaluatedRhs.getError());
        }
        const evaluatedRhsValue = maybeEvaluatedRhs.getValue().value;

        const operator = condition.operator;

        // Verify that the type is allowed.
        // Just check the LHS type because below we check that the LHS and RHS types are equal.
        if (operator.value === '==' || operator.value === '!=') {
            if (!['boolean', 'string', 'number'].includes(typeof evaluatedLhsValue)) {
                const operatorRange = new SourceRange(context.thisFbuildUri, operator.range);
                return Maybe.error(new EvaluationError(operatorRange, `'If' comparison using '${operator.value}' only supports comparing Booleans, Strings, and Integers, but ${getValueTypeNameA(evaluatedLhsValue)} is used`, []));
            }
        } else {
            if (!['string', 'number'].includes(typeof evaluatedLhsValue)) {
                const operatorRange = new SourceRange(context.thisFbuildUri, operator.range);
                return Maybe.error(new EvaluationError(operatorRange, `'If' comparison using '${operator.value}' only supports comparing Strings and Integers, but ${getValueTypeNameA(evaluatedLhsValue)} is used`, []));
            }
        }

        if (typeof evaluatedLhsValue !== typeof evaluatedRhsValue) {
            const range = new SourceRange(context.thisFbuildUri, { start: lhs.range.start, end: rhs.range.end });
            return Maybe.error(new EvaluationError(range, `'If' condition comparison must compare variables of the same type, but LHS is ${getValueTypeNameA(evaluatedLhsValue)} and RHS is ${getValueTypeNameA(evaluatedRhsValue)}`, []));
        }

        let comparisonResult = false;
        switch (operator.value) {
            case '==':
                comparisonResult = evaluatedLhsValue == evaluatedRhsValue;
                break;
            case '!=':
                comparisonResult = evaluatedLhsValue != evaluatedRhsValue;
                break;
            case '<':
                comparisonResult = evaluatedLhsValue < evaluatedRhsValue;
                break;
            case '<=':
                comparisonResult = evaluatedLhsValue <= evaluatedRhsValue;
                break;
            case '>':
                comparisonResult = evaluatedLhsValue > evaluatedRhsValue;
                break;
            case '>=':
                comparisonResult = evaluatedLhsValue >= evaluatedRhsValue;
                break;
            default: {
                return Maybe.error(new InternalEvaluationError(statementRange, `Unknown 'If' comparison operator '${operator.value}'`));
            }
        }

        const result: EvaluatedCondition = {
            condition: comparisonResult,
        };
        return Maybe.ok(result);
    } else if (isParsedIfConditionIn(condition)) {
        // Evaluate LHS.
        const lhs = condition.lhs;
        const maybeEvaluatedLhs = evaluateRValue(lhs, context);
        if (maybeEvaluatedLhs.hasError) {
            return Maybe.error(maybeEvaluatedLhs.getError());
        }
        const evaluatedLhsValue = maybeEvaluatedLhs.getValue().value;

        // Evaluate RHS.
        const rhs = condition.rhs;
        const maybeEvaluatedRhs = evaluateRValue(rhs, context);
        if (maybeEvaluatedRhs.hasError) {
            return Maybe.error(maybeEvaluatedRhs.getError());
        }
        const evaluatedRhsValue = maybeEvaluatedRhs.getValue().value;
        const rhsRange = new SourceRange(context.thisFbuildUri, rhs.range);

        //
        // Check presence.
        //

        let isPresent = true;

        if (!(evaluatedRhsValue instanceof Array)) {
            return Maybe.error(new EvaluationError(rhsRange, `'If' 'in' condition right-hand-side value must be an Array of Strings, but instead is ${getValueTypeNameA(evaluatedRhsValue)}`, []));
        }

        if (!isParsedEvaluatedVariable(rhs)) {
            return Maybe.error(new EvaluationError(rhsRange, `'If' 'in' condition right-hand-side value cannot be a literal Array Of Strings. Instead use an evaluated variable.`, []));
        }

        if (evaluatedRhsValue.length === 0) {
            isPresent = false;
        } else if (typeof evaluatedRhsValue[0] === 'string') {
            const lhsRange = new SourceRange(context.thisFbuildUri, lhs.range);
            if (typeof evaluatedLhsValue === 'string') {
                isPresent = evaluatedRhsValue.includes(evaluatedLhsValue);
            } else if (evaluatedLhsValue instanceof Array) {
                if (!isParsedEvaluatedVariable(lhs)) {
                    return Maybe.error(new EvaluationError(lhsRange, `'If' 'in' condition left-hand-side value cannot be a literal Array Of Strings. Instead use an evaluated variable.`, []));
                }

                if (evaluatedLhsValue.length === 0) {
                    isPresent = false;
                } else if (typeof evaluatedLhsValue[0] === 'string') {
                    isPresent = evaluatedLhsValue.some(searchString => evaluatedRhsValue.includes(searchString));
                } else {
                    return Maybe.error(new EvaluationError(lhsRange, `'If' 'in' condition left-hand-side value must be either a String or an Array of Strings, but instead is an Array of ${getValueTypeName(evaluatedLhsValue[0])}s`, []));
                }
            } else {
                return Maybe.error(new EvaluationError(lhsRange, `'If' 'in' condition left-hand-side value must be either a String or an Array of Strings, but instead is ${getValueTypeNameA(evaluatedLhsValue)}`, []));
            }
        } else {
            return Maybe.error(new EvaluationError(rhsRange, `'If' 'in' condition right-hand-side value must be an Array of Strings, but instead is an Array of ${getValueTypeName(evaluatedRhsValue[0])}s`, []));
        }

        const result: EvaluatedCondition = {
            condition: condition.invert ? !isPresent : isPresent,
        };
        return Maybe.ok(result);
    } else if (isParsedIfConditionOperatorAnd(condition)) {
        // Evaluate LHS
        const maybeEvaluatedLhs = evaluateIfCondition(condition.lhs, context, statementRange);
        if (maybeEvaluatedLhs.hasError) {
            return Maybe.error(maybeEvaluatedLhs.getError());
        }
        const evaluatedLhs = maybeEvaluatedLhs.getValue();

        // Evaluate RHS
        const maybeEvaluatedRhs = evaluateIfCondition(condition.rhs, context, statementRange);
        if (maybeEvaluatedRhs.hasError) {
            return Maybe.error(maybeEvaluatedRhs.getError());
        }
        const evaluatedRhs = maybeEvaluatedRhs.getValue();

        const result: EvaluatedCondition = {
            condition: evaluatedLhs.condition && evaluatedRhs.condition,
        };
        return Maybe.ok(result);
    } else if (isParsedIfConditionOperatorOr(condition)) {
        // Evaluate LHS
        const maybeEvaluatedLhs = evaluateIfCondition(condition.lhs, context, statementRange);
        if (maybeEvaluatedLhs.hasError) {
            return Maybe.error(maybeEvaluatedLhs.getError());
        }
        const evaluatedLhs = maybeEvaluatedLhs.getValue();

        // Evaluate RHS
        const maybeEvaluatedRhs = evaluateIfCondition(condition.rhs, context, statementRange);
        if (maybeEvaluatedRhs.hasError) {
            return Maybe.error(maybeEvaluatedRhs.getError());
        }
        const evaluatedRhs = maybeEvaluatedRhs.getValue();

        const result: EvaluatedCondition = {
            condition: evaluatedLhs.condition || evaluatedRhs.condition,
        };
        return Maybe.ok(result);
    } else {
        return Maybe.error(new InternalEvaluationError(statementRange, `Unknown condition type from condition '${JSON.stringify(condition)}'`));
    }
}


// Evaluate the condition, which is an array of AND statements OR'd together.
function evaluateDirectiveIfCondition(
    statement: ParsedStatementDirectiveIf,
    context: EvaluationContext
): Maybe<boolean>
{
    let result = false;
    const orExpressions = statement.condition;
    for (const andExpressions of orExpressions) {
        let andExpressionResult = true;
        for (const conditionTermOrNot of andExpressions) {
            const term = conditionTermOrNot.term;
            const invert = conditionTermOrNot.invert;
            const termRange = new SourceRange(context.thisFbuildUri, term.range);
            let evaulatedTerm = false;
            if (isParsedDirectiveIfConditionTermIsSymbolDefined(term)) {
                const info = context.defines.get(term.symbol);
                evaulatedTerm = (info !== undefined);
                if (info !== undefined && !info.isPredefined) {
                    const reference: VariableReference = {
                        definitions: [info.definition],
                        range: termRange,
                    };
                    context.evaluatedData.variableReferences.push(reference);
                }
            } else if (isParsedDirectiveIfConditionTermEnvVarExists(term)) {
                const envVarValue = process.env[term.envVar];
                const hasEnvVar = (envVarValue !== undefined);
                evaulatedTerm = hasEnvVar;
            } else if (isParsedDirectiveIfConditionTermFileExists(term)) {
                const fileUri = convertFileSystemPathToUri(term.filePath.value, context.thisFbuildUri);
                evaulatedTerm = context.fileSystem.fileExists(fileUri);
            } else {
                return Maybe.error(new InternalEvaluationError(termRange, `Unknown '#if' term type from term '${JSON.stringify(term)}' from statement ${JSON.stringify(statement)}`));
            }

            if (invert) {
                evaulatedTerm = !evaulatedTerm;
            }

            // All parts of the AND expression must be true for the expression to be true.
            if (!evaulatedTerm) {
                andExpressionResult = false;
                break;
            }
        }

        // Any part of the OR expression must be true for the expression to be true.
        if (andExpressionResult) {
            result = true;
            break;
        }
    }

    return Maybe.ok(result);
}

function getValueTypeName(value: Value): ValueTypeName {
    if (value instanceof Array) {
        return 'Array';
    } else if (value instanceof Struct) {
        return 'Struct';
    } else if (typeof value === 'string') {
        return 'String';
    } else if (typeof value === 'number') {
        return 'Integer';
    } else if (typeof value === 'boolean') {
        return 'Boolean';
    } else {
        const dummyRange = SourceRange.create('', 0, 0, 0, 0);
        throw new InternalEvaluationError(dummyRange, `Unhandled Value type: ${JSON.stringify(value)}`);
    }
}

// Same as getValueTypeName but prefixed with either "a " or "an ".
function getValueTypeNameA(value: Value): string {
    if (value instanceof Struct) {
        return 'a Struct';
    } else if (value instanceof Array) {
        return 'an Array';
    } else if (typeof value === 'string') {
        return 'a String';
    } else if (typeof value === 'number') {
        return 'an Integer';
    } else if (typeof value === 'boolean') {
        return 'a Boolean';
    } else {
        const dummyRange = SourceRange.create('', 0, 0, 0, 0);
        throw new InternalEvaluationError(dummyRange, `Unhandled Value type: ${JSON.stringify(value)}`);
    }
}

function deepCopyValue(value: Value): Value {
    if (value instanceof Array) {
        const copy = [];
        for (let i = 0, len = value.length; i < len; i++) {
            copy[i] = deepCopyValue(value[i]);
        }
        return copy;
    } else if (value instanceof Struct) {
        const structMembers = new Map<VariableName, StructMember>(
            Array.from(
                value.members,
                ([memberName, member]) => [memberName, new StructMember(deepCopyValue(member.value), member.definitions)]));
        return new Struct(structMembers);
    } else {
        return value;
    }
}

function convertFileSystemPathToUri(filePath: string, thisFbuildUri: UriStr): vscodeUri.URI {
    if (path.isAbsolute(filePath)) {
        return vscodeUri.URI.file(filePath);
    } else {
        const thisFbuildUriDir = vscodeUri.Utils.dirname(vscodeUri.URI.parse(thisFbuildUri));
        return vscodeUri.Utils.resolvePath(thisFbuildUriDir, filePath);
    }
}

// Use this when the arrays are very large, since arr1.push(...arr2) errors out with "RangeError: Maximum call stack size exceeded".
function pushToFirstArray<T>(arr1: Array<T>, arr2: Array<T>): void {
    const arr1Length = arr1.length;
    const arr2Length = arr2.length;
    arr1.length += arr2.length;
    for (let i = 0; i < arr2Length; ++i) {
        arr1[arr1Length + i] = arr2[i];
    }
}
