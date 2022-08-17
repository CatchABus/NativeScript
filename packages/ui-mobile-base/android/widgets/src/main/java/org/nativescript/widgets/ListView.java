package org.nativescript.widgets;

import android.content.Context;
import android.view.MotionEvent;

/**
 * @author CatchABus
 */
public class ListView extends android.widget.ListView implements Scrollable {

	private boolean scrollEnabled = true;

	public ListView(Context context) {
		super(context);
	}

	public boolean getScrollEnabled() {
		return this.scrollEnabled;
	}

	public void setScrollEnabled(boolean value) {
		this.scrollEnabled = value;
	}

	@Override
	public boolean onInterceptTouchEvent(MotionEvent ev) {
		// Do nothing with intercepted move event if view is not scrollable
		if (!this.scrollEnabled && ev.getAction() == MotionEvent.ACTION_MOVE) {
			return false;
		}

		return super.onInterceptTouchEvent(ev);
	}

	@Override
	public boolean onTouchEvent(MotionEvent ev) {
		if (!this.scrollEnabled && ev.getAction() == MotionEvent.ACTION_MOVE) {
			return false;
		}

		return super.onTouchEvent(ev);
	}
}
