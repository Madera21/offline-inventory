import React, { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureImageWithCamera, deleteImageFile, pickImageFromGallery, resolveImageUri } from '../services/image.service';
import { DEFAULT_IMAGE_FRAME, readImageFrame } from '../utils/imageFrame';
import { useTheme } from '../theme/ThemeProvider';
import { FramedProductImage } from './FramedProductImage';
import { ImageFrameEditor } from './ImageFrameEditor';
import { StoreButton } from './StoreForm';

export type ProductPhotoDraft = { relative_path: string; frame_json: string | null } | null;

export function ProductPhotoEditor({ value, onChange, onCreated, onBusyChange, disabled }: {
  value: ProductPhotoDraft;
  onChange: (value: ProductPhotoDraft) => void;
  onCreated: (path: string) => void;
  onBusyChange: (busy: boolean) => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [framing, setFraming] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const choose = async (camera: boolean) => {
    if (locked.current || disabled) return;
    locked.current = true; setBusy(true); onBusyChange(true);
    try {
      const path = await (camera ? captureImageWithCamera() : pickImageFromGallery());
      if (!path) return;
      if (!mounted.current) { await deleteImageFile(path); return; }
      onCreated(path);
      onChange({ relative_path: path, frame_json: JSON.stringify(DEFAULT_IMAGE_FRAME) });
    } catch (error: any) {
      if (mounted.current) Alert.alert('Photo not changed', error?.message || 'Please try another photo.');
    } finally {
      locked.current = false;
      if (mounted.current) { setBusy(false); onBusyChange(false); }
    }
  };
  const uri = resolveImageUri(value?.relative_path);
  return <View style={{ gap: 10, marginBottom: 22 }}>
    <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}>Product photo</Text>
    <View style={{ height: 220, backgroundColor: colors.soft, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <FramedProductImage uri={uri} frame={readImageFrame(value?.frame_json)} style={{ width: '100%', height: '100%' }} />
        : <Ionicons name="image-outline" size={48} color={colors.muted} />}
    </View>
    <Text style={{ color: colors.muted, fontSize: 13 }}>Photo changes are applied when you save the product.</Text>
    <StoreButton label={busy ? 'Opening photos…' : value ? 'Replace photo' : 'Choose photo'} disabled={disabled || busy} onPress={() => { void choose(false); }} />
    <StoreButton secondary label="Take photo" disabled={disabled || busy} onPress={() => { void choose(true); }} />
    {value && <View style={{ gap: 10 }}>
      <StoreButton secondary label="Adjust photo framing" disabled={disabled || busy} onPress={() => setFraming(true)} />
      <StoreButton secondary label="Remove photo" disabled={disabled || busy} onPress={() => onChange(null)} />
    </View>}
    {framing && uri && value && <ImageFrameEditor uri={uri} initialFrame={readImageFrame(value.frame_json)} onClose={() => setFraming(false)} onSave={frame => {
      onChange({ ...value, frame_json: JSON.stringify(frame) }); setFraming(false);
    }} />}
  </View>;
}
