import { View } from '../core/view';
import { Color } from '../../color';

import { CoreTypes } from '../../core-types';

import { Trace } from '../../trace';

// Types.
import { unsetValue } from '../core/properties/property-shared';
import { Animation } from './index';
import { backgroundColorProperty, scaleXProperty, scaleYProperty, translateXProperty, translateYProperty, rotateProperty, opacityProperty, rotateXProperty, rotateYProperty, widthProperty, heightProperty } from '../styling/style-properties';
import { NSCSSKeyframe } from '../../css/adapters/AbstractCSSAdapter';

export class KeyframeAnimationInfo {
	public keyframes: Array<KeyframeInfo>;
	public name?: string = '';
	public duration?: number = 0.3;
	public delay?: number = 0;
	public iterations?: number = 1;
	public curve?: any = 'ease';
	public isForwards?: boolean = false;
	public isReverse?: boolean = false;
}

export interface Keyframes {
	name: string;
	keyframes: Array<NSCSSKeyframe>;
	tag?: string | number;
	scopedTag?: string;
	mediaQueryString?: string;
}

export interface KeyframePropertyBag {
	[key: string]: any;
}

export interface KeyframeInfo {
	duration: number;
	propertyBag: KeyframePropertyBag;
	curve?: any;
}

interface Keyframe {
	backgroundColor?: Color;
	scale?: { x: number; y: number };
	translate?: { x: number; y: number };
	rotate?: { x: number; y: number; z: number };
	opacity?: number;
	width?: CoreTypes.PercentLengthType;
	height?: CoreTypes.PercentLengthType;
	valueSource?: 'keyframe' | 'animation';
	duration?: number;
	curve?: any;
	forceLayer?: boolean;
}

export class KeyframeAnimation {
	public animationsInfo: Array<Keyframe>;
	public delay = 0;
	public iterations = 1;

	private _resolve;
	private _isPlaying: boolean;
	private _isForwards: boolean;
	private _nativeAnimations: Array<Animation>;
	private _target: View;

	public static keyframeAnimationFromInfo(info: KeyframeAnimationInfo): KeyframeAnimation {
		if (!info?.keyframes?.length) {
			Trace.write(`No keyframes found for animation '${info.name}'.`, Trace.categories.Animation, Trace.messageType.warn);
			return null;
		}

		const length = info.keyframes.length;
		const animationsInfo = new Array<Keyframe>();
		let startDuration = 0;

		if (info.isReverse) {
			for (let index = length - 1; index >= 0; index--) {
				const keyframe = info.keyframes[index];
				startDuration = KeyframeAnimation.parseKeyframe(info, keyframe, animationsInfo, startDuration);
			}
		} else {
			for (let index = 0; index < length; index++) {
				const keyframe = info.keyframes[index];
				startDuration = KeyframeAnimation.parseKeyframe(info, keyframe, animationsInfo, startDuration);
			}
			for (let index = length - 1; index > 0; index--) {
				const a1 = animationsInfo[index];
				const a2 = animationsInfo[index - 1];
				if (a2['curve'] !== undefined) {
					a1['curve'] = a2['curve'];
					a2['curve'] = undefined;
				}
			}
		}

		animationsInfo.map((a) => (a['curve'] ? a : Object.assign(a, { curve: info.curve })));

		const animation: KeyframeAnimation = new KeyframeAnimation();
		animation.delay = info.delay;
		animation.iterations = info.iterations;
		animation.animationsInfo = animationsInfo;
		animation._isForwards = info.isForwards;

		return animation;
	}

	private static parseKeyframe(info: KeyframeAnimationInfo, keyframe: KeyframeInfo, animationsInfo: Array<object>, startDuration: number): number {
		const animationInfo: Keyframe = { ...keyframe.propertyBag };
		let duration: number;

		if (keyframe.duration === 0) {
			duration = 0.01;
		} else {
			duration = info.duration * keyframe.duration - startDuration;
			startDuration += duration;
		}

		animationInfo.duration = info.isReverse ? info.duration - duration : duration;
		animationInfo.curve = keyframe.curve;
		animationInfo.forceLayer = true;
		animationInfo.valueSource = 'keyframe';
		animationsInfo.push(animationInfo);

		return startDuration;
	}

	public get isPlaying(): boolean {
		return this._isPlaying;
	}

	public cancel() {
		if (!this.isPlaying) {
			Trace.write('Keyframe animation is already playing.', Trace.categories.Animation, Trace.messageType.warn);

			return;
		}

		this._isPlaying = false;
		for (let i = this._nativeAnimations.length - 1; i >= 0; i--) {
			const animation = this._nativeAnimations[i];
			if (animation.isPlaying) {
				animation.cancel();
			}
		}
		if (this._nativeAnimations.length > 0) {
			const animation = this._nativeAnimations[0];
			this._resetAnimationValues(this._target, animation);
		}
		this._resetAnimations();
	}

	public play(view: View): Promise<void> {
		if (this._isPlaying) {
			Trace.write('Keyframe animation is already playing.', Trace.categories.Animation, Trace.messageType.warn);

			return new Promise<void>((resolve) => {
				resolve();
			});
		}

		const animationFinishedPromise = new Promise<void>((resolve) => {
			this._resolve = resolve;
		});

		this._isPlaying = true;
		this._nativeAnimations = new Array<Animation>();
		this._target = view;

		if (this.delay !== 0) {
			setTimeout(() => this.animate(view, 0, this.iterations), this.delay);
		} else {
			this.animate(view, 0, this.iterations);
		}

		return animationFinishedPromise;
	}

	private animate(view: View, index: number, iterations: number) {
		if (!this._isPlaying) {
			return;
		}
		if (index === 0) {
			const animationInfo = this.animationsInfo[0];

			if ('backgroundColor' in animationInfo) {
				view.style[backgroundColorProperty.keyframe] = animationInfo.backgroundColor;
			}
			if ('scale' in animationInfo) {
				view.style[scaleXProperty.keyframe] = animationInfo.scale.x;
				view.style[scaleYProperty.keyframe] = animationInfo.scale.y;
			}
			if ('translate' in animationInfo) {
				view.style[translateXProperty.keyframe] = animationInfo.translate.x;
				view.style[translateYProperty.keyframe] = animationInfo.translate.y;
			}
			if ('rotate' in animationInfo) {
				view.style[rotateXProperty.keyframe] = animationInfo.rotate.x;
				view.style[rotateYProperty.keyframe] = animationInfo.rotate.y;
				view.style[rotateProperty.keyframe] = animationInfo.rotate.z;
			}
			if ('opacity' in animationInfo) {
				view.style[opacityProperty.keyframe] = animationInfo.opacity;
			}
			if ('height' in animationInfo) {
				view.style[heightProperty.keyframe] = animationInfo.height;
			}
			if ('width' in animationInfo) {
				view.style[widthProperty.keyframe] = animationInfo.width;
			}

			setTimeout(() => this.animate(view, 1, iterations), 1);
		} else if (index < 0 || index >= this.animationsInfo.length) {
			iterations -= 1;
			if (iterations > 0) {
				this.animate(view, 0, iterations);
			} else {
				if (this._isForwards === false) {
					const animation = this.animationsInfo[this.animationsInfo.length - 1];
					this._resetAnimationValues(view, animation);
				}
				this._resolveAnimationFinishedPromise();
			}
		} else {
			let animation;
			const cachedAnimation = this._nativeAnimations[index - 1];

			if (cachedAnimation) {
				animation = cachedAnimation;
			} else {
				const animationDef = { ...this.animationsInfo[index], target: view };
				animation = new Animation([animationDef]);
				this._nativeAnimations.push(animation);
			}

			const isLastIteration = iterations - 1 <= 0;

			// Catch the animation cancel to prevent unhandled promise rejection warnings
			animation
				.play(isLastIteration)
				.then(
					() => {
						this.animate(view, index + 1, iterations);
					},
					(error: any) => {
						Trace.write(typeof error === 'string' ? error : error.message, Trace.categories.Animation, Trace.messageType.warn);
					},
				)
				.catch((error: any) => {
					Trace.write(typeof error === 'string' ? error : error.message, Trace.categories.Animation, Trace.messageType.warn);
				});
		}
	}

	public _resolveAnimationFinishedPromise() {
		this._nativeAnimations = new Array<Animation>();
		this._isPlaying = false;
		this._target = null;
		this._resolve();
	}

	public _resetAnimations() {
		this._nativeAnimations = new Array<Animation>();
		this._isPlaying = false;
		this._target = null;
	}

	private _resetAnimationValues(view: View, animationInfo: object) {
		if ('backgroundColor' in animationInfo) {
			view.style[backgroundColorProperty.keyframe] = unsetValue;
		}
		if ('scale' in animationInfo) {
			view.style[scaleXProperty.keyframe] = unsetValue;
			view.style[scaleYProperty.keyframe] = unsetValue;
		}
		if ('translate' in animationInfo) {
			view.style[translateXProperty.keyframe] = unsetValue;
			view.style[translateYProperty.keyframe] = unsetValue;
		}
		if ('rotate' in animationInfo) {
			view.style[rotateXProperty.keyframe] = unsetValue;
			view.style[rotateYProperty.keyframe] = unsetValue;
			view.style[rotateProperty.keyframe] = unsetValue;
		}
		if ('opacity' in animationInfo) {
			view.style[opacityProperty.keyframe] = unsetValue;
		}
		if ('height' in animationInfo) {
			view.style[heightProperty.keyframe] = unsetValue;
		}
		if ('width' in animationInfo) {
			view.style[widthProperty.keyframe] = unsetValue;
		}
	}
}
