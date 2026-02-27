// passenger-portal/src/utils/formatters.ts

interface NotificationData {
    fromBerth?: string;
    toBerth?: string;
    coach?: string;
    reason?: string;
    message?: string;
}

/**
 * Format PNR number with spacing for display
 */
export const formatPNRDisplay = (pnr: string | null | undefined): string => {
    if (!pnr) return '';
    const cleaned = String(pnr).replace(/\s/g, '');
    if (cleaned.length === 10) {
        return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8)}`;
    }
    return cleaned;
};

/**
 * Format currency (Indian Rupees)
 */
export const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    return phone;
};

/**
 * Format train number with name
 */
export const formatTrainInfo = (trainNo: string | null | undefined, trainName: string | null | undefined): string => {
    if (!trainNo && !trainName) return '';
    if (!trainName) return trainNo || '';
    if (!trainNo) return trainName;
    return `${trainNo} - ${trainName}`;
};

/**
 * Format station name with code
 */
export const formatStationInfo = (stationName: string | null | undefined, stationCode: string | null | undefined): string => {
    if (!stationName && !stationCode) return '';
    if (!stationCode) return stationName || '';
    if (!stationName) return stationCode;
    return `${stationName} (${stationCode})`;
};

/**
 * Format journey segment
 */
export const formatJourneySegment = (from: string | null | undefined, to: string | null | undefined): string => {
    if (!from || !to) return '';
    return `${from} → ${to}`;
};

/**
 * Format berth allocation
 */
export const formatBerthAllocation = (coach: string | null | undefined, berth: number | string | null | undefined, berthType?: string): string => {
    if (!coach || !berth) return '';
    const base = `${coach}-${berth}`;
    return berthType ? `${base} (${berthType})` : base;
};

/**
 * Format passenger name (title case)
 */
export const formatPassengerName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * Format age with suffix
 */
export const formatAge = (age: number | null | undefined): string => {
    if (!age) return '';
    return `${age} ${age === 1 ? 'year' : 'years'}`;
};

/**
 * Format gender display
 */
export const formatGender = (gender: string | null | undefined): string => {
    const genderMap: Record<string, string> = {
        'M': 'Male',
        'F': 'Female',
        'O': 'Other'
    };
    return genderMap[gender?.toUpperCase() || ''] || gender || '';
};

/**
 * Format date range
 */
export const formatDateRange = (startDate: Date | string | null | undefined, endDate: Date | string | null | undefined): string => {
    if (!startDate || !endDate) return '';
    const start = new Date(startDate);
    const end = new Date(endDate);

    const formatOptions: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    const startStr = start.toLocaleDateString('en-IN', formatOptions);
    const endStr = end.toLocaleDateString('en-IN', formatOptions);

    return `${startStr} - ${endStr}`;
};

/**
 * Format time duration
 */
export const formatDuration = (minutes: number | null | undefined): string => {
    if (!minutes || minutes < 0) return '0m';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
};

/**
 * Format countdown timer for display
 */
export const formatCountdown = (seconds: number | null | undefined): string => {
    if (!seconds || seconds < 0) return '00:00';

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes || bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Format percentage
 */
export const formatPercentage = (value: number, total: number, decimals: number = 0): string => {
    if (!total || total === 0) return '0%';
    const percentage = (value / total) * 100;
    return `${percentage.toFixed(decimals)}%`;
};

/**
 * Format relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (date: Date | string | number | null | undefined): string => {
    if (!date) return '';

    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return then.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Format notification message
 */
export const formatNotificationMessage = (type: string, data: NotificationData): string => {
    switch (type) {
        case 'OFFER':
            return `New upgrade offer: ${data.fromBerth || 'RAC'} → ${data.toBerth} in coach ${data.coach}`;
        case 'CONFIRMATION':
            return `Your upgrade to ${data.toBerth} has been confirmed!`;
        case 'REJECTION':
            return `Upgrade offer declined: ${data.reason || 'Not specified'}`;
        case 'EXPIRY':
            return `Upgrade offer expired: ${data.toBerth}`;
        default:
            return data.message || 'Notification received';
    }
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string | null | undefined, maxLength: number = 50): string => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
};

/**
 * Format array to comma-separated list
 */
export const formatList = (items: string[] | null | undefined, lastSeparator: string = 'and'): string => {
    if (!items || items.length === 0) return '';
    if (items.length === 1) return String(items[0]);
    if (items.length === 2) return `${items[0]} ${lastSeparator} ${items[1]}`;

    const allButLast = items.slice(0, -1).join(', ');
    const last = items[items.length - 1];
    return `${allButLast}, ${lastSeparator} ${last}`;
};

/**
 * Format validation error messages
 */
export const formatValidationErrors = (errors: Record<string, string> | null | undefined): string => {
    if (!errors || Object.keys(errors).length === 0) return '';

    const messages = Object.entries(errors).map(([field, error]) => {
        const fieldName = field.replace(/([A-Z])/g, ' $1').toLowerCase();
        return `${fieldName}: ${error}`;
    });

    return messages.join('; ');
};

/**
 * Format quota display name
 */
export const formatQuota = (quota: string | null | undefined): string => {
    const quotaMap: Record<string, string> = {
        'GN': 'General',
        'TQ': 'Tatkal',
        'LD': 'Ladies',
        'SS': 'Senior Citizen',
        'LB': 'Lower Berth',
        'HP': 'Physically Handicapped'
    };
    return quotaMap[quota || ''] || quota || '';
};

export default {
    formatPNRDisplay,
    formatCurrency,
    formatPhoneNumber,
    formatTrainInfo,
    formatStationInfo,
    formatJourneySegment,
    formatBerthAllocation,
    formatPassengerName,
    formatAge,
    formatGender,
    formatDateRange,
    formatDuration,
    formatCountdown,
    formatFileSize,
    formatPercentage,
    formatRelativeTime,
    formatNotificationMessage,
    truncateText,
    formatList,
    formatValidationErrors,
    formatQuota
};
