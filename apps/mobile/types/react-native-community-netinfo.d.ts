declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    details: Record<string, unknown> | null;
  }

  const NetInfo: {
    fetch(): Promise<NetInfoState>;
    addEventListener(listener: (state: NetInfoState) => void): () => void;
  };

  export default NetInfo;
}
