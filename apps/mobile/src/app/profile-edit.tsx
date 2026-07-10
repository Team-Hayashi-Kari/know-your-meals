import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Input, Spinner, Text, TextArea, XStack, YStack } from 'tamagui';
import { checkHandleAvailable, getMe, updateMe } from '../lib/mock-api';

const NAME_MAX = 20;
const HANDLE_MIN = 3;
const HANDLE_MAX = 30;

export default function ProfileEditScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [initialHandle, setInitialHandle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [nameError, setNameError] = useState('');
  const [handleError, setHandleError] = useState('');

  const nameCount = countChars(name.trim());
  const handleCount = countChars(handle.trim());

  useEffect(() => {
    getMe().then((me) => {
      setName(me.name);
      setHandle(me.handle ?? '');
      setInitialHandle((me.handle ?? '').trim());
      setBio(me.bio ?? '');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const trimmed = handle.trim();
    setHandleError('');

    if (!trimmed || trimmed === initialHandle) {
      setHandleStatus('idle');
      return;
    }
    if (!isHandleFormatValid(trimmed) || countChars(trimmed) < HANDLE_MIN || countChars(trimmed) > HANDLE_MAX) {
      setHandleStatus('idle');
      return;
    }
    setHandleStatus('checking');
    const timer = setTimeout(() => {
      checkHandleAvailable(trimmed).then((ok) => {
        setHandleStatus(ok ? 'available' : 'taken');
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [handle, initialHandle]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  const handleSave = async () => {
    setNameError('');
    setHandleError('');

    const trimmedName = name.trim();
    const trimmedHandle = handle.trim();
    let hasError = false;

    if (!trimmedName) {
      setNameError('名前を入力してください');
      hasError = true;
    } else if (countChars(trimmedName) > NAME_MAX) {
      setNameError(`名前は${NAME_MAX}文字以内で入力してください`);
      hasError = true;
    }

    if (!trimmedHandle) {
      setHandleError('ユーザーIDを入力してください');
      hasError = true;
    } else if (!isHandleFormatValid(trimmedHandle)) {
      setHandleError('IDは半角の英数字・_のみ使えます');
      hasError = true;
    } else if (countChars(trimmedHandle) < HANDLE_MIN) {
      setHandleError(`IDは${HANDLE_MIN}文字以上で入力してください`);
      hasError = true;
    } else if (countChars(trimmedHandle) > HANDLE_MAX) {
      setHandleError(`IDは${HANDLE_MAX}文字以内で入力してください`);
      hasError = true;
    } else if (trimmedHandle !== initialHandle && handleStatus === 'taken') {
      setHandleError('このIDは使われています');
      hasError = true;
    } else if (trimmedHandle !== initialHandle && handleStatus === 'checking') {
      setHandleError('ID確認中です。少し待ってください');
      hasError = true;
    }

    if (hasError) return;

    setSaving(true);
    try {
      await updateMe({ name: trimmedName, handle: trimmedHandle, bio });
      goBack();
    } catch (e) {
      console.error('[プロフィール更新エラー]', e);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <YStack flex={1} backgroundColor="#000" justifyContent="center" alignItems="center">
        <Spinner color="#fff" size="large" />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="#000" paddingTop={64}>
      <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$5" paddingBottom="$5">
        <Text color="#888" fontSize={16} fontWeight="700" onPress={goBack}>
          戻る
        </Text>
        <Text color="#fff" fontSize={18} fontWeight="800">
          プロフィール編集
        </Text>
        <Button chromeless padding={0} minHeight={0} height="auto" onPress={handleSave} disabled={saving} disabledStyle={{ opacity: 0.5 }}>
          {saving ? (
            <Spinner color="#ffd400" size="small" />
          ) : (
            <Text color="#ffd400" fontSize={16} fontWeight="700">
              保存
            </Text>
          )}
        </Button>
      </XStack>

      <YStack paddingHorizontal="$5" gap="$4">
        <YStack gap="$2">
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
          {nameError !== '' ? <Text color="#ff4444">{nameError}</Text> : null}
        </YStack>

        <YStack gap="$2">
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
          {handleStatus === 'checking' ? (
            <Text color="#888" fontSize={13}>
              確認中…
            </Text>
          ) : null}
          {handleStatus === 'available' ? (
            <Text color="#2ecc71" fontSize={13}>
              ✓ このIDは使えます
            </Text>
          ) : null}
          {handleStatus === 'taken' ? (
            <Text color="#ff4444" fontSize={13}>
              ✗ このIDは使われています
            </Text>
          ) : null}
          {handleError !== '' ? (
            <Text color="#ff4444" fontSize={13}>
              {handleError}
            </Text>
          ) : null}
        </YStack>

        <YStack gap="$2">
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
            minHeight={120}
            fontSize={16}
            lineHeight={22}
            borderRadius="$4"
            padding="$3"
          />
        </YStack>
      </YStack>
    </YStack>
  );
}

function countChars(str: string): number {
  return [...str].length;
}

function isHandleFormatValid(h: string): boolean {
  return /^[a-zA-Z0-9_.]+$/.test(h);
}
