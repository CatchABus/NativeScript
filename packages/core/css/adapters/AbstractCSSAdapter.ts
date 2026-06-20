export interface NSCssDeclaration {
	property: string;
	value: string;
	important?: boolean;
}

export interface NSCSSKeyframe {
	values: Array<string>;
	declarations: Array<NSCssDeclaration>;
}

export interface NSCSSImport {
	url: string;
	source: string;
}

export interface AstRuleHandler {
	onRule?: (selectors: string[], declarations: NSCssDeclaration[], mediaQueryString: string) => void;
	onKeyframesRule?: (name: string, keyframes: NSCSSKeyframe[], mediaQueryString: string) => void;
}

export const importPattern = /('|")(.*?)\1/;
export const MEDIA_QUERY_SEPARATOR = '&&';

export abstract class AbstractCSSAdapter<T = object> {
	protected readonly _ast: T;

	constructor(ast: T) {
		this._ast = ast;
	}

	get ast(): T {
		return this._ast;
	}

	public getComputedMediaQuery(newQuery: string, fullQuery: string): string {
		// Media query can be composite in the case of nested queries
		return fullQuery ? fullQuery + MEDIA_QUERY_SEPARATOR + newQuery : newQuery;
	}

	abstract parseCSSRules(handler: AstRuleHandler): void;
	abstract parseCSSImports(): NSCSSImport[];
	abstract createCSSDeclarations(nodes: object[]): NSCssDeclaration[];
	abstract createCSSKeyframes(nodes: object[]): NSCSSKeyframe[];
	abstract isRule(node: object): boolean;
	abstract isAtRule(node: object): boolean;
	abstract isDeclaration(node: object): boolean;
	abstract isMedia(node: object): boolean;
	abstract isKeyframes(node: object): boolean;
}
