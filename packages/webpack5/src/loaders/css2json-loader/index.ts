import { parse, AtRule, Root, ChildNode } from 'postcss';
import { urlToRequest } from 'loader-utils';
import { dedent } from 'ts-dedent';

const betweenQuotesPattern = /('|")(.*?)\1/;
const unpackUrlPattern = /url\(([^\)]+)\)/;
const inlineLoader = '!css2json-loader?useForImports!';

interface NodeGroup {
	imports: AtRule[];
	otherNodes: ChildNode[];
}

export default function loader(content: string, map: any) {
	const options = this.getOptions() || {};
	const inline = !!options.useForImports;
	const requirePrefix = inline ? inlineLoader : '';

	const ast = parse(content, {
		map: {
			prev: map, // Pass the existing source map
		},
	});

	// todo: revise if this is necessary
	// todo: perhaps we should just build imports into a single file?
	const dependencies = [];
	const { imports, otherNodes } = getImportsAndOtherNodes(ast);

	imports
		.map(extractUrlFromRule)
		.map(createRequireUri)
		.forEach(({ uri, requireURI }) => {
			dependencies.push(`require("${requirePrefix}${requireURI}")`);
		});

	// Filter out import nodes
	ast.nodes = otherNodes;

	const str = JSON.stringify(ast, (k, v) =>
		k === 'source' || k === 'raws' || k === 'inputs' ? undefined : v,
	);

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

function getImportsAndOtherNodes(ast: Root): NodeGroup {
	const nodeGroup: NodeGroup = {
		imports: [],
		otherNodes: [],
	};

	if (!ast || ast.type !== 'root' || !ast.nodes) {
		return nodeGroup;
	}

	for (const node of ast.nodes) {
		if (node instanceof AtRule && node.name === 'import') {
			nodeGroup.imports.push(node);
		} else {
			nodeGroup.otherNodes.push(node);
		}
	}

	return nodeGroup;
}

/**
 * Extracts the url from import rule (ex. `url("./platform.css")`)
 */
function extractUrlFromRule(importRule: AtRule): string {
	const urlValue = importRule.params;

	const unpackedUrlMatch = urlValue.match(unpackUrlPattern);
	const unpackedValue = unpackedUrlMatch ? unpackedUrlMatch[1] : urlValue;

	const quotesMatch = unpackedValue.match(betweenQuotesPattern);
	return quotesMatch ? quotesMatch[2] : unpackedValue;
}

function createRequireUri(uri): { uri: string; requireURI: string } {
	return {
		uri: uri,
		requireURI: urlToRequest(uri),
	};
}
