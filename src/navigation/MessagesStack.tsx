import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MessagesStackParamList } from './types';
import ChatListScreen from '../screens/ChatListScreen';
import ChatScreen from '../screens/ChatScreen';
import NewChatScreen from '../screens/NewChatScreen';
import ImageViewerScreen from '../screens/ImageViewerScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<MessagesStackParamList>();

const MessagesStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerTintColor: colors.primary,
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({
          title: route.params.otherUserName,
        })}
      />
      <Stack.Screen
        name="NewChat"
        component={NewChatScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="ImageViewer" 
        component={ImageViewerScreen}
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          animation: 'fade',
        }}
      />
    </Stack.Navigator>
  );
};

export default MessagesStack; 