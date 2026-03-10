declare module 'agora-rtc-sdk-ng' {
  const AgoraRTC: {
    createClient(config: { mode: string; codec: string }): any;
    createMicrophoneAudioTrack(): Promise<any>;
  };
  export default AgoraRTC;
}
