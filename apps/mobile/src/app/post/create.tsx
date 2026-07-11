import { PIN_EMOJIS } from '@repo/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Text, TextArea, XStack, YStack } from 'tamagui';
import { MiniHeader } from '../../components/post-flow/MiniHeader';
import { PhotoSlot } from '../../components/post-flow/PhotoSlot';
import { PinBadge } from '../../components/post-flow/PinBadge';
import { PrimaryButton } from '../../components/post-flow/PrimaryButton';
import { clearDraft, getDraft } from '../../lib/postDraft';
import { createPost } from '../../lib/posts-api';

export default function PostCreateScreen() {
  const router = useRouter();
  const draft = getDraft();

  const [comment, setComment] = useState('');
  const [pin, setPin] = useState<(typeof PIN_EMOJIS)[number] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/post/store-search');
    }
  };

  const handleSubmit = async () => {
    if (!pin || !draft.store || !draft.imageBlob) return;

    setSubmitting(true);
    setSubmitError(false);
    try {
      await createPost({
        shop: {
          googlePlaceId: draft.store.placeId,
          name: draft.store.name,
          address: draft.store.address,
          lat: draft.store.location.lat,
          lng: draft.store.location.lng,
        },
        comment: comment.trim() || undefined,
        pin,
        image: draft.imageBlob,
      });
      const storeName = draft.store.name;
      clearDraft();
      router.replace({ pathname: '/post/done', params: { storeName, pin, comment: comment.trim() } });
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <YStack flex={1} backgroundColor="#000">
      <MiniHeader title="投稿を作成" onBack={handleBack} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <YStack width="100%" aspectRatio={1} borderRadius={16} overflow="hidden" marginBottom="$4">
          <PhotoSlot uri={draft.imageUri} label="写真がありません" />
        </YStack>

        <YStack marginBottom="$5">
          <Text color="#fff" fontSize={17} fontWeight="800">
            {draft.store?.name ?? '店舗が選択されていません'}
          </Text>
          {draft.store?.address ? (
            <Text color="#888" fontSize={13} marginTop={2}>
              {draft.store.address}
            </Text>
          ) : null}
        </YStack>

        <YStack gap="$2" marginBottom="$5">
          <Text color="#555" fontSize={14} fontWeight="600">
            コメント
          </Text>
          <TextArea
            value={comment}
            onChangeText={setComment}
            placeholder="味や雰囲気など、感想を書いてみましょう"
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

        <YStack gap="$2" marginBottom="$6">
          <Text color="#555" fontSize={14} fontWeight="600">
            ピンを選ぶ（必須）
          </Text>
          <XStack flexWrap="wrap" gap="$3">
            {PIN_EMOJIS.map((emoji) => (
              <Pressable key={emoji} onPress={() => setPin(emoji)} accessibilityRole="button" accessibilityLabel={`ピン ${emoji} を選択`}>
                <PinBadge emoji={emoji} selected={pin === emoji} />
              </Pressable>
            ))}
          </XStack>
        </YStack>

        {submitError ? (
          <Text color="#ff6b6b" fontSize={13} textAlign="center" marginBottom="$3">
            投稿に失敗しました。もう一度お試しください
          </Text>
        ) : null}

        <PrimaryButton label="地図に投稿する" onPress={handleSubmit} disabled={!pin || !draft.store || !draft.imageBlob} loading={submitting} />
      </ScrollView>
    </YStack>
  );
}
