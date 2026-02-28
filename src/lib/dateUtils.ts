export function formatRelativeTime(date: Date | string | number): string {
    let parsedDate = date;

    // Hive returns timestamps in UTC but without the trailing 'Z'. 
    // We need to append 'Z' so browsers parse it as UTC rather than local time.
    if (typeof parsedDate === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(parsedDate)) {
        parsedDate += 'Z';
    }

    const now = new Date();
    const then = new Date(parsedDate);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    // Safety check for NaN values
    if (isNaN(diffInSeconds)) return 'Unknown';

    const isFuture = diffInSeconds < 0;
    const absDiff = Math.abs(diffInSeconds);

    if (absDiff < 60) {
        return isFuture ? `in ${absDiff} seconds` : `${absDiff} seconds ago`;
    }

    const diffInMinutes = Math.floor(absDiff / 60);
    if (diffInMinutes < 60) {
        return isFuture ? `in ${diffInMinutes}m` : `${diffInMinutes}m ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
        return isFuture ? `in ${diffInHours}h` : `${diffInHours}h ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
        return isFuture ? `in ${diffInDays}d` : `${diffInDays}d ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
        return isFuture ? `in ${diffInMonths}mo` : `${diffInMonths}mo ago`;
    }

    const diffInYears = Math.floor(diffInMonths / 12);
    return isFuture ? `in ${diffInYears}y` : `${diffInYears}y ago`;
}
