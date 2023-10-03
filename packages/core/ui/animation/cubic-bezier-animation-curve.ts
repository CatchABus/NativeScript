export class CubicBezierAnimationCurve {
	public x1: number;
	public y1: number;
	public x2: number;
	public y2: number;

	constructor(x1: number, y1: number, x2: number, y2: number) {
		this.x1 = x1;
		this.y1 = y1;
		this.x2 = x2;
		this.y2 = y2;
	}

	public equals(value: CubicBezierAnimationCurve): boolean {
		return this.x1 === value.x1 && this.x2 === value.x2 && this.y1 === value.y1 && this.y2 === value.y2;
	}
}
