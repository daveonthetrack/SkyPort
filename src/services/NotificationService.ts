import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import * as Device from 'expo-device';

type TripReminder = {
  id: string;
  title: string;
  body: string;
  data: any;
  trigger: Notifications.NotificationTriggerInput;
};

export class NotificationService {
  static async requestPermissions() {
    if (!Device.isDevice) {
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return false;
    }

    return true;
  }

  static async registerForPushNotifications() {
    try {
      const hasPermission = await this.requestPermissions();
      
      if (!hasPermission) {
        console.log('Notification permissions denied');
        return null;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      return token;
    } catch (error) {
      console.error('Error getting push token', error);
      return null;
    }
  }

  static async scheduleTripReminders(userId: string, tripId: string, departureDate: string, origin: string, destination: string) {
    try {
      const hasPermission = await this.requestPermissions();
      
      if (!hasPermission) {
        console.log('No notification permissions');
        return false;
      }

      // Cancel any existing reminders for this trip
      await this.cancelTripReminders(tripId);

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

  static async cancelTripReminders(tripId: string) {
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

  static async scheduleItemReminders(userId: string, itemId: string, itemTitle: string, pickupLocation: string, destination: string) {
    try {
      const hasPermission = await this.requestPermissions();
      
      if (!hasPermission) {
        console.log('No notification permissions');
        return false;
      }

      // Cancel any existing reminders for this item
      await this.cancelItemReminders(itemId);

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

  static async cancelItemReminders(itemId: string) {
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