import { AbstractCSSAdapter, AstRuleHandler, NSCssDeclaration, NSCSSImport, NSCSSKeyframe } from './AbstractCSSAdapter';

export class DummyCSSAdapter extends AbstractCSSAdapter {
	declare protected readonly _ast: object;

	override parseCSSRules(_handler: AstRuleHandler): void {}
	override parseCSSImports(): NSCSSImport[] {
		return null;
	}

	override createCSSDeclarations(_nodes: object[], _isKeyframeDeclaration: boolean): NSCssDeclaration[] {
		return null;
	}

	override createCSSKeyframes(_nodes: object[]): NSCSSKeyframe[] {
		return null;
	}

	override isRule(_node: object): boolean {
		return false;
	}

	override isAtRule(_node: object): boolean {
		return false;
	}

	override isDeclaration(_node: object): boolean {
		return false;
	}

	override isMedia(_node: object): boolean {
		return false;
	}

	override isKeyframes(_node: object): boolean {
		return false;
	}
}
