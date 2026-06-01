export interface NSCssDeclaration {
	property: string;
	value: any;
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

export abstract class AbstractCSSAdapter {
	protected readonly _ast: object;

	constructor(ast: object) {
		this._ast = ast;
	}

	abstract parseCSSRules(handler: AstRuleHandler): void;
	abstract parseCSSImports(): NSCSSImport[];
	abstract createCSSDeclarations(nodes: object[], isKeyframeDeclaration: boolean): NSCssDeclaration[];
	abstract createCSSKeyframes(nodes: object[]): NSCSSKeyframe[];
	abstract isRule(node: object): boolean;
	abstract isAtRule(node: object): boolean;
	abstract isDeclaration(node: object): boolean;
	abstract isMedia(node: object): boolean;
	abstract isKeyframes(node: object): boolean;
}
