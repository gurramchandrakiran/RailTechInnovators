// passenger-portal/src/services/offerService.ts

import { OFFER_STATUS, STORAGE_KEYS } from '../constants';
import { storage, generateUniqueId } from '../utils/helpers';

interface OfferMetadata {
    [key: string]: unknown;
}

interface Offer {
    id: string;
    notificationId?: string;
    pnr: string;
    fromBerth?: string;
    toBerth?: string;
    coach?: string;
    berthType?: string;
    status: string;
    createdAt: string;
    expiresAt?: string;
    acceptedAt?: string | null;
    deniedAt?: string | null;
    confirmedAt?: string | null;
    rejectedAt?: string | null;
    expiredAt?: string;
    updatedAt?: string;
    denialReason?: string | null;
    rejectionReason?: string | null;
    metadata?: OfferMetadata;
}

interface OfferFilters {
    status?: string;
    active?: boolean;
    pnr?: string;
}

interface OfferStatistics {
    total: number;
    pending: number;
    accepted: number;
    denied: number;
    confirmed: number;
    rejected: number;
    expired: number;
}

/**
 * Offer Service
 * Manages upgrade offers including storage, merging, and status tracking
 */
class OfferService {
    private offers: Map<string, Offer>;

    constructor() {
        this.offers = new Map();
        this.loadOffersFromStorage();
    }

    /**
     * Load offers from local storage
     */
    loadOffersFromStorage(): void {
        try {
            const stored = storage.get<Offer[]>(STORAGE_KEYS.OFFERS, []);
            if (stored) {
                stored.forEach(offer => {
                    this.offers.set(offer.id, offer);
                });
            }
        } catch (error) {
            console.error('Failed to load offers from storage', error);
        }
    }

    /**
     * Save offers to local storage
     */
    saveOffersToStorage(): void {
        try {
            const offersArray = Array.from(this.offers.values());
            storage.set(STORAGE_KEYS.OFFERS, offersArray);
        } catch (error) {
            console.error('Failed to save offers to storage', error);
        }
    }

    /**
     * Add new offer
     */
    addOffer(offerData: Partial<Offer> & { pnr: string }): Offer {
        const offer: Offer = {
            id: offerData.id || generateUniqueId(),
            notificationId: offerData.notificationId,
            pnr: offerData.pnr,
            fromBerth: offerData.fromBerth,
            toBerth: offerData.toBerth,
            coach: offerData.coach,
            berthType: offerData.berthType,
            status: offerData.status || OFFER_STATUS.PENDING,
            createdAt: offerData.createdAt || new Date().toISOString(),
            expiresAt: offerData.expiresAt,
            acceptedAt: offerData.acceptedAt || null,
            deniedAt: offerData.deniedAt || null,
            confirmedAt: offerData.confirmedAt || null,
            rejectedAt: offerData.rejectedAt || null,
            metadata: offerData.metadata || {}
        };

        this.offers.set(offer.id, offer);
        this.saveOffersToStorage();

        return offer;
    }

    /**
     * Update existing offer
     */
    updateOffer(offerId: string, updates: Partial<Offer>): Offer | null {
        const offer = this.offers.get(offerId);
        if (!offer) {
            console.warn(`Offer not found: ${offerId}`);
            return null;
        }

        const updatedOffer: Offer = {
            ...offer,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.offers.set(offerId, updatedOffer);
        this.saveOffersToStorage();

        return updatedOffer;
    }

    /**
     * Get offer by ID
     */
    getOffer(offerId: string): Offer | null {
        return this.offers.get(offerId) || null;
    }

    /**
     * Get offer by notification ID
     */
    getOfferByNotificationId(notificationId: string): Offer | null {
        return Array.from(this.offers.values()).find(
            offer => offer.notificationId === notificationId
        ) || null;
    }

    /**
     * Get all offers for a PNR
     */
    getOffersByPNR(pnr: string, filters: OfferFilters = {}): Offer[] {
        let offers = Array.from(this.offers.values()).filter(
            offer => offer.pnr === pnr
        );

        // Apply status filter
        if (filters.status) {
            offers = offers.filter(offer => offer.status === filters.status);
        }

        // Apply active filter (not expired and pending)
        if (filters.active) {
            const now = new Date().getTime();
            offers = offers.filter(offer => {
                if (offer.status !== OFFER_STATUS.PENDING) return false;
                if (!offer.expiresAt) return true;
                return new Date(offer.expiresAt).getTime() > now;
            });
        }

        // Sort by creation date (newest first)
        offers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return offers;
    }

    /**
     * Get all active offers for a PNR
     */
    getActiveOffers(pnr: string): Offer[] {
        return this.getOffersByPNR(pnr, { active: true });
    }

    /**
     * Get all offers (with optional filters)
     */
    getAllOffers(filters: OfferFilters = {}): Offer[] {
        let offers = Array.from(this.offers.values());

        if (filters.status) {
            offers = offers.filter(offer => offer.status === filters.status);
        }

        if (filters.pnr) {
            offers = offers.filter(offer => offer.pnr === filters.pnr);
        }

        return offers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    /**
     * Mark offer as accepted
     */
    acceptOffer(offerId: string): Offer | null {
        return this.updateOffer(offerId, {
            status: OFFER_STATUS.ACCEPTED,
            acceptedAt: new Date().toISOString()
        });
    }

    /**
     * Mark offer as denied
     */
    denyOffer(offerId: string, reason: string | null = null): Offer | null {
        return this.updateOffer(offerId, {
            status: OFFER_STATUS.DENIED,
            deniedAt: new Date().toISOString(),
            denialReason: reason
        });
    }

    /**
     * Mark offer as confirmed (by TTE)
     */
    confirmOffer(offerId: string): Offer | null {
        return this.updateOffer(offerId, {
            status: OFFER_STATUS.CONFIRMED,
            confirmedAt: new Date().toISOString()
        });
    }

    /**
     * Mark offer as rejected (by TTE)
     */
    rejectOffer(offerId: string, reason: string | null = null): Offer | null {
        return this.updateOffer(offerId, {
            status: OFFER_STATUS.REJECTED,
            rejectedAt: new Date().toISOString(),
            rejectionReason: reason
        });
    }

    /**
     * Mark offer as expired
     */
    expireOffer(offerId: string): Offer | null {
        return this.updateOffer(offerId, {
            status: OFFER_STATUS.EXPIRED,
            expiredAt: new Date().toISOString()
        });
    }

    /**
     * Check and expire old offers
     */
    expireOldOffers(pnr: string | null = null): void {
        const now = new Date().getTime();
        const offersToCheck = pnr
            ? this.getOffersByPNR(pnr)
            : Array.from(this.offers.values());

        offersToCheck.forEach(offer => {
            if (offer.status === OFFER_STATUS.PENDING && offer.expiresAt) {
                const expiryTime = new Date(offer.expiresAt).getTime();
                if (now >= expiryTime) {
                    this.expireOffer(offer.id);
                }
            }
        });
    }

    /**
     * Delete offer
     */
    deleteOffer(offerId: string): boolean {
        const deleted = this.offers.delete(offerId);
        if (deleted) {
            this.saveOffersToStorage();
        }
        return deleted;
    }

    /**
     * Clear all offers for a PNR
     */
    clearOffersByPNR(pnr: string): void {
        const offers = this.getOffersByPNR(pnr);
        offers.forEach(offer => this.offers.delete(offer.id));
        this.saveOffersToStorage();
    }

    /**
     * Clear all offers
     */
    clearAllOffers(): void {
        this.offers.clear();
        this.saveOffersToStorage();
    }

    /**
     * Merge offers from server
     */
    mergeServerOffers(serverOffers: Partial<Offer>[], pnr: string): void {
        if (!Array.isArray(serverOffers)) {
            return;
        }

        // Get existing offers for this PNR
        const existingOffers = this.getOffersByPNR(pnr);
        const existingNotificationIds = new Set(
            existingOffers.map(offer => offer.notificationId)
        );

        // Add new offers from server
        serverOffers.forEach(serverOffer => {
            if (!existingNotificationIds.has(serverOffer.notificationId)) {
                this.addOffer({ ...serverOffer, pnr } as Partial<Offer> & { pnr: string });
            } else {
                // Update existing offer if server has newer data
                const existing = this.getOfferByNotificationId(serverOffer.notificationId!);
                if (existing && this.shouldUpdateFromServer(existing, serverOffer)) {
                    this.updateOffer(existing.id, serverOffer);
                }
            }
        });

        // Expire old offers
        this.expireOldOffers(pnr);
    }

    /**
     * Check if offer should be updated from server
     */
    private shouldUpdateFromServer(localOffer: Offer, serverOffer: Partial<Offer>): boolean {
        // Always update if server status is different
        if (localOffer.status !== serverOffer.status) {
            return true;
        }

        // Update if server has confirmation/rejection timestamp
        if (serverOffer.confirmedAt || serverOffer.rejectedAt) {
            return true;
        }

        return false;
    }

    /**
     * Get offer statistics
     */
    getStatistics(pnr: string | null = null): OfferStatistics {
        const offers = pnr
            ? this.getOffersByPNR(pnr)
            : Array.from(this.offers.values());

        return {
            total: offers.length,
            pending: offers.filter(o => o.status === OFFER_STATUS.PENDING).length,
            accepted: offers.filter(o => o.status === OFFER_STATUS.ACCEPTED).length,
            denied: offers.filter(o => o.status === OFFER_STATUS.DENIED).length,
            confirmed: offers.filter(o => o.status === OFFER_STATUS.CONFIRMED).length,
            rejected: offers.filter(o => o.status === OFFER_STATUS.REJECTED).length,
            expired: offers.filter(o => o.status === OFFER_STATUS.EXPIRED).length
        };
    }

    /**
     * Export offers as JSON
     */
    exportOffers(pnr: string | null = null): string {
        const offers = pnr
            ? this.getOffersByPNR(pnr)
            : Array.from(this.offers.values());

        return JSON.stringify(offers, null, 2);
    }

    /**
     * Import offers from JSON
     */
    importOffers(jsonString: string): void {
        try {
            const offers = JSON.parse(jsonString);
            if (Array.isArray(offers)) {
                offers.forEach(offer => this.addOffer(offer));
            }
        } catch (error) {
            console.error('Failed to import offers', error);
        }
    }
}

// Create singleton instance
const offerService = new OfferService();

export default offerService;
export { OfferService };
export type { Offer, OfferFilters, OfferStatistics };
