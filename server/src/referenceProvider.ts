import { SourceMap } from 'module';
import {
	Position,
	ReferenceParams,
} from 'vscode-languageserver-protocol';

import {
	DocumentUri,
	Location,
} from 'vscode-languageserver-types';

import {
	SourceRange,
} from './parser'

import {
	ParsedData,
	VariableReference,
} from './evaluator'

export class ReferenceProvider {
	private parsedData: ParsedData | null = null;
	private uri: DocumentUri | null = null;

	onParsedDataChanged(uri: DocumentUri, newParsedData: ParsedData): void {
		this.parsedData = newParsedData;
		this.uri = uri;
	}

	onReferences(params: ReferenceParams): Location[] | null {
		if (!this.uri) {
			return null;
		}

		// TODO: also match params.textDocument.uri
		const variableReference = this.getVariableReferenceAtPosition(params.position);
		if (variableReference === null) {
			return null;
		}

		// Search algorithm: for each variable references, check if the variable definition is the same as this one.
		// This is not very optimized.

		const variableDefinition = variableReference.definition;
		let locations: Location[] = [];

		const variableReferences = this.parsedData?.variableReferences ?? [];
		for (let i = 0; i < variableReferences.length; i++)
		{
			const variableReference = variableReferences[i];
			if (variableReference.definition === variableDefinition) {
				locations.push({
					uri: this.uri,
					range: variableReference.range
				});
			}
		}

		return locations;
	}

	private getVariableReferenceAtPosition(position: Position): VariableReference | null {
		const variableReferences = this.parsedData?.variableReferences ?? [];
	
		for (let i = 0; i < variableReferences.length; i++)
		{
			const variableReference = variableReferences[i];
			if (SourceRange.isPositionInRange(position, variableReference.range))
			{
				return variableReference;
			}
		}

		return null;
	}
}