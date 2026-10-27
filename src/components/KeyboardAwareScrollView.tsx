import React from 'react';
import { ScrollView, ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView as AwareScrollView } from 'react-native-keyboard-controller';

/** One keyboard-aware scroller owns focus movement for each form. */
export function KeyboardAwareScrollView(props: ScrollViewProps) {
  if (props.horizontal) return <ScrollView {...props} />;
  return <AwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" {...props} />;
}
