import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  StatusBar,
  Animated,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
  enableContinuousToggle?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScan,
  title = 'Scan Barcode',
  enableContinuousToggle = true,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [lastScannedFeedback, setLastScannedFeedback] = useState<string | null>(null);

  // Synchronous lock refs to prevent 60fps callback spamming
  const isLocked = useRef(false);
  const lastScannedCode = useRef<string | null>(null);
  const lastScanTime = useRef<number>(0);

  // Reset locks whenever modal becomes visible
  useEffect(() => {
    if (visible) {
      isLocked.current = false;
      lastScannedCode.current = null;
      lastScanTime.current = 0;
      setLastScannedFeedback(null);
      setManualMode(false);
    }
  }, [visible]);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    const rawData = result.data?.trim();
    if (!rawData) return;

    const now = Date.now();

    // 1. Strict synchronous lock: if locked, reject immediately
    if (isLocked.current) {
      return;
    }

    // 2. Cooldown check:
    // If continuous mode, prevent rescanning the SAME barcode within 2.5s, or ANY code within 1.2s
    if (continuous) {
      if (rawData === lastScannedCode.current && now - lastScanTime.current < 2500) {
        return;
      }
      if (now - lastScanTime.current < 1200) {
        return;
      }
    }

    // 3. Lock immediately
    isLocked.current = true;
    lastScannedCode.current = rawData;
    lastScanTime.current = now;

    // Show on-screen feedback badge inside camera
    setLastScannedFeedback(rawData);

    // Trigger parent callback
    Vibration.vibrate(40);
    onScan(rawData);

    if (continuous) {
      // Re-enable scanning after 1.8 seconds in continuous mode
      setTimeout(() => {
        isLocked.current = false;
        setLastScannedFeedback(null);
      }, 1800);
    } else {
      // Single scan mode: close modal after brief visual confirmation (250ms)
      setTimeout(() => {
        isLocked.current = false;
        onClose();
      }, 250);
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
        <StatusBar barStyle="light-content" />

        {/* Top Header Controls */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setTorch((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={torch ? 'flashlight' : 'flashlight-outline'}
              size={22}
              color={torch ? '#FBBF24' : '#FFFFFF'}
            />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Secondary Subheader Toolbar for Continuous Toggle */}
        {enableContinuousToggle && (
          <View style={styles.subToolbar}>
            <TouchableOpacity
              style={[styles.togglePill, continuous && styles.togglePillActive]}
              onPress={() => setContinuous((prev) => !prev)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={continuous ? 'repeat' : 'scan-outline'}
                size={16}
                color={continuous ? '#FFFFFF' : '#BDB1A0'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.togglePillText, continuous && styles.togglePillTextActive]}>
                {continuous ? 'Continuous Scanning: ON' : 'Single Scan Mode'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Camera or Permission Content */}
        {!permission?.granted ? (
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color="#BDB1A0" />
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
              onBarcodeScanned={isLocked.current ? undefined : handleBarcodeScanned}
            />

            {/* Viewfinder Target Overlay */}
            <View style={styles.overlay}>
              <View style={styles.unfocusedContainer} />
              <View style={styles.middleRow}>
                <View style={styles.unfocusedContainer} />
                <View style={styles.focusedTarget}>
                  {/* Target Corners */}
                  <View style={[styles.corner, styles.topLeft, lastScannedFeedback && styles.cornerSuccess]} />
                  <View style={[styles.corner, styles.topRight, lastScannedFeedback && styles.cornerSuccess]} />
                  <View style={[styles.corner, styles.bottomLeft, lastScannedFeedback && styles.cornerSuccess]} />
                  <View style={[styles.corner, styles.bottomRight, lastScannedFeedback && styles.cornerSuccess]} />
                  {/* Laser Line */}
                  <View style={[styles.laserLine, lastScannedFeedback && styles.laserLineSuccess]} />
                </View>
                <View style={styles.unfocusedContainer} />
              </View>
              <View style={styles.unfocusedContainer}>
                {lastScannedFeedback ? (
                  <View style={styles.scannedBadge}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={styles.scannedBadgeText}>Scanned: {lastScannedFeedback}</Text>
                  </View>
                ) : (
                  <Text style={styles.hintText}>Align barcode inside frame to scan</Text>
                )}
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
                placeholderTextColor="#BDB1A0"
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
                <Ionicons name="close" size={20} color="#BDB1A0" />
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
    paddingVertical: 10,
    backgroundColor: '#231E1A',
    zIndex: 10,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  subToolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#302923',
    borderBottomWidth: 1,
    borderBottomColor: '#51463A',
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#756F63',
  },
  togglePillActive: {
    backgroundColor: '#A34E35',
    borderColor: '#E5A080',
  },
  togglePillText: {
    color: '#BDB1A0',
    fontSize: 13,
    fontWeight: '600',
  },
  togglePillTextActive: {
    color: '#FFFFFF',
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
    height: 220,
  },
  focusedTarget: {
    width: 280,
    height: 220,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#E5A080',
  },
  cornerSuccess: {
    borderColor: '#10B981',
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
  },
  laserLineSuccess: {
    backgroundColor: '#10B981',
    height: 3,
  },
  hintText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  scannedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#10B981',
    marginTop: 16,
  },
  scannedBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#231E1A',
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    color: '#BDB1A0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  grantButton: {
    backgroundColor: '#A34E35',
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
    backgroundColor: '#231E1A',
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
    backgroundColor: '#302923',
    color: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#51463A',
  },
  manualSubmitButton: {
    backgroundColor: '#A34E35',
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
    backgroundColor: '#302923',
  },
});
