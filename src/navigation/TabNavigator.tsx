import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp, CompositeNavigationProp } from '@react-navigation/native';
import TravelerDashboard from '../screens/TravelerDashboard';
import SenderDashboard from '../screens/SenderDashboard';
import ChatListScreen from '../screens/ChatListScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { colors } from '../theme';
import { View, ActivityIndicator, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { PostItemScreen } from '../screens/PostItemScreen';
import { PostTripScreen } from '../screens/PostTripScreen';
import { MyItemsScreen } from '../screens/MyItemsScreen';
import { MyTripsScreen } from '../screens/MyTripsScreen';
import { FindTravelersScreen } from '../screens/FindTravelersScreen';
import FindItemsScreen from '../screens/FindItemsScreen';
import ChatScreen from '../screens/ChatScreen';
import PickupDetailsScreen from '../screens/PickupDetailsScreen';
import ItemDetailsScreen from '../screens/ItemDetailsScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TripDetailsScreen from '../screens/TripDetailsScreen';
import ImageViewerScreen from '../screens/ImageViewerScreen';
import { TabParamList, MessagesStackParamList } from './types';
import TravelerItemDetailsScreen from '../screens/TravelerItemDetailsScreen';
import DeliveredItemsScreen from '../screens/DeliveredItemsScreen';

type ChatScreenParams = {
  otherUserId: string;
  otherUserName: string;
  itemId?: string;
  tripId?: string;
};

type HomeStackParamList = {
  Dashboard: undefined;
  PostTrip: undefined;
  MyTrips: undefined;
  FindItems: undefined;
  PostItem: undefined;
  MyItems: undefined;
  FindTravelers: undefined;
  PickupDetails: { 
    itemId: string | number;
    item?: any;
    trip?: any;
  };
  ItemDetails: { 
    itemId: string | number;
    item?: any;
    trip?: any;
  };
  TravelerItemDetails: {
    itemId: string;
  };
  TripDetails: undefined;
  DeliveredItems: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const HomeStackNavigator = createNativeStackNavigator<HomeStackParamList>();

type IconName = 
  | 'home' 
  | 'home-outline' 
  | 'chatbubbles' 
  | 'chatbubbles-outline' 
  | 'person' 
  | 'person-outline' 
  | 'alert'
  | 'notifications'
  | 'notifications-outline';

type TabScreenOptions = {
  title: string;
  headerShown: boolean;
};

const getScreenOptions = (routeName: keyof TabParamList, isTraveler: boolean): TabScreenOptions => {
  switch (routeName) {
    case 'Home':
      return {
        title: isTraveler ? 'Traveler Home' : 'Sender Home',
        headerShown: false,
      };
    case 'Messages':
      return {
        title: 'Messages',
        headerShown: true,
      };
    case 'Profile':
      return {
        title: 'Profile',
        headerShown: true,
      };
    default:
      return {
        title: '',
        headerShown: true,
      };
  }
};

const HomeStackScreen = () => {
  const { profile } = useAuth();
  const isTraveler = profile?.role === 'traveler';

  return (
    <HomeStackNavigator.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      {isTraveler ? (
        <>
          <HomeStackNavigator.Screen 
            name="Dashboard" 
            component={TravelerDashboard}
            options={{ title: 'Traveler Dashboard' }}
          />
          <HomeStackNavigator.Screen 
            name="PostTrip" 
            component={PostTripScreen}
            options={{ title: 'Post a Trip' }}
          />
          <HomeStackNavigator.Screen 
            name="MyTrips" 
            component={MyTripsScreen}
            options={{ title: 'My Trips' }}
          />
          <HomeStackNavigator.Screen 
            name="FindItems" 
            component={FindItemsScreen}
            options={{ title: 'Find Items' }}
          />
          <HomeStackNavigator.Screen 
            name="ItemDetails" 
            component={ItemDetailsScreen}
            options={{ title: 'Item Details' }}
          />
          <HomeStackNavigator.Screen 
            name="TravelerItemDetails" 
            component={TravelerItemDetailsScreen}
            options={{ title: 'Item Details' }}
          />
          <HomeStackNavigator.Screen 
            name="PickupDetails" 
            component={PickupDetailsScreen}
            options={{ title: 'Pickup Details' }}
          />
          <HomeStackNavigator.Screen 
            name="TripDetails" 
            component={TripDetailsScreen}
            options={{ title: 'Trip Details' }}
          />
          <HomeStackNavigator.Screen 
            name="DeliveredItems" 
            component={DeliveredItemsScreen}
            options={{ title: 'Delivered Items' }}
          />
        </>
      ) : (
        <>
          <HomeStackNavigator.Screen 
            name="Dashboard" 
            component={SenderDashboard}
            options={{ title: 'Sender Dashboard' }}
          />
          <HomeStackNavigator.Screen 
            name="PostItem" 
            component={PostItemScreen}
            options={{ title: 'Post an Item' }}
          />
          <HomeStackNavigator.Screen 
            name="MyItems" 
            component={MyItemsScreen}
            options={{ title: 'My Items' }}
          />
          <HomeStackNavigator.Screen 
            name="FindTravelers" 
            component={FindTravelersScreen}
            options={{ title: 'Find Travelers' }}
          />
          <HomeStackNavigator.Screen 
            name="ItemDetails" 
            component={ItemDetailsScreen}
            options={{ title: 'Item Details' }}
          />
          <HomeStackNavigator.Screen 
            name="PickupDetails" 
            component={PickupDetailsScreen}
            options={{ title: 'Pickup Details' }}
          />
          <HomeStackNavigator.Screen 
            name="TripDetails" 
            component={TripDetailsScreen}
            options={{ title: 'Trip Details' }}
          />
          <HomeStackNavigator.Screen 
            name="DeliveredItems" 
            component={DeliveredItemsScreen}
            options={{ title: 'Delivered Items' }}
          />
        </>
      )}
    </HomeStackNavigator.Navigator>
  );
};

function MessagesStackNavigator() {
  return (
    <MessagesStack.Navigator>
      <MessagesStack.Screen 
        name="ChatList" 
        component={ChatListScreen}
        options={{
          headerShown: true,
        }}
      />
      <MessagesStack.Screen 
        name="Chat" 
        component={ChatScreen}
        options={({ route }) => ({
          title: route.params.otherUserName || 'Chat',
          headerBackTitle: 'Back',
        })}
      />
      <MessagesStack.Screen 
        name="ImageViewer" 
        component={ImageViewerScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          animation: 'fade',
        }}
      />
    </MessagesStack.Navigator>
  );
}

// Define navigation type for the Tab Navigator
type RootTabNavigationProp = NavigationProp<HomeStackParamList>;

export const TabNavigator = () => {
  const { profile, loading } = useAuth();
  const isTraveler = profile?.role === 'traveler';
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation<RootTabNavigationProp>();
  const insets = useSafeAreaInsets();

  const screenOptions = useMemo<BottomTabNavigationOptions>(() => ({
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.text.secondary,
    headerShown: false,
    tabBarStyle: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      height: 60 + insets.bottom,
      paddingBottom: insets.bottom + 1,
      paddingTop: 3,
    },
    tabBarItemStyle: {
      paddingVertical: 8,
    },
    animation: 'none',
  }), [insets.bottom]);

  const getTabBarIcon = useCallback((routeName: keyof TabParamList, focused: boolean, color: string, size: number) => {
    let iconName: IconName = 'alert';

    if (routeName === 'Home') {
      iconName = focused ? 'home' : 'home-outline';
    } else if (routeName === 'Messages') {
      iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
    } else if (routeName === 'Profile') {
      iconName = focused ? 'person' : 'person-outline';
    }

    return <Ionicons name={iconName as any} size={size} color={color} />;
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing TabNavigator:', error);
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  if (loading || !profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          ...screenOptions,
          tabBarIcon: ({ focused, color, size }) => 
            getTabBarIcon(route.name, focused, color, size),
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTitleStyle: {
            fontSize: 18,
            fontWeight: '600',
            color: colors.white,
          },
          headerTintColor: colors.white,
          headerTitleAlign: 'center',
          header: ({ navigation, route, options }) => {
            // Only show header for Profile tab
            if (route.name === 'Home' || route.name === 'Messages') return null;
            return (
              <View 
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.primary,
                  paddingTop: insets.top,
                  height: 32 + insets.top,
                  paddingHorizontal: 16,
                }}
              >
                <Text style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: colors.white,
                  flex: 1,
                  textAlign: 'center'
                }}>
                  {route.name}
                </Text>
              </View>
            );
          }
        })}
      >
        <Tab.Screen 
          name="Home" 
          component={HomeStackScreen}
          options={getScreenOptions('Home', isTraveler)}
        />
        <Tab.Screen 
          name="Messages" 
          component={MessagesStackNavigator}
          options={getScreenOptions('Messages', isTraveler)}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              e.preventDefault();
              // Always navigate to ChatList when Messages tab is pressed
              navigation.navigate('Messages', {
                screen: 'ChatList'
              });
            },
          })}
        />
        <Tab.Screen 
          name="Profile" 
          component={ProfileScreen}
          options={getScreenOptions('Profile', isTraveler)}
        />
      </Tab.Navigator>

      {/* FAB is now moved to the MyItems screen component */}
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorText: {
    color: colors.error,
    fontSize: 16,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  onlineDot: {
    backgroundColor: '#40c057',
  },
  headerStatus: {
    color: colors.white,
    fontSize: 12,
  },
}); 