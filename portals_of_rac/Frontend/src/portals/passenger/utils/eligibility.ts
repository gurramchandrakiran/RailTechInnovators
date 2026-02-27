// passenger-portal/src/utils/eligibility.ts

import { PNR_STATUS, BOARDING_STATUS, OFFER_STATUS } from '../constants';

interface Passenger {
    PNR_Status?: string;
    pnrStatus?: string;
    Boarded?: boolean;
    boarded?: boolean;
    NO_show?: boolean;
    noShow?: boolean;
    boardingStatus?: string;
    Online_Status?: string;
    onlineStatus?: string;
}

interface UpgradeOffer {
    status: string;
    expiresAt?: string | Date;
    berthType?: string;
}

interface EligibilityResult {
    eligible: boolean;
    reason: string;
}

interface AcceptResult {
    canAccept: boolean;
    reason: string;
}

interface DenyResult {
    canDeny: boolean;
    reason: string;
}

interface ViewResult {
    canView: boolean;
    reason: string;
}

interface ValidationResult {
    valid: boolean;
    errors: string[];
}

interface JourneySegment {
    from?: string;
    to?: string;
}

interface VacancySegment {
    start?: string;
    end?: string;
}

/**
 * Check if passenger is eligible to receive upgrade offers
 */
export const checkUpgradeEligibility = (passenger: Passenger | null | undefined): EligibilityResult => {
    if (!passenger) {
        return {
            eligible: false,
            reason: 'Passenger data not available'
        };
    }

    // Must have RAC status
    if (passenger.PNR_Status !== PNR_STATUS.RAC && passenger.pnrStatus !== PNR_STATUS.RAC) {
        return {
            eligible: false,
            reason: 'Only RAC passengers are eligible for upgrades'
        };
    }

    // Must be boarded
    if (!passenger.Boarded && !passenger.boarded) {
        return {
            eligible: false,
            reason: 'Passenger must be boarded to receive upgrade offers'
        };
    }

    // Must not be marked as no-show
    if (passenger.NO_show || passenger.noShow) {
        return {
            eligible: false,
            reason: 'Passenger marked as no-show'
        };
    }

    // Check if passenger has already deboarded
    if (passenger.boardingStatus === BOARDING_STATUS.DEBOARDED) {
        return {
            eligible: false,
            reason: 'Passenger has already deboarded'
        };
    }

    return {
        eligible: true,
        reason: 'Passenger is eligible for upgrades'
    };
};

/**
 * Check if offer can be accepted
 */
export const canAcceptOffer = (offer: UpgradeOffer | null | undefined, passenger: Passenger | null | undefined): AcceptResult => {
    if (!offer) {
        return {
            canAccept: false,
            reason: 'Offer not found'
        };
    }

    // Check if offer is still pending
    if (offer.status !== OFFER_STATUS.PENDING) {
        return {
            canAccept: false,
            reason: `Offer is ${offer.status.toLowerCase()}`
        };
    }

    // Check if offer has expired
    if (offer.expiresAt) {
        const now = Date.now();
        const expiryTime = new Date(offer.expiresAt).getTime();

        if (now >= expiryTime) {
            return {
                canAccept: false,
                reason: 'Offer has expired'
            };
        }
    }

    // Check passenger eligibility
    const eligibility = checkUpgradeEligibility(passenger);
    if (!eligibility.eligible) {
        return {
            canAccept: false,
            reason: eligibility.reason
        };
    }

    // Check if passenger is still on the train
    if (passenger?.boardingStatus === BOARDING_STATUS.DEBOARDED) {
        return {
            canAccept: false,
            reason: 'You have already deboarded'
        };
    }

    return {
        canAccept: true,
        reason: 'Offer can be accepted'
    };
};

/**
 * Check if offer can be denied
 */
export const canDenyOffer = (offer: UpgradeOffer | null | undefined): DenyResult => {
    if (!offer) {
        return {
            canDeny: false,
            reason: 'Offer not found'
        };
    }

    // Can only deny pending offers
    if (offer.status !== OFFER_STATUS.PENDING) {
        return {
            canDeny: false,
            reason: `Offer is already ${offer.status.toLowerCase()}`
        };
    }

    return {
        canDeny: true,
        reason: 'Offer can be denied'
    };
};

/**
 * Validate journey segment overlap
 */
export const validateJourneySegment = (passengerJourney: JourneySegment | null | undefined, vacancySegment: VacancySegment | null | undefined): boolean => {
    if (!passengerJourney || !vacancySegment) {
        return false;
    }

    // This is a simplified check - actual implementation would need station order
    // For now, we trust the backend's calculation
    return true;
};

/**
 * Check if co-passenger is eligible
 */
export const isCoPassengerEligible = (coPassenger: Passenger | null | undefined): boolean => {
    if (!coPassenger) {
        return false;
    }

    // Co-passenger must also be boarded and not no-show
    return (
        (coPassenger.Boarded || coPassenger.boarded) &&
        !(coPassenger.NO_show || coPassenger.noShow) &&
        coPassenger.boardingStatus !== BOARDING_STATUS.DEBOARDED
    ) as boolean;
};

/**
 * Calculate offer priority score (higher = better offer)
 */
export const calculateOfferPriority = (offer: UpgradeOffer | null | undefined): number => {
    if (!offer) return 0;

    let score = 0;

    // Better berth types get higher scores
    const berthTypeScores: Record<string, number> = {
        'LB': 5, // Lower Berth (most preferred)
        'SL': 4, // Side Lower
        'MB': 3, // Middle Berth
        'UB': 2, // Upper Berth
        'SU': 1  // Side Upper
    };

    score += berthTypeScores[offer.berthType || ''] || 0;

    // Offers with longer validity get higher scores
    if (offer.expiresAt) {
        const timeRemaining = new Date(offer.expiresAt).getTime() - Date.now();
        const minutesRemaining = Math.floor(timeRemaining / 60000);
        score += Math.min(minutesRemaining / 10, 5); // Max 5 points for time
    }

    return score;
};

/**
 * Check if offer is expiring soon
 */
export const isOfferExpiringSoon = (offer: UpgradeOffer | null | undefined, threshold: number = 15000): boolean => {
    if (!offer || !offer.expiresAt) {
        return false;
    }

    const now = Date.now();
    const expiryTime = new Date(offer.expiresAt).getTime();
    const timeRemaining = expiryTime - now;

    return timeRemaining > 0 && timeRemaining <= threshold;
};

/**
 * Check if passenger can view upgrade offers page
 */
export const canViewUpgradeOffers = (passenger: Passenger | null | undefined): ViewResult => {
    if (!passenger) {
        return {
            canView: false,
            reason: 'Please check your PNR first'
        };
    }

    // Check if passenger is online
    if (passenger.Online_Status === 'offline' || passenger.onlineStatus === 'offline') {
        return {
            canView: false,
            reason: 'Upgrade offers are only available for online bookings'
        };
    }

    return {
        canView: true,
        reason: 'You can view upgrade offers'
    };
};

/**
 * Validate offer response
 */
export const validateOfferResponse = (
    offer: UpgradeOffer | null | undefined,
    action: string,
    passenger: Passenger | null | undefined
): ValidationResult => {
    const errors: string[] = [];

    if (!offer) {
        errors.push('Offer not found');
    }

    if (!['accept', 'deny'].includes(action)) {
        errors.push('Invalid action type');
    }

    if (!passenger) {
        errors.push('Passenger data not available');
    }

    if (offer && offer.status !== OFFER_STATUS.PENDING) {
        errors.push(`Cannot ${action} an offer that is ${offer.status.toLowerCase()}`);
    }

    if (offer && offer.expiresAt) {
        const now = Date.now();
        const expiryTime = new Date(offer.expiresAt).getTime();

        if (now >= expiryTime) {
            errors.push('Offer has expired');
        }
    }

    if (action === 'accept' && passenger) {
        const eligibility = checkUpgradeEligibility(passenger);
        if (!eligibility.eligible) {
            errors.push(eligibility.reason);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Get eligibility status color for UI
 */
export const getEligibilityStatusColor = (eligible: boolean): string => {
    return eligible ? 'success' : 'error';
};

/**
 * Get eligibility icon
 */
export const getEligibilityIcon = (eligible: boolean): string => {
    return eligible ? 'CheckCircle' : 'Cancel';
};

/**
 * Format eligibility reason for display
 */
export const formatEligibilityReason = (reason: string | null | undefined): string => {
    if (!reason) return '';

    // Capitalize first letter
    return reason.charAt(0).toUpperCase() + reason.slice(1);
};

export default {
    checkUpgradeEligibility,
    canAcceptOffer,
    canDenyOffer,
    validateJourneySegment,
    isCoPassengerEligible,
    calculateOfferPriority,
    isOfferExpiringSoon,
    canViewUpgradeOffers,
    validateOfferResponse,
    getEligibilityStatusColor,
    getEligibilityIcon,
    formatEligibilityReason
};
