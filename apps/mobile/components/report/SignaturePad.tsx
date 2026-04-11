import React, { useRef } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import SignatureCanvas, {
  type SignatureViewRef,
} from 'react-native-signature-canvas';

interface SignaturePadProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSign: (signatureData: string) => void;
}

const signatureCanvasWebStyle = `
  .m-signature-pad {
    box-shadow: none;
    border: none;
  }

  .m-signature-pad--body {
    border: none;
  }

  .m-signature-pad--body canvas {
    border-radius: 16px;
    box-shadow: none;
  }

  .m-signature-pad--footer {
    display: none;
    margin: 0;
    height: 0;
    padding: 0;
  }

  body,
  html {
    width: 100%;
    height: 100%;
    background: #f9fafb;
  }
`;

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
    onSign(signatureData);
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
          <View className="w-10" />
        </View>

        <View className="px-4 pb-4 pt-5">
          <Text className="text-sm text-gray-500">
            Sign in the box below, then save it to the report.
          </Text>
        </View>

        <View className="mx-4 mb-4 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
          <SignatureCanvas
            autoClear={false}
            onEnd={() => setIsSigned(true)}
            onOK={handleOK}
            onClear={() => setIsSigned(false)}
            webStyle={signatureCanvasWebStyle}
            ref={signatureRef}
            // eslint-disable-next-line react-native/no-color-literals, react-native/no-inline-styles
            style={{ flex: 1, backgroundColor: 'white' }}
          />
        </View>

        <View className="flex-row border-t border-gray-200 px-4 py-4">
          <TouchableOpacity
            className={`mr-3 flex-1 items-center rounded-xl border py-4 ${isSigned ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-100'}`}
            disabled={!isSigned}
            onPress={handleClear}
          >
            <Text
              className={`text-base font-semibold ${isSigned ? 'text-gray-700' : 'text-gray-400'}`}
            >
              Clear
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 items-center rounded-xl py-4 ${isSigned ? 'bg-blue-800' : 'bg-gray-300'}`}
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
