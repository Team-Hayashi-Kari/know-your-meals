import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image as RNImage } from 'react-native';
import { Button, Input, ScrollView, Spinner, Text, TextArea, XStack, YStack } from 'tamagui';
import { getMe, updateMe } from '../lib/api';
import { ApiError } from '../lib/api-client';
import { checkHandleAvailable } from '../lib/mock-api';

const NAME_MAX = 20;
const HANDLE_MIN = 3;
const HANDLE_MAX = 15;

export default function ProfileSetupScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState<string | null>(null);

  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const [nameError, setNameError] = useState('');
  const [handleError, setHandleError] = useState('');
  const [saveError, setSaveError] = useState('');

  const nameCount = countChars(name.trim());
  const handleCount = countChars(handle.trim());

  useEffect(() => {
    let cancelled = false;

    getMe()
      .then((me) => {
        if (cancelled) return;
        if (me.handle) {
          router.replace('/home');
          return;
        }

        setName(me.name ?? '');
        setBio(me.bio ?? '');
        setImage(me.image ?? null);
        setLoadingProfile(false);
      })
      .catch((error) => {
        console.error('[プロフィール取得エラー]', error);
        if (!cancelled) router.replace('/');
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const validationError = getNameValidationError(name.trim());
    setNameError(validationError);
    setSaveError('');
  }, [name]);

  useEffect(() => {
    const trimmed = handle.trim();
    const validationError = getHandleValidationError(trimmed);
    setHandleError('');
    setSaveError('');

    if (!trimmed) {
      setHandleStatus('idle');
      return;
    }
    if (validationError) {
      setHandleStatus('idle');
      setHandleError(validationError);
      return;
    }

    let cancelled = false;
    setHandleStatus('checking');
    const timer = setTimeout(() => {
      checkHandleAvailable(trimmed)
        .then((ok) => {
          if (cancelled) return;
          setHandleStatus(ok ? 'available' : 'taken');
          setHandleError('');
        })
        .catch((error) => {
          if (cancelled) return;
          console.error('[ユーザーID確認エラー]', error);
          setHandleStatus('idle');
          setHandleError('IDの確認に失敗しました。通信状況を確認してください');
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [handle]);

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
    setNameError('');
    setHandleError('');
    setSaveError('');

    const trimmedName = name.trim();
    const trimmedHandle = handle.trim();
    let hasError = false;

    const nameValidationError = getNameValidationError(trimmedName);
    if (!trimmedName) {
      setNameError('名前を入力してください');
      hasError = true;
    } else if (nameValidationError) {
      setNameError(nameValidationError);
      hasError = true;
    }

    const handleValidationError = getHandleValidationError(trimmedHandle);
    if (handleValidationError) {
      setHandleError(handleValidationError);
      hasError = true;
    } else if (handleStatus === 'taken') {
      setHandleError('このIDは使われています');
      hasError = true;
    } else if (handleStatus === 'checking') {
      setHandleError('ID確認中です。少し待ってください');
      hasError = true;
    }

    if (hasError) return;

    setSaving(true);
    try {
      await updateMe({
        name: trimmedName,
        handle: trimmedHandle,
        bio,
        ...(image?.startsWith('http://') || image?.startsWith('https://') ? { image } : {}),
      });
      router.replace('/find-friends');
    } catch (e) {
      console.error('[プロフィール保存エラー]', e);
      if (e instanceof ApiError && e.status === 409) {
        setHandleError('このIDは使われています');
      } else {
        setSaveError('プロフィールの保存に失敗しました');
      }
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return (
      <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center">
        <Spinner color="#fff" size="large" />
      </YStack>
    );
  }

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
      <XStack marginBottom="$6">
        <Text color="#555" fontSize={13} fontWeight="600">
          ステップ 1 / 2
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
            backgroundColor={image ? '#1a1a1a' : getAvatarColor(name)}
            justifyContent="center"
            alignItems="center"
            overflow="hidden"
          >
            {image ? (
              <RNImage source={{ uri: image }} style={{ width: 96, height: 96 }} resizeMode="cover" />
            ) : (
              <Text color="#fff" fontSize={40} fontWeight="700">
                {getAvatarInitial(name)}
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
        <XStack justifyContent="space-between" alignItems="center">
          <Text color="#555" fontSize={14} fontWeight="600">
            名前
          </Text>
          <Text color={nameCount > NAME_MAX ? '#ff4444' : '#555'} fontSize={13}>
            {nameCount}/{NAME_MAX}
          </Text>
        </XStack>
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
        {nameError !== '' && (
          <Text color="#ff4444" fontSize={13}>
            {nameError}
          </Text>
        )}
      </YStack>

      <YStack gap="$2" marginBottom="$4">
        <XStack justifyContent="space-between" alignItems="center">
          <Text color="#555" fontSize={14} fontWeight="600">
            ユーザーID
          </Text>
          <Text color={handleCount > HANDLE_MAX ? '#ff4444' : '#555'} fontSize={13}>
            {handleCount}/{HANDLE_MAX}
          </Text>
        </XStack>
        <XStack alignItems="center" backgroundColor="#1a1a1a" borderRadius="$4" height={52} paddingLeft="$3">
          <Text color="#888" fontSize={16} fontWeight="600">
            @
          </Text>
          <Input
            flex={1}
            value={handle}
            onChangeText={setHandle}
            placeholder="yuki_eats"
            placeholderTextColor="$gray9"
            backgroundColor="transparent"
            borderWidth={0}
            color="#fff"
            height={52}
            fontSize={16}
            autoCapitalize="none"
          />
        </XStack>
        {handleStatus === 'checking' && (
          <Text color="#888" fontSize={13}>
            確認中…
          </Text>
        )}
        {handleStatus === 'available' && (
          <Text color="#2ecc71" fontSize={13}>
            ✓ このIDは使えます
          </Text>
        )}
        {handleStatus === 'taken' && (
          <Text color="#ff4444" fontSize={13}>
            ✗ このIDは使われています
          </Text>
        )}
        {handleError !== '' && (
          <Text color="#ff4444" fontSize={13}>
            {handleError}
          </Text>
        )}
      </YStack>

      <YStack gap="$2" marginBottom="$6">
        <Text color="#555" fontSize={14} fontWeight="600">
          自己紹介
        </Text>
        <TextArea
          value={bio}
          onChangeText={setBio}
          placeholder={'ラーメンとカフェ巡りが好き。\n週末は新店開拓。'}
          placeholderTextColor="$gray9"
          backgroundColor="#1a1a1a"
          borderWidth={0}
          color="#fff"
          minHeight={100}
          fontSize={16}
          lineHeight={22}
          borderRadius="$4"
          padding="$3"
        />
      </YStack>

      {saveError !== '' && (
        <Text color="#ff4444" fontSize={13} marginBottom="$3">
          {saveError}
        </Text>
      )}

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

function countChars(str: string): number {
  return [...str].length;
}

function getNameValidationError(name: string): string {
  if (countChars(name) > NAME_MAX) return `名前は${NAME_MAX}文字以内で入力してください`;
  return '';
}

function isHandleFormatValid(h: string): boolean {
  return /^[a-zA-Z0-9_]+$/.test(h);
}

function getHandleValidationError(handle: string): string {
  if (!handle) return 'ユーザーIDを入力してください';
  if (countChars(handle) < HANDLE_MIN) return `IDは${HANDLE_MIN}文字以上で入力してください`;
  if (!isHandleFormatValid(handle)) return 'IDは半角の英数字・記号（_）のみ使えます';
  if (countChars(handle) > HANDLE_MAX) return `IDは${HANDLE_MAX}文字以内で入力してください`;
  return '';
}
