import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PLANNER_CHANNEL_ID = 'planner-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function prepareAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(PLANNER_CHANNEL_ID, {
    name: 'Planner reminders',
    description: 'Alerts for study sessions, revision tasks, and exams you schedule in Mentra.',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 200, 250],
    enableVibrate: true,
    enableLights: true,
    lightColor: '#2367E8',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function requestStudyNotificationPermission() {
  await prepareAndroidChannel();
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  if (!permission.granted) {
    const detail = permission.canAskAgain
      ? 'Choose Allow when Mentra asks for notification access.'
      : 'Open your phone Settings, select Mentra, then turn Notifications on.';
    throw new Error(`Notification access is off. ${detail}`);
  }
  if (Platform.OS === 'android') {
    const channel = await Notifications.getNotificationChannelAsync(PLANNER_CHANNEL_ID);
    if (channel?.importance === Notifications.AndroidImportance.NONE) {
      throw new Error('Planner reminders are muted. Open your phone Settings, select Mentra notifications, and enable Planner reminders.');
    }
  }
  return permission;
}

export async function scheduleStudyTaskNotification(task: { id: string; title: string; subject: string; type: string; scheduledAt: string }) {
  await requestStudyNotificationPermission();
  const scheduledAt = new Date(task.scheduledAt);
  if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    throw new Error('Choose a future date and time for this reminder.');
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: task.type === 'Exam' ? `Upcoming exam: ${task.title}` : `Time for ${task.title}`,
      body: task.subject ? `${task.subject} · Open Mentra to get started.` : 'Open Mentra to get started.',
      sound: 'default',
      data: { type: 'planner-task', taskId: task.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduledAt,
      channelId: PLANNER_CHANNEL_ID,
    },
  });

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (!scheduled.some((item) => item.identifier === identifier)) {
    throw new Error('Your phone did not register this reminder. Check Mentra notification and alarm permissions, then try again.');
  }
  return identifier;
}

export async function cancelStudyTaskNotification(identifier?: string) {
  if (!identifier) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // The alert may already have fired, so there may be nothing left to cancel.
  }
}
