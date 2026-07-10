import { getAvatarColor, getAvatarInitial } from '@repo/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Button, ScrollView, Spinner, Text, XStack, YStack } from 'tamagui';
import { getReceivedFriendRequests, updateFriendshipRequest, type ReceivedFriendRequest } from '../../lib/mock-api';

export default function FriendRequestsScreen() {
  const router = useRouter();

  const [requests, setRequests] = useState<ReceivedFriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setLoadError(false);
      getReceivedFriendRequests()
        .then((data) => setRequests(data))
        .catch(() => setLoadError(true))
        .finally(() => setLoading(false));
    }, []),
  );

  const handleResolved = (friendshipId: number) => {
    setRequests((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
  };

  return (
    <YStack flex={1} backgroundColor="#000">
      <XStack alignItems="center" paddingHorizontal="$5" paddingTop={64} paddingBottom="$4" gap="$3">
        <Text
          color="#fff"
          fontSize={22}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
        >
          ←
        </Text>
        <Text color="#fff" fontSize={20} fontWeight="700">
          届いた申請
        </Text>
        <Text color="#666" fontSize={16} fontWeight="600">
          {requests.length}
        </Text>
      </XStack>

      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner color="#fff" size="large" />
        </YStack>
      ) : loadError ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Text color="#e05555" fontSize={14}>
            読み込みに失敗しました
          </Text>
        </YStack>
      ) : requests.length === 0 ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Text color="#666" fontSize={14}>
            届いた申請はありません
          </Text>
        </YStack>
      ) : (
        <ScrollView>
          <YStack borderTopWidth={1} borderTopColor="#1a1a1a">
            {requests.map((request) => (
              <RequestRow key={request.friendshipId} request={request} onResolved={() => handleResolved(request.friendshipId)} />
            ))}
          </YStack>
        </ScrollView>
      )}
    </YStack>
  );
}

function RequestRow({ request, onResolved }: { request: ReceivedFriendRequest; onResolved: () => void }) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(false);

  const respond = async (status: 'accepted' | 'denied') => {
    setProcessing(true);
    setError(false);
    try {
      await updateFriendshipRequest(request.friendshipId, { status });
      onResolved();
    } catch {
      setError(true);
      setProcessing(false);
    }
  };

  return (
    <YStack paddingHorizontal="$5" paddingVertical="$4" borderBottomWidth={1} borderBottomColor="#1a1a1a" gap="$3">
      <XStack alignItems="center" gap="$3">
        <YStack
          width={44}
          height={44}
          borderRadius={22}
          backgroundColor={getAvatarColor(request.name)}
          justifyContent="center"
          alignItems="center"
        >
          <Text color="#fff" fontSize={18} fontWeight="700">
            {getAvatarInitial(request.name)}
          </Text>
        </YStack>
        <YStack flex={1}>
          <Text color="#fff" fontSize={15} fontWeight="600">
            {request.name}
          </Text>
          <Text color="#666" fontSize={13}>
            @{request.handle} ・ 共通の友達 {request.mutualFriendCount}人
          </Text>
        </YStack>
      </XStack>

      <XStack gap="$3">
        <Button
          flex={1}
          onPress={() => respond('accepted')}
          disabled={processing}
          opacity={processing ? 0.5 : 1}
          backgroundColor="#fff"
          pressStyle={{ backgroundColor: '#e8e8e8' }}
          borderRadius="$10"
          height={44}
        >
          <Text color="#000" fontWeight="700" fontSize={14}>
            承認
          </Text>
        </Button>
        <Button
          flex={1}
          onPress={() => respond('denied')}
          disabled={processing}
          opacity={processing ? 0.5 : 1}
          backgroundColor="#000"
          borderWidth={1}
          borderColor="#333"
          pressStyle={{ backgroundColor: '#111' }}
          borderRadius="$10"
          height={44}
        >
          <Text color="#999" fontWeight="700" fontSize={14}>
            拒否
          </Text>
        </Button>
      </XStack>

      {error && (
        <Text color="#e05555" fontSize={12}>
          通信に失敗しました。もう一度お試しください。
        </Text>
      )}
    </YStack>
  );
}
