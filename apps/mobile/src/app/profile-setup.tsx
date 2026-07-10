import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image as RNImage } from 'react-native';
import { Button, Input, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';
import { updateMe } from '../lib/mock-api';

export default function ProfileSetupScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState<string | null>(null);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      await updateMe({ name, handle, bio, image });
      router.replace('/find-friends');
    } catch (e) {
      console.error('[プロフィール保存エラー]', e);
      setSaving(false);
    }
  };

  return (
    <ScrollView
      flex={1}
      backgroundColor="#000"
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 64,
        paddingBottom: 32,
      }}
    >
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$6">
        <Text color="#555" fontSize={13} fontWeight="600">
          ステップ 1 / 2
        </Text>
        <Text color="#555" fontSize={13} fontWeight="600" onPress={() => router.replace('/home')}>
          スキップ
        </Text>
      </XStack>

      <Text color="#fff" fontSize={32} fontWeight="800" lineHeight={38} marginBottom="$6">
        プロフィールを{'\n'}設定しよう
      </Text>

      <YStack alignItems="center" marginBottom="$8">
        <YStack width={96} height={96} position="relative" onPress={handlePickImage} pressStyle={{ opacity: 0.8 }}>
          <YStack
            width={96}
            height={96}
            borderRadius={48}
            backgroundColor={image ? '#1a1a1a' : getColorFromName(name)}
            justifyContent="center"
            alignItems="center"
            overflow="hidden"
          >
            {image ? (
              <RNImage source={{ uri: image }} style={{ width: 96, height: 96 }} resizeMode="cover" />
            ) : (
              <Text color="#fff" fontSize={40} fontWeight="700">
                {getInitial(name)}
              </Text>
            )}
          </YStack>

          <YStack
            position="absolute"
            bottom={0}
            right={0}
            width={30}
            height={30}
            borderRadius={15}
            backgroundColor="#ffd400"
            justifyContent="center"
            alignItems="center"
            borderWidth={3}
            borderColor="#000"
          >
            <Text color="#000" fontSize={16} fontWeight="700" lineHeight={16}>
              +
            </Text>
          </YStack>
        </YStack>
      </YStack>

      <YStack gap="$2" marginBottom="$4">
        <Text color="#555" fontSize={14} fontWeight="600">
          名前
        </Text>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="田中 ゆき"
          placeholderTextColor="$gray9"
          backgroundColor="#1a1a1a"
          borderWidth={0}
          color="#fff"
          height={52}
          fontSize={16}
          borderRadius="$4"
        />
      </YStack>

      <YStack gap="$2" marginBottom="$4">
        <Text color="#555" fontSize={14} fontWeight="600">
          ユーザーID
        </Text>
        <Input
          value={handle}
          onChangeText={setHandle}
          placeholder="@yuki_eats"
          placeholderTextColor="$gray9"
          backgroundColor="#1a1a1a"
          borderWidth={0}
          color="#fff"
          height={52}
          fontSize={16}
          borderRadius="$4"
          autoCapitalize="none"
        />
      </YStack>

      <YStack gap="$2" marginBottom="$6">
        <Text color="#555" fontSize={14} fontWeight="600">
          自己紹介
        </Text>
        <Input
          value={bio}
          onChangeText={setBio}
          placeholder="ラーメンとカフェ巡りが好き。週末は新店開拓。"
          placeholderTextColor="$gray9"
          backgroundColor="#1a1a1a"
          borderWidth={0}
          color="#fff"
          height={100}
          fontSize={16}
          borderRadius="$4"
          multiline
          textAlignVertical="top"
          paddingTop="$3"
        />
      </YStack>

      <Button
        onPress={handleNext}
        disabled={saving}
        backgroundColor="#fff"
        pressStyle={{ backgroundColor: '#e8e8e8', scale: 0.97 }}
        disabledStyle={{ opacity: 0.5 }}
        borderRadius="$5"
        height={60}
        marginTop="$4"
      >
        {saving ? (
          <Spinner color="#000" />
        ) : (
          <Text color="#000" fontWeight="700" fontSize={16}>
            次へ
          </Text>
        )}
      </Button>
    </ScrollView>
  );
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e84393'];
  if (!name.trim()) return '#333';
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
}
