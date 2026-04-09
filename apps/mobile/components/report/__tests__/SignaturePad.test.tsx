import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SignaturePad } from '@/components/report/SignaturePad';

const mockReadSignature = vi.fn();

vi.mock('react-native-signature-canvas', () => {
  const ReactLib = require('react');

  const MockSignatureCanvas = ReactLib.forwardRef(
    (
      {
        onEnd,
        onOK,
      }: {
        onEnd?: () => void;
        onOK?: (value: string) => void;
      },
      ref
    ) => {
      ReactLib.useImperativeHandle(ref, () => ({
        clearSignature: vi.fn(),
        readSignature: mockReadSignature.mockImplementation(() => {
          onOK?.('signed-data');
        }),
      }));

      return (
        <button data-testid="signature-canvas" onClick={() => onEnd?.()}>
          sign
        </button>
      );
    }
  );

  return {
    __esModule: true,
    default: MockSignatureCanvas,
  };
});

describe('SignaturePad', () => {
  const alertSpy = vi.spyOn(Alert, 'alert');

  beforeEach(() => {
    vi.clearAllMocks();
    alertSpy.mockImplementation(() => {});
  });

  it('saves signature on Save Signature press', async () => {
    const onClose = vi.fn();
    const onSign = vi.fn();
    const { getByText, getByTestId } = render(
      <SignaturePad isOpen={true} onClose={onClose} onSign={onSign} />
    );

    fireEvent.click(getByTestId('signature-canvas'));
    fireEvent.press(getByText('Save Signature'));

    await waitFor(() => {
      expect(mockReadSignature).toHaveBeenCalledTimes(1);
      expect(onSign).toHaveBeenCalledWith('signed-data');
      expect(alertSpy).toHaveBeenCalledWith(
        'Signature Saved',
        'Your signature has been saved.'
      );
    });
  });
});
