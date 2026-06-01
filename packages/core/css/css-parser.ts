import { parse, ParseOptions } from 'css-tree';

export function parseCSSStyleSheet(text: string, filename?: string, positions?: boolean): object {
	return parse(text, {
		context: 'stylesheet',
		list: false,
		filename: filename,
		parseAtrulePrelude: false,
		parseRulePrelude: false,
		parseValue: false,
		positions,
	} as ParseOptions & {
		list: boolean;
	});
}
