// Types
import { AnimationDefinitionInternal, AnimationCurve, AnimationPromise, IOSView, PropertyAnimation, PropertyAnimationInfo } from './animation-common';
import { CssAnimationProperty, View } from '../core/view';

// Requires
import { AnimationBase, Properties } from './animation-common';
import { CubicBezierAnimationCurve } from './cubic-bezier-animation-curve';
import { Trace } from '../../trace';
import { opacityProperty, backgroundColorProperty, rotateProperty, rotateXProperty, rotateYProperty, translateXProperty, translateYProperty, scaleXProperty, scaleYProperty, heightProperty, widthProperty, PercentLength } from '../styling/style-properties';
import { ios as iosBackground } from '../styling/background';
import { ios as iosViewUtils, NativeScriptUIView } from '../utils';

import { layout } from '../../utils';
import { ios as iosHelper } from '../../utils/native-helper';

import { Screen } from '../../platform';

export * from './animation-common';
export { KeyframeAnimation, KeyframeAnimationInfo, KeyframeDeclaration, KeyframeInfo } from './keyframe-animation';

type iOSAnimationFunction = (animation: Animation) => void;

interface SpringTimingParameters {
	mass: number;
	stiffness: number;
	damping: number;
	settlingDuration?: number;
}

const _transform = '_transform';
const _skip = '_skip';

// Used to cache default CASpringAnimation values
let _springTimingDefaults: SpringTimingParameters;

class AnimationInfo {
	public propertyNameToAnimate: string;
	public subPropertiesToAnimate?: string[];
	public fromValue: any;
	public toValue: any;
	public duration: number;
	public repeatCount: number;
	public delay: number;
}

interface CurveNativeValues {
	layer: CAMediaTimingFunction;
	view: UITimingCurveProvider;
}

function calculateAnimationDuration(duration: number): number {
	return duration != null ? duration / 1000.0 : 0.3;
}

/**
 * Calculates spring timing values based on animation duration.
 *
 * @param duration
 * @returns
 */
function calculateSpringTimingParameters(duration: number): SpringTimingParameters {
	// Cache spring animation defaults
	if (!_springTimingDefaults) {
		const nativeAnimation = CASpringAnimation.animation();
		_springTimingDefaults = {
			mass: nativeAnimation.mass,
			stiffness: nativeAnimation.stiffness,
			damping: nativeAnimation.damping,
			settlingDuration: nativeAnimation.settlingDuration,
		};
	}

	if (!duration) {
		return _springTimingDefaults;
	}

	// The following formula helps on scaling spring effect values.
	// When these values are used by a spring animation, its settling duration will almost be identical to requested duration.
	const durationScaleValue = duration / _springTimingDefaults.settlingDuration;

	const mass = _springTimingDefaults.mass * durationScaleValue;
	const stiffness = _springTimingDefaults.stiffness / durationScaleValue;
	const damping = _springTimingDefaults.damping / durationScaleValue;

	return {
		mass,
		stiffness,
		damping,
	};
}

export function _resolveAnimationCurve(curve: AnimationCurve | CubicBezierAnimationCurve, duration: number): CurveNativeValues {
	let values: CurveNativeValues;
	const durationInSeconds = calculateAnimationDuration(duration);

	switch (curve) {
		case 'easeIn':
			values = {
				layer: CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionEaseIn),
				view: UICubicTimingParameters.alloc().initWithAnimationCurve(UIViewAnimationCurve.EaseIn),
			};
			break;
		case 'easeOut':
			values = {
				layer: CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionEaseOut),
				view: UICubicTimingParameters.alloc().initWithAnimationCurve(UIViewAnimationCurve.EaseOut),
			};
			break;
		case 'easeInOut':
			values = {
				layer: CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionEaseInEaseOut),
				view: UICubicTimingParameters.alloc().initWithAnimationCurve(UIViewAnimationCurve.EaseInOut),
			};
			break;
		case 'linear':
			values = {
				layer: CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionLinear),
				view: UICubicTimingParameters.alloc().initWithAnimationCurve(UIViewAnimationCurve.Linear),
			};
			break;
		case 'spring':
			const { mass, stiffness, damping } = calculateSpringTimingParameters(durationInSeconds);
			values = {
				layer: CAMediaTimingFunction.functionWithName(kCAMediaTimingFunctionLinear),
				view: UISpringTimingParameters.alloc().initWithMassStiffnessDampingInitialVelocity(mass, stiffness, damping, new CGVector({ dx: 0, dy: 0 })),
			};
			break;
		case 'ease':
			const controlPoint = CGPointMake(0.25, 0.1);
			values = {
				layer: CAMediaTimingFunction.functionWithControlPoints(controlPoint.x, controlPoint.y, controlPoint.x, controlPoint.y),
				view: UICubicTimingParameters.alloc().initWithControlPoint1ControlPoint2(controlPoint, controlPoint),
			};
			break;
		default:
			if (curve instanceof CubicBezierAnimationCurve) {
				const animationCurve = <CubicBezierAnimationCurve>curve;
				const controlPoint1 = CGPointMake(animationCurve.x1, animationCurve.y1);
				const controlPoint2 = CGPointMake(animationCurve.x2, animationCurve.y2);

				values = {
					layer: CAMediaTimingFunction.functionWithControlPoints(controlPoint1.x, controlPoint1.y, controlPoint2.x, controlPoint2.y),
					view: UICubicTimingParameters.alloc().initWithControlPoint1ControlPoint2(controlPoint1, controlPoint2),
				};
			} else {
				Trace.write(`Invalid animation curve: ${curve}`, Trace.categories.Animation, Trace.messageType.error);
			}
			break;
	}
	return values;
}

export class Animation extends AnimationBase {
	private _nativeAnimatorsArray: Array<UIViewPropertyAnimator | CAAnimation>;
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

	animationFinishedCallback(isInterrupted: boolean) {
		if (!this.isPlaying) {
			return;
		}

		if (this._playSequentially) {
			// This function will be called by the last animation when done or by another animation if the user cancels them halfway through.
			if (!isInterrupted) {
				this._resolveAnimationFinishedPromise(true);
			}
		} else {
			// This callback will be called by each INDIVIDUAL animation when it finishes or is cancelled.
			if (isInterrupted) {
				this._cancelledAnimations++;
			} else {
				this._finishedAnimations++;
			}

			if (this._cancelledAnimations > 0 && this._cancelledAnimations + this._finishedAnimations === this._mergedPropertyAnimations.length) {
				if (Trace.isEnabled()) {
					Trace.write(this._cancelledAnimations + ' animations cancelled.', Trace.categories.Animation);
				}
				this._resolveAnimationFinishedPromise(false);
			} else if (this._finishedAnimations === this._mergedPropertyAnimations.length) {
				if (Trace.isEnabled()) {
					Trace.write(this._finishedAnimations + ' animations finished.', Trace.categories.Animation);
				}
				this._resolveAnimationFinishedPromise(true);
			}
		}
	}

	public play(): AnimationPromise {
		if (this.isPlaying) {
			return this._rejectAlreadyPlaying();
		}

		const animationFinishedPromise = super.play();

		if (!this._nativeAnimatorsArray) {
			this._nativeAnimatorsArray = new Array(this._mergedPropertyAnimations.length);
		}

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
			for (let i = 0, length = this._mergedPropertyAnimations.length; i < length; i++) {
				const animator = this._nativeAnimatorsArray[i];
				const animationInfo = this._mergedPropertyAnimations[i];

				if (animator instanceof UIViewPropertyAnimator) {
					animator.stopAnimation(false);
					animator.finishAnimationAtPosition(UIViewAnimatingPosition.End);
				}

				if (animationInfo) {
					/**
					 * Use animating property as a key for all animations so that it's easier to cancel them and only them when needed.
					 */
					const animationKey: string = animationInfo.property === Properties.height || animationInfo.property === Properties.width ? 'size' : animationInfo.property;

					if (animationInfo.target?.nativeViewProtected?.layer) {
						const nativeView: NativeScriptUIView = animationInfo.target.nativeViewProtected;
						if (nativeView.layer.mask) {
							nativeView.layer.mask.removeAnimationForKey(animationKey);
						}
						nativeView.layer.removeAnimationForKey(animationKey);

						// Gradient background animations
						if (nativeView.gradientLayer) {
							nativeView.gradientLayer.removeAnimationForKey(animationKey);
						}

						// Border animations
						if (nativeView.borderLayer) {
							if (nativeView.borderLayer.mask) {
								nativeView.borderLayer.mask.removeAnimationForKey(animationKey);
							}

							const borderLayers = nativeView.borderLayer.sublayers;
							if (borderLayers?.count) {
								for (let i = 0, count = borderLayers.count; i < count; i++) {
									borderLayers[i].removeAnimationForKey(animationKey);
								}
							}

							nativeView.borderLayer.removeAnimationForKey(animationKey);
						}

						// Shadow animations
						if (nativeView.outerShadowContainerLayer) {
							if (nativeView.outerShadowContainerLayer.mask) {
								nativeView.outerShadowContainerLayer.mask.removeAnimationForKey(animationKey);
							}

							const outerShadowLayers = nativeView.outerShadowContainerLayer.sublayers;
							if (outerShadowLayers?.count) {
								for (let i = 0, count = outerShadowLayers.count; i < count; i++) {
									const shadowLayer = outerShadowLayers[i];

									if (shadowLayer.mask) {
										shadowLayer.mask.removeAnimationForKey(animationKey);
									}
									shadowLayer.removeAnimationForKey(animationKey);
								}
							}

							nativeView.outerShadowContainerLayer.removeAnimationForKey(animationKey);
						}
					}

					if (animationInfo._propertyResetCallback) {
						animationInfo._propertyResetCallback(animationInfo._originalValue, this._valueSource);
					}
				}
			}
		}
	}

	public _resolveAnimationCurve(curve: AnimationCurve | CubicBezierAnimationCurve, duration: number): CurveNativeValues {
		return _resolveAnimationCurve(curve, duration);
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

			// For now, we use view animations to update bounds (suitable for layout updates)
			if (args.propertyNameToAnimate === 'bounds') {
				animation._animateView(propertyAnimations, index, playSequentially, args, animationInfo);
			} else {
				animation._animateLayer(propertyAnimations, index, playSequentially, args, animationInfo);
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
		if (nativeView) {
			const setKeyFrame = this._valueSource === 'keyframe';

			switch (animationInfo.property) {
				case Properties.backgroundColor:
					animationInfo._originalValue = view.backgroundColor;
					animationInfo._propertyResetCallback = (value, valueSource) => {
						applyAnimationProperty(style, backgroundColorProperty, value, setKeyFrame);
					};

					fromValue = nativeView.layer.backgroundColor;

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
					break;
				case Properties.width: {
					if (!parent) {
						Trace.write(`Cannot animate property '${animationInfo.property}' on root view`, Trace.categories.Animation, Trace.messageType.error);
					}

					const parentMeasuredWidth = parent.getMeasuredWidth();
					const newWidth = layout.toDeviceIndependentPixels(PercentLength.toDevicePixels(PercentLength.parse(toValue), parentMeasuredWidth, parentMeasuredWidth));
					const bounds = nativeView.layer.bounds;

					animationInfo._originalValue = view.width;
					animationInfo._propertyResetCallback = (value, valueSource) => {
						applyAnimationProperty(style, widthProperty, value, setKeyFrame);
					};

					fromValue = NSValue.valueWithCGRect(bounds);
					toValue = NSValue.valueWithCGRect(CGRectMake(bounds.origin.x, bounds.origin.y, newWidth, bounds.size.height));
					propertyNameToAnimate = 'bounds';
					break;
				}
				case Properties.height: {
					if (!parent) {
						Trace.write(`Cannot animate property '${animationInfo.property}' on root view`, Trace.categories.Animation, Trace.messageType.error);
					}

					const parentMeasuredHeight = parent.getMeasuredHeight();
					const newHeight = layout.toDeviceIndependentPixels(PercentLength.toDevicePixels(PercentLength.parse(toValue), parentMeasuredHeight, parentMeasuredHeight));
					const bounds = nativeView.layer.bounds;

					animationInfo._originalValue = view.height;
					animationInfo._propertyResetCallback = (value, valueSource) => {
						applyAnimationProperty(style, heightProperty, value, setKeyFrame);
					};

					fromValue = NSValue.valueWithCGRect(bounds);
					toValue = NSValue.valueWithCGRect(CGRectMake(bounds.origin.x, bounds.origin.y, bounds.size.width, newHeight));
					propertyNameToAnimate = 'bounds';
					break;
				}
				default:
					Trace.write(`Animating property '${animationInfo.property}' is not supported`, Trace.categories.Animation, Trace.messageType.error);
					break;
			}
		}

		const duration = calculateAnimationDuration(animationInfo.duration);

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
		};
	}

	private _animateLayer(propertyAnimations: Array<PropertyAnimation>, index: number, playSequentially: boolean, args: AnimationInfo, animationInfo: PropertyAnimation) {
		const nativeView: NativeScriptUIView = animationInfo.target.nativeViewProtected;
		if (!nativeView) {
			return;
		}

		const setKeyFrame = this._valueSource === 'keyframe';
		const targetStyle = animationInfo.target.style;
		const value = animationInfo.value;

		// Cache native animation so that it's not being recreated each time animation gets played
		if (!this._nativeAnimatorsArray[index]) {
			this._nativeAnimatorsArray[index] = args.subPropertiesToAnimate ? this._createGroupAnimation(args, animationInfo) : this._createCABasicAnimation(args, animationInfo);
		}

		const nativeAnimation = <CAAnimation>this._nativeAnimatorsArray[index];

		let nextAnimation;

		(<IOSView>animationInfo.target)._suspendPresentationLayerUpdates();

		CATransaction.begin();

		CATransaction.setCompletionBlock(() => {
			this.animationFinishedCallback(false);

			if (nextAnimation && !this.isCancelled) {
				nextAnimation(this);
			}
		});

		switch (animationInfo.property) {
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

		nativeView.layer.addAnimationForKey(nativeAnimation, args.propertyNameToAnimate);

		// Shadow layers do not inherit from animating view layer
		if (nativeView.outerShadowContainerLayer) {
			nativeView.outerShadowContainerLayer.addAnimationForKey(nativeAnimation, args.propertyNameToAnimate);
		}

		CATransaction.commit();

		(<IOSView>animationInfo.target)._resumePresentationLayerUpdates();

		if (index + 1 < propertyAnimations.length) {
			const callback = Animation._createiOSAnimationFunction(propertyAnimations, index + 1, playSequentially);
			if (!playSequentially) {
				callback(this);
			} else {
				nextAnimation = callback;
			}
		}
	}

	private _createGroupAnimation(args: AnimationInfo, animation: PropertyAnimation) {
		const groupAnimation = CAAnimationGroup.new();
		groupAnimation.duration = args.duration;

		const animations = NSMutableArray.alloc<CAAnimation>().initWithCapacity(args.subPropertiesToAnimate.length);

		args.subPropertiesToAnimate.forEach((property) => {
			const basicAnimationArgs = { ...args };
			basicAnimationArgs.propertyNameToAnimate = `${args.propertyNameToAnimate}.${property}`;
			basicAnimationArgs.fromValue = args.fromValue[property];
			basicAnimationArgs.toValue = args.toValue[property];

			const basicAnimation = this._createCABasicAnimation(basicAnimationArgs, animation);
			animations.addObject(basicAnimation);
		});

		groupAnimation.animations = animations;

		return groupAnimation;
	}

	private _createCABasicAnimation(args: AnimationInfo, animationInfo: PropertyAnimation): CABasicAnimation {
		let nativeAnimation: CABasicAnimation;
		if (animationInfo.curve === 'spring') {
			const springAnimation = CASpringAnimation.animationWithKeyPath(args.propertyNameToAnimate);

			const { mass, stiffness, damping } = calculateSpringTimingParameters(args.duration);
			springAnimation.mass = mass;
			springAnimation.stiffness = stiffness;
			springAnimation.damping = damping;
			springAnimation.duration = springAnimation.settlingDuration;

			nativeAnimation = springAnimation;
		} else {
			nativeAnimation = CABasicAnimation.animationWithKeyPath(args.propertyNameToAnimate);
			nativeAnimation.duration = args.duration;
		}

		nativeAnimation.fromValue = args.fromValue;
		nativeAnimation.toValue = args.toValue;

		if (animationInfo.nativeCurve != null) {
			nativeAnimation.timingFunction = animationInfo.nativeCurve.layer;
		}
		if (args.repeatCount != null) {
			nativeAnimation.repeatCount = args.repeatCount;
		}
		if (args.delay != null) {
			nativeAnimation.beginTime = CACurrentMediaTime() + args.delay;
		}

		return nativeAnimation;
	}

	private _createUIViewPropertyAnimator(args: AnimationInfo, animationInfo: PropertyAnimation): UIViewPropertyAnimator {
		const animator = UIViewPropertyAnimator.alloc().initWithDurationTimingParameters(args.duration, animationInfo.nativeCurve.view);
		return animator;
	}

	private _animateView(propertyAnimations: Array<PropertyAnimationInfo>, index: number, playSequentially: boolean, args: AnimationInfo, animationInfo: PropertyAnimationInfo) {
		const nativeView: NativeScriptUIView = animationInfo.target.nativeViewProtected;
		const setKeyFrame = this._valueSource === 'keyframe';
		const isAnimatingViewBounds = args.propertyNameToAnimate === 'bounds';

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

		const originalOriginX = animationInfo.target.originX;
		const originalOriginY = animationInfo.target.originY;
		// For some layers to animate properly (e.g. shadow layers that don't belong to view layer tree),
		// we set view origin to zero during animation
		if (isAnimatingViewBounds) {
			Animation.updateViewOrigin(animationInfo, 0, 0);
		}

		const animateCallback = () => {
			if (args.repeatCount != null) {
				UIView.setAnimationRepeatCount(args.repeatCount);
			}

			switch (animationInfo.property) {
				case Properties.width:
					animationInfo.target.width = animationInfo.value;
					break;
				case Properties.height:
					animationInfo.target.height = animationInfo.value;
					break;
			}

			if (isAnimatingViewBounds) {
				(animationInfo.target.page || animationInfo.target).nativeViewProtected.layoutIfNeeded();
			}
		};

		const completionCallback = (position: UIViewAnimatingPosition) => {
			const isInterrupted: boolean = position !== UIViewAnimatingPosition.End;

			// Reset origin point back to its original value
			if (isAnimatingViewBounds) {
				Animation.updateViewOrigin(animationInfo, originalOriginX, originalOriginY);
			}

			if (isInterrupted) {
				if (animationInfo._propertyResetCallback) {
					animationInfo._propertyResetCallback(animationInfo._originalValue);
				}
			}

			this.animationFinishedCallback(isInterrupted);

			if (!isInterrupted && nextAnimation && !this.isCancelled) {
				nextAnimation(this);
			}
		};

		// Use cached native animations if any or cache them so that they won't be recreated each time animation gets played
		if (!this._nativeAnimatorsArray[index]) {
			this._nativeAnimatorsArray[index] = this._createUIViewPropertyAnimator(args, animationInfo);
		}

		const animator = <UIViewPropertyAnimator>this._nativeAnimatorsArray[index];
		// Callbacks have to be set anew on every execution since animator gets cached
		animator.addAnimations(animateCallback);
		animator.addCompletion(completionCallback);
		animator.startAnimationAfterDelay(args.delay);

		if (isAnimatingViewBounds) {
			this.animateLayerSize(nativeView, args.toValue.CGRectValue, animationInfo, args);
		}
	}

	private animateLayerSize(nativeView: NativeScriptUIView, bounds: CGRect, animationInfo: PropertyAnimation, args: AnimationInfo): void {
		const view: View = animationInfo.target;
		/**
		 * Use animating property as a key for all animations so that it's easier to cancel them and only them when needed.
		 * If a layer has multiple animations, we can use a CAAnimationGroup with the property as key.
		 */
		const key: string = animationInfo.property === Properties.height || animationInfo.property === Properties.width ? 'size' : animationInfo.property;

		// Gradient background animation
		if (nativeView.gradientLayer) {
			const nativeAnimation = this._createCABasicAnimation(args, animationInfo);

			nativeView.gradientLayer.bounds = bounds;
			nativeView.gradientLayer.addAnimationForKey(nativeAnimation, key);
		}

		let clipPath; // This is also used for animating shadow

		// Clipping mask animation
		if (nativeView.layer.mask instanceof CAShapeLayer) {
			let toValue;

			if (nativeView.maskType === iosViewUtils.LayerMask.BORDER) {
				toValue = iosBackground.generateNonUniformBorderOuterClipRoundedPath(view, bounds);
			} else if (nativeView.maskType === iosViewUtils.LayerMask.CLIP_PATH) {
				clipPath = iosBackground.generateClipPath(view, bounds);
				toValue = clipPath;
			} else {
				Trace.write('Unknown mask on animating view: ' + view, Trace.categories.Animation, Trace.messageType.info);
			}

			if (toValue) {
				const nativeAnimation = this._createCABasicAnimation(
					{
						...args,
						propertyNameToAnimate: 'path',
						fromValue: nativeView.layer.mask.path,
						toValue,
					},
					animationInfo
				);

				nativeView.layer.mask.path = toValue;
				nativeView.layer.mask.addAnimationForKey(nativeAnimation, key);
			}
		}

		// Border animations (uniform and non-uniform)
		if (nativeView.hasNonUniformBorder) {
			if (nativeView.borderLayer) {
				const innerClipPath = iosBackground.generateNonUniformBorderInnerClipRoundedPath(view, bounds);

				if (nativeView.hasNonUniformBorderColor) {
					const borderMask = nativeView.borderLayer.mask;
					if (borderMask instanceof CAShapeLayer) {
						const nativeAnimation = this._createCABasicAnimation(
							{
								...args,
								propertyNameToAnimate: 'path',
								fromValue: borderMask.path,
								toValue: innerClipPath,
							},
							animationInfo
						);

						borderMask.path = innerClipPath;
						borderMask.addAnimationForKey(nativeAnimation, key);
					}

					const borderLayers = nativeView.borderLayer.sublayers;
					if (borderLayers?.count) {
						const paths = iosBackground.generateNonUniformMultiColorBorderRoundedPaths(view, bounds);

						for (let i = 0, count = borderLayers.count; i < count; i++) {
							const layer = nativeView.borderLayer.sublayers[i];
							const toValue = paths[i];
							if (layer instanceof CAShapeLayer) {
								const nativeAnimation = this._createCABasicAnimation(
									{
										...args,
										propertyNameToAnimate: 'path',
										fromValue: layer.path,
										toValue,
									},
									animationInfo
								);

								layer.path = toValue;
								layer.addAnimationForKey(nativeAnimation, key);
							}
						}
					}
				} else {
					const nativeAnimation = this._createCABasicAnimation(
						{
							...args,
							propertyNameToAnimate: 'path',
							fromValue: nativeView.borderLayer.path,
							toValue: innerClipPath,
						},
						animationInfo
					);

					nativeView.borderLayer.path = innerClipPath;
					nativeView.borderLayer.addAnimationForKey(nativeAnimation, key);
				}
			}
		} else {
			// TODO: Animate border width when borders get support for percentage values
			// Uniform corner radius also relies on view size
			if (nativeView.layer.cornerRadius) {
				const toValue = iosBackground.getUniformBorderRadius(view, bounds);
				const nativeAnimation = this._createCABasicAnimation(
					{
						...args,
						propertyNameToAnimate: 'cornerRadius',
						fromValue: nativeView.layer.cornerRadius,
						toValue,
					},
					animationInfo
				);

				nativeView.layer.cornerRadius = toValue;
				nativeView.layer.addAnimationForKey(nativeAnimation, 'cornerRadius');
			}
		}

		// Shadow layers do not inherit from animating view layer
		if (nativeView.outerShadowContainerLayer) {
			const shadowClipMask = nativeView.outerShadowContainerLayer.mask;

			nativeView.outerShadowContainerLayer.bounds = bounds;
			nativeView.outerShadowContainerLayer.addAnimationForKey(this._createCABasicAnimation(args, animationInfo), key);

			// This is for animating view clip path on shadow
			if (clipPath && shadowClipMask instanceof CAShapeLayer) {
				const nativeAnimation = this._createCABasicAnimation(
					{
						...args,
						propertyNameToAnimate: 'path',
						fromValue: shadowClipMask.path,
						toValue: clipPath,
					},
					animationInfo
				);

				shadowClipMask.path = clipPath;
				shadowClipMask.addAnimationForKey(nativeAnimation, key);
			}

			const outerShadowLayers = nativeView.outerShadowContainerLayer.sublayers;
			if (outerShadowLayers?.count) {
				const { maskPath, shadowPath } = iosBackground.generateShadowLayerPaths(view, bounds);

				for (let i = 0, count = outerShadowLayers.count; i < count; i++) {
					const shadowLayer = outerShadowLayers[i];
					const nativeAnimation = this._createCABasicAnimation(
						{
							...args,
							propertyNameToAnimate: 'shadowPath',
							fromValue: shadowLayer.shadowPath,
							toValue: shadowPath,
						},
						animationInfo
					);

					shadowLayer.shadowPath = shadowPath;
					shadowLayer.addAnimationForKey(nativeAnimation, key);

					if (shadowLayer.mask instanceof CAShapeLayer) {
						const nativeMaskAnimation = this._createCABasicAnimation(
							{
								...args,
								propertyNameToAnimate: 'path',
								fromValue: shadowLayer.mask.path,
								toValue: maskPath,
							},
							animationInfo
						);

						shadowLayer.mask.path = maskPath;
						shadowLayer.mask.addAnimationForKey(nativeMaskAnimation, key);
					}
				}
			}
		}
	}

	private static updateViewOrigin(animationInfo: PropertyAnimationInfo, originX: number, originY: number) {
		switch (animationInfo.property) {
			case Properties.width:
				animationInfo.target.originX = originX;
				break;
			case Properties.height:
				animationInfo.target.originY = originY;
				break;
		}
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
		let isCurveEqual: boolean;
		if (animation1.curve instanceof CubicBezierAnimationCurve && animation2.curve instanceof CubicBezierAnimationCurve) {
			isCurveEqual = animation1.curve.equals(animation2.curve);
		} else {
			isCurveEqual = animation1.curve === animation2.curve;
		}

		return Animation._isAffineTransform(animation1.property) && Animation._isAffineTransform(animation2.property) && animation1.target === animation2.target && animation1.duration === animation2.duration && animation1.delay === animation2.delay && animation1.iterations === animation2.iterations && isCurveEqual;
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
					...propertyAnimations[i],
					property: _transform,
					value: {},
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
