import { AbstractCSSAdapter, AstRuleHandler, importPattern, MEDIA_QUERY_SEPARATOR, NSCssDeclaration, NSCSSImport, NSCSSKeyframe } from './AbstractCSSAdapter';
import { isFunction } from '../../utils';
import type { CssAtRuleAST, CssCommentAST, CssCommonAST, CssDeclarationAST, CssKeyframeAST, CssKeyframesAST, CssMediaAST, CssRuleAST, CssStylesheetAST } from '@adobe/css-tools';

export class CSSToolsAdapter extends AbstractCSSAdapter<CssStylesheetAST> {
	override parseCSSRules(handler: AstRuleHandler): void {
		const nodes = this._ast.stylesheet.rules;
		this._parseRulesRecursive(nodes, handler);
	}

	override parseCSSImports(): NSCSSImport[] {
		const nodes = this._ast.stylesheet.rules;
		const imports: NSCSSImport[] = [];

		for (const node of nodes) {
			if (node.type === 'import') {
				const urlMatch = node.import ? node.import.match(importPattern) : null;
				if (urlMatch) {
					imports.push({
						url: urlMatch[2],
						source: node.position?.source ? node.position.source : null,
					});
				}
			}
		}

		return imports;
	}

	private _parseRulesRecursive(nodes: (CssAtRuleAST | CssDeclarationAST)[], handler: AstRuleHandler, mediaQueryString?: string): void {
		for (const node of nodes) {
			if (this.isAtRule(node)) {
				if (this.isKeyframes(node)) {
					if (isFunction(handler.onKeyframesRule)) {
						const name = node.name;
						const keyframes = this.createCSSKeyframes(node.keyframes);

						handler.onKeyframesRule(name, keyframes, mediaQueryString);
					}
				} else if (this.isMedia(node)) {
					this._parseRulesRecursive(node.rules, handler, this.getComputedMediaQuery(node.media, mediaQueryString));
				}
			} else if (this.isRule(node)) {
				if (isFunction(handler.onRule)) {
					const selectors = node.selectors;
					const declarations: NSCssDeclaration[] = this.createCSSDeclarations(node.declarations);

					handler.onRule(selectors, declarations, mediaQueryString);
				}
			}
		}
	}

	override createCSSDeclarations(nodes: (CssAtRuleAST | CssDeclarationAST)[]): NSCssDeclaration[] {
		const declarations: NSCssDeclaration[] = [];

		for (const decl of nodes) {
			if (this.isDeclaration(decl)) {
				const importantIdx = decl.value.indexOf('!important');
				const value = importantIdx > -1 ? decl.value.substring(0, importantIdx).trim() : decl.value;
				const cssDecl: NSCssDeclaration = {
					property: decl.property.startsWith('--') ? decl.property : decl.property.toLowerCase(),
					value,
				};

				if (importantIdx > -1) {
					cssDecl.important = true;
				}

				declarations.push(cssDecl);
			}
		}

		return declarations;
	}

	override createCSSKeyframes(nodes: (CssCommentAST | CssKeyframeAST)[]): NSCSSKeyframe[] {
		const keyframes: NSCSSKeyframe[] = [];

		for (const node of nodes) {
			if (node.type === 'keyframe') {
				keyframes.push({
					values: node.values,
					declarations: this.createCSSDeclarations(node.declarations),
				});
			}
		}

		return keyframes;
	}

	override isRule(node: CssCommonAST): node is CssRuleAST {
		return node.type === 'rule';
	}

	override isAtRule(node: CssCommonAST): node is CssKeyframesAST | CssMediaAST {
		return node.type === 'keyframes' || node.type === 'media';
	}

	override isDeclaration(node: CssCommonAST): node is CssDeclarationAST {
		return node.type === 'declaration';
	}

	override isMedia(node: CssCommonAST): node is CssMediaAST {
		return node.type === 'media';
	}

	override isKeyframes(node: CssCommonAST): node is CssKeyframesAST {
		return node.type === 'keyframes';
	}
}
