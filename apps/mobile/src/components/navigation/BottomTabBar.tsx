import { usePathname, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Pressable } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { XStack, YStack } from 'tamagui';

const ACTIVE_COLOR = '#fff';
const INACTIVE_COLOR = '#555';

type TabKey = 'map' | 'camera' | 'saved' | 'profile';

type Tab = {
  key: TabKey;
  route: string;
  label: string;
  Icon: (props: { color: string }) => ReactElement;
};

// デザイン案 Know Your Meals - MVP.dc.html の④セクション（195〜198行目）のSVG定義を使用。
// ただし3番目（保存済み）は元デザインの角丸四角+再生ボタン風アイコンが機能と噛み合わないため、
// 同系統（Feather Icons風、stroke基調）のブックマークアイコンに差し替えている。
const TABS: Tab[] = [
  {
    key: 'map',
    route: '/home',
    label: 'マップ',
    Icon: ({ color }) => (
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
        <Circle cx={12} cy={9} r={2.5} />
      </Svg>
    ),
  },
  {
    key: 'camera',
    route: '/post/camera',
    label: 'カメラ',
    Icon: ({ color }) => (
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Rect x={3} y={7} width={18} height={13} rx={2.5} />
        <Circle cx={12} cy={13.5} r={3.4} />
        <Path d="M8.5 7l1.3-2h4.4l1.3 2" />
      </Svg>
    ),
  },
  {
    key: 'saved',
    route: '/saved',
    label: '保存済み',
    Icon: ({ color }) => (
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </Svg>
    ),
  },
  {
    key: 'profile',
    route: '/profile',
    label: 'プロフィール',
    Icon: ({ color }) => (
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Circle cx={12} cy={8} r={3.4} />
        <Path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </Svg>
    ),
  },
];

// pathnameがそのタブのルート配下かどうか（"/profile-setup"のような別画面を誤って"/profile"扱いしないよう境界チェック）
function isActiveRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <YStack backgroundColor="#000" borderTopWidth={1} borderTopColor="#1a1a1a" paddingTop={14} paddingBottom={14}>
      <XStack justifyContent="space-around" alignItems="center">
        {TABS.map(({ key, route, label, Icon }) => {
          const active = isActiveRoute(pathname, route);
          return (
            <Pressable
              key={key}
              // 現在アクティブなタブを再タップしても同じ画面を履歴に積み増さないよう何もしない
              onPress={() => {
                if (active) return;
                // 遷移後もこのボタンがDOMフォーカスを保持したままだと、
                // 現在画面がスタックでaria-hidden化された際にブラウザ警告が出るため事前にblurする
                (document.activeElement as HTMLElement | null)?.blur();
                router.push(route);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: active }}
            >
              <Icon color={active ? ACTIVE_COLOR : INACTIVE_COLOR} />
            </Pressable>
          );
        })}
      </XStack>
    </YStack>
  );
}
