/**
 * Image annotation box geometry.
 *
 * x/y is the anchor point. Width and height grow from that point according to
 * the horizontal and vertical anchors. Corner resize keeps the opposite corner
 * fixed, including when the box is rotated.
 */

export type ImageCorner = 'nw' | 'ne' | 'sw' | 'se';

export type ImagePoint = { x: number; y: number };

export type ImageBox = {
	x: number;
	y: number;
	width: number;
	height: number;
};

const MIN_IMAGE_SIZE = 1;

const OPPOSITE_CORNER: Record<ImageCorner, ImageCorner> = {
	nw: 'se',
	ne: 'sw',
	sw: 'ne',
	se: 'nw',
};

const anchorOffset = (size: number, anchor?: string): number => {
	if (anchor === 'middle') return -size / 2;
	if (anchor === 'end') return -size;
	return 0;
};

/**
 * Top-left corner of an image annotation relative to its x/y point.
 * Horizontal: start = left edge, middle = center, end = right edge.
 * Vertical: start = top edge, middle = center, end = bottom edge.
 */
export const getImageAnnotationOffset = (
	width: number,
	height: number,
	textAnchor?: string,
	verticalAnchor?: string
): ImagePoint => ({
	x: anchorOffset(width, textAnchor),
	y: anchorOffset(height, verticalAnchor),
});

/** SVG rotate() is clockwise in y-down user space. */
export const rotatePoint = (point: ImagePoint, degrees: number): ImagePoint => {
	const radians = (degrees * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	return {
		x: point.x * cos - point.y * sin,
		y: point.x * sin + point.y * cos,
	};
};

const cornerLocal = (corner: ImageCorner, offset: ImagePoint, width: number, height: number): ImagePoint => {
	const onRight = corner === 'ne' || corner === 'se';
	const onBottom = corner === 'sw' || corner === 'se';
	return {
		x: offset.x + (onRight ? width : 0),
		y: offset.y + (onBottom ? height : 0),
	};
};

const fitSize = (
	nextWidth: number,
	nextHeight: number,
	ratio: number,
	lockAspect: boolean
): { width: number; height: number } => {
	let width = nextWidth;
	let height = nextHeight;
	if (lockAspect && ratio > 0) {
		if (!(width > 0) || !(height > 0)) {
			width = MIN_IMAGE_SIZE;
			height = MIN_IMAGE_SIZE;
		} else if (width / ratio >= height) {
			height = width / ratio;
		} else {
			width = height * ratio;
		}
		if (width < MIN_IMAGE_SIZE) {
			width = MIN_IMAGE_SIZE;
			height = width / ratio;
		}
		if (height < MIN_IMAGE_SIZE) {
			height = MIN_IMAGE_SIZE;
			width = height * ratio;
		}
	}
	return {
		width: Math.max(MIN_IMAGE_SIZE, width),
		height: Math.max(MIN_IMAGE_SIZE, height),
	};
};

export type ResizeImageByCornerInput = {
	x: number;
	y: number;
	width: number;
	height: number;
	textAnchor?: string;
	verticalAnchor?: string;
	rotation?: number;
	corner: ImageCorner;
	pointerX: number;
	pointerY: number;
	/** Default true. False changes width and height independently. */
	keepAspectRatio?: boolean;
};

/**
 * New box after dragging one corner to a pointer position.
 * Coordinates are in one space (the rendered annotation space).
 * The corner opposite `corner` stays in place.
 */
export const resizeImageByCorner = ({
	x,
	y,
	width,
	height,
	textAnchor,
	verticalAnchor,
	rotation = 0,
	corner,
	pointerX,
	pointerY,
	keepAspectRatio = true,
}: ResizeImageByCornerInput): ImageBox => {
	const safeWidth = width > 0 ? width : MIN_IMAGE_SIZE;
	const safeHeight = height > 0 ? height : MIN_IMAGE_SIZE;
	const offset = getImageAnnotationOffset(safeWidth, safeHeight, textAnchor, verticalAnchor);
	const fixedCorner = OPPOSITE_CORNER[corner];
	const fixedLocal = cornerLocal(fixedCorner, offset, safeWidth, safeHeight);
	const fixedRotated = rotatePoint(fixedLocal, rotation);
	const fixedParent = { x: x + fixedRotated.x, y: y + fixedRotated.y };
	const pointerLocal = rotatePoint({ x: pointerX - fixedParent.x, y: pointerY - fixedParent.y }, -rotation);

	const signX = corner === 'ne' || corner === 'se' ? 1 : -1;
	const signY = corner === 'sw' || corner === 'se' ? 1 : -1;
	const ratio = safeWidth / safeHeight;
	const fitted = fitSize(signX * pointerLocal.x, signY * pointerLocal.y, ratio, keepAspectRatio !== false);

	const nextOffset = getImageAnnotationOffset(fitted.width, fitted.height, textAnchor, verticalAnchor);
	const nextFixedLocal = cornerLocal(fixedCorner, nextOffset, fitted.width, fitted.height);
	const nextFixedRotated = rotatePoint(nextFixedLocal, rotation);
	return {
		x: fixedParent.x - nextFixedRotated.x,
		y: fixedParent.y - nextFixedRotated.y,
		width: fitted.width,
		height: fitted.height,
	};
};
