import { useTheme } from '../theme/ThemeProvider';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, PanResponder, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { FramedProductImage } from './FramedProductImage';
import { DEFAULT_IMAGE_FRAME, ImageFrame, imageFrameGeometry, normalizeImageFrame } from '../utils/imageFrame';

export function ImageFrameEditor({ uri, initialFrame, onSave, onClose }: {
  uri: string; initialFrame: ImageFrame; onSave: (frame: ImageFrame) => Promise<void> | void; onClose: () => void;
}) {
  const { colors } = useTheme();
  const size = Math.min(useWindowDimensions().width - 40, 360);
  const [frame, setFrame] = useState(initialFrame);
  const [saving, setSaving] = useState(false);
  const dimensions = useRef({ width: 1, height: 1 });
  const current = useRef(frame); current.current = frame;
  const start = useRef(frame);
  React.useEffect(() => { Image.getSize(uri, (width, height) => { dimensions.current = { width, height }; }); }, [uri]);
  const pan = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { start.current = current.current; },
    onPanResponderMove: (_, gesture) => {
      const g = imageFrameGeometry(dimensions.current.width, dimensions.current.height, size, start.current);
      setFrame(normalizeImageFrame({ ...start.current,
        x: start.current.x + (g.maxX ? gesture.dx / g.maxX : 0),
        y: start.current.y + (g.maxY ? gesture.dy / g.maxY : 0),
      }));
    },
  }), [size]);
  const button = (label: string, action: () => void) => <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={action} style={{ padding: 14 }}><Text style={{ color: colors.accent, fontWeight: '600' }}>{label}</Text></TouchableOpacity>;
  return <Modal visible animationType="slide" onRequestClose={() => { if (!saving) onClose(); }}>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.paper, padding: 20 }}>
      <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '500', marginBottom: 12 }}>Edit Framing</Text>
      <Text style={{ color: colors.muted, marginBottom: 16 }}>Zoom, then drag to choose the visible area.</Text>
      <View pointerEvents={saving ? 'none' : 'auto'} {...pan.panHandlers}>
        <FramedProductImage uri={uri} frame={frame} style={{ width: size, height: size, backgroundColor: colors.soft }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {button('Zoom Out', () => setFrame(normalizeImageFrame({ ...frame, zoom: frame.zoom - 0.25 })))}
        <Text style={{ color: colors.ink }}>{frame.zoom.toFixed(2)}×</Text>
        {button('Zoom In', () => setFrame(normalizeImageFrame({ ...frame, zoom: frame.zoom + 0.25 })))}
      </View>
      {button('Show Whole Image', () => setFrame(DEFAULT_IMAGE_FRAME))}
      <Text style={{ color: colors.muted, textAlign: 'center' }}>The full photo is kept. You can adjust this again later.</Text>
      <View style={{ flexDirection: 'row', marginTop: 16 }}>
        {button('Cancel', onClose)}
        {button('Save Framing', async () => {
          setSaving(true);
          try { await onSave(frame); onClose(); }
          catch { Alert.alert('Unable to Save', 'Your framing could not be saved. Please try again.'); }
          finally { setSaving(false); }
        })}
      </View>
      {saving && <ActivityIndicator color={colors.accent} />}
    </View>
  </Modal>;
}
