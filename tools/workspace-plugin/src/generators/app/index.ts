import { chain, externalSchematic, Rule } from '@angular-devkit/schematics';

export default function (schema: any): Rule {
	return chain([
		externalSchematic('@nx/workspace', 'lib', {
			name: schema.name,
		}),
	]);
}
