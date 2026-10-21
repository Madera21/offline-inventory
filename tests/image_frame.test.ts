import { DEFAULT_IMAGE_FRAME, imageFrameGeometry, normalizeImageFrame, readImageFrame } from '../src/utils/imageFrame';

describe('Non-destructive photo framing', () => {
  test('shows the whole portrait image without cropping by default', () => {
    expect(imageFrameGeometry(600, 1200, 300, DEFAULT_IMAGE_FRAME)).toEqual({
      width: 150, height: 300, left: 75, top: 0, maxX: 0, maxY: 0,
    });
  });

  test('shows the whole landscape image without cropping by default', () => {
    expect(imageFrameGeometry(1200, 600, 300, DEFAULT_IMAGE_FRAME)).toEqual({
      width: 300, height: 150, left: 0, top: 75, maxX: 0, maxY: 0,
    });
  });

  test('zoom and pan keep the visible area within the full image', () => {
    const geometry = imageFrameGeometry(1200, 600, 300, { zoom: 4, x: 1, y: -1 });
    expect(geometry.left).toBe(0);
    expect(geometry.top + geometry.height).toBe(300);
    expect(geometry.width).toBe(1200);
    expect(geometry.height).toBe(600);
  });

  test('saved framing survives serialization without changing the photo', () => {
    const frame = { zoom: 2.25, x: -0.5, y: 0.75 };
    expect(readImageFrame(JSON.stringify(frame))).toEqual(frame);
  });

  test('old backups and invalid framing fall back to the full photo', () => {
    for (const value of [undefined, null, 'null', 'invalid', '{}']) {
      expect(readImageFrame(value)).toEqual(DEFAULT_IMAGE_FRAME);
    }
    expect(normalizeImageFrame({ zoom: 100, x: -10, y: NaN })).toEqual({ zoom: 4, x: -1, y: 0 });
  });
});
