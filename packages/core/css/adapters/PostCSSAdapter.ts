import { AbstractCSSAdapter, AstRuleHandler, importPattern, MEDIA_QUERY_SEPARATOR, NSCssDeclaration, NSCSSImport, NSCSSKeyframe } from './AbstractCSSAdapter';
import { isFunction } from '../../utils';
import type { Root, ChildNode, Rule, AtRule, Declaration } from 'postcss';

export class PostCSSAdapter extends AbstractCSSAdapter<Root> {
	override parseCSSRules(handler: AstRuleHandler): void {
		const nodes = this._ast.nodes;
		this._parseRulesRecursive(nodes, handler);
	}

	override parseCSSImports(): NSCSSImport[] {
		const nodes = this._ast.nodes;
		const imports: NSCSSImport[] = [];

		for (const node of nodes) {
			if (this.isAtRule(node) && node.name === 'import') {
				const urlMatch = node.params ? node.params.match(importPattern) : null;
				if (urlMatch) {
					imports.push({
						url: urlMatch[2],
						source: null,
					});
				}
			}
		}

		return imports;
	}

	private _parseRulesRecursive(nodes: ChildNode[], handler: AstRuleHandler, mediaQueryString?: string): void {
		for (const node of nodes) {
			if (this.isAtRule(node)) {
				if (this.isKeyframes(node)) {
					if (isFunction(handler.onKeyframesRule)) {
						const name = node.name;
						const keyframes = this.createCSSKeyframes(node.nodes);

						handler.onKeyframesRule(name, keyframes, mediaQueryString);
					}
				} else if (this.isMedia(node)) {
					this._parseRulesRecursive(node.nodes, handler, this.getComputedMediaQuery(node.params, mediaQueryString));
				}
			} else if (this.isRule(node)) {
				if (isFunction(handler.onRule)) {
					const selectors = node.selectors;
					const declarations: NSCssDeclaration[] = this.createCSSDeclarations(node.nodes);

					handler.onRule(selectors, declarations, mediaQueryString);
				}
			}
		}
	}

	override createCSSDeclarations(nodes: ChildNode[]): NSCssDeclaration[] {
		const declarations: NSCssDeclaration[] = [];

		for (const decl of nodes) {
			if (this.isDeclaration(decl)) {
				const cssDecl: NSCssDeclaration = {
					property: decl.prop.startsWith('--') ? decl.prop : decl.prop.toLowerCase(),
					value: decl.value ? decl.value.trim() : decl.value,
				};

				if (decl.important) {
					cssDecl.important = true;
				}

				declarations.push(cssDecl);
			}
		}

		return declarations;
	}

	override createCSSKeyframes(nodes: ChildNode[]): NSCSSKeyframe[] {
		const keyframes: NSCSSKeyframe[] = [];

		for (const node of nodes) {
			if (node.type === 'rule') {
				keyframes.push({
					values: node.selector.split(',').map((value) => value.trim()),
					declarations: this.createCSSDeclarations(node.nodes),
				});
			}
		}

		return keyframes;
	}

	override isRule(node: ChildNode): node is Rule {
		return node.type === 'rule';
	}

	override isAtRule(node: ChildNode): node is AtRule {
		return node.type === 'atrule';
	}

	override isDeclaration(node: ChildNode): node is Declaration {
		return node.type === 'decl';
	}

	override isMedia(node: AtRule): boolean {
		return node.name === 'media';
	}

	override isKeyframes(node: AtRule): boolean {
		return node.name === 'keyframes';
	}
}
