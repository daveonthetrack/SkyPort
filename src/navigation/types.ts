import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Item, Trip, Profile } from '../types/models';

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  ProfileSetup: undefined;
  MainApp: undefined;
  PhoneVerification: {
    phoneNumber: string;
  };
  ImageViewer: {
    uri: string;
  };
  Auth: undefined;
  Chat: ChatScreenParams;
  ChatList: undefined;
  NewChat: undefined;
};

export type TabParamList = {
  Home: undefined;
  Messages: { screen?: keyof MessagesStackParamList; params?: any };
  Profile: undefined;
};

export type ChatScreenParams = {
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  itemId?: string;
  tripId?: string;
};

export type MessagesStackParamList = {
  ChatList: undefined;
  Chat: ChatScreenParams;
  NewChat: undefined;
  ImageViewer: { uri: string };
};

export type HomeStackParamList = {
  Dashboard: undefined;
  PostTrip: undefined;
  MyTrips: undefined;
  FindItems: {
    tripId?: number;
    origin?: string;
    destination?: string;
  };
  PostItem: undefined;
  MyItems: undefined;
  FindTravelers: {
    itemId?: number;
    origin?: string;
    destination?: string;
  };
  ItemDetails: { 
    itemId: string | number;
    item?: Item;
  };
  PickupDetails: { 
    itemId: string | number;
    item?: Item;
    trip?: Trip;
  };
  TravelerItemDetails: {
    itemId: string;
  };
  TripDetails: {
    tripId: string;
    trip?: Trip;
  };
  Chat: {
    userId: string;
    userName: string;
  };
  EditProfile: {
    profile?: Profile;
  };
  Notifications: undefined;
  Community: undefined;
  Home: undefined;
  Profile: undefined;
  DeliveredItems: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

export type TabScreenProps<T extends keyof TabParamList> = BottomTabScreenProps<
  TabParamList,
  T
>;

export type MessagesStackScreenProps<T extends keyof MessagesStackParamList> = NativeStackScreenProps<
  MessagesStackParamList,
  T
>;

export type HomeStackScreenProps<T extends keyof HomeStackParamList> = NativeStackScreenProps<
  HomeStackParamList,
  T
>; 