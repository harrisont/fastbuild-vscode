import * as nearley from 'nearley'
import fbuildGrammar from './fbuild-grammar'

export interface SourceRange
{
	line: number,
	characterStart: number,
	characterEnd: number
}

export type Value = boolean | number | string;

export interface EvaluatedVariable
{
	range: SourceRange
	value: Value
}

export interface ParsedData {
	evaluatedVariables: EvaluatedVariable[]
}

interface VariableDefinitionLhs {
	name: string,
	scope: 'current' | 'parent'
}

interface Scope {
	variables: Map<string, Value>
}

class ScopeStack {
	private stack: Array<Scope> = []

	constructor() {
		this.push();
	}

	push() {
		let scope: Scope = {
			variables: new Map<string, Value>()
		}

		this.stack.push(scope);
	}

	pop() {
		if (this.stack.length < 2) {
			throw new ParseError('Cannot pop scope because there is no parent scope.');
		}
		this.stack.pop();
	}

	// Get a variable value, searching from the current scope to its parents.
	// Throw ParseError if the variable is not defined.
	getVariableValueStartingFromCurrentScope(variableName: string): Value {
		for (let scopeIndex = this.stack.length - 1; scopeIndex >= 0; --scopeIndex) {
			const scope = this.stack[scopeIndex];
			const maybeValue = scope.variables.get(variableName);
			if (maybeValue !== undefined) {
				return maybeValue;
			}
		}
		throw new ParseError(`Referencing undefined variable "${variableName}"`);
	}

	// Throw ParseError if the variable is not defined.
	getVariableValueInCurrentScope(variableName: string): Value {
		const currentScope = this.getCurrentScope();
		const maybeValue = currentScope.variables.get(variableName);
		if (maybeValue === undefined) {
			throw new ParseError(`Referencing varable "${variableName}" that is undefined in the current scope.`);
		} else {
			return maybeValue;
		}
	}

	// Throw ParseError if the variable is not defined.
	getVariableValueInParentScope(variableName: string): Value {
		const parentScope = this.getParentScope();
		const maybeValue = parentScope.variables.get(variableName);
		if (maybeValue === undefined) {
			throw new ParseError(`Referencing varable "${variableName}" that is undefined in the parent scope.`);
		} else {
			return maybeValue;
		}
	}

	setVariableInCurrentScope(name: string, value: Value): void {
		const currentScope = this.getCurrentScope();
		currentScope.variables.set(name, value);
	}

	updateExistingVariableInParentScope(name: string, value: Value): void {
		const parentScope = this.getParentScope();
		if (parentScope.variables.get(name) === undefined) {
			throw new ParseError(`Cannot update variable "${name}" in parent scope because the variable does not exist in the parent scope.`);
		}
		parentScope.variables.set(name, value);
	}

	private getCurrentScope(): Scope {
		return this.stack[this.stack.length - 1];
	}

	private getParentScope(): Scope {
		if (this.stack.length < 2) {
			throw new ParseError(`Cannot access parent scope because there is no parent scope.`);
		}
		return this.stack[this.stack.length - 2];
	}
}

export class ParseError extends Error {
	constructor(message?: string) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype);
		this.name = ParseError.name;
	}
}

// Parse the input and return the statements.
export function nearleyParse(input: string): any[] {
	// Make the input always end in a newline in order to make parsing easier.
	// This lets the grammar assume that statements always end in a newline.
	const modifiedInput = input + '\n';

	const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
	parser.feed(modifiedInput);

	const numResults = parser.results.length;
	if (numResults != 1) {
		throw new ParseError(`Should parse to exactly 1 result, but parsed to ${numResults}`);
	}
	const statements = parser.results[0];
	return statements;
}

export function parse(input: string): ParsedData {
	const statements = nearleyParse(input);

	let evaluatedVariables: EvaluatedVariable[] = [];

	let scopeStack = new ScopeStack();

	for (const statement of statements) {
		switch (statement.type) {
			case 'variableDefinition': {
				const rhs = statement.rhs;
				let evaluatedRhs: Value = 0;
				if (rhs instanceof Array) {
					evaluatedRhs = ''
					for (const part of rhs) {
						if (part.type && part.type == 'evaluatedVariable') {
							const variableName: string = part.name;
							const variableValue = scopeStack.getVariableValueStartingFromCurrentScope(variableName);
							const variableValueString = String(variableValue);
							evaluatedRhs += variableValueString;

							evaluatedVariables.push({
								value: variableValue,
								range: {
									line: part.line,
									characterStart: part.characterStart,
									characterEnd: part.characterEnd,
								}
							});
						} else {
							// Literal
							evaluatedRhs += part;
						}
					}
				} else {
					evaluatedRhs = rhs;
				}

				const lhs: VariableDefinitionLhs = statement.lhs;
				if (lhs.scope == 'current') {
					scopeStack.setVariableInCurrentScope(lhs.name, evaluatedRhs);
				} else {
					scopeStack.updateExistingVariableInParentScope(lhs.name, evaluatedRhs);
				}
				break;
			}
			case 'variableAddition': {
				const rhs = statement.rhs;
				let evaluatedRhs: string = '';
				if (rhs instanceof Array) {
					for (const part of rhs) {
						if (part.type && part.type == 'evaluatedVariable') {
							const variableName: string = part.name;
							const variableValue = scopeStack.getVariableValueStartingFromCurrentScope(variableName);
							const variableValueString = String(variableValue);
							evaluatedRhs += variableValueString;

							evaluatedVariables.push({
								value: variableValue,
								range: {
									line: part.line,
									characterStart: part.characterStart,
									characterEnd: part.characterEnd,
								}
							});
						} else {
							// Literal
							evaluatedRhs += part;
						}
					}
				} else {
					evaluatedRhs = rhs;
				}

				const lhs: VariableDefinitionLhs = statement.lhs;
				if (lhs.scope == 'current') {
					const existingValue = scopeStack.getVariableValueInCurrentScope(lhs.name);
					const sum = existingValue + evaluatedRhs;
					scopeStack.setVariableInCurrentScope(lhs.name, sum);
				} else {
					const existingValue = scopeStack.getVariableValueInParentScope(lhs.name);
					const sum = existingValue + evaluatedRhs;
					scopeStack.updateExistingVariableInParentScope(lhs.name, sum);
				}
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
	
	return {
		evaluatedVariables: evaluatedVariables
	};
}