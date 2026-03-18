import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';
import { bootstrapNotifications } from './src/utils/notificationService';

const App: React.FC = () => {
  useEffect(() => {
    bootstrapNotifications().catch(console.error);
  }, []);

  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
};

export default App;
