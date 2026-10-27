import React from 'react';
import { Modal, ModalProps } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

/** Modal windows need their own keyboard layout, separate from the screen below. */
export function KeyboardModal({ children, ...props }: ModalProps) {
  return <Modal {...props}><KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>{children}</KeyboardAvoidingView></Modal>;
}
