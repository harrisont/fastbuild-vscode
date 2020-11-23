import * as parser from './parser'

export class EvaluationError extends Error {
	constructor(message?: string) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype);
		this.name = EvaluationError.name;
	}
}

interface SourcePosition {
	line: number;
	character: number;
}

export interface SourceRange {
	start: SourcePosition;
	end: SourcePosition;
}

export namespace SourceRange {
	export function isPositionInRange(position: SourcePosition, range: SourceRange): boolean {
		return position.line >= range.start.line
			&& position.line <= range.end.line
			&& position.character >= range.start.character
			&& position.character < range.end.character;
	}
}

export type Value = boolean | number | string | Value[];

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

export interface ParsedData {
	evaluatedVariables: EvaluatedVariable[];
	variableReferences: VariableReference[];
}

type ScopeLocation = 'current' | 'parent';

interface VariableDefinitionLhs {
	name: string;
	scope: ScopeLocation;
	range: SourceRange;
}

interface GrammarEvaluatedVariable {
	type: 'evaluatedVariable';
	name: string;
	scope: ScopeLocation;
	range: SourceRange;
}

interface ParsedStringExpression {
	evaluatedString: string;
	evaluatedVariables: EvaluatedVariable[];
	variableReferences: VariableReference[];
}

interface ParsedEvaluatedVariable {
	evaluatedVariable: EvaluatedVariable;
	variableReference: VariableReference;
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
		let scope: Scope = {
			variables: new Map<string, ScopeVariable>()
		}

		this.stack.push(scope);
	}

	pop() {
		if (this.stack.length < 2) {
			throw new EvaluationError('Cannot pop scope because there is no parent scope.');
		}
		this.stack.pop();
	}

	// Get a variable, searching from the current scope to its parents.
	// Throw ParseError if the variable is not defined.
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

	// Throw ParseError if the variable is not defined.
	getVariableInCurrentScope(variableName: string): ScopeVariable {
		const currentScope = this.getCurrentScope();
		const maybeVariable = currentScope.variables.get(variableName);
		if (maybeVariable === undefined) {
			throw new EvaluationError(`Referencing varable "${variableName}" that is undefined in the current scope.`);
		} else {
			return maybeVariable;
		}
	}

	// Throw ParseError if the variable is not defined.
	getVariableInParentScope(variableName: string): ScopeVariable {
		const parentScope = this.getParentScope();
		const maybeVariable = parentScope.variables.get(variableName);
		if (maybeVariable === undefined) {
			throw new EvaluationError(`Referencing varable "${variableName}" that is undefined in the parent scope.`);
		} else {
			return maybeVariable;
		}
	}

	setVariableInCurrentScope(name: string, value: Value, lhsRange: SourceRange): ScopeVariable {
		const currentScope = this.getCurrentScope();
		const existingVariable = currentScope.variables.get(name);
		if (existingVariable === undefined) {
			const variable: ScopeVariable = {
				value: value,
				definition: {
					range: lhsRange,
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

	private getCurrentScope(): Scope {
		return this.stack[this.stack.length - 1];
	}

	private getParentScope(): Scope {
		if (this.stack.length < 2) {
			throw new EvaluationError(`Cannot access parent scope because there is no parent scope.`);
		}
		return this.stack[this.stack.length - 2];
	}
}

export function evaluate(input: string): ParsedData {
	const statements = parser.parse(input);

	let result: ParsedData = {
		evaluatedVariables: [],
		variableReferences: [],
	};
	

	let scopeStack = new ScopeStack();

	for (const statement of statements) {
		switch (statement.type) {
			case 'variableDefinition': {
				const rhs = statement.rhs;
				let evaluatedRhs: Value;
				if (rhs.type && rhs.type == 'stringExpression') {
					const parsedStringExpression = parseStringExpression(rhs.parts, scopeStack);
					evaluatedRhs = parsedStringExpression.evaluatedString;
					result.evaluatedVariables.push(...parsedStringExpression.evaluatedVariables);
					result.variableReferences.push(...parsedStringExpression.variableReferences);
				} else if (rhs.type && rhs.type == 'evaluatedVariable') {
					const parsed = parseEvaluatedVariable(rhs, scopeStack);
					evaluatedRhs = parsed.evaluatedVariable.value;
					result.evaluatedVariables.push(parsed.evaluatedVariable);
					result.variableReferences.push(parsed.variableReference);
				} else {
					evaluatedRhs = rhs;
				}

				const lhs: VariableDefinitionLhs = statement.lhs;
				let variable: ScopeVariable | null = null;
				if (lhs.scope == 'current') {
					variable = scopeStack.setVariableInCurrentScope(lhs.name, evaluatedRhs, lhs.range);
				} else {
					variable = scopeStack.updateExistingVariableInParentScope(lhs.name, evaluatedRhs);
				}

				result.variableReferences.push({
					definition: variable.definition,
					range: lhs.range,
				});

				break;
			}
			case 'variableAddition': {
				const rhs = statement.rhs;
				let evaluatedRhs: Value;
				if (rhs.type && rhs.type == 'stringExpression') {
					const parsedStringExpression = parseStringExpression(rhs.parts, scopeStack);
					evaluatedRhs = parsedStringExpression.evaluatedString;
					result.evaluatedVariables.push(...parsedStringExpression.evaluatedVariables);
					result.variableReferences.push(...parsedStringExpression.variableReferences);
				} else if (rhs.type && rhs.type == 'evaluatedVariable') {
					const parsed = parseEvaluatedVariable(rhs, scopeStack);
					evaluatedRhs = parsed.evaluatedVariable.value;
					result.evaluatedVariables.push(parsed.evaluatedVariable);
					result.variableReferences.push(parsed.variableReference);
				} else {
					evaluatedRhs = rhs;
				}

				const lhs: VariableDefinitionLhs = statement.lhs;

				// The previously-defined LHS variable.
				let lhsDefinition: VariableDefinition | null = null;
				
				if (lhs.scope == 'current') {
					const existingVariable = scopeStack.getVariableInCurrentScope(lhs.name);
					lhsDefinition = existingVariable.definition;
					const existingValue = existingVariable.value;
					// Can only add strings and arrays.
					if (existingValue instanceof Array) {
						existingValue.push(evaluatedRhs);
					} else if ((typeof existingValue == 'string') && (typeof evaluatedRhs == 'string')) {
						const sum = existingValue + evaluatedRhs;
						scopeStack.updateVariableInCurrentScope(lhs.name, sum);
					} else {
						throw new EvaluationError(`Cannot add incompatible types: LHS=${typeof existingValue}, RHS=${typeof evaluatedRhs}.`);
					}
				} else {
					const existingVariable = scopeStack.getVariableInParentScope(lhs.name);
					lhsDefinition = existingVariable.definition;
					const existingValue = existingVariable.value;
					// Can only add strings and arrays.
					if (existingValue instanceof Array) {
						existingValue.push(evaluatedRhs);
					} else if ((typeof existingValue == 'string') && (typeof evaluatedRhs == 'string')) {
						const sum = existingValue + evaluatedRhs;
						scopeStack.updateExistingVariableInParentScope(lhs.name, sum);
					} else {
						throw new EvaluationError(`Cannot add incompatible types: LHS=${typeof existingValue}, RHS=${typeof evaluatedRhs}.`);
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
		}
	}
	
	return result;
}

function parseEvaluatedVariable(grammarEvaluatedVariable: GrammarEvaluatedVariable, scopeStack: ScopeStack): ParsedEvaluatedVariable {
	const variableName: string = grammarEvaluatedVariable.name;
	const variable = (grammarEvaluatedVariable.scope == 'current')
						? scopeStack.getVariableStartingFromCurrentScope(variableName)
						: scopeStack.getVariableInParentScope(variableName);

	const range = grammarEvaluatedVariable.range;

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
function parseStringExpression(parts: (string | any)[], scopeStack: ScopeStack): ParsedStringExpression {
	let result: ParsedStringExpression = {
		evaluatedString: '',
		evaluatedVariables: [],
		variableReferences: [],
	};
	
	for (const part of parts) {
		if (part.type && part.type == 'evaluatedVariable') {
			const parsed = parseEvaluatedVariable(part, scopeStack);
			result.evaluatedString += String(parsed.evaluatedVariable.value);
			result.evaluatedVariables.push(parsed.evaluatedVariable);
			result.variableReferences.push(parsed.variableReference);
		} else {
			// Literal
			result.evaluatedString += part;
		}
	}

	return result;
}