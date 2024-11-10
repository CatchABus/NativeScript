import { ImageBase, stretchProperty, imageSourceProperty, tintColorProperty, srcProperty, iosSymbolEffectProperty, ImageSymbolEffect, ImageSymbolEffects, iosSymbolScaleProperty } from './image-common';
import { ImageSource, iosSymbolScaleType } from '../../image-source';
import { ImageAsset } from '../../image-asset';
import { Color } from '../../color';
import { Trace } from '../../trace';
import { layout, queueGC } from '../../utils';
import { SDK_VERSION } from '../../utils/constants';

export * from './image-common';

export class Image extends ImageBase {
	nativeViewProtected: UIImageView;
	private _imageSourceAffectsLayout = true;
	private _templateImageWasCreated: boolean;

	public createNativeView() {
		const imageView = UIImageView.new();
		imageView.contentMode = UIViewContentMode.ScaleAspectFit;
		imageView.userInteractionEnabled = true;

		return imageView;
	}

	public initNativeView(): void {
		super.initNativeView();
		this._setNativeClipToBounds();
	}

	public disposeImageSource() {
		if (this.nativeViewProtected?.image === this.imageSource?.ios) {
			this.nativeViewProtected.image = null;
		}

		if (this.imageSource?.ios) {
			this.imageSource.ios = null;
		}

		this.imageSource = null;

		queueGC();
	}

	public disposeNativeView(): void {
		if (this.nativeViewProtected?.image) {
			this.nativeViewProtected.image = null;
		}

		this.disposeImageSource();
		super.disposeNativeView();
	}

	private setTintColor(value: Color) {
		if (this.nativeViewProtected) {
			if (value && this.nativeViewProtected.image && !this._templateImageWasCreated) {
				this.nativeViewProtected.image = this.nativeViewProtected.image.imageWithRenderingMode(UIImageRenderingMode.AlwaysTemplate);
				this._templateImageWasCreated = true;
				queueGC();
			} else if (!value && this.nativeViewProtected.image && this._templateImageWasCreated) {
				this._templateImageWasCreated = false;
				this.nativeViewProtected.image = this.nativeViewProtected.image.imageWithRenderingMode(UIImageRenderingMode.Automatic);
				queueGC();
			}
			this.nativeViewProtected.tintColor = value ? value.ios : null;
		}
	}

	public _setNativeImage(nativeImage: UIImage) {
		if (this.nativeViewProtected?.image) {
			this.nativeViewProtected.image = null;

			queueGC();
		}

		if (this.nativeViewProtected) {
			this.nativeViewProtected.image = nativeImage;
		}
		this._templateImageWasCreated = false;
		this.setTintColor(this.style?.tintColor);

		if (this._imageSourceAffectsLayout) {
			this.requestLayout();
		}
	}

	_setNativeClipToBounds() {
		if (this.nativeViewProtected) {
			// Always set clipsToBounds for images
			this.nativeViewProtected.clipsToBounds = true;
		}
	}

	public onMeasure(widthMeasureSpec: number, heightMeasureSpec: number): void {
		// We don't call super because we measure native view with specific size.
		const width = layout.getMeasureSpecSize(widthMeasureSpec);
		const widthMode = layout.getMeasureSpecMode(widthMeasureSpec);

		const height = layout.getMeasureSpecSize(heightMeasureSpec);
		const heightMode = layout.getMeasureSpecMode(heightMeasureSpec);

		const finiteWidth: boolean = widthMode !== layout.UNSPECIFIED;
		const finiteHeight: boolean = heightMode !== layout.UNSPECIFIED;

		let measureWidth = this.imageSource ? layout.toDevicePixels(this.imageSource.width) : 0;
		let measureHeight = this.imageSource ? layout.toDevicePixels(this.imageSource.height) : 0;

		this._imageSourceAffectsLayout = widthMode !== layout.EXACTLY || heightMode !== layout.EXACTLY;

		if (measureWidth !== 0 && measureHeight !== 0 && (finiteWidth || finiteHeight)) {
			const scale = Image.computeScaleFactor(width, height, finiteWidth, finiteHeight, measureWidth, measureHeight, this.stretch);
			const resultW = Math.round(measureWidth * scale.width);
			const resultH = Math.round(measureHeight * scale.height);

			measureWidth = finiteWidth ? Math.min(resultW, width) : resultW;
			measureHeight = finiteHeight ? Math.min(resultH, height) : resultH;

			if (Trace.isEnabled()) {
				Trace.write('Image stretch: ' + this.stretch + ', nativeWidth: ' + measureWidth + ', nativeHeight: ' + measureHeight, Trace.categories.Layout);
			}
		}

		const widthAndState = Image.resolveSizeAndState(this._calculatePreferredWidth(measureWidth), width, widthMode, 0);
		const heightAndState = Image.resolveSizeAndState(this._calculatePreferredHeight(measureHeight), height, heightMode, 0);

		this.setMeasuredDimension(widthAndState, heightAndState);
	}

	private static computeScaleFactor(measureWidth: number, measureHeight: number, widthIsFinite: boolean, heightIsFinite: boolean, nativeWidth: number, nativeHeight: number, imageStretch: string): { width: number; height: number } {
		let scaleW = 1;
		let scaleH = 1;

		if ((imageStretch === 'aspectFill' || imageStretch === 'aspectFit' || imageStretch === 'fill') && (widthIsFinite || heightIsFinite)) {
			scaleW = nativeWidth > 0 ? measureWidth / nativeWidth : 0;
			scaleH = nativeHeight > 0 ? measureHeight / nativeHeight : 0;

			if (!widthIsFinite) {
				scaleW = scaleH;
			} else if (!heightIsFinite) {
				scaleH = scaleW;
			} else {
				// No infinite dimensions.
				switch (imageStretch) {
					case 'aspectFit':
						scaleH = scaleW < scaleH ? scaleW : scaleH;
						scaleW = scaleH;
						break;
					case 'aspectFill':
						scaleH = scaleW > scaleH ? scaleW : scaleH;
						scaleW = scaleH;
						break;
				}
			}
		}

		return { width: scaleW, height: scaleH };
	}

	[stretchProperty.setNative](value: 'none' | 'aspectFill' | 'aspectFit' | 'fill') {
		if (this.nativeViewProtected) {
			switch (value) {
				case 'aspectFit':
					this.nativeViewProtected.contentMode = UIViewContentMode.ScaleAspectFit;
					break;

				case 'aspectFill':
					this.nativeViewProtected.contentMode = UIViewContentMode.ScaleAspectFill;
					break;

				case 'fill':
					this.nativeViewProtected.contentMode = UIViewContentMode.ScaleToFill;
					break;

				case 'none':
				default:
					this.nativeViewProtected.contentMode = UIViewContentMode.TopLeft;
					break;
			}
		}
	}

	[tintColorProperty.setNative](value: Color) {
		this.setTintColor(value);
	}

	[imageSourceProperty.setNative](value: ImageSource) {
		if (value !== this.imageSource) {
			this.disposeImageSource();
		}

		this._setNativeImage(value ? value.ios : null);
	}

	private _setSrc(value: string | ImageSource | ImageAsset) {
		this._createImageSourceFromSrc(value);
		if (this.iosSymbolScale) {
			// when applying symbol scale, contentMode must be center
			// https://stackoverflow.com/a/65787627
			this.nativeViewProtected.contentMode = UIViewContentMode.Center;
		}
	}

	[srcProperty.setNative](value: string | ImageSource | ImageAsset) {
		this._setSrc(value);
	}

	[iosSymbolEffectProperty.setNative](value: ImageSymbolEffect | ImageSymbolEffects) {
		if (SDK_VERSION < 17) {
			return;
		}
		const symbol = typeof value === 'string' ? ImageSymbolEffect.fromSymbol(value) : value;
		if (symbol?.effect) {
			// Note: https://developer.apple.com/documentation/symbols/symboleffectoptions/4197883-repeating
			// Will want to move to https://developer.apple.com/documentation/symbols/nssymboleffectoptionsrepeatbehavior?language=objc as fallback once optionsWithRepeating is removed
			this.nativeViewProtected.addSymbolEffectOptionsAnimatedCompletion(symbol.effect, symbol.options || NSSymbolEffectOptions.optionsWithRepeating(), true, symbol.completion || null);
		} else {
			this.nativeViewProtected.removeAllSymbolEffects();
		}
	}

	[iosSymbolScaleProperty.setNative](value: iosSymbolScaleType) {
		// reset src to configure scale
		this._setSrc(this.src);
	}
}
