package org.nativescript.widgets.text;

import android.text.TextPaint;
import android.text.style.ClickableSpan;
import android.view.View;

import androidx.annotation.NonNull;

public class CustomClickableSpan extends ClickableSpan {
	public interface ClickListener {
		void onClick(View view);
	}

	private final ClickListener mClickListener;

	public CustomClickableSpan(ClickListener listener) {
		super();

		this.mClickListener = listener;
	}

	@Override
	public void updateDrawState(TextPaint textPaint) {
		// don't style as link
	}

	@Override
	public void onClick(@NonNull View view) {
		if (this.mClickListener != null) {
			this.mClickListener.onClick(view);
		}

		view.clearFocus();
		view.invalidate();
	}
}
