import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AvatarSelectScreen from './screens/AvatarSelectScreen';
import AvatarCallScreen from './screens/AvatarCallScreen';
import CreateAvatarScreen from './screens/CreateAvatarScreen';
import { StatusBar } from 'expo-status-bar';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="AvatarSelect"
          screenOptions={{
            headerStyle: { backgroundColor: '#1a1a2e' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: '#0f0f23' },
          }}
        >
          <Stack.Screen
            name="AvatarSelect"
            component={AvatarSelectScreen}
            options={{ title: '🇮🇳 AI Avatar Platform' }}
          />
          <Stack.Screen
            name="AvatarCall"
            component={AvatarCallScreen}
            options={({ route }) => ({
              title: route.params?.avatar?.name || 'Avatar',
              headerBackTitle: 'Back',
            })}
          />
          <Stack.Screen
            name="CreateAvatar"
            component={CreateAvatarScreen}
            options={{ title: '✨ Create Avatar' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
