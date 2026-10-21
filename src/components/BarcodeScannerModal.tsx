import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
  continuous?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScan,
  title = 'Scan Barcode',
  continuous = false,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanned && !continuous) return;

    const data = result.data?.trim();
    if (!data) return;

    setScanned(true);
    onScan(data);

    if (continuous) {
      // Re-enable scanning after 1.5 seconds in continuous mode
      setTimeout(() => {
        setScanned(false);
      }, 1500);
    } else {
      // Reset and close
      setTimeout(() => {
        setScanned(false);
        onClose();
      }, 300);
    }
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (code) {
      onScan(code);
      setManualCode('');
      setManualMode(false);
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

        {/* Top Header Controls */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setTorch((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={torch ? 'flashlight' : 'flashlight-outline'}
              size={24}
              color={torch ? '#FBBF24' : '#FFFFFF'}
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>{title}</Text>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Camera or Permission Content */}
        {!permission?.granted ? (
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color="#94A3B8" />
            <Text style={styles.permissionTitle}>Camera Access Needed</Text>
            <Text style={styles.permissionText}>
              Offline Barcode Scanning requires camera permission to detect barcodes and QR codes.
            </Text>
            <TouchableOpacity
              style={styles.grantButton}
              onPress={requestPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.grantButtonText}>Grant Camera Permission</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'qr',
                  'ean13',
                  'ean8',
                  'code128',
                  'code39',
                  'upc_a',
                  'upc_e',
                  'itf14',
                  'codabar',
                ],
              }}
              onBarcodeScanned={scanned && !continuous ? undefined : handleBarcodeScanned}
            />

            {/* Viewfinder Target Overlay */}
            <View style={styles.overlay}>
              <View style={styles.unfocusedContainer} />
              <View style={styles.middleRow}>
                <View style={styles.unfocusedContainer} />
                <View style={styles.focusedTarget}>
                  {/* Target Corners */}
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                  {/* Laser Line */}
                  <View style={styles.laserLine} />
                </View>
                <View style={styles.unfocusedContainer} />
              </View>
              <View style={styles.unfocusedContainer}>
                <Text style={styles.hintText}>Align barcode inside frame to scan</Text>
              </View>
            </View>
          </View>
        )}

        {/* Bottom Actions: Manual Barcode Input Fallback */}
        <View style={styles.bottomBar}>
          {manualMode ? (
            <View style={styles.manualInputRow}>
              <TextInput
                style={styles.manualInput}
                placeholder="Enter barcode or SKU..."
                placeholderTextColor="#94A3B8"
                value={manualCode}
                onChangeText={setManualCode}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleManualSubmit}
              />
              <TouchableOpacity
                style={styles.manualSubmitButton}
                onPress={handleManualSubmit}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manualCancelButton}
                onPress={() => setManualMode(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.manualModeButton}
              onPress={() => setManualMode(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="keypad-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.manualModeText}>Type Barcode Manually</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
    zIndex: 10,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  unfocusedContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  middleRow: {
    flexDirection: 'row',
    height: 240,
  },
  focusedTarget: {
    width: 280,
    height: 240,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#38BDF8',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 6,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 6,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 6,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 6,
  },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  hintText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#0F172A',
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  grantButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  grantButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomBar: {
    padding: 16,
    backgroundColor: '#0F172A',
    zIndex: 10,
  },
  manualModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 12,
    borderRadius: 10,
  },
  manualModeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manualInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  manualSubmitButton: {
    backgroundColor: '#0284C7',
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  manualCancelButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
});
