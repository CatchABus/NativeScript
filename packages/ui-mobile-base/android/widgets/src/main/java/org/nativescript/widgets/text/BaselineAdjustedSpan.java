package org.nativescript.widgets.text;

import android.graphics.Paint.FontMetrics;
import android.os.Parcel;
import android.text.ParcelableSpan;
import android.text.TextPaint;
import android.text.style.MetricAffectingSpan;

import androidx.annotation.NonNull;

public class BaselineAdjustedSpan extends MetricAffectingSpan implements ParcelableSpan {
	private final String mVerticalAlignment;
	private final int mTextSize;

	public BaselineAdjustedSpan(String verticalAlignment, int textSize) {
		super();

		this.mVerticalAlignment = verticalAlignment;
		this.mTextSize = textSize;
	}

	@Override
	public int getSpanTypeId() {
		return TextUtils.BASELINE_ADJUSTED_SPAN;
	}

	@Override
	public int describeContents() {
		return 0;
	}

	@Override
	public void writeToParcel(Parcel dest, int i) {
		dest.writeString(this.mVerticalAlignment);
		dest.writeInt(this.mTextSize);
	}

	@Override
	public void updateMeasureState(@NonNull TextPaint textPaint) {
		this._updateState(textPaint);
	}

	@Override
	public void updateDrawState(TextPaint textPaint) {
		this._updateState(textPaint);
	}

	private void _updateState(TextPaint textPaint) {
		FontMetrics metrics = textPaint.getFontMetrics();

		if (this.mVerticalAlignment == null || this.mVerticalAlignment.isEmpty()) {
			return;
		}

		float baselineShift;

		switch (this.mVerticalAlignment) {
			case "top":
				baselineShift = -this.mTextSize - metrics.bottom - metrics.top;
				break;
			case "bottom":
				baselineShift = metrics.bottom;
				break;
			case "text-top":
				baselineShift = -this.mTextSize - metrics.descent - metrics.ascent;
				break;
			case "text-bottom":
				baselineShift = metrics.bottom - metrics.descent;
				break;
			case "middle":
				baselineShift = (metrics.descent - metrics.ascent) / 2 - metrics.descent;
				break;
			case "sup":
				baselineShift = (int) (-this.mTextSize * 0.4);
				break;
			case "sub":
				baselineShift = (int) ((metrics.descent - metrics.ascent) * 0.4);
				break;
			default:
				baselineShift = textPaint.baselineShift;
				break;
		}

		if (textPaint.baselineShift != baselineShift) {
			textPaint.baselineShift = (int)baselineShift;
		}
	}
}
