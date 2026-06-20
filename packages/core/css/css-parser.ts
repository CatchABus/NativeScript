import { parse as cssToolsParse } from '@adobe/css-tools';
import { ParseOptions as CSSTreeOptions, parse as cssTreeParse } from 'css-tree';
import { AbstractCSSAdapter } from './adapters/AbstractCSSAdapter';
import { CSSTreeAdapter } from './adapters/CSSTreeAdapter';
import { CSSToolsAdapter } from './adapters/CSSToolsAdapter';
import { DummyCSSAdapter } from './adapters/DummyCSSAdapter';

export function parseCSSStyleSheet(text: string, filename?: string, positions?: boolean): AbstractCSSAdapter {
	let adapter: AbstractCSSAdapter;

	if (__CSS_PARSER__ === 'css-tree') {
		const ast = cssTreeParse(text, {
			context: 'stylesheet',
			list: false,
			filename: filename,
			parseAtrulePrelude: false,
			parseRulePrelude: false,
			parseValue: false,
			positions,
		} as CSSTreeOptions & {
			list: boolean;
		});

		adapter = new CSSTreeAdapter(ast);
	} else if (__CSS_PARSER__ === 'rework') {
		const ast = cssToolsParse(text, {
			source: filename,
		});

		adapter = new CSSToolsAdapter(ast);
	} else {
		adapter = null;
	}

	return adapter;
}
