import React, { useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, Alert } from 'react-native';
import SignatureCanvas, {
  type SignatureViewRef,
} from 'react-native-signature-canvas';

interface SignaturePadProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSign: (signatureData: string) => void;
}

export function SignaturePad({ isOpen, onClose, onSign }: SignaturePadProps) {
  const signatureRef = useRef<SignatureViewRef | null>(null);
  const [isSigned, setIsSigned] = React.useState(false);

  const handleClear = () => {
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
      setIsSigned(false);
    }
  };

  const handleOK = (signatureData: string) => {
    setIsSigned(true);
    onSign(signatureData);
    Alert.alert('Signature Saved', 'Your signature has been saved.');
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible={isOpen}
    >
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between border-b border-gray-200 px-4 py-3">
          <TouchableOpacity className="p-2" onPress={onClose}>
            <Text className="text-2xl text-gray-500">✕</Text>
          </TouchableOpacity>
          <Text className="text-xl font-semibold text-gray-800">
            Customer Signature
          </Text>
          <TouchableOpacity className="p-2" onPress={handleClear}>
            <Text className="text-sm font-semibold text-red-500">Clear</Text>
          </TouchableOpacity>
        </View>

        <View className="m-4 flex-1 overflow-hidden rounded-lg bg-gray-100">
          <SignatureCanvas
            autoClear={false}
            onEnd={() => setIsSigned(true)}
            onOK={handleOK}
            ref={signatureRef}
            // eslint-disable-next-line react-native/no-color-literals, react-native/no-inline-styles
            style={{ flex: 1, backgroundColor: 'white' }}
          />
        </View>

        <View className="border-t border-gray-200 px-4 py-4">
          <TouchableOpacity
            className={`items-center rounded-lg py-4 ${isSigned ? 'bg-blue-800' : 'bg-gray-300'}`}
            disabled={!isSigned}
            onPress={() => signatureRef.current?.readSignature()}
          >
            <Text className="text-base font-semibold text-white">
              Save Signature
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
