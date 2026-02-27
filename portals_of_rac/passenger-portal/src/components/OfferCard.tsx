// passenger-portal/src/components/OfferCard.tsx

import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    CardActions,
    Typography,
    Button,
    Chip,
    Box,
    LinearProgress,
    Divider,
    Stack,
    Alert
} from '@mui/material';
import {
    CheckCircle,
    Cancel,
    Timer,
    EventSeat,
    Train,
    TrendingUp,
    AccessTime
} from '@mui/icons-material';
import { OFFER_STATUS } from '../constants';
import {
    formatCountdown,
    formatRelativeTime
} from '../utils/formatters';
import {
    calculateTimeRemaining,
    isExpiringSoon,
    getBerthTypeDisplayName
} from '../utils/helpers';

interface Offer {
    id: string;
    notificationId?: string;
    status: string;
    expiresAt?: string;
    fromBerth?: string;
    toBerth?: string;
    coach?: string;
    berthType?: string;
    createdAt?: string;
    rejectionReason?: string;
}

interface OfferCardProps {
    offer: Offer | null;
    onAccept?: (offerId: string, notificationId?: string) => void;
    onDeny?: (offerId: string, notificationId?: string) => void;
    disabled?: boolean;
    showActions?: boolean;
}

const OfferCard: React.FC<OfferCardProps> = ({
    offer,
    onAccept,
    onDeny,
    disabled = false,
    showActions = true
}) => {
    const [timeRemaining, setTimeRemaining] = useState<number>(0);
    const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
    const [actionType, setActionType] = useState<'accept' | 'deny' | null>(null);

    // Update countdown timer
    useEffect(() => {
        if (!offer || !offer.expiresAt) return;

        const updateTimer = (): void => {
            const remaining = calculateTimeRemaining(offer.expiresAt!);
            setTimeRemaining(remaining);

            if (remaining <= 0) {
                clearInterval(interval);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [offer]);

    if (!offer) return null;

    const isExpiring = isExpiringSoon(timeRemaining, 15000);
    const isExpired = timeRemaining <= 0 && offer.status === OFFER_STATUS.PENDING;
    const isPending = offer.status === OFFER_STATUS.PENDING && !isExpired;
    const isAccepted = offer.status === OFFER_STATUS.ACCEPTED;
    const isConfirmed = offer.status === OFFER_STATUS.CONFIRMED;
    const isDenied = offer.status === OFFER_STATUS.DENIED;
    const isRejected = offer.status === OFFER_STATUS.REJECTED;

    const getStatusColor = (): 'success' | 'info' | 'default' | 'warning' | 'primary' => {
        if (isConfirmed) return 'success';
        if (isAccepted) return 'info';
        if (isDenied || isRejected) return 'default';
        if (isExpired) return 'default';
        if (isExpiring) return 'warning';
        return 'primary';
    };

    const getStatusText = (): string => {
        if (isConfirmed) return 'Confirmed';
        if (isAccepted) return 'Waiting for TTE';
        if (isDenied) return 'Declined';
        if (isRejected) return 'Not Approved';
        if (isExpired) return 'Expired';
        return 'Available';
    };

    const handleAcceptClick = (): void => {
        setActionType('accept');
        setShowConfirmDialog(true);
    };

    const handleDenyClick = (): void => {
        setActionType('deny');
        setShowConfirmDialog(true);
    };

    const handleConfirmAction = (): void => {
        if (actionType === 'accept' && onAccept) {
            onAccept(offer.id, offer.notificationId);
        } else if (actionType === 'deny' && onDeny) {
            onDeny(offer.id, offer.notificationId);
        }
        setShowConfirmDialog(false);
        setActionType(null);
    };

    const handleCancelAction = (): void => {
        setShowConfirmDialog(false);
        setActionType(null);
    };

    const progressPercentage = offer.expiresAt && timeRemaining > 0
        ? (timeRemaining / 60000) * 100
        : 0;

    return (
        <>
            <Card
                elevation={3}
                sx={{
                    borderLeft: 6,
                    borderColor: isExpiring ? 'warning.main' : isConfirmed ? 'success.main' : 'primary.main',
                    opacity: isExpired || isDenied || isRejected ? 0.7 : 1,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        boxShadow: isPending ? 8 : 3
                    }
                }}
            >
                <CardContent sx={{ pb: 1 }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrendingUp color="primary" />
                            Upgrade Offer
                        </Typography>
                        <Chip
                            label={getStatusText()}
                            color={getStatusColor()}
                            size="small"
                            icon={isConfirmed ? <CheckCircle /> : isExpiring ? <Timer /> : undefined}
                        />
                    </Box>

                    {/* Berth Information */}
                    <Box sx={{ mb: 2 }}>
                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ my: 2 }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Current
                                </Typography>
                                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                                    {offer.fromBerth || 'RAC'}
                                </Typography>
                            </Box>
                            <TrendingUp sx={{ fontSize: 40, color: 'primary.main' }} />
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    Upgrade to
                                </Typography>
                                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                    {offer.toBerth}
                                </Typography>
                            </Box>
                        </Stack>

                        <Divider sx={{ my: 2 }} />

                        <Stack spacing={1}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">
                                    <Train sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                                    Coach:
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {offer.coach}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">
                                    <EventSeat sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                                    Berth Type:
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {getBerthTypeDisplayName(offer.berthType || '') || 'Standard'}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body2" color="text.secondary">
                                    <AccessTime sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                                    Offered:
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {formatRelativeTime(offer.createdAt)}
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>

                    {/* Timer and Progress */}
                    {isPending && offer.expiresAt && (
                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Time remaining:
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontWeight: 'bold',
                                        color: isExpiring ? 'warning.main' : 'primary.main'
                                    }}
                                >
                                    {formatCountdown(Math.floor(timeRemaining / 1000))}
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={Math.min(progressPercentage, 100)}
                                color={isExpiring ? 'warning' : 'primary'}
                                sx={{ height: 8, borderRadius: 1 }}
                            />
                        </Box>
                    )}

                    {/* Warning for expiring soon */}
                    {isPending && isExpiring && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            <strong>Hurry!</strong> This offer will expire soon. Accept now!
                        </Alert>
                    )}

                    {/* Accepted status message */}
                    {isAccepted && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            You have accepted this offer. Waiting for TTE to confirm...
                        </Alert>
                    )}

                    {/* Confirmed status message */}
                    {isConfirmed && (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            <strong>Congratulations!</strong> Your upgrade has been confirmed by the TTE.
                        </Alert>
                    )}

                    {/* Rejected status message */}
                    {isRejected && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            This upgrade was not approved by the TTE.
                            {offer.rejectionReason && ` Reason: ${offer.rejectionReason}`}
                        </Alert>
                    )}

                    {/* Expired message */}
                    {isExpired && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            This offer has expired.
                        </Alert>
                    )}
                </CardContent>

                {/* Actions */}
                {showActions && isPending && !isExpired && (
                    <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<Cancel />}
                            onClick={handleDenyClick}
                            disabled={disabled}
                            fullWidth
                            sx={{ mr: 1 }}
                        >
                            Decline
                        </Button>
                        <Button
                            variant="contained"
                            color="success"
                            startIcon={<CheckCircle />}
                            onClick={handleAcceptClick}
                            disabled={disabled}
                            fullWidth
                            sx={{ ml: 1 }}
                        >
                            Accept Upgrade
                        </Button>
                    </CardActions>
                )}
            </Card>

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
                <Box
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1300
                    }}
                    onClick={handleCancelAction}
                >
                    <Card
                        sx={{ maxWidth: 400, m: 2 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                {actionType === 'accept' ? 'Accept Upgrade?' : 'Decline Offer?'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {actionType === 'accept'
                                    ? `Are you sure you want to accept the upgrade to ${offer.toBerth} in coach ${offer.coach}? This action requires TTE confirmation.`
                                    : 'Are you sure you want to decline this upgrade offer? You may not get another chance.'}
                            </Typography>
                        </CardContent>
                        <CardActions sx={{ justifyContent: 'flex-end' }}>
                            <Button onClick={handleCancelAction}>
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                color={actionType === 'accept' ? 'success' : 'error'}
                                onClick={handleConfirmAction}
                            >
                                {actionType === 'accept' ? 'Yes, Accept' : 'Yes, Decline'}
                            </Button>
                        </CardActions>
                    </Card>
                </Box>
            )}
        </>
    );
};

export default OfferCard;

