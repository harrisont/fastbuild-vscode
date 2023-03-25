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

// This indicates a problem with the content being evaluated.
export class EvaluationError extends Error {
    constructor(readonly range: SourceRange, message: string, ) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = EvaluationError.name;
    }
}

// This indicates a programming problem with the language server.
export class InternalEvaluationError extends EvaluationError {
    constructor(readonly range: SourceRange, message: string, ) {
        super(range, message);
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
    constructor(readonly value: Value, readonly definition: VariableDefinition) {
    }
}

export class Struct {
    constructor(readonly members=new Map<VariableName, StructMember>()) {
    }

    static from(iterable: Iterable<readonly [VariableName, StructMember]>): Struct {
        return new Struct(new Map<VariableName, StructMember>(iterable));
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

export interface VariableReference {
    definition: VariableDefinition;
    range: SourceRange;
}

export interface TargetDefinition {
    id: number;
    range: SourceRange;
    name: string;
}

export interface TargetReference {
    definition: TargetDefinition;
    range: SourceRange;
}

export class EvaluatedData {
    evaluatedVariables: EvaluatedVariable[] = [];
    variableReferences: VariableReference[] = [];
    variableDefinitions: VariableDefinition[] = [];
    targetReferences: TargetReference[] = [];
    targetDefinitions: TargetDefinition[] = [];

    append(other: EvaluatedData): void {
        pushToFirstArray(this.evaluatedVariables, other.evaluatedVariables);
        pushToFirstArray(this.variableReferences, other.variableReferences);
        pushToFirstArray(this.variableDefinitions, other.variableDefinitions);
        pushToFirstArray(this.targetReferences, other.targetReferences);
        pushToFirstArray(this.targetDefinitions, other.targetDefinitions);
    }
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

function isParsedStatementUserFunction(obj: Record<string, any>): obj is ParsedStatementUserFunctionDeclaration {
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
}

function isParsedDirectiveIfConditionTermIsSymbolDefined(obj: Record<string, any>): obj is ParsedDirectiveIfConditionTermIsSymbolDefined {
    return (obj as ParsedDirectiveIfConditionTermIsSymbolDefined).type === 'isSymbolDefined';
}

interface ParsedDirectiveIfConditionTermEnvVarExists {
    type: 'envVarExists';
}

function isParsedDirectiveIfConditionTermEnvVarExists(obj: Record<string, any>): obj is ParsedDirectiveIfConditionTermEnvVarExists {
    return (obj as ParsedDirectiveIfConditionTermEnvVarExists).type === 'envVarExists';
}

interface ParsedDirectiveIfConditionTermFileExists {
    type: 'fileExists';
    filePath: ParsedString;
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
    symbol: {
        value: string;
        range: ParseSourceRange;
    };
}

function isParsedStatementDefine(obj: Record<string, any>): obj is ParsedStatementDefine {
    return (obj as ParsedStatementDefine).type === 'define';
}

// #undefine
interface ParsedStatementUndefine {
    type: 'undefine';
    symbol: {
        value: string;
        range: ParseSourceRange;
    };
}

function isParsedStatementUndefine(obj: Record<string, any>): obj is ParsedStatementUndefine {
    return (obj as ParsedStatementUndefine).type === 'undefine';
}

// #import
interface ParsedStatementImportEnvVar {
    type: 'importEnvVar';
    symbol: {
        value: string;
        range: ParseSourceRange;
    };
    range: ParseSourceRange;
}

function isParsedStatementImportEnvVar(obj: Record<string, any>): obj is ParsedStatementImportEnvVar {
    return (obj as ParsedStatementImportEnvVar).type === 'importEnvVar';
}

interface EvaluatedRValue {
    value: Value;
    range: ParseSourceRange;
    evaluatedVariables: EvaluatedVariable[];
    variableReferences: VariableReference[];
    variableDefinitions: VariableDefinition[];
}

function createErrorEvaluatedRValue(error: Error): DataAndMaybeError<EvaluatedRValue> {
    const data: EvaluatedRValue = {
        // Dummy value
        value: 0,
        // Dummy range
        range: {
            start: {
                line: 0,
                character: 0
            },
            end: {
                line: 0,
                character: 0
            }
        },
        evaluatedVariables: [],
        variableReferences: [],
        variableDefinitions: [],
    };
    return new DataAndMaybeError(data, error);
}

interface EvaluatedStringExpression {
    evaluatedString: string;
    evaluatedVariables: EvaluatedVariable[];
    variableReferences: VariableReference[];
}

interface EvaluatedEvaluatedVariable {
    valueScopeVariable: ScopeVariable;
    // Includes any evaluated variables/references in a an evaluated (dynamic) variable name.
    evaluatedVariables: EvaluatedVariable[];
    variableReferences: VariableReference[];
}

interface EvaluatedCondition {
    condition: boolean;
    evaluatedVariables: EvaluatedVariable[];
    variableReferences: VariableReference[];
}

interface UserFunction {
    definition: VariableDefinition;
    parameters: ParsedStatementUserFunctionDeclarationParameter[];
    statements: Statement[];
}

interface ScopeVariable {
    value: Value;
    definition: VariableDefinition;
}

class Scope {
    variables = new Map<string, ScopeVariable>();

    constructor(readonly canAccessParentScopes: boolean) {
    }
}

class ScopeStack {
    private stack: Scope[] = [];
    private nextVariableDefinitionId = 1;

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
            return Maybe.error(new EvaluationError(variableRange, `Referencing variable "${variableName}" that is not defined in the current scope or any of the parent scopes.`));
        } else {
            return Maybe.ok(maybeVariable);
        }
    }

    // Get a variable, searching from the parent scope to the root.
    // Return EvaluationError if the variable is not defined.
    getVariableStartingFromParentScopeOrError(variableName: string, variableRange: SourceRange): Maybe<ScopeVariable> {
        if (this.stack.length < 2) {
            return Maybe.error(new EvaluationError(variableRange, `Cannot access parent scope because there is no parent scope.`));
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
        return Maybe.error(new EvaluationError(variableRange, `Referencing variable "${variableName}" in a parent scope that is not defined in any parent scope.`));
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
            return Maybe.error(new EvaluationError(variableRange, `Referencing varable "${variableName}" that is not defined in the current scope.`));
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

    setVariableInCurrentScope(name: string, value: Value, definition: VariableDefinition): ScopeVariable {
        const currentScope = this.getCurrentScope();
        const existingVariable = currentScope.variables.get(name);
        if (existingVariable === undefined) {
            const variable: ScopeVariable = {
                value: value,
                definition: definition,
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

    createTargetDefinition(range: SourceRange, name: string): TargetDefinition {
        const id = this.nextVariableDefinitionId;
        this.nextVariableDefinitionId += 1;
        return {
            id,
            range,
            name,
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

interface EvaluationContext {
    scopeStack: ScopeStack,
    defines: Set<string>,
    userFunctions: Map<string, UserFunction>,
    rootFbuildDirUri: vscodeUri.URI,
    thisFbuildUri: UriStr,
    fileSystem: IFileSystem,
    parseDataProvider: ParseDataProvider,
    // Used to ensure that a URI is only included a single time.
    onceIncludeUrisAlreadyIncluded: string[];
    previousStatementLhsVariable: ScopeVariable | null;
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

    scopeStack.setVariableInCurrentScope('_WORKING_DIR_', rootFbuildDirUri.fsPath, createNoLocationVariableDefinition('_WORKING_DIR_'));
    scopeStack.setVariableInCurrentScope('_CURRENT_BFF_DIR_', '', createNoLocationVariableDefinition('_CURRENT_BFF_DIR_'));
    scopeStack.setVariableInCurrentScope('_FASTBUILD_VERSION_STRING_', 'vPlaceholderFastBuildVersionString', createNoLocationVariableDefinition('_FASTBUILD_VERSION_STRING_'));
    scopeStack.setVariableInCurrentScope('_FASTBUILD_VERSION_', -1, createNoLocationVariableDefinition('_FASTBUILD_VERSION_'));

    return scopeStack;
}

function createDefaultDefines(): Set<string> {
    const defines = new Set<string>();
    defines.add(getPlatformSpecificDefineSymbol());
    return defines;
}
// thisFbuildUri is used to calculate relative paths (e.g. from #include)
export function evaluate(parseData: ParseData, thisFbuildUri: string, fileSystem: IFileSystem, parseDataProvider: ParseDataProvider): DataAndMaybeError<EvaluatedData> {
    const rootFbuildDirUri = vscodeUri.Utils.dirname(vscodeUri.URI.parse(thisFbuildUri));
    const context: EvaluationContext = {
        scopeStack: createDefaultScopeStack(rootFbuildDirUri),
        defines: createDefaultDefines(),
        userFunctions: new Map<string, UserFunction>(),
        rootFbuildDirUri,
        thisFbuildUri,
        fileSystem,
        parseDataProvider,
        onceIncludeUrisAlreadyIncluded: [],
        previousStatementLhsVariable: null,
    };
    return evaluateStatements(parseData.statements, context);
}

function evaluateStatements(statements: Statement[], context: EvaluationContext): DataAndMaybeError<EvaluatedData> {
    const result = new EvaluatedData();
    try {
        for (const statement of statements) {
            let statementLhsVariable: ScopeVariable | null = null;

            if (isParsedStatementVariableDefintion(statement)) {
                const evaluatedRhsAndMaybeError = evaluateRValue(statement.rhs, context);
                const evaluatedRhs = evaluatedRhsAndMaybeError.data;
                pushToFirstArray(result.evaluatedVariables, evaluatedRhs.evaluatedVariables);
                pushToFirstArray(result.variableReferences, evaluatedRhs.variableReferences);
                pushToFirstArray(result.variableDefinitions, evaluatedRhs.variableDefinitions);
                if (evaluatedRhsAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedRhsAndMaybeError.error);
                }

                const lhs: ParsedVariableDefinitionLhs = statement.lhs;
                const lhsRange = new SourceRange(context.thisFbuildUri, lhs.range);

                const evaluatedLhsNameAndMaybeError = evaluateRValue(lhs.name, context);
                const evaluatedLhsName = evaluatedLhsNameAndMaybeError.data;
                pushToFirstArray(result.evaluatedVariables, evaluatedLhsName.evaluatedVariables);
                pushToFirstArray(result.variableReferences, evaluatedLhsName.variableReferences);
                if (evaluatedLhsNameAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedLhsNameAndMaybeError.error);
                }
                if (typeof evaluatedLhsName.value !== 'string') {
                    const error = new EvaluationError(lhsRange, `Variable name must evaluate to a String, but instead evaluates to ${getValueTypeNameA(evaluatedLhsName.value)}`);
                    return new DataAndMaybeError(result, error);
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
                    variable = context.scopeStack.setVariableInCurrentScope(evaluatedLhsName.value, value, definition);

                    if (existingVariable === null) {
                        // The definition's LHS is a variable definition.
                        result.variableDefinitions.push(variable.definition);
                    }
                } else {
                    const maybeVariable = context.scopeStack.getVariableStartingFromParentScopeOrError(evaluatedLhsName.value, lhsRange);
                    if (maybeVariable.hasError) {
                        return new DataAndMaybeError(result, maybeVariable.getError());
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
                            const error = new EvaluationError(new SourceRange(context.thisFbuildUri, errorRange), `Cannot assign ${getValueTypeNameA(value)} to an Array. Arrays can only contain Strings or Structs.`);
                            return new DataAndMaybeError(result, error);
                        }
                    } else {
                        // Assignment to a non-empty Array: the RHS items must be of the same type as the LHS.
                        const lhsFirstItem = existingValue[0];
                        if ((typeof lhsFirstItem === 'string' && typeof value !== 'string')
                            || (lhsFirstItem instanceof Struct && !(value instanceof Struct)))
                        {
                            const errorRange = new SourceRange(context.thisFbuildUri, evaluatedRhs.range);
                            const error = new EvaluationError(new SourceRange(context.thisFbuildUri, errorRange), `Cannot assign ${getValueTypeNameA(value)} to an Array of ${getValueTypeName(lhsFirstItem)}s.`);
                            return new DataAndMaybeError(result, error);
                        }
                    }
                    variable.value = [value];
                }

                statementLhsVariable = variable;

                // The definition's LHS is a variable reference.
                result.variableReferences.push({
                    definition: variable.definition,
                    range: lhsRange,
                });
            } else if (isParsedStatementBinaryOperator(statement)) {
                const lhs = statement.lhs;
                const lhsRange = new SourceRange(context.thisFbuildUri, lhs.range);

                const evaluatedLhsNameAndMaybeError = evaluateRValue(lhs.name, context);
                const evaluatedLhsName = evaluatedLhsNameAndMaybeError.data;
                pushToFirstArray(result.evaluatedVariables, evaluatedLhsName.evaluatedVariables);
                pushToFirstArray(result.variableReferences, evaluatedLhsName.variableReferences);
                if (evaluatedLhsNameAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedLhsNameAndMaybeError.error);
                }
                if (typeof evaluatedLhsName.value !== 'string') {
                    const error = new EvaluationError(lhsRange, `Variable name must evaluate to a String, but instead evaluates to ${getValueTypeNameA(evaluatedLhsName.value)}`);
                    return new DataAndMaybeError(result, error);
                }

                let lhsVariable: ScopeVariable;
                let previousValue: Value;
                let maybeExistingVariableStartingFromParentScope: ScopeVariable | null;
                // Adding to a current-scope non-existant, parent-scope existant variable defines it in the current scope to be the sum.
                if (lhs.scope === 'current'
                    && context.scopeStack.getVariableInCurrentScope(evaluatedLhsName.value) === null
                    && (maybeExistingVariableStartingFromParentScope = context.scopeStack.getVariableStartingFromCurrentScope(evaluatedLhsName.value)) !== null)
                {
                    previousValue = maybeExistingVariableStartingFromParentScope.value;
                    const definition = context.scopeStack.createVariableDefinition(lhsRange, evaluatedLhsName.value);
                    result.variableDefinitions.push(definition);
                    lhsVariable = context.scopeStack.setVariableInCurrentScope(evaluatedLhsName.value, previousValue, definition);
                } else {
                    const maybeExistingVariable = context.scopeStack.getVariableInScopeOrError(lhs.scope, evaluatedLhsName.value, lhsRange);
                    if (maybeExistingVariable.hasError) {
                        return new DataAndMaybeError(result, maybeExistingVariable.getError());
                    }
                    lhsVariable = maybeExistingVariable.getValue();
                    previousValue = deepCopyValue(lhsVariable.value);
                }

                statementLhsVariable = lhsVariable;

                const evaluatedRhsAndMaybeError = evaluateRValue(statement.rhs, context);
                const evaluatedRhs = evaluatedRhsAndMaybeError.data;
                pushToFirstArray(result.evaluatedVariables, evaluatedRhs.evaluatedVariables);
                pushToFirstArray(result.variableReferences, evaluatedRhs.variableReferences);
                if (evaluatedRhsAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedRhsAndMaybeError.error);
                }

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
                    return new DataAndMaybeError(result, maybeOperatorResult.getError());
                }
                lhsVariable.value = maybeOperatorResult.getValue();

                // The LHS is an evaluated variable and is a variable reference.
                result.evaluatedVariables.push({
                    value: previousValue,
                    range: lhsRange,
                });
                result.variableReferences.push({
                    definition: lhsVariable.definition,
                    range: lhsRange,
                });
            } else if (isParsedStatementBinaryOperatorOnUnnamed(statement)) {
                if (context.previousStatementLhsVariable === null) {
                    const range = SourceRange.createFromPosition(context.thisFbuildUri, statement.rangeStart, statement.rangeStart);
                    const error = new EvaluationError(range, 'Unnamed modification must follow a variable assignment in the same scope.');
                    return new DataAndMaybeError(result, error);
                }
                const lhsVariable = context.previousStatementLhsVariable;
                // Allow chaining of unnamed operators.
                statementLhsVariable = lhsVariable;

                const evaluatedRhsAndMaybeError = evaluateRValue(statement.rhs, context);
                const evaluatedRhs = evaluatedRhsAndMaybeError.data;
                pushToFirstArray(result.evaluatedVariables, evaluatedRhs.evaluatedVariables);
                pushToFirstArray(result.variableReferences, evaluatedRhs.variableReferences);
                if (evaluatedRhsAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedRhsAndMaybeError.error);
                }

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
                    return new DataAndMaybeError(result, maybeOperatorResult.getError());
                }
                lhsVariable.value = maybeOperatorResult.getValue();
            } else if (isParsedStatementScopedStatements(statement)) {
                let error: Error | null = null;
                context.scopeStack.withScope(() => {
                    const evaluatedStatementsAndMaybeError = evaluateStatements(statement.statements, context);
                    error = evaluatedStatementsAndMaybeError.error;
                    const evaluatedStatements = evaluatedStatementsAndMaybeError.data;
                    result.append(evaluatedStatements);
                });
                if (error !== null) {
                    return new DataAndMaybeError(result, error);
                }
            } else if (isParsedStatementUsing(statement)) {
                const statementRange = new SourceRange(context.thisFbuildUri, statement.range);
                const structRange = new SourceRange(context.thisFbuildUri, statement.struct.range);

                if (statement.struct.type !== 'evaluatedVariable') {
                    const error = new EvaluationError(structRange, `'Using' parameter must be an evaluated variable, but instead is '${statement.struct.type}'`);
                    return new DataAndMaybeError(result, error);
                }
                const evaluatedAndMaybeError = evaluateEvaluatedVariable(statement.struct, context);
                const evaluated = evaluatedAndMaybeError.data;
                pushToFirstArray(result.evaluatedVariables, evaluated.evaluatedVariables);
                pushToFirstArray(result.variableReferences, evaluated.variableReferences);
                if (evaluatedAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedAndMaybeError.error);
                }

                const structVariable = evaluated.valueScopeVariable;
                const struct = structVariable.value;
                if (!(struct instanceof Struct)) {
                    const error = new EvaluationError(structRange, `'Using' parameter must be a Struct, but instead is ${getValueTypeNameA(struct)}`);
                    return new DataAndMaybeError(result, error);
                }

                //
                // For each struct member:
                //   * If it is already defined in the current scope, update it and add a reference to the definition.
                //   * Otherwise, define it and add a reference to the definition.
                //   * Either way, add references to:
                //       * the struct member's definition from the statement
                //       * the current scope's variable-from-member's definition from the member's definition

                for (const [structMemberName, structMember] of struct.members) {
                    // The definition will only be used if the variable does not already exist in the current scope.
                    let variableDefinition: VariableDefinition;
                    const existingVariable = context.scopeStack.getVariableInCurrentScope(structMemberName);
                    if (existingVariable !== null) {
                        existingVariable.value = structMember.value;
                        variableDefinition = existingVariable.definition;
                    } else {
                        variableDefinition = context.scopeStack.createVariableDefinition(statementRange, structMemberName);
                        context.scopeStack.setVariableInCurrentScope(structMemberName, structMember.value, variableDefinition);
                        result.variableDefinitions.push(variableDefinition);
                    }

                    result.variableReferences.push(
                        {
                            definition: variableDefinition,
                            range: statementRange,
                        },
                        {
                            definition: structMember.definition,
                            range: statementRange,
                        },
                        {
                            definition: variableDefinition,
                            range: structMember.definition.range,
                        }
                    );
                }
            } else if (isParsedStatementForEach(statement)) {
                // Evaluate the iterators (array to loop over plus the loop-variable)
                interface ForEachIterator {
                    arrayItems: Value[];
                    evaluatedLoopVarNameValue: string;
                    loopVarRange: SourceRange;
                    loopVarDefinition: VariableDefinition;
                }
                const iterators: ForEachIterator[] = [];
                for (const iterator of statement.iterators) {
                    // Evaluate the array to loop over.
                    if (iterator.arrayToLoopOver.type !== 'evaluatedVariable') {
                        const range = new SourceRange(context.thisFbuildUri, statement.range);
                        const error = new InternalEvaluationError(range, `'ForEach' array to loop over must be an evaluated variable, but instead is '${iterator.arrayToLoopOver.type}'`);
                        return new DataAndMaybeError(result, error);
                    }
                    const arrayToLoopOverRange = new SourceRange(context.thisFbuildUri, iterator.arrayToLoopOver.range);
                    const evaluatedArrayToLoopOverAndMaybeError = evaluateEvaluatedVariable(iterator.arrayToLoopOver, context);
                    const evaluatedArrayToLoopOver = evaluatedArrayToLoopOverAndMaybeError.data;
                    pushToFirstArray(result.evaluatedVariables, evaluatedArrayToLoopOver.evaluatedVariables);
                    pushToFirstArray(result.variableReferences, evaluatedArrayToLoopOver.variableReferences);
                    if (evaluatedArrayToLoopOverAndMaybeError.error !== null) {
                        return new DataAndMaybeError(result, evaluatedArrayToLoopOverAndMaybeError.error);
                    }
                    const arrayItems = evaluatedArrayToLoopOver.valueScopeVariable.value;
                    if (!(arrayItems instanceof Array)) {
                        const error = new EvaluationError(arrayToLoopOverRange, `'ForEach' variable to loop over must be an Array, but instead is ${getValueTypeNameA(arrayItems)}`);
                        return new DataAndMaybeError(result, error);
                    }

                    if ((iterators.length > 0) && (arrayItems.length != iterators[0].arrayItems.length)) {
                        const error = new EvaluationError(arrayToLoopOverRange, `'ForEach' Array variable to loop over contains ${arrayItems.length} elements, but the loop is for ${iterators[0].arrayItems.length} elements.`);
                        return new DataAndMaybeError(result, error);
                    }

                    const loopVar = iterator.loopVar;
                    const loopVarRange = new SourceRange(context.thisFbuildUri, loopVar.range);

                    // Evaluate the loop-variable name.
                    const evaluatedLoopVarNameAndMaybeError = evaluateRValue(loopVar.name, context);
                    const evaluatedLoopVarName = evaluatedLoopVarNameAndMaybeError.data;
                    pushToFirstArray(result.evaluatedVariables, evaluatedLoopVarName.evaluatedVariables);
                    pushToFirstArray(result.variableReferences, evaluatedLoopVarName.variableReferences);
                    if (evaluatedLoopVarNameAndMaybeError.error !== null) {
                        return new DataAndMaybeError(result, evaluatedLoopVarNameAndMaybeError.error);
                    }
                    if (typeof evaluatedLoopVarName.value !== 'string') {
                        const error = new InternalEvaluationError(loopVarRange, `Variable name must evaluate to a String, but instead evaluates to ${getValueTypeNameA(evaluatedLoopVarName.value)}`);
                        return new DataAndMaybeError(result, error);
                    }
                    const evaluatedLoopVarNameValue: string = evaluatedLoopVarName.value;

                    const loopVarDefinition = context.scopeStack.createVariableDefinition(loopVarRange, evaluatedLoopVarNameValue);

                    iterators.push({
                        arrayItems,
                        evaluatedLoopVarNameValue,
                        loopVarRange,
                        loopVarDefinition,
                    });
                }

                // Evaluate the function body.

                let error: Error | null = null;
                const arrayItemsLength = iterators[0].arrayItems.length;
                for (let arrayItemIndex = 0; arrayItemIndex < arrayItemsLength; arrayItemIndex++) {
                    context.scopeStack.withScope(() => {
                        // Set a variable in the current scope for each iterator's loop variable.
                        for (const iterator of iterators) {
                            const arrayItem = iterator.arrayItems[arrayItemIndex];
                            const loopVariable = context.scopeStack.setVariableInCurrentScope(iterator.evaluatedLoopVarNameValue, arrayItem, iterator.loopVarDefinition);

                            // The loop variable is a variable reference.
                            result.variableReferences.push({
                                definition: loopVariable.definition,
                                range: iterator.loopVarRange,
                            });
                        }

                        const evaluatedStatementsAndMaybeError = evaluateStatements(statement.statements, context);
                        const evaluatedStatements = evaluatedStatementsAndMaybeError.data;
                        result.append(evaluatedStatements);
                        if (evaluatedStatementsAndMaybeError.error !== null) {
                            error = evaluatedStatementsAndMaybeError.error;
                            return;
                        }
                    });
                }
                if (error !== null) {
                    return new DataAndMaybeError(result, error);
                }
            } else if (isParsedStatementGenericFunction(statement)) {
                // Evaluate the target name.
                const evaluatedTargetNameNameAndMaybeError = evaluateRValue(statement.targetName, context);
                const evaluatedTargetName = evaluatedTargetNameNameAndMaybeError.data;
                pushToFirstArray(result.evaluatedVariables, evaluatedTargetName.evaluatedVariables);
                pushToFirstArray(result.variableReferences, evaluatedTargetName.variableReferences);
                if (evaluatedTargetNameNameAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedTargetNameNameAndMaybeError.error);
                }
                const evaluatedTargetNameRange = new SourceRange(context.thisFbuildUri, evaluatedTargetName.range);
                if (typeof evaluatedTargetName.value !== 'string') {
                    const error = new EvaluationError(evaluatedTargetNameRange, `Target name must evaluate to a String, but instead evaluates to ${getValueTypeNameA(evaluatedTargetName.value)}`);
                    return new DataAndMaybeError(result, error);
                }

                // Create a definition and reference for the target name.
                const targetNameDefinition = context.scopeStack.createTargetDefinition(evaluatedTargetNameRange, evaluatedTargetName.value);
                const targetNameReference: TargetReference = {
                    definition: targetNameDefinition,
                    range: evaluatedTargetNameRange,
                };
                result.targetDefinitions.push(targetNameDefinition);
                result.targetReferences.push(targetNameReference);

                // Evaluate the function body.
                let error: Error | null = null;
                context.scopeStack.withScope(() => {
                    const evaluatedStatementsAndMaybeError = evaluateStatements(statement.statements, context);
                    error = evaluatedStatementsAndMaybeError.error;
                    const evaluatedStatements = evaluatedStatementsAndMaybeError.data;
                    result.append(evaluatedStatements);
                });
                if (error !== null) {
                    return new DataAndMaybeError(result, error);
                }
            } else if (isParsedStatementError(statement)) {
                const evaluatedValueAndMaybeError = evaluateRValue(statement.value, context);
                const evaluatedValue = evaluatedValueAndMaybeError.data;
                pushToFirstArray(result.evaluatedVariables, evaluatedValue.evaluatedVariables);
                pushToFirstArray(result.variableReferences, evaluatedValue.variableReferences);
                if (evaluatedValueAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedValueAndMaybeError.error);
                }
                if (typeof evaluatedValue.value !== 'string') {
                    const range = new SourceRange(context.thisFbuildUri, statement.range);
                    const error = new InternalEvaluationError(range, `'Error' argument must evaluate to a String, but instead evaluates to ${getValueTypeNameA(evaluatedValue.value)}`);
                    return new DataAndMaybeError(result, error);
                }
            } else if (isParsedStatementPrint(statement)) {
                const value = statement.value;
                const evaluatedValueAndMaybeError = evaluateRValue(value, context);
                const evaluatedValue = evaluatedValueAndMaybeError.data;
                pushToFirstArray(result.evaluatedVariables, evaluatedValue.evaluatedVariables);
                pushToFirstArray(result.variableReferences, evaluatedValue.variableReferences);
                if (evaluatedValueAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedValueAndMaybeError.error);
                }
                if (!isParsedEvaluatedVariable(value) && typeof evaluatedValue.value !== 'string') {
                    const range = new SourceRange(context.thisFbuildUri, statement.range);
                    const error = new InternalEvaluationError(range, `'Print' argument must either be a variable or evaluate to a String, but instead is ${getValueTypeNameA(evaluatedValue.value)}`);
                    return new DataAndMaybeError(result, error);
                }
            } else if (isParsedStatementSettings(statement)) {
                // Evaluate the function body.
                let error: Error | null = null;
                context.scopeStack.withScope(() => {
                    const evaluatedStatementsAndMaybeError = evaluateStatements(statement.statements, context);
                    error = evaluatedStatementsAndMaybeError.error;
                    const evaluatedStatements = evaluatedStatementsAndMaybeError.data;
                    result.append(evaluatedStatements);
                });
                if (error !== null) {
                    return new DataAndMaybeError(result, error);
                }
            } else if (isParsedStatementIf(statement)) {
                // Evaluate the condition.
                const condition = statement.condition;
                const statementRange = new SourceRange(context.thisFbuildUri, statement.range);
                const evaluatedConditionAndMaybeError = evaluateIfCondition(condition, context, statementRange);
                const evaluatedCondition = evaluatedConditionAndMaybeError.data;
                pushToFirstArray(result.evaluatedVariables, evaluatedCondition.evaluatedVariables);
                pushToFirstArray(result.variableReferences, evaluatedCondition.variableReferences);
                if (evaluatedConditionAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedConditionAndMaybeError.error);
                }

                // Evaluate the function body if the condition was true.
                if (evaluatedCondition.condition === true) {
                    let error: Error | null = null;
                    context.scopeStack.withScope(() => {
                        const evaluatedStatementsAndMaybeError = evaluateStatements(statement.statements, context);
                        error = evaluatedStatementsAndMaybeError.error;
                        const evaluatedStatements = evaluatedStatementsAndMaybeError.data;
                        result.append(evaluatedStatements);
                    });
                    if (error !== null) {
                        return new DataAndMaybeError(result, error);
                    }
                }
            } else if (isParsedStatementUserFunction(statement)) {
                const evaluatedDataAndMaybeError = evaluateUserFunctionDeclaration(statement, context);
                const evaluatedData = evaluatedDataAndMaybeError.data;
                result.append(evaluatedData);
                if (evaluatedDataAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedDataAndMaybeError.error);
                }
            } else if (isParsedStatementUserFunctionCall(statement)) {
                const evaluatedDataAndMaybeError = evaluateUserFunctionCall(statement, context);
                const evaluatedData = evaluatedDataAndMaybeError.data;
                result.append(evaluatedData);
                if (evaluatedDataAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedDataAndMaybeError.error);
                }
            } else if (isParsedStatementInclude(statement)) {  // #include
                const thisFbuildUriDir = vscodeUri.Utils.dirname(vscodeUri.URI.parse(context.thisFbuildUri));
                const includeUri = vscodeUri.Utils.resolvePath(thisFbuildUriDir, statement.path.value);
                if (!context.onceIncludeUrisAlreadyIncluded.includes(includeUri.toString())) {
                    const maybeIncludeParseData = context.parseDataProvider.getParseData(includeUri);
                    if (maybeIncludeParseData.hasError) {
                        const includeError = maybeIncludeParseData.getError();
                        let error: Error;
                        if (includeError instanceof ParseError) {
                            error = includeError;
                        } else {
                            const includeRange = new SourceRange(context.thisFbuildUri, statement.path.range);
                            error = new EvaluationError(includeRange, `Unable to open include: ${includeError.message}`);
                        }
                        return new DataAndMaybeError(result, error);
                    }
                    const includeParseData = maybeIncludeParseData.getValue();

                    // Save the current `_CURRENT_BFF_DIR_` value so that we can restore it after processing the include.
                    const dummyRange = SourceRange.create(context.thisFbuildUri, 0, 0, 0, 0);
                    const maybeCurrentBffDirVariable = context.scopeStack.getVariableStartingFromCurrentScopeOrError('_CURRENT_BFF_DIR_', dummyRange);
                    if (maybeCurrentBffDirVariable.hasError) {
                        return new DataAndMaybeError(result, maybeCurrentBffDirVariable.getError());
                    }
                    const currentBffDirVariable = maybeCurrentBffDirVariable.getValue();
                    const currentBffDirBeforeInclude = currentBffDirVariable.value;

                    // Update the `_CURRENT_BFF_DIR_` value for the include.
                    const includeDirRelativeToRoot = path.relative(context.rootFbuildDirUri.toString(), vscodeUri.Utils.dirname(includeUri).toString());
                    currentBffDirVariable.value = includeDirRelativeToRoot;

                    const includeContext: EvaluationContext = {
                        scopeStack: context.scopeStack,
                        defines: context.defines,
                        userFunctions: context.userFunctions,
                        rootFbuildDirUri: context.rootFbuildDirUri,
                        thisFbuildUri: includeUri.toString(),
                        fileSystem: context.fileSystem,
                        parseDataProvider: context.parseDataProvider,
                        onceIncludeUrisAlreadyIncluded: context.onceIncludeUrisAlreadyIncluded,
                        previousStatementLhsVariable: context.previousStatementLhsVariable,
                    };

                    const evaluatedStatementsAndMaybeError = evaluateStatements(includeParseData.statements, includeContext);
                    const evaluatedStatements = evaluatedStatementsAndMaybeError.data;
                    result.append(evaluatedStatements);
                    if (evaluatedStatementsAndMaybeError.error !== null) {
                        return new DataAndMaybeError(result, evaluatedStatementsAndMaybeError.error);
                    }

                    // Restore the `_CURRENT_BFF_DIR_` value.
                    currentBffDirVariable.value = currentBffDirBeforeInclude;
                }
            } else if (isParsedStatementOnce(statement)) {  // #once
                context.onceIncludeUrisAlreadyIncluded.push(context.thisFbuildUri);
            } else if (isParsedStatementDirectiveIf(statement)) {  // #if
                const evaluatedConditionAndMaybeError = evaluateDirectiveIfCondition(statement, context);
                if (evaluatedConditionAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedConditionAndMaybeError.error);
                }

                // Evaluate the '#if' body statements if the condition was true.
                // Otherwise, evaluate the '#else' body statements.
                const statements = evaluatedConditionAndMaybeError.data ? statement.ifStatements : statement.elseStatements;
                const evaluatedStatementsAndMaybeError = evaluateStatements(statements, context);
                const evaluatedStatements = evaluatedStatementsAndMaybeError.data;
                result.append(evaluatedStatements);
                if (evaluatedStatementsAndMaybeError.error !== null) {
                    return new DataAndMaybeError(result, evaluatedStatementsAndMaybeError.error);
                }

                // Preserve the previous LHS variable in order to support embedding #if in a variable assignment expression.
                statementLhsVariable = context.previousStatementLhsVariable;
            } else if (isParsedStatementDefine(statement)) {  // #define
                const symbol = statement.symbol.value;
                if (context.defines.has(symbol)) {
                    const sourceRange = new SourceRange(context.thisFbuildUri, statement.symbol.range);
                    const error = new EvaluationError(sourceRange, `Cannot #define already defined symbol "${symbol}".`);
                    return new DataAndMaybeError(result, error);
                }
                context.defines.add(symbol);
            } else if (isParsedStatementUndefine(statement)) {  // #undef
                const symbol = statement.symbol.value;
                const sourceRange = new SourceRange(context.thisFbuildUri, statement.symbol.range);
                if (symbol === getPlatformSpecificDefineSymbol()) {
                    const error = new EvaluationError(sourceRange, `Cannot #undef built-in symbol "${symbol}".`);
                    return new DataAndMaybeError(result, error);
                }
                if (!context.defines.has(symbol)) {
                    const error = new EvaluationError(sourceRange, `Cannot #undef undefined symbol "${symbol}".`);
                    return new DataAndMaybeError(result, error);
                }
                context.defines.delete(symbol);
            } else if (isParsedStatementImportEnvVar(statement)) {  // #import
                // We cannot know what environment variables will exist when FASTBuild is run,
                // since they might be different than the environment variables that exist now.
                // So use a placeholder value instead of reading the actual environement variable value.
                const symbol = statement.symbol.value;
                const value = `placeholder-${symbol}-value`;
                const statementRange = new SourceRange(context.thisFbuildUri, statement.range);
                const definition = context.scopeStack.createVariableDefinition(statementRange, symbol);
                context.scopeStack.setVariableInCurrentScope(symbol, value, definition);
            } else {
                const dummyRange = SourceRange.create(context.thisFbuildUri, 0, 0, 0, 0);
                const error = new InternalEvaluationError(dummyRange, `Unknown statement type '${statement.type}' from statement ${JSON.stringify(statement)}`);
                return new DataAndMaybeError(result, error);
            }

            context.previousStatementLhsVariable = statementLhsVariable;
        }
    } catch (error) {
        if (error instanceof Error) {
            return new DataAndMaybeError(result, error);
        } else {
            // We should only throw `Error` instances, but handle other types as a fallback.
            // `error` could be anything. Try to get a useful message out of it.
            const typedError = new Error(String(error));
            return new DataAndMaybeError(result, typedError);
        }
    }

    return new DataAndMaybeError(result);
}

function evaluateRValue(rValue: any, context: EvaluationContext): DataAndMaybeError<EvaluatedRValue> {
    if (isParsedString(rValue)) {
        return new DataAndMaybeError({
            value: rValue.value,
            range: rValue.range,
            evaluatedVariables: [],
            variableReferences: [],
            variableDefinitions: [],
        });
    } else if (isParsedStringExpression(rValue)) {
        const evaluatedAndMaybeError = evaluateStringExpression(rValue.parts, context);
        const evaluated = evaluatedAndMaybeError.data;
        return new DataAndMaybeError(
            {
                value: evaluated.evaluatedString,
                range: rValue.range,
                evaluatedVariables: evaluated.evaluatedVariables,
                variableReferences: evaluated.variableReferences,
                variableDefinitions: [],
            },
            evaluatedAndMaybeError.error);
    } else if (isParsedStruct(rValue)) {
        return evaluateStruct(rValue, context);
    } else if (isParsedSum(rValue)) {
        return evaluateSum(rValue, context);
    } else if (isParsedEvaluatedVariable(rValue)) {
        const evaluatedAndMaybeError = evaluateEvaluatedVariable(rValue, context);
        const evaluated = evaluatedAndMaybeError.data;
        return new DataAndMaybeError(
            {
                value: evaluated.valueScopeVariable.value,
                range: rValue.range,
                evaluatedVariables: evaluated.evaluatedVariables,
                variableReferences: evaluated.variableReferences,
                variableDefinitions: [],
            },
            evaluatedAndMaybeError.error);
    } else if (isParsedArray(rValue)) {
        const evaluatedAndMaybeError = evaluateRValueArray(rValue.value, rValue.range, context);
        const evaluated = evaluatedAndMaybeError.data;
        if (evaluatedAndMaybeError.error !== null) {
            const result: EvaluatedRValue = {
                value: [],
                range: rValue.range,
                evaluatedVariables: [],
                variableReferences: [],
                variableDefinitions: [],
            };
            return new DataAndMaybeError(result, evaluatedAndMaybeError.error);
        }
        return new DataAndMaybeError({
            value: evaluated.value,
            range: rValue.range,
            evaluatedVariables: evaluated.evaluatedVariables,
            variableReferences: evaluated.variableReferences,
            variableDefinitions: evaluated.variableDefinitions,
        });
    } else if (isParsedBoolean(rValue) || isParsedInteger(rValue)) {
        return new DataAndMaybeError({
            value: rValue.value,
            range: rValue.range,
            evaluatedVariables: [],
            variableReferences: [],
            variableDefinitions: [],
        });
    } else {
        const dummyRange = SourceRange.create(context.thisFbuildUri, 0, 0, 0, 0);
        return createErrorEvaluatedRValue(new InternalEvaluationError(dummyRange, `Unsupported rValue ${JSON.stringify(rValue)}`));
    }
}

function evaluateRValueArray(
    rValue: any[],
    range: ParseSourceRange,
    context: EvaluationContext
): DataAndMaybeError<EvaluatedRValue>
{
    const result: EvaluatedRValue = {
        value: [],
        range,
        evaluatedVariables: [],
        variableReferences: [],
        variableDefinitions: [],
    };
    result.value = [];

    let firstItemTypeNameA: string | null = null;
    for (const item of rValue) {
        // Specially handle a #if inside an array's contents.
        if (isParsedStatementDirectiveIf(item)) {
            const directiveIfStatement = item;
            const evaluatedConditionAndMaybeError = evaluateDirectiveIfCondition(directiveIfStatement, context);
            if (evaluatedConditionAndMaybeError.error !== null) {
                return new DataAndMaybeError(result, evaluatedConditionAndMaybeError.error);
            }

            // Evaluate the '#if' body statements if the condition was true.
            // Otherwise, evaluate the '#else' body statements.
            const contents = evaluatedConditionAndMaybeError.data ? directiveIfStatement.ifStatements : directiveIfStatement.elseStatements;
            const evaluatedAndMaybeError = evaluateRValueArray(contents, range, context);
            const evaluated = evaluatedAndMaybeError.data;
            pushToFirstArray(result.evaluatedVariables, evaluated.evaluatedVariables);
            pushToFirstArray(result.variableReferences, evaluated.variableReferences);
            pushToFirstArray(result.variableDefinitions, evaluated.variableDefinitions);
            if (evaluatedAndMaybeError.error !== null) {
                return new DataAndMaybeError(result, evaluatedAndMaybeError.error);
            }

            if (!(evaluated.value instanceof Array)) {
                const error = new InternalEvaluationError(new SourceRange(context.thisFbuildUri, evaluated.range), 'Bug: directive if ("#if") body must evaluate to an Array.');
                return new DataAndMaybeError(result, error);
            }

            pushToFirstArray(result.value, evaluated.value);
        } else {
            const evaluatedAndMaybeError = evaluateRValue(item, context);
            const evaluated = evaluatedAndMaybeError.data;
            pushToFirstArray(result.evaluatedVariables, evaluated.evaluatedVariables);
            pushToFirstArray(result.variableReferences, evaluated.variableReferences);
            pushToFirstArray(result.variableDefinitions, evaluated.variableDefinitions);
            if (evaluatedAndMaybeError.error !== null) {
                return new DataAndMaybeError(result, evaluatedAndMaybeError.error);
            }

            if (evaluated.value instanceof Array) {
                pushToFirstArray(result.value, evaluated.value);
            } else {
                if (firstItemTypeNameA === null) {
                    firstItemTypeNameA = getValueTypeNameA(evaluated.value);

                    if (typeof evaluated.value === 'boolean'
                        || typeof evaluated.value === 'number')
                    {
                        const error = new EvaluationError(new SourceRange(context.thisFbuildUri, evaluated.range), `Cannot have an Array of ${getValueTypeName(evaluated.value)}s. Only Arrays of Strings and Arrays of Structs are allowed.`);
                        return new DataAndMaybeError(result, error);
                    } else if (evaluated.value instanceof Struct && !isParsedEvaluatedVariable(item)) {
                        const error = new EvaluationError(new SourceRange(context.thisFbuildUri, evaluated.range), `Cannot have an Array of literal Structs. Use an Array of evaluated variables instead.`);
                        return new DataAndMaybeError(result, error);
                    }
                } else {
                    const itemTypeNameA = getValueTypeNameA(evaluated.value);
                    if (itemTypeNameA !== firstItemTypeNameA) {
                        const error = new EvaluationError(new SourceRange(context.thisFbuildUri, evaluated.range), `All values in an Array must have the same type, but the first item is ${firstItemTypeNameA} and this item is ${itemTypeNameA}`);
                        return new DataAndMaybeError(result, error);
                    }
                }

                result.value.push(evaluated.value);
            }
        }
    }
    return new DataAndMaybeError(result);
}

function evaluateEvaluatedVariable(parsedEvaluatedVariable: ParsedEvaluatedVariable, context: EvaluationContext): DataAndMaybeError<EvaluatedEvaluatedVariable> {
    const placeholderScopeVariable: ScopeVariable = {
        value: 0,
        definition: {
            id: 0,
            range: SourceRange.create('', 0, 0, 0, 0),
            name: '',
        },
    };

    const result: EvaluatedEvaluatedVariable = {
        valueScopeVariable: placeholderScopeVariable,
        evaluatedVariables: [],
        variableReferences: [],
    };

    const evaluatedVariableNameAndMaybeError = evaluateRValue(parsedEvaluatedVariable.name, context);
    if (evaluatedVariableNameAndMaybeError.error !== null) {
        return new DataAndMaybeError(result, evaluatedVariableNameAndMaybeError.error);
    }
    const evaluatedVariableName = evaluatedVariableNameAndMaybeError.data;
    const evaluatedVariableRange = new SourceRange(context.thisFbuildUri, parsedEvaluatedVariable.range);
    if (typeof evaluatedVariableName.value !== 'string') {
        const error = new InternalEvaluationError(evaluatedVariableRange, `Variable name must evaluate to a String, but instead is ${getValueTypeNameA(evaluatedVariableName.value)}`);
        return new DataAndMaybeError(result, error);
    }

    result.evaluatedVariables = evaluatedVariableName.evaluatedVariables;
    result.variableReferences = evaluatedVariableName.variableReferences;

    const maybeValueScopeVariable = (parsedEvaluatedVariable.scope === 'current')
        ? context.scopeStack.getVariableStartingFromCurrentScopeOrError(evaluatedVariableName.value, evaluatedVariableRange)
        : context.scopeStack.getVariableStartingFromParentScopeOrError(evaluatedVariableName.value, evaluatedVariableRange);
    if (maybeValueScopeVariable.hasError) {
        return new DataAndMaybeError(result, maybeValueScopeVariable.getError());
    }
    result.valueScopeVariable = maybeValueScopeVariable.getValue();

    const parsedEvaluatedVariableRange = new SourceRange(context.thisFbuildUri, parsedEvaluatedVariable.range);

    result.evaluatedVariables.push({
        value: result.valueScopeVariable.value,
        range: parsedEvaluatedVariableRange,
    });

    result.variableReferences.push({
        definition: result.valueScopeVariable.definition,
        range: parsedEvaluatedVariableRange,
    });

    return new DataAndMaybeError(result);
}

// `parts` is an array of either strings or `evaluatedVariable` parse-data.
function evaluateStringExpression(parts: (string | any)[], context: EvaluationContext): DataAndMaybeError<EvaluatedStringExpression> {
    const result: EvaluatedStringExpression = {
        evaluatedString: '',
        evaluatedVariables: [],
        variableReferences: [],
    };

    for (const part of parts) {
        if (isParsedEvaluatedVariable(part)) {
            const evaluatedAndMaybeError = evaluateEvaluatedVariable(part, context);
            if (evaluatedAndMaybeError.error !== null) {
                return new DataAndMaybeError(result, evaluatedAndMaybeError.error);
            }
            const evaluated = evaluatedAndMaybeError.data;
            result.evaluatedString += String(evaluated.valueScopeVariable.value);
            pushToFirstArray(result.evaluatedVariables, evaluated.evaluatedVariables);
            pushToFirstArray(result.variableReferences, evaluated.variableReferences);
        } else {
            // Literal
            result.evaluatedString += part;
        }
    }

    return new DataAndMaybeError(result);
}

function evaluateStruct(struct: ParsedStruct, context: EvaluationContext): DataAndMaybeError<EvaluatedRValue> {
    let evaluatedStatementsAndMaybeError = new DataAndMaybeError(new EvaluatedData());
    let structScope = new Scope(true /*canAccessParentScopes*/);
    context.scopeStack.withScope(() => {
        evaluatedStatementsAndMaybeError = evaluateStatements(struct.statements, context);
        structScope = context.scopeStack.getCurrentScope();
    });

    const structMembers = new Map<VariableName, StructMember>();
    for (const [name, variable] of structScope.variables) {
        structMembers.set(name, new StructMember(variable.value, variable.definition));
    }
    const evaluatedValue = new Struct(structMembers);

    const evaluatedStatements = evaluatedStatementsAndMaybeError.data;

    const result: EvaluatedRValue = {
        value: evaluatedValue,
        range: struct.range,
        evaluatedVariables: evaluatedStatements.evaluatedVariables,
        variableReferences: evaluatedStatements.variableReferences,
        variableDefinitions: evaluatedStatements.variableDefinitions,
    };
    return new DataAndMaybeError(result, evaluatedStatementsAndMaybeError.error);
}

function evaluateSum(sum: ParsedSum, context: EvaluationContext): DataAndMaybeError<EvaluatedRValue> {
    if (sum.summands.length == 0) {
        const dummyRange = SourceRange.create(context.thisFbuildUri, 0, 0, 0, 0);
        return createErrorEvaluatedRValue(new InternalEvaluationError(dummyRange, `A sum must have at least 2 values to add`));
    }

    const resultAndMaybeError = evaluateRValue(sum.first, context);
    if (resultAndMaybeError.error !== null) {
        return resultAndMaybeError;
    }
    const result = resultAndMaybeError.data;

    // Copy the value so that we don't modify the EvaluatedVariable which references it when we add to it.
    result.value = deepCopyValue(result.value);

    let previousSummandValue = result;
    for (const summand of sum.summands) {
        const evaluatedSummandAndMaybeError = evaluateRValue(summand.value, context);
        if (evaluatedSummandAndMaybeError.error !== null) {
            return new DataAndMaybeError(result, evaluatedSummandAndMaybeError.error);
        }
        const evaluatedSummand = evaluatedSummandAndMaybeError.data;
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
            return new DataAndMaybeError(result, maybeSum.getError());
        }
        result.value = maybeSum.getValue();
        pushToFirstArray(result.evaluatedVariables, evaluatedSummand.evaluatedVariables);
        pushToFirstArray(result.variableReferences, evaluatedSummand.variableReferences);
        pushToFirstArray(result.variableDefinitions, evaluatedSummand.variableDefinitions);
        previousSummandValue = summand.value;
    }

    return new DataAndMaybeError(result);
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
            return Maybe.error(new EvaluationError(additionRange, `Cannot add ${getValueTypeNameA(summand)} to a Struct. Can only add a Struct.`));
        }
    } else if (typeof existingValue === 'string') {
        if (typeof summand === 'string') {
            existingValue += summand;
        } else {
            return Maybe.error(new EvaluationError(additionRange, `Cannot add ${getValueTypeNameA(summand)} to a String. Can only add a String.`));
        }
    } else if (typeof existingValue === 'number') {
        if (typeof summand === 'number') {
            existingValue += summand;
        } else {
            return Maybe.error(new EvaluationError(additionRange, `Cannot add ${getValueTypeNameA(summand)} to an Integer. Can only add an Integer.`));
        }
    } else if (typeof existingValue === 'boolean') {
        return Maybe.error(new EvaluationError(additionRange, `Cannot add to a Boolean.`));
    } else {
        return Maybe.error(new EvaluationError(additionRange, `Cannot add ${getValueTypeNameA(summand)} to ${getValueTypeNameA(existingValue)}.`));
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
                    return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract ${getValueTypeNameA(valueToSubtract)} from an Array of Strings. Can only subtract a String.`));
                }
            } else {
                return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract from an Array of ${getValueTypeName(existingValue[0])}s. Can only subtract from an Array if it is an Array of Strings.`));
            }
        }
    } else if (existingValue instanceof Struct) {
        return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract from a Struct.`));
    } else if (typeof existingValue === 'string') {
        if (typeof valueToSubtract === 'string') {
            // Remove all substrings of |valueToSubtract|.
            // This code can be refactored to use replaceAll once on Node version 15+: existingValue.replaceAll(valueToSubtract, '')
            const escapedValueToSubtract = valueToSubtract.replace(/([.*+?^=!:${}()|[\]/\\])/g, "\\$1");
            existingValue = existingValue.replace(new RegExp(escapedValueToSubtract, 'g'), '');
        } else {
            return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract ${getValueTypeNameA(valueToSubtract)} from a String. Can only subtract a String.`));
        }
    } else if (typeof existingValue === 'number') {
        if (typeof valueToSubtract === 'number') {
            existingValue -= valueToSubtract;
        } else {
            return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract ${getValueTypeNameA(valueToSubtract)} from an Integer. Can only subtract an Integer.`));
        }
    } else if (typeof existingValue === 'boolean') {
        return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract from a Boolean.`));
    } else {
        return Maybe.error(new EvaluationError(subtractionRange, `Cannot subtract ${getValueTypeNameA(valueToSubtract)} from ${getValueTypeNameA(existingValue)}.`));
    }

    return Maybe.ok(existingValue);
}

function evaluateIfCondition(
    condition: ParsedIfCondtion,
    context: EvaluationContext,
    statementRange: SourceRange
): DataAndMaybeError<EvaluatedCondition>
{
    const result: EvaluatedCondition = {
        condition: false,
        evaluatedVariables: [],
        variableReferences: [],
    };

    if (isParsedIfConditionBoolean(condition)) {
        const evaluatedConditionAndMaybeError = evaluateRValue(condition.value, context);
        const evaluatedCondition = evaluatedConditionAndMaybeError.data;
        pushToFirstArray(result.evaluatedVariables, evaluatedCondition.evaluatedVariables);
        pushToFirstArray(result.variableReferences, evaluatedCondition.variableReferences);
        if (evaluatedConditionAndMaybeError.error !== null) {
            return new DataAndMaybeError(result, evaluatedConditionAndMaybeError.error);
        }
        const evaluatedConditionValue = evaluatedCondition.value;
        if (typeof evaluatedConditionValue !== 'boolean') {
            const conditionValueRange = new SourceRange(context.thisFbuildUri, evaluatedCondition.range);
            const error = new EvaluationError(conditionValueRange, `Condition must evaluate to a Boolean, but instead evaluates to ${getValueTypeNameA(evaluatedConditionValue)}`);
            return new DataAndMaybeError(result, error);
        }
        result.condition = condition.invert ? !evaluatedConditionValue : evaluatedConditionValue;
        return new DataAndMaybeError(result);
    } else if (isParsedIfConditionComparison(condition)) {
        // Evaluate LHS.
        const lhs = condition.lhs;
        const evaluatedLhsAndMaybeError = evaluateRValue(lhs, context);
        const evaluatedLhs = evaluatedLhsAndMaybeError.data;
        pushToFirstArray(result.evaluatedVariables, evaluatedLhs.evaluatedVariables);
        pushToFirstArray(result.variableReferences, evaluatedLhs.variableReferences);
        if (evaluatedLhsAndMaybeError.error !== null) {
            return new DataAndMaybeError(result, evaluatedLhsAndMaybeError.error);
        }
        const evaluatedLhsValue = evaluatedLhs.value;

        // Evaluate RHS.
        const rhs = condition.rhs;
        const evaluatedRhsAndMaybeError = evaluateRValue(rhs, context);
        const evaluatedRhs = evaluatedRhsAndMaybeError.data;
        pushToFirstArray(result.evaluatedVariables, evaluatedRhs.evaluatedVariables);
        pushToFirstArray(result.variableReferences, evaluatedRhs.variableReferences);
        if (evaluatedRhsAndMaybeError.error !== null) {
            return new DataAndMaybeError(result, evaluatedRhsAndMaybeError.error);
        }
        const evaluatedRhsValue = evaluatedRhs.value;

        const operator = condition.operator;

        // Verify that the type is allowed.
        // Just check the LHS type because below we check that the LHS and RHS types are equal.
        if (operator.value === '==' || operator.value === '!=') {
            if (!['boolean', 'string', 'number'].includes(typeof evaluatedLhsValue)) {
                const operatorRange = new SourceRange(context.thisFbuildUri, operator.range);
                const error = new EvaluationError(operatorRange, `'If' comparison using '${operator.value}' only supports comparing Booleans, Strings, and Integers, but ${getValueTypeNameA(evaluatedLhsValue)} is used`);
                return new DataAndMaybeError(result, error);
            }
        } else {
            if (!['string', 'number'].includes(typeof evaluatedLhsValue)) {
                const operatorRange = new SourceRange(context.thisFbuildUri, operator.range);
                const error = new EvaluationError(operatorRange, `'If' comparison using '${operator.value}' only supports comparing Strings and Integers, but ${getValueTypeNameA(evaluatedLhsValue)} is used`);
                return new DataAndMaybeError(result, error);
            }
        }

        if (typeof evaluatedLhsValue !== typeof evaluatedRhsValue) {
            const range = new SourceRange(context.thisFbuildUri, { start: lhs.range.start, end: rhs.range.end });
            const error = new EvaluationError(range, `'If' condition comparison must compare variables of the same type, but LHS is ${getValueTypeNameA(evaluatedLhsValue)} and RHS is ${getValueTypeNameA(evaluatedRhsValue)}`);
            return new DataAndMaybeError(result, error);
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
                const error = new InternalEvaluationError(statementRange, `Unknown 'If' comparison operator '${operator.value}'`);
                return new DataAndMaybeError(result, error);
            }
        }

        result.condition = comparisonResult;
        return new DataAndMaybeError(result);
    } else if (isParsedIfConditionIn(condition)) {
        // Evaluate LHS.
        const lhs = condition.lhs;
        const evaluatedLhsAndMaybeError = evaluateRValue(lhs, context);
        const evaluatedLhs = evaluatedLhsAndMaybeError.data;
        pushToFirstArray(result.evaluatedVariables, evaluatedLhs.evaluatedVariables);
        pushToFirstArray(result.variableReferences, evaluatedLhs.variableReferences);
        if (evaluatedLhsAndMaybeError.error !== null) {
            return new DataAndMaybeError(result, evaluatedLhsAndMaybeError.error);
        }
        const evaluatedLhsValue = evaluatedLhs.value;

        // Evaluate RHS.
        const rhs = condition.rhs;
        const evaluatedRhsAndMaybeError = evaluateRValue(rhs, context);
        const evaluatedRhs = evaluatedRhsAndMaybeError.data;
        pushToFirstArray(result.evaluatedVariables, evaluatedRhs.evaluatedVariables);
        pushToFirstArray(result.variableReferences, evaluatedRhs.variableReferences);
        if (evaluatedRhsAndMaybeError.error !== null) {
            return new DataAndMaybeError(result, evaluatedRhsAndMaybeError.error);
        }
        const rhsRange = new SourceRange(context.thisFbuildUri, rhs.range);
        const evaluatedRhsValue = evaluatedRhs.value;

        //
        // Check presence.
        //

        let isPresent = true;

        if (!(evaluatedRhsValue instanceof Array)) {
            const error = new EvaluationError(rhsRange, `'If' 'in' condition right-hand-side value must be an Array of Strings, but instead is ${getValueTypeNameA(evaluatedRhsValue)}`);
            return new DataAndMaybeError(result, error);
        }

        if (!isParsedEvaluatedVariable(rhs)) {
            const error = new EvaluationError(rhsRange, `'If' 'in' condition right-hand-side value cannot be a literal Array Of Strings. Instead use an evaluated variable.`);
            return new DataAndMaybeError(result, error);
        }

        if (evaluatedRhsValue.length === 0) {
            isPresent = false;
        } else if (typeof evaluatedRhsValue[0] === 'string') {
            const lhsRange = new SourceRange(context.thisFbuildUri, lhs.range);
            if (typeof evaluatedLhsValue === 'string') {
                isPresent = evaluatedRhsValue.includes(evaluatedLhsValue);
            } else if (evaluatedLhsValue instanceof Array) {
                if (!isParsedEvaluatedVariable(lhs)) {
                    const error = new EvaluationError(lhsRange, `'If' 'in' condition left-hand-side value cannot be a literal Array Of Strings. Instead use an evaluated variable.`);
                    return new DataAndMaybeError(result, error);
                }

                if (evaluatedLhsValue.length === 0) {
                    isPresent = false;
                } else if (typeof evaluatedLhsValue[0] === 'string') {
                    isPresent = evaluatedLhsValue.some(searchString => evaluatedRhsValue.includes(searchString));
                } else {
                    const error = new EvaluationError(lhsRange, `'If' 'in' condition left-hand-side value must be either a String or an Array of Strings, but instead is an Array of ${getValueTypeName(evaluatedLhsValue[0])}s`);
                    return new DataAndMaybeError(result, error);
                }
            } else {
                const error = new EvaluationError(lhsRange, `'If' 'in' condition left-hand-side value must be either a String or an Array of Strings, but instead is ${getValueTypeNameA(evaluatedLhsValue)}`);
                return new DataAndMaybeError(result, error);
            }
        } else {
            const error = new EvaluationError(rhsRange, `'If' 'in' condition right-hand-side value must be an Array of Strings, but instead is an Array of ${getValueTypeName(evaluatedRhsValue[0])}s`);
            return new DataAndMaybeError(result, error);
        }

        result.condition = condition.invert ? !isPresent : isPresent;
        return new DataAndMaybeError(result);
    } else if (isParsedIfConditionOperatorAnd(condition)) {
        // Evaluate LHS
        const evaluatedLhsAndMaybeError = evaluateIfCondition(condition.lhs, context, statementRange);
        const evaluatedLhs = evaluatedLhsAndMaybeError.data;
        pushToFirstArray(result.evaluatedVariables, evaluatedLhs.evaluatedVariables);
        pushToFirstArray(result.variableReferences, evaluatedLhs.variableReferences);
        if (evaluatedLhsAndMaybeError.error !== null) {
            return new DataAndMaybeError(result, evaluatedLhsAndMaybeError.error);
        }

        // Evaluate RHS
        const evaluatedRhsAndMaybeError = evaluateIfCondition(condition.rhs, context, statementRange);
        const evaluatedRhs = evaluatedRhsAndMaybeError.data;
        pushToFirstArray(result.evaluatedVariables, evaluatedRhs.evaluatedVariables);
        pushToFirstArray(result.variableReferences, evaluatedRhs.variableReferences);
        if (evaluatedRhsAndMaybeError.error !== null) {
            return new DataAndMaybeError(result, evaluatedRhsAndMaybeError.error);
        }

        result.condition = evaluatedLhs.condition && evaluatedRhs.condition;
        return new DataAndMaybeError(result);
    } else if (isParsedIfConditionOperatorOr(condition)) {
        // Evaluate LHS
        const evaluatedLhsAndMaybeError = evaluateIfCondition(condition.lhs, context, statementRange);
        const evaluatedLhs = evaluatedLhsAndMaybeError.data;
        pushToFirstArray(result.evaluatedVariables, evaluatedLhs.evaluatedVariables);
        pushToFirstArray(result.variableReferences, evaluatedLhs.variableReferences);
        if (evaluatedLhsAndMaybeError.error !== null) {
            return new DataAndMaybeError(result, evaluatedLhsAndMaybeError.error);
        }

        // Evaluate RHS
        const evaluatedRhsAndMaybeError = evaluateIfCondition(condition.rhs, context, statementRange);
        const evaluatedRhs = evaluatedRhsAndMaybeError.data;
        pushToFirstArray(result.evaluatedVariables, evaluatedRhs.evaluatedVariables);
        pushToFirstArray(result.variableReferences, evaluatedRhs.variableReferences);
        if (evaluatedRhsAndMaybeError.error !== null) {
            return new DataAndMaybeError(result, evaluatedRhsAndMaybeError.error);
        }

        result.condition = evaluatedLhs.condition || evaluatedRhs.condition;
        return new DataAndMaybeError(result);
    } else {
        const error = new InternalEvaluationError(statementRange, `Unknown condition type from condition '${JSON.stringify(condition)}'`);
        return new DataAndMaybeError(result, error);
    }
}


// Evaluate the condition, which is an array of AND statements OR'd together.
function evaluateDirectiveIfCondition(
    statement: ParsedStatementDirectiveIf,
    context: EvaluationContext
): DataAndMaybeError<boolean>
{
    let result = false;
    const orExpressions = statement.condition;
    for (const andExpressions of orExpressions) {
        let andExpressionResult = true;
        for (const conditionTermOrNot of andExpressions) {
            const term = conditionTermOrNot.term;
            const invert = conditionTermOrNot.invert;
            let evaulatedTerm = false;
            if (isParsedDirectiveIfConditionTermIsSymbolDefined(term)) {
                evaulatedTerm = context.defines.has(term.symbol);
            } else if (isParsedDirectiveIfConditionTermEnvVarExists(term)) {
                // The language server cannot know what environment variables will exist when FASTBuild is run,
                // so always assume "exists(...)" evaluates to false.
                evaulatedTerm = false;
            } else if (isParsedDirectiveIfConditionTermFileExists(term)) {
                const fileUri = convertFileSystemPathToUri(term.filePath.value, context.thisFbuildUri);
                evaulatedTerm = context.fileSystem.fileExists(fileUri);
            } else {
                const rangeStart = statement.rangeStart;
                const range = SourceRange.create(context.thisFbuildUri, rangeStart.line, rangeStart.character, rangeStart.line, Number.MAX_VALUE);
                const error = new InternalEvaluationError(range, `Unknown '#if' term type from term '${JSON.stringify(term)}' from statement ${JSON.stringify(statement)}`);
                return new DataAndMaybeError(false, error);
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

    return new DataAndMaybeError(result);
}

function evaluateUserFunctionDeclaration(
    userFunction: ParsedStatementUserFunctionDeclaration,
    context: EvaluationContext
): DataAndMaybeError<EvaluatedData> {
    const nameSourceRange = new SourceRange(context.thisFbuildUri, userFunction.nameRange);
    const functionNameDefinition = context.scopeStack.createVariableDefinition(nameSourceRange, userFunction.name);
    const functionNameReference = {
        definition: functionNameDefinition,
        range: nameSourceRange,
    };

    const result = new EvaluatedData();
    result.variableReferences.push(functionNameReference);
    result.variableDefinitions.push(functionNameDefinition);

    // Ensure that the function name is not reserved.
    if (RESERVED_SYMBOL_NAMES.has(userFunction.name)) {
        const error = new EvaluationError(nameSourceRange, `Cannot use function name "${userFunction.name}" because it is reserved.`);
        return new DataAndMaybeError(result, error);
    }

    // Ensure that the function name is not already used by another user function.
    if (context.userFunctions.has(userFunction.name)) {
        const error = new EvaluationError(nameSourceRange, `Cannot use function name "${userFunction.name}" because it is already used by another user function. Functions must be uniquely named.`);
        return new DataAndMaybeError(result, error);
    }

    // Define and reference each parameter.
    //
    // Ensure that the parameter names are unique.
    // Use an Array instead of a Set since we're optimizing for a small number of parameters.
    const usedParameterNames: string[] = [];
    for (const parameter of userFunction.parameters) {
        const paramSourceRange = new SourceRange(context.thisFbuildUri, parameter.range);

        if (usedParameterNames.includes(parameter.name)) {
            const error = new EvaluationError(paramSourceRange, `User-function argument names must be unique.`);
            return new DataAndMaybeError(result, error);
        }
        usedParameterNames.push(parameter.name);

        const definition = context.scopeStack.createVariableDefinition(paramSourceRange, parameter.name);
        parameter.definition = definition;

        result.variableDefinitions.push(definition);
        result.variableReferences.push({
            definition: definition,
            range: paramSourceRange,
        });
    }

    context.userFunctions.set(userFunction.name, {
        definition: functionNameDefinition,
        parameters: userFunction.parameters,
        statements: userFunction.statements,
    });

    return new DataAndMaybeError(result);
}

function evaluateUserFunctionCall(
    call: ParsedStatementUserFunctionCall,
    context: EvaluationContext
): DataAndMaybeError<EvaluatedData> {
    const result = new EvaluatedData();
    const nameSourceRange = new SourceRange(context.thisFbuildUri, call.nameRange);

    // Lookup the function.
    const userFunction = context.userFunctions.get(call.name);
    if (userFunction === undefined) {
        const error = new EvaluationError(nameSourceRange, `No function exists with the name "${call.name}".`);
        return new DataAndMaybeError(result, error);
    }

    // Reference the function.
    result.variableReferences.push({
        definition: userFunction.definition,
        range: nameSourceRange,
    });

    if (call.parameters.length !== userFunction.parameters.length) {
        const callSourceRange = new SourceRange(context.thisFbuildUri, call.range);
        const numExpectedArgumentsStr = `${userFunction.parameters.length} argument${userFunction.parameters.length === 1 ? '' : 's'}`;
        const error = new EvaluationError(callSourceRange, `User function "${call.name}" takes ${numExpectedArgumentsStr} but passing ${call.parameters.length}.`);
        return new DataAndMaybeError(result, error);
    }

    if (context.scopeStack.getDepth() > MAX_SCOPE_STACK_DEPTH) {
        const callSourceRange = new SourceRange(context.thisFbuildUri, call.range);
        const error = new EvaluationError(callSourceRange, 'Excessive scope depth. Possible infinite recursion from user function calls.');
        return new DataAndMaybeError(result, error);
    }

    // Evaluate the call-parameters' values.
    // Note that we evaluate the call's parameter in the current context, not the function call context.
    const paramValues: Value[] = new Array(call.parameters.length);
    for (const [i, callParam] of call.parameters.entries()) {
        const evaluatedValueAndMaybeError = evaluateRValue(callParam.value, context);
        const evaluatedValue = evaluatedValueAndMaybeError.data;
        pushToFirstArray(result.evaluatedVariables, evaluatedValue.evaluatedVariables);
        pushToFirstArray(result.variableReferences, evaluatedValue.variableReferences);
        pushToFirstArray(result.variableDefinitions, evaluatedValue.variableDefinitions);
        if (evaluatedValueAndMaybeError.error !== null) {
            return new DataAndMaybeError(result, evaluatedValueAndMaybeError.error);
        }
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
            scopeStack: context.scopeStack,
            // User functions do not share defines.
            defines: createDefaultDefines(),
            // User functions can call other user functions.
            userFunctions: context.userFunctions,
            rootFbuildDirUri: context.rootFbuildDirUri,
            thisFbuildUri: context.thisFbuildUri,
            fileSystem: context.fileSystem,
            parseDataProvider: context.parseDataProvider,
            onceIncludeUrisAlreadyIncluded: context.onceIncludeUrisAlreadyIncluded,
            previousStatementLhsVariable: null,
        };

        // Set a variable for each parameter.
        for (const [i, funcDeclarationParam] of userFunction.parameters.entries()) {
            if (funcDeclarationParam.definition === undefined) {
                const callParam = call.parameters[i];
                const callParamSourceRange = new SourceRange(context.thisFbuildUri, callParam.range);
                throw new InternalEvaluationError(callParamSourceRange, `Bug: user-function "${call.name}"'s "${funcDeclarationParam.name}" parameter has no definition`);
            }

            // Note that we set the variable in the function call context, not the current context.
            functionCallContext.scopeStack.setVariableInCurrentScope(funcDeclarationParam.name, paramValues[i], funcDeclarationParam.definition);
        }

        const evaluatedDataAndMaybeError = evaluateStatements(userFunction.statements, functionCallContext);
        const evaluatedData = evaluatedDataAndMaybeError.data;
        result.append(evaluatedData);
        error = evaluatedDataAndMaybeError.error;
    });
    if (error !== null) {
        return new DataAndMaybeError(result, error);
    }

    return new DataAndMaybeError(result);
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
                ([memberName, member]) => [memberName, new StructMember(deepCopyValue(member.value), member.definition)]));
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