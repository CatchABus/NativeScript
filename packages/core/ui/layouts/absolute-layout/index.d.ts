import { LayoutBase } from '../layout-base';
import { Property } from '../../core/properties';
import { View } from '../../core/view';
import { Length, PercentLength } from '../../styling/style-properties';
import { CoreTypes } from '../../../core-types';

/**
 *  A layout that lets you specify exact locations (left/top coordinates) of its children.
 *
 * @nsView AbsoluteLayout
 */
export class AbsoluteLayout extends LayoutBase {
	/**
	 * Gets the value of the Left property from a given View.
	 */
	static getLeft(view: View): CoreTypes.PercentLengthType;

	/**
	 * Sets the value of the Left property from a given View.
	 */
	static setLeft(view: View, value: CoreTypes.PercentLengthType): void;

	/**
	 * Gets the value of the Top property from a given View.
	 */
	static getTop(view: View): CoreTypes.PercentLengthType;

	/**
	 * Sets the value of the Top property from a given View.
	 */
	static setTop(view: View, value: CoreTypes.PercentLengthType): void;
}

/**
 * Represents the observable property backing the left property.
 */
export const leftProperty: Property<View, CoreTypes.PercentLengthType>;

/**
 * Represents the observable property backing the top property.
 */
export const topProperty: Property<View, CoreTypes.PercentLengthType>;
