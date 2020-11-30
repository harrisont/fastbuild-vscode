import {
    parse,
    SourceRange,
    Statement,
} from './parser';

export class EvaluationError extends Error {
    constructor(message?: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = EvaluationError.name;
    }
}

export type Value = boolean | number | string | Value[] | Struct;

export class Struct extends Map<string, Value> {
}

export interface EvaluatedVariable {
    value: Value;
    range: SourceRange;
}

export interface VariableDefinition {
    range: SourceRange;
}

export interface VariableReference {
    definition: VariableDefinition;
    range: SourceRange;
}

export interface EvaluatedData {
    evaluatedVariables: EvaluatedVariable[];
    variableReferences: VariableReference[];
}

type ScopeLocation = 'current' | 'parent';

interface VariableDefinitionLhs {
    name: string;
    scope: ScopeLocation;
    range: SourceRange;
}

interface ParsedEvaluatedVariable {
    type: 'evaluatedVariable';
    name: string;
    scope: ScopeLocation;
    range: SourceRange;
}

interface EvaluatedRValue {
    value: Value;
    evaluatedVariables: EvaluatedVariable[];
    variableReferences: VariableReference[];
}

interface EvaluatedStringExpression {
    evaluatedString: string;
    evaluatedVariables: EvaluatedVariable[];
    variableReferences: VariableReference[];
}

interface EvaluatedEvaluatedVariable {
    evaluatedVariable: EvaluatedVariable;
    variableReference: VariableReference;
}

interface EvaluatedStruct {
    evaluatedValue: Struct;
    evaluatedVariables: EvaluatedVariable[];
    variableReferences: VariableReference[];
}

interface ScopeVariable {
    value: Value;
    definition: VariableDefinition;
}

interface Scope {
    variables: Map<string, ScopeVariable>;
}

class ScopeStack {
    private stack: Array<Scope> = []

    constructor() {
        this.push();
    }

    push() {
        const scope: Scope = {
            variables: new Map<string, ScopeVariable>()
        };

        this.stack.push(scope);
    }

    pop() {
        if (this.stack.length < 2) {
            throw new EvaluationError('Cannot pop scope because there is no parent scope.');
        }
        this.stack.pop();
    }

    // Get a variable, searching from the current scope to its parents.
    // Throw EvaluationError if the variable is not defined.
    getVariableStartingFromCurrentScope(variableName: string): ScopeVariable {
        for (let scopeIndex = this.stack.length - 1; scopeIndex >= 0; --scopeIndex) {
            const scope = this.stack[scopeIndex];
            const maybeVariable = scope.variables.get(variableName);
            if (maybeVariable !== undefined) {
                return maybeVariable;
            }
        }
        throw new EvaluationError(`Referencing variable "${variableName}" that is undefined in the current scope or any of the parent scopes.`);
    }

    // Throw EvaluationError if the variable is not defined.
    getVariableInCurrentScope(variableName: string): ScopeVariable {
        const currentScope = this.getCurrentScope();
        const maybeVariable = currentScope.variables.get(variableName);
        if (maybeVariable === undefined) {
            throw new EvaluationError(`Referencing varable "${variableName}" that is undefined in the current scope.`);
        } else {
            return maybeVariable;
        }
    }

    // Throw EvaluationError if the variable is not defined.
    getVariableInParentScope(variableName: string): ScopeVariable {
        const parentScope = this.getParentScope();
        const maybeVariable = parentScope.variables.get(variableName);
        if (maybeVariable === undefined) {
            throw new EvaluationError(`Referencing varable "${variableName}" that is undefined in the parent scope.`);
        } else {
            return maybeVariable;
        }
    }

    setVariableInCurrentScope(name: string, value: Value, definitionRange: SourceRange): ScopeVariable {
        const currentScope = this.getCurrentScope();
        const existingVariable = currentScope.variables.get(name);
        if (existingVariable === undefined) {
            const variable: ScopeVariable = {
                value: value,
                definition: {
                    range: definitionRange,
                },
            };
            currentScope.variables.set(name, variable);
            return variable;
        } else {
            existingVariable.value = value;
            return existingVariable;
        }
    }

    updateVariableInCurrentScope(name: string, value: Value): ScopeVariable {
        const currentScope = this.getCurrentScope();
        const existingVariable = currentScope.variables.get(name);
        if (existingVariable === undefined) {
            throw new EvaluationError(`Cannot update variable "${name}" in current scope because the variable does not exist in the current scope.`);
        }
        existingVariable.value = value;
        return existingVariable;
    }

    updateExistingVariableInParentScope(name: string, value: Value): ScopeVariable {
        const parentScope = this.getParentScope();
        const existingVariable = parentScope.variables.get(name);
        if (existingVariable === undefined) {
            throw new EvaluationError(`Cannot update variable "${name}" in parent scope because the variable does not exist in the parent scope.`);
        }
        existingVariable.value = value;
        return existingVariable;
    }

    getCurrentScope(): Scope {
        return this.stack[this.stack.length - 1];
    }

    private getParentScope(): Scope {
        if (this.stack.length < 2) {
            throw new EvaluationError(`Cannot access parent scope because there is no parent scope.`);
        }
        return this.stack[this.stack.length - 2];
    }
}

export function evaluate(input: string): EvaluatedData {
    const statements = parse(input);
    const scopeStack = new ScopeStack();
    return evaluateStatements(statements, scopeStack);
}

function evaluateStatements(statements: Statement[], scopeStack: ScopeStack): EvaluatedData {
    const result: EvaluatedData = {
        evaluatedVariables: [],
        variableReferences: [],
    };

    for (const statement of statements) {
        switch (statement.type) {
            case 'variableDefinition': {
                const evaluatedRhs = evaluateRValue(statement.rhs, scopeStack);
                result.evaluatedVariables.push(...evaluatedRhs.evaluatedVariables);
                result.variableReferences.push(...evaluatedRhs.variableReferences);

                const lhs: VariableDefinitionLhs = statement.lhs;
                let variable: ScopeVariable | null = null;
                if (lhs.scope == 'current') {
                    variable = scopeStack.setVariableInCurrentScope(lhs.name, evaluatedRhs.value, lhs.range);
                } else {
                    variable = scopeStack.updateExistingVariableInParentScope(lhs.name, evaluatedRhs.value);
                }

                // The definition's LHS is a variable reference.
                result.variableReferences.push({
                    definition: variable.definition,
                    range: lhs.range,
                });

                break;
            }
            case 'variableAddition': {
                const evaluatedRhs = evaluateRValue(statement.rhs, scopeStack);
                result.evaluatedVariables.push(...evaluatedRhs.evaluatedVariables);
                result.variableReferences.push(...evaluatedRhs.variableReferences);

                const lhs: VariableDefinitionLhs = statement.lhs;

                // The previously-defined LHS variable.
                let lhsDefinition: VariableDefinition | null = null;

                if (lhs.scope == 'current') {
                    const existingVariable = scopeStack.getVariableInCurrentScope(lhs.name);
                    lhsDefinition = existingVariable.definition;
                    const existingValue = existingVariable.value;
                    // Can only add strings and arrays.
                    if (existingValue instanceof Array) {
                        existingValue.push(evaluatedRhs.value);
                    } else if ((typeof existingValue == 'string') && (typeof evaluatedRhs.value == 'string')) {
                        const sum = existingValue + evaluatedRhs.value;
                        scopeStack.updateVariableInCurrentScope(lhs.name, sum);
                    } else if ((typeof existingValue == 'number') && (typeof evaluatedRhs.value == 'number')) {
                        const sum = existingValue + evaluatedRhs.value;
                        scopeStack.updateVariableInCurrentScope(lhs.name, sum);
                    } else {
                        throw new EvaluationError(`Cannot add a ${typeof evaluatedRhs.value} (${JSON.stringify(statement.rhs)}) to a ${typeof existingValue} (${JSON.stringify(existingValue)}).`);
                    }
                } else {
                    const existingVariable = scopeStack.getVariableInParentScope(lhs.name);
                    lhsDefinition = existingVariable.definition;
                    const existingValue = existingVariable.value;
                    // Can only add strings and arrays.
                    if (existingValue instanceof Array) {
                        existingValue.push(evaluatedRhs.value);
                    } else if ((typeof existingValue == 'string') && (typeof evaluatedRhs.value == 'string')) {
                        const sum = existingValue + evaluatedRhs.value;
                        scopeStack.updateExistingVariableInParentScope(lhs.name, sum);
                    } else if ((typeof existingValue == 'number') && (typeof evaluatedRhs.value == 'number')) {
                        const sum = existingValue + evaluatedRhs.value;
                        scopeStack.updateVariableInCurrentScope(lhs.name, sum);
                    } else {
                        throw new EvaluationError(`Cannot add a ${typeof evaluatedRhs.value} (${JSON.stringify(statement.rhs)}) to a ${typeof existingValue} (${JSON.stringify(existingValue)}).`);
                    }
                }

                // The addition's LHS is a variable reference.
                result.variableReferences.push({
                    definition: lhsDefinition,
                    range: lhs.range
                });

                break;
            }
            case 'scopeStart':
                scopeStack.push();
                break;
            case 'scopeEnd':
                scopeStack.pop();
                break;
            case 'using': {
                if (!statement.struct.type || statement.struct.type !== 'evaluatedVariable') {
                    throw new EvaluationError(`'Using' parameter must be an evaluated variable`);
                }
                const evaluated = evaluateEvaluatedVariable(statement.struct, scopeStack);
                result.evaluatedVariables.push(evaluated.evaluatedVariable);
                result.variableReferences.push(evaluated.variableReference);

                const struct = evaluated.evaluatedVariable.value;
                if (!(struct instanceof Struct)) {
                    throw new EvaluationError(`'Using' parameter must be a struct`);
                }
                for (const [varName, varValue] of struct) {
                    scopeStack.setVariableInCurrentScope(varName, varValue, statement.range);
                }

                break;
            }
        }
    }

    return result;
}

function evaluateRValue(rValue: any, scopeStack: ScopeStack): EvaluatedRValue {
    const result: EvaluatedRValue = {
        value: '',
        evaluatedVariables: [],
        variableReferences: [],
    };

    if (rValue.type && rValue.type == 'stringExpression') {
        const evaluated = evaluateStringExpression(rValue.parts, scopeStack);
        result.value = evaluated.evaluatedString;
        result.evaluatedVariables.push(...evaluated.evaluatedVariables);
        result.variableReferences.push(...evaluated.variableReferences);
    } else if (rValue.type && rValue.type == 'struct') {
        const evaluated = evaluateStruct(rValue.statements, scopeStack);
        result.value = evaluated.evaluatedValue;
        result.evaluatedVariables.push(...evaluated.evaluatedVariables);
        result.variableReferences.push(...evaluated.variableReferences);
    } else if (rValue.type && rValue.type == 'evaluatedVariable') {
        const evaluated = evaluateEvaluatedVariable(rValue, scopeStack);
        result.value = evaluated.evaluatedVariable.value;
        result.evaluatedVariables.push(evaluated.evaluatedVariable);
        result.variableReferences.push(evaluated.variableReference);
    } else if (rValue instanceof Array) {
        result.value = [];
        for (const rvalue of rValue) {
            const evaluated = evaluateRValue(rvalue, scopeStack);
            result.value.push(evaluated.value);
            result.evaluatedVariables.push(...evaluated.evaluatedVariables);
            result.variableReferences.push(...evaluated.variableReferences);
        }
    } else {
        // Primitive (boolean | number | string)
        result.value = rValue;
    }

    return result;
}

function evaluateEvaluatedVariable(parsedEvaluatedVariable: ParsedEvaluatedVariable, scopeStack: ScopeStack): EvaluatedEvaluatedVariable {
    const variableName: string = parsedEvaluatedVariable.name;
    const variable = (parsedEvaluatedVariable.scope == 'current')
        ? scopeStack.getVariableStartingFromCurrentScope(variableName)
        : scopeStack.getVariableInParentScope(variableName);

    const range = parsedEvaluatedVariable.range;

    return {
        evaluatedVariable: {
            value: variable.value,
            range: range
        },
        variableReference: {
            definition: variable.definition,
            range: range
        },
    };
}

// `parts` is an array of either strings or `evaluatedVariable` parse-data.
function evaluateStringExpression(parts: (string | any)[], scopeStack: ScopeStack): EvaluatedStringExpression {
    const result: EvaluatedStringExpression = {
        evaluatedString: '',
        evaluatedVariables: [],
        variableReferences: [],
    };

    for (const part of parts) {
        if (part.type && part.type == 'evaluatedVariable') {
            const evaluated = evaluateEvaluatedVariable(part, scopeStack);
            result.evaluatedString += String(evaluated.evaluatedVariable.value);
            result.evaluatedVariables.push(evaluated.evaluatedVariable);
            result.variableReferences.push(evaluated.variableReference);
        } else {
            // Literal
            result.evaluatedString += part;
        }
    }

    return result;
}

function evaluateStruct(statements: Statement[], scopeStack: ScopeStack): EvaluatedStruct {
    const result: EvaluatedStruct = {
        evaluatedValue: new Struct(),
        evaluatedVariables: [],
        variableReferences: [],
    };

    scopeStack.push();
    const evaluatedStatements = evaluateStatements(statements, scopeStack);
    const structScope: Scope = scopeStack.getCurrentScope();
    scopeStack.pop();

    const evaluatedValue = new Struct();
    for (const [name, variable] of structScope.variables) {
        evaluatedValue.set(name, variable.value);
    }

    result.evaluatedValue = evaluatedValue;
    result.evaluatedVariables.push(...evaluatedStatements.evaluatedVariables);
    result.variableReferences.push(...evaluatedStatements.variableReferences);

    return result;
}