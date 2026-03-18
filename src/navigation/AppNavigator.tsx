import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ResultScreen from '../screens/ResultScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HistoryScreen from '../screens/HistoryScreen';

export type RootStackParamList = {
  Home: undefined;
  Result: { transcription: string; summary: string; audioPath?: string; language?: string; };
  Settings: undefined;
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => (
  <NavigationContainer>
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: '#14112b' },
        headerTintColor: '#a89af0',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#14112b' },
      }}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Result" component={ResultScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;
