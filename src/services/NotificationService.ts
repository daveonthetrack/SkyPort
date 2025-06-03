import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';

type TripReminder = {
  id: string;
  title: string;
  body: string;
  data: any;
  trigger: Notifications.NotificationTriggerInput;
};

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  private static instance: NotificationService;
  private pushToken: string | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permissions not granted');
        return false;
      }

      // Get the push token
      const token = await this.getPushToken();
      if (token) {
        await this.savePushTokenToDatabase(token);
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  async getPushToken(): Promise<string | null> {
    try {
      if (this.pushToken) {
        return this.pushToken;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      this.pushToken = token;
      return token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  private async savePushTokenToDatabase(token: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', user.id);

      if (error) {
        console.error('Error saving push token:', error);
      }
    } catch (error) {
      console.error('Error saving push token to database:', error);
    }
  }

  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: trigger || null,
      });
      return identifier;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      throw error;
    }
  }

  async cancelNotification(identifier: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  async getBadgeCount(): Promise<number> {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  // Notification types for the app
  async sendDeliveryNotification(type: 'accepted' | 'picked_up' | 'delivered', itemTitle: string): Promise<void> {
    const notifications = {
      accepted: {
        title: 'Item Accepted!',
        body: `Your item "${itemTitle}" has been accepted by a traveler.`,
      },
      picked_up: {
        title: 'Item Picked Up',
        body: `Your item "${itemTitle}" has been picked up and is on its way.`,
      },
      delivered: {
        title: 'Item Delivered!',
        body: `Your item "${itemTitle}" has been successfully delivered.`,
      },
    };

    const notification = notifications[type];
    await this.scheduleLocalNotification(notification.title, notification.body, { type, itemTitle });
  }

  async sendMessageNotification(senderName: string, message: string): Promise<void> {
    await this.scheduleLocalNotification(
      `New message from ${senderName}`,
      message.length > 50 ? message.substring(0, 50) + '...' : message,
      { type: 'message', senderName }
    );
  }

  async sendTripNotification(type: 'reminder' | 'departure', tripDestination: string): Promise<void> {
    const notifications = {
      reminder: {
        title: 'Trip Reminder',
        body: `Don't forget about your upcoming trip to ${tripDestination}.`,
      },
      departure: {
        title: 'Trip Starting Soon',
        body: `Your trip to ${tripDestination} is starting soon. Safe travels!`,
      },
    };

    const notification = notifications[type];
    await this.scheduleLocalNotification(notification.title, notification.body, { type, tripDestination });
  }

  async cancelTripReminders(tripId: string): Promise<boolean> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const tripNotifications = scheduledNotifications.filter(
        notification => notification.content.data?.tripId === tripId
      );
      
      for (const notification of tripNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
      
      console.log(`Cancelled ${tripNotifications.length} reminders for trip ${tripId}`);
      return true;
    } catch (error) {
      console.error('Error cancelling trip reminders', error);
      return false;
    }
  }

  async cancelItemReminders(itemId: string): Promise<boolean> {
    try {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const itemNotifications = scheduledNotifications.filter(
        notification => notification.content.data?.itemId === itemId
      );
      
      for (const notification of itemNotifications) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
      
      console.log(`Cancelled ${itemNotifications.length} reminders for item ${itemId}`);
      return true;
    } catch (error) {
      console.error('Error cancelling item reminders', error);
      return false;
    }
  }

  // Setup notification listeners
  setupNotificationListeners(): void {
    // Handle notification received while app is in foreground
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    // Handle notification response (when user taps on notification)
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
      const data = response.notification.request.content.data;
      
      // Handle different notification types
      if (data?.type === 'message') {
        // Navigate to chat screen
        console.log('Navigate to chat with:', data.senderName);
      } else if (data?.type === 'delivery') {
        // Navigate to item details
        console.log('Navigate to item:', data.itemTitle);
      }
    });
  }

  static async scheduleTripReminders(userId: string, tripId: string, departureDate: string, origin: string, destination: string) {
    try {
      const hasPermission = await this.getInstance().requestPermissions();
      
      if (!hasPermission) {
        console.log('No notification permissions');
        return false;
      }

      // Cancel any existing reminders for this trip
      await this.getInstance().cancelTripReminders(tripId);

      const departureTimestamp = new Date(departureDate).getTime();
      const currentTimestamp = new Date().getTime();
      
      // Create reminders based on departure date
      const reminders: TripReminder[] = [];

      // 1 day before departure
      const oneDayBefore = new Date(departureTimestamp - 24 * 60 * 60 * 1000);
      if (oneDayBefore.getTime() > currentTimestamp) {
        reminders.push({
          id: `${tripId}-1day`,
          title: 'Trip Reminder',
          body: `Your trip from ${origin} to ${destination} is tomorrow! Don't forget to check for available items.`,
          data: { tripId, type: 'departure', timeframe: '1day' },
          trigger: {
            channelId: 'default',
            date: oneDayBefore
          }
        });
      }

      // 3 hours before departure
      const threeHoursBefore = new Date(departureTimestamp - 3 * 60 * 60 * 1000);
      if (threeHoursBefore.getTime() > currentTimestamp) {
        reminders.push({
          id: `${tripId}-3hours`,
          title: 'Trip Starting Soon',
          body: `Your trip from ${origin} to ${destination} starts in 3 hours. Are you ready?`,
          data: { tripId, type: 'departure', timeframe: '3hours' },
          trigger: {
            channelId: 'default',
            date: threeHoursBefore
          }
        });
      }

      // Pickup reminders for any items accepted for this trip
      const { data: items } = await supabase
        .from('items')
        .select('id, title, pickup_location')
        .eq('trip_id', tripId)
        .eq('status', 'accepted');

      if (items && items.length > 0) {
        items.forEach((item, index) => {
          // Reminder 2 hours after accepting to pick up the item
          const pickupReminder = new Date(currentTimestamp + (2 * 60 * 60 * 1000));
          reminders.push({
            id: `${tripId}-pickup-${item.id}`,
            title: 'Item Pickup Reminder',
            body: `Don't forget to pick up "${item.title}" at ${item.pickup_location}`,
            data: { tripId, itemId: item.id, type: 'pickup' },
            trigger: {
              channelId: 'default',
              date: pickupReminder
            }
          });
        });
      }

      // Schedule all reminders
      for (const reminder of reminders) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.title,
            body: reminder.body,
            data: reminder.data,
          },
          identifier: reminder.id,
          trigger: reminder.trigger,
        });
      }

      console.log(`Scheduled ${reminders.length} reminders for trip ${tripId}`);
      return true;
    } catch (error) {
      console.error('Error scheduling trip reminders', error);
      return false;
    }
  }

  static async scheduleItemReminders(userId: string, itemId: string, itemTitle: string, pickupLocation: string, destination: string) {
    try {
      const hasPermission = await this.getInstance().requestPermissions();
      
      if (!hasPermission) {
        console.log('No notification permissions');
        return false;
      }

      // Cancel any existing reminders for this item
      await this.getInstance().cancelItemReminders(itemId);

      const currentTimestamp = new Date().getTime();
      const reminders: TripReminder[] = [];

      // Reminder 1 day after accepting the item
      const oneDayAfter = new Date(currentTimestamp + 24 * 60 * 60 * 1000);
      reminders.push({
        id: `${itemId}-status-1day`,
        title: 'Item Status Update',
        body: `How's the delivery of "${itemTitle}" going? Don't forget to update the status.`,
        data: { itemId, type: 'status_update' },
        trigger: {
          channelId: 'default',
          date: oneDayAfter
        }
      });

      // Schedule all reminders
      for (const reminder of reminders) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.title,
            body: reminder.body,
            data: reminder.data,
          },
          identifier: reminder.id,
          trigger: reminder.trigger,
        });
      }

      console.log(`Scheduled ${reminders.length} reminders for item ${itemId}`);
      return true;
    } catch (error) {
      console.error('Error scheduling item reminders', error);
      return false;
    }
  }

  static async scheduleNotification(title: string, body: string, date: Date) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
      },
      trigger: {
        channelId: 'default',
        date
      },
    });
  }
}

export const notificationService = NotificationService.getInstance(); 