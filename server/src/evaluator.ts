import * as os from 'os';
import * as path from 'path';

import {
    ParseData,
    ParseSourceRange,
    SourcePosition,
    Statement,
} from './parser';

import { IFileSystem } from './fileSystem';

import { ParseDataProvider, UriStr } from './parseDataProvider';

// Used to manipulate URIs.
import * as vscodeUri from 'vscode-uri';

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

export type Value = boolean | number | string | Value[] | Struct;

export class Struct extends Map<string, Value> {
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
}

export interface VariableReference {
    definition: VariableDefinition;
    range: SourceRange;
    // Set when the reference is to a variable defined in a struct brought into scope from a `Using` call.
    usingRange: SourceRange | null;
}

export class EvaluatedData {
    evaluatedVariables: EvaluatedVariable[] = [];
    variableReferences: VariableReference[] = [];
    variableDefinitions = new Map<string, VariableDefinition>();
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

interface ParsedSum {
    type: 'sum';
    summands: Value[];
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
    value: Array<any>;
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

interface ParsedStatementVariableAddition {
    type: 'variableAddition';
    lhs: ParsedVariableDefinitionLhs;
    rhs: any;
}

function isParsedStatementVariableAddition(obj: Record<string, any>): obj is ParsedStatementVariableAddition {
    return (obj as ParsedStatementVariableAddition).type === 'variableAddition';
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

interface ParsedStatementForEach {
    type: 'forEach';
    range: ParseSourceRange;
    arrayToLoopOver: ParsedEvaluatedVariable;
    loopVar: {
        name: string,
        range: ParseSourceRange,
    }
    statements: Statement[];
}

function isParsedStatementForEach(obj: Record<string, any>): obj is ParsedStatementForEach {
    return (obj as ParsedStatementForEach).type === 'forEach';
}

interface ParsedStatementGenericFunction {
    type: 'genericFunction';
    range: ParseSourceRange;
    alias: any;
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

interface ParsedStatementIf {
    type: 'if';
    range: ParseSourceRange;
    condition: ParsedIfConditionBoolean | ParsedIfConditionComparison | ParsedIfConditionIn;
    statements: Statement[];
}

// If
function isParsedStatementIf(obj: Record<string, any>): obj is ParsedStatementIf {
    return (obj as ParsedStatementIf).type === 'if';
}

// #include
interface ParsedStatementInclude {
    type: 'include';
    path: string;
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
    filePath: string;
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
}

function isParsedStatementImportEnvVar(obj: Record<string, any>): obj is ParsedStatementImportEnvVar {
    return (obj as ParsedStatementImportEnvVar).type === 'importEnvVar';
}

interface EvaluatedRValue {
    value: Value;
    range: ParseSourceRange;
    evaluatedVariables: EvaluatedVariable[];
    variableReferences: VariableReference[];
    // Used for structs.
    variableDefinitions: Map<string, VariableDefinition>;
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

interface ScopeVariable {
    value: Value;
    definition: VariableDefinition;
    // Set if `value` is a Struct.
    structMemberDefinitions: Map<string, VariableDefinition> | null;
    // Set if the variable was created from a `Using` statement.
    usingRange: SourceRange | null;
}

class Scope {
    variables = new Map<string, ScopeVariable>();
}

class ScopeStack {
    private stack: Array<Scope> = []
    private nextVariableDefinitionId = 1;

    constructor() {
        this.push();
    }

    private push() {
        const scope = new Scope();
        this.stack.push(scope);
    }

    withScope(body: () => void) {
        this.push();
        body();
        this.stack.pop();
    }

    // Get a variable, searching from the current scope to its parents.
    // Throw EvaluationError if the variable is not defined.
    getVariableStartingFromCurrentScope(variableName: string, variableRange: SourceRange): ScopeVariable {
        for (let scopeIndex = this.stack.length - 1; scopeIndex >= 0; --scopeIndex) {
            const scope = this.stack[scopeIndex];
            const maybeVariable = scope.variables.get(variableName);
            if (maybeVariable !== undefined) {
                return maybeVariable;
            }
        }
        throw new EvaluationError(variableRange, `Referencing variable "${variableName}" that is undefined in the current scope or any of the parent scopes.`);
    }

    // Throw EvaluationError if the variable is not defined.
    getVariableInCurrentScope(variableName: string, variableRange: SourceRange): ScopeVariable {
        const currentScope = this.getCurrentScope();
        const maybeVariable = currentScope.variables.get(variableName);
        if (maybeVariable === undefined) {
            throw new EvaluationError(variableRange, `Referencing varable "${variableName}" that is undefined in the current scope.`);
        } else {
            return maybeVariable;
        }
    }

    // Throw EvaluationError if the variable is not defined.
    getVariableInParentScope(variableName: string, variableRange: SourceRange): ScopeVariable {
        const parentScope = this.getParentScope(variableRange);
        const maybeVariable = parentScope.variables.get(variableName);
        if (maybeVariable === undefined) {
            throw new EvaluationError(variableRange, `Referencing varable "${variableName}" that is undefined in the parent scope.`);
        } else {
            return maybeVariable;
        }
    }

    // Throw EvaluationError if the variable is not defined.
    getVariableInScope(scope: ScopeLocation, variableName: string, variableRange: SourceRange): ScopeVariable {
        if (scope == 'current') {
            return this.getVariableInCurrentScope(variableName, variableRange);
        } else {
            return this.getVariableInParentScope(variableName, variableRange);
        }
    }

    setVariableInCurrentScope(name: string, value: Value, definition: VariableDefinition): ScopeVariable {
        const currentScope = this.getCurrentScope();
        const existingVariable = currentScope.variables.get(name);
        if (existingVariable === undefined) {
            const variable: ScopeVariable = {
                value: value,
                definition: definition,
                structMemberDefinitions: null,
                usingRange: null,
            };
            currentScope.variables.set(name, variable);
            return variable;
        } else {
            existingVariable.value = value;
            return existingVariable;
        }
    }

    updateExistingVariableInCurrentScope(name: string, value: Value, variableRange: SourceRange): ScopeVariable {
        const currentScope = this.getCurrentScope();
        const existingVariable = currentScope.variables.get(name);
        if (existingVariable === undefined) {
            throw new EvaluationError(variableRange, `Cannot update variable "${name}" in current scope because the variable does not exist in the current scope.`);
        }
        existingVariable.value = value;
        return existingVariable;
    }

    updateExistingVariableInParentScope(name: string, value: Value, variableRange: SourceRange): ScopeVariable {
        const parentScope = this.getParentScope(variableRange);
        const existingVariable = parentScope.variables.get(name);
        if (existingVariable === undefined) {
            throw new EvaluationError(variableRange, `Cannot update variable "${name}" in parent scope because the variable does not exist in the parent scope.`);
        }
        existingVariable.value = value;
        return existingVariable;
    }

    getCurrentScope(): Scope {
        return this.stack[this.stack.length - 1];
    }

    private getParentScope(variableRange: SourceRange): Scope {
        if (this.stack.length < 2) {
            throw new EvaluationError(variableRange, `Cannot access parent scope because there is no parent scope.`);
        }
        return this.stack[this.stack.length - 2];
    }

    createVariableDefinition(range: SourceRange): VariableDefinition {
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

// thisFbuildUri is used to calculate relative paths (e.g. from #include)
export function evaluate(parseData: ParseData, thisFbuildUri: string, fileSystem: IFileSystem, parseDataProvider: ParseDataProvider): EvaluatedData {
    const rootFbuildDirUri = vscodeUri.Utils.dirname(vscodeUri.URI.parse(thisFbuildUri));

    const scopeStack = new ScopeStack();

    const dummyVariableDefinition: VariableDefinition = {
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
        }
    };

    scopeStack.setVariableInCurrentScope('_WORKING_DIR_', rootFbuildDirUri.fsPath, dummyVariableDefinition);
    scopeStack.setVariableInCurrentScope('_CURRENT_BFF_DIR_', '', dummyVariableDefinition);
    scopeStack.setVariableInCurrentScope('_FASTBUILD_VERSION_STRING_', 'vPlaceholderFastBuildVersionString', dummyVariableDefinition);
    scopeStack.setVariableInCurrentScope('_FASTBUILD_VERSION_', -1, dummyVariableDefinition);

    const defines = new Set<string>();
    defines.add(getPlatformSpecificDefineSymbol());

    const context = {
        scopeStack,
        defines,
        rootFbuildDirUri: rootFbuildDirUri.toString(),
        thisFbuildUri,
        fileSystem,
        parseDataProvider,
        onceIncludeUrisAlreadyIncluded: [],
    };
    return evaluateStatements(parseData.statements, context);
}

interface EvaluationContext {
    scopeStack: ScopeStack,
    defines: Set<string>,
    rootFbuildDirUri: string,
    thisFbuildUri: UriStr,
    fileSystem: IFileSystem,
    parseDataProvider: ParseDataProvider,
    onceIncludeUrisAlreadyIncluded: string[];
}

function evaluateStatements(statements: Statement[], context: EvaluationContext): EvaluatedData {
    const result: EvaluatedData = {
        evaluatedVariables: [],
        variableReferences: [],
        variableDefinitions: new Map<string, VariableDefinition>(),
    };

    for (const statement of statements) {
        if (isParsedStatementVariableDefintion(statement)) {
            const evaluatedRhs = evaluateRValue(statement.rhs, context);
            result.evaluatedVariables.push(...evaluatedRhs.evaluatedVariables);
            result.variableReferences.push(...evaluatedRhs.variableReferences);
            for (const [varName, varDefinition] of evaluatedRhs.variableDefinitions) {
                result.variableDefinitions.set(varName, varDefinition);
            }

            const lhs: ParsedVariableDefinitionLhs = statement.lhs;
            const lhsRange = new SourceRange(context.thisFbuildUri, lhs.range);

            const evaluatedLhsName = evaluateRValue(lhs.name, context);
            if (typeof evaluatedLhsName.value !== 'string') {
                throw new EvaluationError(lhsRange, `Variable name must evaluate to a string, but instead is ${JSON.stringify(evaluatedLhsName.value)}`);
            }
            result.evaluatedVariables.push(...evaluatedLhsName.evaluatedVariables);
            result.variableReferences.push(...evaluatedLhsName.variableReferences);

            let variable: ScopeVariable | null = null;
            if (lhs.scope == 'current') {
                const definition = context.scopeStack.createVariableDefinition(lhsRange);
                variable = context.scopeStack.setVariableInCurrentScope(evaluatedLhsName.value, evaluatedRhs.value, definition);
            } else {
                variable = context.scopeStack.updateExistingVariableInParentScope(evaluatedLhsName.value, evaluatedRhs.value, lhsRange);
            }

            if (evaluatedRhs.value instanceof Struct) {
                variable.structMemberDefinitions = evaluatedRhs.variableDefinitions;
            }

            // The definition's LHS is a variable reference.
            result.variableReferences.push({
                definition: variable.definition,
                range: lhsRange,
                usingRange: null,
            });

            
            // The definition's LHS is a variable definition.
            result.variableDefinitions.set(evaluatedLhsName.value, variable.definition);
        } else if (isParsedStatementVariableAddition(statement)) {
            const evaluatedRhs = evaluateRValue(statement.rhs, context);
            result.evaluatedVariables.push(...evaluatedRhs.evaluatedVariables);
            result.variableReferences.push(...evaluatedRhs.variableReferences);

            const lhs = statement.lhs;
            const lhsRange = new SourceRange(context.thisFbuildUri, lhs.range);

            const evaluatedLhsName = evaluateRValue(lhs.name, context);
            if (typeof evaluatedLhsName.value !== 'string') {
                throw new EvaluationError(lhsRange, `Variable name must evaluate to a string, but instead is ${JSON.stringify(evaluatedLhsName.value)}`);
            }
            result.evaluatedVariables.push(...evaluatedLhsName.evaluatedVariables);
            result.variableReferences.push(...evaluatedLhsName.variableReferences);

            const existingVariable = context.scopeStack.getVariableInScope(lhs.scope, evaluatedLhsName.value, lhsRange);
            const previousValue = deepCopyValue(existingVariable.value);
            const additionRange = SourceRange.createFromPosition(context.thisFbuildUri, lhs.range.start, evaluatedRhs.range.end);
            existingVariable.value = inPlaceAdd(existingVariable.value, evaluatedRhs.value, additionRange);

            // The addition's LHS is an evaluated variable and is a variable reference.
            result.evaluatedVariables.push({
                value: previousValue,
                range: lhsRange,
            });
            result.variableReferences.push({
                definition: existingVariable.definition,
                range: lhsRange,
                usingRange: null,
            });
        } else if (isParsedStatementScopedStatements(statement)) {
            context.scopeStack.withScope(() => {
                const evaluatedStatements = evaluateStatements(statement.statements, context);
                result.evaluatedVariables.push(...evaluatedStatements.evaluatedVariables);
                result.variableReferences.push(...evaluatedStatements.variableReferences);
                for (const [varName, varDefinition] of evaluatedStatements.variableDefinitions) {
                    result.variableDefinitions.set(varName, varDefinition);
                }
            });
        } else if (isParsedStatementUsing(statement)) {
            const statementRange = new SourceRange(context.thisFbuildUri, statement.range);
            const structRange = new SourceRange(context.thisFbuildUri, statement.struct.range);

            if (statement.struct.type !== 'evaluatedVariable') {
                throw new EvaluationError(structRange, `'Using' parameter must be an evaluated variable, but instead is '${statement.struct.type}'`);
            }
            const evaluated = evaluateEvaluatedVariable(statement.struct, context);
            result.evaluatedVariables.push(...evaluated.evaluatedVariables);
            result.variableReferences.push(...evaluated.variableReferences);

            const structVariable = evaluated.valueScopeVariable;
            const struct = structVariable.value;
            if (!(struct instanceof Struct)) {
                throw new EvaluationError(structRange, `'Using' parameter must be a struct, but instead is ${JSON.stringify(struct)}`);
            }

            if (structVariable.structMemberDefinitions === null) {
                throw new InternalEvaluationError(structRange, `'Using' parameter variable does not have the 'structMemberDefinitions' property set`);
            }
            for (const [varName, varValue] of struct) {
                const definition = structVariable.structMemberDefinitions.get(varName);
                if (definition === undefined) {
                    throw new InternalEvaluationError(structRange, `'Using' parameter variable does not have a 'structMemberDefinitions' entry for the "${varName}" member variable`);
                }
                const variable = context.scopeStack.setVariableInCurrentScope(varName, varValue, definition);
                variable.usingRange = statementRange;
            }
        } else if (isParsedStatementForEach(statement)) {
            // Evaluate the array to loop over.
            if (statement.arrayToLoopOver.type !== 'evaluatedVariable') {
                const range = new SourceRange(context.thisFbuildUri, statement.range);
                throw new InternalEvaluationError(range, `'ForEach' array to loop over must be an evaluated variable, but instead is '${statement.arrayToLoopOver.type}'`);
            }
            const arrayToLoopOver: ParsedEvaluatedVariable = statement.arrayToLoopOver;
            const arrayToLoopOverRange = new SourceRange(context.thisFbuildUri, arrayToLoopOver.range);
            const evaluatedArrayToLoopOver = evaluateEvaluatedVariable(arrayToLoopOver, context);
            result.evaluatedVariables.push(...evaluatedArrayToLoopOver.evaluatedVariables);
            result.variableReferences.push(...evaluatedArrayToLoopOver.variableReferences);

            const loopVarRange = new SourceRange(context.thisFbuildUri, statement.loopVar.range);

            // Evaluate the loop-variable name.
            const evaluatedLoopVarName = evaluateRValue(statement.loopVar.name, context);
            if (typeof evaluatedLoopVarName.value !== 'string') {
                throw new InternalEvaluationError(loopVarRange, `Variable name must evaluate to a string, but instead is ${JSON.stringify(evaluatedLoopVarName.value)}`);
            }
            const evaluatedLoopVarNameValue: string = evaluatedLoopVarName.value;
            result.evaluatedVariables.push(...evaluatedLoopVarName.evaluatedVariables);
            result.variableReferences.push(...evaluatedLoopVarName.variableReferences);

            // Evaluate the function body.

            const definition = context.scopeStack.createVariableDefinition(loopVarRange);
            const arrayItems = evaluatedArrayToLoopOver.valueScopeVariable.value;
            if (!(arrayItems instanceof Array)) {
                throw new EvaluationError(arrayToLoopOverRange, `'ForEach' variable to loop over must be an array, but instead is ${JSON.stringify(arrayItems)}`);
            }

            context.scopeStack.withScope(() => {
                for (const arrayItem of arrayItems) {
                    const variable = context.scopeStack.setVariableInCurrentScope(evaluatedLoopVarNameValue, arrayItem, definition);

                    // The loop variable is a variable reference.
                    result.variableReferences.push({
                        definition: variable.definition,
                        range: loopVarRange,
                        usingRange: null,
                    });

                    const evaluatedStatements = evaluateStatements(statement.statements, context);
                    result.evaluatedVariables.push(...evaluatedStatements.evaluatedVariables);
                    result.variableReferences.push(...evaluatedStatements.variableReferences);
                    for (const [varName, varDefinition] of evaluatedStatements.variableDefinitions) {
                        result.variableDefinitions.set(varName, varDefinition);
                    }
                }
            });
        } else if (isParsedStatementGenericFunction(statement)) {
            // Evaluate the alias.
            const evaluatedAliasName = evaluateRValue(statement.alias, context);
            if (typeof evaluatedAliasName.value !== 'string') {
                const range = new SourceRange(context.thisFbuildUri, evaluatedAliasName.range);
                throw new EvaluationError(range, `Alias must evaluate to a string, but instead is ${JSON.stringify(evaluatedAliasName.value)}`);
            }
            result.evaluatedVariables.push(...evaluatedAliasName.evaluatedVariables);
            result.variableReferences.push(...evaluatedAliasName.variableReferences);

            // Evaluate the function body.
            context.scopeStack.withScope(() => {
                const evaluatedStatements = evaluateStatements(statement.statements, context);
                result.evaluatedVariables.push(...evaluatedStatements.evaluatedVariables);
                result.variableReferences.push(...evaluatedStatements.variableReferences);
                for (const [varName, varDefinition] of evaluatedStatements.variableDefinitions) {
                    result.variableDefinitions.set(varName, varDefinition);
                }
            });
        } else if (isParsedStatementError(statement)) {
            const evaluatedValue = evaluateRValue(statement.value, context);
            if (typeof evaluatedValue.value !== 'string') {
                const range = new SourceRange(context.thisFbuildUri, statement.range);
                throw new InternalEvaluationError(range, `'Error' argument must evaluate to a string, but instead is ${JSON.stringify(evaluatedValue.value)}`);
            }
            result.evaluatedVariables.push(...evaluatedValue.evaluatedVariables);
            result.variableReferences.push(...evaluatedValue.variableReferences);
        } else if (isParsedStatementPrint(statement)) {
            const value = statement.value;
            const evaluatedValue = evaluateRValue(value, context);
            if (!isParsedEvaluatedVariable(value) && typeof evaluatedValue.value !== 'string') {
                const range = new SourceRange(context.thisFbuildUri, statement.range);
                throw new InternalEvaluationError(range, `'Print' argument must either be a variable or evaluate to a string, but instead is ${JSON.stringify(evaluatedValue.value)}`);
            }
            result.evaluatedVariables.push(...evaluatedValue.evaluatedVariables);
            result.variableReferences.push(...evaluatedValue.variableReferences);
        } else if (isParsedStatementSettings(statement)) {                
            // Evaluate the function body.
            context.scopeStack.withScope(() => {
                const evaluatedStatements = evaluateStatements(statement.statements, context);
                result.evaluatedVariables.push(...evaluatedStatements.evaluatedVariables);
                result.variableReferences.push(...evaluatedStatements.variableReferences);
                for (const [varName, varDefinition] of evaluatedStatements.variableDefinitions) {
                    result.variableDefinitions.set(varName, varDefinition);
                }
            });
        } else if (isParsedStatementIf(statement)) {
            // Evaluate the condition.
            const condition = statement.condition;
            const statementRange = new SourceRange(context.thisFbuildUri, statement.range);
            let evaluatedConditionBool = false;
            if (isParsedIfConditionBoolean(condition)) {
                if (condition.value.type !== 'evaluatedVariable') {
                    throw new InternalEvaluationError(statementRange, `'If' condition must be an evaluated variable, but instead is '${condition.value.type}'`);
                }
                const conditionValue = condition.value;
                const evaluatedCondition = evaluateEvaluatedVariable(conditionValue, context);
                const evaluatedConditionValue = evaluatedCondition.valueScopeVariable.value;
                if (typeof evaluatedConditionValue !== 'boolean') {
                    const conditionValueRange = new SourceRange(context.thisFbuildUri, conditionValue.range);
                    throw new EvaluationError(conditionValueRange, `Condition must evaluate to a boolean, but instead is ${JSON.stringify(evaluatedConditionValue)}`);
                }
                result.evaluatedVariables.push(...evaluatedCondition.evaluatedVariables);
                result.variableReferences.push(...evaluatedCondition.variableReferences);

                evaluatedConditionBool = condition.invert ? !evaluatedConditionValue : evaluatedConditionValue;
            } else if (isParsedIfConditionComparison(condition)) {
                // Evaluate LHS.
                if (condition.lhs.type !== 'evaluatedVariable') {
                    throw new InternalEvaluationError(statementRange, `'If' condition must be an evaluated variable, but instead is '${condition.lhs.type}'`);
                }
                const lhs = condition.lhs;
                const evaluatedLhs = evaluateEvaluatedVariable(lhs, context);
                const evaluatedLhsValue = evaluatedLhs.valueScopeVariable.value;
                result.evaluatedVariables.push(...evaluatedLhs.evaluatedVariables);
                result.variableReferences.push(...evaluatedLhs.variableReferences);
                
                // Evaluate RHS.
                if (condition.rhs.type !== 'evaluatedVariable') {
                    throw new InternalEvaluationError(statementRange, `'If' condition must be an evaluated variable, but instead is '${condition.rhs.type}'`);
                }
                const rhs = condition.rhs;
                const evaluatedRhs = evaluateEvaluatedVariable(rhs, context);
                const evaluatedRhsValue = evaluatedRhs.valueScopeVariable.value;
                result.evaluatedVariables.push(...evaluatedRhs.evaluatedVariables);
                result.variableReferences.push(...evaluatedRhs.variableReferences);

                if (typeof evaluatedLhsValue !== typeof evaluatedRhsValue) {
                    const range = new SourceRange(context.thisFbuildUri, { start: lhs.range.start, end: rhs.range.end });
                    throw new EvaluationError(range, `'If' condition comparison must compare variables of the same type, but LHS is ${JSON.stringify(evaluatedLhsValue)} and RHS is ${JSON.stringify(evaluatedRhsValue)}`);
                }

                const operator = condition.operator;
                
                // Only allow '==' and '!=' operators for booleans, since {'>', '>=', '<', '<='} don't make sense.
                // Checking the LHS type also implicitly checks the RHS type since above we checked that the LHS and RHS types are equal.
                if (typeof evaluatedLhsValue === 'boolean'
                    && operator.value !== '=='
                    && operator.value !== '!=')
                {
                    const operatorRange = new SourceRange(context.thisFbuildUri, operator.range);
                    throw new EvaluationError(operatorRange, `'If' comparison of booleans only supports '==' and '!=', but instead is '${operator.value}'`);
                }

                switch (operator.value) {
                    case '==':
                        evaluatedConditionBool = evaluatedLhsValue == evaluatedRhsValue;
                        break;
                    case '!=':
                        evaluatedConditionBool = evaluatedLhsValue != evaluatedRhsValue;
                        break;
                    case '<':
                        evaluatedConditionBool = evaluatedLhsValue < evaluatedRhsValue;
                        break;
                    case '<=':
                        evaluatedConditionBool = evaluatedLhsValue <= evaluatedRhsValue;
                        break;
                    case '>':
                        evaluatedConditionBool = evaluatedLhsValue > evaluatedRhsValue;
                        break;
                    case '>=':
                        evaluatedConditionBool = evaluatedLhsValue >= evaluatedRhsValue;
                        break;
                    default:
                        throw new InternalEvaluationError(statementRange, `Unknown 'If' comparison operator '${operator.value}'`);
                }
            } else if (isParsedIfConditionIn(condition)) {
                // Evaluate LHS.
                if (condition.lhs.type !== 'evaluatedVariable') {
                    throw new InternalEvaluationError(statementRange, `'If' condition must be an evaluated variable, but instead is '${condition.lhs.type}'`);
                }
                const lhs = condition.lhs;
                const evaluatedLhs = evaluateEvaluatedVariable(lhs, context);
                const evaluatedLhsValue = evaluatedLhs.valueScopeVariable.value;
                result.evaluatedVariables.push(...evaluatedLhs.evaluatedVariables);
                result.variableReferences.push(...evaluatedLhs.variableReferences);
                
                // Evaluate RHS.
                if (condition.rhs.type !== 'evaluatedVariable') {
                    throw new InternalEvaluationError(statementRange, `'If' condition must be an evaluated variable, but instead is '${condition.rhs.type}'`);
                }
                const rhs = condition.rhs;
                const rhsRange = new SourceRange(context.thisFbuildUri, rhs.range);
                const evaluatedRhs = evaluateEvaluatedVariable(rhs, context);
                const evaluatedRhsValue = evaluatedRhs.valueScopeVariable.value;
                result.evaluatedVariables.push(...evaluatedRhs.evaluatedVariables);
                result.variableReferences.push(...evaluatedRhs.variableReferences);

                // Check presence.
                if (evaluatedRhsValue instanceof Array) {
                    if (evaluatedRhsValue.length === 0) {
                        evaluatedConditionBool = false;
                    } else if (typeof evaluatedRhsValue[0] === 'string') {
                        const lhsRange = new SourceRange(context.thisFbuildUri, lhs.range);
                        if (typeof evaluatedLhsValue === 'string') {
                            evaluatedConditionBool = evaluatedRhsValue.includes(evaluatedLhsValue);
                        } else if (evaluatedLhsValue instanceof Array) {
                            if (evaluatedLhsValue.length === 0) {
                                evaluatedConditionBool = false;
                            } else if (typeof evaluatedLhsValue[0] === 'string') {
                                evaluatedConditionBool = evaluatedLhsValue.some(searchString => evaluatedRhsValue.includes(searchString));
                            } else {
                                throw new EvaluationError(lhsRange, `'If' 'in' condition left-hand-side variable must be either a string or an array of strings, but instead is ${JSON.stringify(evaluatedLhsValue)}`);
                            }
                        } else {
                            throw new EvaluationError(lhsRange, `'If' 'in' condition left-hand-side variable must be either a string or an array of strings, but instead is ${JSON.stringify(evaluatedLhsValue)}`);
                        }
                    } else {
                        throw new EvaluationError(rhsRange, `'If' 'in' condition right-hand-side variable must be an array of strings, but instead is ${JSON.stringify(evaluatedRhsValue)}`);
                    }
                } else {
                    throw new EvaluationError(rhsRange, `'If' 'in' condition right-hand-side variable must be an array of strings, but instead is ${JSON.stringify(evaluatedRhsValue)}`);
                }

                if (condition.invert) {
                    evaluatedConditionBool = !evaluatedConditionBool;
                }
            } else {
                throw new EvaluationError(statementRange, `Unknown condition type from condition '${JSON.stringify(condition)}'`);
            }

            // Evaluate the function body if the condition was true.
            if (evaluatedConditionBool === true) {
                context.scopeStack.withScope(() => {
                    const evaluatedStatements = evaluateStatements(statement.statements, context);
                    result.evaluatedVariables.push(...evaluatedStatements.evaluatedVariables);
                    result.variableReferences.push(...evaluatedStatements.variableReferences);
                    for (const [varName, varDefinition] of evaluatedStatements.variableDefinitions) {
                        result.variableDefinitions.set(varName, varDefinition);
                    }
                });
            }
        } else if (isParsedStatementInclude(statement)) {  // #include
            const thisFbuildUriDir = vscodeUri.Utils.dirname(vscodeUri.URI.parse(context.thisFbuildUri));
            const includeUri = vscodeUri.Utils.resolvePath(thisFbuildUriDir, statement.path);
            const dummyRange = SourceRange.create(context.thisFbuildUri, 0, 0, 0, 0);
            if (!context.onceIncludeUrisAlreadyIncluded.includes(includeUri.toString())) {
                const includeParseData = context.parseDataProvider.getParseData(includeUri);
            
                const current_dir_relative_to_root = context.scopeStack.getVariableStartingFromCurrentScope('_CURRENT_BFF_DIR_', dummyRange).value;
                const include_dir_relative_to_root = path.relative(context.rootFbuildDirUri, vscodeUri.Utils.dirname(includeUri).toString());
                context.scopeStack.updateExistingVariableInCurrentScope('_CURRENT_BFF_DIR_', include_dir_relative_to_root, dummyRange);

                const evaluatedStatements = evaluateStatements(
                    includeParseData.statements,
                    {
                        scopeStack: context.scopeStack,
                        defines: context.defines,
                        rootFbuildDirUri: context.rootFbuildDirUri,
                        thisFbuildUri: includeUri.toString(),
                        fileSystem: context.fileSystem,
                        parseDataProvider: context.parseDataProvider,
                        onceIncludeUrisAlreadyIncluded: context.onceIncludeUrisAlreadyIncluded,
                    }
                );

                result.evaluatedVariables.push(...evaluatedStatements.evaluatedVariables);
                result.variableReferences.push(...evaluatedStatements.variableReferences);
                for (const [varName, varDefinition] of evaluatedStatements.variableDefinitions) {
                    result.variableDefinitions.set(varName, varDefinition);
                }
                
                context.scopeStack.updateExistingVariableInCurrentScope('_CURRENT_BFF_DIR_', current_dir_relative_to_root, dummyRange);
            }
        } else if (isParsedStatementOnce(statement)) {  // #once
            context.onceIncludeUrisAlreadyIncluded.push(context.thisFbuildUri);
        } else if (isParsedStatementDirectiveIf(statement)) {  // #if
            // Evaluate the condition, which is an array of AND statements OR'd together.
            const orExpressions = statement.condition;
            let orExpressionResult = false;
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
                        const fileUri = convertFileSystemPathToUri(term.filePath, context.thisFbuildUri);
                        evaulatedTerm = context.fileSystem.fileExists(fileUri);
                    } else {
                        const rangeStart = statement.rangeStart;
                        const range = SourceRange.create(context.thisFbuildUri, rangeStart.line, rangeStart.character, rangeStart.line, Number.MAX_VALUE);
                        throw new InternalEvaluationError(range, `Unknown '#if' term type from term '${JSON.stringify(term)}' from statement ${JSON.stringify(statement)}`);
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
                    orExpressionResult = true;
                    break;
                }
            }

            // Evaluate the '#if' body statements if the condition was true.
            // Otherwise, evaluate the '#else' body statements.
            const statements = orExpressionResult ? statement.ifStatements : statement.elseStatements;
            const evaluatedStatements = evaluateStatements(statements, context);
            result.evaluatedVariables.push(...evaluatedStatements.evaluatedVariables);
            result.variableReferences.push(...evaluatedStatements.variableReferences);
            for (const [varName, varDefinition] of evaluatedStatements.variableDefinitions) {
                result.variableDefinitions.set(varName, varDefinition);
            }
        } else if (isParsedStatementDefine(statement)) {  // #define
            const symbol = statement.symbol.value;
            if (context.defines.has(symbol)) {
                const sourceRange = new SourceRange(context.thisFbuildUri, statement.symbol.range);
                throw new EvaluationError(sourceRange, `Cannot #define already defined symbol "${symbol}".`);
            }
            context.defines.add(symbol);
        } else if (isParsedStatementUndefine(statement)) {  // #undef
            const symbol = statement.symbol.value;
            const sourceRange = new SourceRange(context.thisFbuildUri, statement.symbol.range);
            if (symbol === getPlatformSpecificDefineSymbol()) {
                throw new EvaluationError(sourceRange, `Cannot #undef built-in symbol "${symbol}".`);
            }
            if (!context.defines.has(symbol)) {
                throw new EvaluationError(sourceRange, `Cannot #undef undefined symbol "${symbol}".`);
            }
            context.defines.delete(symbol);
        } else if (isParsedStatementImportEnvVar(statement)) {  // #import
            // We cannot know what environment variables will exist when FASTBuild is run,
            // since they might be different than the environment variables that exist now.
            // So use a placeholder value instead of reading the actual environement variable value.
            const symbol = statement.symbol.value;
            const value = `placeholder-${symbol}-value`;
            const dummyVariableDefinition: VariableDefinition = {
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
                }
            };
            context.scopeStack.setVariableInCurrentScope(symbol, value, dummyVariableDefinition);
        } else {
            const dummyRange = SourceRange.create(context.thisFbuildUri, 0, 0, 0, 0);
            throw new InternalEvaluationError(dummyRange, `Unknown statement type '${statement.type}' from statement ${JSON.stringify(statement)}`);
        }
    }

    return result;
}

function evaluateRValue(rValue: any, context: EvaluationContext): EvaluatedRValue {
    if (isParsedString(rValue)) {
        return {
            value: rValue.value,
            range: rValue.range,
            evaluatedVariables: [],
            variableReferences: [],
            variableDefinitions: new Map<string, VariableDefinition>(),
        };
    } else if (isParsedStringExpression(rValue)) {
        const evaluated = evaluateStringExpression(rValue.parts, context);
        return {
            value: evaluated.evaluatedString,
            range: rValue.range,
            evaluatedVariables: evaluated.evaluatedVariables,
            variableReferences: evaluated.variableReferences,
            variableDefinitions: new Map<string, VariableDefinition>(),
        };
    } else if (isParsedStruct(rValue)) {
        return evaluateStruct(rValue, context);
    } else if (isParsedSum(rValue)) {
        return evaluateSum(rValue, context);
    } else if (isParsedEvaluatedVariable(rValue)) {
        const evaluated = evaluateEvaluatedVariable(rValue, context);
        return {
            value: evaluated.valueScopeVariable.value,
            range: rValue.range,
            evaluatedVariables: evaluated.evaluatedVariables,
            variableReferences: evaluated.variableReferences,
            variableDefinitions: new Map<string, VariableDefinition>(),
        };
    } else if (isParsedArray(rValue)) {
        const result: EvaluatedRValue = {
            value: [],
            range: rValue.range,
            evaluatedVariables: [],
            variableReferences: [],
            variableDefinitions: new Map<string, VariableDefinition>(),
        };
        result.value = [];
        for (const item of rValue.value) {
            const evaluated = evaluateRValue(item, context);
            result.value.push(evaluated.value);
            result.evaluatedVariables.push(...evaluated.evaluatedVariables);
            result.variableReferences.push(...evaluated.variableReferences);
            for (const [varName, varDefinition] of evaluated.variableDefinitions) {
                result.variableDefinitions.set(varName, varDefinition);
            }
        }
        return result;
    } else if (isParsedBoolean(rValue) || isParsedInteger(rValue)) {
        return {
            value: rValue.value,
            range: rValue.range,
            evaluatedVariables: [],
            variableReferences: [],
            variableDefinitions: new Map<string, VariableDefinition>(),
        };
    } else {
        const dummyRange = SourceRange.create(context.thisFbuildUri, 0, 0, 0, 0);
        throw new InternalEvaluationError(dummyRange, `Unsupported rValue ${JSON.stringify(rValue)}`);
    }
}

function evaluateEvaluatedVariable(parsedEvaluatedVariable: ParsedEvaluatedVariable, context: EvaluationContext): EvaluatedEvaluatedVariable {
    const evaluatedVariableName = evaluateRValue(parsedEvaluatedVariable.name, context);
    const evaluatedVariableRange = new SourceRange(context.thisFbuildUri, parsedEvaluatedVariable.range);
    if (typeof evaluatedVariableName.value !== 'string') {
        throw new EvaluationError(evaluatedVariableRange, `Variable name must evaluate to a string, but instead is ${JSON.stringify(evaluatedVariableName.value)}`);
    }

    const evaluatedVariables = evaluatedVariableName.evaluatedVariables;
    const variableReferences = evaluatedVariableName.variableReferences;
    
    const valueScopeVariable = (parsedEvaluatedVariable.scope == 'current')
        ? context.scopeStack.getVariableStartingFromCurrentScope(evaluatedVariableName.value, evaluatedVariableRange)
        : context.scopeStack.getVariableInParentScope(evaluatedVariableName.value, evaluatedVariableRange);

    const parsedEvaluatedVariableRange = new SourceRange(context.thisFbuildUri, parsedEvaluatedVariable.range);

    evaluatedVariables.push({
        value: valueScopeVariable.value,
        range: parsedEvaluatedVariableRange,
    });

    variableReferences.push({
        definition: valueScopeVariable.definition,
        usingRange: valueScopeVariable.usingRange,
        range: parsedEvaluatedVariableRange,
    });

    return {
        valueScopeVariable,
        evaluatedVariables,
        variableReferences,
    };
}

// `parts` is an array of either strings or `evaluatedVariable` parse-data.
function evaluateStringExpression(parts: (string | any)[], context: EvaluationContext): EvaluatedStringExpression {
    const result: EvaluatedStringExpression = {
        evaluatedString: '',
        evaluatedVariables: [],
        variableReferences: [],
    };

    for (const part of parts) {
        if (isParsedEvaluatedVariable(part)) {
            const evaluated = evaluateEvaluatedVariable(part, context);
            result.evaluatedString += String(evaluated.valueScopeVariable.value);
            result.evaluatedVariables.push(...evaluated.evaluatedVariables);
            result.variableReferences.push(...evaluated.variableReferences);
        } else {
            // Literal
            result.evaluatedString += part;
        }
    }

    return result;
}

function evaluateStruct(struct: ParsedStruct, context: EvaluationContext): EvaluatedRValue {
    let evaluatedStatements = new EvaluatedData();
    let structScope = new Scope();
    context.scopeStack.withScope(() => {
        evaluatedStatements = evaluateStatements(struct.statements, context);
        structScope = context.scopeStack.getCurrentScope();
    });

    const evaluatedValue = new Struct();
    for (const [name, variable] of structScope.variables) {
        //variable.definition.id
        evaluatedValue.set(name, variable.value);
    }

    return {
        value: evaluatedValue,
        range: struct.range,
        evaluatedVariables: evaluatedStatements.evaluatedVariables,
        variableReferences: evaluatedStatements.variableReferences,
        variableDefinitions: evaluatedStatements.variableDefinitions,
    };
}

function evaluateSum(sum: ParsedSum, context: EvaluationContext): EvaluatedRValue {
    if (sum.summands.length < 2) {
        const dummyRange = SourceRange.create(context.thisFbuildUri, 0, 0, 0, 0);
        throw new InternalEvaluationError(dummyRange, `A sum must have at least 2 summands. Summands: ${sum.summands}`);
    }

    const result = evaluateRValue(sum.summands[0], context);
    // Copy the value so that we don't modify the EvaluatedVariable which references it when we add to it.
    result.value = deepCopyValue(result.value);

    for (const summand of sum.summands.slice(1)) {
        const evaluatedSummand = evaluateRValue(summand, context);
        const additionRange = new SourceRange(context.thisFbuildUri, evaluatedSummand.range);
        result.value = inPlaceAdd(result.value, evaluatedSummand.value, additionRange);
        result.evaluatedVariables.push(...evaluatedSummand.evaluatedVariables);
        result.variableReferences.push(...evaluatedSummand.variableReferences);
        for (const [varName, varDefinition] of evaluatedSummand.variableDefinitions) {
            result.variableDefinitions.set(varName, varDefinition);
        }
    }

    return result;
}

// In-place add summand to existingValue, and return it.
function inPlaceAdd(existingValue: Value, summand: Value, additionRange: SourceRange): Value {
    if (existingValue instanceof Array) {
        if (summand instanceof Array) {
            existingValue.push(...summand);
        } else {
            existingValue.push(summand);
        }
    } else if ((existingValue instanceof Map) && (summand instanceof Map)) {
        for (const [key, value] of summand.entries()) {
            existingValue.set(key, value);
        }
    } else if ((typeof existingValue == 'string') && (typeof summand == 'string')) {
        existingValue += summand;
    } else if ((typeof existingValue == 'number') && (typeof summand == 'number')) {
        existingValue += summand;
    } else {
        throw new EvaluationError(additionRange, `Cannot add a ${typeof summand} (${JSON.stringify(summand)}) to a ${typeof existingValue} (${JSON.stringify(existingValue)}).`);
    }

    return existingValue;
}

function deepCopyValue(value: Value): Value {
    if (value instanceof Array) {
        const copy = [];
        for (let i = 0, len = value.length; i < len; i++) {
            copy[i] = deepCopyValue(value[i]);
        }
        return copy;
    } else if (value instanceof Struct) {
        const copy = new Struct();
        for (const [itemKey, itemValue] of value.entries()) {
            copy.set(itemKey, deepCopyValue(itemValue));
        }
        return copy;
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
