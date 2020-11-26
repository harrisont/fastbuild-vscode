import { SourceMap } from 'module';
import {
	DefinitionLink,
	DefinitionParams,
} from 'vscode-languageserver-protocol';

import {
	DocumentUri,
} from 'vscode-languageserver-types';

import {
	SourceRange,
} from './parser'

import {
	EvaluatedData,
} from './evaluator'

export class DefinitionProvider {
	private evaluatedData: EvaluatedData | null = null;
	private uri: DocumentUri | null = null;

	onEvaluatedDataChanged(uri: DocumentUri, newEvaluatedData: EvaluatedData): void {
		this.evaluatedData = newEvaluatedData;
		this.uri = uri;
	}

	onDefinition(params: DefinitionParams): DefinitionLink[] | null {
		if (!this.uri) {
			return null;
		}

		const position = params.position;
		const variableReferences = this.evaluatedData?.variableReferences ?? [];
	
		for (let i = 0; i < variableReferences.length; i++)
		{
			const variableReference = variableReferences[i];
			const variableReferenceRange = variableReference.range;
			// TODO: also match params.textDocument.uri
			if (SourceRange.isPositionInRange(position, variableReference.range))
			{
				const definition = variableReference.definition;

				const definitionLink: DefinitionLink = {
					originSelectionRange: variableReference.range,
					targetUri: this.uri,
					targetRange: definition.range,
					targetSelectionRange: definition.range,
				}
				return [definitionLink];
			}
		}
	
		return null;
	}
}