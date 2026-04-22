import { 
  isPermissionGranted, 
  requestPermission as requestTauriPermission, 
  sendNotification as sendTauriNotification 
} from '@tauri-apps/plugin-notification';

export const isTauri = () => {
  return typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
};

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined') return false;

  if (isTauri()) {
    try {
      let permission = await isPermissionGranted();
      if (!permission) {
        const res = await requestTauriPermission();
        permission = res === 'granted';
      }
      return permission;
    } catch (e) {
      console.error('Failed to request Tauri notification permission:', e);
      return false;
    }
  } else {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }
};

export const sendNotification = async (title: string, body: string) => {
  if (typeof window === 'undefined') return;

  if (isTauri()) {
    try {
      sendTauriNotification({
        title,
        body,
      });
    } catch (e) {
      console.error('Failed to send Tauri notification:', e);
    }
  } else {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }
};
