import { useCallback, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useServerAvailability } from '@/lib/hooks/use-server-availability';

export function ServerUnavailableBanner() {
  const { apiBaseUrl, isAvailable, isChecking, checkedAt } = useServerAvailability();
  const insets = useSafeAreaInsets();
  const [bannerHeight, setBannerHeight] = useState(0);

  if (isChecking || isAvailable !== false) {
    return null;
  }

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setBannerHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
  }, []);

  const checkedAtLabel = checkedAt
    ? new Date(checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'just now';

  return (
    <>
      <View style={{ height: bannerHeight }} />
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          elevation: 1000,
        }}
      >
        <View
          onLayout={handleLayout}
          style={{
            borderBottomWidth: 1,
            borderBottomColor: '#f59e0b',
            backgroundColor: '#fffbeb',
            paddingTop: insets.top + 12,
            paddingHorizontal: 16,
            paddingBottom: 12,
            shadowColor: '#000000',
            shadowOpacity: 0.08,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Text style={{ color: '#92400e', fontSize: 13, fontWeight: '700' }}>
            Web server is not running or is unreachable from the mobile app.
          </Text>
          <Text style={{ color: '#92400e', fontSize: 12, marginTop: 4 }}>
            Check `pnpm --filter field-service-web dev`, port 3000, and `adb reverse tcp:3000 tcp:3000`.
          </Text>
          <Text style={{ color: '#b45309', fontSize: 11, marginTop: 4 }}>
            {apiBaseUrl} • last checked at {checkedAtLabel}
          </Text>
        </View>
      </View>
    </>
  );
}

