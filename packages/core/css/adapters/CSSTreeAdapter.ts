import type { AtrulePlain, CssNodePlain, DeclarationPlain, RulePlain, StyleSheetPlain } from 'css-tree';
import { AbstractCSSAdapter, AstRuleHandler, importPattern, MEDIA_QUERY_SEPARATOR, NSCssDeclaration, NSCSSImport, NSCSSKeyframe } from './AbstractCSSAdapter';
import { isFunction } from '../../utils';

export class CSSTreeAdapter extends AbstractCSSAdapter {
	declare protected readonly _ast: StyleSheetPlain;

	override parseCSSRules(handler: AstRuleHandler): void {
		const nodes = this._ast.children;
		this._parseRulesRecursive(nodes, handler);
	}

	override parseCSSImports(): NSCSSImport[] {
		const nodes = this._ast.children;
		const imports: NSCSSImport[] = [];

		for (const node of nodes) {
			if (node.type === 'Atrule' && node.name === 'import') {
				if (node.prelude.type === 'Raw') {
					const urlMatch = node.prelude.value ? node.prelude.value.match(importPattern) : null;
					if (urlMatch) {
						imports.push({
							url: urlMatch[2],
							source: node.loc?.source && node.loc.source !== '<unknown>' ? node.loc.source : null,
						});
					}
				} else {
					console.error('Unsupported css import rule value type: ' + node.prelude.type);
				}
			}
		}

		return imports;
	}

	private _parseRulesRecursive(nodes: CssNodePlain[], handler: AstRuleHandler, mediaQueryString?: string): void {
		for (const node of nodes) {
			if (this.isAtRule(node)) {
				if (node.prelude.type === 'Raw') {
					if (node.name === 'keyframes') {
						if (isFunction(handler.onKeyframesRule)) {
							const name = node.prelude.value;
							const keyframes = this.createCSSKeyframes(node.block.children);

							handler.onKeyframesRule(name, keyframes, mediaQueryString);
						}
					} else if (node.name === 'media') {
						// Media query is composite in the case of nested media queries
						const compositeMediaQuery = mediaQueryString ? mediaQueryString + MEDIA_QUERY_SEPARATOR + node.prelude.value : node.prelude.value;

						this._parseRulesRecursive(node.block.children, handler, compositeMediaQuery);
					}
				} else {
					console.error('Unsupported css at-rule value type: ' + node.prelude.type);
				}
			} else if (this.isRule(node)) {
				if (node.prelude.type === 'Raw') {
					if (isFunction(handler.onRule)) {
						const selectors = node.prelude.value.split(',').map((value) => value.trim());
						const declarations: NSCssDeclaration[] = this.createCSSDeclarations(node.block.children);

						handler.onRule(selectors, declarations, mediaQueryString);
					}
				} else {
					console.error('Unsupported css rule value type: ' + node.prelude.type);
				}
			}
		}
	}

	override createCSSDeclarations(nodes: CssNodePlain[]): NSCssDeclaration[] {
		const declarations: NSCssDeclaration[] = [];

		for (const decl of nodes) {
			if (this.isDeclaration(decl)) {
				if (decl.value.type === 'Raw') {
					const important = typeof decl.important === 'string' ? decl.important.trim().toLowerCase() === 'important' : decl.important;
					const cssDecl: NSCssDeclaration = {
						property: decl.property.startsWith('--') ? decl.property : decl.property.toLowerCase(),
						value: decl.value.value ? decl.value.value.trim() : decl.value.value,
					};

					if (important) {
						cssDecl.important = true;
					}

					declarations.push(cssDecl);
				} else {
					console.error('Unsupported css declaration value type: ' + decl.value.type);
				}
			}
		}

		return declarations;
	}

	override createCSSKeyframes(nodes: CssNodePlain[]): NSCSSKeyframe[] {
		const keyframes: NSCSSKeyframe[] = [];

		for (const node of nodes) {
			if (this.isRule(node)) {
				if (node.prelude.type === 'Raw') {
					keyframes.push({
						values: node.prelude.value.split(',').map((value) => value.trim()),
						declarations: this.createCSSDeclarations(node.block.children),
					});
				} else {
					console.error('Unsupported css keyframe type: ' + node.prelude.type);
				}
			}
		}

		return keyframes;
	}

	override isRule(node: CssNodePlain): node is RulePlain {
		return node.type === 'Rule';
	}

	override isAtRule(node: CssNodePlain): node is AtrulePlain {
		return node.type === 'Atrule';
	}

	override isDeclaration(node: CssNodePlain): node is DeclarationPlain {
		return node.type === 'Declaration';
	}

	override isMedia(node: AtrulePlain): boolean {
		return node.name === 'media';
	}

	override isKeyframes(node: AtrulePlain): boolean {
		return node.name === 'keyframes';
	}
}
