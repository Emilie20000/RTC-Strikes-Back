import { invoke } from '@tauri-apps/api/core';
import { 
  isPermissionGranted, 
  requestPermission as requestTauriPermission
} from '@tauri-apps/plugin-notification';

export const isTauri = () => {
  return typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
};

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined') return false;

  if (isTauri()) {
    try {
      let permission = await isPermissionGranted();
      console.log('Initial Tauri permission:', permission);
      if (!permission) {
        console.log('Requesting notification permission...');
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

  try {
    if (isTauri()) {
      await invoke('send_desktop_notification', { title, body });
    } else {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/icons/128x128.png' });
      }
    }
  } catch (e) {
    console.error('Notification error:', e);
  }
};
