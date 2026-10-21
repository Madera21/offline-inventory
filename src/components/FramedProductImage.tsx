import React, { useEffect, useState } from 'react';
import { Image, View, StyleProp, ViewStyle } from 'react-native';
import { DEFAULT_IMAGE_FRAME, ImageFrame, imageFrameGeometry } from '../utils/imageFrame';

export function FramedProductImage({ uri, frame = DEFAULT_IMAGE_FRAME, style }: {
  uri: string; frame?: ImageFrame; style?: StyleProp<ViewStyle>;
}) {
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    let active = true;
    Image.getSize(uri, (width, height) => { if (active) setDimensions({ width, height }); });
    return () => { active = false; };
  }, [uri]);
  const size = Math.min(box.width, box.height);
  const geometry = imageFrameGeometry(dimensions.width, dimensions.height, size, frame);
  return <View style={[style, { overflow: 'hidden' }]} onLayout={({ nativeEvent }) => setBox(nativeEvent.layout)}>
    <View style={{ width: size, height: size, overflow: 'hidden', position: 'absolute', left: (box.width - size) / 2, top: (box.height - size) / 2 }}>
      <Image source={{ uri }} style={{ position: 'absolute', width: geometry.width, height: geometry.height, left: geometry.left, top: geometry.top }} />
    </View>
  </View>;
}
