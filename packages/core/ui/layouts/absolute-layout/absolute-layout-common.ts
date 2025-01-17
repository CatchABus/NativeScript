import { AbsoluteLayout as AbsoluteLayoutDefinition } from '.';
import { LayoutBase } from '../layout-base';
import { CoreTypes } from '../../../core-types';
import { View, CSSType } from '../../core/view';
import { Property } from '../../core/properties';
import { PercentLength } from '../../styling/style-properties';

export * from '../layout-base';

View.prototype.effectiveLeft = 0;
View.prototype.effectiveTop = 0;

function validateArgs(view: View): View {
	if (!view) {
		throw new Error('Absolute-positioned view cannot be null or undefined.');
	}

	return view;
}

@CSSType('AbsoluteLayout')
export class AbsoluteLayoutBase extends LayoutBase implements AbsoluteLayoutDefinition {
	public static getLeft(view: View): CoreTypes.PercentLengthType {
		return validateArgs(view).left;
	}

	public static setLeft(view: View, value: CoreTypes.PercentLengthType): void {
		validateArgs(view).left = value;
	}

	public static getTop(view: View): CoreTypes.PercentLengthType {
		return validateArgs(view).top;
	}

	public static setTop(view: View, value: CoreTypes.PercentLengthType): void {
		validateArgs(view).top = value;
	}
}

AbsoluteLayoutBase.prototype.recycleNativeView = 'auto';

export const leftProperty = new Property<View, CoreTypes.PercentLengthType>({
	name: 'left',
	defaultValue: CoreTypes.zeroLength,
	affectsLayout: global.isIOS,
	equalityComparer: PercentLength.equals,
	valueConverter: (v) => PercentLength.parse(v),
});
leftProperty.register(View);

export const topProperty = new Property<View, CoreTypes.PercentLengthType>({
	name: 'top',
	defaultValue: CoreTypes.zeroLength,
	affectsLayout: global.isIOS,
	equalityComparer: PercentLength.equals,
	valueConverter: (v) => PercentLength.parse(v),
});
topProperty.register(View);
