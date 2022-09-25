import { getRootView } from '../../application';
import { Color } from '../../color';
import { CSSUtils } from '../../css/system-classes';
import { isObject, isString } from '../../utils/types';

const CSS_VARIABLE_PREFIX = `--${CSSUtils.VARIABLE_PREFIX}dialog`;

export namespace DialogStrings {
	export const STRING = 'string';
	export const PROMPT = 'Prompt';
	export const CONFIRM = 'Confirm';
	export const ALERT = 'Alert';
	export const LOGIN = 'Login';
	export const OK = 'OK';
	export const CANCEL = 'Cancel';
}

export const DialogStyles = {
	TITLE_COLOR: `${CSS_VARIABLE_PREFIX}-title-color`,
	MSG_COLOR: `${CSS_VARIABLE_PREFIX}-msg-color`,
	POSITIVE_BUTTON_BG_COLOR: `${CSS_VARIABLE_PREFIX}-positive-btn-bg-color`,
	POSITIVE_BUTTON_TEXT_COLOR: `${CSS_VARIABLE_PREFIX}-positive-btn-text-color`,
	NEGATIVE_BUTTON_BG_COLOR: `${CSS_VARIABLE_PREFIX}-negative-btn-bg-color`,
	NEGATIVE_BUTTON_TEXT_COLOR: `${CSS_VARIABLE_PREFIX}-negative-btn-text-color`,
	INPUT_TEXT_COLOR: `${CSS_VARIABLE_PREFIX}-input-text-color`,
};

/**
 * Provides options for the dialog.
 */
export interface CancelableOptions {
	/**
	 * [Android only] Gets or sets if the dialog can be canceled by taping outside of the dialog.
	 */
	cancelable?: boolean;

	/**
	 * [Android only] Sets the theme of the Dialog. Usable themes can be found: https://developer.android.com/reference/android/R.style
	 */
	theme?: number;
}

/**
 * Provides options for the dialog.
 */
export interface ActionOptions extends CancelableOptions {
	/**
	 * Gets or sets the dialog title.
	 */
	title?: string;

	/**
	 * Gets or sets the dialog message.
	 */
	message?: string;

	/**
	 * Gets or sets the Cancel button text.
	 */
	cancelButtonText?: string;

	/**
	 * Gets or sets the list of available actions.
	 */
	actions?: Array<string>;

	/**
	 * [iOS only] Gets or sets the indexes of destructive actions.
	 */
	destructiveActionsIndexes?: Array<number>;
}

/**
 * Provides options for the dialog.
 */
export interface DialogOptions extends CancelableOptions {
	/**
	 * Gets or sets the dialog title.
	 */
	title?: string;

	/**
	 * Gets or sets the dialog message.
	 */
	message?: string;

	/**
	 * Gets or sets the dialog style.
	 */
	style?: typeof DialogStyles;
}

/**
 * Provides options for the alert.
 */
export interface AlertOptions extends DialogOptions {
	/**
	 * Gets or sets the OK button text.
	 */
	okButtonText?: string;
}

/**
 * Provides options for the confirm dialog.
 */
export interface ConfirmOptions extends AlertOptions {
	/**
	 * Gets or sets the Cancel button text.
	 */
	cancelButtonText?: string;

	/**
	 * Gets or sets the neutral button text.
	 */
	neutralButtonText?: string;
}

/**
 * Provides options for the prompt dialog.
 */
export interface PromptOptions extends ConfirmOptions {
	/**
	 * Gets or sets the default text to display in the input box.
	 */
	defaultText?: string;

	/**
	 * Gets or sets the prompt input type (plain text, password, or email).
	 */
	inputType?: string;

	/**
	 * Gets or sets the prompt capitalizationType (none, all, sentences, or words).
	 */
	capitalizationType?: string;
}

/**
 * Provides result data from the prompt dialog.
 */
export interface PromptResult {
	/**
	 * Gets or sets the prompt dialog boolean result.
	 */
	result: boolean;

	/**
	 *  Gets or sets the text entered in the prompt dialog.
	 */
	text: string;
}

/**
 * Provides result data from the login dialog.
 */
export interface LoginResult {
	/**
	 * Gets or sets the login dialog boolean result.
	 */
	result: boolean;

	/**
	 *  Gets or sets the user entered in the login dialog.
	 */
	userName: string;

	/**
	 *  Gets or sets the password entered in the login dialog.
	 */
	password: string;
}

/**
 * Provides options for the login dialog.
 */
export interface LoginOptions extends ConfirmOptions {
	/**
	 * Gets or sets the default text to display as hint in the user name input box.
	 */
	userNameHint?: string;

	/**
	 * Gets or sets the default text to display as hint in the password input box.
	 */
	passwordHint?: string;

	/**
	 * Gets or sets the default text to display in the user name input box.
	 */
	userName?: string;

	/**
	 * Gets or sets the default text to display in the password input box.
	 */
	password?: string;
}

/**
 * Defines the input type for prompt dialog.
 */
export namespace inputType {
	/**
	 * Plain text input type.
	 */
	export const text = 'text';

	/**
	 * Password input type.
	 */
	export const password = 'password';

	/**
	 * Email input type.
	 */
	export const email = 'email';

	/**
	 * Number input type
	 */
	export const number = 'number';

	/**
	 * Decimal input type
	 */
	export const decimal = 'decimal';

	/**
	 * Phone input type
	 */
	export const phone = 'phone';
}

/**
 * Defines the capitalization type for prompt dialog.
 */
export namespace capitalizationType {
	/**
	 * No automatic capitalization.
	 */
	export const none = 'none';

	/**
	 * Capitalizes every character.
	 */
	export const all = 'all';

	/**
	 * Capitalize the first word of each sentence.
	 */
	export const sentences = 'sentences';

	/**
	 * Capitalize the first letter of every word.
	 */
	export const words = 'words';
}

export function getDialogCssVariablesFromRoot(): Record<string, unknown> {
	const rootView = getRootView();
	const values = {};

	if (!rootView) {
		return values;
	}

	for (const key in DialogStyles) {
		const cssVarName = DialogStyles[key];
		const value = rootView.style.getCssVariable(cssVarName);
		if (cssVarName.endsWith('-color')) {
			if (Color.isValid(value)) {
				values[cssVarName] = new Color(value);
			}
		} else {
			if (value != null) {
				values[cssVarName] = value;
			}
		}
	}
	return values;
}

export function isDialogOptions(arg): boolean {
	return arg && (arg.message || arg.title);
}

export function parseLoginOptions(args: any[]): LoginOptions {
	// Handle options object first
	if (args.length === 1 && isObject(args[0])) {
		return args[0];
	}

	const options: LoginOptions = {
		title: DialogStrings.LOGIN,
		okButtonText: DialogStrings.OK,
		cancelButtonText: DialogStrings.CANCEL,
	};

	if (isString(args[0])) {
		options.message = args[0];
	}

	if (isString(args[1])) {
		options.userNameHint = args[1];
	}

	if (isString(args[2])) {
		options.passwordHint = args[2];
	}

	if (isString(args[3])) {
		options.userName = args[3];
	}

	if (isString(args[4])) {
		options.password = args[4];
	}

	return options;
}
