import { Color } from '../color';
import { parseURL, parseColor, parsePercentageOrLength, parseBackgroundPosition, parseBackground, parseSelector, AttributeSelectorTest } from './parser';

import * as fs from 'fs';
import * as path from 'path';
import * as shadyCss from 'shady-css-parser';
import postcss from 'postcss';

const parseCss: any = require('parse-css');
const gonzales: any = require('gonzales');
const parserlib: any = require('parserlib');
const csstree: any = require('css-tree');
const testingToolsDir = path.resolve(__dirname, '../../../tools/testing');

function css2AST(css: string, opts?: Pick<postcss.ProcessOptions<postcss.Document | postcss.Root>, 'map' | 'from'>) {
	const ast = postcss.parse(css);
	ast.cleanRaws();

	return ast;
}

describe('css', () => {
	describe('parser', () => {
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

		describe('values', () => {
			describe('url', () => {
				test(parseURL, "url('smiley.gif')  ", { start: 0, end: 19, value: 'smiley.gif' });
				test(parseURL, '  url("frown.gif") ', { start: 0, end: 19, value: 'frown.gif' });
				test(parseURL, '  url(lucky.gif)', { start: 0, end: 16, value: 'lucky.gif' });
				test(parseURL, 'url(lucky.gif) #FF0000', 15, null);
				test(parseURL, 'repeat url(lucky.gif) #FF0000', 6, { start: 6, end: 22, value: 'lucky.gif' });
			});
			describe('color', () => {
				test(parseColor, '  #369 ', { start: 0, end: 7, value: new Color(0xff336699) });
				test(parseColor, '  #456789 ', { start: 0, end: 10, value: new Color(0xff456789) });
				test(parseColor, '  #45678985 ', { start: 0, end: 12, value: new Color(0x85456789) });
				test(parseColor, '  rgb(255, 8, 128) ', { start: 0, end: 18, value: new Color(0xffff0880) });
				test(parseColor, '  rgb(255 8 128 / .5) ', { start: 0, end: 21, value: new Color(0x80ff0880) });
				test(parseColor, '  rgb(255 8 128/0.5)', { start: 0, end: 20, value: new Color(0x80ff0880) });
				test(parseColor, '  rgba(255, 8, 128, 0.5) ', { start: 0, end: 24, value: new Color(0x80ff0880) });
				test(parseColor, '  hsl(330.9, 100%, 51.6%) ', { start: 0, end: 25, value: new Color(0xffff0880) });
				test(parseColor, '  hsla(330.9, 100%, 51.6%, 0.5) ', { start: 0, end: 31, value: new Color(0x80ff0880) });
				test(parseColor, '#FF0000 url(lucky.gif)', 8, null);
				test(parseColor, 'url(lucky.gif) #FF0000 repeat', 15, { start: 15, end: 23, value: new Color(0xffff0000) });
			});
			describe('units', () => {
				test(parsePercentageOrLength, ' 100% ', { start: 0, end: 6, value: { value: 1, unit: '%' } });
				test(parsePercentageOrLength, ' 100px ', { start: 0, end: 7, value: { value: 100, unit: 'px' } });
				test(parsePercentageOrLength, ' 0.5px ', { start: 0, end: 7, value: { value: 0.5, unit: 'px' } });
				test(parsePercentageOrLength, ' 100dip ', { start: 0, end: 8, value: { value: 100, unit: 'dip' } });
				test(parsePercentageOrLength, ' 100 ', { start: 0, end: 5, value: { value: 100, unit: 'dip' } });
				test(parsePercentageOrLength, ' 100 ', { start: 0, end: 5, value: { value: 100, unit: 'dip' } });
				test(parsePercentageOrLength, ' +-12.2 ', null);
			});
			describe('position', () => {
				test(parseBackgroundPosition, 'left', { start: 0, end: 4, value: { x: 'left', y: 'center' } });
				test(parseBackgroundPosition, 'center', { start: 0, end: 6, value: { x: 'center', y: 'center' } });
				test(parseBackgroundPosition, 'right', { start: 0, end: 5, value: { x: 'right', y: 'center' } });
				test(parseBackgroundPosition, 'top', { start: 0, end: 3, value: { x: 'center', y: 'top' } });
				test(parseBackgroundPosition, 'bottom', { start: 0, end: 6, value: { x: 'center', y: 'bottom' } });
				test(parseBackgroundPosition, 'top 75px left 100px', {
					start: 0,
					end: 19,
					value: {
						x: { align: 'left', offset: { value: 100, unit: 'px' } },
						y: { align: 'top', offset: { value: 75, unit: 'px' } },
					},
				});
				test(parseBackgroundPosition, 'left 100px top 75px', {
					start: 0,
					end: 19,
					value: {
						x: { align: 'left', offset: { value: 100, unit: 'px' } },
						y: { align: 'top', offset: { value: 75, unit: 'px' } },
					},
				});
				test(parseBackgroundPosition, 'right center', { start: 0, end: 12, value: { x: 'right', y: 'center' } });
				test(parseBackgroundPosition, 'center left 100%', { start: 0, end: 16, value: { x: { align: 'left', offset: { value: 1, unit: '%' } }, y: 'center' } });
				test(parseBackgroundPosition, 'top 50% left 100%', { start: 0, end: 17, value: { x: { align: 'left', offset: { value: 1, unit: '%' } }, y: { align: 'top', offset: { value: 0.5, unit: '%' } } } });
				test(parseBackgroundPosition, 'bottom left 25%', { start: 0, end: 15, value: { x: { align: 'left', offset: { value: 0.25, unit: '%' } }, y: 'bottom' } });
				test(parseBackgroundPosition, 'top 100% left 25%', { start: 0, end: 17, value: { x: { align: 'left', offset: { value: 0.25, unit: '%' } }, y: { align: 'top', offset: { value: 1, unit: '%' } } } });
			});
			describe('background', () => {
				test(parseBackground, '   #996633  ', { start: 0, end: 12, value: { color: new Color('#996633') } });
				test(parseBackground, '  #00ff00 url("smiley.gif") repeat-y ', { start: 0, end: 37, value: { color: new Color('#00ff00'), image: 'smiley.gif', repeat: 'repeat-y' } });
				test(parseBackground, '   url(smiley.gif)  no-repeat  top 50% left 100% #00ff00', {
					start: 0,
					end: 56,
					value: {
						color: new Color('#00ff00'),
						image: 'smiley.gif',
						repeat: 'no-repeat',
						position: {
							text: 'top 50% left 100% ',
							x: { align: 'left', offset: { value: 1, unit: '%' } },
							y: { align: 'top', offset: { value: 0.5, unit: '%' } },
						},
					},
				});
				test(parseBackground, '   url(smiley.gif)  no-repeat  top 50% left 100% / 100px 100px #00ff00', {
					start: 0,
					end: 70,
					value: {
						color: new Color('#00ff00'),
						image: 'smiley.gif',
						repeat: 'no-repeat',
						position: {
							text: 'top 50% left 100% ',
							x: { align: 'left', offset: { value: 1, unit: '%' } },
							y: { align: 'top', offset: { value: 0.5, unit: '%' } },
						},
						size: { x: { value: 100, unit: 'px' }, y: { value: 100, unit: 'px' } },
					},
				});
				test(parseBackground, '  linear-gradient(to right top) ', {
					start: 0,
					end: 32,
					value: {
						image: {
							angle: (Math.PI * 1) / 4,
							colors: [],
						},
					},
				});
				test(parseBackground, '  linear-gradient(45deg, #0000FF, #00FF00) ', {
					start: 0,
					end: 43,
					value: {
						image: {
							angle: (Math.PI * 1) / 4,
							colors: [{ color: new Color('#0000FF') }, { color: new Color('#00FF00') }],
						},
					},
				});
				test(parseBackground, 'linear-gradient(0deg, blue, green 40%, red)', {
					start: 0,
					end: 43,
					value: {
						image: {
							angle: (Math.PI * 0) / 4,
							colors: [{ color: new Color('#0000ff') }, { color: new Color('#008000'), offset: { value: 0.4, unit: '%' } }, { color: new Color('#ff0000') }],
						},
					},
				});
			});
		});

		describe('selectors', () => {
			test(parseSelector, `  listview#products.mark gridlayout:selected[row="2"] a> b   > c >d>e *[src]   `, {
				start: 0,
				end: 79,
				value: [
					[
						[
							{ type: '', identifier: 'listview' },
							{ type: '#', identifier: 'products' },
							{ type: '.', identifier: 'mark' },
						],
						' ',
					],
					[
						[
							{ type: '', identifier: 'gridlayout' },
							{ type: ':', identifier: 'selected' },
							{ type: '[]', property: 'row', test: '=', value: '2' },
						],
						' ',
					],
					[[{ type: '', identifier: 'a' }], '>'],
					[[{ type: '', identifier: 'b' }], '>'],
					[[{ type: '', identifier: 'c' }], '>'],
					[[{ type: '', identifier: 'd' }], '>'],
					[[{ type: '', identifier: 'e' }], ' '],
					[[{ type: '*' }, { type: '[]', property: 'src' }], undefined],
				],
			});
			test(parseSelector, '*', { start: 0, end: 1, value: [[[{ type: '*' }], undefined]] });
			test(parseSelector, 'button', { start: 0, end: 6, value: [[[{ type: '', identifier: 'button' }], undefined]] });
			test(parseSelector, '.login', { start: 0, end: 6, value: [[[{ type: '.', identifier: 'login' }], undefined]] });
			test(parseSelector, '#login', { start: 0, end: 6, value: [[[{ type: '#', identifier: 'login' }], undefined]] });
			test(parseSelector, ':hover', { start: 0, end: 6, value: [[[{ type: ':', identifier: 'hover' }], undefined]] });
			test(parseSelector, '[src]', { start: 0, end: 5, value: [[[{ type: '[]', property: 'src' }], undefined]] });
			test(parseSelector, `[src = "res://"]`, { start: 0, end: 16, value: [[[{ type: '[]', property: 'src', test: '=', value: `res://` }], undefined]] });
			(<AttributeSelectorTest[]>['=', '^=', '$=', '*=', '=', '~=', '|=']).forEach((attributeTest) => {
				test(parseSelector, `[src ${attributeTest} "val"]`, { start: 0, end: 12 + attributeTest.length, value: [[[{ type: '[]', property: 'src', test: attributeTest, value: 'val' }], undefined]] });
			});
			test(parseSelector, 'listview > .image', {
				start: 0,
				end: 17,
				value: [
					[[{ type: '', identifier: 'listview' }], '>'],
					[[{ type: '.', identifier: 'image' }], undefined],
				],
			});
			test(parseSelector, 'listview  .image', {
				start: 0,
				end: 16,
				value: [
					[[{ type: '', identifier: 'listview' }], ' '],
					[[{ type: '.', identifier: 'image' }], undefined],
				],
			});
			test(parseSelector, 'button:hover', {
				start: 0,
				end: 12,
				value: [
					[
						[
							{ type: '', identifier: 'button' },
							{ type: ':', identifier: 'hover' },
						],
						undefined,
					],
				],
			});
			test(parseSelector, 'listview>:selected image.product', {
				start: 0,
				end: 32,
				value: [
					[[{ type: '', identifier: 'listview' }], '>'],
					[[{ type: ':', identifier: 'selected' }], ' '],
					[
						[
							{ type: '', identifier: 'image' },
							{ type: '.', identifier: 'product' },
						],
						undefined,
					],
				],
			});
			test(parseSelector, 'button[testAttr]', {
				start: 0,
				end: 16,
				value: [
					[
						[
							{ type: '', identifier: 'button' },
							{ type: '[]', property: 'testAttr' },
						],
						undefined,
					],
				],
			});
			test(parseSelector, 'button#login[user][pass]:focused:hovered', {
				start: 0,
				end: 40,
				value: [
					[
						[
							{ type: '', identifier: 'button' },
							{ type: '#', identifier: 'login' },
							{ type: '[]', property: 'user' },
							{ type: '[]', property: 'pass' },
							{ type: ':', identifier: 'focused' },
							{ type: ':', identifier: 'hovered' },
						],
						undefined,
					],
				],
			});
		});

		describe('css3', () => {
			let themeCoreLightIos: string;
			let whatIsNewIos: string;

			beforeEach(() => {
				const themeCoreFile = path.resolve(testingToolsDir, 'assets/core.light.css');
				themeCoreLightIos = fs.readFileSync(themeCoreFile).toString();
				const whatIsNewFile = path.resolve(testingToolsDir, 'assets/what-is-new.ios.css');
				whatIsNewIos = fs.readFileSync(whatIsNewFile).toString();
			});

			describe('parser', () => {
				it('test what-is-new.ios.css from nativescript-marketplace-demo', () => {
					const ast = css2AST(whatIsNewIos);
					// console.log(JSON.stringify(stylesheet, null, "\t"));
					// TODO: Assert...
				});

				it('.btn-primary{border-color:rgba(255,0,0,0)}', () => {
					const ast = css2AST('.btn-primary{border-color:rgba(255,0,0,0)}');
					const json = JSON.stringify(ast, (k, v) => (k === 'source' || k === 'raws' || k === 'inputs' ? undefined : v));

					expect(json).toStrictEqual(
						JSON.stringify({
							type: 'root',
							nodes: [
								{
									type: 'rule',
									nodes: [
										{
											type: 'decl',
											prop: 'border-color',
											value: 'rgba(255,0,0,0)',
										},
									],
									selector: '.btn-primary',
								},
							],
						}),
					);
				});
			});

			it('serialization', () => {
				const outPostCssFile = path.resolve(testingToolsDir, 'out/post.css.json');
				const ast = css2AST(themeCoreLightIos, { from: 'nativescript-theme-core/css/core.light.css' });
				fs.writeFileSync(
					outPostCssFile,
					JSON.stringify(ast, (k, v) => (k === 'source' || k === 'raws' ? undefined : v), '  '),
				);
			});

			it.skip('our default parser is fast (this test is flaky, gc, opts.)', () => {
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
				const postCssDuration = trapDuration(() => {
					const ast = css2AST(themeCoreLightIos, { from: 'nativescript-theme-core/css/core.light.css' });
					// fs.writeFileSync("post.css.json", JSON.stringify(ast, null, "\t"));
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
				console.log(`          * Baseline perf: .charCodeAt: ${charCodeByCharCodeDuration}ms. .charAt: ${charByCharDuration}ms. []:${indexerDuration}ms. compareCharIf: ${compareCharIfDuration} compareCharRegEx: ${compareCharRegExDuration}`);
				console.log(`          * Parsers perf: shady: ${shadyDuration}ms. parse-css: ${parseCssDuration}ms. gonzalesDuration: ${gonzalesDuration} parserlib: ${parserlibDuration} csstree: ${csstreeDuration} postcss-parse: ${postCssDuration}ms`);
				expect(postCssDuration <= csstreeDuration / 1.3).toBeTruthy();
				expect(postCssDuration <= shadyDuration / 1.5).toBeTruthy();
			});
		});
	});
});
