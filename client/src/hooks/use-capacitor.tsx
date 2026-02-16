import { useEffect, useState, useRef, createContext, useContext, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface CapacitorContextType {
  isNative: boolean;
  platform: 'ios' | 'android' | 'web';
  isIOS: boolean;
  isAndroid: boolean;
  isWeb: boolean;
  keyboardVisible: boolean;
  pushToken: string | null;
  hapticFeedback: (style?: 'light' | 'medium' | 'heavy') => Promise<void>;
  setStatusBarStyle: (style: 'light' | 'dark') => Promise<void>;
  registerForNativePush: (crewMemberId: string) => Promise<string | null>;
}

const CapacitorContext = createContext<CapacitorContextType | null>(null);

export function CapacitorProvider({ children }: { children: ReactNode }) {
  const capacitor = useCapacitor();
  return (
    <CapacitorContext.Provider value={capacitor}>
      {children}
    </CapacitorContext.Provider>
  );
}

export function useCapacitorContext() {
  const context = useContext(CapacitorContext);
  if (!context) {
    return {
      isNative: false,
      platform: 'web' as const,
      isIOS: false,
      isAndroid: false,
      isWeb: true,
      keyboardVisible: false,
      pushToken: null,
      hapticFeedback: async () => {},
      setStatusBarStyle: async () => {},
      registerForNativePush: async () => null,
    };
  }
  return context;
}

export function useCapacitor() {
  const [isNative, setIsNative] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    const platformName = Capacitor.getPlatform();
    const isNativeApp = Capacitor.isNativePlatform();
    setIsNative(isNativeApp);
    setPlatform(platformName as 'ios' | 'android' | 'web');

    // Add platform-specific body class for CSS targeting
    if (isNativeApp) {
      document.body.classList.add(`capacitor-${platformName}`);
      if (platformName === 'ios') {
        document.body.classList.add('capacitor-ios');
      } else if (platformName === 'android') {
        document.body.classList.add('capacitor-android');
      }
    }

    if (isNativeApp) {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});

      Keyboard.addListener('keyboardWillShow', () => {
        setKeyboardVisible(true);
      });

      Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardVisible(false);
      });

      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });
    }

    return () => {
      if (Capacitor.isNativePlatform()) {
        Keyboard.removeAllListeners();
        App.removeAllListeners();
        // Clean up body classes
        document.body.classList.remove('capacitor-ios', 'capacitor-android');
      }
    };
  }, []);

  const hapticFeedback = async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (Capacitor.isNativePlatform()) {
      const impactStyle = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      }[style];
      await Haptics.impact({ style: impactStyle });
    }
  };

  const setStatusBarStyle = async (style: 'light' | 'dark') => {
    if (Capacitor.isNativePlatform()) {
      await StatusBar.setStyle({ 
        style: style === 'light' ? Style.Light : Style.Dark 
      });
    }
  };

  const registerForNativePush = async (crewMemberId: string): Promise<string | null> => {
    if (!Capacitor.isNativePlatform()) return null;

    try {
      const PushNotificationsModule = await import('@capacitor/push-notifications');
      const PushNotifications = PushNotificationsModule.PushNotifications;

      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') return null;

      return new Promise<string | null>((resolve) => {
        PushNotifications.addListener('registration', async (token) => {
          setPushToken(token.value);
          try {
            await fetch('/api/push/register-device', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                token: token.value,
                platform: Capacitor.getPlatform(),
                crewMemberId,
              }),
            });
          } catch (err) {
            console.error('Failed to register device token with server:', err);
          }
          resolve(token.value);
        });

        PushNotifications.addListener('registrationError', (err) => {
          console.error('Native push registration error:', err);
          resolve(null);
        });

        PushNotifications.register();
      });
    } catch (err) {
      console.error('Push notifications not available:', err);
      return null;
    }
  };

  return {
    isNative,
    platform,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isWeb: platform === 'web',
    keyboardVisible,
    pushToken,
    hapticFeedback,
    setStatusBarStyle,
    registerForNativePush,
  };
}

export function useNativePushRegistration(crewMemberId: string | null) {
  const { isNative, registerForNativePush } = useCapacitorContext();
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (isNative && crewMemberId && !hasRegistered.current) {
      hasRegistered.current = true;
      registerForNativePush(crewMemberId);
    }
  }, [isNative, crewMemberId, registerForNativePush]);
}

export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const style = getComputedStyle(document.documentElement);
      setSafeArea({
        top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0', 10),
        bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0', 10),
        left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0', 10),
        right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0', 10),
      });
    }
  }, []);

  return safeArea;
}
