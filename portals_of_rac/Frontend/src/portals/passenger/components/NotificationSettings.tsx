// passenger-portal/src/components/NotificationSettings.tsx

import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Button,
    Box,
    Alert,
    Divider
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import notificationManager from '../utils/notifications';

function NotificationSettings(): React.ReactElement {
    const [isSupported, setIsSupported] = useState<boolean>(false);
    const [permission, setPermission] = useState<NotificationPermission | 'default'>('default');
    const [isSubscribed, setIsSubscribed] = useState<boolean>(false);

    useEffect(() => {
        setIsSupported(notificationManager.isNotificationSupported());
        if ('Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const handleEnableNotifications = async (): Promise<void> => {
        const granted = await notificationManager.requestPermission();

        if (granted) {
            const result = await notificationManager.subscribe();
            if (result.success) {
                setIsSubscribed(true);
                setPermission('granted');
                alert('✅ Notifications enabled! You will be notified when your RAC ticket gets confirmed.');
            }
        } else {
            alert('⚠️ Please allow notifications in your browser settings.');
        }
    };

    const handleTestNotification = (): void => {
        notificationManager.testNotification();
    };

    if (!isSupported) {
        return (
            <Card elevation={2}>
                <CardContent>
                    <Alert severity="warning">
                        Push notifications are not supported in this browser.
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card elevation={2}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <NotificationsActiveIcon sx={{ fontSize: 32, mr: 2, color: '#1976d2' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Notification Settings
                    </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Get instant notifications when your RAC ticket is confirmed!
                </Typography>

                <Divider sx={{ my: 2 }} />

                {permission === 'denied' && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        Notifications are blocked. Please enable them in your browser settings.
                    </Alert>
                )}

                {permission === 'default' && (
                    <Box>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                            🔔 Enable notifications to get real-time updates about:
                        </Typography>
                        <Box sx={{ pl: 2, mb: 2 }}>
                            <Typography variant="body2">• RAC to CNF confirmations</Typography>
                            <Typography variant="body2">• Seat allocation updates</Typography>
                            <Typography variant="body2">• Journey reminders</Typography>
                        </Box>
                        <Button
                            variant="contained"
                            fullWidth
                            startIcon={<NotificationsActiveIcon />}
                            onClick={handleEnableNotifications}
                            sx={{ mb: 1 }}
                        >
                            Enable Notifications
                        </Button>
                    </Box>
                )}

                {permission === 'granted' && (
                    <Box>
                        <Alert severity="success" sx={{ mb: 2 }}>
                            ✅ Notifications are enabled! You'll be notified about ticket upgrades.
                        </Alert>
                        <Button
                            variant="outlined"
                            fullWidth
                            onClick={handleTestNotification}
                        >
                            Test Notification
                        </Button>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

export default NotificationSettings;

