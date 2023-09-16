// Types
import { AnimationDefinitionInternal, AnimationPromise, IOSView, PropertyAnimation, PropertyAnimationInfo } from './animation-common';
import { CssAnimationProperty, View } from '../core/view';

// Requires
import { AnimationBase, Properties, CubicBezierAnimationCurve } from './animation-common';
import { Trace } from '../../trace';
import { opacityProperty, backgroundColorProperty, rotateProperty, rotateXProperty, rotateYProperty, translateXProperty, translateYProperty, scaleXProperty, scaleYProperty, heightProperty, widthProperty, PercentLength } from '../styling/style-properties';
import { ios as iosBackground } from '../styling/background';
import { ios as iosViewUtils, NativeScriptUIView } from '../utils';

import { ios as iosHelper } from '../../utils/native-helper';

import { Screen } from '../../platform';

export * from './animation-common';
export { KeyframeAnimation, KeyframeAnimationInfo, KeyframeDeclaration, KeyframeInfo } from './keyframe-animation';

const _transform = '_transform';
const _skip = '_skip';

type iOSAnimationFunction = (animation: Animation) => void;

class AnimationInfo {
	public propertyNameToAnimate: string;
	public subPropertiesToAnimate?: string[];
	public fromValue: any;
	public toValue: any;
	public duration: number;
	public repeatCount: number;
	public delay: number;
	public affectsLayout: boolean;
}

@NativeClass
class AnimationDelegateImpl extends NSObject implements CAAnimationDelegate {
	public nextAnimation: iOSAnimationFunction;

	// The CAAnimationDelegate protocol has been introduced in the iOS 10 SDK
	static ObjCProtocols = global.CAAnimationDelegate ? [global.CAAnimationDelegate] : [];

	private _animation: WeakRef<Animation>;
	private _propertyAnimation: PropertyAnimationInfo;

	public static initWithFinishedCallback(animation: WeakRef<Animation>, propertyAnimation: PropertyAnimationInfo): AnimationDelegateImpl {
		const delegate = <AnimationDelegateImpl>AnimationDelegateImpl.new();
		delegate._animation = animation;
		delegate._propertyAnimation = propertyAnimation;

		return delegate;
	}

	animationDidStart(anim: CAAnimation): void {
		const value = this._propertyAnimation.value;
		const animation = this._animation?.get();
		const setKeyFrame = animation?.valueSource === 'keyframe';
		const targetStyle = this._propertyAnimation.target.style;

		(<IOSView>this._propertyAnimation.target)._suspendPresentationLayerUpdates();

		switch (this._propertyAnimation.property) {
			case Properties.backgroundColor:
				applyAnimationProperty(targetStyle, backgroundColorProperty, value, setKeyFrame);
				break;
			case Properties.opacity:
				applyAnimationProperty(targetStyle, opacityProperty, value, setKeyFrame);
				break;
			case Properties.rotate:
				applyAnimationProperty(targetStyle, rotateXProperty, value.x, setKeyFrame);
				applyAnimationProperty(targetStyle, rotateYProperty, value.y, setKeyFrame);
				applyAnimationProperty(targetStyle, rotateProperty, value.z, setKeyFrame);
				break;
			case Properties.translate:
				applyAnimationProperty(targetStyle, translateXProperty, value.x, setKeyFrame);
				applyAnimationProperty(targetStyle, translateYProperty, value.y, setKeyFrame);
				break;
			case Properties.height:
				applyAnimationProperty(targetStyle, heightProperty, value, setKeyFrame);
				break;
			case Properties.width:
				applyAnimationProperty(targetStyle, widthProperty, value, setKeyFrame);
				break;
			case Properties.scale:
				applyAnimationProperty(targetStyle, scaleXProperty, value.x || 1e-6, setKeyFrame);
				applyAnimationProperty(targetStyle, scaleYProperty, value.y || 1e-6, setKeyFrame);
				break;
			case _transform:
				const translateValue = value[Properties.rotate];
				if (translateValue != null) {
					applyAnimationProperty(targetStyle, translateXProperty, translateValue.x, setKeyFrame);
					applyAnimationProperty(targetStyle, translateYProperty, translateValue.y, setKeyFrame);
				}

				const rotateValue = value[Properties.rotate];
				if (rotateValue != null) {
					applyAnimationProperty(targetStyle, rotateXProperty, rotateValue.x, setKeyFrame);
					applyAnimationProperty(targetStyle, rotateYProperty, rotateValue.y, setKeyFrame);
					applyAnimationProperty(targetStyle, rotateProperty, rotateValue.z, setKeyFrame);
				}

				const scaleValue = value[Properties.scale];
				if (scaleValue != null) {
					applyAnimationProperty(targetStyle, scaleXProperty, scaleValue.x || 1e-6, setKeyFrame);
					applyAnimationProperty(targetStyle, scaleYProperty, scaleValue.y || 1e-6, setKeyFrame);
				}
				break;
		}

		(<IOSView>this._propertyAnimation.target)._resumePresentationLayerUpdates();
	}

	public animationDidStopFinished(nativeAnimation: CAAnimation, finished: boolean): void {
		const animation = this._animation?.deref();
		if (animation) {
			animation.animationFinishedCallback(!finished);

			if (finished && this.nextAnimation && !animation.isCancelled) {
				this.nextAnimation(animation);
			}
		}
	}
}

export function _resolveAnimationCurve(curve: string | CubicBezierAnimationCurve | CAMediaTimingFunction): CAMediaTimingFunction | string {
	switch (curve) {
		case 'easeIn':
			return CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionEaseIn);
		case 'easeOut':
			return CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionEaseOut);
		case 'easeInOut':
			return CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionEaseInEaseOut);
		case 'linear':
			return CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionLinear);
		case 'spring':
			return curve;
		case 'ease':
			return CAMediaTimingFunction.functionWithControlPoints(0.25, 0.1, 0.25, 1.0);
		default:
			if (curve instanceof CAMediaTimingFunction) {
				return curve;
			} else if (curve instanceof CubicBezierAnimationCurve) {
				const animationCurve = <CubicBezierAnimationCurve>curve;

				return CAMediaTimingFunction.functionWithControlPoints(animationCurve.x1, animationCurve.y1, animationCurve.x2, animationCurve.y2);
			} else {
				Trace.write(`Invalid animation curve: ${curve}`, Trace.categories.Animation, Trace.messageType.error);
			}
	}
}

export class Animation extends AnimationBase {
	private _iOSAnimationFunction: Function;
	private _finishedAnimations: number;
	private _cancelledAnimations: number;
	private _mergedPropertyAnimations: Array<PropertyAnimationInfo>;
	private _valueSource: 'animation' | 'keyframe';

	constructor(animationDefinitions: Array<AnimationDefinitionInternal>, playSequentially?: boolean) {
		super(animationDefinitions, playSequentially);

		if (animationDefinitions.length > 0 && animationDefinitions[0].valueSource != null) {
			this._valueSource = animationDefinitions[0].valueSource;
		} else {
			this._valueSource = 'animation';
		}

		if (!playSequentially) {
			if (Trace.isEnabled()) {
				Trace.write('Non-merged Property Animations: ' + this._propertyAnimations.length, Trace.categories.Animation);
			}
			this._mergedPropertyAnimations = Animation._mergeAffineTransformAnimations(this._propertyAnimations);
			if (Trace.isEnabled()) {
				Trace.write('Merged Property Animations: ' + this._mergedPropertyAnimations.length, Trace.categories.Animation);
			}
		} else {
			this._mergedPropertyAnimations = this._propertyAnimations;
		}

		this._iOSAnimationFunction = Animation._createiOSAnimationFunction(this._mergedPropertyAnimations, 0, this._playSequentially);
	}

	get valueSource() {
		return this._valueSource;
	}

	animationFinishedCallback(cancelled: boolean) {
		if (this._playSequentially) {
			// This function will be called by the last animation when done or by another animation if the user cancels them halfway through.
			if (!cancelled) {
				this._resolveAnimationFinishedPromise();
			}
		} else {
			// This callback will be called by each INDIVIDUAL animation when it finishes or is cancelled.
			if (cancelled) {
				this._cancelledAnimations++;
			} else {
				this._finishedAnimations++;
			}

			if (this._cancelledAnimations > 0 && this._cancelledAnimations + this._finishedAnimations === this._mergedPropertyAnimations.length) {
				if (Trace.isEnabled()) {
					Trace.write(this._cancelledAnimations + ' animations cancelled.', Trace.categories.Animation);
				}
			} else if (this._finishedAnimations === this._mergedPropertyAnimations.length) {
				if (Trace.isEnabled()) {
					Trace.write(this._finishedAnimations + ' animations finished.', Trace.categories.Animation);
				}
				this._resolveAnimationFinishedPromise();
			}
		}
	}

	public play(): AnimationPromise {
		if (this.isPlaying) {
			return this._rejectAlreadyPlaying();
		}

		const animationFinishedPromise = super.play();
		this._finishedAnimations = 0;
		this._cancelledAnimations = 0;
		this._iOSAnimationFunction(this);

		return animationFinishedPromise;
	}

	public cancel(): void {
		if (!this.isPlaying) {
			Trace.write('Animation is not currently playing.', Trace.categories.Animation, Trace.messageType.warn);
			return;
		}

		this._markAsCancelled();

		if (this._mergedPropertyAnimations) {
			for (let i = 0; i < this._mergedPropertyAnimations.length; i++) {
				const propertyAnimation = this._mergedPropertyAnimations[i];
				if (propertyAnimation) {
					if (propertyAnimation.target?.nativeViewProtected) {
						const nativeView: NativeScriptUIView = propertyAnimation.target.nativeViewProtected;
						nativeView.layer.removeAllAnimations();

						// Shadow animations
						if (nativeView.outerShadowContainerLayer) {
							nativeView.outerShadowContainerLayer.removeAllAnimations();
						}
					}
					if (propertyAnimation._propertyResetCallback) {
						propertyAnimation._propertyResetCallback(propertyAnimation._originalValue, this._valueSource);
					}
				}
			}
		}
	}

	public _resolveAnimationCurve(curve: string | CubicBezierAnimationCurve | CAMediaTimingFunction): CAMediaTimingFunction | string {
		return _resolveAnimationCurve(curve);
	}

	private static _createiOSAnimationFunction(propertyAnimations: Array<PropertyAnimation>, index: number, playSequentially: boolean): iOSAnimationFunction {
		return (animation: Animation) => {
			if (animation.isCancelled) {
				if (Trace.isEnabled()) {
					Trace.write(`Animation ${index - 1} was cancelled. Will skip the rest of animations and call finish callback`, Trace.categories.Animation);
				}
				animation.animationFinishedCallback(animation.isCancelled);
				return;
			}

			const animationInfo = propertyAnimations[index];
			const args = animation._getNativeAnimationArguments(animationInfo);

			if (animationInfo.curve === 'spring') {
				animation._createNativeViewAnimation(propertyAnimations, index, playSequentially, args, animationInfo);
			} else {
				animation._createNativeLayerAnimation(propertyAnimations, index, playSequentially, args, animationInfo);
			}
		};
	}

	private _getNativeAnimationArguments(animationInfo: PropertyAnimationInfo): AnimationInfo {
		const view = animationInfo.target;
		const style = view.style;
		const nativeView: NativeScriptUIView = view.nativeViewProtected;
		const parent = view.parent as View;

		let propertyNameToAnimate = animationInfo.property;
		let subPropertiesToAnimate;
		let toValue = animationInfo.value;
		let fromValue;
		let affectsLayout;
		if (nativeView) {
			const setKeyFrame = this._valueSource === 'keyframe';

			switch (animationInfo.property) {
				case Properties.backgroundColor:
					animationInfo._originalValue = view.backgroundColor;
					animationInfo._propertyResetCallback = (value, valueSource) => {
						applyAnimationProperty(style, backgroundColorProperty, value, setKeyFrame);
					};

					fromValue = nativeView.layer.backgroundColor;
					affectsLayout = backgroundColorProperty.affectsLayout;

					if (nativeView instanceof UILabel) {
						nativeView.setValueForKey(UIColor.clearColor, 'backgroundColor');
					}
					toValue = toValue?.ios?.CGColor;
					break;
				case Properties.opacity:
					animationInfo._originalValue = view.opacity;
					animationInfo._propertyResetCallback = (value, valueSource) => {
						applyAnimationProperty(style, opacityProperty, value, setKeyFrame);
					};

					fromValue = nativeView.layer.opacity;
					affectsLayout = opacityProperty.affectsLayout;
					break;
				case Properties.rotate:
					animationInfo._originalValue = {
						x: view.rotateX,
						y: view.rotateY,
						z: view.rotate,
					};
					animationInfo._propertyResetCallback = (value, valueSource) => {
						applyAnimationProperty(style, rotateXProperty, value.x, setKeyFrame);
						applyAnimationProperty(style, rotateYProperty, value.y, setKeyFrame);
						applyAnimationProperty(style, rotateProperty, value.z, setKeyFrame);
					};

					propertyNameToAnimate = 'transform.rotation';
					subPropertiesToAnimate = ['x', 'y', 'z'];
					fromValue = {
						x: nativeView.layer.valueForKeyPath('transform.rotation.x'),
						y: nativeView.layer.valueForKeyPath('transform.rotation.y'),
						z: nativeView.layer.valueForKeyPath('transform.rotation.z'),
					};

					if (animationInfo.target.rotateX != null && animationInfo.target.rotateX !== 0 && Math.floor(toValue / 360) - toValue / 360 === 0) {
						fromValue.x = (animationInfo.target.rotateX * Math.PI) / 180;
					}
					if (animationInfo.target.rotateY != null && animationInfo.target.rotateY !== 0 && Math.floor(toValue / 360) - toValue / 360 === 0) {
						fromValue.y = (animationInfo.target.rotateY * Math.PI) / 180;
					}
					if (animationInfo.target.rotate != null && animationInfo.target.rotate !== 0 && Math.floor(toValue / 360) - toValue / 360 === 0) {
						fromValue.z = (animationInfo.target.rotate * Math.PI) / 180;
					}

					// Respect only value.z for back-compat until 3D rotations are implemented
					toValue = {
						x: (toValue.x * Math.PI) / 180,
						y: (toValue.y * Math.PI) / 180,
						z: (toValue.z * Math.PI) / 180,
					};
					affectsLayout = rotateXProperty.affectsLayout || rotateYProperty.affectsLayout || rotateProperty.affectsLayout;
					break;
				case Properties.translate:
					animationInfo._originalValue = {
						x: view.translateX,
						y: view.translateY,
					};
					animationInfo._propertyResetCallback = (value, valueSource) => {
						applyAnimationProperty(style, translateXProperty, value.x, setKeyFrame);
						applyAnimationProperty(style, translateYProperty, value.y, setKeyFrame);
					};
					propertyNameToAnimate = 'transform';
					fromValue = NSValue.valueWithCATransform3D(nativeView.layer.transform);
					toValue = NSValue.valueWithCATransform3D(CATransform3DTranslate(nativeView.layer.transform, toValue.x, toValue.y, 0));
					affectsLayout = translateXProperty.affectsLayout || translateYProperty.affectsLayout;
					break;
				case Properties.scale:
					if (toValue.x === 0) {
						toValue.x = 1e-6;
					}
					if (toValue.y === 0) {
						toValue.y = 1e-6;
					}
					animationInfo._originalValue = { x: view.scaleX, y: view.scaleY };
					animationInfo._propertyResetCallback = (value, valueSource) => {
						applyAnimationProperty(style, scaleXProperty, value.x, setKeyFrame);
						applyAnimationProperty(style, scaleYProperty, value.y, setKeyFrame);
					};
					propertyNameToAnimate = 'transform';
					fromValue = NSValue.valueWithCATransform3D(nativeView.layer.transform);
					toValue = NSValue.valueWithCATransform3D(CATransform3DScale(nativeView.layer.transform, toValue.x, toValue.y, 1));
					affectsLayout = scaleXProperty.affectsLayout || scaleYProperty.affectsLayout;
					break;
				case _transform:
					fromValue = NSValue.valueWithCATransform3D(nativeView.layer.transform);
					animationInfo._originalValue = {
						xs: view.scaleX,
						ys: view.scaleY,
						xt: view.translateX,
						yt: view.translateY,
						rx: view.rotateX,
						ry: view.rotateY,
						rz: view.rotate,
					};
					animationInfo._propertyResetCallback = (value, valueSource) => {
						applyAnimationProperty(style, translateXProperty, value.xt, setKeyFrame);
						applyAnimationProperty(style, translateYProperty, value.yt, setKeyFrame);
						applyAnimationProperty(style, scaleXProperty, value.xs, setKeyFrame);
						applyAnimationProperty(style, scaleYProperty, value.ys, setKeyFrame);
						applyAnimationProperty(style, rotateXProperty, value.rx, setKeyFrame);
						applyAnimationProperty(style, rotateYProperty, value.ry, setKeyFrame);
						applyAnimationProperty(style, rotateProperty, value.rz, setKeyFrame);
					};
					propertyNameToAnimate = 'transform';
					toValue = NSValue.valueWithCATransform3D(Animation._createNativeAffineTransform(animationInfo));
					affectsLayout = translateXProperty.affectsLayout || translateYProperty.affectsLayout || scaleXProperty.affectsLayout || scaleYProperty.affectsLayout || rotateXProperty.affectsLayout || rotateYProperty.affectsLayout || rotateProperty.affectsLayout;
					break;
				default:
					affectsLayout = false;
					Trace.write(`Animating property '${animationInfo.property}' is not supported`, Trace.categories.Animation, Trace.messageType.error);
			}
		}

		let duration = 0.3;
		if (animationInfo.duration != null) {
			duration = animationInfo.duration / 1000.0;
		}

		let delay;
		if (animationInfo.delay) {
			delay = animationInfo.delay / 1000.0;
		}

		let repeatCount;
		if (animationInfo.iterations != null) {
			if (animationInfo.iterations === Number.POSITIVE_INFINITY) {
				repeatCount = Number.MAX_VALUE;
			} else {
				repeatCount = animationInfo.iterations;
			}
		}

		return {
			propertyNameToAnimate,
			fromValue,
			subPropertiesToAnimate,
			toValue,
			duration,
			repeatCount,
			delay,
			affectsLayout,
		};
	}

	private _createNativeLayerAnimation(propertyAnimations: Array<PropertyAnimation>, index: number, playSequentially: boolean, args: AnimationInfo, animationInfo: PropertyAnimation) {
		const nativeView: NativeScriptUIView = animationInfo.target.nativeViewProtected;
		const nativeAnimation = args.subPropertiesToAnimate ? this._createGroupAnimation(args, animationInfo) : this._createCABasicAnimation(args, animationInfo);

		const animationDelegate = AnimationDelegateImpl.initWithFinishedCallback(new WeakRef(this), animationInfo);
		nativeAnimation.setValueForKey(animationDelegate, 'delegate');
		if (nativeView) {
			nativeView.layer.addAnimationForKey(nativeAnimation, args.propertyNameToAnimate);

			// Shadow layers do not inherit from animating view layer
			if (nativeView.outerShadowContainerLayer) {
				nativeView.outerShadowContainerLayer.addAnimationForKey(nativeAnimation, args.propertyNameToAnimate);
			}
		}

		if (index + 1 < propertyAnimations.length) {
			const callback = Animation._createiOSAnimationFunction(propertyAnimations, index + 1, playSequentially);
			if (!playSequentially) {
				callback(this);
			} else {
				animationDelegate.nextAnimation = callback;
			}
		}
	}

	private _createGroupAnimation(args: AnimationInfo, animation: PropertyAnimation) {
		const groupAnimation = CAAnimationGroup.new();
		groupAnimation.duration = args.duration;
		if (args.repeatCount != null) {
			groupAnimation.repeatCount = args.repeatCount;
		}
		if (args.delay != null) {
			groupAnimation.beginTime = CACurrentMediaTime() + args.delay;
		}
		if (animation.curve != null) {
			groupAnimation.timingFunction = animation.curve;
		}
		const animations = NSMutableArray.alloc<CAAnimation>().initWithCapacity(3);

		args.subPropertiesToAnimate.forEach((property) => {
			const basicAnimationArgs = { ...args, duration: undefined, repeatCount: undefined, delay: undefined, curve: undefined };
			basicAnimationArgs.propertyNameToAnimate = `${args.propertyNameToAnimate}.${property}`;
			basicAnimationArgs.fromValue = args.fromValue[property];
			basicAnimationArgs.toValue = args.toValue[property];

			const basicAnimation = this._createCABasicAnimation(basicAnimationArgs, animation);
			animations.addObject(basicAnimation);
		});

		groupAnimation.animations = animations;

		return groupAnimation;
	}

	private _createCABasicAnimation(args: AnimationInfo, animation: PropertyAnimation) {
		const basicAnimation = CABasicAnimation.animationWithKeyPath(args.propertyNameToAnimate);
		basicAnimation.fromValue = args.fromValue;
		basicAnimation.toValue = args.toValue;
		basicAnimation.duration = args.duration;
		if (args.repeatCount != null) {
			basicAnimation.repeatCount = args.repeatCount;
		}
		if (args.delay != null) {
			basicAnimation.beginTime = CACurrentMediaTime() + args.delay;
		}
		if (animation.curve != null) {
			basicAnimation.timingFunction = animation.curve;
		}

		return basicAnimation;
	}

	private _createNativeViewAnimation(propertyAnimations: Array<PropertyAnimationInfo>, index: number, playSequentially: boolean, args: AnimationInfo, animationInfo: PropertyAnimationInfo) {
		const nativeView: NativeScriptUIView = animationInfo.target.nativeViewProtected;

		let nextAnimation;
		if (index + 1 < propertyAnimations.length) {
			const callback = Animation._createiOSAnimationFunction(propertyAnimations, index + 1, playSequentially);
			if (!playSequentially) {
				callback(this);
			} else {
				nextAnimation = callback;
			}
		}

		let delay = 0;
		if (args.delay) {
			delay = args.delay;
		}

		UIView.animateWithDurationDelayUsingSpringWithDampingInitialSpringVelocityOptionsAnimationsCompletion(
			args.duration,
			delay,
			0.2,
			0,
			UIViewAnimationOptions.CurveLinear,
			() => {
				if (args.repeatCount != null) {
					UIView.setAnimationRepeatCount(args.repeatCount);
				}

				switch (animationInfo.property) {
					case Properties.backgroundColor:
						animationInfo.target.backgroundColor = args.toValue;
						break;
					case Properties.opacity:
						animationInfo.target.opacity = args.toValue;
						break;
					case Properties.height:
					case Properties.width:
						animationInfo._originalValue = animationInfo.target[animationInfo.property];
						nativeView.layer.setValueForKey(args.toValue, args.propertyNameToAnimate);

						// Resize background during animation
						iosBackground.drawBackgroundVisualEffects(animationInfo.target);

						animationInfo._propertyResetCallback = function (value) {
							animationInfo.target[animationInfo.property] = value;
						};
						break;
					case _transform:
						animationInfo._originalValue = nativeView.layer.transform;
						nativeView.layer.setValueForKey(args.toValue, args.propertyNameToAnimate);

						// Shadow layers do not inherit from animating view layer
						if (nativeView.outerShadowContainerLayer) {
							nativeView.outerShadowContainerLayer.setValueForKey(args.toValue, args.propertyNameToAnimate);
						}

						animationInfo._propertyResetCallback = function (value) {
							nativeView.layer.transform = value;
						};
						break;
				}
			},
			function (animationDidFinish: boolean) {
				if (animationDidFinish) {
					if (animationInfo.property === _transform) {
						if (animationInfo.value[Properties.translate] != null) {
							animationInfo.target.translateX = animationInfo.value[Properties.translate].x;
							animationInfo.target.translateY = animationInfo.value[Properties.translate].y;
						}
						if (animationInfo.value[Properties.rotate] != null) {
							animationInfo.target.rotateX = animationInfo.value[Properties.rotate].x;
							animationInfo.target.rotateY = animationInfo.value[Properties.rotate].y;
							animationInfo.target.rotate = animationInfo.value[Properties.rotate].z;
						}
						if (animationInfo.value[Properties.scale] != null) {
							animationInfo.target.scaleX = animationInfo.value[Properties.scale].x;
							animationInfo.target.scaleY = animationInfo.value[Properties.scale].y;
						}
					}
				} else {
					if (animationInfo._propertyResetCallback) {
						animationInfo._propertyResetCallback(animationInfo._originalValue);
					}
				}

				const cancelled = !animationDidFinish;
				this.animationFinishedCallback(cancelled);

				if (animationDidFinish && nextAnimation && !this.isCancelled) {
					nextAnimation(this);
				}
			}
		);
	}

	private static _createNativeAffineTransform(animation: PropertyAnimation): CATransform3D {
		const value = animation.value;
		let result: CATransform3D = CATransform3DIdentity;

		if (value[Properties.translate] != null) {
			const x = value[Properties.translate].x;
			const y = value[Properties.translate].y;
			result = CATransform3DTranslate(result, x, y, 0);
		}

		if (value[Properties.scale] != null) {
			const x = value[Properties.scale].x;
			const y = value[Properties.scale].y;
			result = CATransform3DScale(result, x === 0 ? 0.001 : x, y === 0 ? 0.001 : y, 1);
		}

		return result;
	}

	private static _isAffineTransform(property: string): boolean {
		return property === _transform || property === Properties.translate || property === Properties.rotate || property === Properties.scale;
	}

	private static _canBeMerged(animation1: PropertyAnimation, animation2: PropertyAnimation) {
		const result = Animation._isAffineTransform(animation1.property) && Animation._isAffineTransform(animation2.property) && animation1.target === animation2.target && animation1.duration === animation2.duration && animation1.delay === animation2.delay && animation1.iterations === animation2.iterations && animation1.curve === animation2.curve;
		return result;
	}

	private static _mergeAffineTransformAnimations(propertyAnimations: Array<PropertyAnimation>): Array<PropertyAnimation> {
		const result = new Array<PropertyAnimation>();

		let j;
		for (let i = 0, length = propertyAnimations.length; i < length; i++) {
			if (propertyAnimations[i][_skip]) {
				continue;
			}

			if (!Animation._isAffineTransform(propertyAnimations[i].property)) {
				// This is not an affine transform animation, so there is nothing to merge.
				result.push(propertyAnimations[i]);
			} else {
				// This animation has not been merged anywhere. Create a new transform animation.
				// The value becomes a JSON object combining all affine transforms together like this:
				// {
				//    translate: {x: 100, y: 100 },
				//    rotate: 90,
				//    scale: {x: 2, y: 2 }
				// }
				const newTransformAnimation: PropertyAnimation = {
					target: propertyAnimations[i].target,
					property: _transform,
					value: {},
					duration: propertyAnimations[i].duration,
					delay: propertyAnimations[i].delay,
					iterations: propertyAnimations[i].iterations,
					curve: propertyAnimations[i].curve,
				};
				if (Trace.isEnabled()) {
					Trace.write('Curve: ' + propertyAnimations[i].curve, Trace.categories.Animation);
				}
				newTransformAnimation.value[propertyAnimations[i].property] = propertyAnimations[i].value;
				if (Trace.isEnabled()) {
					Trace.write('Created new transform animation: ' + Animation._getAnimationInfo(newTransformAnimation), Trace.categories.Animation);
				}

				// Merge all compatible affine transform animations to the right into this new animation.
				j = i + 1;
				if (j < length) {
					for (; j < length; j++) {
						if (Animation._canBeMerged(propertyAnimations[i], propertyAnimations[j])) {
							if (Trace.isEnabled()) {
								Trace.write('Merging animations: ' + Animation._getAnimationInfo(newTransformAnimation) + ' + ' + Animation._getAnimationInfo(propertyAnimations[j]) + ';', Trace.categories.Animation);
							}
							newTransformAnimation.value[propertyAnimations[j].property] = propertyAnimations[j].value;
							// Mark that it has been merged so we can skip it on our outer loop.
							propertyAnimations[j][_skip] = true;
						}
					}
				}

				result.push(newTransformAnimation);
			}
		}

		return result;
	}
}

export function _getTransformMismatchErrorMessage(view: View): string {
	const expectedTransform = calculateTransform(view);
	const expectedTransformString = getCATransform3DString(expectedTransform);
	const actualTransformString = getCATransform3DString(view.nativeViewProtected.layer.transform);

	if (actualTransformString !== expectedTransformString) {
		return 'View and Native transforms do not match.\nActual: ' + actualTransformString + ';\nExpected: ' + expectedTransformString;
	}

	return null;
}

function applyAnimationProperty(styleOrView: any, property: any, value, setKeyFrame: boolean) {
	styleOrView[setKeyFrame && property['keyframe'] ? property['keyframe'] : property.name] = value;
}

function calculateTransform(view: View): CATransform3D {
	const scaleX = view.scaleX || 1e-6;
	const scaleY = view.scaleY || 1e-6;
	const perspective = view.perspective || 300;

	// Order is important: translate, rotate, scale
	let expectedTransform = new CATransform3D(CATransform3DIdentity);

	// Only set perspective if there is 3D rotation
	if (view.rotateX || view.rotateY) {
		expectedTransform.m34 = -1 / perspective;
	}

	expectedTransform = CATransform3DTranslate(expectedTransform, view.translateX, view.translateY, 0);
	expectedTransform = iosHelper.applyRotateTransform(expectedTransform, view.rotateX, view.rotateY, view.rotate);
	expectedTransform = CATransform3DScale(expectedTransform, scaleX, scaleY, 1);

	return expectedTransform;
}

function getCATransform3DString(t: CATransform3D) {
	return `[
    ${t.m11}, ${t.m12}, ${t.m13}, ${t.m14},
    ${t.m21}, ${t.m22}, ${t.m23}, ${t.m24},
    ${t.m31}, ${t.m32}, ${t.m33}, ${t.m34},
    ${t.m41}, ${t.m42}, ${t.m43}, ${t.m44}]`;
}
