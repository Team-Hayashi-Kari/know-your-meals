import { Ionicons } from '@expo/vector-icons';
import { type CameraType, CameraView, type FlashMode, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable } from 'react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { PrimaryButton } from '../../components/post-flow/PrimaryButton';
import { setDraftImage } from '../../lib/postDraft';

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);

  const handleCancel = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [busy, setBusy] = useState(false);

  const goToStoreSearch = async (uri: string) => {
    const blob = await uriToBlob(uri);
    setDraftImage(blob, uri);
    router.push('/post/store-search');
  };

  const handleCapture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) await goToStoreSearch(photo.uri);
    } finally {
      setBusy(false);
    }
  };

  const handlePickLibrary = async () => {
    if (busy) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    try {
      await goToStoreSearch(result.assets[0].uri);
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return (
      <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center">
        <Spinner color="#fff" />
      </YStack>
    );
  }

  if (!permission.granted) {
    return (
      <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center" gap="$4" padding="$6">
        <Text color="#fff" fontSize={16} textAlign="center">
          料理を撮影するにはカメラへのアクセスを許可してください
        </Text>
        <PrimaryButton label="カメラを許可する" onPress={requestPermission} />
      </YStack>
    );
  }

  return (
    <CameraView ref={cameraRef} style={{ flex: 1, backgroundColor: '#000' }} facing={facing} flash={flash}>
      <YStack flex={1} zIndex={1}>
        <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$5" paddingTop="$5">
          <Pressable onPress={handleCancel} hitSlop={12} accessibilityRole="button" accessibilityLabel="キャンセル">
            <YStack width={38} height={38} borderRadius={19} backgroundColor="rgba(0,0,0,0.4)" justifyContent="center" alignItems="center">
              <Text color="#fff" fontSize={20}>
                ✕
              </Text>
            </YStack>
          </Pressable>
          <YStack paddingHorizontal="$3" paddingVertical="$2" borderRadius={20} backgroundColor="rgba(0,0,0,0.4)">
            <Text color="#fff" fontSize={14} fontWeight="600">
              料理を撮ろう
            </Text>
          </YStack>
          <Pressable
            onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="フラッシュ切替"
          >
            <YStack
              width={38}
              height={38}
              borderRadius={19}
              backgroundColor={flash === 'on' ? '#fff' : 'rgba(0,0,0,0.4)'}
              justifyContent="center"
              alignItems="center"
            >
              <Text fontSize={18}>⚡</Text>
            </YStack>
          </Pressable>
        </XStack>

        <YStack flex={1} />

        <YStack>
          <YStack alignItems="center" paddingBottom="$3">
            <XStack alignItems="center" gap="$2">
              <Text color="#fff" fontSize={13} fontWeight="700">
                撮影
              </Text>
              <Text color="#666" fontSize={13}>
                ・
              </Text>
              <Pressable onPress={handlePickLibrary} accessibilityRole="button" accessibilityLabel="ライブラリから選ぶ">
                <Text color="#fff" fontSize={13} fontWeight="700">
                  ライブラリ
                </Text>
              </Pressable>
            </XStack>
          </YStack>

          <XStack justifyContent="space-between" alignItems="center" paddingHorizontal={40} paddingBottom={44}>
            <Pressable onPress={handlePickLibrary} accessibilityRole="button" accessibilityLabel="ライブラリを開く">
              <YStack width={48} height={48} borderRadius={12} borderWidth={1} borderColor="#333" backgroundColor="#111" />
            </Pressable>
            <Pressable onPress={handleCapture} disabled={busy} accessibilityRole="button" accessibilityLabel="シャッター">
              <YStack
                width={74}
                height={74}
                borderRadius={37}
                borderWidth={4}
                borderColor="rgba(255,255,255,0.35)"
                justifyContent="center"
                alignItems="center"
                opacity={busy ? 0.6 : 1}
              >
                <YStack width={58} height={58} borderRadius={29} backgroundColor="#fff" />
              </YStack>
            </Pressable>
            <Pressable onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} accessibilityRole="button" accessibilityLabel="カメラ反転">
              <YStack width={48} height={48} borderRadius={24} backgroundColor="rgba(0,0,0,0.4)" justifyContent="center" alignItems="center">
                <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
              </YStack>
            </Pressable>
          </XStack>
        </YStack>
      </YStack>
    </CameraView>
  );
}
