package org.nativescript.widgets.text;

import android.content.Context;
import android.graphics.Typeface;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.AbsoluteSizeSpan;
import android.text.style.BackgroundColorSpan;
import android.text.style.ForegroundColorSpan;
import android.text.style.StrikethroughSpan;
import android.text.style.UnderlineSpan;
import android.util.TypedValue;

public class TextUtils {
	public static final int BASELINE_ADJUSTED_SPAN = 10001;
	public static final int CUSTOM_TYPEFACE_SPAN = 10002;

	public static void applySpanModifiers(Context context, SpannableStringBuilder ssb, int start, int end, Typeface typeface, int textSizeSp, int baseTextSizeSp, int textColor,
																				int backgroundColor, String textDecoration, String verticalAlignment, CustomClickableSpan.ClickListener clickListener) {
		if (context == null) {
			return;
		}

		ssb.setSpan(new CustomTypefaceSpan(typeface), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);

		if (textSizeSp > -1) {
			int pxSize = (int)TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, textSizeSp, context.getResources().getDisplayMetrics());
			ssb.setSpan(new AbsoluteSizeSpan(pxSize), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
		}

		if (textColor > 0) {
			ssb.setSpan(new ForegroundColorSpan(textColor), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
		}

		if (backgroundColor > 0) {
			ssb.setSpan(new BackgroundColorSpan(backgroundColor), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
		}

		if (textDecoration != null && !textDecoration.isEmpty()) {
			// A text can have multiple decorations
			if (textDecoration.contains("underline")) {
				ssb.setSpan(new UnderlineSpan(), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
			}
			if (textDecoration.contains("line-through")) {
				ssb.setSpan(new StrikethroughSpan(), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
			}
		}

		if (verticalAlignment != null && !verticalAlignment.isEmpty()) {
			int pxSize = (int)TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, baseTextSizeSp, context.getResources().getDisplayMetrics());
			ssb.setSpan(new BaselineAdjustedSpan(verticalAlignment, pxSize), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
		}

		if (clickListener != null) {
			ssb.setSpan(new CustomClickableSpan(clickListener), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
		}
	}
}
