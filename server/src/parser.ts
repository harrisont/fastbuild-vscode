import { assert } from 'console';
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
	// Return null if the variable is not defined.
	getVariableValue(variableName: string): Value | null {
		for (let scopeIndex = this.stack.length - 1; scopeIndex >= 0; --scopeIndex) {
			const scope = this.stack[scopeIndex];
			const maybeValue = scope.variables.get(variableName);
			if (maybeValue !== undefined) {
				return maybeValue;
			}
		}
		return null;
	}

	setVariableInCurrentScope(name: string, value: Value): void {
		const currentScope = this.getCurrentScope();
		currentScope.variables.set(name, value);
	}

	updateExistingVariableInParentScope(name: string, value: Value): void {
		if (this.stack.length < 2) {
			throw new ParseError(`Cannot update variable "${name}" in parent scope because there is no parent scope.`);
		}
		const parentScope = this.stack[this.stack.length - 2];
		if (parentScope.variables.get(name) === undefined) {
			throw new ParseError(`Cannot update variable "${name}" in parent scope because the variable does not exist in the parent scope.`);
		}
		parentScope.variables.set(name, value);
	}

	private getCurrentScope(): Scope {
		return this.stack[this.stack.length - 1];
	}
}

export class ParseError extends Error {
	constructor(message?: string) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype);
		this.name = ParseError.name;
	}
}

export function parse(text: string): ParsedData {
	const parser = new nearley.Parser(nearley.Grammar.fromCompiled(fbuildGrammar));
	parser.feed(text);

	const numResults = parser.results.length;
	assert(numResults == 1, `Should parse to exactly 1 result, but parsed to ${numResults}`);
	const statements = parser.results[0];

	let evaluatedVariables: EvaluatedVariable[] = [];

	let scopeStack = new ScopeStack();

	for (const statement of statements) {
		switch (statement.type) {
			case 'variableDefinition':
				const rhs = statement.rhs;

				let evaluatedRhs: number | boolean | string = 0;
				if (rhs instanceof Array) {
					evaluatedRhs = ""
					for (const part of rhs) {
						if (part.type && part.type == 'evaluatedVariable') {
							const variableName: string = part.name;
							const variableValue = scopeStack.getVariableValue(variableName);
							if (variableValue === null) {
								throw new ParseError(`Referencing undefined variable "${variableName}"`);
							} else {
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
							}
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