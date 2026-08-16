import { Text, View } from 'react-native';

/**
 * react-native-pdf is native-only, so the web bundle aliases it here (see
 * metro.config.js). Web is used for previewing layout during development;
 * the real viewer runs on device.
 */
export default function PdfWebFallback({ style }: { style?: unknown }) {
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', padding: 24 }, style as never]}>
      <Text style={{ textAlign: 'center', color: '#5A6172' }}>
        PDF preview is available in the Mentra mobile app.
      </Text>
    </View>
  );
}
