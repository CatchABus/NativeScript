import { Atrule, StyleSheet as CssTreeStyleSheet, parse } from 'css-tree';
import { urlToRequest } from 'loader-utils';
import { dedent } from 'ts-dedent';

const betweenQuotesPattern = /('|")(.*?)\1/;
const unpackUrlPattern = /url\(([^\)]+)\)/;
const inlineLoader = '!css2json-loader?useForImports!';

export default function loader(content: string, map: any) {
	const options = this.getOptions() || {};
	const inline = !!options.useForImports;
	const requirePrefix = inline ? inlineLoader : '';

	const ast = parse(content, {
		context: 'stylesheet',
		parseAtrulePrelude: false,
		parseValue: false,
		positions: false,
	}) as CssTreeStyleSheet;
	const importRules = spliceImportRules(ast);
	// todo: revise if this is necessary
	// todo: perhaps use postCSS and just build imports into a single file?
	const dependencies: string[] = [];

	for (const rule of importRules) {
		dependencies.push(createRequireCall(rule, requirePrefix));
	}

	// Note: JSON encoding will also convert css-tree Linked lists to regular arrays since they implement toJSON method
	const str = JSON.stringify(ast);

	// map.mappings = map.mappings.replace(/;{2,}/, '')

	const code = dedent`
	/* CSS2JSON */
	${dependencies.join('\n')}
	const ___CSS2JSON_LOADER_EXPORT___ = ${str}
	export default ___CSS2JSON_LOADER_EXPORT___
	`;
	this.callback(
		null,
		code, //`${dependencies.join('\n')}module.exports = ${str};`,
		map,
	);
}

function spliceImportRules(ast: CssTreeStyleSheet): Atrule[] {
	const rules: Atrule[] = [];

	if (!ast || ast.type !== 'StyleSheet' || !ast.children) {
		return rules;
	}

	ast.children.forEach((node, item, list) => {
		if (node.type === 'Atrule' && node.name === 'import') {
			rules.push(node);
			list.remove(item);
		}
	});

	return rules;
}

/**
 * Extracts the url from import rule (ex. `url("./platform.css")`)
 */
function extractUrlFromRule(rule: Atrule): string {
	if (rule.prelude.type !== 'Raw') {
		throw new Error('Failed to extract url from css import rule');
	}

	const urlValue = rule.prelude.value;
	const unpackedUrlMatch = urlValue.match(unpackUrlPattern);
	const unpackedValue = unpackedUrlMatch ? unpackedUrlMatch[1] : urlValue;

	const quotesMatch = unpackedValue.match(betweenQuotesPattern);
	return quotesMatch ? quotesMatch[2] : unpackedValue;
}

function createRequireCall(rule: Atrule, prefix: string): string {
	const url = extractUrlFromRule(rule);
	return `require("${prefix}${urlToRequest(url)}")`;
}
