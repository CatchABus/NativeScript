import { parseCSSStyleSheet } from './css-parser';
import { CSS3Parser, TokenObjectType } from './CSS3Parser';
import { CSSNativeScript } from './CSSNativeScript';

import * as fs from 'fs';
import * as path from 'path';
import * as shadyCss from 'shady-css-parser';

const parseCss: any = require('parse-css');
const gonzales: any = require('gonzales');
const parserlib: any = require('parserlib');
const csstree: any = require('css-tree');
const testingToolsDir = path.resolve(__dirname, '../../../tools/testing');

describe('css-parser', () => {
	function test<T>(parse: (value: string, lastIndex?: number) => T, value: string, expected: T);
	function test<T>(parse: (value: string, lastIndex?: number) => T, value: string, lastIndex: number, expected: T);
	function test<T>(parse: (value: string, lastIndex?: number) => T, value: string, lastIndexOrExpected: number | T, expected?: T) {
		if (arguments.length === 3) {
			it(`${lastIndexOrExpected ? 'can parse ' : 'can not parse '}"${value}"`, () => {
				const result = parse(value);
				expect(result).toStrictEqual(lastIndexOrExpected);
			});
		} else {
			it(`${expected ? 'can parse ' : 'can not parse '}"${value}" starting at index ${lastIndexOrExpected}`, () => {
				const result = parse(value, <number>lastIndexOrExpected);
				expect(result).toStrictEqual(expected);
			});
		}
	}

	describe('css3', () => {
		let themeCoreLightIos: string;
		let whatIsNewIos: string;

		beforeEach(() => {
			const themeCoreFile = path.resolve(testingToolsDir, 'assets/core.light.css');
			themeCoreLightIos = fs.readFileSync(themeCoreFile).toString();
			const whatIsNewFile = path.resolve(testingToolsDir, 'assets/what-is-new.ios.css');
			whatIsNewIos = fs.readFileSync(whatIsNewFile).toString();
		});

		describe('tokenizer', () => {
			it('the tokenizer roundtrips the core.light.css theme', () => {
				const cssparser = new CSS3Parser(themeCoreLightIos);
				const stylesheet = cssparser.tokenize();

				const original = themeCoreLightIos.replace(/\/\*([^\/]|\/[^\*])*\*\//g, '').replace(/\n/g, ' ');
				const roundtrip = stylesheet
					.map((m) => {
						if (!m) {
							return '';
						}

						if (typeof m === 'string') {
							return m;
						}

						return m.text;
					})
					.join('');

				const lastIndex = Math.min(original.length, roundtrip.length);
				for (let i = 0; i < lastIndex; i++) {
					if (original[i] !== roundtrip[i]) {
						expect(roundtrip.substring(i, 50)).toBe(original.substring(i, 50));
					}
				}

				expect(roundtrip.length).toBe(original.length);
			});

			it('test what-is-new.ios.css from nativescript-marketplace-demo', () => {
				const parser = new CSS3Parser(whatIsNewIos);
				const tokens = parser.tokenize();
				expect(tokens).toStrictEqual([
					{ type: TokenObjectType.atKeyword, text: 'import' },
					' ',
					{ type: TokenObjectType.url, text: "url('~/views/what-is-new-common.css')" },
					';',
					' ',
					{ type: TokenObjectType.delim, text: '.' },
					{ type: TokenObjectType.ident, text: 'news-card' },
					' ',
					'{',
					' ',
					{ type: TokenObjectType.ident, text: 'margin' },
					':',
					' ',
					{ type: TokenObjectType.number, text: '12' },
					' ',
					{ type: TokenObjectType.number, text: '12' },
					' ',
					{ type: TokenObjectType.number, text: '0' },
					' ',
					{ type: TokenObjectType.number, text: '12' },
					';',
					' ',
					'}',
					' ',
					{ type: TokenObjectType.delim, text: '.' },
					{ type: TokenObjectType.ident, text: 'title' },
					' ',
					'{',
					' ',
					{ type: TokenObjectType.ident, text: 'font-size' },
					':',
					' ',
					{ type: TokenObjectType.number, text: '14' },
					';',
					' ',
					'}',
					' ',
					{ type: TokenObjectType.delim, text: '.' },
					{ type: TokenObjectType.ident, text: 'body' },
					' ',
					'{',
					' ',
					{ type: TokenObjectType.ident, text: 'font-size' },
					':',
					' ',
					{ type: TokenObjectType.number, text: '14' },
					';',
					' ',
					'}',
					' ',
					{ type: TokenObjectType.delim, text: '.' },
					{ type: TokenObjectType.ident, text: 'learn-more' },
					' ',
					'{',
					' ',
					{ type: TokenObjectType.ident, text: 'font-size' },
					':',
					' ',
					{ type: TokenObjectType.number, text: '14' },
					';',
					' ',
					'}',
					' ',
					{ type: TokenObjectType.delim, text: '.' },
					{ type: TokenObjectType.ident, text: 'date' },
					' ',
					'{',
					' ',
					{ type: TokenObjectType.ident, text: 'font-size' },
					':',
					' ',
					{ type: TokenObjectType.number, text: '12' },
					';',
					' ',
					'}',
					' ',
					{ type: TokenObjectType.delim, text: '.' },
					{ type: TokenObjectType.ident, text: 'empty-placeholder' },
					' ',
					'{',
					' ',
					{ type: TokenObjectType.ident, text: 'vertical-align' },
					':',
					' ',
					{ type: TokenObjectType.ident, text: 'center' },
					';',
					' ',
					{ type: TokenObjectType.ident, text: 'text-align' },
					':',
					' ',
					{ type: TokenObjectType.ident, text: 'center' },
					';',
					' ',
					'}',
					undefined, // EOF
				]);
			});
		});

		describe('parser', () => {
			it('test what-is-new.ios.css from nativescript-marketplace-demo', () => {
				const parser = new CSS3Parser(whatIsNewIos);
				const stylesheet = parser.parseAStylesheet();
				// console.log(JSON.stringify(stylesheet, null, "\t"));
				// TODO: Assert...
			});

			it('.btn-primary{border-color:rgba(255,0,0,0)}', () => {
				const parser = new CSS3Parser('.btn-primary{border-color:rgba(255,0,0,0)}');
				const stylesheet = parser.parseAStylesheet();

				expect(stylesheet).toStrictEqual({
					rules: [
						{
							type: 'qualified-rule',
							prelude: [
								{ type: 2, text: '.' },
								{ type: 6, text: 'btn-primary' },
							],
							block: { type: 9, text: '{border-color:rgba(255,0,0,0)}', associatedToken: '{', values: [{ type: 6, text: 'border-color' }, ':', { type: 14, name: 'rgba', text: 'rgba(255,0,0,0)', components: [{ type: 3, text: '255' }, ',', { type: 3, text: '0' }, ',', { type: 3, text: '0' }, ',', { type: 3, text: '0' }] }] },
						},
					],
				});

				const cssToNS = new CSSNativeScript();
				const nativescriptAst = cssToNS.parseStylesheet(stylesheet);

				expect(nativescriptAst).toStrictEqual({
					type: 'stylesheet',
					stylesheet: {
						rules: [
							{
								type: 'rule',
								selectors: ['.btn-primary'],
								declarations: [
									{
										type: 'declaration',
										property: 'border-color',
										value: 'rgba(255,0,0,0)',
									},
								],
							},
						],
					},
				});
			});
		});

		it('serialization', () => {
			const cssOutputFile = path.resolve(testingToolsDir, 'out/raw.css.json');
			const adapter = parseCSSStyleSheet(themeCoreLightIos, 'nativescript-theme-core/css/core.light.css');
			fs.writeFileSync(cssOutputFile, JSON.stringify(adapter.ast, null, '  '));

			const nsParser = new CSS3Parser(themeCoreLightIos);
			const nativescriptStylesheet = nsParser.parseAStylesheet();
			const cssToNS = new CSSNativeScript();
			const nativescriptAst = cssToNS.parseStylesheet(nativescriptStylesheet);

			const outNsCssFile = path.resolve(testingToolsDir, 'out/nativescript.css.json');
			fs.writeFileSync(outNsCssFile, JSON.stringify(nativescriptAst, null, '  '));
		});

		it.skip('our parser is fast (this test is flaky, gc, opts.)', () => {
			function trapDuration(action: () => void) {
				const [startSec, startMSec] = process.hrtime();
				action();
				const [endSec, endMSec] = process.hrtime();

				return (endSec - startSec) * 1000 + (endMSec - startMSec) / 1000000;
			}
			const charCodeByCharCodeDuration = trapDuration(() => {
				let count = 0;
				for (let i = 0; i < themeCoreLightIos.length; i++) {
					count += themeCoreLightIos.charCodeAt(i);
				}
				expect(count).toBe(1218711);
			});
			const charByCharDuration = trapDuration(() => {
				let char;
				for (let i = 0; i < themeCoreLightIos.length; i++) {
					char = themeCoreLightIos.charAt(i);
				}
				expect(char).toBe('\n');
			});
			const compareCharIfDuration = trapDuration(() => {
				let char;
				let c = 0;
				for (let i = 0; i < themeCoreLightIos.length; i++) {
					char = themeCoreLightIos[i];
					if ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_') {
						c++;
					}
				}
				expect(c).toBe(8774);
			});
			const compareCharRegEx = /[a-zA-Z_]/;
			const compareCharRegExDuration = trapDuration(() => {
				let char;
				let c = 0;
				for (let i = 0; i < themeCoreLightIos.length; i++) {
					char = themeCoreLightIos[i];
					if (compareCharRegEx.test(char)) {
						c++;
					}
				}
				expect(c).toBe(8774);
			});
			const indexerDuration = trapDuration(() => {
				let char;
				for (let i = 0; i < themeCoreLightIos.length; i++) {
					char = themeCoreLightIos[i];
				}
				expect(char).toBe('\n');
			});
			const shadyDuration = trapDuration(() => {
				const shadyParser = new shadyCss.Parser();
				const ast = shadyParser.parse(themeCoreLightIos);
				// fs.writeFileSync("shady.css.json", JSON.stringify(ast, null, "\t"));
			});
			const parseCssDuration = trapDuration(() => {
				const tokens = parseCss.tokenize(themeCoreLightIos);
				const ast = parseCss.parseAStylesheet(tokens);
				// fs.writeFileSync("parse.css.json", JSON.stringify(ast, null, "\t"));
			});
			const gonzalesDuration = trapDuration(() => {
				const ast = gonzales.srcToCSSP(themeCoreLightIos);
			});
			const parserlibDuration = trapDuration(() => {
				const parser = new parserlib.css.Parser({ starHack: true, underscoreHack: true });
				const ast = parser.parse(themeCoreLightIos);
			});
			const csstreeDuration = trapDuration(() => {
				const ast = csstree.parse(themeCoreLightIos);
			});
			const nativescriptToReworkAstDuration = trapDuration(() => {
				const cssparser = new CSS3Parser(themeCoreLightIos);
				const stylesheet = cssparser.parseAStylesheet();
				const cssNS = new CSSNativeScript();
				const ast = cssNS.parseStylesheet(stylesheet);
			});
			const nativescriptParseDuration = trapDuration(() => {
				const cssparser = new CSS3Parser(themeCoreLightIos);
				const stylesheet = cssparser.parseAStylesheet();
			});
			console.log(`          * Baseline perf: .charCodeAt: ${charCodeByCharCodeDuration}ms. .charAt: ${charByCharDuration}ms. []:${indexerDuration}ms. compareCharIf: ${compareCharIfDuration} compareCharRegEx: ${compareCharRegExDuration}`);
			console.log(`          * Parsers perf: shady: ${shadyDuration}ms. parse-css: ${parseCssDuration}ms. gonzalesDuration: ${gonzalesDuration} parserlib: ${parserlibDuration} csstree: ${csstreeDuration} nativescript-parse: ${nativescriptParseDuration}ms. nativescriptToReworkAst: ${nativescriptToReworkAstDuration}`);
			expect(nativescriptParseDuration <= shadyDuration / 1.5).toBeTruthy();
		});
	});
});
